import React, { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  Tabs,
  Tab,
  Button,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  TextField,
  Chip,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Slider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Divider,
} from '@mui/material';
import RevenueIcon from '@mui/icons-material/TrendingUp';
import SalesIcon from '@mui/icons-material/ShoppingCart';
import InventoryIcon from '@mui/icons-material/Inventory2';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import CalculateIcon from '@mui/icons-material/Calculate';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import PeopleIcon from '@mui/icons-material/People';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import DownloadIcon from '@mui/icons-material/Download';
import SendIcon from '@mui/icons-material/Send';
import AssessmentIcon from '@mui/icons-material/Assessment';

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Cell,
} from 'recharts';
import { motion } from 'framer-motion';
import { apiClient } from '../../api/client.ts';
import PageHeader from '../../components/PageHeader.tsx';
import StatCard from '../../components/StatCard.tsx';
import toast from 'react-hot-toast';
import { useRegionalSettings } from '../../hooks/useRegionalSettings.js';

interface ExecutiveMetricsResponse {
  grossSales: number;
  discounts: number;
  returns: number;
  refunds: number;
  netSales: number;
  tax: number;
  revenue: number;
  cogs: number | 'unavailable';
  grossProfit: number | 'unavailable';
  grossMarginPct: number | 'unavailable';
  totalOrders: number;
  totalTransactions: number;
  averageOrderValue: number;
  inventoryAssetValue: number;
  inventoryCostValue: number;
  inventoryTurnoverRatio: number;
  stockoutRatePct: number;
  newCustomers: number;
  returningCustomers: number;
  customerRetentionRatePct: number;
  procurementSpend: number;
  comparison: {
    periodName: string;
    revenue: number;
    revenueGrowthPct: number;
    orders: number;
    ordersGrowthPct: number;
    aov: number;
    aovGrowthPct: number;
    profitGrowthPct: number;
  };
}

