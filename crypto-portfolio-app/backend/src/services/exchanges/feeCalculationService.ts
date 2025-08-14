import { EventEmitter } from 'events';
import { exchangeService } from './exchangeService';
import { cacheService } from '../cacheService';
import { rateLimitService } from '../rateLimitService';
import { loggingService } from '../loggingService';
import { prisma } from '../../config/database';

interface FeeStructure {
  maker: number;
  taker: number;
  withdrawal?: Record<string, number>;
  deposit?: Record<string, number>;
}

interface TradeFee {
  symbol: string;
  side: 'buy' | 'sell';
  type: 'market' | 'limit';
  quantity: number;
  price?: number;
  fee: number;
  feeAsset: string;
  feeRate: number;
  exchangeFees: FeeStructure;
}

interface WithdrawalFee {
  asset: string;
  network?: string;
  fee: number;
  minWithdrawal: number;
  maxWithdrawal: number;
}

interface FeeCalculationRequest {
  userId?: string;
  exchange: string;
  type: 'trade' | 'withdrawal' | 'deposit';
  symbol?: string;
  side?: 'buy' | 'sell';
  orderType?: 'market' | 'limit';
  quantity?: number;
  price?: number;
  asset?: string;
  network?: string;
}

interface FeeCalculationResponse {
  exchange: string;
  type: string;
  fee: number;
  feeAsset: string;
  feeRate?: number;
  breakdown?: {
    baseFee: number;
    discounts?: number;
    rebates?: number;
    finalFee: number;
  };
  feeStructure?: FeeStructure;
  estimatedAt: Date;
}

interface VipLevel {
  level: number;
  thirtyDayVolume: number;
  makerFee: number;
  takerFee: number;
  bnbDiscount?: number;
}

class FeeCalculationService extends EventEmitter {
  private feeCache = new Map<string, { data: any; timestamp: number }>();
  private readonly CACHE_DURATION = 300000; // 5 minutes

  constructor() {
    super();
    this.setMaxListeners(100);
  }

  async calculateFee(request: FeeCalculationRequest): Promise<FeeCalculationResponse> {
    const { exchange, type } = request;

    try {
      loggingService.info('Calculating fee', { exchange, type, request });

      // Check rate limits
      await rateLimitService.waitForExchangeAvailability(exchange, 1);

      // Get fee structure from cache or exchange
      const feeStructure = await this.getFeeStructure(request.userId, exchange);

      let calculationResponse: FeeCalculationResponse;

      switch (type) {
        case 'trade':
          calculationResponse = await this.calculateTradeFee(request, feeStructure);
          break;
        case 'withdrawal':
          calculationResponse = await this.calculateWithdrawalFee(request);
          break;
        case 'deposit':
          calculationResponse = await this.calculateDepositFee(request);
          break;
        default:
          throw new Error(`Unsupported fee calculation type: ${type}`);
      }

      this.emit('fee-calculated', calculationResponse);

      loggingService.info('Fee calculation completed', {
        exchange,
        type,
        fee: calculationResponse.fee,
        feeAsset: calculationResponse.feeAsset
      });

      return calculationResponse;

    } catch (error: any) {
      loggingService.error('Fee calculation failed', {
        exchange,
        type,
        error: error.message
      });

      this.emit('fee-calculation-failed', { exchange, type, error: error.message });
      throw error;
    }
  }

  async calculateTradeFee(
    request: FeeCalculationRequest, 
    feeStructure: FeeStructure
  ): Promise<FeeCalculationResponse> {
    const { exchange, symbol, side, orderType, quantity, price, userId } = request;

    if (!symbol || !side || !orderType || !quantity) {
      throw new Error('Missing required parameters for trade fee calculation');
    }

    // Determine if it's a maker or taker order
    const isMaker = orderType === 'limit';
    const feeRate = isMaker ? feeStructure.maker : feeStructure.taker;

    // Calculate base fee
    let feeAmount: number;
    let feeAsset: string;

    switch (exchange) {
      case 'binance':
        ({ feeAmount, feeAsset } = await this.calculateBinanceTradeFee(
          symbol, side, quantity, price || 0, feeRate, userId
        ));
        break;
      case 'coinbase':
        ({ feeAmount, feeAsset } = await this.calculateCoinbaseTradeFee(
          symbol, side, quantity, price || 0, feeRate
        ));
        break;
      case 'kraken':
        ({ feeAmount, feeAsset } = await this.calculateKrakenTradeFee(
          symbol, side, quantity, price || 0, feeRate, userId
        ));
        break;
      case 'kucoin':
        ({ feeAmount, feeAsset } = await this.calculateKuCoinTradeFee(
          symbol, side, quantity, price || 0, feeRate, userId
        ));
        break;
      default:
        throw new Error(`Unsupported exchange: ${exchange}`);
    }

    return {
      exchange,
      type: 'trade',
      fee: feeAmount,
      feeAsset,
      feeRate,
      feeStructure,
      estimatedAt: new Date()
    };
  }

