import { PrismaClient, Portfolio, PortfolioType, Holding, PortfolioSnapshot, PerformanceMetric } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

interface CreatePortfolioInput {
  userId: string;
  name: string;
  description?: string;
  type?: PortfolioType;
  exchangeId?: string;
  isDefault?: boolean;
}

interface UpdatePortfolioInput {
  name?: string;
  description?: string;
  type?: PortfolioType;
  isActive?: boolean;
}

interface PortfolioWithDetails extends Portfolio {
  holdings: (Holding & {
    cryptocurrency: {
      id: string;
      symbol: string;
      name: string;
      logoUrl: string | null;
    };
    exchange: {
      id: string;
      name: string;
      displayName: string;
    } | null;
  })[];
  portfolioSnapshots: PortfolioSnapshot[];
  performanceMetrics: PerformanceMetric[];
  _count: {
    holdings: number;
    transactions: number;
  };
}

interface PortfolioAnalytics {
  totalValue: Decimal;
  totalCost: Decimal;
  totalProfitLoss: Decimal;
  totalProfitLossPercentage: Decimal;
  assetDistribution: Array<{
    symbol: string;
    name: string;
    value: Decimal;
    percentage: Decimal;
    quantity: Decimal;
  }>;
  exchangeDistribution: Array<{
    exchangeName: string;
    value: Decimal;
    percentage: Decimal;
  }>;
}

export class PortfolioService {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  /**
   * Create a new portfolio
   */
  async createPortfolio(data: CreatePortfolioInput): Promise<Portfolio> {
    // If this is set as default, unset other default portfolios for the user
    if (data.isDefault) {
      await this.prisma.portfolio.updateMany({
        where: {
          userId: data.userId,
          isDefault: true,
        },
        data: {
          isDefault: false,
        },
      });
    }

    return this.prisma.portfolio.create({
      data: {
        userId: data.userId,
        name: data.name,
        description: data.description,
        type: data.type || PortfolioType.MAIN,
        exchangeId: data.exchangeId,
        isDefault: data.isDefault || false,
      },
    });
  }

  /**
   * Get portfolio by ID with detailed information
   */
  async getPortfolioById(portfolioId: string, userId: string): Promise<PortfolioWithDetails | null> {
    return this.prisma.portfolio.findFirst({
      where: {
        id: portfolioId,
        userId,
        isActive: true,
      },
      include: {
        holdings: {
          include: {
            cryptocurrency: {
              select: {
                id: true,
                symbol: true,
                name: true,
                logoUrl: true,
              },
            },
            exchange: {
              select: {
                id: true,
                name: true,
                displayName: true,
              },
            },
          },
          orderBy: {
            currentValue: 'desc',
          },
        },
        portfolioSnapshots: {
          orderBy: {
            snapshotDate: 'desc',
          },
          take: 30, // Last 30 snapshots
        },
        performanceMetrics: {
          orderBy: {
            calculatedAt: 'desc',
          },
        },
        _count: {
          select: {
            holdings: true,
            transactions: true,
          },
        },
      },
    }) as PortfolioWithDetails | null;
  }

  /**
   * Get all portfolios for a user
   */
  async getUserPortfolios(userId: string): Promise<PortfolioWithDetails[]> {
    return this.prisma.portfolio.findMany({
      where: {
        userId,
        isActive: true,
      },
      include: {
        holdings: {
          include: {
            cryptocurrency: {
              select: {
                id: true,
                symbol: true,
                name: true,
                logoUrl: true,
              },
            },
            exchange: {
              select: {
                id: true,
                name: true,
                displayName: true,
              },
            },
          },
          orderBy: {
            currentValue: 'desc',
          },
        },
        portfolioSnapshots: {
          orderBy: {
            snapshotDate: 'desc',
          },
          take: 1, // Just the latest snapshot
        },
        performanceMetrics: {
          where: {
            period: '30d', // Default to 30-day metrics
          },
          orderBy: {
            calculatedAt: 'desc',
          },
          take: 1,
        },
        _count: {
          select: {
            holdings: true,
            transactions: true,
          },
        },
      },
      orderBy: [
        { isDefault: 'desc' },
        { createdAt: 'desc' },
      ],
    }) as PortfolioWithDetails[];
  }

