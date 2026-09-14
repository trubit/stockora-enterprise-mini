import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Grid,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import { api } from '../../api/client.ts';
import { toast } from 'react-hot-toast';
import { useRegionalSettings } from '../../hooks/useRegionalSettings.js';

export default function ProcurementBudgetManager() {
  const { formatAmount, currencySymbol } = useRegionalSettings();
  const [budgets, setBudgets] = useState<any[]>([]);
  const [openModal, setOpenModal] = useState(false);
  const [formData, setFormData] = useState({
    department: 'Procurement & Logistics',
    category: 'PRODUCT',
    fiscalYear: 2026,
    allocatedAmount: 150000,
    overBudgetPolicy: 'APPROVAL_REQUIRED',
  });

  const fetchBudgets = async () => {
    try {
      const res = await api.get('/procurement/budgets');
      setBudgets(
        res.data || [
          {
            _id: 'b-001',
            department: 'Logistics & Warehouse Operations',
            category: 'EQUIPMENT',
            fiscalYear: 2026,
            allocatedAmount: 250000,
            committedAmount: 65000,
            remainingAmount: 185000,
            overBudgetPolicy: 'APPROVAL_REQUIRED',
          },
        ]
      );
    } catch {
      toast.error('Failed to load procurement budgets.');
    }
  };

  useEffect(() => {
    fetchBudgets();
  }, []);

  const handleCreateBudget = async () => {
    try {
      await api.post('/procurement/budgets', {
        ...formData,
        allocatedAmount: Number(formData.allocatedAmount),
        remainingAmount: Number(formData.allocatedAmount),
      });
      toast.success('Departmental procurement budget created!');
      setOpenModal(false);
      fetchBudgets();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to create budget.');
    }
  };

  return (
    <Box sx={{ p: 3, background: '#0b0f19', minHeight: '100vh', color: '#f8fafc' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography
            variant="h4"
            sx={{
              fontWeight: 800,
              color: '#8b5cf6',
              display: 'flex',
              alignItems: 'center',
              gap: 1.5,
            }}
          >
            <AccountBalanceIcon fontSize="large" /> Departmental Procurement Budget Management
          </Typography>
          <Typography variant="body2" sx={{ color: '#9ca3af', mt: 0.5 }}>
            Set annual department procurement budgets, monitor committed vs spent allocations &
            configure over-budget policy rules
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setOpenModal(true)}
          sx={{
            background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
            color: '#ffffff',
            fontWeight: 600,
            borderRadius: '9999px',
            px: 3,
            '&:hover': {
              background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
            },
          }}
        >
          Create Budget
        </Button>
      </Box>

      <Paper
        sx={{
          p: 3,
          background: '#111827',
          border: '1px solid #1f2937',
          borderRadius: 3,
          color: '#f8fafc',
        }}
      >
        <TableContainer>
          <Table>
            <TableHead sx={{ background: '#1f2937' }}>
              <TableRow>
                <TableCell sx={{ color: '#9ca3af', fontWeight: 600 }}>Department</TableCell>
                <TableCell sx={{ color: '#9ca3af', fontWeight: 600 }}>Category</TableCell>
                <TableCell sx={{ color: '#9ca3af', fontWeight: 600 }}>Fiscal Year</TableCell>
                <TableCell sx={{ color: '#9ca3af', fontWeight: 600 }}>Allocated Amount</TableCell>
                <TableCell sx={{ color: '#9ca3af', fontWeight: 600 }}>Committed Spend</TableCell>
                <TableCell sx={{ color: '#9ca3af', fontWeight: 600 }}>Remaining Balance</TableCell>
                <TableCell sx={{ color: '#9ca3af', fontWeight: 600 }}>Policy</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {budgets.map((b) => {
                return (
                  <TableRow key={b._id} sx={{ '&:hover': { background: '#1e293b' } }}>
                    <TableCell sx={{ color: '#f8fafc', fontWeight: 700 }}>{b.department}</TableCell>
                    <TableCell>
                      <Chip
                        label={b.category || 'GENERAL'}
                        size="small"
                        sx={{ background: '#374151', color: '#cbd5e1', fontWeight: 600 }}
                      />
                    </TableCell>
                    <TableCell sx={{ color: '#818cf8', fontWeight: 700 }}>
                      {b.fiscalYear || 2026}
                    </TableCell>
                    <TableCell sx={{ color: '#f8fafc', fontWeight: 700 }}>
                      {formatAmount(b.allocatedAmount || 0)}
                    </TableCell>
                    <TableCell sx={{ color: '#fbbf24', fontWeight: 700 }}>
                      {formatAmount(b.committedAmount || 0)}
                    </TableCell>
                    <TableCell sx={{ color: '#34d399', fontWeight: 700 }}>
                      {formatAmount(b.remainingAmount || b.allocatedAmount)}
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={b.overBudgetPolicy}
                        size="small"
                        sx={{
                          fontWeight: 600,
                          background: 'rgba(56, 189, 248, 0.2)',
                          color: '#38bdf8',
                        }}
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* Budget Dialog */}
      <Dialog
        open={openModal}
        onClose={() => setOpenModal(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: { background: '#111827', color: '#f8fafc', border: '1px solid #1f2937' },
        }}
      >
        <DialogTitle sx={{ fontWeight: 700, borderBottom: '1px solid #1f2937' }}>
          Allocate Procurement Budget
        </DialogTitle>
        <DialogContent sx={{ mt: 2 }}>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Department Name"
                value={formData.department}
                onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                InputLabelProps={{ shrink: true, style: { color: '#9ca3af' } }}
                InputProps={{ style: { color: '#fff' } }}
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                select
                fullWidth
                label="Procurement Category"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                SelectProps={{ native: true }}
                InputLabelProps={{ shrink: true, style: { color: '#9ca3af' } }}
                InputProps={{ style: { color: '#fff' } }}
              >
                <option value="PRODUCT" style={{ background: '#111827' }}>
                  PRODUCT - Finished Goods
                </option>
                <option value="RAW_MATERIAL" style={{ background: '#111827' }}>
                  RAW_MATERIAL - Production Input
                </option>
                <option value="PACKAGING" style={{ background: '#111827' }}>
                  PACKAGING - Shipping Supplies
                </option>
                <option value="EQUIPMENT" style={{ background: '#111827' }}>
                  EQUIPMENT - Machinery & Tools
                </option>
                <option value="SERVICES" style={{ background: '#111827' }}>
                  SERVICES - Logistics & Maintenance
                </option>
              </TextField>
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                type="number"
                label="Fiscal Year"
                value={formData.fiscalYear}
                onChange={(e) => setFormData({ ...formData, fiscalYear: Number(e.target.value) })}
                InputLabelProps={{ shrink: true, style: { color: '#9ca3af' } }}
                InputProps={{ style: { color: '#fff' } }}
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                type="number"
                label={`Allocated Amount (${currencySymbol})`}
                value={formData.allocatedAmount}
                onChange={(e) =>
                  setFormData({ ...formData, allocatedAmount: Number(e.target.value) })
                }
                InputLabelProps={{ shrink: true, style: { color: '#9ca3af' } }}
                InputProps={{ style: { color: '#fff' } }}
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                select
                fullWidth
                label="Over-Budget Policy"
                value={formData.overBudgetPolicy}
                onChange={(e) => setFormData({ ...formData, overBudgetPolicy: e.target.value })}
                SelectProps={{ native: true }}
                InputLabelProps={{ shrink: true, style: { color: '#9ca3af' } }}
                InputProps={{ style: { color: '#fff' } }}
              >
                <option value="APPROVAL_REQUIRED" style={{ background: '#111827' }}>
                  APPROVAL_REQUIRED - Escalate to VP
                </option>
                <option value="ALLOW_WARNING" style={{ background: '#111827' }}>
                  ALLOW_WARNING - Log Soft Alert
                </option>
                <option value="BLOCK" style={{ background: '#111827' }}>
                  BLOCK - Hard Stop
                </option>
              </TextField>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ p: 2.5, borderTop: '1px solid #1f2937' }}>
          <Button onClick={() => setOpenModal(false)} sx={{ color: '#9ca3af' }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleCreateBudget}
            sx={{ background: '#8b5cf6', color: '#fff' }}
          >
            Save Budget
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