  private async calculateBinanceTradeFee(
    symbol: string,
    side: 'buy' | 'sell',
    quantity: number,
    price: number,
    feeRate: number,
    userId?: string
  ): Promise<{ feeAmount: number; feeAsset: string }> {
    // Get user's VIP level and BNB balance for potential discounts
    const userLevel = userId ? await this.getBinanceVipLevel(userId) : null;
    const bnbBalance = userId ? await this.getBinanceBalance(userId, 'BNB') : 0;

    let adjustedFeeRate = feeRate;
    let feeAsset = symbol.includes('USDT') ? 'USDT' : symbol.slice(-3);

    // Apply VIP discount
    if (userLevel && userLevel.level > 0) {
      adjustedFeeRate = side === 'buy' ? userLevel.makerFee : userLevel.takerFee;
    }

    // Apply BNB discount (25% reduction if paying with BNB and sufficient balance)
    if (bnbBalance > 0.1 && userLevel?.bnbDiscount) {
      adjustedFeeRate *= (1 - userLevel.bnbDiscount);
      feeAsset = 'BNB';
    }

    const notionalValue = quantity * price;
    const feeAmount = notionalValue * adjustedFeeRate;

    return { feeAmount, feeAsset };
  }

  private async calculateCoinbaseTradeFee(
    symbol: string,
    side: 'buy' | 'sell',
    quantity: number,
    price: number,
    feeRate: number
  ): Promise<{ feeAmount: number; feeAsset: string }> {
    const notionalValue = quantity * price;
    const feeAmount = notionalValue * feeRate;
    
    // Coinbase typically charges fees in the quote currency
    const feeAsset = symbol.includes('-') ? symbol.split('-')[1] : 'USD';

    return { feeAmount, feeAsset };
  }

  private async calculateKrakenTradeFee(
    symbol: string,
    side: 'buy' | 'sell',
    quantity: number,
    price: number,
    feeRate: number,
    userId?: string
  ): Promise<{ feeAmount: number; feeAsset: string }> {
    // Kraken has volume-based fee tiers
    const thirtyDayVolume = userId ? await this.getKrakenVolume(userId) : 0;
    const adjustedFeeRate = this.getKrakenVolumeDiscount(feeRate, thirtyDayVolume);

    const notionalValue = quantity * price;
    const feeAmount = notionalValue * adjustedFeeRate;
    
    // Kraken typically charges in quote currency
    const feeAsset = symbol.includes('USD') ? 'USD' : 'EUR';

    return { feeAmount, feeAsset };
  }

  private async calculateKuCoinTradeFee(
    symbol: string,
    side: 'buy' | 'sell',
    quantity: number,
    price: number,
    feeRate: number,
    userId?: string
  ): Promise<{ feeAmount: number; feeAsset: string }> {
    // KuCoin has KCS token discount system
    const kcsBalance = userId ? await this.getKuCoinBalance(userId, 'KCS') : 0;
    let adjustedFeeRate = feeRate;
    let feeAsset = symbol.includes('USDT') ? 'USDT' : symbol.split('-')[1] || 'USDT';

    // Apply KCS discount if holding sufficient KCS
    if (kcsBalance >= 1000) {
      adjustedFeeRate *= 0.8; // 20% discount
      feeAsset = 'KCS';
    }

    const notionalValue = quantity * price;
    const feeAmount = notionalValue * adjustedFeeRate;

    return { feeAmount, feeAsset };
  }

