import axios, { AxiosInstance } from 'axios';

interface PricePoint {
  timestamp: number;
  price: number;
}

interface AssetData {
  id: string;
  symbol: string;
  name: string;
  currentPrice: number;
  priceChange24h: number;
  priceChangePercentage24h: number;
  priceChange7d?: number;
  priceChangePercentage7d?: number;
  priceChange30d?: number;
  priceChangePercentage30d?: number;
  marketCap: number;
  marketCapRank: number;
  fullyDilutedValuation?: number;
  totalVolume: number;
  high24h: number;
  low24h: number;
  totalSupply?: number;
  maxSupply?: number;
  circulatingSupply?: number;
  ath: number;
  athChangePercentage: number;
  athDate: string;
  atl: number;
  atlChangePercentage: number;
  atlDate: string;
  image: string;
  lastUpdated: string;
  rank: number;
  volume24h: number;
}

interface AssetSearchResult {
  id: string;
  symbol: string;
  name: string;
  image: string;
  marketCapRank: number;
}

class AssetService {
  private api: AxiosInstance;

  constructor() {
    this.api = axios.create({
      baseURL: process.env.REACT_APP_API_URL || 'http://localhost:3001/api/v1',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    // Add auth token to requests if available
    this.api.interceptors.request.use(
      (config) => {
        const token = localStorage.getItem('authToken');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );
  }

  /**
   * Get asset data by symbol
   */
  async getAssetData(symbol: string): Promise<AssetData> {
    try {
      const response = await this.api.get(`/assets/${symbol.toLowerCase()}`);
      return this.transformAssetData(response.data);
    } catch (error) {
      console.error(`Error fetching asset data for ${symbol}:`, error);
      // Return mock data for development
      return this.getMockAssetData(symbol);
    }
  }

  /**
   * Get multiple assets data
   */
  async getAssetsData(symbols: string[]): Promise<AssetData[]> {
    try {
      const response = await this.api.get('/assets/bulk', {
        params: { symbols: symbols.join(',') }
      });
      return response.data.map(this.transformAssetData);
    } catch (error) {
      console.error('Error fetching bulk asset data:', error);
      // Return mock data for development
      return symbols.map(symbol => this.getMockAssetData(symbol));
    }
  }

  /**
   * Get price history for an asset
   */
  async getPriceHistory(
    symbol: string, 
    days: string = '1', 
    interval: string = 'hourly'
  ): Promise<PricePoint[]> {
    try {
      const response = await this.api.get(`/assets/${symbol.toLowerCase()}/history`, {
        params: { days, interval }
      });
      
      return response.data.prices.map((point: [number, number]) => ({
        timestamp: point[0],
        price: point[1]
      }));
    } catch (error) {
      console.error(`Error fetching price history for ${symbol}:`, error);
      // Return mock price history
      return this.getMockPriceHistory(symbol);
    }
  }

  /**
   * Search for assets
   */
  async searchAssets(query: string): Promise<AssetSearchResult[]> {
    try {
      const response = await this.api.get('/assets/search', {
        params: { q: query, limit: 50 }
      });
      return response.data.assets;
    } catch (error) {
      console.error('Error searching assets:', error);
      // Return mock search results
      return this.getMockSearchResults(query);
    }
  }

  /**
   * Get trending assets
   */
  async getTrendingAssets(): Promise<AssetSearchResult[]> {
    try {
      const response = await this.api.get('/assets/trending');
      return response.data.assets;
    } catch (error) {
      console.error('Error fetching trending assets:', error);
      // Return mock trending assets
      return this.getMockTrendingAssets();
    }
  }

  /**
   * Get top assets by market cap
   */
  async getTopAssets(limit: number = 100): Promise<AssetData[]> {
    try {
      const response = await this.api.get('/assets/top', {
        params: { limit }
      });
      return response.data.assets.map(this.transformAssetData);
    } catch (error) {
      console.error('Error fetching top assets:', error);
      // Return mock top assets
      return this.getMockTopAssets(limit);
    }
  }

  /**
   * Transform API response to internal format
   */
  private transformAssetData(apiData: any): AssetData {
    return {
      id: apiData.id,
      symbol: apiData.symbol?.toUpperCase() || apiData.id?.toUpperCase(),
      name: apiData.name,
      currentPrice: apiData.current_price || apiData.currentPrice,
      priceChange24h: apiData.price_change_24h || apiData.priceChange24h || 0,
      priceChangePercentage24h: apiData.price_change_percentage_24h || apiData.priceChangePercentage24h || 0,
      priceChange7d: apiData.price_change_7d || apiData.priceChange7d,
      priceChangePercentage7d: apiData.price_change_percentage_7d_in_currency || apiData.priceChangePercentage7d,
      priceChange30d: apiData.price_change_30d || apiData.priceChange30d,
      priceChangePercentage30d: apiData.price_change_percentage_30d_in_currency || apiData.priceChangePercentage30d,
      marketCap: apiData.market_cap || apiData.marketCap || 0,
      marketCapRank: apiData.market_cap_rank || apiData.marketCapRank || 0,
      fullyDilutedValuation: apiData.fully_diluted_valuation || apiData.fullyDilutedValuation,
      totalVolume: apiData.total_volume || apiData.totalVolume || 0,
      high24h: apiData.high_24h || apiData.high24h || 0,
      low24h: apiData.low_24h || apiData.low24h || 0,
      totalSupply: apiData.total_supply || apiData.totalSupply,
      maxSupply: apiData.max_supply || apiData.maxSupply,
      circulatingSupply: apiData.circulating_supply || apiData.circulatingSupply,
      ath: apiData.ath || 0,
      athChangePercentage: apiData.ath_change_percentage || apiData.athChangePercentage || 0,
      athDate: apiData.ath_date || apiData.athDate || new Date().toISOString(),
      atl: apiData.atl || 0,
      atlChangePercentage: apiData.atl_change_percentage || apiData.atlChangePercentage || 0,
      atlDate: apiData.atl_date || apiData.atlDate || new Date().toISOString(),
      image: apiData.image || apiData.icon || this.getDefaultIcon(apiData.symbol || apiData.id),
      lastUpdated: apiData.last_updated || apiData.lastUpdated || new Date().toISOString(),
      rank: apiData.market_cap_rank || apiData.rank || 0,
      volume24h: apiData.total_volume || apiData.volume24h || 0
    };
  }

  /**
   * Get default icon for asset
   */
  private getDefaultIcon(symbol: string): string {
    const baseUrl = 'https://cryptologos.cc/logos';
    const symbolLower = symbol?.toLowerCase() || 'unknown';
    
    const iconMap: { [key: string]: string } = {
      'btc': `${baseUrl}/bitcoin-btc-logo.png`,
      'eth': `${baseUrl}/ethereum-eth-logo.png`,
      'usdt': `${baseUrl}/tether-usdt-logo.png`,
      'bnb': `${baseUrl}/bnb-bnb-logo.png`,
      'usdc': `${baseUrl}/usd-coin-usdc-logo.png`,
      'xrp': `${baseUrl}/xrp-xrp-logo.png`,
      'ada': `${baseUrl}/cardano-ada-logo.png`,
      'doge': `${baseUrl}/dogecoin-doge-logo.png`,
      'dot': `${baseUrl}/polkadot-new-dot-logo.png`,
      'matic': `${baseUrl}/polygon-matic-logo.png`,
    };

    return iconMap[symbolLower] || `${baseUrl}/cryptocurrency-logo.png`;
  }

  /**
   * Mock data for development/fallback
   */
  private getMockAssetData(symbol: string): AssetData {
    const basePrice = Math.random() * 1000 + 10;
    const change24h = (Math.random() - 0.5) * 20;
    const changePercentage = (change24h / basePrice) * 100;
    
    return {
      id: symbol.toLowerCase(),
      symbol: symbol.toUpperCase(),
      name: this.getMockAssetName(symbol),
      currentPrice: basePrice,
      priceChange24h: change24h,
      priceChangePercentage24h: changePercentage,
      priceChange7d: (Math.random() - 0.5) * 100,
      priceChangePercentage7d: (Math.random() - 0.5) * 30,
      priceChange30d: (Math.random() - 0.5) * 500,
      priceChangePercentage30d: (Math.random() - 0.5) * 50,
      marketCap: Math.random() * 1000000000000,
      marketCapRank: Math.floor(Math.random() * 1000) + 1,
      fullyDilutedValuation: Math.random() * 1200000000000,
      totalVolume: Math.random() * 50000000000,
      high24h: basePrice + Math.abs(change24h),
      low24h: basePrice - Math.abs(change24h),
      totalSupply: Math.random() * 1000000000,
      maxSupply: Math.random() * 21000000,
      circulatingSupply: Math.random() * 19000000,
      ath: basePrice + Math.random() * 1000,
      athChangePercentage: -Math.random() * 80,
      athDate: '2021-11-10T00:00:00.000Z',
      atl: Math.random() * 10,
      atlChangePercentage: Math.random() * 10000,
      atlDate: '2020-03-13T00:00:00.000Z',
      image: this.getDefaultIcon(symbol),
      lastUpdated: new Date().toISOString(),
      rank: Math.floor(Math.random() * 1000) + 1,
      volume24h: Math.random() * 50000000000
    };
  }

  private getMockAssetName(symbol: string): string {
    const nameMap: { [key: string]: string } = {
      'BTC': 'Bitcoin',
      'ETH': 'Ethereum', 
      'USDT': 'Tether',
      'BNB': 'BNB',
      'USDC': 'USD Coin',
      'XRP': 'Ripple',
      'ADA': 'Cardano',
      'DOGE': 'Dogecoin',
      'DOT': 'Polkadot',
      'MATIC': 'Polygon'
    };
    
    return nameMap[symbol.toUpperCase()] || `${symbol} Token`;
  }

  private getMockPriceHistory(symbol: string): PricePoint[] {
    const now = Date.now();
    const basePrice = Math.random() * 1000 + 10;
    const points: PricePoint[] = [];
    
    // Generate 24 hourly data points
    for (let i = 23; i >= 0; i--) {
      const timestamp = now - (i * 60 * 60 * 1000); // i hours ago
      const volatility = 0.02; // 2% volatility
      const randomChange = (Math.random() - 0.5) * 2 * volatility;
      const price = basePrice * (1 + randomChange);
      
      points.push({
        timestamp,
        price: Math.max(0.01, price) // Ensure positive price
      });
    }
    
    return points;
  }

  private getMockSearchResults(query: string): AssetSearchResult[] {
    const mockAssets = [
      { id: 'bitcoin', symbol: 'BTC', name: 'Bitcoin', marketCapRank: 1 },
      { id: 'ethereum', symbol: 'ETH', name: 'Ethereum', marketCapRank: 2 },
      { id: 'tether', symbol: 'USDT', name: 'Tether', marketCapRank: 3 },
      { id: 'binancecoin', symbol: 'BNB', name: 'BNB', marketCapRank: 4 },
      { id: 'ripple', symbol: 'XRP', name: 'Ripple', marketCapRank: 5 },
    ];

    return mockAssets
      .filter(asset => 
        asset.symbol.toLowerCase().includes(query.toLowerCase()) ||
        asset.name.toLowerCase().includes(query.toLowerCase())
      )
      .map(asset => ({
        ...asset,
        image: this.getDefaultIcon(asset.symbol)
      }));
  }

  private getMockTrendingAssets(): AssetSearchResult[] {
    return [
      { id: 'bitcoin', symbol: 'BTC', name: 'Bitcoin', image: this.getDefaultIcon('BTC'), marketCapRank: 1 },
      { id: 'ethereum', symbol: 'ETH', name: 'Ethereum', image: this.getDefaultIcon('ETH'), marketCapRank: 2 },
      { id: 'cardano', symbol: 'ADA', name: 'Cardano', image: this.getDefaultIcon('ADA'), marketCapRank: 8 },
    ];
  }

  private getMockTopAssets(limit: number): AssetData[] {
    const symbols = ['BTC', 'ETH', 'USDT', 'BNB', 'USDC', 'XRP', 'ADA', 'DOGE', 'DOT', 'MATIC'];
    return symbols.slice(0, limit).map(symbol => this.getMockAssetData(symbol));
  }
}

export const assetService = new AssetService();
export type { AssetData, AssetSearchResult, PricePoint };