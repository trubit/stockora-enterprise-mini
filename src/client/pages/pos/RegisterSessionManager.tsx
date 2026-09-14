import { useState, useEffect } from 'react';
import {
  Box,
  Grid,
  Paper,
  Typography,
  TextField,
  Button,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Alert,
} from '@mui/material';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import LockIcon from '@mui/icons-material/Lock';
import AddCircleIcon from '@mui/icons-material/AddCircle';
import RemoveCircleIcon from '@mui/icons-material/RemoveCircle';
import PaymentsIcon from '@mui/icons-material/Payments';
import PointOfSaleIcon from '@mui/icons-material/PointOfSale';
import PageHeader from '../../components/PageHeader.tsx';
import StatCard from '../../components/StatCard.tsx';
import { apiClient } from '../../api/client.ts';
import { toast } from 'react-hot-toast';
import { useRegionalSettings } from '../../hooks/useRegionalSettings.js';
import { CurrencySelector } from '../../components/CurrencySelector.tsx';

export default function RegisterSessionManager() {
  const { formatAmount, currencySymbol, baseCurrency, activeCurrency, convertAmount } =
    useRegionalSettings();
  const [activeSession, setActiveSession] = useState<any | null>(null);
  const [openingFloat, setOpeningFloat] = useState<number>(200);
  const [movementModalOpen, setMovementModalOpen] = useState(false);
  const [movementType, setMovementType] = useState<'CASH_IN' | 'CASH_OUT'>('CASH_IN');
  const [movementAmount, setMovementAmount] = useState<number>(0);
  const [movementReason, setMovementReason] = useState<string>('');

  const [closeModalOpen, setCloseModalOpen] = useState(false);
  const [closingCash, setClosingCash] = useState<number>(0);
  const [managerNotes, setManagerNotes] = useState<string>('');

  const fetchActiveSession = async () => {
    try {
      const { data } = await apiClient.get('/pos/register/active/REG-01');
      setActiveSession(data.data);
    } catch {
      setActiveSession(null);
    }
  };

  useEffect(() => {
    fetchActiveSession();
  }, []);

  const handleOpenRegister = async () => {
    try {
      const openingFloatInBase = convertAmount(openingFloat, activeCurrency, baseCurrency);
      const { data } = await apiClient.post('/pos/register/open', {
        registerId: 'REG-01',
        registerName: 'Main Counter Register #1',
        branchId: '000000000000000000000001',
        cashierId: 'CASHIER-01',
        cashierName: 'Alice Operator',
        openingFloat: openingFloatInBase,
        currency: baseCurrency,
      });
      setActiveSession(data.data);
      toast.success('Register opened successfully!');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to open register.');
    }
  };

  const handleCashMovement = async () => {
    if (movementAmount <= 0 || !movementReason) {
      toast.error('Enter a valid amount and reason.');
      return;
    }
    try {
      const amountInBase = convertAmount(movementAmount, activeCurrency, baseCurrency);
      const { data } = await apiClient.post('/pos/register/cash-movement', {
        registerId: 'REG-01',
        type: movementType,
        amount: amountInBase,
        currency: baseCurrency,
        reason: movementReason,
        performedBy: 'Alice Operator',
      });
      setActiveSession(data.data);
      setMovementModalOpen(false);
      setMovementAmount(0);
      setMovementReason('');
      toast.success(`Recorded ${movementType}`);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Cash movement failed.');
    }
  };

  const handleCloseRegister = async () => {
    try {
      const closingCashInBase = convertAmount(closingCash, activeCurrency, baseCurrency);
      const { data } = await apiClient.post('/pos/register/close', {
        registerId: 'REG-01',
        closingCash: closingCashInBase,
        currency: baseCurrency,
        managerNotes,
      });
      setActiveSession(null);
      setCloseModalOpen(false);
      toast.success(`Register Closed! Shift Variance: ${formatAmount(data.data.variance)}`);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Register close failed.');
    }
  };

  const handleOpenCloseModal = () => {
    const displayExpected = convertAmount(
      activeSession?.expectedCash || 0,
      baseCurrency,
      activeCurrency
    );
    setClosingCash(Number(displayExpected.toFixed(2)));
    setCloseModalOpen(true);
  };

  return (
    <Box sx={{ p: 3 }}>
      <PageHeader
        title="Cash Register & Shift Manager"
        subtitle="Opening float management, cash movement tracking, and end-of-shift reconciliation"
        action={
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
            <CurrencySelector size="small" />
            {activeSession ? (
              <>
                <Button
                  variant="outlined"
                  startIcon={<AddCircleIcon />}
                  onClick={() => {
                    setMovementType('CASH_IN');
                    setMovementAmount(0);
                    setMovementModalOpen(true);
                  }}
                >
                  Cash In
                </Button>
                <Button
                  variant="outlined"
                  color="warning"
                  startIcon={<RemoveCircleIcon />}
                  onClick={() => {
                    setMovementType('CASH_OUT');
                    setMovementAmount(0);
                    setMovementModalOpen(true);
                  }}
                >
                  Cash Out
                </Button>
                <Button
                  variant="contained"
                  color="error"
                  startIcon={<LockIcon />}
                  onClick={handleOpenCloseModal}
                >
                  Close Register Shift
                </Button>
              </>
            ) : null}
          </Box>
        }
      />

      {!activeSession ? (
        <Paper sx={{ p: 4, maxWidth: 500, mx: 'auto', textAlign: 'center' }}>
          <LockOpenIcon color="primary" sx={{ fontSize: 48, mb: 2 }} />
          <Typography variant="h5" sx={{ fontWeight: 'bold', mb: 1 }}>
            Register REG-01 is Closed
          </Typography>
          <Typography color="text.secondary" sx={{ mb: 3 }}>
            Enter the starting cash float amount to open the register for cashier sales.
          </Typography>

          <TextField
            label={`Opening Cash Float (${currencySymbol})`}
            type="number"
            fullWidth
            value={openingFloat}
            onChange={(e) => setOpeningFloat(Number(e.target.value))}
            sx={{ mb: 3 }}
          />

          <Button
            variant="contained"
            size="large"
            fullWidth
            startIcon={<LockOpenIcon />}
            onClick={handleOpenRegister}
          >
            Open Register Shift
          </Button>
        </Paper>
      ) : (
        <>
          <Grid container spacing={3} sx={{ mb: 3 }}>
            <Grid item xs={12} sm={6} md={3}>
              <StatCard
                title="Opening Float"
                value={formatAmount(activeSession.openingFloat)}
                subtitle={`Opened by ${activeSession.cashierName}`}
                icon={<LockOpenIcon color="primary" />}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <StatCard
                title="Expected Cash"
                value={formatAmount(activeSession.expectedCash || 0)}
                subtitle="Calculated shift total"
                icon={<LockIcon color="success" />}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <StatCard
                title="Cash Sales"
                value={formatAmount(activeSession.totalCashSales || 0)}
                subtitle="Tendered in cash"
                icon={<PaymentsIcon color="primary" />}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <StatCard
                title="Shift Status"
                value="ACTIVE OPEN"
                subtitle={`Since ${new Date(activeSession.openedAt).toLocaleTimeString()}`}
                icon={<PointOfSaleIcon color="info" />}
              />
            </Grid>
          </Grid>

          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 2 }}>
              Cash Movements & Adjustments Log
            </Typography>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Timestamp</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell>Amount</TableCell>
                  <TableCell>Reason</TableCell>
                  <TableCell>Performed By</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {activeSession.cashMovements.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} align="center">
                      No cash movements recorded during this shift.
                    </TableCell>
                  </TableRow>
                ) : (
                  activeSession.cashMovements.map((m: any, idx: number) => (
                    <TableRow key={idx}>
                      <TableCell>{new Date(m.createdAt).toLocaleTimeString()}</TableCell>
                      <TableCell>
                        <Chip
                          label={m.type}
                          color={m.type === 'CASH_IN' ? 'success' : 'warning'}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>{formatAmount(m.amount)}</TableCell>
                      <TableCell>{m.reason}</TableCell>
                      <TableCell>{m.performedBy}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Paper>
        </>
      )}

      {/* Cash Movement Dialog */}
      <Dialog
        open={movementModalOpen}
        onClose={() => setMovementModalOpen(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 'bold' }}>Record {movementType}</DialogTitle>
        <DialogContent dividers>
          <TextField
            label={`Amount (${currencySymbol})`}
            type="number"
            fullWidth
            value={movementAmount}
            onChange={(e) => setMovementAmount(Number(e.target.value))}
            sx={{ mb: 2 }}
          />
          <TextField
            label="Reason / Audit Explanation"
            fullWidth
            multiline
            rows={2}
            value={movementReason}
            onChange={(e) => setMovementReason(e.target.value)}
            placeholder="e.g., Petty cash withdrawal or additional register float"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setMovementModalOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleCashMovement}>
            Submit {movementType}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Register Close Reconciliation Dialog */}
      <Dialog
        open={closeModalOpen}
        onClose={() => setCloseModalOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 'bold' }}>Close Register & Shift Reconciliation</DialogTitle>
        <DialogContent dividers>
          <Alert severity="info" sx={{ mb: 2 }}>
            Expected Cash in Register Drawer:{' '}
            <strong>{formatAmount(activeSession?.expectedCash || 0)}</strong>
          </Alert>

          <TextField
            label={`Actual Cash Counted in Drawer (${currencySymbol})`}
            type="number"
            fullWidth
            value={closingCash}
            onChange={(e) => setClosingCash(Number(e.target.value))}
            sx={{ mb: 2 }}
          />

          {(() => {
            const displayExpected = convertAmount(
              activeSession?.expectedCash || 0,
              baseCurrency,
              activeCurrency
            );
            const displayVariance = closingCash - displayExpected;
            return (
              <Box sx={{ p: 2, bgcolor: '#f8f9fa', borderRadius: 1, mb: 2 }}>
                <Typography variant="subtitle2" color="text.secondary">
                  Calculated Shift Variance:
                </Typography>
                <Typography
                  variant="h5"
                  sx={{
                    fontWeight: 'bold',
                    color:
                      displayVariance === 0
                        ? 'success.main'
                        : displayVariance > 0
                          ? 'info.main'
                          : 'error.main',
                  }}
                >
                  {formatAmount(displayVariance, { currency: activeCurrency, convert: false })}
                </Typography>
              </Box>
            );
          })()}

          <TextField
            label="Manager Notes / Variance Explanation"
            fullWidth
            multiline
            rows={2}
            value={managerNotes}
            onChange={(e) => setManagerNotes(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCloseModalOpen(false)}>Cancel</Button>
          <Button variant="contained" color="error" onClick={handleCloseRegister}>
            Finalize Close Shift
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
