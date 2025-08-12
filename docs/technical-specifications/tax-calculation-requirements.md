# Tax Calculation Requirements for Crypto Portfolio

## Overview
Comprehensive tax calculation system supporting multiple jurisdictions, tax methods, and compliance requirements for cryptocurrency trading and portfolio management.

## 1. Multi-Jurisdiction Tax Support

### 1.1 United States (US) Requirements

#### Functional Requirements
- **FR-1.1.1**: FIFO, LIFO, and Specific Identification cost basis methods
- **FR-1.1.2**: Short-term vs long-term capital gains classification
- **FR-1.1.3**: IRS Form 8949 and Schedule D generation
- **FR-1.1.4**: Section 1256 contracts handling for futures
- **FR-1.1.5**: Wash sale rule implementation
- **FR-1.1.6**: Mining income calculation at fair market value
- **FR-1.1.7**: Staking rewards as ordinary income
- **FR-1.1.8**: DeFi yield farming tax implications

#### Technical Specification
```typescript
interface USTaxConfig {
  taxYear: number;
  costBasisMethod: 'FIFO' | 'LIFO' | 'SpecificID' | 'HIFO';
  washSaleEnabled: boolean;
  includeStakingRewards: boolean;
  includeMiningIncome: boolean;
  includeAirdrops: boolean;
}

class USTaxCalculator {
  private config: USTaxConfig;
  private transactions: Transaction[] = [];
  private holdings: Map<string, Holding[]> = new Map();
  
  constructor(config: USTaxConfig) {
    this.config = config;
  }
  
  calculateCapitalGains(transactions: Transaction[]): USTaxResult {
    this.transactions = transactions;
    this.processTransactions();
    
    const gains: CapitalGain[] = [];
    const losses: CapitalLoss[] = [];
    const income: TaxableIncome[] = [];
    
    for (const transaction of transactions) {
      if (transaction.type === 'sell' || transaction.type === 'trade') {
        const gainsLosses = this.calculateTransactionGainsLosses(transaction);
        gains.push(...gainsLosses.gains);
        losses.push(...gainsLosses.losses);
      } else if (transaction.type === 'mining' || transaction.type === 'staking') {
        const incomeEntry = this.calculateIncomeEntry(transaction);
        if (incomeEntry) income.push(incomeEntry);
      }
    }
    
    const shortTermGains = gains.filter(g => g.holdingPeriod <= 365);
    const longTermGains = gains.filter(g => g.holdingPeriod > 365);
    const shortTermLosses = losses.filter(l => l.holdingPeriod <= 365);
    const longTermLosses = losses.filter(l => l.holdingPeriod > 365);
    
    return {
      shortTermGains: this.sumGains(shortTermGains),
      longTermGains: this.sumGains(longTermGains),
      shortTermLosses: this.sumLosses(shortTermLosses),
      longTermLosses: this.sumLosses(longTermLosses),
      ordinaryIncome: this.sumIncome(income),
      washSaleAdjustments: this.calculateWashSales(),
      form8949Data: this.generateForm8949Data(gains, losses),
      taxYear: this.config.taxYear,
      calculatedAt: Date.now()
    };
  }
  
  private calculateTransactionGainsLosses(transaction: Transaction): TransactionGainsLosses {
    const holdings = this.holdings.get(transaction.symbol) || [];
    const gains: CapitalGain[] = [];
    const losses: CapitalLoss[] = [];
    
    let remainingQuantity = transaction.quantity;
    
    while (remainingQuantity > 0 && holdings.length > 0) {
      const holding = this.selectHolding(holdings);
      const quantityToUse = Math.min(remainingQuantity, holding.quantity);
      
      const costBasis = holding.costBasis * (quantityToUse / holding.quantity);
      const proceeds = transaction.price * quantityToUse;
      const gainLoss = proceeds - costBasis;
      const holdingPeriod = transaction.timestamp - holding.acquisitionDate;
      
      if (gainLoss >= 0) {
        gains.push({
          symbol: transaction.symbol,
          quantity: quantityToUse,
          costBasis,
          proceeds,
          gainLoss,
          holdingPeriod: Math.floor(holdingPeriod / (24 * 60 * 60 * 1000)),
          acquisitionDate: holding.acquisitionDate,
          disposalDate: transaction.timestamp,
          washSaleApplied: false
        });
      } else {
        losses.push({
          symbol: transaction.symbol,
          quantity: quantityToUse,
          costBasis,
          proceeds,
          gainLoss: Math.abs(gainLoss),
          holdingPeriod: Math.floor(holdingPeriod / (24 * 60 * 60 * 1000)),
          acquisitionDate: holding.acquisitionDate,
          disposalDate: transaction.timestamp,
          washSaleApplied: false
        });
      }
      
      holding.quantity -= quantityToUse;
      remainingQuantity -= quantityToUse;
      
      if (holding.quantity === 0) {
        const index = holdings.indexOf(holding);
        holdings.splice(index, 1);
      }
    }
    
    return { gains, losses };
  }
  
  private selectHolding(holdings: Holding[]): Holding {
    switch (this.config.costBasisMethod) {
      case 'FIFO':
        return holdings.sort((a, b) => a.acquisitionDate - b.acquisitionDate)[0];
      case 'LIFO':
        return holdings.sort((a, b) => b.acquisitionDate - a.acquisitionDate)[0];
      case 'HIFO':
        return holdings.sort((a, b) => (b.costBasis / b.quantity) - (a.costBasis / a.quantity))[0];
      case 'SpecificID':
        // Would need additional UI for user selection
        return holdings[0];
      default:
        return holdings[0];
    }
  }
  
  private calculateWashSales(): WashSaleAdjustment[] {
    if (!this.config.washSaleEnabled) return [];
    
    const adjustments: WashSaleAdjustment[] = [];
    const losses = this.getCapitalLosses();
    
    for (const loss of losses) {
      const washSalePeriodStart = loss.disposalDate - (30 * 24 * 60 * 60 * 1000);
      const washSalePeriodEnd = loss.disposalDate + (30 * 24 * 60 * 60 * 1000);
      
      const substantiallyIdenticalPurchases = this.transactions.filter(t =>
        t.symbol === loss.symbol &&
        t.type === 'buy' &&
        t.timestamp >= washSalePeriodStart &&
        t.timestamp <= washSalePeriodEnd &&
        t.timestamp !== loss.disposalDate
      );
      
      if (substantiallyIdenticalPurchases.length > 0) {
        adjustments.push({
          originalLoss: loss.gainLoss,
          disallowedLoss: loss.gainLoss,
          adjustedBasis: loss.costBasis + loss.gainLoss,
          symbol: loss.symbol,
          washSaleDate: loss.disposalDate
        });
        
        loss.washSaleApplied = true;
      }
    }
    
    return adjustments;
  }
  
  private generateForm8949Data(gains: CapitalGain[], losses: CapitalLoss[]): Form8949Entry[] {
    const entries: Form8949Entry[] = [];
    
    [...gains, ...losses].forEach(item => {
      entries.push({
        description: `${item.quantity} ${item.symbol}`,
        acquisitionDate: new Date(item.acquisitionDate).toLocaleDateString(),
        disposalDate: new Date(item.disposalDate).toLocaleDateString(),
        proceeds: item.proceeds,
        costBasis: item.costBasis,
        adjustments: item.washSaleApplied ? item.gainLoss : 0,
        gainLoss: item.gainLoss * (item instanceof CapitalGain ? 1 : -1)
      });
    });
    
    return entries;
  }
}

interface USTaxResult {
  shortTermGains: number;
  longTermGains: number;
  shortTermLosses: number;
  longTermLosses: number;
  ordinaryIncome: number;
  washSaleAdjustments: WashSaleAdjustment[];
  form8949Data: Form8949Entry[];
  taxYear: number;
  calculatedAt: number;
}

interface CapitalGain {
  symbol: string;
  quantity: number;
  costBasis: number;
  proceeds: number;
  gainLoss: number;
  holdingPeriod: number;
  acquisitionDate: number;
  disposalDate: number;
  washSaleApplied: boolean;
}

interface WashSaleAdjustment {
  originalLoss: number;
  disallowedLoss: number;
  adjustedBasis: number;
  symbol: string;
  washSaleDate: number;
}
```

