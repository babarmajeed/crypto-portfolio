import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Checkbox,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  LinearProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  Grid,
  Card,
  CardContent,
  IconButton,
  Tooltip,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
  Switch,
  FormControlLabel,
  TextField,
  Autocomplete
} from '@mui/material';
import {
  PlayArrow as ProcessIcon,
  Stop as StopIcon,
  Refresh as RefreshIcon,
  CheckCircle as SuccessIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
  SmartToy as AIIcon,
  Rule as RuleIcon,
  Pattern as PatternIcon,
  Category as CategoryIcon,
  FilterList as FilterIcon,
  Analytics as AnalyticsIcon
} from '@mui/icons-material';
import { styled } from '@mui/material/styles';
import {
  CategorizedTransaction,
  TransactionCategory,
  CategorySuggestion,
  BulkCategorizationOptions,
  BulkCategorizationResult,
  CategorizationMethod,
  CategoryType
} from '../../types/categorization.types';
import { useCategorization, useBulkCategorization } from '../../hooks/useCategorization';

interface BulkCategorizationProps {
  transactions: CategorizedTransaction[];
  onComplete?: (result: BulkCategorizationResult) => void;
}

interface FilterOptions {
  categoryId?: string;
  dateRange?: { start: Date; end: Date };
  amountRange?: { min: number; max: number };
  exchangeId?: string;
  asset?: string;
  type?: string;
  uncategorizedOnly: boolean;
}

const StyledCard = styled(Card)(({ theme }) => ({
  margin: theme.spacing(1),
  transition: 'all 0.3s ease',
  '&:hover': {
    boxShadow: theme.shadows[4]
  }
}));

const ProcessingStep = styled(Box)(({ theme }) => ({
  padding: theme.spacing(2),
  backgroundColor: theme.palette.background.paper,
  borderRadius: theme.shape.borderRadius,
  border: `1px solid ${theme.palette.divider}`
}));

const steps = [
  'Select Transactions',
  'Configure Options',
  'Review & Process',
  'Results'
];

