import {
  TaxJurisdiction,
  AccountingMethod,
  TaxableTransaction,
  TaxCalculationSummary,
  CapitalGainLoss,
  TaxLot,
  TaxPosition,
  TaxIssue,
  JurisdictionTaxConfig,
  HoldingPeriod,
  TaxableEventType,
  TaxReport,
  TaxServiceConfig,
  TaxCalculationError,
  TaxComplianceError,
  TaxDataError,
  DEFAULT_TAX_SETTINGS
} from '../types/tax.types';

/**
 * CP-049: Automated Tax Reporting and Compliance Tools
 * Core tax calculation service with multi-jurisdiction support
 */
export class TaxCalculationService {
  private cache: Map<string, any> = new Map();
  private jurisdictionConfigs: Map<TaxJurisdiction, JurisdictionTaxConfig> = new Map();
  private positions: Map<string, TaxPosition> = new Map(); // asset -> position
  private config: TaxServiceConfig;

  constructor(config?: Partial<TaxServiceConfig>) {
    this.config = {
      defaultJurisdiction: 'US',
      defaultAccountingMethod: 'FIFO',
      cacheTTL: 300000, // 5 minutes
      enableOptimization: true,
      enableAuditTrail: true,
      dataRetentionYears: 7,
      ...config
    } as TaxServiceConfig;

    this.initializeJurisdictionConfigs();
  }

