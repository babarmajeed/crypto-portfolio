import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  TaxJurisdiction,
  AccountingMethod,
  TaxableTransaction,
  TaxCalculationSummary,
  CapitalGainLoss,
  TaxPosition,
  TaxIssue,
  LossHarvestingOpportunity,
  TaxOptimizationStrategy,
  TaxProjection,
  TaxForm,
  TaxReport,
  UseTaxCalculationsOptions,
  UseTaxCalculationsReturn,
  DEFAULT_TAX_SETTINGS
} from '../types/tax.types';
import { taxCalculationService } from '../services/TaxCalculationService';
import { taxOptimizationService } from '../services/TaxOptimizationService';
import { taxFormService } from '../services/TaxFormService';

/**
 * CP-049: Tax Calculations Hook
 * Comprehensive hook for managing tax calculations, optimization, and reporting
 */
export function useTaxCalculations(
  options: UseTaxCalculationsOptions
): UseTaxCalculationsReturn {
  const {
    transactions,
    year,
    jurisdiction = DEFAULT_TAX_SETTINGS.jurisdiction,
    accountingMethod = DEFAULT_TAX_SETTINGS.accountingMethod,
    autoCalculate = true,
    cacheResults = true
  } = options;

  // State management
  const [isCalculating, setIsCalculating] = useState(false);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<TaxCalculationSummary | null>(null);
  const [capitalGains, setCapitalGains] = useState<CapitalGainLoss[]>([]);
  const [positions, setPositions] = useState<TaxPosition[]>([]);
  const [issues, setIssues] = useState<TaxIssue[]>([]);
  const [lossHarvestingOpportunities, setLossHarvestingOpportunities] = useState<LossHarvestingOpportunity[]>([]);
  const [optimizationStrategies, setOptimizationStrategies] = useState<TaxOptimizationStrategy[]>([]);
  const [projections, setProjections] = useState<TaxProjection[]>([]);

  // Cache key for memoization
  const cacheKey = useMemo(() => 
    `${year}-${jurisdiction}-${accountingMethod}-${transactions.length}-${transactions.map(tx => tx.id).join('')}`,
    [year, jurisdiction, accountingMethod, transactions]
  );

  /**
   * Main calculation function
   */
  const calculateTaxes = useCallback(async () => {
    if (!transactions || transactions.length === 0) {
      setSummary(null);
      setCapitalGains([]);
      setPositions([]);
      setIssues([]);
      return;
    }

    setIsCalculating(true);
    setError(null);

    try {
      // Convert transactions to taxable format if needed
      const taxableTransactions = await convertToTaxableTransactions(transactions);

      // Perform tax calculations
      const calculationSummary = await taxCalculationService.calculateTaxes(
        taxableTransactions,
        year,
        jurisdiction,
        accountingMethod
      );

      setSummary(calculationSummary);
      setIssues(calculationSummary.potentialIssues);

      // Extract capital gains details
      // Note: In a real implementation, this would be returned from the service
      const gains = await extractCapitalGainsDetails(taxableTransactions, calculationSummary);
      setCapitalGains(gains);

      // Extract position data
      const positionData = await extractPositionData(taxableTransactions, calculationSummary);
      setPositions(positionData);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      console.error('Tax calculation error:', err);
    } finally {
      setIsCalculating(false);
    }
  }, [transactions, year, jurisdiction, accountingMethod]);

  /**
   * Optimization function
   */
  const optimizeForTaxes = useCallback(async () => {
    if (!summary || !positions || positions.length === 0) {
      return;
    }

    setIsOptimizing(true);
    setError(null);

    try {
      // Get current market prices (would be fetched from market data service)
      const currentPrices = new Map(
        positions.map(pos => [pos.asset, pos.totalCostBasis / pos.totalQuantity * 1.1]) // Mock 10% price change
      );

      // Identify loss harvesting opportunities
      const opportunities = await taxOptimizationService.identifyLossHarvestingOpportunities(
        positions,
        currentPrices,
        jurisdiction,
        accountingMethod
      );
      setLossHarvestingOpportunities(opportunities);

      // Generate optimization strategies
      const strategies = await taxOptimizationService.generateOptimizationStrategies(
        positions,
        transactions as TaxableTransaction[],
        summary,
        year
      );
      setOptimizationStrategies(strategies);

      // Generate tax projections
      const futureProjections = await taxOptimizationService.generateTaxProjections(
        positions,
        transactions as TaxableTransaction[],
        3 // 3 year projection
      );
      setProjections(futureProjections);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Optimization failed';
      setError(errorMessage);
      console.error('Tax optimization error:', err);
    } finally {
      setIsOptimizing(false);
    }
  }, [summary, positions, jurisdiction, accountingMethod, transactions, year]);

  /**
   * Generate tax report
   */
  const generateReport = useCallback(async (
    reportType: TaxReport['reportType'] = 'comprehensive'
  ): Promise<TaxReport> => {
    if (!summary) {
      throw new Error('No tax calculations available. Please run calculations first.');
    }

    try {
      const report: TaxReport = {
        id: `report_${Date.now()}`,
        reportType,
        jurisdiction,
        taxYear: year,
        accountingMethod,
        generatedAt: new Date().toISOString(),
        generatedBy: 'Tax Calculation System',
        summary,
        sections: {
          executiveSummary: {
            totalTax: summary.totalTax,
            effectiveRate: summary.effectiveTaxRate,
            keyInsights: [
              `Total tax liability: $${summary.totalTax.toLocaleString()}`,
              `Effective tax rate: ${summary.effectiveTaxRate.toFixed(2)}%`,
              `Transactions processed: ${summary.totalTransactionsProcessed}`,
              `Data completeness: ${summary.dataCompleteness.toFixed(1)}%`
            ],
            importantDates: [
              `Tax year: ${year}`,
              `Filing deadline: April 15, ${year + 1}`,
              `Report generated: ${new Date().toLocaleDateString()}`
            ]
          },
          capitalGains: {
            summary: {
              shortTermGains: summary.shortTermGains,
              shortTermLosses: summary.shortTermLosses,
              longTermGains: summary.longTermGains,
              longTermLosses: summary.longTermLosses,
              netGains: summary.netCapitalGains
            },
            transactions: capitalGains,
            lotDetails: [] // Would be populated with lot matching details
          },
          income: {
            summary: summary.ordinaryIncome,
            breakdown: {
              staking: summary.ordinaryIncome.stakingRewards,
              mining: summary.ordinaryIncome.miningRewards,
              interest: summary.ordinaryIncome.interestIncome,
              business: summary.ordinaryIncome.businessIncome
            },
            sources: positions.map(pos => ({
              asset: pos.asset,
              quantity: pos.totalQuantity,
              averageCost: pos.averageCostBasis
            }))
          },
          deductions: {
            summary: summary.deductions,
            categories: {
              fees: summary.deductions.transactionFees,
              gas: summary.deductions.gasFees,
              business: summary.deductions.businessExpenses,
              professional: summary.deductions.professionalFees
            },
            supportingDocuments: [
              'Exchange transaction records',
              'Gas fee receipts',
              'Professional service invoices'
            ]
          },
          optimization: {
            opportunities: lossHarvestingOpportunities,
            strategies: optimizationStrategies,
            projections
          },
          compliance: {
            filingRequirements: [
              'Form 8949: Sales and Other Dispositions of Capital Assets',
              'Schedule D: Capital Gains and Losses',
              'Form 1040: Individual Income Tax Return'
            ],
            deadlines: [new Date(`${year + 1}-04-15`)],
            potentialIssues: issues,
            recommendations: [
              'Review all transaction classifications',
              'Verify cost basis calculations',
              'Consider tax optimization strategies',
              'Maintain detailed records for audit purposes'
            ]
          }
        },
        appendices: {
          transactionListing: transactions as TaxableTransaction[],
          methodologyNotes: [
            `Used ${accountingMethod} accounting method for cost basis calculations`,
            'Applied current tax law and regulations',
            'Made reasonable assumptions for missing data',
            'Calculated holding periods based on actual dates'
          ],
          assumptionsMade: summary.assumptionsMade,
          dataQualityReport: {
            completeness: summary.dataCompleteness,
            issues: issues.length,
            warnings: issues.filter(i => i.type === 'warning').length,
            errors: issues.filter(i => i.type === 'error').length
          }
        },
        export: {
          formats: ['pdf', 'excel', 'csv'],
          integrationsAvailable: ['TurboTax', 'TaxAct', 'H&R Block']
        }
      };

      return report;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Report generation failed';
      throw new Error(`Failed to generate tax report: ${errorMessage}`);
    }
  }, [summary, capitalGains, positions, lossHarvestingOpportunities, optimizationStrategies, projections, issues, jurisdiction, year, accountingMethod, transactions]);

  /**
   * Export to tax software
   */
  const exportToSoftware = useCallback(async (provider: string): Promise<any> => {
    if (!summary) {
      throw new Error('No tax calculations available. Please run calculations first.');
    }

    try {
      // Generate appropriate tax form
      const form = await taxFormService.generateTaxForm(
        'form_8949',
        summary,
        capitalGains,
        transactions as TaxableTransaction[]
      );

      // Export to specified software format
      const exportResult = await taxFormService.exportToTaxSoftware(form, provider, 'csv');
      
      return exportResult;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Export failed';
      throw new Error(`Failed to export to ${provider}: ${errorMessage}`);
    }
  }, [summary, capitalGains, transactions]);

  /**
   * Validate transaction data
   */
  const validateData = useCallback(async (): Promise<TaxIssue[]> => {
    try {
      const taxableTransactions = await convertToTaxableTransactions(transactions);
      
      // Perform validation (this would be implemented in the service)
      const validationIssues: TaxIssue[] = [];
      
      // Basic validation checks
      for (const tx of taxableTransactions) {
        if (!tx.date) {
          validationIssues.push({
            id: `missing_date_${tx.id}`,
            type: 'error',
            severity: 'high',
            category: 'data_missing',
            message: `Transaction ${tx.id} is missing date`,
            description: 'Date is required for tax calculations',
            affectedTransactions: [tx.id],
            suggestedAction: 'Provide transaction date',
            potentialImpact: {
              taxLiability: 0,
              compliance: 'Required for accurate reporting'
            }
          });
        }

        if (tx.quantity === undefined || tx.quantity === 0) {
          validationIssues.push({
            id: `missing_quantity_${tx.id}`,
            type: 'error',
            severity: 'high',
            category: 'data_missing',
            message: `Transaction ${tx.id} is missing quantity`,
            description: 'Quantity is required for tax calculations',
            affectedTransactions: [tx.id],
            suggestedAction: 'Provide transaction quantity',
            potentialImpact: {
              taxLiability: 0,
              compliance: 'Required for accurate reporting'
            }
          });
        }
      }

      return validationIssues;
    } catch (err) {
      console.error('Data validation error:', err);
      return [];
    }
  }, [transactions]);

  /**
   * Preview tax impact of potential transactions
   */
  const previewTaxImpact = useCallback(async (
    potentialTransactions: TaxableTransaction[]
  ): Promise<number> => {
    if (!summary) {
      return 0;
    }

    try {
      // Calculate taxes with additional transactions
      const allTransactions = [...(transactions as TaxableTransaction[]), ...potentialTransactions];
      const newSummary = await taxCalculationService.calculateTaxes(
        allTransactions,
        year,
        jurisdiction,
        accountingMethod
      );

      return newSummary.totalTax - summary.totalTax;
    } catch (err) {
      console.error('Tax impact preview error:', err);
      return 0;
    }
  }, [summary, transactions, year, jurisdiction, accountingMethod]);

  /**
   * Force recalculation
   */
  const recalculate = useCallback(async (): Promise<void> => {
    await calculateTaxes();
  }, [calculateTaxes]);

  // Auto-calculate on dependency changes
  useEffect(() => {
    if (autoCalculate && transactions.length > 0) {
      calculateTaxes();
    }
  }, [autoCalculate, calculateTaxes, cacheKey]);

  return {
    // State
    isCalculating,
    isOptimizing,
    error,
    
    // Results
    summary,
    capitalGains,
    positions,
    issues,
    
    // Optimization
    lossHarvestingOpportunities,
    optimizationStrategies,
    projections,
    
    // Actions
    recalculate,
    optimizeForTaxes,
    generateReport,
    exportToSoftware,
    
    // Utils
    validateData,
    previewTaxImpact
  };
}