  /**
   * Update portfolio
   */
  async updatePortfolio(portfolioId: string, userId: string, data: UpdatePortfolioInput): Promise<Portfolio> {
    // Verify ownership
    const portfolio = await this.prisma.portfolio.findFirst({
      where: { id: portfolioId, userId },
    });

    if (!portfolio) {
      throw new Error('Portfolio not found');
    }

    return this.prisma.portfolio.update({
      where: { id: portfolioId },
      data,
    });
  }

  /**
   * Delete portfolio (soft delete)
   */
  async deletePortfolio(portfolioId: string, userId: string): Promise<void> {
    const portfolio = await this.prisma.portfolio.findFirst({
      where: { id: portfolioId, userId },
    });

    if (!portfolio) {
      throw new Error('Portfolio not found');
    }

    if (portfolio.isDefault) {
      throw new Error('Cannot delete default portfolio');
    }

    await this.prisma.portfolio.update({
      where: { id: portfolioId },
      data: { isActive: false },
    });
  }

  /**
   * Set portfolio as default
   */
  async setAsDefault(portfolioId: string, userId: string): Promise<Portfolio> {
    // First unset all default portfolios for the user
    await this.prisma.portfolio.updateMany({
      where: {
        userId,
        isDefault: true,
      },
      data: {
        isDefault: false,
      },
    });

    // Set the specified portfolio as default
    return this.prisma.portfolio.update({
      where: { id: portfolioId },
      data: { isDefault: true },
    });
  }

  /**
   * Calculate and update portfolio values
   */
  async updatePortfolioValues(portfolioId: string): Promise<void> {
    // Get all holdings with current prices
    const holdings = await this.prisma.holding.findMany({
      where: { portfolioId },
      include: {
        cryptocurrency: {
          include: {
            currentPrices: {
              take: 1,
              orderBy: {
                lastUpdated: 'desc',
              },
            },
          },
        },
      },
    });

    let totalValue = new Decimal(0);
    let totalCost = new Decimal(0);

    // Update each holding's current value
    for (const holding of holdings) {
      const currentPrice = holding.cryptocurrency.currentPrices[0]?.price || new Decimal(0);
      const currentValue = holding.quantity.mul(currentPrice);
      const unrealizedPnl = currentValue.sub(holding.totalCost || 0);

      await this.prisma.holding.update({
        where: { id: holding.id },
        data: {
          currentValue,
          unrealizedPnl,
        },
      });

      totalValue = totalValue.add(currentValue);
      totalCost = totalCost.add(holding.totalCost || 0);
    }

    // Update portfolio totals
    await this.prisma.portfolio.update({
      where: { id: portfolioId },
      data: {
        totalValue,
        totalCost,
      },
    });
  }