export const BulkCategorization: React.FC<BulkCategorizationProps> = ({
  transactions,
  onComplete
}) => {
  const {
    categories,
    getSuggestions,
    bulkCategorize,
    autoCategorizeAll
  } = useCategorization();

  const {
    isProcessing,
    progress,
    result,
    processBulk,
    reset
  } = useBulkCategorization();

  const [activeStep, setActiveStep] = useState(0);
  const [selectedTransactions, setSelectedTransactions] = useState<string[]>([]);
  const [filteredTransactions, setFilteredTransactions] = useState<CategorizedTransaction[]>([]);
  const [filters, setFilters] = useState<FilterOptions>({
    uncategorizedOnly: true
  });
  const [options, setOptions] = useState<BulkCategorizationOptions>({
    method: 'auto',
    categoryId: '',
    enableRules: true,
    enableML: true,
    enablePatterns: true,
    overrideExisting: false,
    confidenceThreshold: 0.7,
    batchSize: 100,
    maxRetries: 3
  });
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(50);
  const [previewSuggestions, setPreviewSuggestions] = useState<Map<string, CategorySuggestion[]>>(new Map());
  const [showPreview, setShowPreview] = useState(false);

  // Filter transactions based on criteria
  useEffect(() => {
    let filtered = [...transactions];

    if (filters.uncategorizedOnly) {
      filtered = filtered.filter(tx => !tx.categoryId || tx.categoryId.trim() === '');
    }

    if (filters.categoryId) {
      filtered = filtered.filter(tx => tx.categoryId === filters.categoryId);
    }

    if (filters.dateRange) {
      filtered = filtered.filter(tx => {
        const txDate = new Date(tx.timestamp);
        return txDate >= filters.dateRange!.start && txDate <= filters.dateRange!.end;
      });
    }

    if (filters.amountRange) {
      filtered = filtered.filter(tx => {
        const amount = tx.amount || 0;
        return amount >= filters.amountRange!.min && amount <= filters.amountRange!.max;
      });
    }

    if (filters.exchangeId) {
      filtered = filtered.filter(tx => tx.exchangeId === filters.exchangeId);
    }

    if (filters.asset) {
      filtered = filtered.filter(tx => tx.asset === filters.asset);
    }

    if (filters.type) {
      filtered = filtered.filter(tx => tx.type === filters.type);
    }

    setFilteredTransactions(filtered);
  }, [transactions, filters]);

  // Handle select all/none
  const handleSelectAll = () => {
    const currentPageTransactions = filteredTransactions
      .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
      .map(tx => tx.id);
    
    if (selectedTransactions.length === currentPageTransactions.length) {
      setSelectedTransactions([]);
    } else {
      setSelectedTransactions(currentPageTransactions);
    }
  };

  const handleSelectTransaction = (transactionId: string) => {
    setSelectedTransactions(prev => 
      prev.includes(transactionId)
        ? prev.filter(id => id !== transactionId)
        : [...prev, transactionId]
    );
  };

  // Generate preview suggestions
  const generatePreview = useCallback(async () => {
    if (selectedTransactions.length === 0) return;

    setShowPreview(true);
    const suggestions = new Map<string, CategorySuggestion[]>();
    
    const selectedTxs = filteredTransactions.filter(tx => 
      selectedTransactions.includes(tx.id)
    );

    for (const tx of selectedTxs.slice(0, 10)) { // Preview first 10
      try {
        const txSuggestions = await getSuggestions(tx);
        suggestions.set(tx.id, txSuggestions);
      } catch (error) {
        console.error(`Failed to get suggestions for ${tx.id}:`, error);
      }
    }

    setPreviewSuggestions(suggestions);
  }, [selectedTransactions, filteredTransactions, getSuggestions]);

  // Process bulk categorization
  const handleProcessBulk = async () => {
    if (selectedTransactions.length === 0) return;

    try {
      const result = await processBulk(selectedTransactions, options);
      setActiveStep(3); // Move to results step
      onComplete?.(result);
    } catch (error) {
      console.error('Bulk processing failed:', error);
    }
  };

  // Auto categorize all uncategorized
  const handleAutoCategorizeAll = async () => {
    try {
      const uncategorized = transactions.filter(tx => !tx.categoryId);
      const result = await autoCategorizeAll(uncategorized);
      setActiveStep(3);
      onComplete?.(result);
    } catch (error) {
      console.error('Auto categorization failed:', error);
    }
  };

  const getMethodIcon = (method: CategorizationMethod) => {
    switch (method) {
      case 'rule': return <RuleIcon />;
      case 'pattern': return <PatternIcon />;
      case 'ml_classifier': return <AIIcon />;
      default: return <CategoryIcon />;
    }
  };

  const getMethodColor = (method: CategorizationMethod) => {
    switch (method) {
      case 'rule': return 'primary';
      case 'pattern': return 'secondary';
      case 'ml_classifier': return 'success';
      default: return 'default';
    }
  };

  const renderStepContent = (step: number) => {
    switch (step) {
      case 0:
        return (
          <Box>
            <Grid container spacing={2} mb={2}>
              <Grid item xs={12} md={4}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={filters.uncategorizedOnly}
                      onChange={(e) => setFilters({ ...filters, uncategorizedOnly: e.target.checked })}
                    />
                  }
                  label="Uncategorized Only"
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <FormControl fullWidth size="small">
                  <InputLabel>Exchange</InputLabel>
                  <Select
                    value={filters.exchangeId || ''}
                    onChange={(e) => setFilters({ ...filters, exchangeId: e.target.value || undefined })}
                  >
                    <MenuItem value="">All Exchanges</MenuItem>
                    {Array.from(new Set(transactions.map(tx => tx.exchangeId))).map(exchange => (
                      <MenuItem key={exchange} value={exchange}>{exchange}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={4}>
                <Autocomplete
                  size="small"
                  options={Array.from(new Set(transactions.map(tx => tx.asset)))}
                  value={filters.asset || null}
                  onChange={(_, value) => setFilters({ ...filters, asset: value || undefined })}
                  renderInput={(params) => <TextField {...params} label="Asset" />}
                />
              </Grid>
            </Grid>

            <TableContainer component={Paper}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell padding="checkbox">
                      <Checkbox
                        indeterminate={selectedTransactions.length > 0 && selectedTransactions.length < filteredTransactions.length}
                        checked={selectedTransactions.length > 0 && selectedTransactions.length === filteredTransactions.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).length}
                        onChange={handleSelectAll}
                      />
                    </TableCell>
                    <TableCell>Date</TableCell>
                    <TableCell>Type</TableCell>
                    <TableCell>Asset</TableCell>
                    <TableCell>Amount</TableCell>
                    <TableCell>Exchange</TableCell>
                    <TableCell>Category</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredTransactions
                    .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                    .map((transaction) => {
                      const isSelected = selectedTransactions.includes(transaction.id);
                      const category = categories.find(cat => cat.id === transaction.categoryId);
                      
                      return (
                        <TableRow
                          key={transaction.id}
                          selected={isSelected}
                          onClick={() => handleSelectTransaction(transaction.id)}
                          sx={{ cursor: 'pointer' }}
                        >
                          <TableCell padding="checkbox">
                            <Checkbox checked={isSelected} />
                          </TableCell>
                          <TableCell>
                            {new Date(transaction.timestamp).toLocaleDateString()}
                          </TableCell>
                          <TableCell>{transaction.type}</TableCell>
                          <TableCell>{transaction.asset}</TableCell>
                          <TableCell>{transaction.amount?.toFixed(4)}</TableCell>
                          <TableCell>{transaction.exchangeId}</TableCell>
                          <TableCell>
                            {category ? (
                              <Chip 
                                label={category.name} 
                                size="small" 
                                style={{ backgroundColor: category.color, color: 'white' }}
                              />
                            ) : (
                              <Chip label="Uncategorized" size="small" variant="outlined" />
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                </TableBody>
              </Table>
              <TablePagination
                rowsPerPageOptions={[25, 50, 100]}
                component="div"
                count={filteredTransactions.length}
                rowsPerPage={rowsPerPage}
                page={page}
                onPageChange={(_, newPage) => setPage(newPage)}
                onRowsPerPageChange={(e) => setRowsPerPage(parseInt(e.target.value, 10))}
              />
            </TableContainer>

            <Box mt={2} display="flex" justifyContent="space-between" alignItems="center">
              <Typography variant="body2">
                {selectedTransactions.length} of {filteredTransactions.length} transactions selected
              </Typography>
              <Button
                variant="contained"
                onClick={() => setActiveStep(1)}
                disabled={selectedTransactions.length === 0}
              >
                Next
              </Button>
            </Box>
          </Box>
        );

      case 1:
        return (
          <Box>
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <StyledCard>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Categorization Method
                    </Typography>
                    <FormControl fullWidth mb={2}>
                      <InputLabel>Method</InputLabel>
                      <Select
                        value={options.method}
                        onChange={(e) => setOptions({ ...options, method: e.target.value as any })}
                      >
                        <MenuItem value="auto">Auto (Rules → Patterns → ML)</MenuItem>
                        <MenuItem value="rule">Rules Only</MenuItem>
                        <MenuItem value="pattern">Patterns Only</MenuItem>
                        <MenuItem value="ml">ML Only</MenuItem>
                        <MenuItem value="manual">Manual Category</MenuItem>
                      </Select>
                    </FormControl>

                    {options.method === 'manual' && (
                      <FormControl fullWidth>
                        <InputLabel>Category</InputLabel>
                        <Select
                          value={options.categoryId}
                          onChange={(e) => setOptions({ ...options, categoryId: e.target.value })}
                        >
                          {categories.map(category => (
                            <MenuItem key={category.id} value={category.id}>
                              {category.name}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    )}
                  </CardContent>
                </StyledCard>
              </Grid>

              <Grid item xs={12} md={6}>
                <StyledCard>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Processing Options
                    </Typography>
                    
                    <FormControlLabel
                      control={
                        <Switch
                          checked={options.enableRules}
                          onChange={(e) => setOptions({ ...options, enableRules: e.target.checked })}
                        />
                      }
                      label="Enable Rules"
                    />
                    
                    <FormControlLabel
                      control={
                        <Switch
                          checked={options.enableML}
                          onChange={(e) => setOptions({ ...options, enableML: e.target.checked })}
                        />
                      }
                      label="Enable ML Predictions"
                    />
                    
                    <FormControlLabel
                      control={
                        <Switch
                          checked={options.enablePatterns}
                          onChange={(e) => setOptions({ ...options, enablePatterns: e.target.checked })}
                        />
                      }
                      label="Enable Pattern Recognition"
                    />
                    
                    <FormControlLabel
                      control={
                        <Switch
                          checked={options.overrideExisting}
                          onChange={(e) => setOptions({ ...options, overrideExisting: e.target.checked })}
                        />
                      }
                      label="Override Existing Categories"
                    />
                  </CardContent>
                </StyledCard>
              </Grid>

              <Grid item xs={12} md={6}>
                <StyledCard>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Advanced Settings
                    </Typography>
                    
                    <TextField
                      fullWidth
                      label="Confidence Threshold"
                      type="number"
                      value={options.confidenceThreshold}
                      onChange={(e) => setOptions({ ...options, confidenceThreshold: parseFloat(e.target.value) })}
                      inputProps={{ min: 0, max: 1, step: 0.1 }}
                      sx={{ mb: 2 }}
                    />
                    
                    <TextField
                      fullWidth
                      label="Batch Size"
                      type="number"
                      value={options.batchSize}
                      onChange={(e) => setOptions({ ...options, batchSize: parseInt(e.target.value) })}
                      inputProps={{ min: 1, max: 1000 }}
                      sx={{ mb: 2 }}
                    />
                    
                    <TextField
                      fullWidth
                      label="Max Retries"
                      type="number"
                      value={options.maxRetries}
                      onChange={(e) => setOptions({ ...options, maxRetries: parseInt(e.target.value) })}
                      inputProps={{ min: 0, max: 10 }}
                    />
                  </CardContent>
                </StyledCard>
              </Grid>

              <Grid item xs={12} md={6}>
                <StyledCard>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Quick Actions
                    </Typography>
                    
                    <Button
                      fullWidth
                      variant="outlined"
                      startIcon={<AIIcon />}
                      onClick={handleAutoCategorizeAll}
                      sx={{ mb: 1 }}
                    >
                      Auto Categorize All Uncategorized
                    </Button>
                    
                    <Button
                      fullWidth
                      variant="outlined"
                      startIcon={<InfoIcon />}
                      onClick={generatePreview}
                      disabled={selectedTransactions.length === 0}
                    >
                      Preview Suggestions
                    </Button>
                  </CardContent>
                </StyledCard>
              </Grid>
            </Grid>

            <Box mt={2} display="flex" justifyContent="space-between">
              <Button onClick={() => setActiveStep(0)}>Back</Button>
              <Button
                variant="contained"
                onClick={() => setActiveStep(2)}
              >
                Next
              </Button>
            </Box>
          </Box>
        );

      case 2:
        return (
          <Box>
            <Alert severity="info" sx={{ mb: 2 }}>
              Ready to process {selectedTransactions.length} transactions with the selected options.
            </Alert>

            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <StyledCard>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Processing Summary
                    </Typography>
                    <Typography variant="body2">
                      • Transactions: {selectedTransactions.length}
                    </Typography>
                    <Typography variant="body2">
                      • Method: {options.method}
                    </Typography>
                    <Typography variant="body2">
                      • Confidence Threshold: {(options.confidenceThreshold * 100).toFixed(0)}%
                    </Typography>
                    <Typography variant="body2">
                      • Batch Size: {options.batchSize}
                    </Typography>
                  </CardContent>
                </StyledCard>
              </Grid>

              <Grid item xs={12} md={6}>
                <StyledCard>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Enabled Features
                    </Typography>
                    {options.enableRules && (
                      <Chip label="Rules" icon={<RuleIcon />} sx={{ m: 0.5 }} />
                    )}
                    {options.enablePatterns && (
                      <Chip label="Patterns" icon={<PatternIcon />} sx={{ m: 0.5 }} />
                    )}
                    {options.enableML && (
                      <Chip label="ML" icon={<AIIcon />} sx={{ m: 0.5 }} />
                    )}
                    {options.overrideExisting && (
                      <Chip label="Override Existing" color="warning" sx={{ m: 0.5 }} />
                    )}
                  </CardContent>
                </StyledCard>
              </Grid>
            </Grid>

            {isProcessing && (
              <ProcessingStep sx={{ mt: 2 }}>
                <Typography variant="h6" gutterBottom>
                  Processing...
                </Typography>
                <LinearProgress 
                  variant="determinate" 
                  value={progress} 
                  sx={{ mb: 1 }}
                />
                <Typography variant="body2">
                  {progress.toFixed(1)}% complete
                </Typography>
              </ProcessingStep>
            )}

            <Box mt={2} display="flex" justifyContent="space-between">
              <Button 
                onClick={() => setActiveStep(1)}
                disabled={isProcessing}
              >
                Back
              </Button>
              <Button
                variant="contained"
                startIcon={isProcessing ? <StopIcon /> : <ProcessIcon />}
                onClick={handleProcessBulk}
                disabled={selectedTransactions.length === 0}
              >
                {isProcessing ? 'Processing...' : 'Start Processing'}
              </Button>
            </Box>
          </Box>
        );

      case 3:
        return (
          <Box>
            {result && (
              <>
                <Alert 
                  severity={result.errors.length > 0 ? 'warning' : 'success'} 
                  sx={{ mb: 2 }}
                >
                  Processing completed! {result.processed} of {result.total} transactions processed successfully.
                </Alert>

                <Grid container spacing={2}>
                  <Grid item xs={12} md={4}>
                    <StyledCard>
                      <CardContent sx={{ textAlign: 'center' }}>
                        <SuccessIcon color="success" sx={{ fontSize: 48, mb: 1 }} />
                        <Typography variant="h4" color="success.main">
                          {result.processed}
                        </Typography>
                        <Typography variant="body2">
                          Successfully Processed
                        </Typography>
                      </CardContent>
                    </StyledCard>
                  </Grid>

                  <Grid item xs={12} md={4}>
                    <StyledCard>
                      <CardContent sx={{ textAlign: 'center' }}>
                        <ErrorIcon color="error" sx={{ fontSize: 48, mb: 1 }} />
                        <Typography variant="h4" color="error.main">
                          {result.errors.length}
                        </Typography>
                        <Typography variant="body2">
                          Errors
                        </Typography>
                      </CardContent>
                    </StyledCard>
                  </Grid>

                  <Grid item xs={12} md={4}>
                    <StyledCard>
                      <CardContent sx={{ textAlign: 'center' }}>
                        <AnalyticsIcon color="primary" sx={{ fontSize: 48, mb: 1 }} />
                        <Typography variant="h4" color="primary.main">
                          {((result.processed / result.total) * 100).toFixed(1)}%
                        </Typography>
                        <Typography variant="body2">
                          Success Rate
                        </Typography>
                      </CardContent>
                    </StyledCard>
                  </Grid>
                </Grid>

                {result.methodBreakdown && (
                  <StyledCard sx={{ mt: 2 }}>
                    <CardContent>
                      <Typography variant="h6" gutterBottom>
                        Method Breakdown
                      </Typography>
                      <Grid container spacing={2}>
                        {Object.entries(result.methodBreakdown).map(([method, count]) => (
                          <Grid item xs={6} sm={3} key={method}>
                            <Box textAlign="center">
                              {getMethodIcon(method as CategorizationMethod)}
                              <Typography variant="h6">{count}</Typography>
                              <Typography variant="caption">{method}</Typography>
                            </Box>
                          </Grid>
                        ))}
                      </Grid>
                    </CardContent>
                  </StyledCard>
                )}

                {result.errors.length > 0 && (
                  <StyledCard sx={{ mt: 2 }}>
                    <CardContent>
                      <Typography variant="h6" gutterBottom>
                        Processing Errors
                      </Typography>
                      <List dense>
                        {result.errors.slice(0, 10).map((error, index) => (
                          <ListItem key={index}>
                            <ListItemIcon>
                              <ErrorIcon color="error" />
                            </ListItemIcon>
                            <ListItemText
                              primary={error.message}
                              secondary={`Transaction: ${error.transactionId}`}
                            />
                          </ListItem>
                        ))}
                      </List>
                      {result.errors.length > 10 && (
                        <Typography variant="caption">
                          ... and {result.errors.length - 10} more errors
                        </Typography>
                      )}
                    </CardContent>
                  </StyledCard>
                )}

                <Box mt={2} display="flex" justifyContent="space-between">
                  <Button
                    onClick={() => {
                      reset();
                      setActiveStep(0);
                      setSelectedTransactions([]);
                    }}
                  >
                    Start New Process
                  </Button>
                  <Button
                    variant="contained"
                    onClick={() => onComplete?.(result)}
                  >
                    Done
                  </Button>
                </Box>
              </>
            )}
          </Box>
        );

      default:
        return null;
    }
  };

  return (
    <Paper sx={{ p: 3 }}>
      <Typography variant="h5" gutterBottom>
        Bulk Transaction Categorization
      </Typography>
      
      <Stepper activeStep={activeStep} orientation="vertical">
        {steps.map((label, index) => (
          <Step key={label}>
            <StepLabel>{label}</StepLabel>
            <StepContent>
              {renderStepContent(index)}
            </StepContent>
          </Step>
        ))}
      </Stepper>

      {/* Preview Dialog */}
      <Dialog 
        open={showPreview} 
        onClose={() => setShowPreview(false)}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle>Categorization Preview</DialogTitle>
        <DialogContent>
          <Typography variant="body2" gutterBottom>
            Preview showing suggestions for the first 10 selected transactions:
          </Typography>
          
          <List>
            {Array.from(previewSuggestions.entries()).map(([txId, suggestions]) => {
              const transaction = filteredTransactions.find(tx => tx.id === txId);
              if (!transaction) return null;
              
              return (
                <div key={txId}>
                  <ListItem>
                    <ListItemText
                      primary={`${transaction.asset} - ${transaction.amount} (${transaction.type})`}
                      secondary={new Date(transaction.timestamp).toLocaleDateString()}
                    />
                  </ListItem>
                  {suggestions.map((suggestion, idx) => (
                    <ListItem key={idx} sx={{ pl: 4 }}>
                      <ListItemIcon>
                        {getMethodIcon(suggestion.method)}
                      </ListItemIcon>
                      <ListItemText
                        primary={suggestion.categoryName}
                        secondary={`${(suggestion.confidence * 100).toFixed(1)}% confidence - ${suggestion.reasoning}`}
                      />
                      <Chip
                        label={suggestion.method}
                        size="small"
                        color={getMethodColor(suggestion.method) as any}
                      />
                    </ListItem>
                  ))}
                  <Divider />
                </div>
              );
            })}
          </List>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowPreview(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
};