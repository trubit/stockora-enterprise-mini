import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  LinearProgress,
  Button,
  ButtonGroup,
} from '@mui/material';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import MonetizationOnIcon from '@mui/icons-material/MonetizationOn';
import PeopleIcon from '@mui/icons-material/People';
import DownloadIcon from '@mui/icons-material/Download';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { motion } from 'framer-motion';
import { apiClient } from '../../api/client.ts';
import PageHeader from '../../components/PageHeader.tsx';
import StatCard from '../../components/StatCard.tsx';
import toast from 'react-hot-toast';
import { useRegionalSettings } from '../../hooks/useRegionalSettings.js';

const PIE_COLORS = ['#8b5cf6', '#10b981', '#3b82f6', '#f59e0b', '#ec4899', '#06b6d4'];

export default function SalesAnalyticsView() {
  const { formatAmount, currencySymbol } = useRegionalSettings();
  const [period, setPeriod] = useState('30_DAYS');
  const [comparison, setComparison] = useState('PREVIOUS_PERIOD');
  const [topLimit, setTopLimit] = useState(10);
  const [isExporting, setIsExporting] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['bi-sales-analytics', period, comparison, topLimit],
    queryFn: async () => {
      const res = await apiClient.get(
        `/analytics/sales?period=${period}&comparison=${comparison}&limit=${topLimit}`
      );
      return res.data;
    },
  });

  const handleExport = async () => {
    try {
      setIsExporting(true);
      const res = await apiClient.post(
        '/analytics/export',
        { domain: 'SALES', format: 'CSV', period },
        { responseType: 'blob' }
      );
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `stockora_sales_analytics_${period}_${Date.now()}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success('Sales analytics exported successfully!');
    } catch {
      toast.error('Failed to export sales report');
    } finally {
      setIsExporting(false);
    }
  };

  if (isLoading || !data) {
    return (
      <Box sx={{ p: 4 }}>
        <LinearProgress color="primary" sx={{ borderRadius: 4, height: 6 }} />
        <Typography variant="body2" color="text.secondary" sx={{ mt: 2, textAlign: 'center' }}>
          Loading authoritative sales intelligence streams...
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 2, md: 4 } }}>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        {/* Header with Period Selectors */}
        <Box
          sx={{
            display: 'flex',
            flexDirection: { xs: 'column', md: 'row' },
            justifyContent: 'space-between',
            alignItems: { md: 'center' },
            gap: 2,
            mb: 4,
          }}
        >
          <PageHeader
            title="Sales Intelligence & Performance Analytics"
            subtitle="Authoritative transaction velocity, product performance rankings, payment distribution & channel insights"
            category="Business Intelligence"
          />
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center' }}>
            <FormControl size="small" sx={{ minWidth: 150 }}>
              <InputLabel sx={{ color: 'text.secondary' }}>Date Horizon</InputLabel>
              <Select
                value={period}
                label="Date Horizon"
                onChange={(e) => setPeriod(e.target.value)}
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

            <FormControl size="small" sx={{ minWidth: 160 }}>
              <InputLabel sx={{ color: 'text.secondary' }}>Benchmark vs</InputLabel>
              <Select
                value={comparison}
                label="Benchmark vs"
                onChange={(e) => setComparison(e.target.value)}
              >
                <MenuItem value="PREVIOUS_PERIOD">Previous Period</MenuItem>
                <MenuItem value="PREVIOUS_MONTH">Previous Month</MenuItem>
                <MenuItem value="PREVIOUS_QUARTER">Previous Quarter</MenuItem>
                <MenuItem value="PREVIOUS_YEAR">Same Period Last Year</MenuItem>
              </Select>
            </FormControl>

            <Button
              variant="outlined"
              startIcon={<DownloadIcon />}
              onClick={handleExport}
              disabled={isExporting}
              sx={{
                borderColor: 'rgba(139, 92, 246, 0.4)',
                color: '#a78bfa',
                '&:hover': { borderColor: '#8b5cf6', bgcolor: 'rgba(139, 92, 246, 0.08)' },
              }}
            >
              Export CSV
            </Button>
          </Box>
        </Box>

        {/* 4 Core Metric KPI Stat Cards */}
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid item xs={12} sm={6} md={3}>
            <StatCard
              title="GROSS SALES"
              value={formatAmount(data.grossSales || 0)}
              subtitle={`+${data.salesGrowthPct || 0}% vs benchmark`}
              icon={<TrendingUpIcon />}
              color="emerald"
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <StatCard
              title="NET REVENUE"
              value={formatAmount(data.netSales || 0)}
              subtitle={`After ${formatAmount(data.discounts || 0)} in discounts`}
              icon={<MonetizationOnIcon />}
              color="violet"
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <StatCard
              title="TOTAL ORDERS"
              value={(data.totalOrders || 0).toLocaleString()}
              subtitle={`${(data.unitsSold || 0).toLocaleString()} units fulfilled`}
              icon={<ShoppingCartIcon />}
              color="sky"
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <StatCard
              title="AVERAGE BASKET (AOV)"
              value={formatAmount(data.averageOrderValue || 0)}
              subtitle="Per checkout ticket"
              icon={<PeopleIcon />}
              color="amber"
            />
          </Grid>
        </Grid>

        {/* Sales Trend Time Series Chart */}
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid item xs={12} lg={8}>
            <Card className="glass-panel" sx={{ borderRadius: '16px', p: 3, height: '100%' }}>
              <CardContent>
                <Box
                  sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    mb: 3,
                  }}
                >
                  <Box>
                    <Typography variant="h6" sx={{ fontWeight: 800 }}>
                      Authoritative Sales Velocity Over Time
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Multi-tenant scoped revenue streams with comparative period overlay
                    </Typography>
                  </Box>
                  <Chip
                    label="Deterministic Aggregation"
                    color="primary"
                    size="small"
                    sx={{ fontWeight: 700 }}
                  />
                </Box>

                <Box sx={{ height: 320, width: '100%' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={data.salesOverTime || []}
                      margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.4} />
                          <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.0} />
                        </linearGradient>
                        <linearGradient id="compGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2} />
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                      <XAxis dataKey="label" stroke="#9ca3af" style={{ fontSize: 11 }} />
                      <YAxis
                        stroke="#9ca3af"
                        style={{ fontSize: 11 }}
                        tickFormatter={(val) => formatAmount(val)}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#111827',
                          borderColor: '#374151',
                          borderRadius: '8px',
                          color: '#f3f4f6',
                        }}
                        formatter={(val: any) => [formatAmount(Number(val)), 'Revenue']}
                      />
                      <Legend />
                      <Area
                        type="monotone"
                        dataKey="revenue"
                        name={`Current Period (${currencySymbol})`}
                        stroke="#8b5cf6"
                        strokeWidth={3}
                        fillOpacity={1}
                        fill="url(#salesGrad)"
                      />
                      <Area
                        type="monotone"
                        dataKey="comparisonRevenue"
                        name={`Comparison Period (${currencySymbol})`}
                        stroke="#3b82f6"
                        strokeWidth={2}
                        strokeDasharray="4 4"
                        fillOpacity={1}
                        fill="url(#compGrad)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          {/* Payment Methods Distribution */}
          <Grid item xs={12} lg={4}>
            <Card className="glass-panel" sx={{ borderRadius: '16px', p: 3, height: '100%' }}>
              <CardContent>
                <Typography variant="h6" sx={{ fontWeight: 800, mb: 1 }}>
                  Payment Method Split
                </Typography>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ display: 'block', mb: 2 }}
                >
                  Processed volume by checkout channel
                </Typography>

                <Box sx={{ height: 220, width: '100%' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={data.paymentMethods || []}
                        dataKey="volume"
                        nameKey="method"
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={85}
                        paddingAngle={4}
                      >
                        {(data.paymentMethods || []).map((_: any, index: number) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={PIE_COLORS[index % PIE_COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#111827',
                          borderColor: '#374151',
                          borderRadius: '8px',
                        }}
                        formatter={(val: any) => [formatAmount(Number(val)), 'Volume']}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </Box>

                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mt: 1 }}>
                  {(data.paymentMethods || []).map((pm: any, idx: number) => (
                    <Box
                      key={pm.method}
                      sx={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        fontSize: '0.8rem',
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Box
                          sx={{
                            width: 10,
                            height: 10,
                            borderRadius: '50%',
                            bgcolor: PIE_COLORS[idx % PIE_COLORS.length],
                          }}
                        />
                        <Typography variant="caption" sx={{ fontWeight: 600 }}>
                          {pm.method}
                        </Typography>
                      </Box>
                      <Typography variant="caption" sx={{ fontWeight: 700 }}>
                        {formatAmount(pm.volume || 0)} ({pm.count} txs)
                      </Typography>
                    </Box>
                  ))}
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Best-Sellers Ranking & Worst Performers */}
        <Grid container spacing={3} sx={{ mb: 4 }}>
          {/* Best Sellers */}
          <Grid item xs={12} lg={7}>
            <Card className="glass-panel" sx={{ borderRadius: '16px', p: 3 }}>
              <CardContent>
                <Box
                  sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    mb: 3,
                  }}
                >
                  <Box>
                    <Typography variant="h6" sx={{ fontWeight: 800 }}>
                      Top Best-Selling Products
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Ranked by gross revenue, units sold & profit contribution
                    </Typography>
                  </Box>
                  <ButtonGroup size="small" sx={{ borderColor: 'rgba(255,255,255,0.1)' }}>
                    <Button
                      variant={topLimit === 5 ? 'contained' : 'outlined'}
                      onClick={() => setTopLimit(5)}
                    >
                      Top 5
                    </Button>
                    <Button
                      variant={topLimit === 10 ? 'contained' : 'outlined'}
                      onClick={() => setTopLimit(10)}
                    >
                      Top 10
                    </Button>
                    <Button
                      variant={topLimit === 20 ? 'contained' : 'outlined'}
                      onClick={() => setTopLimit(20)}
                    >
                      Top 20
                    </Button>
                  </ButtonGroup>
                </Box>

                <TableContainer
                  component={Paper}
                  sx={{ bgcolor: 'transparent', boxShadow: 'none' }}
                >
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ color: 'text.secondary', fontWeight: 700 }}>
                          Product / SKU
                        </TableCell>
                        <TableCell align="right" sx={{ color: 'text.secondary', fontWeight: 700 }}>
                          Units Sold
                        </TableCell>
                        <TableCell align="right" sx={{ color: 'text.secondary', fontWeight: 700 }}>
                          Revenue
                        </TableCell>
                        <TableCell align="right" sx={{ color: 'text.secondary', fontWeight: 700 }}>
                          Margin %
                        </TableCell>
                        <TableCell align="right" sx={{ color: 'text.secondary', fontWeight: 700 }}>
                          Return Rate
                        </TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {(data.bestSellers || []).map((item: any) => (
                        <TableRow
                          key={item.productId}
                          hover
                          sx={{ '&:last-child td, &:last-child th': { border: 0 } }}
                        >
                          <TableCell>
                            <Typography variant="body2" sx={{ fontWeight: 700 }}>
                              {item.name}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {item.sku}
                            </Typography>
                          </TableCell>
                          <TableCell align="right" sx={{ fontWeight: 600 }}>
                            {item.unitsSold}
                          </TableCell>
                          <TableCell align="right" sx={{ fontWeight: 700, color: 'success.light' }}>
                            {formatAmount(item.revenue || 0)}
                          </TableCell>
                          <TableCell align="right">
                            <Chip
                              label={`${item.marginPct}%`}
                              size="small"
                              sx={{
                                bgcolor: 'rgba(16, 185, 129, 0.15)',
                                color: '#10b981',
                                fontWeight: 700,
                                fontSize: '0.72rem',
                              }}
                            />
                          </TableCell>
                          <TableCell
                            align="right"
                            sx={{ color: 'text.secondary', fontSize: '0.8rem' }}
                          >
                            {item.returnRatePct}%
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </CardContent>
            </Card>
          </Grid>

          {/* Worst-Performing & Slow Movement Analysis */}
          <Grid item xs={12} lg={5}>
            <Card className="glass-panel" sx={{ borderRadius: '16px', p: 3 }}>
              <CardContent>
                <Typography variant="h6" sx={{ fontWeight: 800, mb: 1 }}>
                  Underperforming Catalog Items
                </Typography>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ display: 'block', mb: 3 }}
                >
                  Items with low sales velocity, stagnant movement or elevated return rates
                </Typography>

                <TableContainer
                  component={Paper}
                  sx={{ bgcolor: 'transparent', boxShadow: 'none' }}
                >
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ color: 'text.secondary', fontWeight: 700 }}>SKU</TableCell>
                        <TableCell align="right" sx={{ color: 'text.secondary', fontWeight: 700 }}>
                          Units
                        </TableCell>
                        <TableCell align="right" sx={{ color: 'text.secondary', fontWeight: 700 }}>
                          Returns
                        </TableCell>
                        <TableCell align="right" sx={{ color: 'text.secondary', fontWeight: 700 }}>
                          Status
                        </TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {(data.worstPerformers || []).map((item: any) => (
                        <TableRow
                          key={item.productId}
                          hover
                          sx={{ '&:last-child td, &:last-child th': { border: 0 } }}
                        >
                          <TableCell>
                            <Typography variant="body2" sx={{ fontWeight: 700 }}>
                              {item.name}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {item.sku}
                            </Typography>
                          </TableCell>
                          <TableCell align="right" sx={{ fontWeight: 600 }}>
                            {item.unitsSold}
                          </TableCell>
                          <TableCell align="right" sx={{ color: 'error.light', fontWeight: 700 }}>
                            {item.returnRatePct}%
                          </TableCell>
                          <TableCell align="right">
                            <Chip
                              label={item.status}
                              size="small"
                              sx={{
                                bgcolor:
                                  item.status === 'DECLINING'
                                    ? 'rgba(239, 68, 68, 0.15)'
                                    : 'rgba(245, 158, 11, 0.15)',
                                color: item.status === 'DECLINING' ? '#ef4444' : '#f59e0b',
                                fontWeight: 700,
                                fontSize: '0.7rem',
                              }}
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

        {/* Employee & Cashier Performance */}
        <Grid container spacing={3}>
          <Grid item xs={12} md={7}>
            <Card className="glass-panel" sx={{ borderRadius: '16px', p: 3 }}>
              <CardContent>
                <Typography variant="h6" sx={{ fontWeight: 800, mb: 1 }}>
                  Cashier & Sales Rep Performance
                </Typography>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ display: 'block', mb: 3 }}
                >
                  Role-governed operational breakdown across sales volume, ticket size & discounts
                </Typography>

                <Box sx={{ height: 260, width: '100%' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={data.employeeSales || []}
                      margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                      <XAxis dataKey="cashierName" stroke="#9ca3af" style={{ fontSize: 11 }} />
                      <YAxis
                        stroke="#9ca3af"
                        style={{ fontSize: 11 }}
                        tickFormatter={(val) => `$${val.toLocaleString()}`}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#111827',
                          borderColor: '#374151',
                          borderRadius: '8px',
                        }}
                      />
                      <Bar
                        dataKey="totalSales"
                        name="Sales Generated ($)"
                        fill="#8b5cf6"
                        radius={[6, 6, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          {/* Discount & Return Insights */}
          <Grid item xs={12} md={5}>
            <Card className="glass-panel" sx={{ borderRadius: '16px', p: 3 }}>
              <CardContent>
                <Typography variant="h6" sx={{ fontWeight: 800, mb: 2 }}>
                  Discounts & Return Intelligence
                </Typography>

                <Box
                  sx={{
                    mb: 3,
                    p: 2,
                    borderRadius: '12px',
                    bgcolor: 'rgba(255,255,255,0.02)',
                    border: '1px solid rgba(255,255,255,0.05)',
                  }}
                >
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="body2" color="text.secondary">
                      Total Discounts Applied:
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 800, color: 'warning.light' }}>
                      ${(data.discountAnalytics?.totalDiscount || 0).toLocaleString()} (
                      {data.discountAnalytics?.discountRatePct || 0}%)
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2" color="text.secondary">
                      Return Rate Threshold:
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 800, color: 'error.light' }}>
                      {data.returnAnalytics?.returnRatePct || 0}% (
                      {data.returnAnalytics?.returnCount || 0} items)
                    </Typography>
                  </Box>
                </Box>

                <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
                  Primary Return Reasons
                </Typography>
                {(data.returnAnalytics?.topReasons || []).map((reason: any) => (
                  <Box
                    key={reason.reason}
                    sx={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      py: 0.8,
                      borderBottom: '1px solid rgba(255,255,255,0.03)',
                    }}
                  >
                    <Typography variant="caption" sx={{ fontWeight: 600 }}>
                      {reason.reason}
                    </Typography>
                    <Chip
                      label={`${reason.count} cases`}
                      size="small"
                      sx={{ fontSize: '0.7rem', height: 20, bgcolor: 'rgba(255,255,255,0.05)' }}
                    />
                  </Box>
                ))}
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </motion.div>
    </Box>
  );
}