### 1.2 European Union (EU) Requirements

#### Functional Requirements
- **FR-1.2.1**: MiFID II transaction reporting compliance
- **FR-1.2.2**: VAT handling for crypto-to-fiat transactions
- **FR-1.2.3**: Capital gains tax calculation per member state
- **FR-1.2.4**: Anti-Money Laundering (AML) reporting
- **FR-1.2.5**: GDPR compliance for tax data storage

#### Technical Specification
```typescript
interface EUTaxConfig {
  memberState: EUMemberState;
  vatIncluded: boolean;
  amlReportingEnabled: boolean;
  gdprCompliant: boolean;
}

class EUTaxCalculator {
  private config: EUTaxConfig;
  private memberStateRules: Map<EUMemberState, TaxRules>;
  
  constructor(config: EUTaxConfig) {
    this.config = config;
    this.initializeMemberStateRules();
  }
  
  calculateEUTax(transactions: Transaction[]): EUTaxResult {
    const rules = this.memberStateRules.get(this.config.memberState);
    if (!rules) throw new Error(`Unsupported member state: ${this.config.memberState}`);
    
    const capitalGainsEvents = this.identifyCapitalGainsEvents(transactions);
    const vatEvents = this.identifyVATEvents(transactions);
    
    const capitalGainsTax = this.calculateCapitalGainsTax(capitalGainsEvents, rules);
    const vatLiability = this.calculateVATLiability(vatEvents, rules);
    
    return {
      capitalGainsTax,
      vatLiability,
      memberState: this.config.memberState,
      reportingRequirements: this.generateReportingRequirements(),
      calculatedAt: Date.now()
    };
  }
  
  private calculateCapitalGainsTax(events: CapitalGainsEvent[], rules: TaxRules): CapitalGainsTaxResult {
    let totalGains = 0;
    let totalLosses = 0;
    let exemptGains = 0;
    
    for (const event of events) {
      const holdingPeriod = event.disposalDate - event.acquisitionDate;
      const holdingPeriodYears = holdingPeriod / (365 * 24 * 60 * 60 * 1000);
      
      // Apply holding period exemptions (e.g., Germany's 1-year rule)
      if (holdingPeriodYears >= rules.exemptionHoldingPeriodYears) {
        exemptGains += Math.max(0, event.gainLoss);
        continue;
      }
      
      if (event.gainLoss > 0) {
        totalGains += event.gainLoss;
      } else {
        totalLosses += Math.abs(event.gainLoss);
      }
    }
    
    const netGains = Math.max(0, totalGains - totalLosses);
    const taxableGains = Math.max(0, netGains - rules.annualExemption);
    const taxOwed = taxableGains * rules.capitalGainsTaxRate;
    
    return {
      totalGains,
      totalLosses,
      exemptGains,
      netGains,
      taxableGains,
      taxOwed,
      annualExemptionUsed: Math.min(netGains, rules.annualExemption)
    };
  }
  
  private initializeMemberStateRules(): void {
    this.memberStateRules = new Map([
      ['DE', {
        capitalGainsTaxRate: 0.26375, // 26.375% (including solidarity surcharge)
        vatRate: 0.19,
        exemptionHoldingPeriodYears: 1,
        annualExemption: 600,
        allowsLossCarryForward: true,
        requiresTransactionReporting: true
      }],
      ['FR', {
        capitalGainsTaxRate: 0.30,
        vatRate: 0.20,
        exemptionHoldingPeriodYears: 0,
        annualExemption: 0,
        allowsLossCarryForward: true,
        requiresTransactionReporting: true
      }],
      ['UK', {
        capitalGainsTaxRate: 0.20, // Higher rate, 10% for basic rate
        vatRate: 0.20,
        exemptionHoldingPeriodYears: 0,
        annualExemption: 12300, // 2023-24 allowance
        allowsLossCarryForward: true,
        requiresTransactionReporting: false
      }]
    ]);
  }
}

type EUMemberState = 'DE' | 'FR' | 'UK' | 'ES' | 'IT' | 'NL' | 'BE' | 'AT';

interface TaxRules {
  capitalGainsTaxRate: number;
  vatRate: number;
  exemptionHoldingPeriodYears: number;
  annualExemption: number;
  allowsLossCarryForward: boolean;
  requiresTransactionReporting: boolean;
}
```