  async calculateWithdrawalFee(request: FeeCalculationRequest): Promise<FeeCalculationResponse> {
    const { exchange, asset, network } = request;

    if (!asset) {
      throw new Error('Asset is required for withdrawal fee calculation');
    }

    const withdrawalFees = await this.getWithdrawalFees(exchange);
    const feeInfo = withdrawalFees[asset];

    if (!feeInfo) {
      throw new Error(`Withdrawal fee not found for asset ${asset} on ${exchange}`);
    }

    return {
      exchange,
      type: 'withdrawal',
      fee: feeInfo.fee,
      feeAsset: asset,
      estimatedAt: new Date()
    };
  }

  async calculateDepositFee(request: FeeCalculationRequest): Promise<FeeCalculationResponse> {
    const { exchange, asset } = request;

    if (!asset) {
      throw new Error('Asset is required for deposit fee calculation');
    }

    // Most exchanges don't charge deposit fees, but some do for certain assets/networks
    const depositFees = await this.getDepositFees(exchange);
    const fee = depositFees[asset] || 0;

    return {
      exchange,
      type: 'deposit',
      fee,
      feeAsset: asset,
      estimatedAt: new Date()
    };
  }

  private async getFeeStructure(userId: string | undefined, exchange: string): Promise<FeeStructure> {
    const cacheKey = `fee_structure:${exchange}:${userId || 'default'}`;
    
    // Check cache first
    const cached = this.feeCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
      return cached.data;
    }

    let feeStructure: FeeStructure;

