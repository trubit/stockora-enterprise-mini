import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
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
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import MonetizationOnIcon from '@mui/icons-material/MonetizationOn';
import PieChartIcon from '@mui/icons-material/PieChart';
import DownloadIcon from '@mui/icons-material/Download';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';
import { motion } from 'framer-motion';
import { apiClient } from '../../api/client.ts';
import PageHeader from '../../components/PageHeader.tsx';
import StatCard from '../../components/StatCard.tsx';
import toast from 'react-hot-toast';
import { useRegionalSettings } from '../../hooks/useRegionalSettings.js';

const EXPENSE_COLORS = ['#8b5cf6', '#ef4444', '#f59e0b', '#3b82f6', '#10b981', '#06b6d4'];

export default function FinancialAnalyticsView() {
  const { formatAmount } = useRegionalSettings();
  const [period, setPeriod] = useState('30_DAYS');
  const [isExporting, setIsExporting] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['bi-financial-analytics', period],
    queryFn: async () => {
      const res = await apiClient.get(`/analytics/finance?period=${period}`);
      return res.data;
    },
  });

  const handleExport = async () => {
    try {
      setIsExporting(true);
      const res = await apiClient.post(
        '/analytics/export',
        { domain: 'FINANCE', format: 'CSV', period },
        { responseType: 'blob' }
      );
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `stockora_financial_analytics_${Date.now()}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success('Financial analytics exported successfully!');
    } catch {
      toast.error('Failed to export financial report');
    } finally {
      setIsExporting(false);
    }
  };

  if (isLoading || !data) {
    return (
      <Box sx={{ p: 4 }}>
        <LinearProgress color="primary" sx={{ borderRadius: 4, height: 6 }} />
        <Typography variant="body2" color="text.secondary" sx={{ mt: 2, textAlign: 'center' }}>
          Loading financial profit margins and operating expense allocations...
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
            title="Financial Analytics & Profit Margins"
            subtitle="Gross profit & net margins, operating expense ratios, category profitability & operational cash flow visibility"
            category="Business Intelligence"
          />
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
            <FormControl size="small" sx={{ minWidth: 150 }}>
              <InputLabel sx={{ color: 'text.secondary' }}>Date Horizon</InputLabel>
              <Select
                value={period}
                label="Date Horizon"
                onChange={(e) => setPeriod(e.target.value)}
              >
                <MenuItem value="THIS_MONTH">This Month</MenuItem>
                <MenuItem value="LAST_MONTH">Last Month</MenuItem>
                <MenuItem value="THIS_QUARTER">This Quarter</MenuItem>
                <MenuItem value="THIS_YEAR">This Year</MenuItem>
                <MenuItem value="30_DAYS">Last 30 Days</MenuItem>
                <MenuItem value="90_DAYS">Last 90 Days</MenuItem>
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

        {/* 4 Core Financial Stat Cards */}
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid item xs={12} sm={6} md={3}>
            <StatCard
              title="GROSS PROFIT"
              value={formatAmount(data.grossProfit || 0)}
              subtitle={`${data.grossMarginPct || 0}% gross margin`}
              icon={<TrendingUpIcon />}
              color="emerald"
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <StatCard
              title="NET PROFIT (EST)"
              value={formatAmount(data.netProfitEst || 0)}
              subtitle={`${data.netMarginPct || 0}% estimated net margin`}
              icon={<MonetizationOnIcon />}
              color="violet"
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <StatCard
              title="OPERATING EXPENSES"
              value={formatAmount(data.operatingExpenses || 0)}
              subtitle={`${data.expenseRatioPct || 0}% expense ratio`}
              icon={<PieChartIcon />}
              color="rose"
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <StatCard
              title="NET CASH MOVEMENT"
              value={formatAmount(data.cashFlowVisibility?.netCashMovement || 0)}
              subtitle="Operational cash flow"
              icon={<AccountBalanceWalletIcon />}
              color="sky"
            />
          </Grid>
        </Grid>

        {/* Cash Flow Statement & Expense Breakdown */}
        <Grid container spacing={3} sx={{ mb: 4 }}>
          {/* Operational Cash Flow Card */}
          <Grid item xs={12} lg={6}>
            <Card className="glass-panel" sx={{ borderRadius: '16px', p: 3, height: '100%' }}>
              <CardContent>
                <Typography variant="h6" sx={{ fontWeight: 800, mb: 1 }}>
                  Operational Cash-Flow Visibility
                </Typography>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ display: 'block', mb: 3 }}
                >
                  Inflow vs Outflow tracking derived from actual POS settlement receipts and paid
                  expense disbursements
                </Typography>

                <Grid container spacing={2} sx={{ mb: 3 }}>
                  <Grid item xs={6}>
                    <Box
                      sx={{
                        p: 2,
                        borderRadius: '12px',
                        bgcolor: 'rgba(16, 185, 129, 0.08)',
                        border: '1px solid rgba(16, 185, 129, 0.2)',
                      }}
                    >
                      <Typography
                        variant="caption"
                        sx={{ color: 'success.light', fontWeight: 800 }}
                      >
                        CASH INFLOW
                      </Typography>
                      <Typography variant="h6" sx={{ fontWeight: 800, color: 'success.light' }}>
                        +{formatAmount(data.cashFlowVisibility?.cashInflow || 0)}
                      </Typography>
                    </Box>
                  </Grid>
                  <Grid item xs={6}>
                    <Box
                      sx={{
                        p: 2,
                        borderRadius: '12px',
                        bgcolor: 'rgba(239, 68, 68, 0.08)',
                        border: '1px solid rgba(239, 68, 68, 0.2)',
                      }}
                    >
                      <Typography variant="caption" sx={{ color: 'error.light', fontWeight: 800 }}>
                        CASH OUTFLOW
                      </Typography>
                      <Typography variant="h6" sx={{ fontWeight: 800, color: 'error.light' }}>
                        -{formatAmount(data.cashFlowVisibility?.cashOutflow || 0)}
                      </Typography>
                    </Box>
                  </Grid>
                </Grid>

                <Box
                  sx={{
                    p: 2,
                    borderRadius: '12px',
                    bgcolor: 'rgba(255,255,255,0.02)',
                    border: '1px solid rgba(255,255,255,0.05)',
                  }}
                >
                  <Box
                    sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                  >
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>
                      Net Cash Surplus / Movement:
                    </Typography>
                    <Typography
                      variant="subtitle1"
                      sx={{
                        fontWeight: 800,
                        color:
                          (data.cashFlowVisibility?.netCashMovement || 0) >= 0
                            ? 'success.light'
                            : 'error.light',
                      }}
                    >
                      {formatAmount(data.cashFlowVisibility?.netCashMovement || 0)}
                    </Typography>
                  </Box>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ display: 'block', mt: 1 }}
                  >
                    {data.cashFlowVisibility?.disclaimer}
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          {/* Operating Expense Breakdown */}
          <Grid item xs={12} lg={6}>
            <Card className="glass-panel" sx={{ borderRadius: '16px', p: 3, height: '100%' }}>
              <CardContent>
                <Typography variant="h6" sx={{ fontWeight: 800, mb: 1 }}>
                  Operating Expense Distribution
                </Typography>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ display: 'block', mb: 2 }}
                >
                  Categorized OPEX disbursements
                </Typography>

                <Box sx={{ height: 200, width: '100%' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={data.expenseBreakdown || []}
                        dataKey="amount"
                        nameKey="category"
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={80}
                        paddingAngle={4}
                      >
                        {(data.expenseBreakdown || []).map((_: any, index: number) => (
                          <Cell
                            key={`exp-cell-${index}`}
                            fill={EXPENSE_COLORS[index % EXPENSE_COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#111827',
                          borderColor: '#374151',
                          borderRadius: '8px',
                        }}
                        formatter={(val: any) => [formatAmount(Number(val)), 'Amount']}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </Box>

                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.8, mt: 1 }}>
                  {(data.expenseBreakdown || []).map((e: any, idx: number) => (
                    <Box
                      key={e.category}
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
                            width: 8,
                            height: 8,
                            borderRadius: '50%',
                            bgcolor: EXPENSE_COLORS[idx % EXPENSE_COLORS.length],
                          }}
                        />
                        <Typography variant="caption" sx={{ fontWeight: 600 }}>
                          {e.category}
                        </Typography>
                      </Box>
                      <Typography variant="caption" sx={{ fontWeight: 700 }}>
                        {formatAmount(e.amount)} ({e.percentage}%)
                      </Typography>
                    </Box>
                  ))}
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Profit by Category & Profit by Branch */}
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Card className="glass-panel" sx={{ borderRadius: '16px', p: 3 }}>
              <CardContent>
                <Typography variant="h6" sx={{ fontWeight: 800, mb: 1 }}>
                  Profitability By Product Category
                </Typography>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ display: 'block', mb: 3 }}
                >
                  Revenue and gross margin performance across inventory lines
                </Typography>

                <TableContainer
                  component={Paper}
                  sx={{ bgcolor: 'transparent', boxShadow: 'none' }}
                >
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ color: 'text.secondary', fontWeight: 700 }}>
                          Category
                        </TableCell>
                        <TableCell align="right" sx={{ color: 'text.secondary', fontWeight: 700 }}>
                          Revenue
                        </TableCell>
                        <TableCell align="right" sx={{ color: 'text.secondary', fontWeight: 700 }}>
                          Gross Profit
                        </TableCell>
                        <TableCell align="right" sx={{ color: 'text.secondary', fontWeight: 700 }}>
                          Margin %
                        </TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {(data.profitByCategory || []).map((cat: any) => (
                        <TableRow key={cat.category} hover>
                          <TableCell sx={{ fontWeight: 700 }}>{cat.category}</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 600 }}>
                            {formatAmount(Math.round(cat.revenue))}
                          </TableCell>
                          <TableCell align="right" sx={{ fontWeight: 700, color: 'success.light' }}>
                            {formatAmount(Math.round(cat.profit))}
                          </TableCell>
                          <TableCell align="right">
                            <Chip
                              label={`${cat.marginPct}%`}
                              size="small"
                              sx={{
                                bgcolor: 'rgba(16, 185, 129, 0.15)',
                                color: '#10b981',
                                fontWeight: 700,
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

          <Grid item xs={12} md={6}>
            <Card className="glass-panel" sx={{ borderRadius: '16px', p: 3 }}>
              <CardContent>
                <Typography variant="h6" sx={{ fontWeight: 800, mb: 1 }}>
                  Branch Profit Margins & Contribution
                </Typography>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ display: 'block', mb: 3 }}
                >
                  Operating margin distribution across store locations
                </Typography>

                <TableContainer
                  component={Paper}
                  sx={{ bgcolor: 'transparent', boxShadow: 'none' }}
                >
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ color: 'text.secondary', fontWeight: 700 }}>
                          Branch
                        </TableCell>
                        <TableCell align="right" sx={{ color: 'text.secondary', fontWeight: 700 }}>
                          Revenue
                        </TableCell>
                        <TableCell align="right" sx={{ color: 'text.secondary', fontWeight: 700 }}>
                          Profit
                        </TableCell>
                        <TableCell align="right" sx={{ color: 'text.secondary', fontWeight: 700 }}>
                          Margin %
                        </TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {(data.profitByBranch || []).map((b: any) => (
                        <TableRow key={b.branchName} hover>
                          <TableCell sx={{ fontWeight: 700 }}>{b.branchName}</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 600 }}>
                            {formatAmount(Math.round(b.revenue))}
                          </TableCell>
                          <TableCell align="right" sx={{ fontWeight: 700, color: 'primary.light' }}>
                            {formatAmount(Math.round(b.profit))}
                          </TableCell>
                          <TableCell align="right">
                            <Chip
                              label={`${b.marginPct}%`}
                              size="small"
                              sx={{
                                bgcolor: 'rgba(139, 92, 246, 0.15)',
                                color: '#a78bfa',
                                fontWeight: 700,
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
      </motion.div>
    </Box>
  );
}