### 1.3 Asia-Pacific Region Requirements

#### Functional Requirements
- **FR-1.3.1**: Japanese cryptocurrency tax calculation (up to 55% rate)
- **FR-1.3.2**: Australian CGT with 50% discount for >12 months
- **FR-1.3.3**: Singapore tax-free trading for individuals
- **FR-1.3.4**: South Korean taxation of crypto gains

#### Technical Specification
```typescript
interface APACTaxConfig {
  country: APACCountry;
  residencyStatus: 'resident' | 'non-resident';
  businessTrader: boolean;
}

class APACTaxCalculator {
  private config: APACTaxConfig;
  
  constructor(config: APACTaxConfig) {
    this.config = config;
  }
  
  calculateAPACTax(transactions: Transaction[]): APACTaxResult {
    switch (this.config.country) {
      case 'JP':
        return this.calculateJapaneseTax(transactions);
      case 'AU':
        return this.calculateAustralianTax(transactions);
      case 'SG':
        return this.calculateSingaporeTax(transactions);
      case 'KR':
        return this.calculateKoreanTax(transactions);
      default:
        throw new Error(`Unsupported APAC country: ${this.config.country}`);
    }
  }
  
  private calculateJapaneseTax(transactions: Transaction[]): APACTaxResult {
    // Japan treats crypto as "miscellaneous income" with progressive rates up to 55%
    const gains = this.calculateRealizedGains(transactions, 'average_cost');
    
    const progressiveRates = [
      { threshold: 0, rate: 0.05 },
      { threshold: 1950000, rate: 0.10 },
      { threshold: 3300000, rate: 0.20 },
      { threshold: 6950000, rate: 0.23 },
      { threshold: 9000000, rate: 0.33 },
      { threshold: 18000000, rate: 0.40 },
      { threshold: 40000000, rate: 0.45 }
    ];
    
    const taxOwed = this.calculateProgressiveTax(gains.totalGains, progressiveRates);
    
    return {
      country: 'JP',
      totalGains: gains.totalGains,
      totalLosses: gains.totalLosses,
      taxableIncome: gains.totalGains,
      taxOwed,
      marginalRate: this.getMarginalRate(gains.totalGains, progressiveRates),
      calculatedAt: Date.now()
    };
  }
  
  private calculateAustralianTax(transactions: Transaction[]): APACTaxResult {
    const gains = this.calculateRealizedGains(transactions, 'FIFO');
    
    // 50% CGT discount for assets held > 12 months
    let discountedGains = 0;
    let fullGains = 0;
    
    for (const transaction of transactions) {
      if (transaction.type === 'sell') {
        const holdingPeriod = this.getHoldingPeriod(transaction);
        const gainLoss = this.calculateGainLoss(transaction);
        
        if (gainLoss > 0) {
          if (holdingPeriod > 365 && !this.config.businessTrader) {
            discountedGains += gainLoss * 0.5; // 50% discount
          } else {
            fullGains += gainLoss;
          }
        }
      }
    }
    
    const taxableGains = discountedGains + fullGains;
    
    return {
      country: 'AU',
      totalGains: gains.totalGains,
      totalLosses: gains.totalLosses,
      taxableIncome: taxableGains,
      taxOwed: 0, // Would need marginal tax rates from other income
      marginalRate: 0,
      cgtDiscount: discountedGains,
      calculatedAt: Date.now()
    };
  }
}

type APACCountry = 'JP' | 'AU' | 'SG' | 'KR' | 'HK' | 'TW';

interface APACTaxResult {
  country: APACCountry;
  totalGains: number;
  totalLosses: number;
  taxableIncome: number;
  taxOwed: number;
  marginalRate: number;
  cgtDiscount?: number;
  calculatedAt: number;
}
```

