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
import CompareArrowsIcon from '@mui/icons-material/CompareArrows';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { api } from '../../api/client.ts';
import { toast } from 'react-hot-toast';

export default function StockTransferConsole() {
  const [transfers, setTransfers] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [openModal, setOpenModal] = useState(false);
  const [formData, setFormData] = useState({
    fromWarehouseId: '',
    toWarehouseId: '',
    productId: '',
    quantity: 20,
    notes: 'Inter-warehouse stock rebalancing',
  });

  const fetchData = async () => {
    try {
      const [trfRes, whRes, prodRes] = await Promise.all([
        api.get('/warehouse-advanced/transfers'),
        api.get('/warehouse-advanced/warehouses'),
        api.get('/products'),
      ]);
      setTransfers(trfRes.data || []);
      setWarehouses(whRes.data || []);
      setProducts(prodRes.data?.data || prodRes.data || []);
    } catch {
      toast.error('Failed to load stock transfers.');
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreateTransfer = async () => {
    try {
      if (!formData.fromWarehouseId || !formData.toWarehouseId || !formData.productId) {
        toast.error('Please select source warehouse, destination warehouse, and product.');
        return;
      }
      if (formData.fromWarehouseId === formData.toWarehouseId) {
        toast.error('Source and destination warehouses must be different.');
        return;
      }

      await api.post('/warehouse-advanced/transfers', {
        fromWarehouseId: formData.fromWarehouseId,
        toWarehouseId: formData.toWarehouseId,
        items: [
          {
            productId: formData.productId,
            quantity: Number(formData.quantity),
          },
        ],
        notes: formData.notes,
      });
      toast.success('Stock transfer request submitted!');
      setOpenModal(false);
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to request stock transfer.');
    }
  };

  const handleApprove = async (id: string) => {
    try {
      await api.post(`/warehouse-advanced/transfers/${id}/approve`);
      toast.success('Transfer approved for picking!');
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to approve transfer.');
    }
  };

  const handleDispatch = async (id: string) => {
    try {
      await api.post(`/warehouse-advanced/transfers/${id}/dispatch`);
      toast.success('Transfer dispatched in-transit!');
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to dispatch transfer.');
    }
  };

  const handleReceive = async (trf: any) => {
    try {
      await api.post(`/warehouse-advanced/transfers/${trf._id}/receive`, {
        receivedItems: trf.items.map((i: any) => ({
          productId: i.productId,
          quantityReceived: i.quantity,
        })),
      });
      toast.success('Transfer stock received at destination warehouse!');
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to receive transfer.');
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
            <CompareArrowsIcon fontSize="large" /> Inter-Warehouse Stock Transfer Console
          </Typography>
          <Typography variant="body2" sx={{ color: '#9ca3af', mt: 0.5 }}>
            Request, approve, pick, dispatch & receive inventory transfers with in-transit status
            reservations
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
          New Transfer Request
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
                <TableCell sx={{ color: '#9ca3af', fontWeight: 600 }}>Transfer #</TableCell>
                <TableCell sx={{ color: '#9ca3af', fontWeight: 600 }}>From Warehouse</TableCell>
                <TableCell sx={{ color: '#9ca3af', fontWeight: 600 }}>To Warehouse</TableCell>
                <TableCell sx={{ color: '#9ca3af', fontWeight: 600 }}>Total Items</TableCell>
                <TableCell sx={{ color: '#9ca3af', fontWeight: 600 }}>Status</TableCell>
                <TableCell align="right" sx={{ color: '#9ca3af', fontWeight: 600 }}>
                  Actions
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {transfers.map((trf) => (
                <TableRow key={trf._id} sx={{ '&:hover': { background: '#1e293b' } }}>
                  <TableCell sx={{ color: '#818cf8', fontWeight: 700 }}>
                    {trf.transferNumber}
                  </TableCell>
                  <TableCell sx={{ color: '#f8fafc' }}>
                    {trf.fromWarehouseId?.name || 'Source Hub'}
                  </TableCell>
                  <TableCell sx={{ color: '#f8fafc' }}>
                    {trf.toWarehouseId?.name || 'Dest Hub'}
                  </TableCell>
                  <TableCell sx={{ color: '#cbd5e1' }}>{trf.items?.length || 0} items</TableCell>
                  <TableCell>
                    <Chip
                      label={trf.status}
                      size="small"
                      sx={{
                        fontWeight: 600,
                        background:
                          trf.status === 'RECEIVED'
                            ? 'rgba(16, 185, 129, 0.2)'
                            : 'rgba(56, 189, 248, 0.2)',
                        color: trf.status === 'RECEIVED' ? '#34d399' : '#38bdf8',
                      }}
                    />
                  </TableCell>
                  <TableCell align="right">
                    {trf.status === 'REQUESTED' && (
                      <Button
                        size="small"
                        variant="contained"
                        onClick={() => handleApprove(trf._id)}
                        sx={{ background: '#8b5cf6', color: '#fff', mr: 1 }}
                      >
                        Approve
                      </Button>
                    )}
                    {trf.status === 'APPROVED' && (
                      <Button
                        size="small"
                        variant="contained"
                        startIcon={<LocalShippingIcon />}
                        onClick={() => handleDispatch(trf._id)}
                        sx={{ background: '#3b82f6', color: '#fff', mr: 1 }}
                      >
                        Dispatch In-Transit
                      </Button>
                    )}
                    {trf.status === 'IN_TRANSIT' && (
                      <Button
                        size="small"
                        variant="contained"
                        startIcon={<CheckCircleIcon />}
                        onClick={() => handleReceive(trf)}
                        sx={{ background: '#10b981', color: '#fff' }}
                      >
                        Receive Stock
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* Transfer Modal */}
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
          New Stock Transfer Request
        </DialogTitle>
        <DialogContent sx={{ mt: 2 }}>
          <Grid container spacing={2}>
            <Grid item xs={6}>
              <TextField
                select
                fullWidth
                label="Source Warehouse"
                value={formData.fromWarehouseId}
                onChange={(e) => setFormData({ ...formData, fromWarehouseId: e.target.value })}
                SelectProps={{ native: true }}
                InputLabelProps={{ shrink: true, style: { color: '#9ca3af' } }}
                InputProps={{ style: { color: '#fff' } }}
              >
                <option value="" style={{ background: '#111827' }}>
                  -- Select Source --
                </option>
                {warehouses.map((w) => (
                  <option key={w._id} value={w._id} style={{ background: '#111827' }}>
                    {w.name} ({w.code})
                  </option>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={6}>
              <TextField
                select
                fullWidth
                label="Destination Warehouse"
                value={formData.toWarehouseId}
                onChange={(e) => setFormData({ ...formData, toWarehouseId: e.target.value })}
                SelectProps={{ native: true }}
                InputLabelProps={{ shrink: true, style: { color: '#9ca3af' } }}
                InputProps={{ style: { color: '#fff' } }}
              >
                <option value="" style={{ background: '#111827' }}>
                  -- Select Destination --
                </option>
                {warehouses.map((w) => (
                  <option key={w._id} value={w._id} style={{ background: '#111827' }}>
                    {w.name} ({w.code})
                  </option>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={8}>
              <TextField
                select
                fullWidth
                label="Target Product"
                value={formData.productId}
                onChange={(e) => setFormData({ ...formData, productId: e.target.value })}
                SelectProps={{ native: true }}
                InputLabelProps={{ shrink: true, style: { color: '#9ca3af' } }}
                InputProps={{ style: { color: '#fff' } }}
              >
                <option value="" style={{ background: '#111827' }}>
                  -- Select Product --
                </option>
                {products.map((p) => (
                  <option key={p._id} value={p._id} style={{ background: '#111827' }}>
                    {p.name} ({p.sku})
                  </option>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={4}>
              <TextField
                fullWidth
                type="number"
                label="Quantity"
                value={formData.quantity}
                onChange={(e) => setFormData({ ...formData, quantity: Number(e.target.value) })}
                InputLabelProps={{ shrink: true, style: { color: '#9ca3af' } }}
                InputProps={{ style: { color: '#fff' } }}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Transfer Reason"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                InputLabelProps={{ shrink: true, style: { color: '#9ca3af' } }}
                InputProps={{ style: { color: '#fff' } }}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ p: 2.5, borderTop: '1px solid #1f2937' }}>
          <Button onClick={() => setOpenModal(false)} sx={{ color: '#9ca3af' }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleCreateTransfer}
            sx={{ background: '#8b5cf6', color: '#fff' }}
          >
            Submit Transfer Request
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