export default function ExecutiveDashboard() {
  const { formatAmount, currencySymbol } = useRegionalSettings();
  const [activeTab, setActiveTab] = useState(0);
  const [period, setPeriod] = useState('30_DAYS');
  const [comparison, setComparison] = useState('PREVIOUS_PERIOD');
  const [selectedBranch, setSelectedBranch] = useState('all');

  // AI Assistant Chat State
  const [aiPrompt, setAiPrompt] = useState('');
  const [chatHistory, setChatHistory] = useState<
    { role: 'user' | 'assistant'; text: string; confidence?: string; evidence?: any[] }[]
  >([
    {
      role: 'assistant',
      text: 'Good day! I am your Executive AI Decision Assistant. How can I support your business performance strategy today?',
    },
  ]);

  // What-If Price Simulation State
  const [priceChangePct, setPriceChangePct] = useState(5);
  const [simulatedPriceResult, setSimulatedPriceResult] = useState<any>(null);

  // What-If Inventory Simulation State
  const [inventoryReorderUnits, setInventoryReorderUnits] = useState(250);
  const [simulatedInvResult, setSimulatedInvResult] = useState<any>(null);

  // Export Modal
  const [isExportOpen, setIsExportOpen] = useState(false);

  // Queries
  const { data: metrics, isLoading: isMetricsLoading } = useQuery<ExecutiveMetricsResponse>({
    queryKey: ['exec-metrics', period, comparison, selectedBranch],
    queryFn: async () => {
      const branchQuery = selectedBranch !== 'all' ? `&branchId=${selectedBranch}` : '';
      const { data } = await apiClient.get<ExecutiveMetricsResponse>(
        `/analytics/executive?period=${period}&comparison=${comparison}${branchQuery}`
      );
      return data;
    },
  });

  const { data: salesTrend } = useQuery({
    queryKey: ['exec-sales-trend', period, selectedBranch],
    queryFn: async () => {
      const branchQuery = selectedBranch !== 'all' ? `&branchId=${selectedBranch}` : '';
      const { data } = await apiClient.get(`/analytics/sales-trend?period=${period}${branchQuery}`);
      return data;
    },
  });

  const { data: salesChannels } = useQuery({
    queryKey: ['exec-sales-channels', period],
    queryFn: async () => {
      const { data } = await apiClient.get(`/analytics/channels?period=${period}`);
      return data;
    },
  });

  const { data: branchPerformance } = useQuery({
    queryKey: ['exec-branches', period],
    queryFn: async () => {
      const { data } = await apiClient.get(`/analytics/branches?period=${period}`);
      return data;
    },
  });

  const { data: inventoryHealth } = useQuery({
    queryKey: ['exec-inventory-health'],
    queryFn: async () => {
      const { data } = await apiClient.get('/analytics/inventory-health');
      return data;
    },
  });

  const { data: stockoutAnalytics } = useQuery({
    queryKey: ['exec-stockouts'],
    queryFn: async () => {
      const { data } = await apiClient.get('/analytics/stockouts');
      return data;
    },
  });

  const { data: bcgMatrix } = useQuery({
    queryKey: ['exec-bcg-matrix'],
    queryFn: async () => {
      const { data } = await apiClient.get('/analytics/products');
      return data;
    },
  });

  const { data: customerCohorts } = useQuery({
    queryKey: ['exec-customer-cohorts'],
    queryFn: async () => {
      const { data } = await apiClient.get('/analytics/customer-cohorts');
      return data;
    },
  });

  const { data: supplierScorecards } = useQuery({
    queryKey: ['exec-supplier-scorecards'],
    queryFn: async () => {
      const { data } = await apiClient.get('/analytics/suppliers');
      return data;
    },
  });

  const { data: cashRegisterAnalytics } = useQuery({
    queryKey: ['exec-cash-registers'],
    queryFn: async () => {
      const { data } = await apiClient.get('/analytics/cash-registers');
      return data;
    },
  });

  const { data: healthScore } = useQuery({
    queryKey: ['exec-health-score'],
    queryFn: async () => {
      const { data } = await apiClient.get('/analytics/health-score');
      return data;
    },
  });

  const { data: dailyBriefing } = useQuery({
    queryKey: ['exec-daily-briefing'],
    queryFn: async () => {
      const { data } = await apiClient.get('/analytics/briefing');
      return data;
    },
  });

  const { data: aiForecast } = useQuery({
    queryKey: ['exec-ai-forecast'],
    queryFn: async () => {
      const { data } = await apiClient.post('/analytics/ai/forecast', {
        domain: 'SALES',
        timeframe: '30_DAYS',
      });
      return data;
    },
  });

  // AI Query Mutation
  const aiMutation = useMutation({
    mutationFn: async (prompt: string) => {
      const { data } = await apiClient.post('/analytics/ai/assistant', { prompt });
      return data;
    },
    onSuccess: (data) => {
      setChatHistory((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: data.response,
          confidence: data.confidence,
          evidence: data.evidence,
        },
      ]);
    },
    onError: () => {
      toast.error('Failed to communicate with AI Assistant.');
    },
  });

  const handleSendPrompt = (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiPrompt.trim()) return;
    const userMessage = aiPrompt;
    setChatHistory((prev) => [...prev, { role: 'user', text: userMessage }]);
    setAiPrompt('');
    aiMutation.mutate(userMessage);
  };

  const handleRunPriceSimulation = async () => {
    try {
      const { data } = await apiClient.post('/analytics/ai/simulate-price', {
        productId: '64d4b1a4c9b841a4c9b84001',
        percentageChange: priceChangePct,
      });
      setSimulatedPriceResult(data);
      toast.success('Price elasticity simulation complete.');
    } catch {
      toast.error('Failed to simulate price changes.');
    }
  };

  const handleRunInventorySimulation = async () => {
    try {
      const { data } = await apiClient.post('/analytics/ai/simulate-inventory', {
        productId: '64d4b1a4c9b841a4c9b84001',
        additionalUnits: inventoryReorderUnits,
      });
      setSimulatedInvResult(data);
      toast.success('Inventory reorder simulation complete.');
    } catch {
      toast.error('Failed to simulate inventory reorder.');
    }
  };

  const handleExportCsv = async () => {
    try {
      const response = await apiClient.post(
        '/analytics/export',
        { reportType: 'EXECUTIVE_SUMMARY', format: 'CSV' },
        { responseType: 'blob' }
      );
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `executive-analytics-${Date.now()}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success('CSV Report exported successfully.');
      setIsExportOpen(false);
    } catch {
      toast.error('Failed to export CSV report.');
    }
  };

  return (
    <Box sx={{ p: { xs: 2, md: 4 } }}>
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        {/* Top Header & Action Controls */}
        <Box
          sx={{
            display: 'flex',
            flexDirection: { xs: 'column', md: 'row' },
            justifyContent: 'space-between',
            alignItems: { xs: 'flex-start', md: 'center' },
            mb: 3,
            gap: 2,
          }}
        >
          <PageHeader
            title="Executive Intelligence & Decision Hub"
            subtitle="Real-time multi-dimensional financial metrics, BCG product portfolio, customer cohorts, and AI decision simulators"
            category="Business Intelligence"
          />

          {/* Date & Filter Controls */}
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, alignItems: 'center' }}>
            <FormControl size="small" sx={{ minWidth: 140 }}>
              <InputLabel>Date Period</InputLabel>
              <Select
                value={period}
                label="Date Period"
                onChange={(e) => setPeriod(e.target.value)}
                sx={{ borderRadius: '10px' }}
              >
                <MenuItem value="TODAY">Today</MenuItem>
                <MenuItem value="YESTERDAY">Yesterday</MenuItem>
                <MenuItem value="7_DAYS">Last 7 Days</MenuItem>
                <MenuItem value="30_DAYS">Last 30 Days</MenuItem>
                <MenuItem value="90_DAYS">Last 90 Days</MenuItem>
                <MenuItem value="THIS_MONTH">This Month</MenuItem>
                <MenuItem value="LAST_MONTH">Last Month</MenuItem>
                <MenuItem value="THIS_QUARTER">This Quarter</MenuItem>
                <MenuItem value="THIS_YEAR">This Year</MenuItem>
              </Select>
            </FormControl>

            <FormControl size="small" sx={{ minWidth: 150 }}>
              <InputLabel>Compare With</InputLabel>
              <Select
                value={comparison}
                label="Compare With"
                onChange={(e) => setComparison(e.target.value)}
                sx={{ borderRadius: '10px' }}
              >
                <MenuItem value="PREVIOUS_PERIOD">Previous Period</MenuItem>
                <MenuItem value="PREVIOUS_MONTH">Previous Month</MenuItem>
                <MenuItem value="PREVIOUS_QUARTER">Previous Quarter</MenuItem>
                <MenuItem value="PREVIOUS_YEAR">Previous Year</MenuItem>
              </Select>
            </FormControl>

            <FormControl size="small" sx={{ minWidth: 130 }}>
              <InputLabel>Branch</InputLabel>
              <Select
                value={selectedBranch}
                label="Branch"
                onChange={(e) => setSelectedBranch(e.target.value)}
                sx={{ borderRadius: '10px' }}
              >
                <MenuItem value="all">All Branches</MenuItem>
                <MenuItem value="main-branch">Main HQ</MenuItem>
                <MenuItem value="branch-2">Transit Hub</MenuItem>
              </Select>
            </FormControl>

            <Button
              variant="outlined"
              startIcon={<DownloadIcon />}
              onClick={() => setIsExportOpen(true)}
              sx={{ borderRadius: '10px', textTransform: 'none', fontWeight: 700 }}
            >
              Export Report
            </Button>
          </Box>
        </Box>

        {/* Daily Executive AI Briefing Banner */}
        {dailyBriefing && (
          <Card
            className="glass-panel"
            sx={{
              p: 2.5,
              mb: 4,
              borderRadius: '16px',
              border: '1px solid rgba(139, 92, 246, 0.3)',
              background:
                'linear-gradient(135deg, rgba(139,92,246,0.12) 0%, rgba(17,24,39,0.7) 100%)',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
              <AutoAwesomeIcon sx={{ color: '#a78bfa' }} />
              <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#f3f4f6' }}>
                Executive Daily Briefing — {dailyBriefing.date}
              </Typography>
              <Chip label="AI Intelligence" size="small" color="secondary" sx={{ ml: 'auto' }} />
            </Box>
            <Typography variant="body2" sx={{ color: '#d1d5db', mb: 1.5 }}>
              {dailyBriefing.greeting} Yesterday revenue reached{' '}
              <strong>{formatAmount(dailyBriefing.yesterdayPerformance.revenue)}</strong> (
              <span style={{ color: '#10b981' }}>
                +{dailyBriefing.yesterdayPerformance.growthPct}%
              </span>
              ) across {dailyBriefing.yesterdayPerformance.transactions} orders.
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} md={4}>
                <Typography
                  variant="caption"
                  sx={{ color: '#f87171', fontWeight: 700, display: 'block' }}
                >
                  Critical Inventory Risk
                </Typography>
                <Typography variant="caption" sx={{ color: '#9ca3af' }}>
                  {dailyBriefing.criticalInventoryAlerts[0]}
                </Typography>
              </Grid>
              <Grid item xs={12} md={4}>
                <Typography
                  variant="caption"
                  sx={{ color: '#60a5fa', fontWeight: 700, display: 'block' }}
                >
                  Customer Growth Pulse
                </Typography>
                <Typography variant="caption" sx={{ color: '#9ca3af' }}>
                  {dailyBriefing.customerInsights[0]}
                </Typography>
              </Grid>
              <Grid item xs={12} md={4}>
                <Typography
                  variant="caption"
                  sx={{ color: '#34d399', fontWeight: 700, display: 'block' }}
                >
                  Recommended Strategic Action
                </Typography>
                <Typography variant="caption" sx={{ color: '#9ca3af' }}>
                  {dailyBriefing.actionItems[0]}
                </Typography>
              </Grid>
            </Grid>
          </Card>
        )}

        {/* Primary Executive Financial Stat Cards */}
        {isMetricsLoading || !metrics ? (
          <Grid container spacing={3} sx={{ mb: 4 }}>
            {[1, 2, 3, 4].map((i) => (
              <Grid item xs={12} sm={6} md={3} key={i}>
                <Skeleton variant="rounded" height={130} sx={{ borderRadius: '16px' }} />
              </Grid>
            ))}
          </Grid>
        ) : (
          <Grid container spacing={3} sx={{ mb: 4 }}>
            <Grid item xs={12} sm={6} md={3}>
              <StatCard
                title="TOTAL REVENUE"
                value={formatAmount(metrics.revenue)}
                subtitle={`Net Sales: ${formatAmount(metrics.netSales)} | Tax: ${formatAmount(metrics.tax)}`}
                icon={<RevenueIcon sx={{ fontSize: 22 }} />}
                trend={`${metrics.comparison.revenueGrowthPct >= 0 ? '+' : ''}${metrics.comparison.revenueGrowthPct}%`}
                trendUp={metrics.comparison.revenueGrowthPct >= 0}
                color="emerald"
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <StatCard
                title="GROSS PROFIT & MARGIN"
                value={
                  metrics.grossProfit !== 'unavailable'
                    ? formatAmount(metrics.grossProfit)
                    : 'Available on Cost Sync'
                }
                subtitle={
                  metrics.grossMarginPct !== 'unavailable'
                    ? `Gross Margin: ${metrics.grossMarginPct}%`
                    : 'COGS cost data pending'
                }
                icon={<CalculateIcon sx={{ fontSize: 22 }} />}
                trend={`${metrics.comparison.profitGrowthPct >= 0 ? '+' : ''}${metrics.comparison.profitGrowthPct}%`}
                trendUp={metrics.comparison.profitGrowthPct >= 0}
                color="violet"
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <StatCard
                title="AVERAGE ORDER VALUE (AOV)"
                value={formatAmount(metrics.averageOrderValue)}
                subtitle={`${metrics.totalTransactions + metrics.totalOrders} total tickets & sales orders`}
                icon={<SalesIcon sx={{ fontSize: 22 }} />}
                trend={`${metrics.comparison.aovGrowthPct >= 0 ? '+' : ''}${metrics.comparison.aovGrowthPct}%`}
                trendUp={metrics.comparison.aovGrowthPct >= 0}
                color="sky"
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <StatCard
                title="INVENTORY ASSET VALUE"
                value={formatAmount(metrics.inventoryAssetValue)}
                subtitle={`Turnover: ${metrics.inventoryTurnoverRatio}x | Stockout Rate: ${metrics.stockoutRatePct}%`}
                icon={<InventoryIcon sx={{ fontSize: 22 }} />}
                color="amber"
              />
            </Grid>
          </Grid>
        )}

        {/* Navigation Tabs for Modules */}
        <Box sx={{ borderBottom: 1, borderColor: 'rgba(255,255,255,0.08)', mb: 3 }}>
          <Tabs
            value={activeTab}
            onChange={(_, val) => setActiveTab(val)}
            variant="scrollable"
            scrollButtons="auto"
            textColor="secondary"
            indicatorColor="secondary"
          >
            <Tab icon={<AssessmentIcon />} iconPosition="start" label="Revenue & Channels" />
            <Tab
              icon={<InventoryIcon />}
              iconPosition="start"
              label="Product BCG Matrix & Inventory"
            />
            <Tab icon={<PeopleIcon />} iconPosition="start" label="Customer Cohorts" />
            <Tab
              icon={<LocalShippingIcon />}
              iconPosition="start"
              label="Procurement & Suppliers"
            />
            <Tab icon={<AccountBalanceIcon />} iconPosition="start" label="Cash & Registers" />
            <Tab icon={<AutoAwesomeIcon />} iconPosition="start" label="AI Decision Intelligence" />
          </Tabs>
        </Box>

        {/* TAB 0: REVENUE & CHANNELS */}
        {activeTab === 0 && (
          <Grid container spacing={3}>
            <Grid item xs={12} lg={8}>
              <Card className="glass-panel" sx={{ p: 3, borderRadius: '16px' }}>
                <CardContent>
                  <Typography variant="h6" sx={{ fontWeight: 800, mb: 1 }}>
                    Sales Revenue Activity & Time-Series Trend
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#9ca3af', mb: 3 }}>
                    Tracking daily gross revenue vs net sales across enterprise branches
                  </Typography>
                  <Box sx={{ height: 350, width: '100%' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart
                        data={salesTrend || []}
                        margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
                      >
                        <defs>
                          <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                            <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                          </linearGradient>
                          <linearGradient id="netGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.4} />
                            <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                        <XAxis dataKey="label" stroke="#9ca3af" style={{ fontSize: 11 }} />
                        <YAxis stroke="#9ca3af" style={{ fontSize: 11 }} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: '#111827',
                            border: '1px solid rgba(255,255,255,0.1)',
                          }}
                        />
                        <Legend />
                        <Area
                          type="monotone"
                          dataKey="revenue"
                          name="Gross Revenue"
                          stroke="#10b981"
                          strokeWidth={2}
                          fill="url(#revGrad)"
                        />
                        <Area
                          type="monotone"
                          dataKey="netSales"
                          name="Net Sales"
                          stroke="#8b5cf6"
                          strokeWidth={2}
                          fill="url(#netGrad)"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            {/* Sales Channel Mix */}
            <Grid item xs={12} lg={4}>
              <Card className="glass-panel" sx={{ p: 3, borderRadius: '16px', height: '100%' }}>
                <CardContent>
                  <Typography variant="h6" sx={{ fontWeight: 800, mb: 1 }}>
                    Sales Channel Distribution
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#9ca3af', mb: 3 }}>
                    Omnichannel share & average ticket size
                  </Typography>
                  <Box sx={{ height: 280, width: '100%' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={salesChannels || []} layout="vertical" margin={{ left: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                        <XAxis type="number" stroke="#9ca3af" style={{ fontSize: 11 }} />
                        <YAxis
                          type="category"
                          dataKey="channel"
                          stroke="#9ca3af"
                          style={{ fontSize: 11 }}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: '#111827',
                            border: '1px solid rgba(255,255,255,0.1)',
                          }}
                        />
                        <Bar
                          dataKey="revenue"
                          name={`Revenue (${currencySymbol})`}
                          fill="#6366f1"
                          radius={[0, 6, 6, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            {/* Branch Performance Comparison */}
            <Grid item xs={12}>
              <Card className="glass-panel" sx={{ p: 3, borderRadius: '16px' }}>
                <CardContent>
                  <Typography variant="h6" sx={{ fontWeight: 800, mb: 2 }}>
                    Multi-Branch Performance Benchmarks
                  </Typography>
                  <TableContainer
                    component={Paper}
                    sx={{ background: 'transparent', boxShadow: 'none' }}
                  >
                    <Table size="small">
                      <TableHead>
                        <TableRow sx={{ '& th': { color: '#9ca3af', fontWeight: 700 } }}>
                          <TableCell>Branch Name</TableCell>
                          <TableCell>Code</TableCell>
                          <TableCell align="right">Revenue</TableCell>
                          <TableCell align="right">Gross Profit</TableCell>
                          <TableCell align="right">Orders</TableCell>
                          <TableCell align="right">AOV</TableCell>
                          <TableCell align="right">Units Sold</TableCell>
                          <TableCell align="right">Return Rate</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {(branchPerformance || []).map((b: any) => (
                          <TableRow
                            key={b.branchId}
                            sx={{ '&:hover': { background: 'rgba(255,255,255,0.02)' } }}
                          >
                            <TableCell sx={{ fontWeight: 700, color: '#f3f4f6' }}>
                              {b.branchName}
                            </TableCell>
                            <TableCell>
                              <Chip label={b.code} size="small" variant="outlined" />
                            </TableCell>
                            <TableCell align="right" sx={{ color: '#10b981', fontWeight: 700 }}>
                              {formatAmount(b.revenue)}
                            </TableCell>
                            <TableCell align="right">
                              {typeof b.grossProfit === 'number'
                                ? formatAmount(b.grossProfit)
                                : '—'}
                            </TableCell>
                            <TableCell align="right">{b.orders}</TableCell>
                            <TableCell align="right">{formatAmount(b.aov)}</TableCell>
                            <TableCell align="right">{b.unitsSold}</TableCell>
                            <TableCell align="right">{b.returnRatePct}%</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        )}

        {/* TAB 1: PRODUCT BCG MATRIX & INVENTORY VELOCITY */}
        {activeTab === 1 && (
          <Grid container spacing={3}>
            {/* BCG Matrix Visualizer */}
            <Grid item xs={12} lg={7}>
              <Card className="glass-panel" sx={{ p: 3, borderRadius: '16px' }}>
                <CardContent>
                  <Typography variant="h6" sx={{ fontWeight: 800, mb: 1 }}>
                    Product Performance Matrix (BCG Quadrants)
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#9ca3af', mb: 3 }}>
                    Visualizing catalog products by Sales Volume (X) vs Gross Margin % (Y)
                  </Typography>
                  <Box sx={{ height: 350, width: '100%' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                        <XAxis
                          type="number"
                          dataKey="salesVolume"
                          name="Sales Volume"
                          stroke="#9ca3af"
                          unit=" units"
                        />
                        <YAxis
                          type="number"
                          dataKey="grossMarginPct"
                          name="Gross Margin"
                          stroke="#9ca3af"
                          unit="%"
                        />
                        <Tooltip
                          cursor={{ strokeDasharray: '3 3' }}
                          content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                              const data = payload[0].payload;
                              return (
                                <Box
                                  sx={{
                                    background: '#111827',
                                    p: 1.5,
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    borderRadius: '8px',
                                  }}
                                >
                                  <Typography
                                    variant="caption"
                                    sx={{ fontWeight: 800, color: '#f3f4f6', display: 'block' }}
                                  >
                                    {data.name} ({data.sku})
                                  </Typography>
                                  <Typography variant="caption" sx={{ color: '#a78bfa' }}>
                                    Quadrant: {data.quadrant}
                                  </Typography>
                                  <br />
                                  <Typography variant="caption" sx={{ color: '#10b981' }}>
                                    Volume: {data.salesVolume} | Margin: {data.grossMarginPct}%
                                  </Typography>
                                </Box>
                              );
                            }
                            return null;
                          }}
                        />
                        <Scatter data={bcgMatrix || []} fill="#8b5cf6">
                          {(bcgMatrix || []).map((entry: any, index: number) => {
                            let color = '#10b981'; // Star
                            if (entry.quadrant === 'CASH_COW') color = '#3b82f6';
                            if (entry.quadrant === 'QUESTION_MARK') color = '#f59e0b';
                            if (entry.quadrant === 'DOG') color = '#ef4444';
                            return <Cell key={`cell-${index}`} fill={color} />;
                          })}
                        </Scatter>
                      </ScatterChart>
                    </ResponsiveContainer>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'center', gap: 3, mt: 2 }}>
                    <Chip
                      label="⭐ Stars (High Volume, High Margin)"
                      size="small"
                      sx={{ background: 'rgba(16,185,129,0.2)', color: '#10b981' }}
                    />
                    <Chip
                      label="🐄 Cash Cows (High Volume, Moderate Margin)"
                      size="small"
                      sx={{ background: 'rgba(59,130,246,0.2)', color: '#3b82f6' }}
                    />
                    <Chip
                      label="❓ Question Marks (Low Volume, High Margin)"
                      size="small"
                      sx={{ background: 'rgba(245,158,11,0.2)', color: '#f59e0b' }}
                    />
                    <Chip
                      label="🐕 Dogs (Low Volume, Low Margin)"
                      size="small"
                      sx={{ background: 'rgba(239,68,68,0.2)', color: '#ef4444' }}
                    />
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            {/* Inventory Velocity & Health */}
            <Grid item xs={12} lg={5}>
              <Card className="glass-panel" sx={{ p: 3, borderRadius: '16px', height: '100%' }}>
                <CardContent>
                  <Typography variant="h6" sx={{ fontWeight: 800, mb: 1 }}>
                    Inventory Health & Days of Supply
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#9ca3af', mb: 3 }}>
                    Stock level categorization across registered catalog lines
                  </Typography>

                  {inventoryHealth && (
                    <Grid container spacing={2} sx={{ mb: 3 }}>
                      <Grid item xs={6}>
                        <Box
                          sx={{
                            p: 1.5,
                            background: 'rgba(16,185,129,0.1)',
                            borderRadius: '10px',
                            textAlign: 'center',
                          }}
                        >
                          <Typography variant="h6" sx={{ color: '#10b981', fontWeight: 800 }}>
                            {inventoryHealth.healthyStockCount}
                          </Typography>
                          <Typography variant="caption" sx={{ color: '#9ca3af' }}>
                            Healthy Stock
                          </Typography>
                        </Box>
                      </Grid>
                      <Grid item xs={6}>
                        <Box
                          sx={{
                            p: 1.5,
                            background: 'rgba(239,68,68,0.1)',
                            borderRadius: '10px',
                            textAlign: 'center',
                          }}
                        >
                          <Typography variant="h6" sx={{ color: '#ef4444', fontWeight: 800 }}>
                            {inventoryHealth.outOfStockCount}
                          </Typography>
                          <Typography variant="caption" sx={{ color: '#9ca3af' }}>
                            Out of Stock
                          </Typography>
                        </Box>
                      </Grid>
                      <Grid item xs={6}>
                        <Box
                          sx={{
                            p: 1.5,
                            background: 'rgba(245,158,11,0.1)',
                            borderRadius: '10px',
                            textAlign: 'center',
                          }}
                        >
                          <Typography variant="h6" sx={{ color: '#f59e0b', fontWeight: 800 }}>
                            {inventoryHealth.criticalStockCount}
                          </Typography>
                          <Typography variant="caption" sx={{ color: '#9ca3af' }}>
                            Critical Stock
                          </Typography>
                        </Box>
                      </Grid>
                      <Grid item xs={6}>
                        <Box
                          sx={{
                            p: 1.5,
                            background: 'rgba(139,92,246,0.1)',
                            borderRadius: '10px',
                            textAlign: 'center',
                          }}
                        >
                          <Typography variant="h6" sx={{ color: '#a78bfa', fontWeight: 800 }}>
                            {formatAmount(inventoryHealth.deadStockValue)}
                          </Typography>
                          <Typography variant="caption" sx={{ color: '#9ca3af' }}>
                            Dead Stock Value
                          </Typography>
                        </Box>
                      </Grid>
                    </Grid>
                  )}

                  <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 1 }}>
                    Fast-Moving Products (Top Velocity)
                  </Typography>
                  {(inventoryHealth?.fastMovingItems || []).map((item: any) => (
                    <Box
                      key={item.sku}
                      sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}
                    >
                      <Typography variant="body2" sx={{ color: '#f3f4f6' }}>
                        {item.name}
                      </Typography>
                      <Typography variant="caption" sx={{ color: '#10b981', fontWeight: 700 }}>
                        {item.velocityPerDay} units/day (~{item.daysOfSupplyEst}d supply)
                      </Typography>
                    </Box>
                  ))}

                  {stockoutAnalytics && stockoutAnalytics.criticalSkus.length > 0 && (
                    <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                      <Typography
                        variant="caption"
                        sx={{ color: '#f87171', fontWeight: 700, display: 'block' }}
                      >
                        ⚠️ Stockout Risk SKUs (Est. Lost Sales:{' '}
                        {formatAmount(stockoutAnalytics.estimatedLostSalesValue)})
                      </Typography>
                      {stockoutAnalytics.criticalSkus.slice(0, 3).map((sku: any) => (
                        <Box
                          key={sku.sku}
                          sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}
                        >
                          <Typography variant="caption" sx={{ color: '#d1d5db' }}>
                            {sku.name}
                          </Typography>
                          <Typography variant="caption" sx={{ color: '#f87171', fontWeight: 700 }}>
                            Reorder: {sku.reorderPoint} units
                          </Typography>
                        </Box>
                      ))}
                    </Box>
                  )}
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        )}

        {/* TAB 2: CUSTOMER COHORTS */}
        {activeTab === 2 && (
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <Card className="glass-panel" sx={{ p: 3, borderRadius: '16px' }}>
                <CardContent>
                  <Typography variant="h6" sx={{ fontWeight: 800, mb: 1 }}>
                    Customer Retention & Monthly Cohort Matrix
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#9ca3af', mb: 3 }}>
                    Tracking customer repeat purchase percentages across successive calendar months
                  </Typography>

                  <TableContainer
                    component={Paper}
                    sx={{ background: 'transparent', boxShadow: 'none' }}
                  >
                    <Table size="small">
                      <TableHead>
                        <TableRow sx={{ '& th': { color: '#9ca3af', fontWeight: 700 } }}>
                          <TableCell>Cohort Month</TableCell>
                          <TableCell align="center">Initial Customers</TableCell>
                          <TableCell align="center">Month 0</TableCell>
                          <TableCell align="center">Month 1</TableCell>
                          <TableCell align="center">Month 2</TableCell>
                          <TableCell align="center">Month 3</TableCell>
                          <TableCell align="center">Month 4</TableCell>
                          <TableCell align="center">Month 5</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {(customerCohorts || []).map((c: any) => (
                          <TableRow
                            key={c.cohortMonth}
                            sx={{ '&:hover': { background: 'rgba(255,255,255,0.02)' } }}
                          >
                            <TableCell sx={{ fontWeight: 700, color: '#f3f4f6' }}>
                              {c.cohortMonth}
                            </TableCell>
                            <TableCell align="center">{c.initialCustomerCount}</TableCell>
                            {c.activityByMonth.map((m: any, idx: number) => {
                              const pct = m.retentionRatePct;
                              let bg = 'rgba(16,185,129,0.1)';
                              if (pct >= 80) bg = 'rgba(16,185,129,0.3)';
                              else if (pct >= 60) bg = 'rgba(59,130,246,0.25)';
                              else if (pct >= 40) bg = 'rgba(245,158,11,0.2)';
                              return (
                                <TableCell
                                  key={idx}
                                  align="center"
                                  sx={{
                                    background: bg,
                                    color: '#f3f4f6',
                                    fontWeight: 700,
                                    borderRadius: '4px',
                                  }}
                                >
                                  {pct}%
                                </TableCell>
                              );
                            })}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        )}

        {/* TAB 3: PROCUREMENT & SUPPLIERS */}
        {activeTab === 3 && (
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <Card className="glass-panel" sx={{ p: 3, borderRadius: '16px' }}>
                <CardContent>
                  <Typography variant="h6" sx={{ fontWeight: 800, mb: 1 }}>
                    Supplier Performance Scorecards & Reliability Ranking
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#9ca3af', mb: 3 }}>
                    Audited on-time delivery, defect rate, lead times, and competitive pricing
                    metrics
                  </Typography>

                  <TableContainer
                    component={Paper}
                    sx={{ background: 'transparent', boxShadow: 'none' }}
                  >
                    <Table size="small">
                      <TableHead>
                        <TableRow sx={{ '& th': { color: '#9ca3af', fontWeight: 700 } }}>
                          <TableCell>Supplier</TableCell>
                          <TableCell>Code</TableCell>
                          <TableCell align="right">Spend</TableCell>
                          <TableCell align="center">On-Time %</TableCell>
                          <TableCell align="center">Quality %</TableCell>
                          <TableCell align="center">Price Score</TableCell>
                          <TableCell align="center">Avg Lead Time</TableCell>
                          <TableCell align="center">Overall Reliability</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {(supplierScorecards || []).map((s: any) => (
                          <TableRow
                            key={s.supplierId}
                            sx={{ '&:hover': { background: 'rgba(255,255,255,0.02)' } }}
                          >
                            <TableCell sx={{ fontWeight: 700, color: '#f3f4f6' }}>
                              {s.supplierName}
                            </TableCell>
                            <TableCell>
                              <Chip label={s.code} size="small" variant="outlined" />
                            </TableCell>
                            <TableCell align="right" sx={{ fontWeight: 700, color: '#10b981' }}>
                              {formatAmount(s.totalSpend)}
                            </TableCell>
                            <TableCell align="center">{s.onTimeDeliveryRatePct}%</TableCell>
                            <TableCell align="center">{s.qualityPassRatePct}%</TableCell>
                            <TableCell align="center">{s.priceCompetitivenessScorePct}%</TableCell>
                            <TableCell align="center">{s.averageLeadTimeDays} days</TableCell>
                            <TableCell align="center">
                              <Chip
                                label={`${s.reliabilityOverallScorePct}%`}
                                size="small"
                                color={s.reliabilityOverallScorePct >= 90 ? 'success' : 'warning'}
                              />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        )}

        {/* TAB 4: CASH REGISTERS & VARIANCE AUDIT */}
        {activeTab === 4 && (
          <Grid container spacing={3}>
            <Grid item xs={12} lg={4}>
              <Card className="glass-panel" sx={{ p: 3, borderRadius: '16px' }}>
                <CardContent>
                  <Typography variant="h6" sx={{ fontWeight: 800, mb: 2 }}>
                    Cash Register Variance Summary
                  </Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2" sx={{ color: '#9ca3af' }}>
                        Total Sessions Audited:
                      </Typography>
                      <Typography variant="body2" sx={{ fontWeight: 700 }}>
                        {cashRegisterAnalytics?.totalRegisterSessions || 0}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2" sx={{ color: '#9ca3af' }}>
                        Total Expected Cash:
                      </Typography>
                      <Typography variant="body2" sx={{ fontWeight: 700 }}>
                        {formatAmount(cashRegisterAnalytics?.totalExpectedCash || 0)}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2" sx={{ color: '#9ca3af' }}>
                        Total Counted Cash:
                      </Typography>
                      <Typography variant="body2" sx={{ fontWeight: 700 }}>
                        {formatAmount(cashRegisterAnalytics?.totalCountedCash || 0)}
                      </Typography>
                    </Box>
                    <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)' }} />
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                        Net Discrepancy:
                      </Typography>
                      <Typography
                        variant="subtitle2"
                        sx={{
                          fontWeight: 800,
                          color:
                            (cashRegisterAnalytics?.totalVariance || 0) === 0
                              ? '#10b981'
                              : '#f87171',
                        }}
                      >
                        {formatAmount(cashRegisterAnalytics?.totalVariance || 0)}
                      </Typography>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} lg={8}>
              <Card className="glass-panel" sx={{ p: 3, borderRadius: '16px' }}>
                <CardContent>
                  <Typography variant="h6" sx={{ fontWeight: 800, mb: 1 }}>
                    Register Session Variance Discrepancies
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#9ca3af', mb: 2 }}>
                    Flagged cash discrepancies requiring manager audit review
                  </Typography>
                  <TableContainer
                    component={Paper}
                    sx={{ background: 'transparent', boxShadow: 'none' }}
                  >
                    <Table size="small">
                      <TableHead>
                        <TableRow sx={{ '& th': { color: '#9ca3af', fontWeight: 700 } }}>
                          <TableCell>Terminal</TableCell>
                          <TableCell>Cashier</TableCell>
                          <TableCell align="right">Expected</TableCell>
                          <TableCell align="right">Counted</TableCell>
                          <TableCell align="right">Variance</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {(cashRegisterAnalytics?.varianceIncidents || []).map(
                          (inc: any, idx: number) => (
                            <TableRow key={idx}>
                              <TableCell sx={{ fontWeight: 700 }}>{inc.terminalName}</TableCell>
                              <TableCell>{inc.cashierName}</TableCell>
                              <TableCell align="right">{formatAmount(inc.expectedCash)}</TableCell>
                              <TableCell align="right">{formatAmount(inc.countedCash)}</TableCell>
                              <TableCell
                                align="right"
                                sx={{
                                  color: inc.variance < 0 ? '#f87171' : '#10b981',
                                  fontWeight: 700,
                                }}
                              >
                                {inc.variance > 0
                                  ? `+${formatAmount(inc.variance)}`
                                  : inc.variance < 0
                                    ? `-${formatAmount(Math.abs(inc.variance))}`
                                    : formatAmount(0)}
                              </TableCell>
                            </TableRow>
                          )
                        )}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        )}

        {/* TAB 5: AI DECISION INTELLIGENCE & WHAT-IF SIMULATORS */}
        {activeTab === 5 && (
          <Grid container spacing={3}>
            {/* Overall Business Health Score Gauge */}
            {healthScore && (
              <Grid item xs={12} md={4}>
                <Card className="glass-panel" sx={{ p: 3, borderRadius: '16px', height: '100%' }}>
                  <CardContent>
                    <Typography variant="h6" sx={{ fontWeight: 800, mb: 1 }}>
                      Business Health Score
                    </Typography>
                    <Box sx={{ textAlign: 'center', my: 2 }}>
                      <Typography variant="h2" sx={{ fontWeight: 900, color: '#a78bfa' }}>
                        {healthScore.overallScore}
                      </Typography>
                      <Chip
                        label={healthScore.status}
                        color="success"
                        sx={{ fontWeight: 800, mt: 1 }}
                      />
                    </Box>
                    <Typography
                      variant="caption"
                      sx={{ color: '#9ca3af', display: 'block', mb: 2 }}
                    >
                      Evaluated across sales velocity, margins, inventory equilibrium, and
                      operations.
                    </Typography>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="caption">Sales Performance (20%)</Typography>
                        <Typography variant="caption" sx={{ fontWeight: 700 }}>
                          {healthScore.breakdown.salesScore}/20
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="caption">Profitability (20%)</Typography>
                        <Typography variant="caption" sx={{ fontWeight: 700 }}>
                          {healthScore.breakdown.profitabilityScore}/20
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="caption">Inventory Health (15%)</Typography>
                        <Typography variant="caption" sx={{ fontWeight: 700 }}>
                          {healthScore.breakdown.inventoryHealthScore}/15
                        </Typography>
                      </Box>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            )}

            {/* AI Multi-Horizon Sales Forecast Chart */}
            <Grid item xs={12} md={8}>
              <Card className="glass-panel" sx={{ p: 3, borderRadius: '16px' }}>
                <CardContent>
                  <Typography variant="h6" sx={{ fontWeight: 800, mb: 1 }}>
                    AI Multi-Horizon Sales Forecast (p10 / p50 / p90)
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#9ca3af', mb: 3 }}>
                    Autoregressive predictive projection with lower and upper confidence bands
                  </Typography>
                  <Box sx={{ height: 260, width: '100%' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart
                        data={aiForecast?.dataPoints || []}
                        margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                        <XAxis dataKey="date" stroke="#9ca3af" style={{ fontSize: 11 }} />
                        <YAxis stroke="#9ca3af" style={{ fontSize: 11 }} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: '#111827',
                            border: '1px solid rgba(255,255,255,0.1)',
                          }}
                        />
                        <Area
                          type="monotone"
                          dataKey="confidenceUpper"
                          name="Upper Band (p90)"
                          stroke="#60a5fa"
                          fill="rgba(96,165,250,0.15)"
                        />
                        <Area
                          type="monotone"
                          dataKey="forecast"
                          name="Forecast Point (p50)"
                          stroke="#a78bfa"
                          strokeWidth={2}
                          fill="transparent"
                        />
                        <Area
                          type="monotone"
                          dataKey="confidenceLower"
                          name="Lower Floor (p10)"
                          stroke="#f87171"
                          fill="transparent"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            {/* What-If Simulators Section */}
            <Grid item xs={12} md={6}>
              <Card className="glass-panel" sx={{ p: 3, borderRadius: '16px' }}>
                <CardContent>
                  <Typography variant="h6" sx={{ fontWeight: 800, mb: 1 }}>
                    What-If Price Elasticity Simulator
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#9ca3af', mb: 2 }}>
                    Simulate price changes and view estimated volume, revenue, and margin impact
                  </Typography>
                  <Box sx={{ px: 2, mb: 2 }}>
                    <Typography variant="caption" sx={{ color: '#a78bfa', fontWeight: 700 }}>
                      Price Adjustment:{' '}
                      {priceChangePct > 0 ? `+${priceChangePct}%` : `${priceChangePct}%`}
                    </Typography>
                    <Slider
                      value={priceChangePct}
                      min={-15}
                      max={15}
                      step={5}
                      marks
                      valueLabelDisplay="auto"
                      onChange={(_, val) => setPriceChangePct(val as number)}
                      color="secondary"
                    />
                  </Box>
                  <Button
                    variant="contained"
                    color="secondary"
                    onClick={handleRunPriceSimulation}
                    sx={{ borderRadius: '10px', textTransform: 'none', fontWeight: 700 }}
                  >
                    Simulate Price Impact
                  </Button>
                  {simulatedPriceResult && (
                    <Box
                      sx={{
                        mt: 2,
                        p: 1.5,
                        background: 'rgba(255,255,255,0.03)',
                        borderRadius: '10px',
                      }}
                    >
                      <Typography variant="caption" sx={{ display: 'block' }}>
                        Simulated Price:{' '}
                        <strong>{formatAmount(simulatedPriceResult.simulatedPrice)}</strong> |
                        Volume Impact:{' '}
                        <strong>{simulatedPriceResult.estimatedVolumeChangePct}%</strong>
                      </Typography>
                      <Typography
                        variant="caption"
                        sx={{ display: 'block', color: '#10b981', fontWeight: 700 }}
                      >
                        Estimated Revenue Impact:{' '}
                        {formatAmount(simulatedPriceResult.estimatedRevenueImpact)}
                      </Typography>
                    </Box>
                  )}
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} md={6}>
              <Card className="glass-panel" sx={{ p: 3, borderRadius: '16px' }}>
                <CardContent>
                  <Typography variant="h6" sx={{ fontWeight: 800, mb: 1 }}>
                    What-If Inventory Reorder Simulator
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#9ca3af', mb: 2 }}>
                    Test stock order sizes against days of supply and capital exposure
                  </Typography>
                  <Box sx={{ px: 2, mb: 2 }}>
                    <Typography variant="caption" sx={{ color: '#60a5fa', fontWeight: 700 }}>
                      Order Size: {inventoryReorderUnits} Units
                    </Typography>
                    <Slider
                      value={inventoryReorderUnits}
                      min={50}
                      max={1000}
                      step={50}
                      valueLabelDisplay="auto"
                      onChange={(_, val) => setInventoryReorderUnits(val as number)}
                    />
                  </Box>
                  <Button
                    variant="contained"
                    color="primary"
                    onClick={handleRunInventorySimulation}
                    sx={{ borderRadius: '10px', textTransform: 'none', fontWeight: 700 }}
                  >
                    Simulate Reorder Impact
                  </Button>
                  {simulatedInvResult && (
                    <Box
                      sx={{
                        mt: 2,
                        p: 1.5,
                        background: 'rgba(255,255,255,0.03)',
                        borderRadius: '10px',
                      }}
                    >
                      <Typography variant="caption" sx={{ display: 'block' }}>
                        Capital Exposure:{' '}
                        <strong>{formatAmount(simulatedInvResult.capitalTiedUp)}</strong> |
                        Coverage:{' '}
                        <strong>{simulatedInvResult.projectedStockCoverageDays} days</strong>
                      </Typography>
                      <Typography
                        variant="caption"
                        sx={{ display: 'block', color: '#34d399', fontWeight: 700 }}
                      >
                        Stockout Risk Reduced by:{' '}
                        {simulatedInvResult.projectedStockoutRiskReductionPct}%
                      </Typography>
                    </Box>
                  )}
                </CardContent>
              </Card>
            </Grid>

            {/* AI Executive Assistant Conversational Hub */}
            <Grid item xs={12}>
              <Card className="glass-panel" sx={{ p: 3, borderRadius: '16px' }}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
                    <AutoAwesomeIcon sx={{ color: '#a78bfa' }} />
                    <Typography variant="h6" sx={{ fontWeight: 800 }}>
                      Executive Strategic Assistant
                    </Typography>
                    <Chip
                      label="Zero Trust Scoped"
                      size="small"
                      variant="outlined"
                      sx={{ ml: 'auto' }}
                    />
                  </Box>

                  {/* Chat Message Window */}
                  <Box
                    sx={{
                      maxHeight: 300,
                      overflowY: 'auto',
                      mb: 2,
                      p: 2,
                      background: 'rgba(0,0,0,0.25)',
                      borderRadius: '12px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 2,
                    }}
                  >
                    {chatHistory.map((msg, i) => (
                      <Box
                        key={i}
                        sx={{
                          alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                          maxWidth: '85%',
                          p: 1.5,
                          borderRadius: '12px',
                          background: msg.role === 'user' ? '#6366f1' : 'rgba(255,255,255,0.05)',
                          color: '#f3f4f6',
                        }}
                      >
                        <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                          {msg.text}
                        </Typography>
                        {msg.confidence && (
                          <Chip
                            label={`Confidence: ${msg.confidence}`}
                            size="small"
                            sx={{ mt: 1, height: 20, fontSize: 10 }}
                          />
                        )}
                      </Box>
                    ))}
                  </Box>

                  {/* Prompt Form */}
                  <Box
                    component="form"
                    onSubmit={handleSendPrompt}
                    sx={{ display: 'flex', gap: 1.5 }}
                  >
                    <TextField
                      fullWidth
                      size="small"
                      placeholder="Ask questions (e.g. 'How is business performing today?', 'Which branch is performing best?')..."
                      value={aiPrompt}
                      onChange={(e) => setAiPrompt(e.target.value)}
                      sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px' } }}
                    />
                    <Button
                      type="submit"
                      variant="contained"
                      color="secondary"
                      disabled={aiMutation.isPending}
                      endIcon={<SendIcon />}
                      sx={{ borderRadius: '10px', px: 3, textTransform: 'none', fontWeight: 700 }}
                    >
                      {aiMutation.isPending ? 'Analyzing...' : 'Ask AI'}
                    </Button>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        )}

        {/* Export Center Dialog */}
        <Dialog open={isExportOpen} onClose={() => setIsExportOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle sx={{ fontWeight: 800 }}>Export Business Intelligence Report</DialogTitle>
          <DialogContent>
            <Typography variant="body2" sx={{ color: '#9ca3af', mb: 3 }}>
              Select report format. Large multi-branch datasets are processed with high-throughput
              background queues.
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Button
                variant="outlined"
                color="secondary"
                startIcon={<DownloadIcon />}
                onClick={handleExportCsv}
                sx={{ borderRadius: '10px', py: 1.5, textTransform: 'none', fontWeight: 700 }}
              >
                Download CSV Spreadsheet Report
              </Button>
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setIsExportOpen(false)}>Cancel</Button>
          </DialogActions>
        </Dialog>
      </motion.div>
    </Box>
  );
}