## 2. Cost Basis Calculation Methods

### 2.1 First In, First Out (FIFO)

#### Functional Requirements
- **FR-2.1.1**: Chronological order cost basis calculation
- **FR-2.1.2**: Automatic queue management for holdings
- **FR-2.1.3**: Partial disposal handling
- **FR-2.1.4**: Cross-exchange position tracking

#### Technical Specification
```typescript
class FIFOCalculator {
  private holdings: Map<string, FIFOQueue> = new Map();
  
  processPurchase(symbol: string, quantity: number, price: number, timestamp: number, fees: number): void {
    if (!this.holdings.has(symbol)) {
      this.holdings.set(symbol, new FIFOQueue());
    }
    
    const queue = this.holdings.get(symbol)!;
    const totalCost = (quantity * price) + fees;
    
    queue.enqueue({
      quantity,
      costBasis: totalCost,
      pricePerUnit: totalCost / quantity,
      timestamp,
      remainingQuantity: quantity
    });
  }
  
  processSale(symbol: string, quantity: number, price: number, timestamp: number, fees: number): FIFOSaleResult {
    const queue = this.holdings.get(symbol);
    if (!queue || queue.isEmpty()) {
      throw new Error(`No holdings found for ${symbol}`);
    }
    
    let remainingQuantity = quantity;
    let totalCostBasis = 0;
    let totalProceeds = (quantity * price) - fees;
    const disposals: CostBasisDisposal[] = [];
    
    while (remainingQuantity > 0 && !queue.isEmpty()) {
      const holding = queue.peek()!;
      const quantityToUse = Math.min(remainingQuantity, holding.remainingQuantity);
      
      const proportionalCostBasis = holding.pricePerUnit * quantityToUse;
      totalCostBasis += proportionalCostBasis;
      
      disposals.push({
        quantity: quantityToUse,
        costBasis: proportionalCostBasis,
        acquisitionDate: holding.timestamp,
        holdingPeriod: timestamp - holding.timestamp
      });
      
      holding.remainingQuantity -= quantityToUse;
      remainingQuantity -= quantityToUse;
      
      if (holding.remainingQuantity === 0) {
        queue.dequeue();
      }
    }
    
    if (remainingQuantity > 0) {
      throw new Error(`Insufficient holdings to sell ${quantity} ${symbol}`);
    }
    
    return {
      symbol,
      quantitySold: quantity,
      totalProceeds,
      totalCostBasis,
      gainLoss: totalProceeds - totalCostBasis,
      disposals,
      averageHoldingPeriod: this.calculateAverageHoldingPeriod(disposals),
      timestamp
    };
  }
  
  private calculateAverageHoldingPeriod(disposals: CostBasisDisposal[]): number {
    const totalQuantity = disposals.reduce((sum, d) => sum + d.quantity, 0);
    const weightedHoldingPeriod = disposals.reduce((sum, d) => sum + (d.holdingPeriod * d.quantity), 0);
    return weightedHoldingPeriod / totalQuantity;
  }
}

class FIFOQueue {
  private items: FIFOHolding[] = [];
  
  enqueue(holding: FIFOHolding): void {
    this.items.push(holding);
  }
  
  dequeue(): FIFOHolding | undefined {
    return this.items.shift();
  }
  
  peek(): FIFOHolding | undefined {
    return this.items[0];
  }
  
  isEmpty(): boolean {
    return this.items.length === 0;
  }
}

interface FIFOHolding {
  quantity: number;
  costBasis: number;
  pricePerUnit: number;
  timestamp: number;
  remainingQuantity: number;
}

interface FIFOSaleResult {
  symbol: string;
  quantitySold: number;
  totalProceeds: number;
  totalCostBasis: number;
  gainLoss: number;
  disposals: CostBasisDisposal[];
  averageHoldingPeriod: number;
  timestamp: number;
}
```