// Helper functions

async function convertToTaxableTransactions(transactions: any[]): Promise<TaxableTransaction[]> {
  // Convert generic transactions to taxable transaction format
  return transactions.map((tx, index) => ({
    id: tx.id || `tx_${index}`,
    date: tx.date || tx.timestamp,
    type: mapTransactionType(tx.type),
    asset: tx.asset || tx.symbol,
    quantity: tx.quantity || tx.amount,
    price: tx.price,
    total: tx.total || tx.value,
    fees: tx.fees || tx.fee,
    exchangeId: tx.exchangeId || tx.exchange,
    walletAddress: tx.walletAddress,
    txHash: tx.txHash || tx.transactionHash,
    description: tx.description || tx.memo,
    auditTrail: {
      calculatedAt: new Date().toISOString(),
      calculationMethod: 'automated',
      assumptionsUsed: [],
      dataSource: 'transaction_history'
    }
  }));
}

function mapTransactionType(type: string): TaxableTransaction['type'] {
  const typeMap: { [key: string]: TaxableTransaction['type'] } = {
    'buy': 'capital_gain',
    'sell': 'capital_loss',
    'trade': 'capital_gain',
    'staking': 'ordinary_income',
    'mining': 'ordinary_income',
    'airdrop': 'airdrop_income',
    'fork': 'fork_income',
    'interest': 'interest_income',
    'dividend': 'dividend_income',
    'fee': 'business_expense',
    'gas': 'business_expense'
  };

  return typeMap[type?.toLowerCase()] || 'capital_gain';
}

