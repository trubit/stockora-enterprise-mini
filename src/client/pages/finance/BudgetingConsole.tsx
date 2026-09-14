import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Chip,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  LinearProgress,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import PageHeader from '../../components/PageHeader';
import { apiClient } from '../../api/client';
import { toast } from 'react-hot-toast';
import { useRegionalSettings } from '../../hooks/useRegionalSettings.js';

export default function BudgetingConsole() {
  const { formatAmount, currencySymbol } = useRegionalSettings();
  const [budgets, setBudgets] = useState<any[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [periodType, setPeriodType] = useState('ANNUAL');
  const [allocatedAmount, setAllocatedAmount] = useState(100000);
  const [alertThresholdPct, setAlertThresholdPct] = useState(85);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchBudgets = async () => {
    try {
      const res = await apiClient.get('/finance/budgets');
      const resData = res.data?.data;
      const list = Array.isArray(resData) ? resData : Array.isArray(res.data) ? res.data : [];
      setBudgets(list);
    } catch {
      toast.error('Failed to load corporate budgets.');
      setBudgets([]);
    }
  };

  useEffect(() => {
    fetchBudgets();
  }, []);

  const handleCreateBudget = async () => {
    if (!name || allocatedAmount <= 0) {
      toast.error('Please enter budget name and allocated amount.');
      return;
    }

    setIsSubmitting(true);
    try {
      await apiClient.post('/finance/budgets', {
        name,
        fiscalYear: 2026,
        periodType,
        allocatedAmount,
        alertThresholdPct,
        categories: [
          { categoryName: 'Operations', allocatedAmount: allocatedAmount * 0.6 },
          { categoryName: 'Marketing', allocatedAmount: allocatedAmount * 0.4 },
        ],
      });
      toast.success('Corporate Budget Created Successfully!');
      setModalOpen(false);
      setName('');
      fetchBudgets();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to create budget.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <PageHeader
        title="Corporate Budgeting & Spending Variance"
        subtitle="Annual and department budget allocation vs actual real-time expenditure tracking"
        action={
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setModalOpen(true)}>
            Create Budget
          </Button>
        }
      />

      <Card sx={{ borderRadius: 2, boxShadow: 2 }}>
        <CardContent>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Budget Plan</TableCell>
                <TableCell>Fiscal Period</TableCell>
                <TableCell align="right">Allocated ($)</TableCell>
                <TableCell align="right">Spent ($)</TableCell>
                <TableCell align="right">Variance / Remaining ($)</TableCell>
                <TableCell width="180px">Utilization</TableCell>
                <TableCell>Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {budgets.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 3 }}>
                    No active corporate budgets created yet.
                  </TableCell>
                </TableRow>
              ) : (
                budgets.map((b) => {
                  const spent = b.spentAmount || 0;
                  const allocated = b.allocatedAmount || 1;
                  const pct = Math.min(100, Math.round((spent / allocated) * 100));
                  const variance = allocated - spent;

                  return (
                    <TableRow key={b._id || b.name}>
                      <TableCell sx={{ fontWeight: 'bold' }}>{b.name}</TableCell>
                      <TableCell>
                        {b.periodType} (FY {b.fiscalYear})
                      </TableCell>
                      <TableCell align="right">{formatAmount(allocated)}</TableCell>
                      <TableCell align="right">{formatAmount(spent)}</TableCell>
                      <TableCell
                        align="right"
                        sx={{
                          fontWeight: 'bold',
                          color: variance >= 0 ? 'success.main' : 'error.main',
                        }}
                      >
                        {variance >= 0
                          ? `+${formatAmount(variance)}`
                          : `-${formatAmount(Math.abs(variance))}`}
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Box sx={{ width: '100%', mr: 1 }}>
                            <LinearProgress
                              variant="determinate"
                              value={pct}
                              color={pct > 90 ? 'error' : pct > 75 ? 'warning' : 'primary'}
                              sx={{ height: 8, borderRadius: 4 }}
                            />
                          </Box>
                          <Typography variant="caption">{pct}%</Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={
                            b.status || (pct >= 100 ? 'EXCEEDED' : pct >= 85 ? 'WARNING' : 'ACTIVE')
                          }
                          color={pct >= 100 ? 'error' : pct >= 85 ? 'warning' : 'success'}
                          size="small"
                        />
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={modalOpen} onClose={() => setModalOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 'bold' }}>Create New Corporate Budget</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          <TextField
            label="Budget Name"
            placeholder="e.g. FY2026 Q1 Operations Budget"
            value={name}
            onChange={(e) => setName(e.target.value)}
            fullWidth
          />

          <TextField
            select
            label="Budget Frequency"
            value={periodType}
            onChange={(e) => setPeriodType(e.target.value)}
            fullWidth
          >
            <MenuItem value="MONTHLY">Monthly</MenuItem>
            <MenuItem value="QUARTERLY">Quarterly</MenuItem>
            <MenuItem value="ANNUAL">Annual</MenuItem>
          </TextField>

          <TextField
            label={`Total Allocated Amount (${currencySymbol})`}
            type="number"
            value={allocatedAmount}
            onChange={(e) => setAllocatedAmount(parseFloat(e.target.value) || 0)}
            fullWidth
          />

          <TextField
            label="Alert Threshold (%)"
            type="number"
            value={alertThresholdPct}
            onChange={(e) => setAlertThresholdPct(parseFloat(e.target.value) || 85)}
            fullWidth
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setModalOpen(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button variant="contained" onClick={handleCreateBudget} disabled={isSubmitting}>
            {isSubmitting ? 'Creating...' : 'Create Budget'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
