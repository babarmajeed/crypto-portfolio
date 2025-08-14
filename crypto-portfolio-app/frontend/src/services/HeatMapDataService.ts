export interface MarketAsset {
  id: string;
  symbol: string;
  name: string;
  image: string;
  currentPrice: number;
  price: number;
  marketCap: number;
  marketCapRank: number;
  fullyDilutedValuation?: number;
  totalVolume: number;
  volume24h: number;
  high24h: number;
  low24h: number;
  priceChange24h: number;
  priceChangePercentage24h: number;
  priceChangePercentage7d?: number;
  priceChangePercentage30d?: number;
  marketCapChange24h: number;
  marketCapChangePercentage24h: number;
  circulatingSupply: number;
  totalSupply?: number;
  maxSupply?: number;
  ath: number;
  athChangePercentage: number;
  athDate: string;
  atl: number;
  atlChangePercentage: number;
  atlDate: string;
  lastUpdated: string;
  category?: string;
}

export interface PortfolioHolding {
  symbol: string;
  name: string;
  value: number;
  allocation: number;
  change24h: number;
  profit: number;
  profitPercentage: number;
  exchange?: string;
  category?: string;
  quantity: number;
  avgPrice: number;
}

export interface SectorData {
  id: string;
  name: string;
  marketCap: number;
  marketCapChange24h: number;
  volume24h: number;
  change24h: number;
  topCoins: string[];
  updatedAt: string;
}

export interface CategoryData {
  id: string;
  name: string;
}

export interface HeatMapFilters {
  category?: string;
  minMarketCap?: number;
  maxAssets?: number;
  timeframe?: string;
}

export interface CorrelationMatrix {
  [asset1: string]: {
    [asset2: string]: number;
  };
}

class HeatMapDataService {
  private baseURL: string;

  constructor(baseURL: string = '/api') {
    this.baseURL = baseURL;
  }

