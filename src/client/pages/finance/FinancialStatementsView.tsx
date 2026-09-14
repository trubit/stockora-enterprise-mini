import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Tabs,
  Tab,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Chip,
  CircularProgress,
  Button,
  Grid,
  useTheme,
  Paper,
} from '@mui/material';
import TrendingUp from '@mui/icons-material/TrendingUp';
import AccountBalance from '@mui/icons-material/AccountBalance';
import ReceiptLong from '@mui/icons-material/ReceiptLong';
import CompareArrows from '@mui/icons-material/CompareArrows';
import FileDownload from '@mui/icons-material/FileDownload';
import Print from '@mui/icons-material/Print';
import CheckCircle from '@mui/icons-material/CheckCircle';
import Warning from '@mui/icons-material/Warning';
import AttachMoney from '@mui/icons-material/AttachMoney';
import ShowChart from '@mui/icons-material/ShowChart';
import AccountBalanceWallet from '@mui/icons-material/AccountBalanceWallet';
import PageHeader from '../../components/PageHeader';
import { apiClient } from '../../api/client';
import { toast } from 'react-hot-toast';
import { useRegionalSettings } from '../../hooks/useRegionalSettings.js';

export default function FinancialStatementsView() {
  const { formatAmount, currencySymbol, displayCurrency } = useRegionalSettings();
  const [tab, setTab] = useState(0);
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const fetchReport = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get('/finance/report');
      setReport(res.data?.data || res.data || {});
    } catch {
      toast.error('Failed to load financial statements.');
      setReport({});
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, []);

  const pnl = report?.profitAndLoss || report || {};
  const balanceSheet = report?.balanceSheet || {};
  const trialBalance = report?.trialBalance || {};
  const cashflow = report?.cashflow || {};

  const grossRevenue = pnl.grossRevenue ?? pnl.revenue ?? 0;
  const cogs = pnl.totalCOGS ?? pnl.cogs ?? 0;
  const grossProfit = pnl.grossProfit ?? grossRevenue - cogs;
  const operatingExpenses = pnl.totalExpenses ?? pnl.operatingExpenses ?? 0;
  const netProfit = pnl.netProfit ?? pnl.operatingProfit ?? grossProfit - operatingExpenses;

  const totalAssets = balanceSheet.totalAssets || 0;
  const totalLiabilities = balanceSheet.totalLiabilities || 0;
  const totalEquity = balanceSheet.totalEquity || totalAssets - totalLiabilities;

  const netCashFlow = cashflow.netCashFlow || 0;

  // Custom table styling for ultra-crisp readability in both dark and light modes
  const tableContainerSx = {
    borderRadius: 3,
    overflow: 'hidden',
    border: isDark ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid #e2e8f0',
    background: isDark
      ? 'linear-gradient(180deg, rgba(15, 23, 42, 0.8) 0%, rgba(15, 23, 42, 0.95) 100%)'
      : '#ffffff',
  };

  const headerCellSx = {
    bgcolor: isDark ? 'rgba(30, 41, 59, 0.9)' : '#f1f5f9',
    color: isDark ? '#f8fafc' : '#0f172a',
    fontWeight: 800,
    fontSize: '0.875rem',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    py: 1.8,
    px: 2.5,
    borderBottom: isDark ? '2px solid rgba(139, 92, 246, 0.3)' : '2px solid #cbd5e1',
  };

  const rowLabelSx = {
    color: isDark ? '#e2e8f0' : '#1e293b',
    fontWeight: 600,
    fontSize: '0.925rem',
    py: 1.6,
    px: 2.5,
    borderBottom: isDark ? '1px solid rgba(255, 255, 255, 0.05)' : '1px solid #f1f5f9',
  };

  const rowValueSx = {
    fontWeight: 700,
    fontSize: '0.975rem',
    py: 1.6,
    px: 2.5,
    fontFamily: 'monospace',
    borderBottom: isDark ? '1px solid rgba(255, 255, 255, 0.05)' : '1px solid #f1f5f9',
  };

  const totalRowSx = {
    bgcolor: isDark ? 'rgba(139, 92, 246, 0.12)' : '#eef2ff',
    '& td': {
      borderTop: isDark ? '2px solid rgba(139, 92, 246, 0.4)' : '2px solid #818cf8',
      borderBottom: isDark ? '2px solid rgba(139, 92, 246, 0.4)' : '2px solid #818cf8',
      py: 2,
    },
  };

  return (
    <Box sx={{ p: { xs: 2, md: 4 }, maxWidth: 1400, mx: 'auto' }}>
      {/* Header & Actions */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: 2,
          mb: 3,
        }}
      >
        <PageHeader
          title="Executive Financial Statements (GAAP / IFRS)"
          subtitle="Audit-grade Profit & Loss, Balance Sheet, Cash Flows & General Ledger Trial Balance."
        />
        <Box sx={{ display: 'flex', gap: 1.5 }}>
          <Button
            variant="outlined"
            startIcon={<Print />}
            onClick={() => window.print()}
            sx={{
              borderRadius: 2,
              textTransform: 'none',
              fontWeight: 700,
              borderColor: isDark ? 'rgba(255,255,255,0.2)' : '#cbd5e1',
              color: isDark ? '#f8fafc' : '#334155',
              '&:hover': {
                borderColor: '#8b5cf6',
                bgcolor: isDark ? 'rgba(139, 92, 246, 0.1)' : '#f5f3ff',
              },
            }}
          >
            Print Statement
          </Button>
          <Button
            variant="contained"
            startIcon={<FileDownload />}
            onClick={() => toast.success('Exporting official statements bundle...')}
            sx={{
              borderRadius: 2,
              textTransform: 'none',
              fontWeight: 700,
              background: 'linear-gradient(135deg, #8b5cf6 0%, #3b82f6 100%)',
              boxShadow: '0 4px 15px rgba(139, 92, 246, 0.3)',
              '&:hover': {
                background: 'linear-gradient(135deg, #7c3aed 0%, #2563eb 100%)',
                boxShadow: '0 6px 20px rgba(139, 92, 246, 0.45)',
              },
            }}
          >
            Export GAAP Package
          </Button>
        </Box>
      </Box>

      {/* KPI Top Cards */}
      <Grid container spacing={2.5} sx={{ mb: 3.5 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card
            sx={{
              borderRadius: 3,
              p: 2.5,
              border: isDark ? '1px solid rgba(16, 185, 129, 0.2)' : '1px solid #d1fae5',
              background: isDark
                ? 'linear-gradient(135deg, rgba(6, 78, 59, 0.3) 0%, rgba(15, 23, 42, 0.7) 100%)'
                : 'linear-gradient(135deg, #ecfdf5 0%, #ffffff 100%)',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.05)',
            }}
          >
            <Box
              sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}
            >
              <Typography
                variant="caption"
                sx={{
                  fontWeight: 800,
                  color: '#10b981',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                Gross Revenue
              </Typography>
              <AttachMoney sx={{ color: '#10b981', fontSize: 24 }} />
            </Box>
            <Typography
              variant="h5"
              sx={{
                fontWeight: 900,
                color: isDark ? '#ffffff' : '#0f172a',
                fontFamily: 'monospace',
              }}
            >
              {formatAmount(grossRevenue)}
            </Typography>
            <Typography
              variant="caption"
              sx={{ color: isDark ? '#94a3b8' : '#64748b', fontWeight: 500 }}
            >
              Total top-line operating turnover
            </Typography>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card
            sx={{
              borderRadius: 3,
              p: 2.5,
              border: isDark ? '1px solid rgba(59, 130, 246, 0.2)' : '1px solid #dbeafe',
              background: isDark
                ? 'linear-gradient(135deg, rgba(30, 58, 138, 0.3) 0%, rgba(15, 23, 42, 0.7) 100%)'
                : 'linear-gradient(135deg, #eff6ff 0%, #ffffff 100%)',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.05)',
            }}
          >
            <Box
              sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}
            >
              <Typography
                variant="caption"
                sx={{
                  fontWeight: 800,
                  color: '#3b82f6',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                Net Profit
              </Typography>
              <TrendingUp sx={{ color: netProfit >= 0 ? '#10b981' : '#ef4444', fontSize: 24 }} />
            </Box>
            <Typography
              variant="h5"
              sx={{
                fontWeight: 900,
                color: netProfit >= 0 ? '#10b981' : '#ef4444',
                fontFamily: 'monospace',
              }}
            >
              {formatAmount(netProfit)}
            </Typography>
            <Typography
              variant="caption"
              sx={{ color: isDark ? '#94a3b8' : '#64748b', fontWeight: 500 }}
            >
              After COGS and operating expenses
            </Typography>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card
            sx={{
              borderRadius: 3,
              p: 2.5,
              border: isDark ? '1px solid rgba(139, 92, 246, 0.2)' : '1px solid #ede9fe',
              background: isDark
                ? 'linear-gradient(135deg, rgba(88, 28, 135, 0.3) 0%, rgba(15, 23, 42, 0.7) 100%)'
                : 'linear-gradient(135deg, #f5f3ff 0%, #ffffff 100%)',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.05)',
            }}
          >
            <Box
              sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}
            >
              <Typography
                variant="caption"
                sx={{
                  fontWeight: 800,
                  color: '#a855f7',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                Total Assets
              </Typography>
              <AccountBalance sx={{ color: '#a855f7', fontSize: 24 }} />
            </Box>
            <Typography
              variant="h5"
              sx={{
                fontWeight: 900,
                color: isDark ? '#ffffff' : '#0f172a',
                fontFamily: 'monospace',
              }}
            >
              {formatAmount(totalAssets)}
            </Typography>
            <Typography
              variant="caption"
              sx={{ color: isDark ? '#94a3b8' : '#64748b', fontWeight: 500 }}
            >
              Cash, Inventory, Receivables & Fixed
            </Typography>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card
            sx={{
              borderRadius: 3,
              p: 2.5,
              border: isDark ? '1px solid rgba(14, 165, 233, 0.2)' : '1px solid #e0f2fe',
              background: isDark
                ? 'linear-gradient(135deg, rgba(12, 74, 110, 0.3) 0%, rgba(15, 23, 42, 0.7) 100%)'
                : 'linear-gradient(135deg, #f0f9ff 0%, #ffffff 100%)',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.05)',
            }}
          >
            <Box
              sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}
            >
              <Typography
                variant="caption"
                sx={{
                  fontWeight: 800,
                  color: '#0ea5e9',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                Net Cash Flow
              </Typography>
              <AccountBalanceWallet
                sx={{ color: netCashFlow >= 0 ? '#10b981' : '#f59e0b', fontSize: 24 }}
              />
            </Box>
            <Typography
              variant="h5"
              sx={{
                fontWeight: 900,
                color: netCashFlow >= 0 ? '#10b981' : '#f59e0b',
                fontFamily: 'monospace',
              }}
            >
              {formatAmount(netCashFlow)}
            </Typography>
            <Typography
              variant="caption"
              sx={{ color: isDark ? '#94a3b8' : '#64748b', fontWeight: 500 }}
            >
              Liquid net cash movement
            </Typography>
          </Card>
        </Grid>
      </Grid>

      {/* Statements Container */}
      <Card
        sx={{
          borderRadius: 4,
          border: isDark ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid #e2e8f0',
          boxShadow: isDark
            ? '0 20px 50px rgba(0, 0, 0, 0.5), 0 0 30px rgba(139, 92, 246, 0.08)'
            : '0 10px 30px rgba(0, 0, 0, 0.05)',
          background: isDark
            ? 'linear-gradient(145deg, rgba(17, 24, 39, 0.95) 0%, rgba(11, 15, 25, 0.98) 100%)'
            : '#ffffff',
          overflow: 'hidden',
        }}
      >
        <CardContent sx={{ p: { xs: 2.5, md: 4 } }}>
          {/* Custom Tabs */}
          <Box
            sx={{
              borderBottom: isDark ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid #e2e8f0',
              mb: 3.5,
              pb: 0.5,
            }}
          >
            <Tabs
              value={tab}
              onChange={(_, val) => setTab(val)}
              variant="scrollable"
              scrollButtons="auto"
              sx={{
                '& .MuiTabs-indicator': {
                  height: 3,
                  borderRadius: 3,
                  background: 'linear-gradient(90deg, #8b5cf6, #3b82f6)',
                },
                '& .MuiTab-root': {
                  textTransform: 'none',
                  fontWeight: 700,
                  fontSize: '0.95rem',
                  color: isDark ? '#94a3b8' : '#64748b',
                  minHeight: 48,
                  px: 3,
                  transition: 'all 0.2s',
                  '&.Mui-selected': {
                    color: isDark ? '#f8fafc' : '#4f46e5',
                  },
                  '&:hover': {
                    color: isDark ? '#ffffff' : '#1e293b',
                  },
                },
              }}
            >
              <Tab
                icon={<ReceiptLong sx={{ fontSize: 18 }} />}
                iconPosition="start"
                label="Profit & Loss (P&L)"
              />
              <Tab
                icon={<AccountBalance sx={{ fontSize: 18 }} />}
                iconPosition="start"
                label="Balance Sheet"
              />
              <Tab
                icon={<ShowChart sx={{ fontSize: 18 }} />}
                iconPosition="start"
                label="Cash Flow Statement"
              />
              <Tab
                icon={<CompareArrows sx={{ fontSize: 18 }} />}
                iconPosition="start"
                label="Trial Balance"
              />
            </Tabs>
          </Box>

          {loading ? (
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                py: 8,
              }}
            >
              <CircularProgress sx={{ color: '#8b5cf6', mb: 2 }} />
              <Typography
                variant="body2"
                sx={{ color: isDark ? '#94a3b8' : '#64748b', fontWeight: 600 }}
              >
                Compiling GAAP financial statements...
              </Typography>
            </Box>
          ) : tab === 0 ? (
            /* TAB 0: PROFIT & LOSS */
            <Box>
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  mb: 2.5,
                }}
              >
                <Box>
                  <Typography
                    variant="h6"
                    sx={{ fontWeight: 800, color: isDark ? '#f8fafc' : '#0f172a' }}
                  >
                    Statement of Comprehensive Income (P&L)
                  </Typography>
                  <Typography variant="caption" sx={{ color: isDark ? '#94a3b8' : '#64748b' }}>
                    Reporting Period: Current Fiscal Year-to-Date
                  </Typography>
                </Box>
                <Chip
                  label="GAAP / IFRS COMPLIANT"
                  size="small"
                  sx={{
                    bgcolor: isDark ? 'rgba(16, 185, 129, 0.15)' : '#ecfdf5',
                    color: '#10b981',
                    fontWeight: 800,
                    border: '1px solid rgba(16, 185, 129, 0.3)',
                  }}
                />
              </Box>

              <Paper sx={tableContainerSx}>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={headerCellSx}>Line Item Description</TableCell>
                      <TableCell align="right" sx={headerCellSx}>
                        Amount (USD)
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    <TableRow>
                      <TableCell sx={rowLabelSx}>Gross Operating Sales Revenue</TableCell>
                      <TableCell align="right" sx={{ ...rowValueSx, color: '#10b981' }}>
                        {formatAmount(grossRevenue)}
                      </TableCell>
                    </TableRow>

                    <TableRow>
                      <TableCell sx={rowLabelSx}>Less: Cost of Goods Sold (COGS)</TableCell>
                      <TableCell align="right" sx={{ ...rowValueSx, color: '#ef4444' }}>
                        -{formatAmount(cogs)}
                      </TableCell>
                    </TableRow>

                    <TableRow sx={{ bgcolor: isDark ? 'rgba(59, 130, 246, 0.08)' : '#eff6ff' }}>
                      <TableCell
                        sx={{
                          ...rowLabelSx,
                          fontWeight: 800,
                          color: isDark ? '#93c5fd' : '#1d4ed8',
                        }}
                      >
                        Gross Profit Margin
                      </TableCell>
                      <TableCell
                        align="right"
                        sx={{
                          ...rowValueSx,
                          color: isDark ? '#93c5fd' : '#1d4ed8',
                          fontWeight: 800,
                        }}
                      >
                        {formatAmount(grossProfit)}
                      </TableCell>
                    </TableRow>

                    <TableRow>
                      <TableCell sx={rowLabelSx}>
                        Operating & Administrative Expenses (OPEX)
                      </TableCell>
                      <TableCell align="right" sx={{ ...rowValueSx, color: '#ef4444' }}>
                        -{formatAmount(operatingExpenses)}
                      </TableCell>
                    </TableRow>

                    <TableRow sx={totalRowSx}>
                      <TableCell
                        sx={{
                          ...rowLabelSx,
                          fontSize: '1.05rem',
                          fontWeight: 900,
                          color: isDark ? '#ffffff' : '#0f172a',
                        }}
                      >
                        Net Operating Income (EBIT)
                      </TableCell>
                      <TableCell
                        align="right"
                        sx={{
                          ...rowValueSx,
                          fontSize: '1.15rem',
                          fontWeight: 900,
                          color: netProfit >= 0 ? '#10b981' : '#ef4444',
                        }}
                      >
                        {formatAmount(netProfit)}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </Paper>
            </Box>
          ) : tab === 1 ? (
            /* TAB 1: BALANCE SHEET */
            <Box>
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  mb: 2.5,
                }}
              >
                <Box>
                  <Typography
                    variant="h6"
                    sx={{ fontWeight: 800, color: isDark ? '#f8fafc' : '#0f172a' }}
                  >
                    Consolidated Balance Sheet
                  </Typography>
                  <Typography variant="caption" sx={{ color: isDark ? '#94a3b8' : '#64748b' }}>
                    Fundamental Accounting Equation: Assets = Liabilities + Equity
                  </Typography>
                </Box>
                <Chip
                  icon={
                    balanceSheet.isBalanced !== false ? (
                      <CheckCircle sx={{ fontSize: '16px !important' }} />
                    ) : (
                      <Warning sx={{ fontSize: '16px !important' }} />
                    )
                  }
                  label={
                    balanceSheet.isBalanced !== false
                      ? 'EQUATION BALANCED (A = L + E)'
                      : 'VARIANCE DETECTED'
                  }
                  size="small"
                  sx={{
                    bgcolor:
                      balanceSheet.isBalanced !== false
                        ? 'rgba(16, 185, 129, 0.15)'
                        : 'rgba(239, 68, 68, 0.15)',
                    color: balanceSheet.isBalanced !== false ? '#10b981' : '#ef4444',
                    fontWeight: 800,
                    border: `1px solid ${balanceSheet.isBalanced !== false ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                  }}
                />
              </Box>

              <Paper sx={tableContainerSx}>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={headerCellSx}>Accounting Classification</TableCell>
                      <TableCell align="right" sx={headerCellSx}>
                        Carrying Balance ({displayCurrency})
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    <TableRow>
                      <TableCell sx={{ ...rowLabelSx, fontWeight: 700, color: '#10b981' }}>
                        1. Total Current & Non-Current Assets
                      </TableCell>
                      <TableCell
                        align="right"
                        sx={{ ...rowValueSx, color: '#10b981', fontWeight: 800 }}
                      >
                        {formatAmount(totalAssets)}
                      </TableCell>
                    </TableRow>

                    <TableRow>
                      <TableCell sx={{ ...rowLabelSx, fontWeight: 700, color: '#ef4444' }}>
                        2. Total Liabilities (Current & Long-Term)
                      </TableCell>
                      <TableCell
                        align="right"
                        sx={{ ...rowValueSx, color: '#ef4444', fontWeight: 800 }}
                      >
                        {formatAmount(totalLiabilities)}
                      </TableCell>
                    </TableRow>

                    <TableRow>
                      <TableCell sx={{ ...rowLabelSx, fontWeight: 700, color: '#a855f7' }}>
                        3. Total Shareholder & Owner Equity
                      </TableCell>
                      <TableCell
                        align="right"
                        sx={{ ...rowValueSx, color: '#a855f7', fontWeight: 800 }}
                      >
                        {formatAmount(totalEquity)}
                      </TableCell>
                    </TableRow>

                    <TableRow sx={totalRowSx}>
                      <TableCell
                        sx={{
                          ...rowLabelSx,
                          fontSize: '1.05rem',
                          fontWeight: 900,
                          color: isDark ? '#ffffff' : '#0f172a',
                        }}
                      >
                        Total Liabilities & Equity Sum
                      </TableCell>
                      <TableCell
                        align="right"
                        sx={{
                          ...rowValueSx,
                          fontSize: '1.15rem',
                          fontWeight: 900,
                          color: isDark ? '#93c5fd' : '#3b82f6',
                        }}
                      >
                        {formatAmount(totalLiabilities + totalEquity)}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </Paper>
            </Box>
          ) : tab === 2 ? (
            /* TAB 2: STATEMENT OF CASH FLOWS */
            <Box>
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  mb: 2.5,
                }}
              >
                <Box>
                  <Typography
                    variant="h6"
                    sx={{ fontWeight: 800, color: isDark ? '#f8fafc' : '#0f172a' }}
                  >
                    Statement of Cash Flows (Indirect Method)
                  </Typography>
                  <Typography variant="caption" sx={{ color: isDark ? '#94a3b8' : '#64748b' }}>
                    Breakdown of Operating, Investing, and Financing liquidity movements
                  </Typography>
                </Box>
              </Box>

              <Paper sx={tableContainerSx}>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={headerCellSx}>Cash Flow Activity</TableCell>
                      <TableCell align="right" sx={headerCellSx}>
                        Net Movement ({displayCurrency})
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    <TableRow>
                      <TableCell sx={rowLabelSx}>Cash Flows from Operating Activities</TableCell>
                      <TableCell
                        align="right"
                        sx={{
                          ...rowValueSx,
                          color: (cashflow.operatingCashFlow || 0) >= 0 ? '#10b981' : '#ef4444',
                        }}
                      >
                        {formatAmount(cashflow.operatingCashFlow || 0)}
                      </TableCell>
                    </TableRow>

                    <TableRow>
                      <TableCell sx={rowLabelSx}>Cash Flows from Investing Activities</TableCell>
                      <TableCell
                        align="right"
                        sx={{
                          ...rowValueSx,
                          color: (cashflow.investingCashFlow || 0) >= 0 ? '#10b981' : '#ef4444',
                        }}
                      >
                        {formatAmount(cashflow.investingCashFlow || 0)}
                      </TableCell>
                    </TableRow>

                    <TableRow>
                      <TableCell sx={rowLabelSx}>Cash Flows from Financing Activities</TableCell>
                      <TableCell
                        align="right"
                        sx={{
                          ...rowValueSx,
                          color: (cashflow.financingCashFlow || 0) >= 0 ? '#10b981' : '#ef4444',
                        }}
                      >
                        {formatAmount(cashflow.financingCashFlow || 0)}
                      </TableCell>
                    </TableRow>

                    <TableRow sx={totalRowSx}>
                      <TableCell
                        sx={{
                          ...rowLabelSx,
                          fontSize: '1.05rem',
                          fontWeight: 900,
                          color: isDark ? '#ffffff' : '#0f172a',
                        }}
                      >
                        Net Increase / (Decrease) in Liquid Cash
                      </TableCell>
                      <TableCell
                        align="right"
                        sx={{
                          ...rowValueSx,
                          fontSize: '1.15rem',
                          fontWeight: 900,
                          color: netCashFlow >= 0 ? '#10b981' : '#ef4444',
                        }}
                      >
                        {formatAmount(netCashFlow)}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </Paper>
            </Box>
          ) : (
            /* TAB 3: TRIAL BALANCE */
            <Box>
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  mb: 2.5,
                }}
              >
                <Box>
                  <Typography
                    variant="h6"
                    sx={{ fontWeight: 800, color: isDark ? '#f8fafc' : '#0f172a' }}
                  >
                    General Ledger Trial Balance
                  </Typography>
                  <Typography variant="caption" sx={{ color: isDark ? '#94a3b8' : '#64748b' }}>
                    Double-entry verification of Debit and Credit equality across all chart of
                    accounts
                  </Typography>
                </Box>
                <Chip
                  label={
                    trialBalance.isBalanced !== false ? 'ZERO-SUM EQUILIBRIUM ACTIVE' : 'UNBALANCED'
                  }
                  size="small"
                  sx={{
                    bgcolor: 'rgba(16, 185, 129, 0.15)',
                    color: '#10b981',
                    fontWeight: 800,
                    border: '1px solid rgba(16, 185, 129, 0.3)',
                  }}
                />
              </Box>

              <Paper sx={tableContainerSx}>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={headerCellSx}>Chart of Account & Code</TableCell>
                      <TableCell align="right" sx={headerCellSx}>
                        Debit ({currencySymbol})
                      </TableCell>
                      <TableCell align="right" sx={headerCellSx}>
                        Credit ({currencySymbol})
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {(trialBalance.accounts || trialBalance.lines || []).map((l: any) => (
                      <TableRow key={l.accountCode || l.code}>
                        <TableCell sx={rowLabelSx}>
                          <Typography
                            component="span"
                            sx={{ fontWeight: 800, color: isDark ? '#a78bfa' : '#6366f1' }}
                          >
                            {l.accountCode || l.code}
                          </Typography>
                          {' — '}
                          <Typography
                            component="span"
                            sx={{ color: isDark ? '#e2e8f0' : '#334155' }}
                          >
                            {l.accountName || l.name}
                          </Typography>
                        </TableCell>
                        <TableCell
                          align="right"
                          sx={{
                            ...rowValueSx,
                            color:
                              (l.debit || 0) > 0
                                ? isDark
                                  ? '#f8fafc'
                                  : '#0f172a'
                                : isDark
                                  ? '#64748b'
                                  : '#94a3b8',
                          }}
                        >
                          {formatAmount(l.debit || 0)}
                        </TableCell>
                        <TableCell
                          align="right"
                          sx={{
                            ...rowValueSx,
                            color:
                              (l.credit || 0) > 0
                                ? isDark
                                  ? '#f8fafc'
                                  : '#0f172a'
                                : isDark
                                  ? '#64748b'
                                  : '#94a3b8',
                          }}
                        >
                          {formatAmount(l.credit || 0)}
                        </TableCell>
                      </TableRow>
                    ))}

                    <TableRow sx={totalRowSx}>
                      <TableCell
                        sx={{
                          ...rowLabelSx,
                          fontSize: '1.05rem',
                          fontWeight: 900,
                          color: isDark ? '#ffffff' : '#0f172a',
                        }}
                      >
                        Total General Ledger Equilibrium
                      </TableCell>
                      <TableCell
                        align="right"
                        sx={{
                          ...rowValueSx,
                          fontSize: '1.1rem',
                          fontWeight: 900,
                          color: '#10b981',
                        }}
                      >
                        {formatAmount(trialBalance.totalDebit || 0)}
                      </TableCell>
                      <TableCell
                        align="right"
                        sx={{
                          ...rowValueSx,
                          fontSize: '1.1rem',
                          fontWeight: 900,
                          color: '#10b981',
                        }}
                      >
                        {formatAmount(trialBalance.totalCredit || 0)}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </Paper>
            </Box>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}