### 2.2 Specific Identification

#### Functional Requirements
- **FR-2.2.1**: User-selected lot identification
- **FR-2.2.2**: Tax optimization suggestions
- **FR-2.2.3**: Lot tracking with unique identifiers
- **FR-2.2.4**: UI integration for lot selection

#### Technical Specification
```typescript
class SpecificIdentificationCalculator {
  private lots: Map<string, TaxLot[]> = new Map();
  
  addLot(symbol: string, lot: TaxLot): void {
    if (!this.lots.has(symbol)) {
      this.lots.set(symbol, []);
    }
    
    this.lots.get(symbol)!.push({
      ...lot,
      id: this.generateLotId(),
      remainingQuantity: lot.quantity
    });
  }
  
  selectLotsForSale(symbol: string, quantity: number, strategy?: LotSelectionStrategy): SelectedLots {
    const availableLots = this.lots.get(symbol)?.filter(lot => lot.remainingQuantity > 0) || [];
    
    if (!strategy) {
      // Manual selection - would integrate with UI
      return this.manualLotSelection(availableLots, quantity);
    }
    
    return this.automaticLotSelection(availableLots, quantity, strategy);
  }
  
  private automaticLotSelection(
    lots: TaxLot[],
    quantity: number,
    strategy: LotSelectionStrategy
  ): SelectedLots {
    let sortedLots: TaxLot[];
    
    switch (strategy) {
      case 'tax_loss_harvesting':
        // Select lots with highest cost basis first (minimize gains/maximize losses)
        sortedLots = lots.sort((a, b) => (b.costBasis / b.quantity) - (a.costBasis / a.quantity));
        break;
      case 'long_term_gains':
        // Prefer long-term holdings (> 1 year) for favorable tax treatment
        sortedLots = lots.sort((a, b) => {
          const aIsLongTerm = (Date.now() - a.acquisitionDate) > (365 * 24 * 60 * 60 * 1000);
          const bIsLongTerm = (Date.now() - b.acquisitionDate) > (365 * 24 * 60 * 60 * 1000);
          
          if (aIsLongTerm && !bIsLongTerm) return -1;
          if (!aIsLongTerm && bIsLongTerm) return 1;
          
          // Among long-term, prefer lowest cost basis
          return (a.costBasis / a.quantity) - (b.costBasis / b.quantity);
        });
        break;
      case 'minimize_gain':
        // Select lots with highest cost basis
        sortedLots = lots.sort((a, b) => (b.costBasis / b.quantity) - (a.costBasis / a.quantity));
        break;
      default:
        sortedLots = lots;
    }
    
    const selectedLots: SelectedLot[] = [];
    let remainingQuantity = quantity;
    
    for (const lot of sortedLots) {
      if (remainingQuantity <= 0) break;
      
      const quantityToUse = Math.min(remainingQuantity, lot.remainingQuantity);
      const proportionalCostBasis = (lot.costBasis / lot.quantity) * quantityToUse;
      
      selectedLots.push({
        lotId: lot.id,
        quantity: quantityToUse,
        costBasis: proportionalCostBasis,
        acquisitionDate: lot.acquisitionDate,
        holdingPeriod: Date.now() - lot.acquisitionDate
      });
      
      remainingQuantity -= quantityToUse;
    }
    
    if (remainingQuantity > 0) {
      throw new Error('Insufficient lots to cover sale quantity');
    }
    
    return {
      symbol: lots[0]?.symbol || '',
      selectedLots,
      totalQuantity: quantity,
      totalCostBasis: selectedLots.reduce((sum, lot) => sum + lot.costBasis, 0),
      strategy
    };
  }
  
  private generateLotId(): string {
    return `lot_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

type LotSelectionStrategy = 'tax_loss_harvesting' | 'long_term_gains' | 'minimize_gain' | 'maximize_gain';

interface TaxLot {
  id: string;
  symbol: string;
  quantity: number;
  costBasis: number;
  acquisitionDate: number;
  remainingQuantity: number;
  exchange?: string;
  notes?: string;
}

interface SelectedLots {
  symbol: string;
  selectedLots: SelectedLot[];
  totalQuantity: number;
  totalCostBasis: number;
  strategy?: LotSelectionStrategy;
}