    try {
      switch (exchange) {
        case 'binance':
          feeStructure = await this.getBinanceFeeStructure(userId);
          break;
        case 'coinbase':
          feeStructure = await this.getCoinbaseFeeStructure(userId);
          break;
        case 'kraken':
          feeStructure = await this.getKrakenFeeStructure(userId);
          break;
        case 'kucoin':
          feeStructure = await this.getKuCoinFeeStructure(userId);
          break;
        default:
          throw new Error(`Unsupported exchange: ${exchange}`);
      }

      // Cache the result
      this.feeCache.set(cacheKey, { data: feeStructure, timestamp: Date.now() });

      return feeStructure;

    } catch (error: any) {
      loggingService.error('Failed to get fee structure', { exchange, userId, error: error.message });
      
      // Return default fee structure if API call fails
      return this.getDefaultFeeStructure(exchange);
    }
  }

  private async getBinanceFeeStructure(userId?: string): Promise<FeeStructure> {
    if (!userId) {
      return { maker: 0.001, taker: 0.001 }; // Default Binance fees
    }

    try {
      const client = await exchangeService.getAuthenticatedClient(userId, 'binance');
      const accountInfo = await client.accountInfo();
      
      return {
        maker: parseFloat(accountInfo.makerCommission) / 10000, // Binance returns in basis points
        taker: parseFloat(accountInfo.takerCommission) / 10000
      };
    } catch (error) {
      return { maker: 0.001, taker: 0.001 };
    }
  }

  private async getCoinbaseFeeStructure(userId?: string): Promise<FeeStructure> {
    if (!userId) {
      return { maker: 0.005, taker: 0.005 }; // Default Coinbase fees
    }

    try {
      const client = await exchangeService.getAuthenticatedClient(userId, 'coinbase');
      const fees = await client.getFees();
      
      return {
        maker: parseFloat(fees.maker_fee_rate),
        taker: parseFloat(fees.taker_fee_rate)
      };
    } catch (error) {
      return { maker: 0.005, taker: 0.005 };
    }
  }

  private async getKrakenFeeStructure(userId?: string): Promise<FeeStructure> {
    if (!userId) {
      return { maker: 0.0016, taker: 0.0026 }; // Default Kraken fees
    }

    try {
      const client = await exchangeService.getAuthenticatedClient(userId, 'kraken');
      const tradeVolume = await client.getTradeVolume();
      
      return {
        maker: parseFloat(tradeVolume.fees?.XXBTZUSD?.fee || '0.0016'),
        taker: parseFloat(tradeVolume.fees?.XXBTZUSD?.fee || '0.0026')
      };
    } catch (error) {
      return { maker: 0.0016, taker: 0.0026 };
    }
  }

  private async getKuCoinFeeStructure(userId?: string): Promise<FeeStructure> {
    if (!userId) {
      return { maker: 0.001, taker: 0.001 }; // Default KuCoin fees
    }

    try {
      const client = await exchangeService.getAuthenticatedClient(userId, 'kucoin');
      const feeRates = await client.getBaseFeeRates();
      
      return {
        maker: parseFloat(feeRates.data.makerFeeRate),
        taker: parseFloat(feeRates.data.takerFeeRate)
      };
    } catch (error) {
      return { maker: 0.001, taker: 0.001 };
    }
  }

  private getDefaultFeeStructure(exchange: string): FeeStructure {
    const defaults: Record<string, FeeStructure> = {
      binance: { maker: 0.001, taker: 0.001 },
      coinbase: { maker: 0.005, taker: 0.005 },
      kraken: { maker: 0.0016, taker: 0.0026 },
      kucoin: { maker: 0.001, taker: 0.001 }
    };

    return defaults[exchange] || { maker: 0.001, taker: 0.001 };
  }

  private async getWithdrawalFees(exchange: string): Promise<Record<string, WithdrawalFee>> {
    const cacheKey = `withdrawal_fees:${exchange}`;
    
    // Check cache
    const cached = this.feeCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
      return cached.data;
    }

    try {
      let fees: Record<string, WithdrawalFee> = {};

      switch (exchange) {
        case 'binance':
          fees = await this.getBinanceWithdrawalFees();
          break;
        case 'coinbase':
          fees = await this.getCoinbaseWithdrawalFees();
          break;
        case 'kraken':
          fees = await this.getKrakenWithdrawalFees();
          break;
        case 'kucoin':
          fees = await this.getKuCoinWithdrawalFees();
          break;
        default:
          throw new Error(`Unsupported exchange: ${exchange}`);
      }

      this.feeCache.set(cacheKey, { data: fees, timestamp: Date.now() });
      return fees;

    } catch (error: any) {
      loggingService.warn('Failed to get withdrawal fees, using defaults', { exchange, error: error.message });
      return this.getDefaultWithdrawalFees(exchange);
    }
  }

  private async getBinanceWithdrawalFees(): Promise<Record<string, WithdrawalFee>> {
    // These would normally be fetched from Binance API
    // For now, return common withdrawal fees
    return {
      BTC: { asset: 'BTC', fee: 0.0005, minWithdrawal: 0.001, maxWithdrawal: 100 },
      ETH: { asset: 'ETH', fee: 0.005, minWithdrawal: 0.01, maxWithdrawal: 10000 },
      USDT: { asset: 'USDT', fee: 1, minWithdrawal: 10, maxWithdrawal: 10000000 }
    };
  }

  private async getCoinbaseWithdrawalFees(): Promise<Record<string, WithdrawalFee>> {
    return {
      BTC: { asset: 'BTC', fee: 0.0005, minWithdrawal: 0.001, maxWithdrawal: 100 },
      ETH: { asset: 'ETH', fee: 0.005, minWithdrawal: 0.01, maxWithdrawal: 10000 },
      USD: { asset: 'USD', fee: 0, minWithdrawal: 1, maxWithdrawal: 100000 }
    };
  }

  private async getKrakenWithdrawalFees(): Promise<Record<string, WithdrawalFee>> {
    return {
      BTC: { asset: 'BTC', fee: 0.00015, minWithdrawal: 0.001, maxWithdrawal: 100 },
      ETH: { asset: 'ETH', fee: 0.005, minWithdrawal: 0.01, maxWithdrawal: 10000 },
      USD: { asset: 'USD', fee: 5, minWithdrawal: 20, maxWithdrawal: 100000 }
    };
  }

  private async getKuCoinWithdrawalFees(): Promise<Record<string, WithdrawalFee>> {
    return {
      BTC: { asset: 'BTC', fee: 0.0005, minWithdrawal: 0.002, maxWithdrawal: 100 },
      ETH: { asset: 'ETH', fee: 0.01, minWithdrawal: 0.02, maxWithdrawal: 10000 },
      USDT: { asset: 'USDT', fee: 2, minWithdrawal: 5, maxWithdrawal: 1000000 }
    };
  }

  private getDefaultWithdrawalFees(exchange: string): Record<string, WithdrawalFee> {
    return {
      BTC: { asset: 'BTC', fee: 0.0005, minWithdrawal: 0.001, maxWithdrawal: 100 },
      ETH: { asset: 'ETH', fee: 0.005, minWithdrawal: 0.01, maxWithdrawal: 10000 },
      USDT: { asset: 'USDT', fee: 1, minWithdrawal: 10, maxWithdrawal: 1000000 }
    };
  }

  private async getDepositFees(exchange: string): Promise<Record<string, number>> {
    // Most exchanges don't charge deposit fees
    return {};
  }

  private async getBinanceVipLevel(userId: string): Promise<VipLevel | null> {
    try {
      const client = await exchangeService.getAuthenticatedClient(userId, 'binance');
      const accountInfo = await client.accountInfo();
      
      // This would need to be implemented based on account volume
      return {
        level: 0,
        thirtyDayVolume: 0,
        makerFee: 0.001,
        takerFee: 0.001,
        bnbDiscount: 0.25
      };
    } catch (error) {
      return null;
    }
  }

  private async getBinanceBalance(userId: string, asset: string): Promise<number> {
    try {
      const client = await exchangeService.getAuthenticatedClient(userId, 'binance');
      const accountInfo = await client.accountInfo();
      
      const balance = accountInfo.balances.find((b: any) => b.asset === asset);
      return balance ? parseFloat(balance.free) : 0;
    } catch (error) {
      return 0;
    }
  }

  private async getKrakenVolume(userId: string): Promise<number> {
    try {
      const client = await exchangeService.getAuthenticatedClient(userId, 'kraken');
      const tradeVolume = await client.getTradeVolume();
      
      return parseFloat(tradeVolume.volume || '0');
    } catch (error) {
      return 0;
    }
  }

  private getKrakenVolumeDiscount(baseFee: number, volume: number): number {
    // Kraken volume-based fee tiers
    if (volume >= 10000000) return baseFee * 0.85; // 15% discount
    if (volume >= 5000000) return baseFee * 0.90;  // 10% discount
    if (volume >= 1000000) return baseFee * 0.95;  // 5% discount
    return baseFee;
  }

  private async getKuCoinBalance(userId: string, asset: string): Promise<number> {
    try {
      const client = await exchangeService.getAuthenticatedClient(userId, 'kucoin');
      const accounts = await client.getAccounts();
      
      const account = accounts.data.find((acc: any) => acc.currency === asset);
      return account ? parseFloat(account.available) : 0;
    } catch (error) {
      return 0;
    }
  }

  async getFeeHistory(userId: string, exchange: string, limit: number = 50): Promise<TradeFee[]> {
    try {
      // This would fetch from database where trade fees are stored
      const fees = await prisma.tradeFee.findMany({
        where: { userId, exchange },
        orderBy: { createdAt: 'desc' },
        take: limit
      });

      return fees.map(fee => ({
        symbol: fee.symbol,
        side: fee.side as 'buy' | 'sell',
        type: fee.type as 'market' | 'limit',
        quantity: fee.quantity,
        price: fee.price,
        fee: fee.fee,
        feeAsset: fee.feeAsset,
        feeRate: fee.feeRate,
        exchangeFees: JSON.parse(fee.exchangeFees || '{}')
      }));
    } catch (error: any) {
      loggingService.error('Failed to get fee history', { userId, exchange, error: error.message });
      return [];
    }
  }

  async estimateTotalFees(
    userId: string,
    exchange: string,
    trades: Array<{
      symbol: string;
      side: 'buy' | 'sell';
      type: 'market' | 'limit';
      quantity: number;
      price?: number;
    }>
  ): Promise<{ totalFee: number; breakdown: FeeCalculationResponse[] }> {
    const breakdown: FeeCalculationResponse[] = [];
    let totalFee = 0;

    for (const trade of trades) {
      try {
        const feeCalc = await this.calculateFee({
          userId,
          exchange,
          type: 'trade',
          symbol: trade.symbol,
          side: trade.side,
          orderType: trade.type,
          quantity: trade.quantity,
          price: trade.price
        });

        breakdown.push(feeCalc);
        totalFee += feeCalc.fee;
      } catch (error: any) {
        loggingService.warn('Failed to calculate fee for trade', { trade, error: error.message });
      }
    }

    return { totalFee, breakdown };
  }

  getSupportedExchanges(): string[] {
    return ['binance', 'coinbase', 'kraken', 'kucoin'];
  }

  getSupportedFeeTypes(): string[] {
    return ['trade', 'withdrawal', 'deposit'];
  }

  clearCache(): void {
    this.feeCache.clear();
    this.emit('cache-cleared');
  }
}

export const feeCalculationService = new FeeCalculationService();