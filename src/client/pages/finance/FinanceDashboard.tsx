import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  Button,
  LinearProgress,
  Table,
  TableRow,
  TableCell,
  TableBody,
  Chip,
  TextField,
  Slider,
  CircularProgress,
} from '@mui/material';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import TuneIcon from '@mui/icons-material/Tune';
import PaymentsIcon from '@mui/icons-material/Payments';
import PageHeader from '../../components/PageHeader';
import { apiClient } from '../../api/client';
import { toast } from 'react-hot-toast';
import { useRegionalSettings } from '../../hooks/useRegionalSettings.js';

export default function FinanceDashboard() {
  const { formatAmount } = useRegionalSettings();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // AI Assistant State
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);

  // What-If Simulation State
  const [salesShift, setSalesShift] = useState(0);
  const [priceShift, setPriceShift] = useState(0);
  const [expenseShift, setExpenseShift] = useState(0);
  const [supplierCostShift, setSupplierCostShift] = useState(0);
  const [simResult, setSimResult] = useState<any>(null);
  const [isSimLoading, setIsSimLoading] = useState(false);

  const fetchFinanceReport = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get('/finance/report');
      setData(res.data?.data || res.data);
    } catch {
      toast.error('Failed to load executive finance metrics.');
    } finally {
      setLoading(false);
    }
  };

  const handleAskAI = async () => {
    if (!aiPrompt.trim()) return;
    setIsAiLoading(true);
    try {
      const res = await apiClient.post('/finance/ai/assistant', { prompt: aiPrompt });
      setAiResponse(res.data?.data?.answer || res.data?.answer);
      toast.success('Financial AI analysis refreshed!');
    } catch {
      toast.error('Failed to query Financial AI Assistant.');
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleRunSimulation = async () => {
    setIsSimLoading(true);
    try {
      const res = await apiClient.post('/finance/ai/simulate', {
        salesChangePct: salesShift,
        priceChangePct: priceShift,
        expenseChangePct: expenseShift,
        supplierCostChangePct: supplierCostShift,
      });
      setSimResult(res.data?.data || res.data);
      toast.success('Simulation executed!');
    } catch {
      toast.error('Failed to run scenario simulation.');
    } finally {
      setIsSimLoading(false);
    }
  };

  useEffect(() => {
    fetchFinanceReport();
  }, []);

  return (
    <Box sx={{ p: 3 }}>
      <PageHeader
        title="Executive Finance & Cashflow Intelligence"
        subtitle="Real-time P&L, Balance Sheet, Double-Entry Ledger, AR/AP Aging & AI Decision Simulators"
        action={
          <Button
            variant="contained"
            startIcon={<AccountBalanceIcon />}
            onClick={fetchFinanceReport}
          >
            Refresh Financials
          </Button>
        }
      />

      {loading && <LinearProgress sx={{ mb: 3 }} />}

      {/* Top Level Metric Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ borderRadius: 2, boxShadow: 2 }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <PaymentsIcon color="success" sx={{ mr: 1 }} />
                <Typography variant="subtitle2" color="text.secondary">
                  Total Liquid Cash
                </Typography>
              </Box>
              <Typography variant="h4" sx={{ fontWeight: 'bold', color: 'success.main' }}>
                {formatAmount(data?.liquidCash || 0)}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Bank: {formatAmount(data?.cashBreakdown?.operatingBank || 0)} | Vault:{' '}
                {formatAmount(data?.cashBreakdown?.vaultCash || 0)}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ borderRadius: 2, boxShadow: 2 }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <TrendingUpIcon color="primary" sx={{ mr: 1 }} />
                <Typography variant="subtitle2" color="text.secondary">
                  Net Revenue
                </Typography>
              </Box>
              <Typography variant="h4" sx={{ fontWeight: 'bold', color: 'primary.main' }}>
                {formatAmount(data?.revenue || 0)}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Gross Profit: {formatAmount(data?.grossProfit || 0)} (
                {data?.grossMarginPercentage || 0}%)
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ borderRadius: 2, boxShadow: 2 }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <ReceiptLongIcon color="warning" sx={{ mr: 1 }} />
                <Typography variant="subtitle2" color="text.secondary">
                  Accounts Receivable (AR)
                </Typography>
              </Box>
              <Typography variant="h4" sx={{ fontWeight: 'bold', color: 'warning.main' }}>
                {formatAmount(data?.accountsReceivable?.totalOutstanding || 0)}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Current: {formatAmount(data?.accountsReceivable?.current || 0)} | 90+ Days:{' '}
                {formatAmount(data?.accountsReceivable?.days90Plus || 0)}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ borderRadius: 2, boxShadow: 2 }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <AccountBalanceWalletIcon color="error" sx={{ mr: 1 }} />
                <Typography variant="subtitle2" color="text.secondary">
                  Accounts Payable (AP)
                </Typography>
              </Box>
              <Typography variant="h4" sx={{ fontWeight: 'bold', color: 'error.main' }}>
                {formatAmount(data?.accountsPayable?.totalOutstanding || 0)}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Operating Profit: {formatAmount(data?.operatingProfit || 0)}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* AI Financial Advisor Console */}
      <Card
        sx={{
          mb: 4,
          background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
          color: '#fff',
          borderRadius: 2,
        }}
      >
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <SmartToyIcon sx={{ color: '#60a5fa' }} />
            <Typography variant="h6" sx={{ color: '#93c5fd', fontWeight: 600 }}>
              AI Financial Intelligence Assistant (CFO Grounding)
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField
              fullWidth
              size="small"
              placeholder="Ask CFO AI e.g., 'What is our current cash runway?' or 'Why did operating profit change?'"
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              sx={{ bg: '#ffffff', borderRadius: 1, input: { color: '#fff' } }}
            />
            <Button
              variant="contained"
              color="primary"
              onClick={handleAskAI}
              disabled={isAiLoading}
              startIcon={
                isAiLoading ? <CircularProgress size={18} color="inherit" /> : <SmartToyIcon />
              }
            >
              Analyze
            </Button>
          </Box>

          {aiResponse && (
            <Box
              sx={{
                mt: 3,
                p: 2,
                bgcolor: 'rgba(255, 255, 255, 0.08)',
                borderRadius: 1,
                borderLeft: '4px solid #3b82f6',
              }}
            >
              <Typography variant="body1" sx={{ whiteSpace: 'pre-line', lineHeight: 1.6 }}>
                {aiResponse}
              </Typography>
            </Box>
          )}
        </CardContent>
      </Card>

      {/* What-If Financial Scenario Simulator */}
      <Card sx={{ mb: 4, borderRadius: 2, boxShadow: 2 }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
            <TuneIcon color="primary" />
            <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
              What-If Financial Scenario Simulator
            </Typography>
          </Box>

          <Grid container spacing={4} sx={{ mb: 3 }}>
            <Grid item xs={12} sm={6} md={3}>
              <Typography variant="subtitle2">
                Sales Volume Shift ({salesShift > 0 ? `+${salesShift}` : salesShift}%)
              </Typography>
              <Slider
                value={salesShift}
                min={-30}
                max={30}
                step={5}
                valueLabelDisplay="auto"
                onChange={(_, v) => setSalesShift(v as number)}
              />
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <Typography variant="subtitle2">
                Selling Price Shift ({priceShift > 0 ? `+${priceShift}` : priceShift}%)
              </Typography>
              <Slider
                value={priceShift}
                min={-20}
                max={20}
                step={2}
                valueLabelDisplay="auto"
                onChange={(_, v) => setPriceShift(v as number)}
              />
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <Typography variant="subtitle2">
                Operating Expense Shift ({expenseShift > 0 ? `+${expenseShift}` : expenseShift}%)
              </Typography>
              <Slider
                value={expenseShift}
                min={-20}
                max={30}
                step={5}
                valueLabelDisplay="auto"
                onChange={(_, v) => setExpenseShift(v as number)}
              />
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <Typography variant="subtitle2">
                Supplier COGS Inflation (
                {supplierCostShift > 0 ? `+${supplierCostShift}` : supplierCostShift}%)
              </Typography>
              <Slider
                value={supplierCostShift}
                min={-15}
                max={25}
                step={5}
                valueLabelDisplay="auto"
                onChange={(_, v) => setSupplierCostShift(v as number)}
              />
            </Grid>
          </Grid>

          <Button
            variant="contained"
            color="secondary"
            onClick={handleRunSimulation}
            disabled={isSimLoading}
          >
            {isSimLoading ? 'Simulating...' : 'Run Scenario Simulation'}
          </Button>

          {simResult && (
            <Box
              sx={{ mt: 3, p: 2, bgcolor: '#f8fafc', borderRadius: 2, border: '1px solid #e2e8f0' }}
            >
              <Grid container spacing={2}>
                <Grid item xs={12} sm={4}>
                  <Typography variant="caption" color="text.secondary">
                    Simulated Net Revenue
                  </Typography>
                  <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                    {formatAmount(simResult.simulated?.netRevenue || 0)}
                  </Typography>
                </Grid>
                <Grid item xs={12} sm={4}>
                  <Typography variant="caption" color="text.secondary">
                    Simulated Operating Profit
                  </Typography>
                  <Typography
                    variant="h6"
                    sx={{
                      fontWeight: 'bold',
                      color: simResult.simulated?.profitDelta >= 0 ? 'success.main' : 'error.main',
                    }}
                  >
                    {formatAmount(simResult.simulated?.operatingProfit || 0)} (
                    {simResult.simulated?.profitDelta >= 0 ? '+' : ''}
                    {simResult.simulated?.profitDeltaPct}%)
                  </Typography>
                </Grid>
                <Grid item xs={12} sm={4}>
                  <Typography variant="caption" color="text.secondary">
                    Projected Cash Runway
                  </Typography>
                  <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                    {simResult.simulated?.cashRunwayMonths} Months
                  </Typography>
                </Grid>
              </Grid>
              <Typography
                variant="body2"
                sx={{ mt: 2, color: 'text.secondary', fontStyle: 'italic' }}
              >
                {simResult.aiScenarioAssessment}
              </Typography>
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Balance Sheet & Trial Balance Integrity Tables */}
      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Card sx={{ borderRadius: 2, boxShadow: 2, height: '100%' }}>
            <CardContent>
              <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 2 }}>
                Balance Sheet Summary
              </Typography>
              <Table size="small">
                <TableBody>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 'bold' }}>Total Assets</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 'bold', color: 'success.main' }}>
                      {formatAmount(data?.balanceSheet?.totalAssets || 0)}
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 'bold' }}>Total Liabilities</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 'bold', color: 'error.main' }}>
                      {formatAmount(data?.balanceSheet?.totalLiabilities || 0)}
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 'bold' }}>Total Equity</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                      {formatAmount(data?.balanceSheet?.totalEquity || 0)}
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 'bold' }}>Accounting Balance Integrity</TableCell>
                    <TableCell align="right">
                      <Chip
                        label={
                          data?.balanceSheet?.isBalanced ? 'BALANCED (Assets = L+E)' : 'UNBALANCED'
                        }
                        color={data?.balanceSheet?.isBalanced ? 'success' : 'error'}
                        size="small"
                      />
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card sx={{ borderRadius: 2, boxShadow: 2, height: '100%' }}>
            <CardContent>
              <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 2 }}>
                Trial Balance Integrity
              </Typography>
              <Table size="small">
                <TableBody>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 'bold' }}>Total Debits</TableCell>
                    <TableCell align="right">
                      {formatAmount(data?.trialBalance?.totalDebit || 0)}
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 'bold' }}>Total Credits</TableCell>
                    <TableCell align="right">
                      {formatAmount(data?.trialBalance?.totalCredit || 0)}
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 'bold' }}>Zero-Sum Equality Check</TableCell>
                    <TableCell align="right">
                      <Chip
                        label={
                          data?.trialBalance?.isBalanced
                            ? 'MATCHED (Debits == Credits)'
                            : 'MISMATCH'
                        }
                        color={data?.trialBalance?.isBalanced ? 'success' : 'error'}
                        size="small"
                      />
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 'bold' }}>Sales Tax / VAT Liability</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 'bold', color: 'warning.main' }}>
                      {formatAmount(data?.taxSummary?.netTaxLiability || 0)}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
