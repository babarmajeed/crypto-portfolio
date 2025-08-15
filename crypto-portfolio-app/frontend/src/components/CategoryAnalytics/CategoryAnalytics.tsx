import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Paper,
  Typography,
  Grid,
  Card,
  CardContent,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Alert,
  CircularProgress,
  Button,
  IconButton,
  Tooltip,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Avatar,
  Divider,
  LinearProgress
} from '@mui/material';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  LineChart,
  Line,
  Area,
  AreaChart
} from 'recharts';
import {
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  Analytics as AnalyticsIcon,
  Category as CategoryIcon,
  Assessment as AssessmentIcon,
  Speed as SpeedIcon,
  SmartToy as AIIcon,
  Rule as RuleIcon,
  Pattern as PatternIcon,
  ExpandMore as ExpandMoreIcon,
  Download as DownloadIcon,
  Refresh as RefreshIcon,
  Info as InfoIcon
} from '@mui/icons-material';
import { styled } from '@mui/material/styles';
import {
  CategoryAnalytics as CategoryAnalyticsData,
  TransactionCategory,
  CategoryUsage,
  CategoryType,
  TaxType,
  CategorizationMethod
} from '../../types/categorization.types';
import { useCategorization } from '../../hooks/useCategorization';

interface CategoryAnalyticsProps {
  timeRange?: string;
}

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  color?: string;
  trend?: {
    direction: 'up' | 'down' | 'neutral';
    value: number;
  };
}

const StyledCard = styled(Card)(({ theme }) => ({
  height: '100%',
  transition: 'all 0.3s ease',
  '&:hover': {
    boxShadow: theme.shadows[4],
    transform: 'translateY(-2px)'
  }
}));

const MetricCard = styled(Card)<{ color?: string }>(({ theme, color }) => ({
  background: color ? `linear-gradient(135deg, ${color}20 0%, ${color}05 100%)` : theme.palette.background.paper,
  border: color ? `1px solid ${color}40` : `1px solid ${theme.palette.divider}`,
  height: '100%'
}));

const COLORS = [
  '#0088FE', '#00C49F', '#FFBB28', '#FF8042', 
  '#8884D8', '#82CA9D', '#FFC658', '#FF7C7C',
  '#8DD1E1', '#D084D0', '#87CEEB', '#FFB6C1'
];

const MetricCardComponent: React.FC<MetricCardProps> = ({ 
  title, 
  value, 
  subtitle, 
  icon, 
  color = '#1976d2',
  trend 
}) => (
  <MetricCard color={color}>
    <CardContent>
      <Box display="flex" alignItems="center" justifyContent="space-between">
        <Box>
          <Typography variant="h4" component="div" style={{ color }}>
            {value}
          </Typography>
          <Typography variant="h6" color="text.primary">
            {title}
          </Typography>
          {subtitle && (
            <Typography variant="body2" color="text.secondary">
              {subtitle}
            </Typography>
          )}
          {trend && (
            <Box display="flex" alignItems="center" mt={1}>
              {trend.direction === 'up' ? (
                <TrendingUpIcon color="success" fontSize="small" />
              ) : trend.direction === 'down' ? (
                <TrendingDownIcon color="error" fontSize="small" />
              ) : null}
              <Typography
                variant="caption"
                color={trend.direction === 'up' ? 'success.main' : trend.direction === 'down' ? 'error.main' : 'text.secondary'}
                ml={0.5}
              >
                {trend.value > 0 ? '+' : ''}{trend.value.toFixed(1)}%
              </Typography>
            </Box>
          )}
        </Box>
        <Avatar sx={{ bgcolor: color, width: 56, height: 56 }}>
          {icon}
        </Avatar>
      </Box>
    </CardContent>
  </MetricCard>
);

