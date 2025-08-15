import React, { useState, useEffect } from 'react';
import { 
  Box, 
  Tabs, 
  Tab, 
  Paper, 
  Typography, 
  Button, 
  IconButton, 
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Grid,
  Card,
  CardContent,
  CardActions,
  Alert,
  CircularProgress,
  Switch,
  FormControlLabel,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Accordion,
  AccordionSummary,
  AccordionDetails
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Settings as SettingsIcon,
  Download as DownloadIcon,
  Upload as UploadIcon,
  PlayArrow as TrainIcon,
  Analytics as AnalyticsIcon,
  ExpandMore as ExpandMoreIcon,
  Rule as RuleIcon,
  Category as CategoryIcon,
  SmartToy as AIIcon
} from '@mui/icons-material';
import { styled } from '@mui/material/styles';
import { 
  TransactionCategory,
  CategoryRule,
  CategoryType,
  TaxType,
  CategoryTemplate,
  CategorizationSettings,
  CategoryAnalytics
} from '../../types/categorization.types';
import { useCategorization } from '../../hooks/useCategorization';

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
      id={`category-tabpanel-${index}`}
      aria-labelledby={`category-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

const StyledCard = styled(Card)(({ theme }) => ({
  margin: theme.spacing(1),
  transition: 'all 0.3s ease',
  '&:hover': {
    boxShadow: theme.shadows[4],
    transform: 'translateY(-2px)'
  }
}));

const CategoryChip = styled(Chip)(({ theme }) => ({
  margin: theme.spacing(0.5),
  fontWeight: 'bold'
}));

interface CategoryFormData {
  name: string;
  description: string;
  type: CategoryType;
  taxType: TaxType;
  color: string;
  icon: string;
  isDefault: boolean;
  isActive: boolean;
  parentCategoryId?: string;
}

interface RuleFormData {
  name: string;
  description: string;
  priority: number;
  isActive: boolean;
  conditions: any[];
}

export const CategoryManager: React.FC = () => {
  const {
    categories,
    rules,
    templates,
    settings,
    analytics,
    isLoading,
    error,
    createCategory,
    updateCategory,
    deleteCategory,
    createRule,
    updateRule,
    deleteRule,
    createTemplate,
    applyTemplate,
    updateSettings,
    trainMLModel,
    exportCategories,
    importCategories,
    getAnalytics,
    refreshData
  } = useCategorization();

  const [tabValue, setTabValue] = useState(0);
  const [categoryDialog, setCategoryDialog] = useState(false);
  const [ruleDialog, setRuleDialog] = useState(false);
  const [settingsDialog, setSettingsDialog] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<TransactionCategory | null>(null);
  const [selectedRule, setSelectedRule] = useState<CategoryRule | null>(null);
  const [categoryForm, setCategoryForm] = useState<CategoryFormData>({
    name: '',
    description: '',
    type: 'trading',
    taxType: 'taxable',
    color: '#1976d2',
    icon: '',
    isDefault: false,
    isActive: true
  });
  const [ruleForm, setRuleForm] = useState<RuleFormData>({
    name: '',
    description: '',
    priority: 1,
    isActive: true,
    conditions: []
  });
  const [importFile, setImportFile] = useState<File | null>(null);

  useEffect(() => {
    if (tabValue === 3) { // Analytics tab
      getAnalytics();
    }
  }, [tabValue, getAnalytics]);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  // Category Management
  const handleCreateCategory = async () => {
    try {
      await createCategory({
        ...categoryForm,
        rules: []
      });
      setCategoryDialog(false);
      resetCategoryForm();
    } catch (error) {
      console.error('Failed to create category:', error);
    }
  };

  const handleEditCategory = (category: TransactionCategory) => {
    setSelectedCategory(category);
    setCategoryForm({
      name: category.name,
      description: category.description || '',
      type: category.type,
      taxType: category.taxType,
      color: category.color,
      icon: category.icon || '',
      isDefault: category.isDefault,
      isActive: category.isActive,
      parentCategoryId: category.parentCategoryId
    });
    setCategoryDialog(true);
  };

  const handleUpdateCategory = async () => {
    if (!selectedCategory) return;
    
    try {
      await updateCategory(selectedCategory.id, categoryForm);
      setCategoryDialog(false);
      setSelectedCategory(null);
      resetCategoryForm();
    } catch (error) {
      console.error('Failed to update category:', error);
    }
  };

  const handleDeleteCategory = async (categoryId: string) => {
    if (window.confirm('Are you sure you want to delete this category?')) {
      try {
        await deleteCategory(categoryId);
      } catch (error) {
        console.error('Failed to delete category:', error);
      }
    }
  };

  const resetCategoryForm = () => {
    setCategoryForm({
      name: '',
      description: '',
      type: 'trading',
      taxType: 'taxable',
      color: '#1976d2',
      icon: '',
      isDefault: false,
      isActive: true
    });
  };

  // Rule Management
  const handleCreateRule = async () => {
    if (!selectedCategory) return;
    
    try {
      await createRule(selectedCategory.id, ruleForm);
      setRuleDialog(false);
      resetRuleForm();
    } catch (error) {
      console.error('Failed to create rule:', error);
    }
  };

  const handleEditRule = (rule: CategoryRule) => {
    setSelectedRule(rule);
    setRuleForm({
      name: rule.name,
      description: rule.description || '',
      priority: rule.priority,
      isActive: rule.isActive,
      conditions: rule.conditions
    });
    setRuleDialog(true);
  };

  const handleUpdateRule = async () => {
    if (!selectedRule) return;
    
    try {
      await updateRule(selectedRule.id, ruleForm);
      setRuleDialog(false);
      setSelectedRule(null);
      resetRuleForm();
    } catch (error) {
      console.error('Failed to update rule:', error);
    }
  };

  const handleDeleteRule = async (ruleId: string) => {
    if (window.confirm('Are you sure you want to delete this rule?')) {
      try {
        await deleteRule(ruleId);
      } catch (error) {
        console.error('Failed to delete rule:', error);
      }
    }
  };

  const resetRuleForm = () => {
    setRuleForm({
      name: '',
      description: '',
      priority: 1,
      isActive: true,
      conditions: []
    });
  };

  // Settings Management
  const handleUpdateSettings = async (key: keyof CategorizationSettings, value: any) => {
    try {
      await updateSettings({ [key]: value });
    } catch (error) {
      console.error('Failed to update settings:', error);
    }
  };

  // Template Management
  const handleApplyTemplate = async (templateId: string) => {
    try {
      await applyTemplate(templateId);
    } catch (error) {
      console.error('Failed to apply template:', error);
    }
  };

  // Export/Import
  const handleExportCategories = async () => {
    try {
      const data = await exportCategories();
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `categories-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to export categories:', error);
    }
  };

  const handleImportCategories = async () => {
    if (!importFile) return;
    
    try {
      const text = await importFile.text();
      await importCategories(text);
      setImportFile(null);
    } catch (error) {
      console.error('Failed to import categories:', error);
    }
  };

  // Training
  const handleTrainModel = async () => {
    try {
      await trainMLModel();
    } catch (error) {
      console.error('Failed to train model:', error);
    }
  };

  const getCategoryTypeColor = (type: CategoryType): string => {
    const colors = {
      trading: '#2196F3',
      investment: '#4CAF50',
      income: '#FF9800',
      expense: '#F44336',
      transfer: '#9C27B0',
      staking: '#00BCD4',
      mining: '#795548',
      defi: '#E91E63',
      nft: '#FF5722',
      other: '#607D8B'
    };
    return colors[type] || colors.other;
  };

  const getTaxTypeLabel = (type: TaxType): string => {
    const labels = {
      taxable: 'Taxable',
      tax_deferred: 'Tax Deferred',
      tax_free: 'Tax Free',
      non_taxable: 'Non-Taxable'
    };
    return labels[type] || type;
  };

  if (isLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" height="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Paper sx={{ width: '100%', minHeight: '600px' }}>
      {error && (
        <Alert severity="error" sx={{ m: 2 }}>
          {error}
        </Alert>
      )}

      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs value={tabValue} onChange={handleTabChange} aria-label="category manager tabs">
          <Tab label="Categories" icon={<CategoryIcon />} />
          <Tab label="Rules" icon={<RuleIcon />} />
          <Tab label="Templates" icon={<AddIcon />} />
          <Tab label="Analytics" icon={<AnalyticsIcon />} />
          <Tab label="Settings" icon={<SettingsIcon />} />
        </Tabs>
      </Box>

      {/* Categories Tab */}
      <TabPanel value={tabValue} index={0}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h6">Categories ({categories.length})</Typography>
          <Box>
            <Button
              startIcon={<AddIcon />}
              variant="contained"
              onClick={() => setCategoryDialog(true)}
              sx={{ mr: 1 }}
            >
              Add Category
            </Button>
            <Button
              startIcon={<DownloadIcon />}
              variant="outlined"
              onClick={handleExportCategories}
              sx={{ mr: 1 }}
            >
              Export
            </Button>
            <Button
              startIcon={<UploadIcon />}
              variant="outlined"
              component="label"
            >
              Import
              <input
                type="file"
                hidden
                accept=".json"
                onChange={(e) => setImportFile(e.target.files?.[0] || null)}
              />
            </Button>
          </Box>
        </Box>

        <Grid container spacing={2}>
          {categories.map((category) => (
            <Grid item xs={12} sm={6} md={4} key={category.id}>
              <StyledCard>
                <CardContent>
                  <Box display="flex" alignItems="center" mb={1}>
                    <Box
                      width={16}
                      height={16}
                      borderRadius="50%"
                      bgcolor={category.color}
                      mr={1}
                    />
                    <Typography variant="h6" component="div">
                      {category.name}
                    </Typography>
                    {category.isDefault && (
                      <Chip label="Default" size="small" sx={{ ml: 1 }} />
                    )}
                  </Box>
                  
                  <Typography variant="body2" color="text.secondary" mb={1}>
                    {category.description}
                  </Typography>
                  
                  <Box mb={1}>
                    <CategoryChip
                      label={category.type}
                      size="small"
                      style={{ backgroundColor: getCategoryTypeColor(category.type), color: 'white' }}
                    />
                    <CategoryChip
                      label={getTaxTypeLabel(category.taxType)}
                      size="small"
                      variant="outlined"
                    />
                  </Box>
                  
                  <Typography variant="caption" display="block">
                    {category.usage.totalTransactions} transactions • 
                    {category.rules.length} rules
                  </Typography>
                </CardContent>
                
                <CardActions>
                  <IconButton
                    size="small"
                    onClick={() => handleEditCategory(category)}
                  >
                    <EditIcon />
                  </IconButton>
                  <IconButton
                    size="small"
                    onClick={() => handleDeleteCategory(category.id)}
                    disabled={category.isDefault}
                  >
                    <DeleteIcon />
                  </IconButton>
                  <Switch
                    checked={category.isActive}
                    onChange={(e) => updateCategory(category.id, { isActive: e.target.checked })}
                    size="small"
                  />
                </CardActions>
              </StyledCard>
            </Grid>
          ))}
        </Grid>
      </TabPanel>

      {/* Rules Tab */}
      <TabPanel value={tabValue} index={1}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h6">Categorization Rules ({rules.length})</Typography>
          <Button
            startIcon={<AddIcon />}
            variant="contained"
            onClick={() => setRuleDialog(true)}
            disabled={categories.length === 0}
          >
            Add Rule
          </Button>
        </Box>

        {categories.map((category) => (
          <Accordion key={category.id}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Box display="flex" alignItems="center" width="100%">
                <Box
                  width={12}
                  height={12}
                  borderRadius="50%"
                  bgcolor={category.color}
                  mr={1}
                />
                <Typography variant="subtitle1" sx={{ flexGrow: 1 }}>
                  {category.name} ({category.rules.length} rules)
                </Typography>
                <Switch
                  checked={category.isActive}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => updateCategory(category.id, { isActive: e.target.checked })}
                  size="small"
                />
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              <List>
                {category.rules.map((rule) => (
                  <ListItem key={rule.id}>
                    <ListItemText
                      primary={rule.name}
                      secondary={`Priority: ${rule.priority} • ${rule.conditions.length} conditions`}
                    />
                    <ListItemSecondaryAction>
                      <IconButton
                        edge="end"
                        onClick={() => handleEditRule(rule)}
                        sx={{ mr: 1 }}
                      >
                        <EditIcon />
                      </IconButton>
                      <IconButton
                        edge="end"
                        onClick={() => handleDeleteRule(rule.id)}
                      >
                        <DeleteIcon />
                      </IconButton>
                      <Switch
                        checked={rule.isActive}
                        onChange={(e) => updateRule(rule.id, { isActive: e.target.checked })}
                        size="small"
                      />
                    </ListItemSecondaryAction>
                  </ListItem>
                ))}
                {category.rules.length === 0 && (
                  <ListItem>
                    <ListItemText primary="No rules defined for this category" />
                  </ListItem>
                )}
              </List>
            </AccordionDetails>
          </Accordion>
        ))}
      </TabPanel>

      {/* Templates Tab */}
      <TabPanel value={tabValue} index={2}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h6">Category Templates</Typography>
        </Box>

        <Grid container spacing={2}>
          {templates.map((template) => (
            <Grid item xs={12} sm={6} md={4} key={template.id}>
              <StyledCard>
                <CardContent>
                  <Typography variant="h6" component="div">
                    {template.name}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" mb={1}>
                    {template.description}
                  </Typography>
                  <Typography variant="caption">
                    {template.categories.length} categories
                  </Typography>
                </CardContent>
                <CardActions>
                  <Button
                    size="small"
                    onClick={() => handleApplyTemplate(template.id)}
                  >
                    Apply Template
                  </Button>
                </CardActions>
              </StyledCard>
            </Grid>
          ))}
        </Grid>
      </TabPanel>

      {/* Analytics Tab */}
      <TabPanel value={tabValue} index={3}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h6">Categorization Analytics</Typography>
          <Button
            startIcon={<TrainIcon />}
            variant="contained"
            onClick={handleTrainModel}
            startIcon={<AIIcon />}
          >
            Train ML Model
          </Button>
        </Box>

        {analytics && (
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Summary
                  </Typography>
                  <Typography variant="body1">
                    Total Transactions: {analytics.totalTransactions.toLocaleString()}
                  </Typography>
                  <Typography variant="body1">
                    Categorized: {analytics.categorizedTransactions.toLocaleString()} 
                    ({((analytics.categorizedTransactions / analytics.totalTransactions) * 100).toFixed(1)}%)
                  </Typography>
                  <Typography variant="body1">
                    Uncategorized: {analytics.uncategorizedTransactions.toLocaleString()}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Performance
                  </Typography>
                  <Typography variant="body1">
                    Rule Accuracy: {(analytics.ruleAccuracy * 100).toFixed(1)}%
                  </Typography>
                  <Typography variant="body1">
                    ML Accuracy: {(analytics.mlAccuracy * 100).toFixed(1)}%
                  </Typography>
                  <Typography variant="body1">
                    Pattern Match Rate: {(analytics.patternMatchRate * 100).toFixed(1)}%
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        )}
      </TabPanel>

      {/* Settings Tab */}
      <TabPanel value={tabValue} index={4}>
        <Typography variant="h6" gutterBottom>
          Categorization Settings
        </Typography>

        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  General Settings
                </Typography>
                
                <FormControlLabel
                  control={
                    <Switch
                      checked={settings.enableAutoSuggestions}
                      onChange={(e) => handleUpdateSettings('enableAutoSuggestions', e.target.checked)}
                    />
                  }
                  label="Enable Auto Suggestions"
                />
                
                <FormControlLabel
                  control={
                    <Switch
                      checked={settings.enableMLPredictions}
                      onChange={(e) => handleUpdateSettings('enableMLPredictions', e.target.checked)}
                    />
                  }
                  label="Enable ML Predictions"
                />
                
                <FormControlLabel
                  control={
                    <Switch
                      checked={settings.enablePatternRecognition}
                      onChange={(e) => handleUpdateSettings('enablePatternRecognition', e.target.checked)}
                    />
                  }
                  label="Enable Pattern Recognition"
                />
                
                <FormControlLabel
                  control={
                    <Switch
                      checked={settings.autoApplyRules}
                      onChange={(e) => handleUpdateSettings('autoApplyRules', e.target.checked)}
                    />
                  }
                  label="Auto Apply Rules"
                />
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Advanced Settings
                </Typography>
                
                <TextField
                  fullWidth
                  label="Suggestion Threshold"
                  type="number"
                  value={settings.suggestionThreshold}
                  onChange={(e) => handleUpdateSettings('suggestionThreshold', parseFloat(e.target.value))}
                  inputProps={{ min: 0, max: 1, step: 0.1 }}
                  sx={{ mb: 2 }}
                />
                
                <TextField
                  fullWidth
                  label="Max Suggestions"
                  type="number"
                  value={settings.maxSuggestions}
                  onChange={(e) => handleUpdateSettings('maxSuggestions', parseInt(e.target.value))}
                  inputProps={{ min: 1, max: 10 }}
                  sx={{ mb: 2 }}
                />
                
                <FormControlLabel
                  control={
                    <Switch
                      checked={settings.learningMode}
                      onChange={(e) => handleUpdateSettings('learningMode', e.target.checked)}
                    />
                  }
                  label="Learning Mode"
                />
                
                <FormControlLabel
                  control={
                    <Switch
                      checked={settings.enableAuditLog}
                      onChange={(e) => handleUpdateSettings('enableAuditLog', e.target.checked)}
                    />
                  }
                  label="Enable Audit Log"
                />
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </TabPanel>

      {/* Category Dialog */}
      <Dialog open={categoryDialog} onClose={() => setCategoryDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          {selectedCategory ? 'Edit Category' : 'Create New Category'}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Name"
                value={categoryForm.name}
                onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Color"
                type="color"
                value={categoryForm.color}
                onChange={(e) => setCategoryForm({ ...categoryForm, color: e.target.value })}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Description"
                multiline
                rows={2}
                value={categoryForm.description}
                onChange={(e) => setCategoryForm({ ...categoryForm, description: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Category Type</InputLabel>
                <Select
                  value={categoryForm.type}
                  onChange={(e) => setCategoryForm({ ...categoryForm, type: e.target.value as CategoryType })}
                >
                  <MenuItem value="trading">Trading</MenuItem>
                  <MenuItem value="investment">Investment</MenuItem>
                  <MenuItem value="income">Income</MenuItem>
                  <MenuItem value="expense">Expense</MenuItem>
                  <MenuItem value="transfer">Transfer</MenuItem>
                  <MenuItem value="staking">Staking</MenuItem>
                  <MenuItem value="mining">Mining</MenuItem>
                  <MenuItem value="defi">DeFi</MenuItem>
                  <MenuItem value="nft">NFT</MenuItem>
                  <MenuItem value="other">Other</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Tax Type</InputLabel>
                <Select
                  value={categoryForm.taxType}
                  onChange={(e) => setCategoryForm({ ...categoryForm, taxType: e.target.value as TaxType })}
                >
                  <MenuItem value="taxable">Taxable</MenuItem>
                  <MenuItem value="tax_deferred">Tax Deferred</MenuItem>
                  <MenuItem value="tax_free">Tax Free</MenuItem>
                  <MenuItem value="non_taxable">Non-Taxable</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={categoryForm.isActive}
                    onChange={(e) => setCategoryForm({ ...categoryForm, isActive: e.target.checked })}
                  />
                }
                label="Active"
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={categoryForm.isDefault}
                    onChange={(e) => setCategoryForm({ ...categoryForm, isDefault: e.target.checked })}
                  />
                }
                label="Default Category"
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCategoryDialog(false)}>Cancel</Button>
          <Button
            onClick={selectedCategory ? handleUpdateCategory : handleCreateCategory}
            variant="contained"
          >
            {selectedCategory ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Import Dialog */}
      {importFile && (
        <Dialog open={Boolean(importFile)} onClose={() => setImportFile(null)}>
          <DialogTitle>Import Categories</DialogTitle>
          <DialogContent>
            <Typography>
              Import categories from: {importFile.name}
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setImportFile(null)}>Cancel</Button>
            <Button onClick={handleImportCategories} variant="contained">
              Import
            </Button>
          </DialogActions>
        </Dialog>
      )}
    </Paper>
  );
};