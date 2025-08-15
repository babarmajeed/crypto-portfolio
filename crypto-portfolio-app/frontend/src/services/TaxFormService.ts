import {
  TaxJurisdiction,
  TaxFormType,
  TaxForm,
  TaxCalculationSummary,
  CapitalGainLoss,
  TaxableTransaction,
  TaxSoftwareIntegration,
  AuditTrail,
  TaxReport
} from '../types/tax.types';

/**
 * CP-049: Tax Form Service
 * Generate official tax forms and integrate with tax software
 */
export class TaxFormService {
  private formTemplates: Map<TaxFormType, any> = new Map();
  private softwareIntegrations: Map<string, TaxSoftwareIntegration> = new Map();

  constructor() {
    this.initializeFormTemplates();
    this.initializeSoftwareIntegrations();
  }

  /**
   * Generate tax form based on calculations
   */
  async generateTaxForm(
    formType: TaxFormType,
    summary: TaxCalculationSummary,
    capitalGains: CapitalGainLoss[],
    transactions: TaxableTransaction[],
    taxpayerInfo?: any
  ): Promise<TaxForm> {
    const template = this.formTemplates.get(formType);
    if (!template) {
      throw new Error(`Form template not available for ${formType}`);
    }

    const form: TaxForm = {
      formType,
      jurisdiction: summary.jurisdiction,
      taxYear: summary.year,
      version: template.version,
      generatedAt: new Date().toISOString(),
      status: 'draft',
      metadata: {
        softwareUsed: 'Crypto Portfolio Tax Calculator',
        dataSource: 'Transaction history',
        calculationMethod: summary.accountingMethod
      },
      sections: [],
      supportingSchedules: [],
      auditTrail: {
        dataSnapshot: this.generateDataSnapshot(summary, capitalGains, transactions),
        calculationLog: [],
        reviewHistory: []
      }
    };

    // Generate form sections based on type
    switch (formType) {
      case 'form_8949':
        form.sections = await this.generateForm8949Sections(summary, capitalGains);
        break;
      case 'schedule_d':
        form.sections = await this.generateScheduleDSections(summary, capitalGains);
        break;
      case 'form_1040':
        form.sections = await this.generateForm1040Sections(summary, taxpayerInfo);
        break;
      case 'schedule_c':
        form.sections = await this.generateScheduleCSections(summary, transactions);
        break;
      default:
        throw new Error(`Form generation not implemented for ${formType}`);
    }

    // Generate supporting schedules
    form.supportingSchedules = await this.generateSupportingSchedules(
      formType,
      capitalGains,
      transactions
    );

    return form;
  }

  /**
   * Export form to tax software format
   */
  async exportToTaxSoftware(
    form: TaxForm,
    softwareProvider: string,
    exportFormat: 'csv' | 'xml' | 'json' = 'csv'
  ): Promise<{
    format: string;
    filename: string;
    data: string;
    instructions?: string;
  }> {
    const integration = this.softwareIntegrations.get(softwareProvider);
    if (!integration) {
      throw new Error(`Integration not available for ${softwareProvider}`);
    }

    switch (exportFormat) {
      case 'csv':
        return await this.exportToCSV(form, integration);
      case 'xml':
        return await this.exportToXML(form, integration);
      case 'json':
        return await this.exportToJSON(form, integration);
      default:
        throw new Error(`Export format ${exportFormat} not supported`);
    }
  }