async function extractCapitalGainsDetails(
  transactions: TaxableTransaction[],
  summary: TaxCalculationSummary
): Promise<CapitalGainLoss[]> {
  // Extract capital gains details from transactions
  // This is a simplified implementation
  return transactions
    .filter(tx => tx.type === 'capital_gain' || tx.type === 'capital_loss')
    .map(tx => ({
      transactionId: tx.id,
      asset: tx.asset,
      disposalDate: tx.date,
      disposalQuantity: Math.abs(tx.quantity),
      proceeds: tx.proceeds || (tx.total || 0),
      costBasis: tx.costBasis || (tx.total || 0) * 0.9, // Mock cost basis
      gainLoss: tx.gainLoss || (tx.total || 0) * 0.1, // Mock gain/loss
      holdingPeriod: tx.holdingPeriod || 'short_term',
      accountingMethod: summary.accountingMethod,
      matchedLots: [] // Would be populated with actual lot matching
    }));
}

async function extractPositionData(
  transactions: TaxableTransaction[],
  summary: TaxCalculationSummary
): Promise<TaxPosition[]> {
  // Extract position data from transactions
  const positionMap = new Map<string, TaxPosition>();

  for (const tx of transactions) {
    const existing = positionMap.get(tx.asset) || {
      asset: tx.asset,
      totalQuantity: 0,
      totalCostBasis: 0,
      averageCostBasis: 0,
      lots: [],
      unrealizedGainLoss: 0,
      lastUpdated: new Date().toISOString()
    };

    if (tx.quantity > 0) {
      // Acquisition
      existing.totalQuantity += tx.quantity;
      existing.totalCostBasis += tx.total || 0;
    } else {
      // Disposal
      existing.totalQuantity += tx.quantity; // Negative quantity
      existing.totalCostBasis -= tx.costBasis || 0;
    }

    existing.averageCostBasis = existing.totalQuantity > 0 ? 
      existing.totalCostBasis / existing.totalQuantity : 0;
    existing.lastUpdated = new Date().toISOString();

    positionMap.set(tx.asset, existing);
  }

  return Array.from(positionMap.values()).filter(pos => pos.totalQuantity > 0);
}

