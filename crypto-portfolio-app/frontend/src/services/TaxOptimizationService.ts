import {
  TaxJurisdiction,
  AccountingMethod,
  TaxableTransaction,
  TaxPosition,
  LossHarvestingOpportunity,
  TaxOptimizationStrategy,
  TaxProjection,
  TaxCalculationSummary,
  HoldingPeriod,
  TaxServiceConfig
} from '../types/tax.types';
import { taxCalculationService } from './TaxCalculationService';

/**
 * CP-049: Tax Optimization Service
 * Advanced tax planning, loss harvesting, and optimization strategies
 */
export class TaxOptimizationService {
  private config: TaxServiceConfig;
  private marketDataCache: Map<string, any> = new Map();
  private optimizationCache: Map<string, any> = new Map();

  constructor(config?: Partial<TaxServiceConfig>) {
    this.config = {
      defaultJurisdiction: 'US',
      defaultAccountingMethod: 'FIFO',
      cacheTTL: 300000,
      enableOptimization: true,
      enableAuditTrail: true,
      dataRetentionYears: 7,
      optimization: {
        enabled: true,
        riskTolerance: 'moderate',
        lookAheadDays: 30,
        minimumSavings: 100
      },
      ...config
    } as TaxServiceConfig;
  }

  /**
   * Identify loss harvesting opportunities
   */
  async identifyLossHarvestingOpportunities(
    positions: TaxPosition[],
    currentPrices: Map<string, number>,
    jurisdiction: TaxJurisdiction = this.config.defaultJurisdiction,
    accountingMethod: AccountingMethod = this.config.defaultAccountingMethod
  ): Promise<LossHarvestingOpportunity[]> {
    const opportunities: LossHarvestingOpportunity[] = [];
    
    for (const position of positions) {
      const currentPrice = currentPrices.get(position.asset);
      if (!currentPrice || position.totalQuantity <= 0) {
        continue;
      }

      const currentValue = position.totalQuantity * currentPrice;
      const unrealizedLoss = position.totalCostBasis - currentValue;
      
      // Only consider positions with unrealized losses
      if (unrealizedLoss <= 0) {
        continue;
      }

      // Calculate potential tax savings
      const taxSavings = await this.calculateTaxSavings(
        unrealizedLoss,
        jurisdiction
      );

      // Skip if savings below minimum threshold
      if (taxSavings < this.config.optimization!.minimumSavings) {
        continue;
      }

      // Check wash sale risk
      const washSaleRisk = await this.assessWashSaleRisk(
        position.asset,
        position.lots,
        jurisdiction
      );

      // Determine optimal harvesting strategy
      const strategy = await this.determineHarvestingStrategy(
        position,
        currentPrice,
        unrealizedLoss,
        washSaleRisk,
        accountingMethod
      );

      const opportunity: LossHarvestingOpportunity = {
        id: `harvest_${position.asset}_${Date.now()}`,
        asset: position.asset,
        currentPosition: {
          quantity: position.totalQuantity,
          costBasis: position.totalCostBasis,
          currentValue,
          unrealizedLoss
        },
        harvestingStrategy: strategy,
        washSaleRisk,
        priority: this.calculatePriority(unrealizedLoss, taxSavings, washSaleRisk),
        expirationDate: this.calculateExpirationDate(position, currentPrice),
        implementation: {
          steps: this.generateImplementationSteps(strategy, washSaleRisk),
          estimatedCost: this.estimateImplementationCost(strategy),
          complexity: this.assessComplexity(strategy, washSaleRisk)
        }
      };

      opportunities.push(opportunity);
    }

    // Sort by potential tax savings (descending)
    return opportunities.sort((a, b) => 
      b.harvestingStrategy.taxSavings - a.harvestingStrategy.taxSavings
    );
  }