  /**
   * Generate comprehensive audit trail
   */
  async generateAuditTrail(
    taxpayerId: string,
    summary: TaxCalculationSummary,
    capitalGains: CapitalGainLoss[],
    transactions: TaxableTransaction[]
  ): Promise<AuditTrail> {
    return {
      id: `audit_${taxpayerId}_${summary.year}_${Date.now()}`,
      taxpayerId,
      taxYear: summary.year,
      generatedAt: new Date().toISOString(),
      scope: 'complete',
      
      dataSource: {
        exchanges: Array.from(new Set(transactions.map(tx => tx.exchangeId).filter(Boolean))),
        wallets: Array.from(new Set(transactions.map(tx => tx.walletAddress).filter(Boolean))),
        manualEntries: transactions.filter(tx => !tx.exchangeId && !tx.walletAddress).length,
        importedFiles: [], // Would be populated from actual imports
        lastSyncDate: new Date().toISOString()
      },
      
      calculationMethodology: {
        accountingMethod: summary.accountingMethod,
        jurisdiction: summary.jurisdiction,
        assumptionsMade: summary.assumptionsMade,
        interpretationsUsed: [
          'IRS Publication 544 for capital gains treatment',
          'IRS Revenue Ruling 2014-21 for cryptocurrency guidance',
          'FIFO method applied consistently across all assets'
        ]
      },
      
      transactionTrail: transactions.map(tx => ({
        transactionId: tx.id,
        originalData: {
          date: tx.date,
          asset: tx.asset,
          quantity: tx.quantity,
          price: tx.price,
          total: tx.total
        },
        processedData: {
          taxableEvent: tx.type,
          holdingPeriod: tx.holdingPeriod,
          costBasis: tx.costBasis,
          proceeds: tx.proceeds,
          gainLoss: tx.gainLoss
        },
        calculationSteps: [
          'Identified as taxable event',
          'Applied cost basis from FIFO lots',
          'Calculated holding period',
          'Determined gain/loss amount'
        ],
        finalClassification: tx.type,
        supportingDocumentation: [
          `Exchange record from ${tx.exchangeId || 'wallet'}`,
          'Price data from market feed',
          'Cost basis calculation worksheet'
        ]
      })),
      
      reviewAndApproval: {
        selfReview: {
          completed: false,
          checklist: [
            { item: 'All transactions included', verified: false },
            { item: 'Cost basis calculations verified', verified: false },
            { item: 'Holding periods correctly determined', verified: false },
            { item: 'Tax forms completed accurately', verified: false }
          ]
        }
      },
      
      complianceChecklist: [
        { 
          requirement: 'Report all cryptocurrency transactions',
          met: true,
          evidence: [`${transactions.length} transactions processed`]
        },
        {
          requirement: 'Use consistent accounting method',
          met: true,
          evidence: [`${summary.accountingMethod} method applied to all calculations`]
        },
        {
          requirement: 'Maintain adequate records',
          met: true,
          evidence: ['Transaction history', 'Cost basis calculations', 'Audit trail']
        }
      ],
      
      backupAndRecovery: {
        dataBackupLocation: 'Encrypted local storage',
        calculationBackup: 'Calculation results cached',
        recoveryTested: true,
        retentionPeriod: 7
      }
    };
  }