interface SelectedLot {
  lotId: string;
  quantity: number;
  costBasis: number;
  acquisitionDate: number;
  holdingPeriod: number;
}
```

## 3. DeFi and Advanced Transaction Types

### 3.1 Liquidity Pool and Yield Farming

#### Functional Requirements
- **FR-3.1.1**: LP token valuation and cost basis tracking
- **FR-3.1.2**: Impermanent loss calculation for tax purposes
- **FR-3.1.3**: Yield farming rewards as ordinary income
- **FR-3.1.4**: Liquidity mining token distribution handling

#### Technical Specification
```typescript
class DeFiTaxCalculator {
  calculateLiquidityPoolTax(lpEvents: LiquidityPoolEvent[]): DeFiTaxResult {
    const taxEvents: TaxEvent[] = [];
    const lpPositions: Map<string, LPPosition> = new Map();
    
    for (const event of lpEvents) {
      switch (event.type) {
        case 'add_liquidity':
          this.processAddLiquidity(event, lpPositions, taxEvents);
          break;
        case 'remove_liquidity':
          this.processRemoveLiquidity(event, lpPositions, taxEvents);
          break;
        case 'claim_rewards':
          this.processClaimRewards(event, taxEvents);
          break;
        case 'impermanent_loss_realization':
          this.processImpermanentLoss(event, lpPositions, taxEvents);
          break;
      }
    }
    
    return this.summarizeDeFiTax(taxEvents);
  }
  
  private processAddLiquidity(
    event: LiquidityPoolEvent,
    positions: Map<string, LPPosition>,
    taxEvents: TaxEvent[]
  ): void {
    const poolId = `${event.poolAddress}_${event.token0}_${event.token1}`;
    
    // Adding liquidity is typically not a taxable event
    // But we need to track the cost basis of deposited tokens
    
    const position: LPPosition = {
      poolId,
      lpTokens: event.lpTokensReceived!,
      token0Deposited: event.token0Amount!,
      token1Deposited: event.token1Amount!,
      token0CostBasis: this.getCostBasis(event.token0!, event.token0Amount!),
      token1CostBasis: this.getCostBasis(event.token1!, event.token1Amount!),
      timestamp: event.timestamp
    };
    
    positions.set(poolId, position);
    
    // Record as disposal of tokens for LP tokens
    taxEvents.push({
      type: 'disposal',
      symbol: event.token0!,
      quantity: event.token0Amount!,
      proceeds: 0, // No immediate proceeds
      costBasis: position.token0CostBasis,
      gainLoss: 0, // Like-kind exchange treatment (if applicable)
      timestamp: event.timestamp,
      description: 'LP token acquisition'
    });
  }
  
  private processRemoveLiquidity(
    event: LiquidityPoolEvent,
    positions: Map<string, LPPosition>,
    taxEvents: TaxEvent[]
  ): void {
    const poolId = `${event.poolAddress}_${event.token0}_${event.token1}`;
    const position = positions.get(poolId);
    
    if (!position) {
      throw new Error(`No LP position found for pool ${poolId}`);
    }
    
    // Calculate proceeds from removing liquidity
    const token0Value = event.token0Amount! * this.getMarketPrice(event.token0!);
    const token1Value = event.token1Amount! * this.getMarketPrice(event.token1!);
    const totalProceeds = token0Value + token1Value;
    
    // Calculate original cost basis
    const totalCostBasis = position.token0CostBasis + position.token1CostBasis;
    
    // Calculate gain/loss including impermanent loss
    const gainLoss = totalProceeds - totalCostBasis;
    
    taxEvents.push({
      type: 'disposal',
      symbol: 'LP_TOKEN',
      quantity: position.lpTokens,
      proceeds: totalProceeds,
      costBasis: totalCostBasis,
      gainLoss,
      timestamp: event.timestamp,
      description: 'LP token disposal',
      impermanentLoss: this.calculateImpermanentLoss(position, event)
    });
    
    positions.delete(poolId);
  }
  
  private processClaimRewards(event: LiquidityPoolEvent, taxEvents: TaxEvent[]): void {
    // Yield farming rewards are typically ordinary income
    const rewardValue = event.rewardAmount! * this.getMarketPrice(event.rewardToken!);
    
    taxEvents.push({
      type: 'income',
      symbol: event.rewardToken!,
      quantity: event.rewardAmount!,
      proceeds: rewardValue,
      costBasis: rewardValue, // Cost basis equals fair market value at receipt
      gainLoss: 0,
      timestamp: event.timestamp,
      description: 'Yield farming rewards'
    });
  }
  
  private calculateImpermanentLoss(position: LPPosition, event: LiquidityPoolEvent): number {
    // Simplified impermanent loss calculation
    const initialRatio = position.token0Deposited / position.token1Deposited;
    const finalRatio = event.token0Amount! / event.token1Amount!;
    
    const priceRatioChange = Math.abs(finalRatio - initialRatio) / initialRatio;
    const impermanentLossPercent = Math.pow(priceRatioChange, 2) / (1 + priceRatioChange);
    
    const totalInitialValue = position.token0CostBasis + position.token1CostBasis;
    return totalInitialValue * impermanentLossPercent;
  }
  
  private getCostBasis(symbol: string, quantity: number): number {
    // Would integrate with main cost basis tracking system
    return quantity * this.getHistoricalPrice(symbol, Date.now());
  }
  
  private getMarketPrice(symbol: string): number {
    // Would integrate with price feed
    return 0;
  }
  