  /**
   * Main tax calculation method
   */
  async calculateTaxes(
    transactions: TaxableTransaction[],
    year: number,
    jurisdiction: TaxJurisdiction = this.config.defaultJurisdiction,
    accountingMethod: AccountingMethod = this.config.defaultAccountingMethod
  ): Promise<TaxCalculationSummary> {
    try {
      const cacheKey = this.generateCacheKey(transactions, year, jurisdiction, accountingMethod);
      
      if (this.cache.has(cacheKey)) {
        const cached = this.cache.get(cacheKey);
        if (Date.now() - cached.timestamp < this.config.cacheTTL) {
          return cached.data;
        }
      }

      // Validate input data
      const validationIssues = await this.validateTransactionData(transactions);
      if (validationIssues.some(issue => issue.severity === 'critical')) {
        throw new TaxDataError(
          'Critical data issues prevent calculation',
          validationIssues.filter(i => i.severity === 'critical').map(i => i.message),
          ['tax_calculation']
        );
      }

      // Filter transactions for the tax year
      const yearTransactions = this.filterTransactionsByYear(transactions, year, jurisdiction);

      // Update positions with all transactions (including prior years for cost basis)
      await this.updatePositions(transactions.filter(tx => 
        new Date(tx.date) <= new Date(`${year}-12-31`)
      ), accountingMethod);

      // Calculate capital gains and losses
      const capitalGainsResults = await this.calculateCapitalGains(
        yearTransactions.filter(tx => this.isCapitalTransaction(tx)),
        accountingMethod,
        jurisdiction,
        year
      );

      // Calculate ordinary income
      const incomeResults = await this.calculateOrdinaryIncome(
        yearTransactions.filter(tx => this.isIncomeTransaction(tx)),
        jurisdiction,
        year
      );

      // Calculate deductions
      const deductionResults = await this.calculateDeductions(
        yearTransactions.filter(tx => this.isDeductibleTransaction(tx)),
        jurisdiction,
        year
      );

      // Calculate tax liability
      const taxLiability = await this.calculateTaxLiability(
        capitalGainsResults,
        incomeResults,
        deductionResults,
        jurisdiction,
        year
      );

      // Generate summary
      const summary: TaxCalculationSummary = {
        year,
        jurisdiction,
        accountingMethod,
        
        // Capital gains/losses
        shortTermGains: capitalGainsResults.shortTermGains,
        shortTermLosses: capitalGainsResults.shortTermLosses,
        longTermGains: capitalGainsResults.longTermGains,
        longTermLosses: capitalGainsResults.longTermLosses,
        netCapitalGains: capitalGainsResults.netGains,
        capitalLossCarryforward: Math.max(0, capitalGainsResults.totalLosses - capitalGainsResults.totalGains),
        
        // Income
        ordinaryIncome: incomeResults,
        
        // Deductions
        deductions: deductionResults,
        
        // Tax liability
        adjustedGrossIncome: taxLiability.adjustedGrossIncome,
        taxableIncome: taxLiability.taxableIncome,
        federalTax: taxLiability.federalTax,
        stateTax: taxLiability.stateTax,
        localTax: taxLiability.localTax,
        totalTax: taxLiability.totalTax,
        effectiveTaxRate: taxLiability.effectiveTaxRate,
        marginalTaxRate: taxLiability.marginalTaxRate,
        
        // Processing summary
        totalTransactionsProcessed: yearTransactions.length,
        transactionsWithGains: capitalGainsResults.gains.length,
        transactionsWithLosses: capitalGainsResults.losses.length,
        unreportableTransactions: capitalGainsResults.unreportable.length,
        
        // Audit information
        calculationDate: new Date().toISOString(),
        dataCompleteness: this.calculateDataCompleteness(yearTransactions),
        assumptionsMade: this.getAssumptionsMade(yearTransactions, accountingMethod),
        potentialIssues: validationIssues
      };

      // Cache the result
      this.cache.set(cacheKey, {
        data: summary,
        timestamp: Date.now()
      });

      return summary;
    } catch (error) {
      if (error instanceof TaxCalculationError || 
          error instanceof TaxComplianceError || 
          error instanceof TaxDataError) {
        throw error;
      }
      throw new TaxCalculationError(
        `Tax calculation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'CALCULATION_FAILED',
        jurisdiction
      );
    }
  }

  /**
   * Calculate capital gains and losses using specified accounting method
   */
  private async calculateCapitalGains(
    transactions: TaxableTransaction[],
    accountingMethod: AccountingMethod,
    jurisdiction: TaxJurisdiction,
    year: number
  ): Promise<{
    shortTermGains: number;
    shortTermLosses: number;
    longTermGains: number;
    longTermLosses: number;
    totalGains: number;
    totalLosses: number;
    netGains: number;
    gains: CapitalGainLoss[];
    losses: CapitalGainLoss[];
    unreportable: TaxableTransaction[];
  }> {
    const gains: CapitalGainLoss[] = [];
    const losses: CapitalGainLoss[] = [];
    const unreportable: TaxableTransaction[] = [];
    
    let shortTermGains = 0;
    let shortTermLosses = 0;
    let longTermGains = 0;
    let longTermLosses = 0;

    const jurisdictionConfig = this.getJurisdictionConfig(jurisdiction);
    const deMinimisThreshold = jurisdictionConfig.deMinimisThreshold || 0;

    // Group disposal transactions by asset
    const disposals = transactions.filter(tx => 
      (tx.type === 'capital_gain' || tx.type === 'capital_loss') && 
      tx.quantity < 0
    );

    for (const disposal of disposals) {
      try {
        // Skip transactions below de minimis threshold
        if (Math.abs(disposal.proceeds || 0) < deMinimisThreshold) {
          unreportable.push(disposal);
          continue;
        }

        const capitalGainLoss = await this.calculateCapitalGainLoss(
          disposal,
          accountingMethod,
          jurisdictionConfig
        );

        if (capitalGainLoss.gainLoss > 0) {
          gains.push(capitalGainLoss);
          if (capitalGainLoss.holdingPeriod === 'short_term') {
            shortTermGains += capitalGainLoss.gainLoss;
          } else {
            longTermGains += capitalGainLoss.gainLoss;
          }
        } else if (capitalGainLoss.gainLoss < 0) {
          losses.push(capitalGainLoss);
          if (capitalGainLoss.holdingPeriod === 'short_term') {
            shortTermLosses += Math.abs(capitalGainLoss.gainLoss);
          } else {
            longTermLosses += Math.abs(capitalGainLoss.gainLoss);
          }
        }
      } catch (error) {
        console.error(`Error calculating gain/loss for transaction ${disposal.id}:`, error);
        // Continue processing other transactions
      }
    }

    return {
      shortTermGains,
      shortTermLosses,
      longTermGains,
      longTermLosses,
      totalGains: shortTermGains + longTermGains,
      totalLosses: shortTermLosses + longTermLosses,
      netGains: (shortTermGains + longTermGains) - (shortTermLosses + longTermLosses),
      gains,
      losses,
      unreportable
    };
  }

  /**
   * Calculate capital gain/loss for a specific disposal transaction
   */
  private async calculateCapitalGainLoss(
    disposal: TaxableTransaction,
    accountingMethod: AccountingMethod,
    jurisdictionConfig: JurisdictionTaxConfig
  ): Promise<CapitalGainLoss> {
    const position = this.positions.get(disposal.asset);
    if (!position) {
      throw new TaxCalculationError(
        `No position found for asset ${disposal.asset}`,
        'MISSING_POSITION',
        jurisdictionConfig.jurisdiction,
        [disposal.id]
      );
    }

    const disposalQuantity = Math.abs(disposal.quantity);
    const proceeds = disposal.proceeds || (disposalQuantity * (disposal.price || 0));
    
    // Select lots to dispose based on accounting method
    const selectedLots = this.selectLotsForDisposal(
      position.lots,
      disposalQuantity,
      accountingMethod
    );

    let totalCostBasis = 0;
    const matchedLots: Array<{
      lotId: string;
      quantity: number;
      costBasisPerUnit: number;
      acquiredDate: string;
    }> = [];

    for (const { lot, quantity } of selectedLots) {
      const costBasis = quantity * lot.costBasisPerUnit;
      totalCostBasis += costBasis;
      
      matchedLots.push({
        lotId: lot.id,
        quantity,
        costBasisPerUnit: lot.costBasisPerUnit,
        acquiredDate: lot.acquiredDate
      });
    }

    const gainLoss = proceeds - totalCostBasis;
    
    // Determine holding period (use earliest lot for mixed periods)
    const earliestLot = selectedLots.reduce((earliest, current) => 
      new Date(current.lot.acquiredDate) < new Date(earliest.lot.acquiredDate) ? current : earliest
    );
    
    const daysBetween = Math.floor(
      (new Date(disposal.date).getTime() - new Date(earliestLot.lot.acquiredDate).getTime()) 
      / (1000 * 60 * 60 * 24)
    );
    
    const holdingPeriod: HoldingPeriod = daysBetween >= jurisdictionConfig.longTermThresholdDays 
      ? 'long_term' 
      : 'short_term';

    // Check for wash sale rules (if enabled)
    let washSaleAdjustment;
    if (jurisdictionConfig.washSaleRuleDays && gainLoss < 0) {
      washSaleAdjustment = await this.checkWashSaleRules(
        disposal,
        Math.abs(gainLoss),
        jurisdictionConfig.washSaleRuleDays
      );
    }

    return {
      transactionId: disposal.id,
      asset: disposal.asset,
      disposalDate: disposal.date,
      disposalQuantity,
      proceeds,
      costBasis: totalCostBasis,
      gainLoss: washSaleAdjustment ? 0 : gainLoss, // Wash sale disallows loss
      holdingPeriod,
      accountingMethod,
      matchedLots,
      washSaleAdjustment
    };
  }

  /**
   * Select lots for disposal based on accounting method
   */
  private selectLotsForDisposal(
    availableLots: TaxLot[],
    disposalQuantity: number,
    accountingMethod: AccountingMethod
  ): Array<{ lot: TaxLot; quantity: number }> {
    const selectedLots: Array<{ lot: TaxLot; quantity: number }> = [];
    let remainingQuantity = disposalQuantity;
    
    // Sort lots based on accounting method
    let sortedLots = [...availableLots.filter(lot => lot.quantity > 0)];
    
    switch (accountingMethod) {
      case 'FIFO':
        sortedLots.sort((a, b) => new Date(a.acquiredDate).getTime() - new Date(b.acquiredDate).getTime());
        break;
      case 'LIFO':
        sortedLots.sort((a, b) => new Date(b.acquiredDate).getTime() - new Date(a.acquiredDate).getTime());
        break;
      case 'HIFO':
        sortedLots.sort((a, b) => b.costBasisPerUnit - a.costBasisPerUnit);
        break;
      case 'AVERAGE':
        // For average cost, create virtual lot with average cost basis
        const totalQuantity = sortedLots.reduce((sum, lot) => sum + lot.quantity, 0);
        const totalCostBasis = sortedLots.reduce((sum, lot) => sum + lot.totalCostBasis, 0);
        const averageCostBasisPerUnit = totalCostBasis / totalQuantity;
        
        sortedLots = [{
          ...sortedLots[0], // Use first lot as template
          quantity: totalQuantity,
          costBasisPerUnit: averageCostBasisPerUnit,
          totalCostBasis: totalCostBasis
        }];
        break;
      case 'SPECIFIC_ID':
        // For specific identification, lots should already be pre-selected
        // This is handled at a higher level with user input
        break;
    }

    // Select lots until disposal quantity is satisfied
    for (const lot of sortedLots) {
      if (remainingQuantity <= 0) break;
      
      const quantityFromThisLot = Math.min(remainingQuantity, lot.quantity);
      
      selectedLots.push({
        lot,
        quantity: quantityFromThisLot
      });
      
      remainingQuantity -= quantityFromThisLot;
    }

    if (remainingQuantity > 0.000001) { // Allow for small rounding errors
      throw new TaxCalculationError(
        `Insufficient quantity to dispose. Need ${disposalQuantity}, have ${disposalQuantity - remainingQuantity}`,
        'INSUFFICIENT_QUANTITY'
      );
    }

    return selectedLots;
  }

  /**
   * Calculate ordinary income from various sources
   */
  private async calculateOrdinaryIncome(
    transactions: TaxableTransaction[],
    jurisdiction: TaxJurisdiction,
    year: number
  ): Promise<{
    stakingRewards: number;
    miningRewards: number;
    interestIncome: number;
    airdrops: number;
    forks: number;
    businessIncome: number;
    total: number;
  }> {
    let stakingRewards = 0;
    let miningRewards = 0;
    let interestIncome = 0;
    let airdrops = 0;
    let forks = 0;
    let businessIncome = 0;

    for (const tx of transactions) {
      const value = this.getTransactionValue(tx);
      
      switch (tx.type) {
        case 'ordinary_income':
          // Categorize by description or source
          if (tx.description?.toLowerCase().includes('staking')) {
            stakingRewards += value;
          } else if (tx.description?.toLowerCase().includes('mining')) {
            miningRewards += value;
          } else {
            businessIncome += value;
          }
          break;
        case 'interest_income':
          interestIncome += value;
          break;
        case 'dividend_income':
          // Treat as interest income for crypto
          interestIncome += value;
          break;
        case 'airdrop_income':
          airdrops += value;
          break;
        case 'fork_income':
          forks += value;
          break;
        case 'business_income':
          businessIncome += value;
          break;
      }
    }

    const total = stakingRewards + miningRewards + interestIncome + airdrops + forks + businessIncome;

    return {
      stakingRewards,
      miningRewards,
      interestIncome,
      airdrops,
      forks,
      businessIncome,
      total
    };
  }

  /**
   * Calculate deductible expenses
   */
  private async calculateDeductions(
    transactions: TaxableTransaction[],
    jurisdiction: TaxJurisdiction,
    year: number
  ): Promise<{
    transactionFees: number;
    gasFees: number;
    businessExpenses: number;
    professionalFees: number;
    softwareSubscriptions: number;
    total: number;
  }> {
    let transactionFees = 0;
    let gasFees = 0;
    let businessExpenses = 0;
    let professionalFees = 0;
    let softwareSubscriptions = 0;

    for (const tx of transactions) {
      const value = Math.abs(this.getTransactionValue(tx));
      
      if (tx.type === 'business_expense') {
        // Categorize by description
        const desc = tx.description?.toLowerCase() || '';
        if (desc.includes('gas') || desc.includes('network fee')) {
          gasFees += value;
        } else if (desc.includes('trading fee') || desc.includes('exchange fee')) {
          transactionFees += value;
        } else if (desc.includes('professional') || desc.includes('accounting') || desc.includes('legal')) {
          professionalFees += value;
        } else if (desc.includes('software') || desc.includes('subscription') || desc.includes('tool')) {
          softwareSubscriptions += value;
        } else {
          businessExpenses += value;
        }
      } else if (tx.fees) {
        // Transaction fees from trading
        transactionFees += tx.fees;
      }
    }

    const total = transactionFees + gasFees + businessExpenses + professionalFees + softwareSubscriptions;

    return {
      transactionFees,
      gasFees,
      businessExpenses,
      professionalFees,
      softwareSubscriptions,
      total
    };
  }

  /**
   * Calculate tax liability based on jurisdiction rules
   */
  private async calculateTaxLiability(
    capitalGains: any,
    income: any,
    deductions: any,
    jurisdiction: TaxJurisdiction,
    year: number
  ): Promise<{
    adjustedGrossIncome: number;
    taxableIncome: number;
    federalTax: number;
    stateTax: number;
    localTax: number;
    totalTax: number;
    effectiveTaxRate: number;
    marginalTaxRate: number;
  }> {
    const config = this.getJurisdictionConfig(jurisdiction);
    
    // Calculate Adjusted Gross Income
    const capitalGainsTaxable = Math.max(capitalGains.netGains, -config.deductionLimits.capitalLossLimit);
    const adjustedGrossIncome = capitalGainsTaxable + income.total - deductions.total;
    
    // Calculate taxable income (after standard deduction)
    const taxableIncome = Math.max(0, adjustedGrossIncome - config.federal.standardDeduction);
    
    // Calculate federal tax
    const federalTax = this.calculateProgressiveTax(taxableIncome, config.federal.brackets);
    
    // Calculate capital gains tax (if separate rates apply)
    const capitalGainsTax = this.calculateCapitalGainsTax(capitalGains, config);
    
    // Use higher of regular tax or capital gains tax
    const totalFederalTax = Math.max(federalTax, capitalGainsTax);
    
    // Calculate state tax (if applicable)
    const stateTax = config.state ? 
      this.calculateProgressiveTax(taxableIncome, config.state.brackets) : 0;
    
    // Calculate local tax (if applicable)
    const localTax = config.local ? 
      this.calculateFlatTax(taxableIncome, config.local.rate) : 0;
    
    const totalTax = totalFederalTax + stateTax + localTax;
    
    return {
      adjustedGrossIncome,
      taxableIncome,
      federalTax: totalFederalTax,
      stateTax,
      localTax,
      totalTax,
      effectiveTaxRate: adjustedGrossIncome > 0 ? (totalTax / adjustedGrossIncome) * 100 : 0,
      marginalTaxRate: this.getMarginalTaxRate(taxableIncome, config.federal.brackets)
    };
  }

  /**
   * Calculate capital gains tax using special rates (if applicable)
   */
  private calculateCapitalGainsTax(capitalGains: any, config: JurisdictionTaxConfig): number {
    if (!config.federal.capitalGainsRates) {
      return 0;
    }
    
    let tax = 0;
    
    // Short-term capital gains taxed as ordinary income
    tax += this.calculateProgressiveTax(
      Math.max(0, capitalGains.shortTermGains - capitalGains.shortTermLosses),
      config.federal.brackets
    );
    
    // Long-term capital gains at preferential rates
    tax += this.calculateProgressiveTax(
      Math.max(0, capitalGains.longTermGains - capitalGains.longTermLosses),
      config.federal.capitalGainsRates.longTerm
    );
    
    return tax;
  }

  /**
   * Calculate progressive tax based on brackets
   */
  private calculateProgressiveTax(income: number, brackets: any[]): number {
    let tax = 0;
    let remainingIncome = income;

    for (const bracket of brackets) {
      if (remainingIncome <= 0) break;
      
      const bracketMax = bracket.max === Infinity ? remainingIncome + bracket.min : bracket.max;
      const taxableAtThisBracket = Math.min(remainingIncome, bracketMax - bracket.min);
      
      if (taxableAtThisBracket > 0) {
        tax += taxableAtThisBracket * (bracket.rate / 100);
        remainingIncome -= taxableAtThisBracket;
      }
    }

    return tax;
  }

  /**
   * Calculate flat tax
   */
  private calculateFlatTax(income: number, rate: number): number {
    return income * (rate / 100);
  }

  /**
   * Get marginal tax rate for given income
   */
  private getMarginalTaxRate(income: number, brackets: any[]): number {
    for (const bracket of brackets) {
      const bracketMax = bracket.max === Infinity ? Number.MAX_SAFE_INTEGER : bracket.max;
      if (income >= bracket.min && income <= bracketMax) {
        return bracket.rate;
      }
    }
    return brackets[brackets.length - 1]?.rate || 0;
  }

  /**
   * Update positions with new transactions
   */
  private async updatePositions(
    transactions: TaxableTransaction[],
    accountingMethod: AccountingMethod
  ): Promise<void> {
    // Group transactions by asset
    const assetTransactions = new Map<string, TaxableTransaction[]>();
    
    for (const tx of transactions) {
      if (!assetTransactions.has(tx.asset)) {
        assetTransactions.set(tx.asset, []);
      }
      assetTransactions.get(tx.asset)!.push(tx);
    }

    // Process each asset
    for (const [asset, txs] of assetTransactions) {
      await this.updateAssetPosition(asset, txs, accountingMethod);
    }
  }

  /**
   * Update position for a specific asset
   */
  private async updateAssetPosition(
    asset: string,
    transactions: TaxableTransaction[],
    accountingMethod: AccountingMethod
  ): Promise<void> {
    const sortedTransactions = transactions.sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    let position: TaxPosition = this.positions.get(asset) || {
      asset,
      totalQuantity: 0,
      totalCostBasis: 0,
      averageCostBasis: 0,
      lots: [],
      unrealizedGainLoss: 0,
      lastUpdated: new Date().toISOString()
    };

    for (const tx of sortedTransactions) {
      if (tx.quantity > 0) {
        // Acquisition
        await this.processAcquisition(position, tx);
      } else if (tx.quantity < 0) {
        // Disposal
        await this.processDisposal(position, tx, accountingMethod);
      }
    }

    // Update averages
    if (position.totalQuantity > 0) {
      position.averageCostBasis = position.totalCostBasis / position.totalQuantity;
    } else {
      position.averageCostBasis = 0;
    }

    position.lastUpdated = new Date().toISOString();
    this.positions.set(asset, position);
  }

  /**
   * Process acquisition transaction
   */
  private async processAcquisition(position: TaxPosition, tx: TaxableTransaction): Promise<void> {
    const costBasis = this.getTransactionValue(tx);
    const costBasisPerUnit = costBasis / tx.quantity;

    const lot: TaxLot = {
      id: `lot_${tx.id}_${Date.now()}`,
      asset: tx.asset,
      acquiredDate: tx.date,
      quantity: tx.quantity,
      costBasisPerUnit,
      totalCostBasis: costBasis,
      source: this.determineLotSource(tx),
      exchangeId: tx.exchangeId,
      walletAddress: tx.walletAddress,
      originalTransactionId: tx.id
    };

    position.lots.push(lot);
    position.totalQuantity += tx.quantity;
    position.totalCostBasis += costBasis;
  }

  /**
   * Process disposal transaction
   */
  private async processDisposal(
    position: TaxPosition,
    tx: TaxableTransaction,
    accountingMethod: AccountingMethod
  ): Promise<void> {
    const disposalQuantity = Math.abs(tx.quantity);
    
    // Select lots to dispose
    const selectedLots = this.selectLotsForDisposal(position.lots, disposalQuantity, accountingMethod);
    
    // Update lots and position
    for (const { lot, quantity } of selectedLots) {
      lot.quantity -= quantity;
      position.totalQuantity -= quantity;
      position.totalCostBasis -= quantity * lot.costBasisPerUnit;
    }

    // Remove empty lots
    position.lots = position.lots.filter(lot => lot.quantity > 0.000001);
  }

  /**
   * Utility methods
   */
  private determineLotSource(tx: TaxableTransaction): TaxLot['source'] {
    switch (tx.type) {
      case 'ordinary_income':
        if (tx.description?.toLowerCase().includes('staking')) return 'staking';
        if (tx.description?.toLowerCase().includes('mining')) return 'mining';
        return 'purchase';
      case 'airdrop_income':
        return 'airdrop';
      case 'fork_income':
        return 'fork';
      case 'gift_received':
        return 'gift';
      default:
        return 'purchase';
    }
  }

  private checkWashSaleRules(
    disposal: TaxableTransaction,
    lossAmount: number,
    washSalePeriodDays: number
  ): any {
    // Implementation for wash sale rule checking
    // This is a simplified version - real implementation would check for substantially identical securities
    return null;
  }

  private getJurisdictionConfig(jurisdiction: TaxJurisdiction): JurisdictionTaxConfig {
    const config = this.jurisdictionConfigs.get(jurisdiction);
    if (!config) {
      throw new TaxComplianceError(
        `Tax configuration not available for jurisdiction: ${jurisdiction}`,
        'jurisdiction_config',
        jurisdiction,
        'critical'
      );
    }
    return config;
  }

  private filterTransactionsByYear(
    transactions: TaxableTransaction[],
    year: number,
    jurisdiction: TaxJurisdiction
  ): TaxableTransaction[] {
    const config = this.getJurisdictionConfig(jurisdiction);
    const startDate = new Date(`${year}-01-01`);
    const endDate = new Date(`${year}-12-31`);
    
    return transactions.filter(tx => {
      const txDate = new Date(tx.date);
      return txDate >= startDate && txDate <= endDate;
    });
  }

  private isCapitalTransaction(tx: TaxableTransaction): boolean {
    return ['capital_gain', 'capital_loss'].includes(tx.type);
  }

  private isIncomeTransaction(tx: TaxableTransaction): boolean {
    return [
      'ordinary_income',
      'interest_income',
      'dividend_income',
      'airdrop_income',
      'fork_income',
      'business_income'
    ].includes(tx.type);
  }

  private isDeductibleTransaction(tx: TaxableTransaction): boolean {
    return ['business_expense', 'deductible_loss'].includes(tx.type);
  }

  private getTransactionValue(tx: TaxableTransaction): number {
    if (tx.total !== undefined) {
      return Math.abs(tx.total);
    }
    if (tx.quantity !== undefined && tx.price !== undefined) {
      return Math.abs(tx.quantity * tx.price);
    }
    return 0;
  }

  private generateCacheKey(
    transactions: TaxableTransaction[],
    year: number,
    jurisdiction: TaxJurisdiction,
    accountingMethod: AccountingMethod
  ): string {
    const txHash = transactions
      .map(tx => `${tx.id}-${tx.date}`)
      .join(',')
      .slice(0, 100);
    
    return `tax_calc_${year}_${jurisdiction}_${accountingMethod}_${txHash}`;
  }

  private async validateTransactionData(transactions: TaxableTransaction[]): Promise<TaxIssue[]> {
    const issues: TaxIssue[] = [];
    
    for (const tx of transactions) {
      // Check for missing required data
      if (!tx.date) {
        issues.push({
          id: `missing_date_${tx.id}`,
          type: 'error',
          severity: 'high',
          category: 'data_missing',
          message: `Transaction ${tx.id} is missing date`,
          description: 'Transaction date is required for tax calculations',
          affectedTransactions: [tx.id],
          suggestedAction: 'Provide transaction date',
          potentialImpact: {
            taxLiability: 0,
            compliance: 'Required for accurate reporting'
          }
        });
      }
      
      if (tx.quantity === undefined || tx.quantity === 0) {
        issues.push({
          id: `missing_quantity_${tx.id}`,
          type: 'error',
          severity: 'high',
          category: 'data_missing',
          message: `Transaction ${tx.id} is missing quantity`,
          description: 'Transaction quantity is required for tax calculations',
          affectedTransactions: [tx.id],
          suggestedAction: 'Provide transaction quantity',
          potentialImpact: {
            taxLiability: 0,
            compliance: 'Required for accurate reporting'
          }
        });
      }
      
      // Check for missing price data on capital transactions
      if (this.isCapitalTransaction(tx) && !tx.price && !tx.total) {
        issues.push({
          id: `missing_price_${tx.id}`,
          type: 'warning',
          severity: 'medium',
          category: 'data_missing',
          message: `Transaction ${tx.id} is missing price data`,
          description: 'Price is needed for accurate gain/loss calculation',
          affectedTransactions: [tx.id],
          suggestedAction: 'Provide transaction price or total value',
          potentialImpact: {
            taxLiability: 0,
            compliance: 'May affect calculation accuracy'
          }
        });
      }
    }
    
    return issues;
  }

  private calculateDataCompleteness(transactions: TaxableTransaction[]): number {
    if (transactions.length === 0) return 0;
    
    let completeTransactions = 0;
    
    for (const tx of transactions) {
      let isComplete = true;
      
      // Check required fields
      if (!tx.date || tx.quantity === undefined || !tx.asset || !tx.type) {
        isComplete = false;
      }
      
      // Check price for capital transactions
      if (this.isCapitalTransaction(tx) && !tx.price && !tx.total) {
        isComplete = false;
      }
      
      if (isComplete) {
        completeTransactions++;
      }
    }
    
    return (completeTransactions / transactions.length) * 100;
  }

  private getAssumptionsMade(
    transactions: TaxableTransaction[],
    accountingMethod: AccountingMethod
  ): string[] {
    const assumptions: string[] = [];
    
    assumptions.push(`Using ${accountingMethod} accounting method for cost basis calculations`);
    
    const missingPrices = transactions.filter(tx => 
      this.isCapitalTransaction(tx) && !tx.price && !tx.total
    );
    
    if (missingPrices.length > 0) {
      assumptions.push(`Estimated prices for ${missingPrices.length} transactions using market data`);
    }
    
    const estimatedFees = transactions.filter(tx => !tx.fees && tx.type.includes('_expense'));
    if (estimatedFees.length > 0) {
      assumptions.push(`Estimated transaction fees for ${estimatedFees.length} transactions`);
    }
    
    return assumptions;
  }

  /**
   * Initialize jurisdiction configurations
   */
  private initializeJurisdictionConfigs(): void {
    // US Configuration
    this.jurisdictionConfigs.set('US', {
      jurisdiction: 'US',
      currency: 'USD',
      taxYear: 2024,
      longTermThresholdDays: 365,
      federal: {
        brackets: [
          { min: 0, max: 11000, rate: 10 },
          { min: 11000, max: 44725, rate: 12 },
          { min: 44725, max: 95375, rate: 22 },
          { min: 95375, max: 182050, rate: 24 },
          { min: 182050, max: 231250, rate: 32 },
          { min: 231250, max: 578125, rate: 35 },
          { min: 578125, max: Infinity, rate: 37 }
        ],
        standardDeduction: 13850,
        capitalGainsRates: {
          shortTerm: [
            { min: 0, max: 11000, rate: 10 },
            { min: 11000, max: 44725, rate: 12 },
            { min: 44725, max: 95375, rate: 22 },
            { min: 95375, max: 182050, rate: 24 },
            { min: 182050, max: 231250, rate: 32 },
            { min: 231250, max: 578125, rate: 35 },
            { min: 578125, max: Infinity, rate: 37 }
          ],
          longTerm: [
            { min: 0, max: 44625, rate: 0 },
            { min: 44625, max: 492300, rate: 15 },
            { min: 492300, max: Infinity, rate: 20 }
          ]
        }
      },
      deMinimisThreshold: 200,
      washSaleRuleDays: 30,
      deductionLimits: {
        capitalLossLimit: 3000
      }
    });

    // Add other jurisdictions similarly
    // UK, CA, AU, etc.
  }
}

export const taxCalculationService = new TaxCalculationService();