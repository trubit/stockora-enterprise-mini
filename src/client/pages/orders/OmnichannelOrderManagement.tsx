import { useState, useEffect, useTransition } from 'react';
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
  Divider,
  MenuItem,
  TextField,
  CircularProgress,
} from '@mui/material';
import PageHeader from '../../components/PageHeader.tsx';
import StatusChip from '../../components/StatusChip.tsx';
import TimelineIcon from '@mui/icons-material/Timeline';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { apiClient } from '../../api/client.ts';
import { toast } from 'react-hot-toast';
import { useRegionalSettings } from '../../hooks/useRegionalSettings.js';

export default function OmnichannelOrderManagement() {
  const { formatAmount } = useRegionalSettings();
  const [isPending, startTransition] = useTransition();
  const [orders, setOrders] = useState<any[]>([]);
  const [channelFilter, setChannelFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');

  // Timeline / Details Drawer State
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  const [timelineModalOpen, setTimelineModalOpen] = useState(false);

  const fetchOrders = () => {
    startTransition(async () => {
      try {
        const { data } = await apiClient.get('/orders', {
          params: { channel: channelFilter, status: statusFilter },
        });
        setOrders(data.data || []);
      } catch {
        toast.error('Failed to load orders.');
      }
    });
  };

  useEffect(() => {
    fetchOrders();
  }, [channelFilter, statusFilter]);

  const handleUpdateStatus = async (orderNumber: string, nextStatus: string) => {
    try {
      await apiClient.patch(`/orders/${orderNumber}/status`, { status: nextStatus });
      toast.success(`Order #${orderNumber} updated to ${nextStatus}`);
      fetchOrders();
      if (selectedOrder && selectedOrder.orderNumber === orderNumber) {
        setSelectedOrder({ ...selectedOrder, status: nextStatus });
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to update order status.');
    }
  };

  const getChannelColor = (channel: string) => {
    switch (channel) {
      case 'POS':
        return 'primary';
      case 'WEBSITE':
        return 'success';
      case 'MOBILE':
        return 'info';
      case 'MARKETPLACE':
        return 'warning';
      default:
        return 'default';
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <PageHeader
        title="Omnichannel Order Management"
        subtitle="Centralized order processing across POS, E-Commerce, Mobile, and Marketplaces"
        action={
          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField
              select
              size="small"
              label="Channel"
              value={channelFilter}
              onChange={(e) => setChannelFilter(e.target.value)}
              sx={{ minWidth: 140 }}
            >
              <MenuItem value="">All Channels</MenuItem>
              <MenuItem value="POS">POS</MenuItem>
              <MenuItem value="WEBSITE">Website</MenuItem>
              <MenuItem value="MOBILE">Mobile</MenuItem>
              <MenuItem value="MARKETPLACE">Marketplace</MenuItem>
            </TextField>
            <TextField
              select
              size="small"
              label="Status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              sx={{ minWidth: 160 }}
            >
              <MenuItem value="">All Statuses</MenuItem>
              <MenuItem value="PENDING_PAYMENT">Pending Payment</MenuItem>
              <MenuItem value="PAID">Paid</MenuItem>
              <MenuItem value="PROCESSING">Processing</MenuItem>
              <MenuItem value="READY_FOR_FULFILLMENT">Ready for Fulfillment</MenuItem>
              <MenuItem value="FULFILLED">Fulfilled</MenuItem>
              <MenuItem value="COMPLETED">Completed</MenuItem>
            </TextField>
          </Box>
        }
      />

      <Paper sx={{ p: 2 }}>
        {isPending ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
            <CircularProgress />
          </Box>
        ) : (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Order Number</TableCell>
                <TableCell>Channel</TableCell>
                <TableCell>Customer</TableCell>
                <TableCell>Items</TableCell>
                <TableCell>Grand Total</TableCell>
                <TableCell>Payment</TableCell>
                <TableCell>Risk</TableCell>
                <TableCell>Order Status</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {orders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} align="center">
                    No orders found.
                  </TableCell>
                </TableRow>
              ) : (
                orders.map((o) => (
                  <TableRow key={o.orderNumber} hover>
                    <TableCell sx={{ fontWeight: 'bold' }}>{o.orderNumber}</TableCell>
                    <TableCell>
                      <Chip
                        label={o.channel}
                        color={getChannelColor(o.channel) as any}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>{o.customerName || 'Walk-in'}</TableCell>
                    <TableCell>{o.items.length} item(s)</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>{formatAmount(o.grandTotal)}</TableCell>
                    <TableCell>
                      <StatusChip status={o.paymentStatus} />
                    </TableCell>
                    <TableCell>
                      {o.riskLevel === 'HIGH_RISK' ? (
                        <Chip
                          icon={<WarningAmberIcon />}
                          label="HIGH RISK"
                          color="error"
                          size="small"
                        />
                      ) : o.riskLevel === 'REVIEW' ? (
                        <Chip label="REVIEW" color="warning" size="small" />
                      ) : (
                        <Chip label="NORMAL" color="success" size="small" variant="outlined" />
                      )}
                    </TableCell>
                    <TableCell>
                      <StatusChip status={o.status} />
                    </TableCell>
                    <TableCell align="right">
                      <Button
                        size="small"
                        startIcon={<TimelineIcon />}
                        onClick={() => {
                          setSelectedOrder(o);
                          setTimelineModalOpen(true);
                        }}
                      >
                        Details
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        )}
      </Paper>

      {/* Order Details & Status Transition Dialog */}
      {selectedOrder && (
        <Dialog
          open={timelineModalOpen}
          onClose={() => setTimelineModalOpen(false)}
          maxWidth="md"
          fullWidth
        >
          <DialogTitle sx={{ fontWeight: 'bold' }}>
            Order #{selectedOrder.orderNumber} Details & Life Cycle Timeline
          </DialogTitle>
          <DialogContent dividers>
            <Box sx={{ mb: 2, display: 'flex', gap: 2, alignItems: 'center' }}>
              <Chip label={`Channel: ${selectedOrder.channel}`} color="primary" />
              <StatusChip status={selectedOrder.status} />
              <Chip label={`Fulfillment: ${selectedOrder.fulfillmentMethod}`} variant="outlined" />
            </Box>

            <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 1 }}>
              Purchased Line Items
            </Typography>
            <Table size="small" sx={{ mb: 3 }}>
              <TableHead>
                <TableRow>
                  <TableCell>SKU</TableCell>
                  <TableCell>Item Name</TableCell>
                  <TableCell>Unit Price</TableCell>
                  <TableCell>Quantity</TableCell>
                  <TableCell align="right">Total</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {selectedOrder.items.map((i: any, idx: number) => (
                  <TableRow key={idx}>
                    <TableCell>{i.sku}</TableCell>
                    <TableCell>{i.name}</TableCell>
                    <TableCell>{formatAmount(i.unitPrice)}</TableCell>
                    <TableCell>{i.quantity}</TableCell>
                    <TableCell align="right">{formatAmount(i.total)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <Divider sx={{ my: 2 }} />

            <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 1 }}>
              Order Lifecycle State Machine Transition
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', my: 1 }}>
              {selectedOrder.status === 'PENDING_PAYMENT' && (
                <Button
                  variant="contained"
                  color="success"
                  onClick={() => handleUpdateStatus(selectedOrder.orderNumber, 'PAID')}
                >
                  Mark as Paid
                </Button>
              )}
              {selectedOrder.status === 'PAID' && (
                <Button
                  variant="contained"
                  color="info"
                  onClick={() => handleUpdateStatus(selectedOrder.orderNumber, 'PROCESSING')}
                >
                  Start Processing
                </Button>
              )}
              {selectedOrder.status === 'PROCESSING' && (
                <Button
                  variant="contained"
                  color="warning"
                  startIcon={<LocalShippingIcon />}
                  onClick={() =>
                    handleUpdateStatus(selectedOrder.orderNumber, 'READY_FOR_FULFILLMENT')
                  }
                >
                  Ready for Fulfillment
                </Button>
              )}
              {selectedOrder.status === 'READY_FOR_FULFILLMENT' && (
                <Button
                  variant="contained"
                  color="success"
                  onClick={() => handleUpdateStatus(selectedOrder.orderNumber, 'FULFILLED')}
                >
                  Mark as Fulfilled
                </Button>
              )}
              {['PENDING_PAYMENT', 'PAID', 'PROCESSING'].includes(selectedOrder.status) && (
                <Button
                  variant="outlined"
                  color="error"
                  onClick={() => handleUpdateStatus(selectedOrder.orderNumber, 'CANCELLED')}
                >
                  Cancel Order
                </Button>
              )}
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setTimelineModalOpen(false)}>Close</Button>
          </DialogActions>
        </Dialog>
      )}
    </Box>
  );
}
