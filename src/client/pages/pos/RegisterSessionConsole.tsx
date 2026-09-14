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
  Card,
  CardContent,
  MenuItem,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import PointOfSaleIcon from '@mui/icons-material/PointOfSale';
import PaymentsIcon from '@mui/icons-material/Payments';
import LockIcon from '@mui/icons-material/Lock';
import { api } from '../../api/client.ts';
import { toast } from 'react-hot-toast';
import { useRegionalSettings } from '../../hooks/useRegionalSettings.js';
import { CurrencySelector } from '../../components/CurrencySelector.tsx';

export default function RegisterSessionConsole() {
  const { formatAmount, currencySymbol, baseCurrency, activeCurrency, convertAmount } =
    useRegionalSettings();
  const [session, setSession] = useState<any>(null);
  const [openModal, setOpenModal] = useState(false);
  const [openCashModal, setOpenCashModal] = useState(false);
  const [openCloseModal, setOpenCloseModal] = useState(false);

  const [openForm, setOpenForm] = useState({
    registerId: 'REG-001',
    registerName: 'Main Store POS Register 1',
    branchId: '60c72b2f9b1d8b0015b8b8b8',
    openingFloat: 200,
  });

  const [cashForm, setCashForm] = useState({
    type: 'SAFE_DROP',
    amount: 100,
    reason: 'Mid-day safe drop deposit',
  });

  const [closeForm, setCloseForm] = useState({
    closingCash: 650,
    managerNotes: 'Standard end-of-shift register closure',
  });

  const fetchSession = async () => {
    try {
      const res = await api.get('/pos-advanced/register/active/REG-001');
      setSession(res.data || null);
    } catch {
      // Soft ignore if register not open
    }
  };

  useEffect(() => {
    fetchSession();
  }, []);

  const handleOpenRegister = async () => {
    try {
      const openingFloatInBase = convertAmount(
        Number(openForm.openingFloat),
        activeCurrency,
        baseCurrency
      );
      const res = await api.post('/pos-advanced/register/open', {
        ...openForm,
        openingFloat: openingFloatInBase,
        currency: baseCurrency,
      });
      setSession(res.data);
      toast.success('Register session opened!');
      setOpenModal(false);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to open register.');
    }
  };

  const handleCashMovement = async () => {
    try {
      if (!session) return;
      const amountInBase = convertAmount(Number(cashForm.amount), activeCurrency, baseCurrency);
      await api.post(`/pos-advanced/register/${session._id}/cash-movement`, {
        ...cashForm,
        amount: amountInBase,
        currency: baseCurrency,
      });
      toast.success('Cash movement recorded successfully!');
      setOpenCashModal(false);
      fetchSession();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to record cash movement.');
    }
  };

  const handleCloseRegister = async () => {
    try {
      if (!session) return;
      const closingCashInBase = convertAmount(
        Number(closeForm.closingCash),
        activeCurrency,
        baseCurrency
      );
      await api.post(`/pos-advanced/register/${session._id}/close`, {
        ...closeForm,
        closingCash: closingCashInBase,
        currency: baseCurrency,
      });
      toast.success('Register session closed & variance calculated!');
      setOpenCloseModal(false);
      fetchSession();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to close register.');
    }
  };

  return (
    <Box sx={{ p: 3, background: '#0b0f19', minHeight: '100vh', color: '#f8fafc' }}>
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          mb: 3,
          flexWrap: 'wrap',
          gap: 2,
        }}
      >
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
            <PointOfSaleIcon fontSize="large" /> Cash Register Management & Shift Sessions
          </Typography>
          <Typography variant="body2" sx={{ color: '#9ca3af', mt: 0.5 }}>
            Opening floats, cash drop movements, petty cash audits & shift close cash reconciliation
            variances
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <CurrencySelector size="small" />
          {!session || session.status === 'CLOSED' ? (
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setOpenModal(true)}
              sx={{ background: '#8b5cf6', color: '#fff' }}
            >
              Open Register Shift
            </Button>
          ) : (
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                variant="outlined"
                startIcon={<PaymentsIcon />}
                onClick={() => setOpenCashModal(true)}
                sx={{ color: '#38bdf8', borderColor: '#38bdf8' }}
              >
                Cash In / Safe Drop
              </Button>
              <Button
                variant="contained"
                startIcon={<LockIcon />}
                onClick={() => setOpenCloseModal(true)}
                sx={{ background: '#f87171', color: '#fff' }}
              >
                Close Register Shift
              </Button>
            </Box>
          )}
        </Box>
      </Box>

      {/* Session KPI Summary */}
      {session && (
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid item xs={12} sm={3}>
            <Card
              sx={{
                background: '#111827',
                border: '1px solid #1f2937',
                color: '#f8fafc',
                borderRadius: 3,
              }}
            >
              <CardContent>
                <Typography variant="caption" sx={{ color: '#9ca3af' }}>
                  Opening Float
                </Typography>
                <Typography variant="h4" sx={{ fontWeight: 800, mt: 1, color: '#818cf8' }}>
                  {formatAmount(session.openingFloat)}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={3}>
            <Card
              sx={{
                background: '#111827',
                border: '1px solid #1f2937',
                color: '#f8fafc',
                borderRadius: 3,
              }}
            >
              <CardContent>
                <Typography variant="caption" sx={{ color: '#9ca3af' }}>
                  Expected Cash
                </Typography>
                <Typography variant="h4" sx={{ fontWeight: 800, mt: 1, color: '#34d399' }}>
                  {formatAmount(session.expectedCash || session.openingFloat)}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={3}>
            <Card
              sx={{
                background: '#111827',
                border: '1px solid #1f2937',
                color: '#f8fafc',
                borderRadius: 3,
              }}
            >
              <CardContent>
                <Typography variant="caption" sx={{ color: '#9ca3af' }}>
                  Closing Count
                </Typography>
                <Typography variant="h4" sx={{ fontWeight: 800, mt: 1, color: '#fbbf24' }}>
                  {formatAmount(session.closingCash || 0)}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={3}>
            <Card
              sx={{
                background: '#111827',
                border: '1px solid #1f2937',
                color: '#f8fafc',
                borderRadius: 3,
              }}
            >
              <CardContent>
                <Typography variant="caption" sx={{ color: '#9ca3af' }}>
                  Variance
                </Typography>
                <Typography
                  variant="h4"
                  sx={{
                    fontWeight: 800,
                    mt: 1,
                    color: (session.variance || 0) < 0 ? '#f87171' : '#34d399',
                  }}
                >
                  {formatAmount(session.variance || 0)}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Cash Movements Table */}
      <Paper
        sx={{
          p: 3,
          background: '#111827',
          border: '1px solid #1f2937',
          borderRadius: 3,
          color: '#f8fafc',
        }}
      >
        <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
          Cash Movement Audit Log
        </Typography>
        <TableContainer>
          <Table>
            <TableHead sx={{ background: '#1f2937' }}>
              <TableRow>
                <TableCell sx={{ color: '#9ca3af' }}>Timestamp</TableCell>
                <TableCell sx={{ color: '#9ca3af' }}>Type</TableCell>
                <TableCell sx={{ color: '#9ca3af' }}>Amount</TableCell>
                <TableCell sx={{ color: '#9ca3af' }}>Performed By</TableCell>
                <TableCell sx={{ color: '#9ca3af' }}>Reason</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {session?.cashMovements?.map((m: any, idx: number) => (
                <TableRow key={idx} sx={{ '&:hover': { background: '#1e293b' } }}>
                  <TableCell sx={{ color: '#cbd5e1' }}>
                    {new Date(m.createdAt).toLocaleTimeString()}
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={m.type}
                      size="small"
                      sx={{
                        background:
                          m.type === 'CASH_IN'
                            ? 'rgba(16, 185, 129, 0.2)'
                            : 'rgba(239, 68, 68, 0.2)',
                        color: m.type === 'CASH_IN' ? '#34d399' : '#f87171',
                      }}
                    />
                  </TableCell>
                  <TableCell sx={{ color: '#f8fafc', fontWeight: 700 }}>
                    {formatAmount(m.amount)}
                  </TableCell>
                  <TableCell sx={{ color: '#818cf8' }}>{m.performedBy}</TableCell>
                  <TableCell sx={{ color: '#9ca3af' }}>{m.reason}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* Open Register Dialog */}
      <Dialog
        open={openModal}
        onClose={() => setOpenModal(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{
          sx: { background: '#111827', color: '#f8fafc', border: '1px solid #1f2937' },
        }}
      >
        <DialogTitle sx={{ fontWeight: 700, borderBottom: '1px solid #1f2937' }}>
          Open Register Shift
        </DialogTitle>
        <DialogContent sx={{ mt: 2 }}>
          <TextField
            fullWidth
            label={`Opening Float (${currencySymbol})`}
            type="number"
            value={openForm.openingFloat}
            onChange={(e) => setOpenForm({ ...openForm, openingFloat: Number(e.target.value) })}
            InputLabelProps={{ shrink: true, style: { color: '#9ca3af' } }}
            InputProps={{ style: { color: '#fff' } }}
          />
        </DialogContent>
        <DialogActions sx={{ p: 2.5, borderTop: '1px solid #1f2937' }}>
          <Button onClick={() => setOpenModal(false)} sx={{ color: '#9ca3af' }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleOpenRegister}
            sx={{ background: '#8b5cf6', color: '#fff' }}
          >
            Start Shift
          </Button>
        </DialogActions>
      </Dialog>

      {/* Cash Movement Dialog */}
      <Dialog
        open={openCashModal}
        onClose={() => setOpenCashModal(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{
          sx: { background: '#111827', color: '#f8fafc', border: '1px solid #1f2937' },
        }}
      >
        <DialogTitle sx={{ fontWeight: 700, borderBottom: '1px solid #1f2937' }}>
          Record Cash Movement
        </DialogTitle>
        <DialogContent sx={{ mt: 2 }}>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <TextField
                select
                fullWidth
                label="Movement Type"
                value={cashForm.type}
                onChange={(e) => setCashForm({ ...cashForm, type: e.target.value })}
                InputLabelProps={{ shrink: true, style: { color: '#9ca3af' } }}
                InputProps={{ style: { color: '#fff' } }}
                SelectProps={{
                  MenuProps: {
                    PaperProps: {
                      sx: { background: '#111827', border: '1px solid #1f2937', color: '#f8fafc' },
                    },
                  },
                }}
              >
                <MenuItem value="SAFE_DROP" sx={{ color: '#f8fafc', background: '#111827' }}>
                  SAFE_DROP - Cash Deposit to Safe
                </MenuItem>
                <MenuItem value="PETTY_CASH" sx={{ color: '#f8fafc', background: '#111827' }}>
                  PETTY_CASH - Store Expenses
                </MenuItem>
                <MenuItem value="CASH_IN" sx={{ color: '#f8fafc', background: '#111827' }}>
                  CASH_IN - Add Float
                </MenuItem>
                <MenuItem value="CASH_OUT" sx={{ color: '#f8fafc', background: '#111827' }}>
                  CASH_OUT - Withdrawal
                </MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                type="number"
                label={`Amount (${currencySymbol})`}
                value={cashForm.amount}
                onChange={(e) => setCashForm({ ...cashForm, amount: Number(e.target.value) })}
                InputLabelProps={{ shrink: true, style: { color: '#9ca3af' } }}
                InputProps={{ style: { color: '#fff' } }}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Reason"
                value={cashForm.reason}
                onChange={(e) => setCashForm({ ...cashForm, reason: e.target.value })}
                InputLabelProps={{ shrink: true, style: { color: '#9ca3af' } }}
                InputProps={{ style: { color: '#fff' } }}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ p: 2.5, borderTop: '1px solid #1f2937' }}>
          <Button onClick={() => setOpenCashModal(false)} sx={{ color: '#9ca3af' }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleCashMovement}
            sx={{ background: '#38bdf8', color: '#fff' }}
          >
            Submit Movement
          </Button>
        </DialogActions>
      </Dialog>

      {/* Close Register Dialog */}
      <Dialog
        open={openCloseModal}
        onClose={() => setOpenCloseModal(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{
          sx: { background: '#111827', color: '#f8fafc', border: '1px solid #1f2937' },
        }}
      >
        <DialogTitle sx={{ fontWeight: 700, borderBottom: '1px solid #1f2937' }}>
          Close Register Shift
        </DialogTitle>
        <DialogContent sx={{ mt: 2 }}>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                type="number"
                label={`Counted Closing Cash (${currencySymbol})`}
                value={closeForm.closingCash}
                onChange={(e) =>
                  setCloseForm({ ...closeForm, closingCash: Number(e.target.value) })
                }
                InputLabelProps={{ shrink: true, style: { color: '#9ca3af' } }}
                InputProps={{ style: { color: '#fff' } }}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Closure / Variance Notes"
                value={closeForm.managerNotes}
                onChange={(e) => setCloseForm({ ...closeForm, managerNotes: e.target.value })}
                InputLabelProps={{ shrink: true, style: { color: '#9ca3af' } }}
                InputProps={{ style: { color: '#fff' } }}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ p: 2.5, borderTop: '1px solid #1f2937' }}>
          <Button onClick={() => setOpenCloseModal(false)} sx={{ color: '#9ca3af' }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleCloseRegister}
            sx={{ background: '#f87171', color: '#fff' }}
          >
            Confirm Shift Close
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
