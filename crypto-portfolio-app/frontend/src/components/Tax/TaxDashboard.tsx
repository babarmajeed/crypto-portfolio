import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Tabs,
  Tab,
  Grid,
  Card,
  CardContent,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Alert,
  CircularProgress,
  LinearProgress,
  IconButton,
  Tooltip,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions
} from '@mui/material';
import {
  Assessment as AssessmentIcon,
  Calculate as CalculateIcon,
  Description as ReportIcon,
  TrendingUp as OptimizeIcon,
  Settings as SettingsIcon,
  Download as DownloadIcon,
  Refresh as RefreshIcon,
  Warning as WarningIcon,
  CheckCircle as CheckIcon,
  Error as ErrorIcon,
  Info as InfoIcon,
  AccountBalance as TaxIcon,
  Receipt as ReceiptIcon,
  Schedule as ScheduleIcon
} from '@mui/icons-material';
import { styled } from '@mui/material/styles';
import {
  TaxJurisdiction,
  AccountingMethod,
  TaxDashboardProps,
  SUPPORTED_JURISDICTIONS,
  ACCOUNTING_METHODS
} from '../../types/tax.types';
import { useTaxCalculations, useTaxOptimization } from '../../hooks/useTaxCalculations';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`tax-tabpanel-${index}`}
      aria-labelledby={`tax-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

const StyledCard = styled(Card)(({ theme }) => ({
  height: '100%',
  transition: 'all 0.3s ease',
  '&:hover': {
    boxShadow: theme.shadows[4],
    transform: 'translateY(-2px)'
  }
}));

const MetricCard = styled(Card)<{ severity?: 'success' | 'warning' | 'error' | 'info' }>(({ theme, severity = 'info' }) => ({
  background: severity === 'success' ? 'linear-gradient(135deg, #4CAF5020 0%, #4CAF5005 100%)' :
             severity === 'warning' ? 'linear-gradient(135deg, #FF980020 0%, #FF980005 100%)' :
             severity === 'error' ? 'linear-gradient(135deg, #F4433620 0%, #F4433605 100%)' :
             'linear-gradient(135deg, #2196F320 0%, #2196F305 100%)',
  border: `1px solid ${
    severity === 'success' ? theme.palette.success.light :
    severity === 'warning' ? theme.palette.warning.light :
    severity === 'error' ? theme.palette.error.light :
    theme.palette.info.light
  }40`,
  height: '100%'
}));

export const TaxDashboard: React.FC<TaxDashboardProps> = ({
  transactions,
  defaultYear = new Date().getFullYear(),
  defaultJurisdiction = 'US',
  defaultAccountingMethod = 'FIFO',
  showOptimization = true,
  onExportReport,
  onOptimizationApplied
}) => {
  const [activeTab, setActiveTab] = useState(0);
  const [selectedYear, setSelectedYear] = useState(defaultYear);
  const [jurisdiction, setJurisdiction] = useState<TaxJurisdiction>(defaultJurisdiction);
  const [accountingMethod, setAccountingMethod] = useState<AccountingMethod>(defaultAccountingMethod);
  const [exportDialog, setExportDialog] = useState(false);

  // Tax calculations hook
  const {
    isCalculating,
    isOptimizing,
    error,
    summary,
    capitalGains,
    positions,
    issues,
    lossHarvestingOpportunities,
    optimizationStrategies,
    projections,
    recalculate,
    optimizeForTaxes,
    generateReport,
    exportToSoftware,
    validateData,
    previewTaxImpact
  } = useTaxCalculations({
    transactions,
    year: selectedYear,
    jurisdiction,
    accountingMethod,
    autoCalculate: true
  });

  // Tax optimization hook for additional optimization features
  const {
    opportunities,
    isAnalyzing,
    analyzeOpportunities
  } = useTaxOptimization(positions, summary, jurisdiction);

  const availableYears = Array.from(
    new Set([
      ...transactions.map(tx => new Date(tx.date || tx.timestamp).getFullYear()),
      new Date().getFullYear()
    ])
  ).sort((a, b) => b - a);

  const tabs = [
    { id: 'overview', label: 'Overview', icon: <AssessmentIcon /> },
    { id: 'calculator', label: 'Calculator', icon: <CalculateIcon /> },
    { id: 'reports', label: 'Reports', icon: <ReportIcon /> },
    { id: 'optimization', label: 'Optimization', icon: <OptimizeIcon /> },
    { id: 'forms', label: 'Tax Forms', icon: <ReceiptIcon /> }
  ];

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  const handleRecalculate = async () => {
    await recalculate();
    if (showOptimization) {
      await optimizeForTaxes();
    }
  };

  const handleExportReport = async (format: string) => {
    try {
      const report = await generateReport('comprehensive');
      onExportReport?.(report);
      setExportDialog(false);
    } catch (error) {
      console.error('Export failed:', error);
    }
  };

  const renderOverviewTab = () => (
    <Box>
      {/* Settings Row */}
      <Grid container spacing={2} mb={3}>
        <Grid item xs={12} md={3}>
          <FormControl fullWidth size="small">
            <InputLabel>Tax Year</InputLabel>
            <Select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
            >
              {availableYears.map(year => (
                <MenuItem key={year} value={year}>{year}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={12} md={3}>
          <FormControl fullWidth size="small">
            <InputLabel>Jurisdiction</InputLabel>
            <Select
              value={jurisdiction}
              onChange={(e) => setJurisdiction(e.target.value as TaxJurisdiction)}
            >
              {SUPPORTED_JURISDICTIONS.map(j => (
                <MenuItem key={j.id} value={j.id}>{j.name}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={12} md={3}>
          <FormControl fullWidth size="small">
            <InputLabel>Accounting Method</InputLabel>
            <Select
              value={accountingMethod}
              onChange={(e) => setAccountingMethod(e.target.value as AccountingMethod)}
            >
              {ACCOUNTING_METHODS.map(method => (
                <MenuItem key={method.id} value={method.id}>{method.name}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={12} md={3}>
          <Button
            fullWidth
            variant="contained"
            startIcon={<RefreshIcon />}
            onClick={handleRecalculate}
            disabled={isCalculating}
          >
            {isCalculating ? 'Calculating...' : 'Recalculate'}
          </Button>
        </Grid>
      </Grid>

      {/* Error Display */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* Loading State */}
      {isCalculating && (
        <Box sx={{ mb: 3 }}>
          <LinearProgress />
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Calculating taxes for {selectedYear}...
          </Typography>
        </Box>
      )}

      {/* Key Metrics */}
      {summary && (
        <>
          <Grid container spacing={3} mb={4}>
            <Grid item xs={12} sm={6} md={3}>
              <MetricCard severity={summary.totalTax > 0 ? 'warning' : 'success'}>
                <CardContent sx={{ textAlign: 'center' }}>
                  <TaxIcon sx={{ fontSize: 48, mb: 1, color: 'primary.main' }} />
                  <Typography variant="h4" color="primary.main">
                    ${summary.totalTax.toLocaleString()}
                  </Typography>
                  <Typography variant="h6">
                    Total Tax Liability
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Effective Rate: {summary.effectiveTaxRate.toFixed(2)}%
                  </Typography>
                </CardContent>
              </MetricCard>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <MetricCard severity={summary.netCapitalGains >= 0 ? 'success' : 'info'}>
                <CardContent sx={{ textAlign: 'center' }}>
                  <AssessmentIcon sx={{ fontSize: 48, mb: 1, color: 'success.main' }} />
                  <Typography variant="h4" color={summary.netCapitalGains >= 0 ? 'success.main' : 'info.main'}>
                    ${Math.abs(summary.netCapitalGains).toLocaleString()}
                  </Typography>
                  <Typography variant="h6">
                    Net Capital {summary.netCapitalGains >= 0 ? 'Gains' : 'Losses'}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    ST: ${(summary.shortTermGains - summary.shortTermLosses).toLocaleString()} • 
                    LT: ${(summary.longTermGains - summary.longTermLosses).toLocaleString()}
                  </Typography>
                </CardContent>
              </MetricCard>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <MetricCard severity="info">
                <CardContent sx={{ textAlign: 'center' }}>
                  <ReceiptIcon sx={{ fontSize: 48, mb: 1, color: 'info.main' }} />
                  <Typography variant="h4" color="info.main">
                    ${summary.ordinaryIncome.total.toLocaleString()}
                  </Typography>
                  <Typography variant="h6">
                    Ordinary Income
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Staking: ${summary.ordinaryIncome.stakingRewards.toLocaleString()} • 
                    Mining: ${summary.ordinaryIncome.miningRewards.toLocaleString()}
                  </Typography>
                </CardContent>
              </MetricCard>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <MetricCard severity="success">
                <CardContent sx={{ textAlign: 'center' }}>
                  <CheckIcon sx={{ fontSize: 48, mb: 1, color: 'success.main' }} />
                  <Typography variant="h4" color="success.main">
                    {summary.dataCompleteness.toFixed(1)}%
                  </Typography>
                  <Typography variant="h6">
                    Data Completeness
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {summary.totalTransactionsProcessed} transactions processed
                  </Typography>
                </CardContent>
              </MetricCard>
            </Grid>
          </Grid>

          {/* Issues and Warnings */}
          {issues.length > 0 && (
            <StyledCard sx={{ mb: 3 }}>
              <CardContent>
                <Box display="flex" alignItems="center" mb={2}>
                  <WarningIcon color="warning" sx={{ mr: 1 }} />
                  <Typography variant="h6">
                    Data Quality Issues ({issues.length})
                  </Typography>
                </Box>
                <List dense>
                  {issues.slice(0, 5).map((issue, index) => (
                    <ListItem key={index}>
                      <ListItemIcon>
                        {issue.severity === 'critical' ? <ErrorIcon color="error" /> :
                         issue.severity === 'high' ? <WarningIcon color="warning" /> :
                         <InfoIcon color="info" />}
                      </ListItemIcon>
                      <ListItemText
                        primary={issue.message}
                        secondary={issue.suggestedAction}
                      />
                      <Chip
                        label={issue.severity}
                        size="small"
                        color={issue.severity === 'critical' ? 'error' : 
                               issue.severity === 'high' ? 'warning' : 'info'}
                      />
                    </ListItem>
                  ))}
                </List>
                {issues.length > 5 && (
                  <Typography variant="body2" color="text.secondary">
                    ... and {issues.length - 5} more issues
                  </Typography>
                )}
              </CardContent>
            </StyledCard>
          )}

          {/* Optimization Opportunities Preview */}
          {showOptimization && lossHarvestingOpportunities.length > 0 && (
            <StyledCard sx={{ mb: 3 }}>
              <CardContent>
                <Box display="flex" alignItems="center" justify="space-between" mb={2}>
                  <Box display="flex" alignItems="center">
                    <OptimizeIcon color="primary" sx={{ mr: 1 }} />
                    <Typography variant="h6">
                      Tax Optimization Opportunities
                    </Typography>
                  </Box>
                  <Button
                    size="small"
                    onClick={() => setActiveTab(3)} // Switch to optimization tab
                  >
                    View All
                  </Button>
                </Box>
                <Grid container spacing={2}>
                  {lossHarvestingOpportunities.slice(0, 3).map((opportunity, index) => (
                    <Grid item xs={12} md={4} key={index}>
                      <Card variant="outlined">
                        <CardContent>
                          <Typography variant="subtitle2" gutterBottom>
                            {opportunity.asset}
                          </Typography>
                          <Typography variant="h6" color="success.main">
                            ${opportunity.harvestingStrategy.taxSavings.toFixed(0)} Savings
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            Unrealized Loss: ${opportunity.currentPosition.unrealizedLoss.toFixed(0)}
                          </Typography>
                          <Chip 
                            label={opportunity.priority} 
                            size="small" 
                            color={opportunity.priority === 'high' ? 'success' : 
                                   opportunity.priority === 'medium' ? 'warning' : 'default'}
                            sx={{ mt: 1 }}
                          />
                        </CardContent>
                      </Card>
                    </Grid>
                  ))}
                </Grid>
              </CardContent>
            </StyledCard>
          )}

          {/* Recent Transactions Summary */}
          <StyledCard>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Recent Tax-Relevant Activity
              </Typography>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Date</TableCell>
                      <TableCell>Asset</TableCell>
                      <TableCell>Type</TableCell>
                      <TableCell align="right">Amount</TableCell>
                      <TableCell align="right">Tax Impact</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {transactions.slice(0, 5).map((tx, index) => (
                      <TableRow key={index}>
                        <TableCell>
                          {new Date(tx.date || tx.timestamp).toLocaleDateString()}
                        </TableCell>
                        <TableCell>{tx.asset || tx.symbol}</TableCell>
                        <TableCell>
                          <Chip label={tx.type} size="small" />
                        </TableCell>
                        <TableCell align="right">
                          {tx.quantity || tx.amount} {tx.asset || tx.symbol}
                        </TableCell>
                        <TableCell align="right">
                          <Typography
                            variant="body2"
                            color={tx.type === 'sell' ? 'error' : tx.type === 'buy' ? 'success' : 'text.primary'}
                          >
                            {tx.type === 'sell' ? 'Taxable Event' : 
                             tx.type === 'staking' ? 'Income' : 
                             'Cost Basis'}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </StyledCard>
        </>
      )}

      {/* No Data State */}
      {!summary && !isCalculating && transactions.length === 0 && (
        <Alert severity="info">
          <Typography variant="h6" gutterBottom>
            No Transaction Data
          </Typography>
          <Typography>
            Import your cryptocurrency transactions to begin tax calculations.
          </Typography>
        </Alert>
      )}
    </Box>
  );

  const renderCalculatorTab = () => (
    <Box>
      <Typography variant="h6" gutterBottom>
        Tax Calculator
      </Typography>
      <Alert severity="info" sx={{ mb: 2 }}>
        Advanced tax calculation features are available in the core tax calculation system.
      </Alert>
      {/* Placeholder for detailed calculator interface */}
    </Box>
  );

  const renderReportsTab = () => (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h6">
          Tax Reports
        </Typography>
        <Button
          variant="contained"
          startIcon={<DownloadIcon />}
          onClick={() => setExportDialog(true)}
          disabled={!summary}
        >
          Export Report
        </Button>
      </Box>

      {summary && (
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <StyledCard>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Capital Gains Summary
                </Typography>
                <Table size="small">
                  <TableBody>
                    <TableRow>
                      <TableCell>Short-term Gains</TableCell>
                      <TableCell align="right">${summary.shortTermGains.toLocaleString()}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Short-term Losses</TableCell>
                      <TableCell align="right">-${summary.shortTermLosses.toLocaleString()}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Long-term Gains</TableCell>
                      <TableCell align="right">${summary.longTermGains.toLocaleString()}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Long-term Losses</TableCell>
                      <TableCell align="right">-${summary.longTermLosses.toLocaleString()}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell><strong>Net Capital Gains</strong></TableCell>
                      <TableCell align="right"><strong>${summary.netCapitalGains.toLocaleString()}</strong></TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </StyledCard>
          </Grid>

          <Grid item xs={12} md={6}>
            <StyledCard>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Income Summary
                </Typography>
                <Table size="small">
                  <TableBody>
                    <TableRow>
                      <TableCell>Staking Rewards</TableCell>
                      <TableCell align="right">${summary.ordinaryIncome.stakingRewards.toLocaleString()}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Mining Rewards</TableCell>
                      <TableCell align="right">${summary.ordinaryIncome.miningRewards.toLocaleString()}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Interest Income</TableCell>
                      <TableCell align="right">${summary.ordinaryIncome.interestIncome.toLocaleString()}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Airdrops</TableCell>
                      <TableCell align="right">${summary.ordinaryIncome.airdrops.toLocaleString()}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell><strong>Total Income</strong></TableCell>
                      <TableCell align="right"><strong>${summary.ordinaryIncome.total.toLocaleString()}</strong></TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </StyledCard>
          </Grid>
        </Grid>
      )}
    </Box>
  );

  const renderOptimizationTab = () => (
    <Box>
      <Typography variant="h6" gutterBottom>
        Tax Optimization
      </Typography>
      
      {showOptimization && lossHarvestingOpportunities.length > 0 ? (
        <Grid container spacing={3}>
          {lossHarvestingOpportunities.map((opportunity, index) => (
            <Grid item xs={12} md={6} key={index}>
              <StyledCard>
                <CardContent>
                  <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                    <Typography variant="h6">
                      {opportunity.asset}
                    </Typography>
                    <Chip 
                      label={opportunity.priority} 
                      color={opportunity.priority === 'high' ? 'success' : 
                             opportunity.priority === 'medium' ? 'warning' : 'default'}
                    />
                  </Box>
                  
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Current Position: {opportunity.currentPosition.quantity.toFixed(4)} units
                  </Typography>
                  
                  <Typography variant="body1" gutterBottom>
                    <strong>Potential Tax Savings: ${opportunity.harvestingStrategy.taxSavings.toFixed(0)}</strong>
                  </Typography>
                  
                  <Typography variant="body2" gutterBottom>
                    Unrealized Loss: ${opportunity.currentPosition.unrealizedLoss.toFixed(0)}
                  </Typography>
                  
                  {opportunity.washSaleRisk && (
                    <Alert severity="warning" sx={{ mb: 2 }}>
                      Wash sale risk detected. Wait 31 days before repurchasing.
                    </Alert>
                  )}
                  
                  <List dense>
                    {opportunity.implementation.steps.slice(0, 3).map((step, stepIndex) => (
                      <ListItem key={stepIndex}>
                        <ListItemText primary={step} />
                      </ListItem>
                    ))}
                  </List>
                </CardContent>
              </StyledCard>
            </Grid>
          ))}
        </Grid>
      ) : (
        <Alert severity="info">
          No tax optimization opportunities identified at this time.
        </Alert>
      )}
    </Box>
  );

  const renderFormsTab = () => (
    <Box>
      <Typography variant="h6" gutterBottom>
        Tax Forms
      </Typography>
      <Alert severity="info" sx={{ mb: 2 }}>
        Tax form generation is available through the export functionality.
      </Alert>
      
      {summary && (
        <Grid container spacing={3}>
          <Grid item xs={12} md={4}>
            <StyledCard>
              <CardContent sx={{ textAlign: 'center' }}>
                <ReceiptIcon sx={{ fontSize: 48, mb: 2, color: 'primary.main' }} />
                <Typography variant="h6" gutterBottom>
                  Form 8949
                </Typography>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Sales and Other Dispositions of Capital Assets
                </Typography>
                <Button variant="outlined" disabled>
                  Generate Form
                </Button>
              </CardContent>
            </StyledCard>
          </Grid>
          
          <Grid item xs={12} md={4}>
            <StyledCard>
              <CardContent sx={{ textAlign: 'center' }}>
                <ScheduleIcon sx={{ fontSize: 48, mb: 2, color: 'primary.main' }} />
                <Typography variant="h6" gutterBottom>
                  Schedule D
                </Typography>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Capital Gains and Losses
                </Typography>
                <Button variant="outlined" disabled>
                  Generate Form
                </Button>
              </CardContent>
            </StyledCard>
          </Grid>
        </Grid>
      )}
    </Box>
  );

  return (
    <Paper sx={{ width: '100%', minHeight: '700px' }}>
      {/* Header */}
      <Box sx={{ p: 3, borderBottom: 1, borderColor: 'divider' }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Tax Center
        </Typography>
        <Typography variant="subtitle1" color="text.secondary">
          Comprehensive cryptocurrency tax reporting and optimization for {selectedYear}
        </Typography>
      </Box>

      {/* Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs value={activeTab} onChange={handleTabChange}>
          {tabs.map((tab, index) => (
            <Tab
              key={tab.id}
              label={tab.label}
              icon={tab.icon}
              iconPosition="start"
            />
          ))}
        </Tabs>
      </Box>

      {/* Tab Panels */}
      <TabPanel value={activeTab} index={0}>
        {renderOverviewTab()}
      </TabPanel>
      <TabPanel value={activeTab} index={1}>
        {renderCalculatorTab()}
      </TabPanel>
      <TabPanel value={activeTab} index={2}>
        {renderReportsTab()}
      </TabPanel>
      <TabPanel value={activeTab} index={3}>
        {renderOptimizationTab()}
      </TabPanel>
      <TabPanel value={activeTab} index={4}>
        {renderFormsTab()}
      </TabPanel>

      {/* Export Dialog */}
      <Dialog open={exportDialog} onClose={() => setExportDialog(false)}>
        <DialogTitle>Export Tax Report</DialogTitle>
        <DialogContent>
          <Typography gutterBottom>
            Choose export format:
          </Typography>
          <Box display="flex" flexDirection="column" gap={1}>
            <Button onClick={() => handleExportReport('pdf')}>PDF Report</Button>
            <Button onClick={() => handleExportReport('csv')}>CSV Data</Button>
            <Button onClick={() => handleExportReport('excel')}>Excel Workbook</Button>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setExportDialog(false)}>Cancel</Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
};