import { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Button,
  TextField,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Chip,
  InputAdornment,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import PageHeader from '../../components/PageHeader';
import { apiClient } from '../../api/client';
import { toast } from 'react-hot-toast';
import { useRegionalSettings } from '../../hooks/useRegionalSettings.js';
import { CurrencySelector } from '../../components/CurrencySelector.tsx';

export default function ExpenseManager() {
  const { formatAmount, convertAmount, activeCurrency, baseCurrency, currencySymbol } =
    useRegionalSettings();
  const [expenses, setExpenses] = useState<any[]>([]);
  const [modalOpen, setModalOpen] = useState(false);

  const [categoryCode, setCategoryCode] = useState('6000');
  const [vendorName, setVendorName] = useState('');
  const [amount, setAmount] = useState(150);
  const [notes, setNotes] = useState('');

  const fetchExpenses = async () => {
    try {
      const res = await apiClient.get('/finance/expenses');
      const resData = res.data?.data;
      const list = Array.isArray(resData) ? resData : Array.isArray(res.data) ? res.data : [];
      setExpenses(list);
    } catch {
      toast.error('Failed to load expenses.');
      setExpenses([]);
    }
  };

  useEffect(() => {
    fetchExpenses();
  }, []);

  const handleSubmitExpense = async () => {
    if (!categoryCode || !amount) {
      toast.error('Category Code and Amount are required.');
      return;
    }

    try {
      const baseAmount = convertAmount(Number(amount), activeCurrency, baseCurrency);
      await apiClient.post('/finance/expenses', {
        categoryId: '65f000000000000000000001',
        categoryName:
          categoryCode === '6000'
            ? 'Rent'
            : categoryCode === '6100'
              ? 'Utilities'
              : categoryCode === '6200'
                ? 'Salaries'
                : 'General Expense',
        vendorName,
        amount: baseAmount,
        notes,
      });
      toast.success('Expense Submitted Successfully!');
      setModalOpen(false);
      setVendorName('');
      setNotes('');
      fetchExpenses();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to submit expense.');
    }
  };

  const handleApproveExpense = async (id: string) => {
    try {
      await apiClient.post(`/finance/expenses/${id}/approve`, { action: 'APPROVE' });
      toast.success('Expense Approved & Posted to General Ledger!');
      fetchExpenses();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to approve expense.');
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <PageHeader
        title="Corporate Expense Management"
        subtitle="Submit, review & approve operational expenses with Phase 26 workflow triggers"
        action={
          <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
            <CurrencySelector size="small" />
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => setModalOpen(true)}>
              Submit Expense
            </Button>
          </Box>
        }
      />

      <Card sx={{ borderRadius: 2, boxShadow: 2 }}>
        <CardContent>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Expense #</TableCell>
                <TableCell>Category</TableCell>
                <TableCell>Vendor</TableCell>
                <TableCell>Expense Date</TableCell>
                <TableCell>Total Amount</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="center">Action</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {expenses.map((e) => (
                <TableRow key={e._id}>
                  <TableCell sx={{ fontWeight: 'bold' }}>{e.expenseNumber}</TableCell>
                  <TableCell>{e.categoryName}</TableCell>
                  <TableCell>{e.vendorName || 'N/A'}</TableCell>
                  <TableCell>{new Date(e.expenseDate).toLocaleDateString()}</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>
                    {formatAmount(e.totalAmount || 0)}
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={e.status}
                      size="small"
                      color={
                        e.status === 'POSTED'
                          ? 'success'
                          : e.status === 'PENDING_APPROVAL'
                            ? 'warning'
                            : 'primary'
                      }
                    />
                  </TableCell>
                  <TableCell align="center">
                    {e.status === 'PENDING_APPROVAL' && (
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() => handleApproveExpense(e._id)}
                      >
                        Approve
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={modalOpen} onClose={() => setModalOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 'bold' }}>Submit New Expense</DialogTitle>
        <DialogContent dividers sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField
            select
            label="Expense Category"
            size="small"
            value={categoryCode}
            onChange={(e) => setCategoryCode(e.target.value)}
            fullWidth
          >
            <MenuItem value="6000">Operating & Administrative (6000)</MenuItem>
            <MenuItem value="6100">Rent & Lease (6100)</MenuItem>
            <MenuItem value="6200">Utilities & Power (6200)</MenuItem>
            <MenuItem value="6300">Salaries & Payroll (6300)</MenuItem>
          </TextField>
          <TextField
            label="Vendor / Payee Name"
            size="small"
            value={vendorName}
            onChange={(e) => setVendorName(e.target.value)}
            fullWidth
          />
          <TextField
            label={`Expense Amount (${currencySymbol} ${activeCurrency})`}
            type="number"
            size="small"
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
            helperText={`Input in ${activeCurrency} (will convert to ${baseCurrency} base)`}
            InputProps={{
              startAdornment: <InputAdornment position="start">{currencySymbol}</InputAdornment>,
            }}
            fullWidth
          />
          <TextField
            label="Notes & Justification"
            size="small"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            fullWidth
            multiline
            rows={2}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setModalOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSubmitExpense}>
            Submit Expense
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