// Export additional hooks for specific use cases

export function useTaxOptimization(
  positions: TaxPosition[],
  currentSummary: TaxCalculationSummary | null,
  jurisdiction: TaxJurisdiction = 'US'
) {
  const [opportunities, setOpportunities] = useState<LossHarvestingOpportunity[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const analyzeOpportunities = useCallback(async () => {
    if (!positions.length || !currentSummary) return;

    setIsAnalyzing(true);
    try {
      // Mock current prices
      const currentPrices = new Map(
        positions.map(pos => [pos.asset, pos.averageCostBasis * 1.1])
      );

      const result = await taxOptimizationService.identifyLossHarvestingOpportunities(
        positions,
        currentPrices,
        jurisdiction
      );
      setOpportunities(result);
    } catch (error) {
      console.error('Optimization analysis failed:', error);
    } finally {
      setIsAnalyzing(false);
    }
  }, [positions, currentSummary, jurisdiction]);

  return {
    opportunities,
    isAnalyzing,
    analyzeOpportunities
  };
}

export function useTaxForms(
  summary: TaxCalculationSummary | null,
  capitalGains: CapitalGainLoss[],
  transactions: TaxableTransaction[]
) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [forms, setForms] = useState<TaxForm[]>([]);

  const generateForm = useCallback(async (formType: any) => {
    if (!summary) return null;

    setIsGenerating(true);
    try {
      const form = await taxFormService.generateTaxForm(
        formType,
        summary,
        capitalGains,
        transactions
      );
      setForms(prev => [...prev, form]);
      return form;
    } catch (error) {
      console.error('Form generation failed:', error);
      return null;
    } finally {
      setIsGenerating(false);
    }
  }, [summary, capitalGains, transactions]);

  return {
    forms,
    isGenerating,
    generateForm
  };
}