export const CategoryAnalytics: React.FC<CategoryAnalyticsProps> = ({ 
  timeRange = '30d' 
}) => {
  const {
    categories,
    analytics,
    isLoading,
    error,
    getAnalytics,
    getCategoryUsage
  } = useCategorization();

  const [selectedTimeRange, setSelectedTimeRange] = useState(timeRange);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  useEffect(() => {
    getAnalytics(selectedTimeRange);
  }, [selectedTimeRange, getAnalytics]);

  // Memoized calculations
  const pieChartData = useMemo(() => {
    if (!analytics) return [];
    
    return analytics.categoryBreakdown.map((item, index) => ({
      name: categories.find(cat => cat.id === item.categoryId)?.name || 'Unknown',
      value: item.transactionCount,
      color: COLORS[index % COLORS.length]
    }));
  }, [analytics, categories]);

  const valueDistributionData = useMemo(() => {
    if (!analytics) return [];
    
    return analytics.categoryBreakdown.map((item, index) => ({
      name: categories.find(cat => cat.id === item.categoryId)?.name || 'Unknown',
      value: item.totalValue,
      color: COLORS[index % COLORS.length]
    }));
  }, [analytics, categories]);

  const methodAccuracyData = useMemo(() => {
    if (!analytics) return [];
    
    return [
      { name: 'Rules', accuracy: analytics.ruleAccuracy * 100, color: '#2196F3' },
      { name: 'Patterns', accuracy: analytics.patternMatchRate * 100, color: '#FF9800' },
      { name: 'ML', accuracy: analytics.mlAccuracy * 100, color: '#4CAF50' }
    ];
  }, [analytics]);

  const timeSeriesData = useMemo(() => {
    if (!analytics?.timeSeriesData) return [];
    
    return analytics.timeSeriesData.map(point => ({
      date: new Date(point.date).toLocaleDateString(),
      categorized: point.categorizedCount,
      uncategorized: point.uncategorizedCount,
      total: point.categorizedCount + point.uncategorizedCount
    }));
  }, [analytics]);

  const topPerformingCategories = useMemo(() => {
    if (!analytics) return [];
    
    return analytics.categoryBreakdown
      .sort((a, b) => b.transactionCount - a.transactionCount)
      .slice(0, 5)
      .map(item => {
        const category = categories.find(cat => cat.id === item.categoryId);
        return {
          ...item,
          category,
          usage: getCategoryUsage(item.categoryId)
        };
      });
  }, [analytics, categories, getCategoryUsage]);

  const handleRefresh = () => {
    getAnalytics(selectedTimeRange);
  };

  const handleExportReport = () => {
    if (!analytics) return;
    
    const reportData = {
      generatedAt: new Date().toISOString(),
      timeRange: selectedTimeRange,
      summary: {
        totalTransactions: analytics.totalTransactions,
        categorizedTransactions: analytics.categorizedTransactions,
        uncategorizedTransactions: analytics.uncategorizedTransactions,
        categorizationRate: (analytics.categorizedTransactions / analytics.totalTransactions) * 100
      },
      categoryBreakdown: analytics.categoryBreakdown,
      methodAccuracy: {
        rules: analytics.ruleAccuracy,
        patterns: analytics.patternMatchRate,
        ml: analytics.mlAccuracy
      },
      categories: categories.map(cat => ({
        id: cat.id,
        name: cat.name,
        type: cat.type,
        usage: getCategoryUsage(cat.id)
      }))
    };

    const blob = new Blob([JSON.stringify(reportData, null, 2)], { 
      type: 'application/json' 
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `category-analytics-${selectedTimeRange}-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" height="400px">
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ m: 2 }}>
        {error}
      </Alert>
    );
  }

  if (!analytics) {
    return (
      <Alert severity="info" sx={{ m: 2 }}>
        No analytics data available. Please ensure you have categorized transactions.
      </Alert>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" component="h1">
          Category Analytics
        </Typography>
        <Box display="flex" gap={2}>
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Time Range</InputLabel>
            <Select
              value={selectedTimeRange}
              onChange={(e) => setSelectedTimeRange(e.target.value)}
            >
              <MenuItem value="7d">Last 7 Days</MenuItem>
              <MenuItem value="30d">Last 30 Days</MenuItem>
              <MenuItem value="90d">Last 90 Days</MenuItem>
              <MenuItem value="1y">Last Year</MenuItem>
              <MenuItem value="all">All Time</MenuItem>
            </Select>
          </FormControl>
          <Button
            startIcon={<RefreshIcon />}
            onClick={handleRefresh}
            variant="outlined"
          >
            Refresh
          </Button>
          <Button
            startIcon={<DownloadIcon />}
            onClick={handleExportReport}
            variant="contained"
          >
            Export Report
          </Button>
        </Box>
      </Box>

      {/* Key Metrics */}
      <Grid container spacing={3} mb={4}>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCardComponent
            title="Total Transactions"
            value={analytics.totalTransactions.toLocaleString()}
            icon={<AssessmentIcon />}
            color="#2196F3"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCardComponent
            title="Categorization Rate"
            value={`${((analytics.categorizedTransactions / analytics.totalTransactions) * 100).toFixed(1)}%`}
            subtitle={`${analytics.categorizedTransactions} of ${analytics.totalTransactions}`}
            icon={<CategoryIcon />}
            color="#4CAF50"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCardComponent
            title="ML Accuracy"
            value={`${(analytics.mlAccuracy * 100).toFixed(1)}%`}
            icon={<AIIcon />}
            color="#FF9800"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCardComponent
            title="Rule Accuracy"
            value={`${(analytics.ruleAccuracy * 100).toFixed(1)}%`}
            icon={<RuleIcon />}
            color="#9C27B0"
          />
        </Grid>
      </Grid>

      {/* Charts */}
      <Grid container spacing={3} mb={4}>
        {/* Transaction Distribution */}
        <Grid item xs={12} md={6}>
          <StyledCard>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Transaction Distribution by Category
              </Typography>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={pieChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {pieChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <RechartsTooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </StyledCard>
        </Grid>

        {/* Value Distribution */}
        <Grid item xs={12} md={6}>
          <StyledCard>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Value Distribution by Category
              </Typography>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={valueDistributionData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <RechartsTooltip />
                  <Bar dataKey="value" fill="#8884d8" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </StyledCard>
        </Grid>

        {/* Method Accuracy */}
        <Grid item xs={12} md={6}>
          <StyledCard>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Categorization Method Accuracy
              </Typography>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={methodAccuracyData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis domain={[0, 100]} />
                  <RechartsTooltip formatter={(value) => [`${value.toFixed(1)}%`, 'Accuracy']} />
                  <Bar dataKey="accuracy" fill="#4CAF50" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </StyledCard>
        </Grid>

        {/* Time Series */}
        <Grid item xs={12} md={6}>
          <StyledCard>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Categorization Trend Over Time
              </Typography>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={timeSeriesData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <RechartsTooltip />
                  <Legend />
                  <Area type="monotone" dataKey="categorized" stackId="1" stroke="#4CAF50" fill="#4CAF50" name="Categorized" />
                  <Area type="monotone" dataKey="uncategorized" stackId="1" stroke="#F44336" fill="#F44336" name="Uncategorized" />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </StyledCard>
        </Grid>
      </Grid>

      {/* Top Performing Categories */}
      <Grid container spacing={3} mb={4}>
        <Grid item xs={12} md={8}>
          <StyledCard>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Top Performing Categories
              </Typography>
              <List>
                {topPerformingCategories.map((item, index) => (
                  <React.Fragment key={item.categoryId}>
                    <ListItem>
                      <ListItemAvatar>
                        <Avatar
                          sx={{
                            bgcolor: item.category?.color || '#grey',
                            width: 40,
                            height: 40
                          }}
                        >
                          {index + 1}
                        </Avatar>
                      </ListItemAvatar>
                      <ListItemText
                        primary={item.category?.name || 'Unknown'}
                        secondary={
                          <Box>
                            <Typography variant="body2">
                              {item.transactionCount} transactions • ${item.totalValue.toFixed(2)} total value
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              Success Rate: {(item.usage.successRate * 100).toFixed(1)}% • 
                              Avg Value: ${item.averageValue.toFixed(2)}
                            </Typography>
                          </Box>
                        }
                      />
                      <Box textAlign="right">
                        <Chip
                          label={item.category?.type || 'unknown'}
                          size="small"
                          sx={{ mb: 1 }}
                        />
                        <Typography variant="h6" color="primary">
                          {((item.transactionCount / analytics.totalTransactions) * 100).toFixed(1)}%
                        </Typography>
                      </Box>
                    </ListItem>
                    {index < topPerformingCategories.length - 1 && <Divider />}
                  </React.Fragment>
                ))}
              </List>
            </CardContent>
          </StyledCard>
        </Grid>

        {/* Summary Statistics */}
        <Grid item xs={12} md={4}>
          <StyledCard>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Summary Statistics
              </Typography>
              <Box mb={2}>
                <Typography variant="body2" color="text.secondary">
                  Categorization Coverage
                </Typography>
                <LinearProgress
                  variant="determinate"
                  value={(analytics.categorizedTransactions / analytics.totalTransactions) * 100}
                  sx={{ height: 8, borderRadius: 1, mb: 1 }}
                />
                <Typography variant="caption">
                  {analytics.categorizedTransactions} of {analytics.totalTransactions} transactions
                </Typography>
              </Box>

              <Box mb={2}>
                <Typography variant="body2" color="text.secondary">
                  Active Categories
                </Typography>
                <Typography variant="h4">
                  {categories.filter(cat => cat.isActive).length}
                </Typography>
                <Typography variant="caption">
                  of {categories.length} total categories
                </Typography>
              </Box>

              <Box mb={2}>
                <Typography variant="body2" color="text.secondary">
                  Pattern Recognition Rate
                </Typography>
                <Typography variant="h4">
                  {(analytics.patternMatchRate * 100).toFixed(1)}%
                </Typography>
              </Box>

              <Box>
                <Typography variant="body2" color="text.secondary">
                  Average Processing Time
                </Typography>
                <Typography variant="h4">
                  {analytics.averageProcessingTime?.toFixed(1) || 'N/A'}ms
                </Typography>
              </Box>
            </CardContent>
          </StyledCard>
        </Grid>
      </Grid>

      {/* Detailed Category Performance */}
      <StyledCard>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Detailed Category Performance
          </Typography>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Category</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell align="right">Transactions</TableCell>
                  <TableCell align="right">Total Value</TableCell>
                  <TableCell align="right">Avg Value</TableCell>
                  <TableCell align="right">Success Rate</TableCell>
                  <TableCell align="right">Last Used</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {analytics.categoryBreakdown
                  .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                  .map((item) => {
                    const category = categories.find(cat => cat.id === item.categoryId);
                    const usage = getCategoryUsage(item.categoryId);
                    
                    return (
                      <TableRow key={item.categoryId}>
                        <TableCell>
                          <Box display="flex" alignItems="center">
                            <Box
                              width={12}
                              height={12}
                              borderRadius="50%"
                              bgcolor={category?.color || '#grey'}
                              mr={1}
                            />
                            {category?.name || 'Unknown'}
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Chip 
                            label={category?.type || 'unknown'} 
                            size="small" 
                            variant="outlined"
                          />
                        </TableCell>
                        <TableCell align="right">
                          {item.transactionCount.toLocaleString()}
                        </TableCell>
                        <TableCell align="right">
                          ${item.totalValue.toFixed(2)}
                        </TableCell>
                        <TableCell align="right">
                          ${item.averageValue.toFixed(2)}
                        </TableCell>
                        <TableCell align="right">
                          {(usage.successRate * 100).toFixed(1)}%
                        </TableCell>
                        <TableCell align="right">
                          {usage.lastUsed ? new Date(usage.lastUsed).toLocaleDateString() : 'Never'}
                        </TableCell>
                      </TableRow>
                    );
                  })}
              </TableBody>
            </Table>
          </TableContainer>
          <TablePagination
            rowsPerPageOptions={[5, 10, 25]}
            component="div"
            count={analytics.categoryBreakdown.length}
            rowsPerPage={rowsPerPage}
            page={page}
            onPageChange={(_, newPage) => setPage(newPage)}
            onRowsPerPageChange={(e) => setRowsPerPage(parseInt(e.target.value, 10))}
          />
        </CardContent>
      </StyledCard>

      {/* Insights */}
      <Box mt={4}>
        <Accordion>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="h6">
              <InfoIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
              Insights & Recommendations
            </Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <Alert severity="info" sx={{ mb: 2 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    Categorization Status
                  </Typography>
                  {analytics.categorizedTransactions / analytics.totalTransactions > 0.8 ? (
                    <Typography variant="body2">
                      Great job! You have categorized {((analytics.categorizedTransactions / analytics.totalTransactions) * 100).toFixed(1)}% of your transactions.
                    </Typography>
                  ) : (
                    <Typography variant="body2">
                      Consider categorizing more transactions. Currently at {((analytics.categorizedTransactions / analytics.totalTransactions) * 100).toFixed(1)}% completion.
                    </Typography>
                  )}
                </Alert>
              </Grid>

              <Grid item xs={12} md={6}>
                <Alert severity={analytics.mlAccuracy > 0.8 ? "success" : "warning"} sx={{ mb: 2 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    ML Model Performance
                  </Typography>
                  <Typography variant="body2">
                    {analytics.mlAccuracy > 0.8 
                      ? `Excellent ML accuracy at ${(analytics.mlAccuracy * 100).toFixed(1)}%`
                      : `ML accuracy at ${(analytics.mlAccuracy * 100).toFixed(1)}% - consider retraining with more data`
                    }
                  </Typography>
                </Alert>
              </Grid>

              <Grid item xs={12}>
                <Alert severity="info">
                  <Typography variant="subtitle2" gutterBottom>
                    Top Recommendations
                  </Typography>
                  <List dense>
                    {analytics.uncategorizedTransactions > 0 && (
                      <ListItem>
                        <ListItemText primary={`Categorize ${analytics.uncategorizedTransactions} remaining transactions`} />
                      </ListItem>
                    )}
                    {analytics.ruleAccuracy < 0.7 && (
                      <ListItem>
                        <ListItemText primary="Review and improve categorization rules for better accuracy" />
                      </ListItem>
                    )}
                    {analytics.mlAccuracy < 0.8 && (
                      <ListItem>
                        <ListItemText primary="Retrain ML model with more categorized transactions" />
                      </ListItem>
                    )}
                  </List>
                </Alert>
              </Grid>
            </Grid>
          </AccordionDetails>
        </Accordion>
      </Box>
    </Box>
  );
};