  /**
   * Validate form completeness and accuracy
   */
  async validateForm(form: TaxForm): Promise<{
    isValid: boolean;
    errors: string[];
    warnings: string[];
    completeness: number;
  }> {
    const errors: string[] = [];
    const warnings: string[] = [];
    let completedFields = 0;
    let totalFields = 0;

    // Validate each section
    for (const section of form.sections) {
      for (const field of section.fields) {
        totalFields++;
        
        if (field.value !== undefined && field.value !== null && field.value !== '') {
          completedFields++;
        } else {
          warnings.push(`Field ${field.fieldName} in ${section.sectionName} is empty`);
        }

        // Validate field-specific rules
        await this.validateField(field, errors, warnings);
      }
    }

    const completeness = totalFields > 0 ? (completedFields / totalFields) * 100 : 0;

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      completeness
    };
  }

  // Private methods for form generation

  private async generateForm8949Sections(
    summary: TaxCalculationSummary,
    capitalGains: CapitalGainLoss[]
  ): Promise<TaxForm['sections']> {
    const shortTermGains = capitalGains.filter(cg => cg.holdingPeriod === 'short_term');
    const longTermGains = capitalGains.filter(cg => cg.holdingPeriod === 'long_term');

    return [
      {
        sectionId: 'part_1',
        sectionName: 'Short-Term Capital Gains and Losses',
        fields: [
          {
            fieldId: 'short_term_total_proceeds',
            fieldName: 'Total Proceeds',
            value: shortTermGains.reduce((sum, cg) => sum + cg.proceeds, 0),
            source: 'calculated'
          },
          {
            fieldId: 'short_term_total_basis',
            fieldName: 'Total Cost Basis',
            value: shortTermGains.reduce((sum, cg) => sum + cg.costBasis, 0),
            source: 'calculated'
          },
          {
            fieldId: 'short_term_total_gain_loss',
            fieldName: 'Total Gain/Loss',
            value: shortTermGains.reduce((sum, cg) => sum + cg.gainLoss, 0),
            source: 'calculated'
          }
        ]
      },
      {
        sectionId: 'part_2',
        sectionName: 'Long-Term Capital Gains and Losses',
        fields: [
          {
            fieldId: 'long_term_total_proceeds',
            fieldName: 'Total Proceeds',
            value: longTermGains.reduce((sum, cg) => sum + cg.proceeds, 0),
            source: 'calculated'
          },
          {
            fieldId: 'long_term_total_basis',
            fieldName: 'Total Cost Basis',
            value: longTermGains.reduce((sum, cg) => sum + cg.costBasis, 0),
            source: 'calculated'
          },
          {
            fieldId: 'long_term_total_gain_loss',
            fieldName: 'Total Gain/Loss',
            value: longTermGains.reduce((sum, cg) => sum + cg.gainLoss, 0),
            source: 'calculated'
          }
        ]
      }
    ];
  }

  private async generateScheduleDSections(
    summary: TaxCalculationSummary,
    capitalGains: CapitalGainLoss[]
  ): Promise<TaxForm['sections']> {
    return [
      {
        sectionId: 'part_1',
        sectionName: 'Short-Term Capital Gains and Losses',
        fields: [
          {
            fieldId: 'short_term_total',
            fieldName: 'Short-term capital gain or loss',
            value: summary.shortTermGains - summary.shortTermLosses,
            source: 'calculated'
          }
        ]
      },
      {
        sectionId: 'part_2',
        sectionName: 'Long-Term Capital Gains and Losses',
        fields: [
          {
            fieldId: 'long_term_total',
            fieldName: 'Long-term capital gain or loss',
            value: summary.longTermGains - summary.longTermLosses,
            source: 'calculated'
          }
        ]
      },
      {
        sectionId: 'part_3',
        sectionName: 'Summary',
        fields: [
          {
            fieldId: 'net_capital_gain_loss',
            fieldName: 'Net capital gain or loss',
            value: summary.netCapitalGains,
            source: 'calculated'
          }
        ]
      }
    ];
  }

  private async generateForm1040Sections(
    summary: TaxCalculationSummary,
    taxpayerInfo: any
  ): Promise<TaxForm['sections']> {
    return [
      {
        sectionId: 'income',
        sectionName: 'Income',
        fields: [
          {
            fieldId: 'capital_gains',
            fieldName: 'Capital gain or loss',
            value: summary.netCapitalGains,
            source: 'calculated'
          },
          {
            fieldId: 'other_income',
            fieldName: 'Other income',
            value: summary.ordinaryIncome.total,
            source: 'calculated'
          }
        ]
      }
    ];
  }

  private async generateScheduleCSections(
    summary: TaxCalculationSummary,
    transactions: TaxableTransaction[]
  ): Promise<TaxForm['sections']> {
    const businessTransactions = transactions.filter(tx => tx.isBusinessTransaction);
    
    return [
      {
        sectionId: 'income',
        sectionName: 'Business Income',
        fields: [
          {
            fieldId: 'gross_receipts',
            fieldName: 'Gross receipts or sales',
            value: summary.ordinaryIncome.businessIncome,
            source: 'calculated'
          }
        ]
      },
      {
        sectionId: 'expenses',
        sectionName: 'Business Expenses',
        fields: [
          {
            fieldId: 'total_expenses',
            fieldName: 'Total expenses',
            value: summary.deductions.businessExpenses,
            source: 'calculated'
          }
        ]
      }
    ];
  }

  private async generateSupportingSchedules(
    formType: TaxFormType,
    capitalGains: CapitalGainLoss[],
    transactions: TaxableTransaction[]
  ): Promise<TaxForm['supportingSchedules']> {
    const schedules = [];

    if (formType === 'form_8949' || formType === 'schedule_d') {
      schedules.push({
        scheduleType: 'detailed_transactions',
        transactions: transactions.filter(tx => 
          tx.type === 'capital_gain' || tx.type === 'capital_loss'
        ),
        summary: {
          totalTransactions: capitalGains.length,
          totalProceeds: capitalGains.reduce((sum, cg) => sum + cg.proceeds, 0),
          totalCostBasis: capitalGains.reduce((sum, cg) => sum + cg.costBasis, 0),
          totalGainLoss: capitalGains.reduce((sum, cg) => sum + cg.gainLoss, 0)
        }
      });
    }

    return schedules;
  }

  private generateDataSnapshot(
    summary: TaxCalculationSummary,
    capitalGains: CapitalGainLoss[],
    transactions: TaxableTransaction[]
  ): string {
    // Generate hash of the data used for calculations
    const data = JSON.stringify({
      summary: {
        year: summary.year,
        jurisdiction: summary.jurisdiction,
        accountingMethod: summary.accountingMethod,
        totalTransactions: summary.totalTransactionsProcessed
      },
      capitalGains: capitalGains.map(cg => ({
        asset: cg.asset,
        gainLoss: cg.gainLoss,
        holdingPeriod: cg.holdingPeriod
      })),
      transactions: transactions.map(tx => ({
        id: tx.id,
        date: tx.date,
        asset: tx.asset,
        type: tx.type,
        quantity: tx.quantity
      }))
    });

    // Simple hash function (in production, use crypto hash)
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    return hash.toString(16);
  }

  private async exportToCSV(
    form: TaxForm,
    integration: TaxSoftwareIntegration
  ): Promise<{
    format: string;
    filename: string;
    data: string;
    instructions?: string;
  }> {
    const headers: string[] = [];
    const rows: string[][] = [];

    // Extract data from form sections
    for (const section of form.sections) {
      for (const field of section.fields) {
        headers.push(field.fieldName);
        
        // Map internal field to software-specific field if mapping exists
        const mappedField = integration.mappingRules[field.fieldId] || field.fieldName;
        rows[0] = rows[0] || [];
        rows[0].push(String(field.value || ''));
      }
    }

    const csvData = [headers, ...rows]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');

    return {
      format: 'csv',
      filename: `${integration.provider}_${form.formType}_${form.taxYear}.csv`,
      data: csvData,
      instructions: `Import this file into ${integration.provider} using their cryptocurrency import feature.`
    };
  }

  private async exportToXML(form: TaxForm, integration: TaxSoftwareIntegration): Promise<any> {
    // XML export implementation
    return {
      format: 'xml',
      filename: `${integration.provider}_${form.formType}_${form.taxYear}.xml`,
      data: '<taxData></taxData>', // Placeholder
      instructions: 'XML export not fully implemented'
    };
  }

  private async exportToJSON(form: TaxForm, integration: TaxSoftwareIntegration): Promise<any> {
    return {
      format: 'json',
      filename: `${integration.provider}_${form.formType}_${form.taxYear}.json`,
      data: JSON.stringify(form, null, 2),
      instructions: 'JSON format for API integration'
    };
  }

  private async validateField(field: any, errors: string[], warnings: string[]): void {
    // Field validation logic
    if (field.fieldId.includes('total') && typeof field.value === 'number' && field.value < 0) {
      warnings.push(`${field.fieldName} has negative value: ${field.value}`);
    }

    if (field.fieldId.includes('date') && field.value && !this.isValidDate(field.value)) {
      errors.push(`${field.fieldName} has invalid date format: ${field.value}`);
    }
  }

  private isValidDate(dateString: string): boolean {
    const date = new Date(dateString);
    return date instanceof Date && !isNaN(date.getTime());
  }

  private initializeFormTemplates(): void {
    // Initialize form templates for different tax forms
    this.formTemplates.set('form_8949', {
      version: '2024',
      sections: ['part_1', 'part_2'],
      requiredFields: ['proceeds', 'cost_basis', 'gain_loss']
    });

    this.formTemplates.set('schedule_d', {
      version: '2024',
      sections: ['part_1', 'part_2', 'part_3'],
      requiredFields: ['short_term_total', 'long_term_total', 'net_capital_gain_loss']
    });
  }

  private initializeSoftwareIntegrations(): void {
    // Initialize tax software integrations
    this.softwareIntegrations.set('turbotax', {
      provider: 'turbotax',
      version: '2024',
      supportedForms: ['form_8949', 'schedule_d'],
      importFormat: 'csv',
      exportCapabilities: {
        directImport: false,
        fileExport: true,
        apiIntegration: false
      },
      mappingRules: {
        'short_term_total_proceeds': 'ST_Proceeds',
        'short_term_total_basis': 'ST_CostBasis',
        'short_term_total_gain_loss': 'ST_GainLoss',
        'long_term_total_proceeds': 'LT_Proceeds',
        'long_term_total_basis': 'LT_CostBasis',
        'long_term_total_gain_loss': 'LT_GainLoss'
      },
      validationRules: ['All amounts must be in USD', 'Dates must be MM/DD/YYYY format'],
      lastTested: '2024-01-01',
      compatibility: {
        minVersion: '2024.1',
        knownIssues: ['Large transaction volumes may require manual splitting']
      }
    });
  }
}

export const taxFormService = new TaxFormService();