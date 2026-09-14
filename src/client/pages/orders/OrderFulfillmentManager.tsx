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
} from '@mui/material';
import PageHeader from '../../components/PageHeader.tsx';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import StorefrontIcon from '@mui/icons-material/Storefront';
import { apiClient } from '../../api/client.ts';
import { toast } from 'react-hot-toast';
import { useRegionalSettings } from '../../hooks/useRegionalSettings.js';

export default function OrderFulfillmentManager() {
  const { formatAmount } = useRegionalSettings();
  const [orders, setOrders] = useState<any[]>([]);
  const [pickupCodeModalOpen, setPickupCodeModalOpen] = useState(false);
  const [pickupOrderNumber, setPickupOrderNumber] = useState<string>('');
  const [pickupCode, setPickupCode] = useState<string>('');

  const fetchFulfillmentOrders = async () => {
    try {
      const { data } = await apiClient.get('/orders', {
        params: { status: 'READY_FOR_FULFILLMENT' },
      });
      setOrders(data.data || []);
    } catch {
      toast.error('Failed to load fulfillment queue.');
    }
  };

  useEffect(() => {
    fetchFulfillmentOrders();
  }, []);

  const handleCreatePickingTask = async (orderNumber: string) => {
    try {
      await apiClient.post(`/orders/${orderNumber}/picking`, {
        pickerId: 'PICKER-01',
        pickerName: 'Bob Warehouse',
      });
      toast.success(`Picking task generated for Order #${orderNumber}`);
      fetchFulfillmentOrders();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to generate picking task.');
    }
  };

  const handleVerifyPickup = async () => {
    if (!pickupOrderNumber || !pickupCode) {
      toast.error('Enter Order Number and Pickup Code.');
      return;
    }
    try {
      await apiClient.post('/orders/fulfillment/pickup-verify', {
        orderNumber: pickupOrderNumber,
        verificationCode: pickupCode,
      });
      toast.success(`Store Pickup Verified & Delivered for Order #${pickupOrderNumber}!`);
      setPickupCodeModalOpen(false);
      setPickupOrderNumber('');
      setPickupCode('');
      fetchFulfillmentOrders();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Verification failed.');
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <PageHeader
        title="Warehouse Fulfillment & Store Pickup"
        subtitle="Order picking, packing tasks, and customer store pickup verification"
        action={
          <Button
            variant="contained"
            color="success"
            startIcon={<StorefrontIcon />}
            onClick={() => setPickupCodeModalOpen(true)}
          >
            Verify Customer Store Pickup
          </Button>
        }
      />

      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 2 }}>
          Fulfillment Queue (Ready for Pick & Pack)
        </Typography>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Order Number</TableCell>
              <TableCell>Channel</TableCell>
              <TableCell>Method</TableCell>
              <TableCell>Items Count</TableCell>
              <TableCell>Grand Total</TableCell>
              <TableCell>Fulfillment Status</TableCell>
              <TableCell align="right">Action</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {orders.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} align="center">
                  No orders currently waiting for fulfillment.
                </TableCell>
              </TableRow>
            ) : (
              orders.map((o) => (
                <TableRow key={o.orderNumber}>
                  <TableCell sx={{ fontWeight: 'bold' }}>{o.orderNumber}</TableCell>
                  <TableCell>{o.channel}</TableCell>
                  <TableCell>
                    <Chip label={o.fulfillmentMethod} size="small" color="info" />
                  </TableCell>
                  <TableCell>{o.items.length} items</TableCell>
                  <TableCell>{formatAmount(o.grandTotal)}</TableCell>
                  <TableCell>
                    <Chip label={o.fulfillmentStatus} color="warning" size="small" />
                  </TableCell>
                  <TableCell align="right">
                    <Button
                      size="small"
                      variant="contained"
                      startIcon={<LocalShippingIcon />}
                      onClick={() => handleCreatePickingTask(o.orderNumber)}
                    >
                      Generate Pick List
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Paper>

      {/* Store Pickup Verification Dialog */}
      <Dialog
        open={pickupCodeModalOpen}
        onClose={() => setPickupCodeModalOpen(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 'bold' }}>Verify Customer Store Pickup</DialogTitle>
        <DialogContent dividers>
          <TextField
            label="Order Number (e.g. STK-2026-000001)"
            fullWidth
            value={pickupOrderNumber}
            onChange={(e) => setPickupOrderNumber(e.target.value)}
            sx={{ mb: 2 }}
          />
          <TextField
            label="Verification Code / Customer Code"
            fullWidth
            value={pickupCode}
            onChange={(e) => setPickupCode(e.target.value)}
            placeholder="e.g., PICKUP-9921"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPickupCodeModalOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            color="success"
            startIcon={<CheckCircleIcon />}
            onClick={handleVerifyPickup}
          >
            Confirm & Release Order
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