  // Market data for heat maps
  async getMarketData(filters: HeatMapFilters = {}): Promise<MarketAsset[]> {
    try {
      // In a real implementation, this would call an external API like CoinGecko
      // For now, we'll generate realistic mock data
      const assetCount = filters.maxAssets || 100;
      const marketData: MarketAsset[] = [];

      const cryptoAssets = [
        { symbol: 'BTC', name: 'Bitcoin', basePrice: 50000, baseMktCap: 1000000000000 },
        { symbol: 'ETH', name: 'Ethereum', basePrice: 3000, baseMktCap: 400000000000 },
        { symbol: 'ADA', name: 'Cardano', basePrice: 1.5, baseMktCap: 50000000000 },
        { symbol: 'DOT', name: 'Polkadot', basePrice: 25, baseMktCap: 25000000000 },
        { symbol: 'LINK', name: 'Chainlink', basePrice: 20, baseMktCap: 20000000000 },
        { symbol: 'SOL', name: 'Solana', basePrice: 150, baseMktCap: 45000000000 },
        { symbol: 'MATIC', name: 'Polygon', basePrice: 2, baseMktCap: 15000000000 },
        { symbol: 'AVAX', name: 'Avalanche', basePrice: 80, baseMktCap: 25000000000 },
        { symbol: 'ALGO', name: 'Algorand', basePrice: 1.8, baseMktCap: 12000000000 },
        { symbol: 'ATOM', name: 'Cosmos', basePrice: 30, baseMktCap: 8000000000 }
      ];

      // Add more assets to reach the requested count
      const additionalSymbols = [
        'UNI', 'AAVE', 'COMP', 'MKR', 'YFI', 'CRV', 'BAL', 'SNX', '1INCH', 'SUSHI',
        'FTM', 'NEAR', 'ICP', 'FLOW', 'VET', 'XTZ', 'EOS', 'TRX', 'XLM', 'XMR',
        'ZEC', 'DASH', 'LTC', 'BCH', 'BSV', 'ETC', 'ZEN', 'QTUM', 'ONT', 'NEO'
      ];

      // Generate base assets
      cryptoAssets.forEach((asset, index) => {
        if (index < assetCount) {
          const priceVariation = (Math.random() - 0.5) * 0.4; // ±20% price variation
          const volumeVariation = Math.random() * 2; // 0-200% volume variation
          const change24h = (Math.random() - 0.5) * 20; // ±10% daily change

          const currentPrice = asset.basePrice * (1 + priceVariation);
          const marketCap = asset.baseMktCap * (1 + priceVariation);
          const volume24h = marketCap * 0.1 * volumeVariation; // Volume as % of market cap

          marketData.push({
            id: asset.symbol.toLowerCase(),
            symbol: asset.symbol,
            name: asset.name,
            image: `https://assets.coingecko.com/coins/images/${index + 1}/thumb/${asset.symbol.toLowerCase()}.png`,
            currentPrice,
            price: currentPrice,
            marketCap,
            marketCapRank: index + 1,
            fullyDilutedValuation: marketCap * 1.2,
            totalVolume: volume24h,
            volume24h,
            high24h: currentPrice * (1 + Math.abs(change24h) / 100),
            low24h: currentPrice * (1 - Math.abs(change24h) / 100),
            priceChange24h: currentPrice * (change24h / 100),
            priceChangePercentage24h: change24h,
            priceChangePercentage7d: change24h * (1 + (Math.random() - 0.5) * 0.5),
            priceChangePercentage30d: change24h * (1 + (Math.random() - 0.5) * 2),
            marketCapChange24h: marketCap * (change24h / 100),
            marketCapChangePercentage24h: change24h,
            circulatingSupply: marketCap / currentPrice,
            totalSupply: (marketCap / currentPrice) * 1.1,
            maxSupply: asset.symbol === 'BTC' ? 21000000 : undefined,
            ath: currentPrice * (1 + Math.random() * 5), // ATH is 0-500% higher
            athChangePercentage: -Math.random() * 80, // Down from ATH
            athDate: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000).toISOString(),
            atl: currentPrice * (0.1 + Math.random() * 0.4), // ATL is 10-50% of current
            atlChangePercentage: Math.random() * 1000, // Up from ATL
            atlDate: new Date(Date.now() - Math.random() * 1000 * 24 * 60 * 60 * 1000).toISOString(),
            lastUpdated: new Date().toISOString(),
            category: this.getAssetCategory(asset.symbol)
          });
        }
      });

      // Add additional assets if needed
      let additionalIndex = cryptoAssets.length;
      additionalSymbols.forEach((symbol, index) => {
        if (additionalIndex < assetCount) {
          const basePrice = Math.random() * 100 + 1; // Random price between $1-$101
          const marketCap = Math.random() * 10000000000 + 1000000000; // $1B - $10B
          const change24h = (Math.random() - 0.5) * 30; // ±15% daily change
          const currentPrice = basePrice * (1 + (Math.random() - 0.5) * 0.3);
          const volume24h = marketCap * 0.05 * (Math.random() + 0.5); // 2.5-7.5% of market cap

          marketData.push({
            id: symbol.toLowerCase(),
            symbol: symbol,
            name: `${symbol} Token`,
            image: `https://assets.coingecko.com/coins/images/${additionalIndex + 1}/thumb/${symbol.toLowerCase()}.png`,
            currentPrice,
            price: currentPrice,
            marketCap,
            marketCapRank: additionalIndex + 1,
            fullyDilutedValuation: marketCap * 1.15,
            totalVolume: volume24h,
            volume24h,
            high24h: currentPrice * (1 + Math.abs(change24h) / 100),
            low24h: currentPrice * (1 - Math.abs(change24h) / 100),
            priceChange24h: currentPrice * (change24h / 100),
            priceChangePercentage24h: change24h,
            priceChangePercentage7d: change24h * (1 + (Math.random() - 0.5) * 0.8),
            priceChangePercentage30d: change24h * (1 + (Math.random() - 0.5) * 3),
            marketCapChange24h: marketCap * (change24h / 100),
            marketCapChangePercentage24h: change24h,
            circulatingSupply: marketCap / currentPrice,
            totalSupply: (marketCap / currentPrice) * 1.2,
            maxSupply: Math.random() > 0.5 ? (marketCap / currentPrice) * 2 : undefined,
            ath: currentPrice * (1 + Math.random() * 10), // ATH is 0-1000% higher
            athChangePercentage: -Math.random() * 90, // Down from ATH
            athDate: new Date(Date.now() - Math.random() * 500 * 24 * 60 * 60 * 1000).toISOString(),
            atl: currentPrice * (0.05 + Math.random() * 0.3), // ATL is 5-35% of current
            atlChangePercentage: Math.random() * 2000, // Up from ATL
            atlDate: new Date(Date.now() - Math.random() * 1500 * 24 * 60 * 60 * 1000).toISOString(),
            lastUpdated: new Date().toISOString(),
            category: this.getAssetCategory(symbol)
          });

          additionalIndex++;
        }
      });

      // Apply filters
      let filteredData = marketData;

      if (filters.category && filters.category !== 'all') {
        filteredData = filteredData.filter(asset => asset.category === filters.category);
      }

      if (filters.minMarketCap) {
        filteredData = filteredData.filter(asset => asset.marketCap >= filters.minMarketCap);
      }

      // Sort by market cap descending
      filteredData.sort((a, b) => b.marketCap - a.marketCap);

      return filteredData.slice(0, filters.maxAssets || 100);

    } catch (error) {
      console.error('Error fetching market data:', error);
      throw new Error('Failed to fetch market data');
    }
  }

  // Get available categories
  async getCategories(): Promise<CategoryData[]> {
    try {
      return [
        { id: 'all', name: 'All Categories' },
        { id: 'layer-1', name: 'Layer 1' },
        { id: 'defi', name: 'DeFi' },
        { id: 'smart-contracts', name: 'Smart Contracts' },
        { id: 'oracles', name: 'Oracles' },
        { id: 'scaling', name: 'Scaling Solutions' },
        { id: 'privacy', name: 'Privacy Coins' },
        { id: 'storage', name: 'Storage' },
        { id: 'interoperability', name: 'Interoperability' },
        { id: 'metaverse', name: 'Metaverse' }
      ];
    } catch (error) {
      console.error('Error fetching categories:', error);
      return [{ id: 'all', name: 'All Categories' }];
    }
  }

  // Get portfolio heat map data
  async getPortfolioHeatMapData(portfolioId: string): Promise<PortfolioHolding[]> {
    try {
      // Mock portfolio data
      const portfolioHoldings: PortfolioHolding[] = [
        {
          symbol: 'BTC',
          name: 'Bitcoin',
          value: 25000,
          allocation: 45,
          change24h: 2.5,
          profit: 5000,
          profitPercentage: 25,
          exchange: 'Coinbase',
          category: 'layer-1',
          quantity: 0.5,
          avgPrice: 40000
        },
        {
          symbol: 'ETH',
          name: 'Ethereum',
          value: 15000,
          allocation: 27,
          change24h: -1.2,
          profit: 3000,
          profitPercentage: 25,
          exchange: 'Binance',
          category: 'smart-contracts',
          quantity: 5,
          avgPrice: 2400
        },
        {
          symbol: 'ADA',
          name: 'Cardano',
          value: 8000,
          allocation: 14.5,
          change24h: 5.8,
          profit: 1500,
          profitPercentage: 23.1,
          exchange: 'Kraken',
          category: 'smart-contracts',
          quantity: 5333,
          avgPrice: 1.2
        },
        {
          symbol: 'DOT',
          name: 'Polkadot',
          value: 4500,
          allocation: 8.1,
          change24h: -3.2,
          profit: 500,
          profitPercentage: 12.5,
          exchange: 'Coinbase',
          category: 'interoperability',
          quantity: 180,
          avgPrice: 22.22
        },
        {
          symbol: 'LINK',
          name: 'Chainlink',
          value: 3000,
          allocation: 5.4,
          change24h: 1.8,
          profit: -200,
          profitPercentage: -6.25,
          exchange: 'Binance',
          category: 'oracles',
          quantity: 150,
          avgPrice: 21.33
        }
      ];

      return portfolioHoldings;
    } catch (error) {
      console.error('Error fetching portfolio heatmap data:', error);
      throw new Error('Failed to fetch portfolio heatmap data');
    }
  }

  // Get sector performance data
  async getSectorPerformanceData(timeframe: string = '24h'): Promise<SectorData[]> {
    try {
      const sectorData: SectorData[] = [
        {
          id: 'layer-1',
          name: 'Layer 1',
          marketCap: 1200000000000,
          marketCapChange24h: 25000000000,
          volume24h: 45000000000,
          change24h: 2.1,
          topCoins: ['bitcoin', 'ethereum', 'cardano'],
          updatedAt: new Date().toISOString()
        },
        {
          id: 'defi',
          name: 'DeFi',
          marketCap: 180000000000,
          marketCapChange24h: -5000000000,
          volume24h: 8000000000,
          change24h: -2.7,
          topCoins: ['uniswap', 'aave', 'compound'],
          updatedAt: new Date().toISOString()
        },
        {
          id: 'smart-contracts',
          name: 'Smart Contracts',
          marketCap: 600000000000,
          marketCapChange24h: 15000000000,
          volume24h: 25000000000,
          change24h: 2.6,
          topCoins: ['ethereum', 'cardano', 'solana'],
          updatedAt: new Date().toISOString()
        },
        {
          id: 'oracles',
          name: 'Oracles',
          marketCap: 25000000000,
          marketCapChange24h: 500000000,
          volume24h: 1200000000,
          change24h: 2.0,
          topCoins: ['chainlink', 'band-protocol', 'api3'],
          updatedAt: new Date().toISOString()
        },
        {
          id: 'scaling',
          name: 'Scaling Solutions',
          marketCap: 40000000000,
          marketCapChange24h: 1200000000,
          volume24h: 2800000000,
          change24h: 3.1,
          topCoins: ['polygon', 'arbitrum', 'optimism'],
          updatedAt: new Date().toISOString()
        },
        {
          id: 'privacy',
          name: 'Privacy Coins',
          marketCap: 15000000000,
          marketCapChange24h: -200000000,
          volume24h: 800000000,
          change24h: -1.3,
          topCoins: ['monero', 'zcash', 'dash'],
          updatedAt: new Date().toISOString()
        }
      ];

      return sectorData;
    } catch (error) {
      console.error('Error fetching sector performance data:', error);
      throw new Error('Failed to fetch sector performance data');
    }
  }

  // Calculate correlation matrix
  async calculateCorrelationMatrix(assets: MarketAsset[], timeframe: string = '30d'): Promise<CorrelationMatrix> {
    try {
      const correlationMatrix: CorrelationMatrix = {};

      // In a real implementation, this would calculate actual price correlations
      // For now, we'll generate realistic correlation data
      assets.forEach(asset1 => {
        correlationMatrix[asset1.symbol] = {};

        assets.forEach(asset2 => {
          if (asset1.symbol === asset2.symbol) {
            correlationMatrix[asset1.symbol][asset2.symbol] = 1.0;
          } else {
            // Generate realistic correlations based on asset categories
            let correlation = 0;

            if (asset1.category === asset2.category) {
              // Same category assets tend to be more correlated
              correlation = 0.3 + Math.random() * 0.5; // 0.3 to 0.8
            } else if (
              (asset1.category === 'layer-1' && asset2.category === 'smart-contracts') ||
              (asset1.category === 'smart-contracts' && asset2.category === 'layer-1')
            ) {
              // Layer 1 and smart contracts are moderately correlated
              correlation = 0.2 + Math.random() * 0.4; // 0.2 to 0.6
            } else {
              // Different categories have lower correlation
              correlation = -0.2 + Math.random() * 0.6; // -0.2 to 0.4
            }

            // Add some randomness
            correlation += (Math.random() - 0.5) * 0.2;
            
            // Ensure correlation is between -1 and 1
            correlation = Math.max(-1, Math.min(1, correlation));

            correlationMatrix[asset1.symbol][asset2.symbol] = correlation;
          }
        });
      });

      return correlationMatrix;
    } catch (error) {
      console.error('Error calculating correlation matrix:', error);
      throw new Error('Failed to calculate correlation matrix');
    }
  }

  // Helper method to categorize assets
  private getAssetCategory(symbol: string): string {
    const categoryMap: { [key: string]: string } = {
      'BTC': 'layer-1',
      'ETH': 'smart-contracts',
      'ADA': 'smart-contracts',
      'DOT': 'interoperability',
      'LINK': 'oracles',
      'SOL': 'smart-contracts',
      'MATIC': 'scaling',
      'AVAX': 'smart-contracts',
      'ALGO': 'smart-contracts',
      'ATOM': 'interoperability',
      'UNI': 'defi',
      'AAVE': 'defi',
      'COMP': 'defi',
      'MKR': 'defi',
      'YFI': 'defi',
      'CRV': 'defi',
      'BAL': 'defi',
      'SNX': 'defi',
      '1INCH': 'defi',
      'SUSHI': 'defi',
      'XMR': 'privacy',
      'ZEC': 'privacy',
      'DASH': 'privacy'
    };

    return categoryMap[symbol] || 'layer-1';
  }

  // Get real-time updates (mock implementation)
  async subscribeToRealTimeUpdates(callback: (data: MarketAsset[]) => void): Promise<() => void> {
    const interval = setInterval(async () => {
      try {
        const updatedData = await this.getMarketData({ maxAssets: 50 });
        callback(updatedData);
      } catch (error) {
        console.error('Error in real-time updates:', error);
      }
    }, 30000); // Update every 30 seconds

    // Return unsubscribe function
    return () => clearInterval(interval);
  }
}

// Create singleton instance
export const heatMapDataService = new HeatMapDataService();
export default HeatMapDataService;