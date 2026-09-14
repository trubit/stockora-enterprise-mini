import { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Button,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControlLabel,
  Checkbox,
} from '@mui/material';
import PageHeader from '../../components/PageHeader.tsx';
import AssignmentReturnIcon from '@mui/icons-material/AssignmentReturn';
import { apiClient } from '../../api/client.ts';
import { toast } from 'react-hot-toast';
import { useRegionalSettings } from '../../hooks/useRegionalSettings.js';

export default function ReturnsRefundsManager() {
  const { formatAmount, currencySymbol } = useRegionalSettings();
  const [returns, setReturns] = useState<any[]>([]);
  const [returnModalOpen, setReturnModalOpen] = useState(false);
  const [orderNumber, setOrderNumber] = useState<string>('');
  const [refundAmount, setRefundAmount] = useState<number>(0);
  const [reason, setReason] = useState<string>('');
  const [approvedBy, setApprovedBy] = useState<string>('Manager');
  const [restock, setRestock] = useState<boolean>(true);

  const fetchReturns = async () => {
    try {
      const { data } = await apiClient.get('/orders', {
        params: { status: 'RETURNED' },
      });
      setReturns(data.data || []);
    } catch {
      toast.error('Failed to load return history.');
    }
  };

  useEffect(() => {
    fetchReturns();
  }, []);

  const handleProcessReturn = async () => {
    if (!orderNumber || refundAmount <= 0 || !reason) {
      toast.error('Please enter valid order number, refund amount, and reason.');
      return;
    }

    try {
      await apiClient.post(`/orders/${orderNumber}/return`, {
        reason,
        refundAmount,
        approvedBy,
        restock,
      });
      toast.success(`Return & Refund Processed for Order #${orderNumber}!`);
      setReturnModalOpen(false);
      setOrderNumber('');
      setRefundAmount(0);
      setReason('');
      fetchReturns();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Return processing failed.');
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <PageHeader
        title="Returns & Refund Management"
        subtitle="Process order returns, restocking actions, and manager refund approvals"
        action={
          <Button
            variant="contained"
            color="secondary"
            startIcon={<AssignmentReturnIcon />}
            onClick={() => setReturnModalOpen(true)}
          >
            Process New Return / Refund
          </Button>
        }
      />

      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 2 }}>
          Returned Orders Log
        </Typography>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Order Number</TableCell>
              <TableCell>Channel</TableCell>
              <TableCell>Customer</TableCell>
              <TableCell>Original Total</TableCell>
              <TableCell>Payment Status</TableCell>
              <TableCell>Order Status</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {returns.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} align="center">
                  No returned orders recorded yet.
                </TableCell>
              </TableRow>
            ) : (
              returns.map((r) => (
                <TableRow key={r.orderNumber}>
                  <TableCell sx={{ fontWeight: 'bold' }}>{r.orderNumber}</TableCell>
                  <TableCell>{r.channel}</TableCell>
                  <TableCell>{r.customerName || 'Walk-in'}</TableCell>
                  <TableCell>{formatAmount(r.grandTotal)}</TableCell>
                  <TableCell>
                    <Chip label={r.paymentStatus} color="error" size="small" />
                  </TableCell>
                  <TableCell>
                    <Chip label={r.status} color="warning" size="small" />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Paper>

      {/* Process Return Dialog */}
      <Dialog
        open={returnModalOpen}
        onClose={() => setReturnModalOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 'bold' }}>Process Order Return & Refund</DialogTitle>
        <DialogContent dividers>
          <TextField
            label="Order Number (e.g. POS-2026-000001 or STK-2026-000001)"
            fullWidth
            value={orderNumber}
            onChange={(e) => setOrderNumber(e.target.value)}
            sx={{ mb: 2 }}
          />

          <TextField
            label={`Refund Amount (${currencySymbol})`}
            type="number"
            fullWidth
            value={refundAmount}
            onChange={(e) => setRefundAmount(Number(e.target.value))}
            sx={{ mb: 2 }}
          />

          <TextField
            label="Return Reason"
            fullWidth
            multiline
            rows={2}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Defective item, customer changed mind, wrong size"
            sx={{ mb: 2 }}
          />

          <TextField
            label="Approved By (Manager Signature)"
            fullWidth
            value={approvedBy}
            onChange={(e) => setApprovedBy(e.target.value)}
            sx={{ mb: 2 }}
          />

          <FormControlLabel
            control={
              <Checkbox
                checked={restock}
                onChange={(e) => setRestock(e.target.checked)}
                color="primary"
              />
            }
            label="Automatically restock items back into warehouse inventory"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setReturnModalOpen(false)}>Cancel</Button>
          <Button variant="contained" color="error" onClick={handleProcessReturn}>
            Confirm Return & Issue Refund
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