  /**
   * Generate comprehensive tax optimization strategies
   */
  async generateOptimizationStrategies(
    positions: TaxPosition[],
    transactions: TaxableTransaction[],
    currentSummary: TaxCalculationSummary,
    targetYear: number = new Date().getFullYear()
  ): Promise<TaxOptimizationStrategy[]> {
    const strategies: TaxOptimizationStrategy[] = [];

    // Loss harvesting strategy
    const lossHarvestingStrategy = await this.generateLossHarvestingStrategy(
      positions,
      currentSummary,
      targetYear
    );
    if (lossHarvestingStrategy) {
      strategies.push(lossHarvestingStrategy);
    }

    // Gain timing strategy
    const gainTimingStrategy = await this.generateGainTimingStrategy(
      positions,
      transactions,
      currentSummary,
      targetYear
    );
    if (gainTimingStrategy) {
      strategies.push(gainTimingStrategy);
    }

    // Accounting method optimization
    const methodOptimizationStrategy = await this.generateMethodOptimizationStrategy(
      transactions,
      currentSummary,
      targetYear
    );
    if (methodOptimizationStrategy) {
      strategies.push(methodOptimizationStrategy);
    }

    // Long-term vs short-term optimization
    const holdingPeriodStrategy = await this.generateHoldingPeriodStrategy(
      positions,
      currentSummary,
      targetYear
    );
    if (holdingPeriodStrategy) {
      strategies.push(holdingPeriodStrategy);
    }

    // Business vs investment classification optimization
    const classificationStrategy = await this.generateClassificationStrategy(
      transactions,
      currentSummary,
      targetYear
    );
    if (classificationStrategy) {
      strategies.push(classificationStrategy);
    }

    return strategies.sort((a, b) => 
      (b.potentialSavings.currentYear + b.potentialSavings.futureYears) - 
      (a.potentialSavings.currentYear + a.potentialSavings.futureYears)
    );
  }

  /**
   * Generate tax projections for future years
   */
  async generateTaxProjections(
    positions: TaxPosition[],
    transactions: TaxableTransaction[],
    projectionYears: number = 3
  ): Promise<TaxProjection[]> {
    const projections: TaxProjection[] = [];
    const currentYear = new Date().getFullYear();

    const scenarios: Array<TaxProjection['scenario']> = ['conservative', 'likely', 'optimistic'];
    
    for (let year = 1; year <= projectionYears; year++) {
      const projectionYear = currentYear + year;
      
      for (const scenario of scenarios) {
        const projection = await this.generateYearProjection(
          positions,
          transactions,
          projectionYear,
          scenario
        );
        
        projections.push(projection);
      }
    }

    return projections;
  }

  /**
   * Calculate optimal tax timing for planned trades
   */
  async optimizeTradeTimingForTaxes(
    plannedTrades: Array<{
      asset: string;
      quantity: number;
      type: 'buy' | 'sell';
      targetDate?: string;
    }>,
    positions: TaxPosition[],
    jurisdiction: TaxJurisdiction = this.config.defaultJurisdiction
  ): Promise<Array<{
    trade: any;
    recommendedDate: string;
    taxImpact: number;
    reasoning: string;
    alternativeOptions: Array<{
      date: string;
      taxImpact: number;
      tradeOffs: string;
    }>;
  }>> {
    const optimizedTrades: Array<any> = [];

    for (const trade of plannedTrades) {
      if (trade.type === 'sell') {
        const optimization = await this.optimizeSellTiming(
          trade,
          positions.find(p => p.asset === trade.asset),
          jurisdiction
        );
        optimizedTrades.push(optimization);
      } else {
        const optimization = await this.optimizeBuyTiming(
          trade,
          positions.find(p => p.asset === trade.asset),
          jurisdiction
        );
        optimizedTrades.push(optimization);
      }
    }

    return optimizedTrades;
  }