  /**
   * Create portfolio snapshot
   */
  async createSnapshot(portfolioId: string, date?: Date): Promise<PortfolioSnapshot> {
    const snapshotDate = date || new Date();
    
    // Calculate realized P&L from transactions
    const realizedPnlData = await this.prisma.transaction.aggregate({
      where: {
        portfolioId,
        status: 'COMPLETED',
        executedAt: {
          lte: snapshotDate,
        },
      },
      _sum: {
        totalValue: true,
      },
    });

    // Get portfolio current values
    const portfolio = await this.prisma.portfolio.findUnique({
      where: { id: portfolioId },
      select: {
        totalValue: true,
        totalCost: true,
      },
    });

    if (!portfolio) {
      throw new Error('Portfolio not found');
    }

    const totalValue = portfolio.totalValue || new Decimal(0);
    const totalCost = portfolio.totalCost || new Decimal(0);
    const unrealizedPnl = totalValue.sub(totalCost);
    const realizedPnl = realizedPnlData._sum.totalValue || new Decimal(0);
    const roiPercentage = totalCost.gt(0) 
      ? unrealizedPnl.add(realizedPnl).div(totalCost).mul(100)
      : new Decimal(0);

    return this.prisma.portfolioSnapshot.upsert({
      where: {
        portfolioId_snapshotDate: {
          portfolioId,
          snapshotDate,
        },
      },
      update: {
        totalValue,
        totalCost,
        unrealizedPnl,
        realizedPnl,
        roiPercentage,
      },
      create: {
        portfolioId,
        totalValue,
        totalCost,
        unrealizedPnl,
        realizedPnl,
        roiPercentage,
        snapshotDate,
      },
    });
  }

  /**
   * Calculate performance metrics
   */
  async calculatePerformanceMetrics(portfolioId: string, period: string): Promise<PerformanceMetric> {
    const now = new Date();
    const periodStart = this.getPeriodStartDate(period, now);

    // Get snapshots for the period
    const snapshots = await this.prisma.portfolioSnapshot.findMany({
      where: {
        portfolioId,
        snapshotDate: {
          gte: periodStart,
          lte: now,
        },
      },
      orderBy: {
        snapshotDate: 'asc',
      },
    });

    if (snapshots.length < 2) {
      // Not enough data for calculations
      return this.prisma.performanceMetric.upsert({
        where: {
          portfolioId_period: {
            portfolioId,
            period,
          },
        },
        update: {
          calculatedAt: now,
        },
        create: {
          portfolioId,
          period,
          calculatedAt: now,
        },
      });
    }

    const returns = this.calculateReturns(snapshots);
    const returnPercentage = this.calculateTotalReturn(snapshots);
    const volatility = this.calculateVolatility(returns);
    const sharpeRatio = this.calculateSharpeRatio(returns, volatility);
    const maxDrawdown = this.calculateMaxDrawdown(snapshots);

    return this.prisma.performanceMetric.upsert({
      where: {
        portfolioId_period: {
          portfolioId,
          period,
        },
      },
      update: {
        returnPercentage,
        volatility,
        sharpeRatio,
        maxDrawdown,
        calculatedAt: now,
      },
      create: {
        portfolioId,
        period,
        returnPercentage,
        volatility,
        sharpeRatio,
        maxDrawdown,
        calculatedAt: now,
      },
    });
  }

  /**
   * Get portfolio analytics
   */
  async getPortfolioAnalytics(portfolioId: string): Promise<PortfolioAnalytics> {
    const portfolio = await this.prisma.portfolio.findUnique({
      where: { id: portfolioId },
      include: {
        holdings: {
          where: {
            quantity: {
              gt: 0,
            },
          },
          include: {
            cryptocurrency: {
              select: {
                symbol: true,
                name: true,
              },
            },
            exchange: {
              select: {
                name: true,
                displayName: true,
              },
            },
          },
        },
      },
    });

    if (!portfolio) {
      throw new Error('Portfolio not found');
    }

    const totalValue = portfolio.totalValue || new Decimal(0);
    const totalCost = portfolio.totalCost || new Decimal(0);
    const totalProfitLoss = totalValue.sub(totalCost);
    const totalProfitLossPercentage = totalCost.gt(0) 
      ? totalProfitLoss.div(totalCost).mul(100)
      : new Decimal(0);

    // Asset distribution
    const assetDistribution = portfolio.holdings.map(holding => ({
      symbol: holding.cryptocurrency.symbol,
      name: holding.cryptocurrency.name,
      value: holding.currentValue || new Decimal(0),
      percentage: totalValue.gt(0) 
        ? (holding.currentValue || new Decimal(0)).div(totalValue).mul(100)
        : new Decimal(0),
      quantity: holding.quantity,
    }));

    // Exchange distribution
    const exchangeMap = new Map<string, Decimal>();
    portfolio.holdings.forEach(holding => {
      if (holding.exchange) {
        const current = exchangeMap.get(holding.exchange.displayName) || new Decimal(0);
        exchangeMap.set(holding.exchange.displayName, current.add(holding.currentValue || 0));
      }
    });

    const exchangeDistribution = Array.from(exchangeMap.entries()).map(([name, value]) => ({
      exchangeName: name,
      value,
      percentage: totalValue.gt(0) ? value.div(totalValue).mul(100) : new Decimal(0),
    }));

    return {
      totalValue,
      totalCost,
      totalProfitLoss,
      totalProfitLossPercentage,
      assetDistribution,
      exchangeDistribution,
    };
  }