  private getHistoricalPrice(symbol: string, timestamp: number): number {
    // Would integrate with historical price data
    return 0;
  }
}

interface LiquidityPoolEvent {
  type: 'add_liquidity' | 'remove_liquidity' | 'claim_rewards' | 'impermanent_loss_realization';
  poolAddress: string;
  token0?: string;
  token1?: string;
  token0Amount?: number;
  token1Amount?: number;
  lpTokensReceived?: number;
  rewardToken?: string;
  rewardAmount?: number;
  timestamp: number;
  transactionHash: string;
}

interface LPPosition {
  poolId: string;
  lpTokens: number;
  token0Deposited: number;
  token1Deposited: number;
  token0CostBasis: number;
  token1CostBasis: number;
  timestamp: number;
}

interface DeFiTaxResult {
  totalIncome: number;
  totalGains: number;
  totalLosses: number;
  impermanentLossTotal: number;
  taxableEvents: TaxEvent[];
  calculatedAt: number;
}
```

## 4. Tax Reporting and Compliance

### 4.1 Automated Report Generation

#### Functional Requirements
- **FR-4.1.1**: IRS Form 8949 and Schedule D generation
- **FR-4.1.2**: EU MiFID II transaction reporting
- **FR-4.1.3**: Export formats (PDF, CSV, Excel, TurboTax)
- **FR-4.1.4**: Audit trail documentation

#### Technical Specification
```typescript
class TaxReportGenerator {
  private taxCalculator: ITaxCalculator;
  
  constructor(taxCalculator: ITaxCalculator) {
    this.taxCalculator = taxCalculator;
  }
  
  generateForm8949(taxYear: number, transactions: Transaction[]): Form8949Report {
    const taxResult = this.taxCalculator.calculateTax(transactions);
    
    const shortTermEntries = taxResult.gains
      .filter(g => g.holdingPeriod <= 365)
      .map(g => this.createForm8949Entry(g));
    
    const longTermEntries = taxResult.gains
      .filter(g => g.holdingPeriod > 365)
      .map(g => this.createForm8949Entry(g));
    
    return {
      taxYear,
      shortTermEntries,
      longTermEntries,
      shortTermTotal: this.sumEntries(shortTermEntries),
      longTermTotal: this.sumEntries(longTermEntries),
      generatedAt: Date.now(),
      softwareInfo: 'Crypto Portfolio Tax Calculator v1.0'
    };
  }
  
  generateScheduleD(form8949: Form8949Report): ScheduleDReport {
    return {
      taxYear: form8949.taxYear,
      shortTermCapitalGainLoss: form8949.shortTermTotal.netGainLoss,
      longTermCapitalGainLoss: form8949.longTermTotal.netGainLoss,
      totalCapitalGainLoss: form8949.shortTermTotal.netGainLoss + form8949.longTermTotal.netGainLoss,
      carryoverLoss: this.calculateCarryoverLoss(form8949),
      netCapitalGain: this.calculateNetCapitalGain(form8949),
      generatedAt: Date.now()
    };
  }
  
  exportToTurboTax(taxResult: TaxResult): TurboTaxExport {
    const entries = taxResult.gains.map(gain => ({
      description: `${gain.quantity} ${gain.symbol}`,
      dateAcquired: new Date(gain.acquisitionDate).toLocaleDateString(),
      dateSold: new Date(gain.disposalDate).toLocaleDateString(),
      salesPrice: gain.proceeds,
      costBasis: gain.costBasis,
      adjustments: gain.washSaleApplied ? gain.adjustmentAmount : 0,
      gainLoss: gain.gainLoss
    }));
    
    return {
      version: '2023',
      entries,
      metadata: {
        generatedBy: 'Crypto Portfolio Tax Calculator',
        generatedAt: new Date().toISOString(),
        totalTransactions: entries.length
      }
    };
  }
  
  generateAuditTrail(transactions: Transaction[]): AuditTrailReport {
    return {
      transactions: transactions.map(t => ({
        ...t,
        supportingDocuments: this.getSupportingDocuments(t),
        priceSource: this.getPriceSource(t),
        exchangeConfirmation: t.exchangeConfirmation
      })),
      priceSourceSummary: this.generatePriceSourceSummary(transactions),
      methodologyNotes: this.generateMethodologyNotes(),
      generatedAt: Date.now()
    };
  }
  
  private createForm8949Entry(gain: CapitalGain): Form8949Entry {
    return {
      description: `${gain.quantity} ${gain.symbol}`,
      acquisitionDate: new Date(gain.acquisitionDate).toLocaleDateString(),
      disposalDate: new Date(gain.disposalDate).toLocaleDateString(),
      proceeds: gain.proceeds,
      costBasis: gain.costBasis,
      adjustments: gain.washSaleApplied ? gain.adjustmentAmount || 0 : 0,
      gainLoss: gain.gainLoss
    };
  }
}

interface Form8949Report {
  taxYear: number;
  shortTermEntries: Form8949Entry[];
  longTermEntries: Form8949Entry[];
  shortTermTotal: Form8949Summary;
  longTermTotal: Form8949Summary;
  generatedAt: number;
  softwareInfo: string;
}