  /**
   * Assess portfolio for year-end tax planning
   */
  async generateYearEndTaxPlan(
    positions: TaxPosition[],
    currentSummary: TaxCalculationSummary,
    currentPrices: Map<string, number>,
    jurisdiction: TaxJurisdiction = this.config.defaultJurisdiction
  ): Promise<{
    currentTaxLiability: number;
    optimizedTaxLiability: number;
    potentialSavings: number;
    recommendations: Array<{
      action: string;
      impact: number;
      deadline: string;
      priority: 'high' | 'medium' | 'low';
      complexity: 'simple' | 'moderate' | 'complex';
    }>;
    lossHarvestingOpportunities: LossHarvestingOpportunity[];
    gainRealizationOpportunities: Array<{
      asset: string;
      quantity: number;
      unrealizedGain: number;
      suggestedAction: string;
    }>;
  }> {
    const currentYear = new Date().getFullYear();
    const yearEndDate = new Date(currentYear, 11, 31); // December 31
    const daysUntilYearEnd = Math.floor(
      (yearEndDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );

    // Current tax liability
    const currentTaxLiability = currentSummary.totalTax;

    // Identify loss harvesting opportunities
    const lossHarvestingOpportunities = await this.identifyLossHarvestingOpportunities(
      positions,
      currentPrices,
      jurisdiction
    );

    // Identify gain realization opportunities
    const gainRealizationOpportunities = await this.identifyGainRealizationOpportunities(
      positions,
      currentPrices,
      currentSummary,
      jurisdiction
    );

    // Calculate optimized tax liability
    const totalLossHarvestingSavings = lossHarvestingOpportunities.reduce(
      (sum, opp) => sum + opp.harvestingStrategy.taxSavings,
      0
    );

    const optimizedTaxLiability = Math.max(0, currentTaxLiability - totalLossHarvestingSavings);
    const potentialSavings = currentTaxLiability - optimizedTaxLiability;

    // Generate recommendations
    const recommendations = await this.generateYearEndRecommendations(
      lossHarvestingOpportunities,
      gainRealizationOpportunities,
      currentSummary,
      daysUntilYearEnd
    );

    return {
      currentTaxLiability,
      optimizedTaxLiability,
      potentialSavings,
      recommendations,
      lossHarvestingOpportunities,
      gainRealizationOpportunities
    };
  }

  // Private helper methods

  private async calculateTaxSavings(
    lossAmount: number,
    jurisdiction: TaxJurisdiction
  ): Promise<number> {
    // Simplified calculation - real implementation would consider marginal tax rates,
    // capital loss limitations, and carryforward rules
    const marginalTaxRate = await this.getMarginalTaxRate(jurisdiction);
    return lossAmount * (marginalTaxRate / 100);
  }

  private async assessWashSaleRisk(
    asset: string,
    lots: any[],
    jurisdiction: TaxJurisdiction
  ): Promise<boolean> {
    // Check for recent purchases of the same or substantially identical securities
    // This is simplified - real implementation would check for substantially identical assets
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    
    return lots.some(lot => 
      new Date(lot.acquiredDate) > thirtyDaysAgo
    );
  }

  private async determineHarvestingStrategy(
    position: TaxPosition,
    currentPrice: number,
    unrealizedLoss: number,
    washSaleRisk: boolean,
    accountingMethod: AccountingMethod
  ): Promise<LossHarvestingOpportunity['harvestingStrategy']> {
    // Determine optimal quantity to sell for loss harvesting
    let sellQuantity = position.totalQuantity;
    
    // If wash sale risk, consider partial harvesting
    if (washSaleRisk) {
      sellQuantity = Math.min(sellQuantity, position.totalQuantity * 0.5);
    }

    const realizedLoss = (position.averageCostBasis - currentPrice) * sellQuantity;
    const taxSavings = await this.calculateTaxSavings(Math.abs(realizedLoss), 'US');

    return {
      sellQuantity,
      realizedLoss: Math.abs(realizedLoss),
      taxSavings,
      repurchaseDate: washSaleRisk ? 
        new Date(Date.now() + 31 * 24 * 60 * 60 * 1000).toISOString() : 
        undefined,
      repurchasePrice: currentPrice
    };
  }

  private calculatePriority(
    unrealizedLoss: number,
    taxSavings: number,
    washSaleRisk: boolean
  ): LossHarvestingOpportunity['priority'] {
    if (taxSavings > 1000 && !washSaleRisk) {
      return 'high';
    } else if (taxSavings > 500 || (taxSavings > 200 && !washSaleRisk)) {
      return 'medium';
    } else {
      return 'low';
    }
  }

  private calculateExpirationDate(
    position: TaxPosition,
    currentPrice: number
  ): string | undefined {
    // Loss harvesting opportunities may expire if price recovers
    // This is a simplified heuristic
    const volatility = 0.3; // 30% annual volatility assumption
    const daysToExpire = Math.floor(30 / (volatility / Math.sqrt(365)));
    
    return new Date(Date.now() + daysToExpire * 24 * 60 * 60 * 1000).toISOString();
  }

  private generateImplementationSteps(
    strategy: LossHarvestingOpportunity['harvestingStrategy'],
    washSaleRisk: boolean
  ): string[] {
    const steps = [];
    
    steps.push(`Sell ${strategy.sellQuantity} units to realize ${strategy.realizedLoss.toFixed(2)} loss`);
    
    if (washSaleRisk) {
      steps.push('Wait 31 days to avoid wash sale rule');
      steps.push(`Repurchase position after ${strategy.repurchaseDate}`);
    } else {
      steps.push('Repurchase immediately if desired to maintain market exposure');
    }
    
    steps.push(`Claim ${strategy.taxSavings.toFixed(2)} in tax savings`);
    
    return steps;
  }

  private estimateImplementationCost(
    strategy: LossHarvestingOpportunity['harvestingStrategy']
  ): number {
    // Estimate trading fees and market impact
    const tradingFeeRate = 0.001; // 0.1%
    const sellValue = strategy.sellQuantity * (strategy.repurchasePrice || 0);
    return sellValue * tradingFeeRate * 2; // Buy and sell
  }

  private assessComplexity(
    strategy: LossHarvestingOpportunity['harvestingStrategy'],
    washSaleRisk: boolean
  ): LossHarvestingOpportunity['implementation']['complexity'] {
    if (washSaleRisk || strategy.repurchaseDate) {
      return 'moderate';
    }
    return 'simple';
  }

  private async generateLossHarvestingStrategy(
    positions: TaxPosition[],
    currentSummary: TaxCalculationSummary,
    targetYear: number
  ): Promise<TaxOptimizationStrategy | null> {
    // Implementation for loss harvesting strategy
    return {
      id: `loss_harvesting_${targetYear}`,
      name: 'Tax Loss Harvesting',
      description: 'Systematically realize losses to offset gains and reduce tax liability',
      category: 'loss_harvesting',
      applicability: {
        jurisdiction: ['US', 'UK', 'CA'],
        accountingMethod: ['FIFO', 'LIFO', 'HIFO', 'SPECIFIC_ID'],
        minimumPortfolioSize: 10000
      },
      potentialSavings: {
        currentYear: 2000,
        futureYears: 5000,
        probability: 0.8
      },
      implementation: {
        timeframe: 'immediate',
        complexity: 'moderate',
        requirements: ['Market access', 'Position tracking'],
        risks: ['Wash sale violations', 'Market timing risk']
      },
      trackingMetrics: {
        successCriteria: ['Tax savings realized', 'Portfolio performance maintained'],
        monitoringFrequency: 'weekly'
      }
    };
  }

  private async generateGainTimingStrategy(
    positions: TaxPosition[],
    transactions: TaxableTransaction[],
    currentSummary: TaxCalculationSummary,
    targetYear: number
  ): Promise<TaxOptimizationStrategy | null> {
    // Implementation for gain timing strategy
    return null; // Placeholder
  }

  private async generateMethodOptimizationStrategy(
    transactions: TaxableTransaction[],
    currentSummary: TaxCalculationSummary,
    targetYear: number
  ): Promise<TaxOptimizationStrategy | null> {
    // Implementation for accounting method optimization
    return null; // Placeholder
  }

  private async generateHoldingPeriodStrategy(
    positions: TaxPosition[],
    currentSummary: TaxCalculationSummary,
    targetYear: number
  ): Promise<TaxOptimizationStrategy | null> {
    // Implementation for holding period optimization
    return null; // Placeholder
  }

  private async generateClassificationStrategy(
    transactions: TaxableTransaction[],
    currentSummary: TaxCalculationSummary,
    targetYear: number
  ): Promise<TaxOptimizationStrategy | null> {
    // Implementation for business vs investment classification
    return null; // Placeholder
  }

  private async generateYearProjection(
    positions: TaxPosition[],
    transactions: TaxableTransaction[],
    year: number,
    scenario: TaxProjection['scenario']
  ): Promise<TaxProjection> {
    // Simplified projection - real implementation would use Monte Carlo simulation
    const growthRates = {
      conservative: 0.05,
      likely: 0.08,
      optimistic: 0.12
    };

    const tradingActivity = {
      conservative: 'low' as const,
      likely: 'medium' as const,
      optimistic: 'high' as const
    };

    const growth = growthRates[scenario];
    
    return {
      year,
      scenario,
      assumptions: {
        portfolioGrowth: growth,
        tradingActivity: tradingActivity[scenario],
        marketConditions: 'sideways',
        taxLawChanges: false
      },
      projectedResults: {
        capitalGains: 10000 * growth,
        ordinaryIncome: 5000,
        totalTax: 3000 * (1 + growth),
        afterTaxReturns: 15000 * growth * 0.8
      },
      optimizationPotential: {
        potentialSavings: 1000,
        recommendedActions: ['Continue loss harvesting', 'Monitor holding periods'],
        timeToImplement: '30 days'
      },
      confidenceLevel: scenario === 'likely' ? 0.7 : scenario === 'conservative' ? 0.8 : 0.5
    };
  }

  private async optimizeSellTiming(
    trade: any,
    position: TaxPosition | undefined,
    jurisdiction: TaxJurisdiction
  ): Promise<any> {
    // Implementation for sell timing optimization
    return {
      trade,
      recommendedDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      taxImpact: -500,
      reasoning: 'Wait for long-term capital gains treatment',
      alternativeOptions: []
    };
  }

  private async optimizeBuyTiming(
    trade: any,
    position: TaxPosition | undefined,
    jurisdiction: TaxJurisdiction
  ): Promise<any> {
    // Implementation for buy timing optimization
    return {
      trade,
      recommendedDate: new Date().toISOString(),
      taxImpact: 0,
      reasoning: 'No significant tax impact for purchases',
      alternativeOptions: []
    };
  }

  private async identifyGainRealizationOpportunities(
    positions: TaxPosition[],
    currentPrices: Map<string, number>,
    currentSummary: TaxCalculationSummary,
    jurisdiction: TaxJurisdiction
  ): Promise<Array<any>> {
    // Implementation for gain realization opportunities
    return [];
  }

  private async generateYearEndRecommendations(
    lossHarvestingOpportunities: LossHarvestingOpportunity[],
    gainRealizationOpportunities: Array<any>,
    currentSummary: TaxCalculationSummary,
    daysUntilYearEnd: number
  ): Promise<Array<any>> {
    const recommendations = [];
    
    // High priority loss harvesting
    const highPriorityLosses = lossHarvestingOpportunities.filter(
      opp => opp.priority === 'high'
    );
    
    if (highPriorityLosses.length > 0) {
      recommendations.push({
        action: `Harvest ${highPriorityLosses.length} high-priority tax losses`,
        impact: highPriorityLosses.reduce((sum, opp) => sum + opp.harvestingStrategy.taxSavings, 0),
        deadline: daysUntilYearEnd > 30 ? 'End of November' : 'Immediate',
        priority: 'high' as const,
        complexity: 'moderate' as const
      });
    }
    
    // Review long-term positions approaching one-year mark
    recommendations.push({
      action: 'Review positions approaching long-term status',
      impact: 1000,
      deadline: 'Weekly review',
      priority: 'medium' as const,
      complexity: 'simple' as const
    });
    
    return recommendations;
  }

  private async getMarginalTaxRate(jurisdiction: TaxJurisdiction): Promise<number> {
    // Simplified - real implementation would consider user's specific tax bracket
    const rates: { [key in TaxJurisdiction]?: number } = {
      'US': 24,
      'UK': 20,
      'CA': 26,
      'AU': 32
    };
    
    return rates[jurisdiction] || 25;
  }
}

export const taxOptimizationService = new TaxOptimizationService();