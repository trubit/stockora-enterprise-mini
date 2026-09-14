import { useQuery } from '@tanstack/react-query';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
} from '@mui/material';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import { apiClient } from '../../api/client.ts';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { motion } from 'framer-motion';
import { useRegionalSettings } from '../../hooks/useRegionalSettings.js';

interface FinancialData {
  revenue: number;
  cogs: number;
  grossProfit: number;
  salesTaxCollected: number;
  balanceSheet: {
    inventoryValuation: number;
    cashOnHand: number;
    totalAssets: number;
    accountsPayable: number;
    equity: number;
  };
  cashFlow: {
    inflow: number;
    outflow: number;
    netCashFlow: number;
  };
  bestSellers: {
    name: string;
    sku: string;
    qty: number;
    revenue: number;
  }[];
  paymentMethods: { [key: string]: number };
}

export default function FinancialReports() {
  const { formatAmount } = useRegionalSettings();
  const { data: reports, isLoading } = useQuery<FinancialData>({
    queryKey: ['financial-reports'],
    queryFn: async () => {
      const res = await apiClient.get<any>('/finance/reports');
      const payload = res.data?.data || res.data || {};
      return {
        revenue: payload.revenue || 0,
        cogs: payload.cogs || 0,
        grossProfit: payload.grossProfit || 0,
        salesTaxCollected: payload.taxSummary?.netTaxLiability || payload.salesTaxCollected || 0,
        balanceSheet: {
          inventoryValuation: payload.balanceSheet?.inventoryValuation || 0,
          cashOnHand: payload.balanceSheet?.totalAssets || 0,
          totalAssets: payload.balanceSheet?.totalAssets || 0,
          accountsPayable: payload.balanceSheet?.totalLiabilities || 0,
          equity: payload.balanceSheet?.totalEquity || 0,
        },
        cashFlow: payload.cashFlow || {
          inflow: payload.revenue || 0,
          outflow: payload.cogs || 0,
          netCashFlow: (payload.revenue || 0) - (payload.cogs || 0),
        },
        bestSellers: payload.bestSellers || [],
        paymentMethods: payload.paymentMethods || { Cash: 0, Card: 0, Online: 0 },
      };
    },
  });

  if (isLoading || !reports) {
    return (
      <Box sx={{ p: 4, textAlign: 'center' }}>
        <Typography color="text.secondary">Loading financial statements...</Typography>
      </Box>
    );
  }

  // Prep payment charts data safely
  const paymentChartData = Object.keys(reports.paymentMethods || {}).map((method) => ({
    name: method,
    Amount: reports.paymentMethods[method] || 0,
  }));

  return (
    <Box sx={{ p: { xs: 2, md: 4 } }}>
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <Box sx={{ mb: 4 }}>
          <Typography
            variant="h4"
            sx={{
              fontWeight: 800,
              background: 'linear-gradient(90deg, #fff 0%, #a78bfa 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            Financial Intelligence & Reports
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Access corporate Profit and Loss statements, Balance Sheets, Cash Flows, and product
            sale performance metrics.
          </Typography>
        </Box>

        {/* P&L, Balance Sheet, Cash Flow Summary Cards */}
        <Grid container spacing={3} sx={{ mb: 4 }}>
          {/* Profit & Loss Statement */}
          <Grid item xs={12} md={4}>
            <Card className="glass-panel" sx={{ height: '100%' }}>
              <CardContent sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
                  <TrendingUpIcon sx={{ color: 'secondary.light' }} />
                  <Typography variant="h6" sx={{ fontWeight: 800 }}>
                    Profit & Loss (P&L)
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2" color="text.secondary">
                      Gross Revenue
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>
                      {formatAmount(reports.revenue)}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2" color="text.secondary">
                      Tax Collected (8%)
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      -{formatAmount(reports.salesTaxCollected)}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2" color="text.secondary">
                      Cost of Goods Sold (COGS)
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      -{formatAmount(reports.cogs)}
                    </Typography>
                  </Box>
                  <Box sx={{ borderBottom: '1px solid rgba(255,255,255,0.08)', my: 0.5 }} />
                  <Box
                    sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                  >
                    <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                      Net Gross Profit
                    </Typography>
                    <Typography variant="h5" color="success.light" sx={{ fontWeight: 800 }}>
                      {formatAmount(reports.grossProfit)}
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          {/* Balance Sheet */}
          <Grid item xs={12} md={4}>
            <Card className="glass-panel" sx={{ height: '100%' }}>
              <CardContent sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
                  <AccountBalanceIcon sx={{ color: 'primary.light' }} />
                  <Typography variant="h6" sx={{ fontWeight: 800 }}>
                    Balance Sheet
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2" color="text.secondary">
                      Inventory Asset Value
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {formatAmount(reports.balanceSheet.inventoryValuation)}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2" color="text.secondary">
                      Cash On Hand
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {formatAmount(reports.balanceSheet.cashOnHand)}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2" color="text.secondary">
                      Liabilities (Accounts Payable)
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600, color: 'error.light' }}>
                      -{formatAmount(reports.balanceSheet.accountsPayable)}
                    </Typography>
                  </Box>
                  <Box sx={{ borderBottom: '1px solid rgba(255,255,255,0.08)', my: 0.5 }} />
                  <Box
                    sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                  >
                    <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                      Total Shareholder Equity
                    </Typography>
                    <Typography variant="h5" color="primary.light" sx={{ fontWeight: 800 }}>
                      {formatAmount(reports.balanceSheet.equity)}
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          {/* Cash Flow Statement */}
          <Grid item xs={12} md={4}>
            <Card className="glass-panel" sx={{ height: '100%' }}>
              <CardContent sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
                  <AccountBalanceIcon sx={{ color: 'info.main' }} />
                  <Typography variant="h6" sx={{ fontWeight: 800 }}>
                    Cash Flow Statement
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2" color="text.secondary">
                      Cash Inflows (Sales)
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600, color: 'success.light' }}>
                      +{formatAmount(reports.cashFlow.inflow)}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2" color="text.secondary">
                      Cash Outflows (Supplier Paid)
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600, color: 'error.light' }}>
                      -{formatAmount(reports.cashFlow.outflow)}
                    </Typography>
                  </Box>
                  <Box sx={{ borderBottom: '1px solid rgba(255,255,255,0.08)', my: 0.5 }} />
                  <Box
                    sx={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      mt: 3.5,
                    }}
                  >
                    <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                      Net Cash Flow Change
                    </Typography>
                    <Typography variant="h5" color="info.main" sx={{ fontWeight: 800 }}>
                      {formatAmount(reports.cashFlow.netCashFlow)}
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Charts & Analytics */}
        <Grid container spacing={3}>
          {/* Best Selling Products */}
          <Grid item xs={12} lg={7}>
            <TableContainer
              component={Paper}
              className="glass-panel"
              sx={{
                border: '1px solid rgba(255,255,255,0.05)',
                background:
                  'linear-gradient(135deg, rgba(30, 41, 59, 0.6) 0%, rgba(15, 23, 42, 0.75) 100%)',
                borderRadius: 3,
                height: '100%',
              }}
            >
              <Box sx={{ p: 3, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                <Typography variant="h6" sx={{ fontWeight: 800 }}>
                  Best Selling Products
                </Typography>
              </Box>
              <Table>
                <TableHead sx={{ bgcolor: 'rgba(17, 24, 39, 0.5)' }}>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 800 }}>Product Name</TableCell>
                    <TableCell sx={{ fontWeight: 800 }}>SKU</TableCell>
                    <TableCell sx={{ fontWeight: 800 }}>Units Sold</TableCell>
                    <TableCell sx={{ fontWeight: 800 }}>Gross Revenue</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {reports.bestSellers.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={4}
                        align="center"
                        sx={{ py: 6, color: 'text.secondary', border: 'none' }}
                      >
                        No sales logged yet.
                      </TableCell>
                    </TableRow>
                  ) : (
                    reports.bestSellers.map((item, idx) => (
                      <TableRow key={idx} sx={{ '&:hover': { bgcolor: 'rgba(255,255,255,0.01)' } }}>
                        <TableCell sx={{ fontWeight: 700 }}>{item.name}</TableCell>
                        <TableCell>
                          <Chip
                            label={item.sku}
                            size="small"
                            variant="outlined"
                            sx={{ fontWeight: 700, color: 'primary.light' }}
                          />
                        </TableCell>
                        <TableCell sx={{ fontWeight: 600 }}>{item.qty}</TableCell>
                        <TableCell sx={{ fontWeight: 800 }}>{formatAmount(item.revenue)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Grid>

          {/* Payment Methods Chart */}
          <Grid item xs={12} lg={5}>
            <Card className="glass-panel" sx={{ height: '100%' }}>
              <CardContent sx={{ p: 3 }}>
                <Typography variant="h6" sx={{ fontWeight: 800, mb: 3 }}>
                  Revenue by Payment Type
                </Typography>
                {paymentChartData.length === 0 ? (
                  <Box sx={{ py: 8, textAlign: 'center', color: 'text.secondary' }}>
                    No payments processed.
                  </Box>
                ) : (
                  <Box sx={{ width: '100%', height: 260 }}>
                    <ResponsiveContainer>
                      <BarChart data={paymentChartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                        <XAxis dataKey="name" stroke="rgba(255,255,255,0.4)" />
                        <YAxis stroke="rgba(255,255,255,0.4)" />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: '#111827',
                            borderColor: 'rgba(255,255,255,0.08)',
                          }}
                        />
                        <Bar dataKey="Amount" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </Box>
                )}
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </motion.div>
    </Box>
  );
}