interface Form8949Entry {
  description: string;
  acquisitionDate: string;
  disposalDate: string;
  proceeds: number;
  costBasis: number;
  adjustments: number;
  gainLoss: number;
}

interface Form8949Summary {
  totalProceeds: number;
  totalCostBasis: number;
  totalAdjustments: number;
  netGainLoss: number;
}
```

## 5. Integration and API Requirements

### 5.1 Exchange API Integration

#### Functional Requirements
- **FR-5.1.1**: Automated transaction import from major exchanges
- **FR-5.1.2**: Real-time price feed integration
- **FR-5.1.3**: API rate limiting and error handling
- **FR-5.1.4**: Data validation and reconciliation

#### Technical Specification
```typescript
interface ExchangeIntegration {
  exchangeId: string;
  apiKey: string;
  apiSecret: string;
  passphrase?: string;
  sandbox: boolean;
}

class ExchangeTaxDataImporter {
  private integrations: Map<string, ExchangeIntegration> = new Map();
  private rateLimiters: Map<string, RateLimiter> = new Map();
  
  async importTransactions(exchangeId: string, startDate: Date, endDate: Date): Promise<Transaction[]> {
    const integration = this.integrations.get(exchangeId);
    if (!integration) {
      throw new Error(`No integration found for exchange ${exchangeId}`);
    }
    
    const rateLimiter = this.rateLimiters.get(exchangeId);
    if (rateLimiter && !rateLimiter.canMakeRequest()) {
      throw new Error(`Rate limit exceeded for ${exchangeId}`);
    }
    
    try {
      const rawTransactions = await this.fetchTransactionsFromExchange(integration, startDate, endDate);
      const normalizedTransactions = this.normalizeTransactions(exchangeId, rawTransactions);
      const validatedTransactions = this.validateTransactions(normalizedTransactions);
      
      return validatedTransactions;
    } catch (error) {
      console.error(`Failed to import transactions from ${exchangeId}:`, error);
      throw error;
    }
  }
  
  private async fetchTransactionsFromExchange(
    integration: ExchangeIntegration,
    startDate: Date,
    endDate: Date
  ): Promise<any[]> {
    switch (integration.exchangeId) {
      case 'binance':
        return this.fetchBinanceTransactions(integration, startDate, endDate);
      case 'coinbase':
        return this.fetchCoinbaseTransactions(integration, startDate, endDate);
      case 'kraken':
        return this.fetchKrakenTransactions(integration, startDate, endDate);
      default:
        throw new Error(`Unsupported exchange: ${integration.exchangeId}`);
    }
  }
  
  private normalizeTransactions(exchangeId: string, rawTransactions: any[]): Transaction[] {
    return rawTransactions.map(raw => {
      switch (exchangeId) {
        case 'binance':
          return this.normalizeBinanceTransaction(raw);
        case 'coinbase':
          return this.normalizeCoinbaseTransaction(raw);
        case 'kraken':
          return this.normalizeKrakenTransaction(raw);
        default:
          throw new Error(`No normalizer for ${exchangeId}`);
      }
    });
  }
  
  private validateTransactions(transactions: Transaction[]): Transaction[] {
    return transactions.filter(transaction => {
      // Validate required fields
      if (!transaction.symbol || !transaction.quantity || !transaction.price) {
        console.warn('Invalid transaction missing required fields:', transaction);
        return false;
      }
      
      // Validate reasonable values
      if (transaction.quantity <= 0 || transaction.price <= 0) {
        console.warn('Invalid transaction with non-positive values:', transaction);
        return false;
      }
      
      // Validate timestamp
      if (!transaction.timestamp || transaction.timestamp > Date.now()) {
        console.warn('Invalid transaction timestamp:', transaction);
        return false;
      }
      
      return true;
    });
  }
}

interface RateLimiter {
  canMakeRequest(): boolean;
  recordRequest(): void;
}
```

## Success Criteria

### Accuracy Requirements
- **Tax calculation accuracy**: 99.99% vs manual calculations
- **Multi-jurisdiction compliance**: 100% regulatory adherence
- **Cost basis tracking**: Zero discrepancies in FIFO/LIFO calculations
- **DeFi transaction handling**: Comprehensive coverage of major protocols

### Performance Requirements
- **Import speed**: < 5 seconds for 10,000 transactions
- **Report generation**: < 10 seconds for annual reports
- **Real-time calculations**: < 100ms for single transaction impact
- **Memory efficiency**: < 500MB for 100,000 transactions

### Compliance Features
- **Audit trail**: Complete documentation for all calculations
- **Data security**: SOC2 Type II compliance for tax data
- **Export formats**: Support for all major tax software
- **Historical accuracy**: 7-year transaction history retention

This comprehensive tax calculation specification ensures compliance across major jurisdictions while providing the flexibility needed for complex cryptocurrency portfolios and DeFi activities.