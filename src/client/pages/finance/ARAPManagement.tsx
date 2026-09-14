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
  Button,
  Grid,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  CircularProgress,
} from '@mui/material';
import PageHeader from '../../components/PageHeader';
import { apiClient } from '../../api/client';
import { toast } from 'react-hot-toast';
import { useRegionalSettings } from '../../hooks/useRegionalSettings.js';

export default function ARAPManagement() {
  const { formatAmount, currencySymbol } = useRegionalSettings();
  const [tab, setTab] = useState(0);
  const [arRecords, setArRecords] = useState<any[]>([]);
  const [apRecords, setApRecords] = useState<any[]>([]);
  const [arSummary, setArSummary] = useState<any>(null);
  const [apSummary, setApSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Payment Modal State
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<any>(null);
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState('BANK_TRANSFER');
  const [paymentRef, setPaymentRef] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchARAP = async () => {
    try {
      setLoading(true);
      const [arRes, apRes] = await Promise.all([
        apiClient.get('/finance/receivables').catch(() => ({ data: { data: [] } })),
        apiClient.get('/finance/payables').catch(() => ({ data: { data: [] } })),
      ]);

      const arData = arRes.data?.data;
      if (arData && Array.isArray(arData.receivables)) {
        setArRecords(arData.receivables);
        setArSummary(arData.summary);
      } else if (Array.isArray(arData)) {
        setArRecords(arData);
      } else {
        setArRecords([]);
      }

      const apData = apRes.data?.data;
      if (apData && Array.isArray(apData.payables)) {
        setApRecords(apData.payables);
        setApSummary(apData.summary);
      } else if (Array.isArray(apData)) {
        setApRecords(apData);
      } else {
        setApRecords([]);
      }
    } catch {
      toast.error('Failed to load AR/AP records.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchARAP();
  }, []);

  const handleOpenPayment = (record: any) => {
    setSelectedRecord(record);
    setPaymentAmount(record.balanceDue || record.totalAmount || 0);
    setPaymentRef('');
    setPaymentModalOpen(true);
  };

  const handleConfirmPayment = async () => {
    if (!selectedRecord || paymentAmount <= 0) {
      toast.error('Please enter a valid payment amount.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (tab === 0) {
        // AR Customer Payment
        await apiClient.post('/finance/receivables/pay', {
          receivableId: selectedRecord._id,
          amount: paymentAmount,
          paymentMethod,
          reference: paymentRef,
        });
        toast.success('Customer Payment Recorded & Posted to Ledger!');
      } else {
        // AP Supplier Disbursement
        await apiClient.post('/finance/payables/disburse', {
          payableId: selectedRecord._id,
          amount: paymentAmount,
          paymentMethod,
          reference: paymentRef,
        });
        toast.success('Supplier Disbursement Recorded & Posted to Ledger!');
      }
      setPaymentModalOpen(false);
      fetchARAP();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to record payment.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <PageHeader
        title="Accounts Receivable (AR) & Accounts Payable (AP)"
        subtitle="Manage customer credit exposures, supplier invoices, and 30-60-90+ day aging buckets"
      />

      {/* Summary KPI Cards */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ borderRadius: 2, boxShadow: 1 }}>
            <CardContent>
              <Typography variant="caption" color="text.secondary">
                Total Customer Receivables
              </Typography>
              <Typography variant="h5" sx={{ fontWeight: 'bold', color: 'primary.main' }}>
                {formatAmount(
                  (arSummary?.totalOutstanding ??
                    arRecords.reduce((sum, r) => sum + (r.balanceDue || 0), 0)) ||
                    0
                )}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Current: {formatAmount(arSummary?.current || 0)} | Overdue:{' '}
                {formatAmount((arSummary?.days90Plus || 0) + (arSummary?.days61_90 || 0))}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ borderRadius: 2, boxShadow: 1 }}>
            <CardContent>
              <Typography variant="caption" color="text.secondary">
                Total Supplier Payables
              </Typography>
              <Typography variant="h5" sx={{ fontWeight: 'bold', color: 'error.main' }}>
                {formatAmount(
                  (apSummary?.totalOutstanding ??
                    apRecords.reduce((sum, r) => sum + (r.balanceDue || 0), 0)) ||
                    0
                )}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Current: {formatAmount(apSummary?.current || 0)} | Overdue:{' '}
                {formatAmount((apSummary?.days90Plus || 0) + (apSummary?.days61_90 || 0))}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Card sx={{ borderRadius: 2, boxShadow: 2 }}>
        <Tabs
          value={tab}
          onChange={(_, v) => setTab(v)}
          sx={{ borderBottom: 1, borderColor: 'divider' }}
        >
          <Tab label={`Accounts Receivable (${arRecords.length})`} />
          <Tab label={`Accounts Payable (${apRecords.length})`} />
        </Tabs>

        <CardContent>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
              <CircularProgress />
            </Box>
          ) : tab === 0 ? (
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 2 }}>
                Customer Credit Receivables & Aging
              </Typography>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Invoice #</TableCell>
                    <TableCell>Customer</TableCell>
                    <TableCell>Total Amount</TableCell>
                    <TableCell>Balance Due</TableCell>
                    <TableCell>Aging Bucket</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell align="center">Action</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {arRecords.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} align="center" sx={{ py: 3 }}>
                        No active customer receivables.
                      </TableCell>
                    </TableRow>
                  ) : (
                    arRecords.map((ar) => (
                      <TableRow key={ar._id}>
                        <TableCell sx={{ fontWeight: 'bold' }}>{ar.invoiceNumber}</TableCell>
                        <TableCell>{ar.customerName}</TableCell>
                        <TableCell>{formatAmount(ar.totalAmount || 0)}</TableCell>
                        <TableCell sx={{ fontWeight: 'bold', color: 'error.main' }}>
                          {formatAmount(ar.balanceDue || 0)}
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={ar.currentBucket || ar.agingBucket}
                            size="small"
                            variant="outlined"
                          />
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={ar.status}
                            size="small"
                            color={ar.status === 'PAID' ? 'success' : 'warning'}
                          />
                        </TableCell>
                        <TableCell align="center">
                          {ar.balanceDue > 0 && (
                            <Button
                              size="small"
                              variant="contained"
                              onClick={() => handleOpenPayment(ar)}
                            >
                              Record Payment
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </Box>
          ) : (
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 2 }}>
                Supplier Accounts Payable & Bills
              </Typography>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Invoice / Bill #</TableCell>
                    <TableCell>Supplier Name</TableCell>
                    <TableCell>Total Amount</TableCell>
                    <TableCell>Balance Due</TableCell>
                    <TableCell>Aging Bucket</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell align="center">Action</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {apRecords.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} align="center" sx={{ py: 3 }}>
                        No active supplier payables.
                      </TableCell>
                    </TableRow>
                  ) : (
                    apRecords.map((ap) => (
                      <TableRow key={ap._id}>
                        <TableCell sx={{ fontWeight: 'bold' }}>{ap.invoiceNumber}</TableCell>
                        <TableCell>{ap.supplierName}</TableCell>
                        <TableCell>{formatAmount(ap.totalAmount || 0)}</TableCell>
                        <TableCell sx={{ fontWeight: 'bold', color: 'error.main' }}>
                          {formatAmount(ap.balanceDue || 0)}
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={ap.currentBucket || ap.agingBucket}
                            size="small"
                            variant="outlined"
                          />
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={ap.status}
                            size="small"
                            color={ap.status === 'PAID' ? 'success' : 'warning'}
                          />
                        </TableCell>
                        <TableCell align="center">
                          {ap.balanceDue > 0 && (
                            <Button
                              size="small"
                              variant="contained"
                              color="secondary"
                              onClick={() => handleOpenPayment(ap)}
                            >
                              Disburse
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Payment Settlement Modal */}
      <Dialog
        open={paymentModalOpen}
        onClose={() => setPaymentModalOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 'bold' }}>
          {tab === 0 ? 'Record Customer Payment' : 'Record Supplier Disbursement'}
        </DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          <Typography variant="body2" color="text.secondary">
            Invoice: <strong>{selectedRecord?.invoiceNumber}</strong> (
            {selectedRecord?.customerName || selectedRecord?.supplierName})
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Remaining Outstanding: <strong>{formatAmount(selectedRecord?.balanceDue || 0)}</strong>
          </Typography>

          <TextField
            label={`Payment Amount (${currencySymbol})`}
            type="number"
            value={paymentAmount}
            onChange={(e) => setPaymentAmount(parseFloat(e.target.value) || 0)}
            fullWidth
          />

          <TextField
            select
            label="Payment Method"
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value)}
            fullWidth
          >
            <MenuItem value="BANK_TRANSFER">Bank Transfer (Operating Bank)</MenuItem>
            <MenuItem value="CASH">Cash (Vault / Drawer)</MenuItem>
            <MenuItem value="CARD">Debit / Credit Card</MenuItem>
            <MenuItem value="CHEQUE">Cheque</MenuItem>
          </TextField>

          <TextField
            label="Reference / Transaction Note"
            placeholder="e.g. Bank Ref #, Wire ID"
            value={paymentRef}
            onChange={(e) => setPaymentRef(e.target.value)}
            fullWidth
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPaymentModalOpen(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button variant="contained" onClick={handleConfirmPayment} disabled={isSubmitting}>
            {isSubmitting ? 'Posting...' : 'Post Settlement to Ledger'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