  // Helper methods for performance calculations
  private getPeriodStartDate(period: string, now: Date): Date {
    const start = new Date(now);
    switch (period) {
      case '1d':
        start.setDate(start.getDate() - 1);
        break;
      case '7d':
        start.setDate(start.getDate() - 7);
        break;
      case '30d':
        start.setDate(start.getDate() - 30);
        break;
      case '1y':
        start.setFullYear(start.getFullYear() - 1);
        break;
      case 'all':
        start.setFullYear(2000); // Very early date
        break;
      default:
        start.setDate(start.getDate() - 30);
    }
    return start;
  }

  private calculateReturns(snapshots: PortfolioSnapshot[]): Decimal[] {
    const returns: Decimal[] = [];
    for (let i = 1; i < snapshots.length; i++) {
      const prevValue = snapshots[i - 1].totalValue;
      const currentValue = snapshots[i].totalValue;
      
      if (prevValue.gt(0)) {
        const returnRate = currentValue.sub(prevValue).div(prevValue);
        returns.push(returnRate);
      }
    }
    return returns;
  }

  private calculateTotalReturn(snapshots: PortfolioSnapshot[]): Decimal | null {
    if (snapshots.length < 2) return null;
    
    const firstValue = snapshots[0].totalValue;
    const lastValue = snapshots[snapshots.length - 1].totalValue;
    
    if (firstValue.gt(0)) {
      return lastValue.sub(firstValue).div(firstValue).mul(100);
    }
    return null;
  }

  private calculateVolatility(returns: Decimal[]): Decimal | null {
    if (returns.length < 2) return null;
    
    const mean = returns.reduce((sum, r) => sum.add(r), new Decimal(0)).div(returns.length);
    const variance = returns
      .map(r => r.sub(mean).pow(2))
      .reduce((sum, v) => sum.add(v), new Decimal(0))
      .div(returns.length - 1);
    
    return variance.sqrt().mul(100);
  }

  private calculateSharpeRatio(returns: Decimal[], volatility: Decimal | null): Decimal | null {
    if (!volatility || volatility.lte(0) || returns.length === 0) return null;
    
    const avgReturn = returns.reduce((sum, r) => sum.add(r), new Decimal(0)).div(returns.length);
    const riskFreeRate = new Decimal(0.02).div(365); // Assume 2% annual risk-free rate
    
    return avgReturn.sub(riskFreeRate).div(volatility.div(100));
  }

  private calculateMaxDrawdown(snapshots: PortfolioSnapshot[]): Decimal | null {
    if (snapshots.length < 2) return null;
    
    let maxDrawdown = new Decimal(0);
    let peak = snapshots[0].totalValue;
    
    for (let i = 1; i < snapshots.length; i++) {
      const currentValue = snapshots[i].totalValue;
      
      if (currentValue.gt(peak)) {
        peak = currentValue;
      }
      
      if (peak.gt(0)) {
        const drawdown = peak.sub(currentValue).div(peak).mul(100);
        if (drawdown.gt(maxDrawdown)) {
          maxDrawdown = drawdown;
        }
      }
    }
    
    return maxDrawdown;
  }
}