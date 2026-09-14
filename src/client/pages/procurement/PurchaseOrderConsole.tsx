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
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { api } from '../../api/client.ts';
import { toast } from 'react-hot-toast';
import { useRegionalSettings } from '../../hooks/useRegionalSettings.js';

export default function PurchaseOrderConsole() {
  const { formatAmount, currencySymbol } = useRegionalSettings();
  const [orders, setOrders] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [openModal, setOpenModal] = useState(false);
  const [formData, setFormData] = useState({
    supplierId: '',
    productId: '',
    quantity: 50,
    costPrice: 20,
    shippingCost: 15,
    paymentTerms: 'NET 30',
  });

  const fetchData = async () => {
    try {
      const [poRes, supRes, prodRes] = await Promise.all([
        api.get('/procurement-advanced/purchase-orders'),
        api.get('/procurement-advanced/suppliers'),
        api.get('/products'),
      ]);
      setOrders(poRes.data || []);
      setSuppliers(supRes.data || []);
      setProducts(prodRes.data?.data || prodRes.data || []);
    } catch {
      toast.error('Failed to load purchase orders.');
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreatePO = async () => {
    try {
      if (!formData.supplierId || !formData.productId) {
        toast.error('Please select both supplier and product.');
        return;
      }
      await api.post('/procurement-advanced/purchase-orders', {
        supplierId: formData.supplierId,
        items: [
          {
            productId: formData.productId,
            quantity: Number(formData.quantity),
            costPrice: Number(formData.costPrice),
          },
        ],
        shippingCost: Number(formData.shippingCost),
        paymentTerms: formData.paymentTerms,
      });
      toast.success('Purchase Order issued successfully!');
      setOpenModal(false);
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to create Purchase Order.');
    }
  };

  const handleConfirmPO = async (id: string) => {
    try {
      await api.post(`/procurement-advanced/purchase-orders/${id}/confirm`, {
        status: 'CONFIRMED',
        notes: 'Supplier acknowledged order',
      });
      toast.success('Supplier confirmation recorded!');
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to record supplier confirmation.');
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
            <ShoppingCartIcon fontSize="large" /> Purchase Order Workspace
          </Typography>
          <Typography variant="body2" sx={{ color: '#9ca3af', mt: 0.5 }}>
            Issue purchase orders, track supplier acknowledgments, and maintain version revision
            histories
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
          Create Purchase Order
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
                <TableCell sx={{ color: '#9ca3af', fontWeight: 600 }}>PO #</TableCell>
                <TableCell sx={{ color: '#9ca3af', fontWeight: 600 }}>Supplier</TableCell>
                <TableCell sx={{ color: '#9ca3af', fontWeight: 600 }}>Revision</TableCell>
                <TableCell sx={{ color: '#9ca3af', fontWeight: 600 }}>Delivery Date</TableCell>
                <TableCell sx={{ color: '#9ca3af', fontWeight: 600 }}>Total Amount</TableCell>
                <TableCell sx={{ color: '#9ca3af', fontWeight: 600 }}>Status</TableCell>
                <TableCell align="right" sx={{ color: '#9ca3af', fontWeight: 600 }}>
                  Actions
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {orders.map((po) => (
                <TableRow key={po._id} sx={{ '&:hover': { background: '#1e293b' } }}>
                  <TableCell sx={{ color: '#818cf8', fontWeight: 700 }}>{po.poNumber}</TableCell>
                  <TableCell sx={{ color: '#f8fafc' }}>{po.supplierName || 'Supplier'}</TableCell>
                  <TableCell>
                    <Chip
                      label={`v${po.version || 1}`}
                      size="small"
                      sx={{ background: '#374151', color: '#cbd5e1', fontWeight: 600 }}
                    />
                  </TableCell>
                  <TableCell sx={{ color: '#9ca3af' }}>
                    {po.expectedDeliveryDate
                      ? new Date(po.expectedDeliveryDate).toLocaleDateString()
                      : 'N/A'}
                  </TableCell>
                  <TableCell sx={{ color: '#34d399', fontWeight: 700 }}>
                    {formatAmount(po.totalAmount || 0)}
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={po.status}
                      size="small"
                      sx={{
                        fontWeight: 600,
                        background:
                          po.status === 'RECEIVED'
                            ? 'rgba(16, 185, 129, 0.2)'
                            : 'rgba(56, 189, 248, 0.2)',
                        color: po.status === 'RECEIVED' ? '#34d399' : '#38bdf8',
                      }}
                    />
                  </TableCell>
                  <TableCell align="right">
                    {po.status === 'APPROVED' && (
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={<CheckCircleIcon />}
                        onClick={() => handleConfirmPO(po._id)}
                        sx={{ color: '#38bdf8', borderColor: '#38bdf8' }}
                      >
                        Confirm Receipt
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* Create PO Dialog */}
      <Dialog
        open={openModal}
        onClose={() => setOpenModal(false)}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: { background: '#111827', color: '#f8fafc', border: '1px solid #1f2937' },
        }}
      >
        <DialogTitle sx={{ fontWeight: 700, borderBottom: '1px solid #1f2937' }}>
          Issue New Purchase Order
        </DialogTitle>
        <DialogContent sx={{ mt: 2 }}>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <TextField
                select
                fullWidth
                label="Target Supplier"
                value={formData.supplierId}
                onChange={(e) => setFormData({ ...formData, supplierId: e.target.value })}
                SelectProps={{ native: true }}
                InputLabelProps={{ shrink: true, style: { color: '#9ca3af' } }}
                InputProps={{ style: { color: '#fff' } }}
              >
                <option value="" style={{ background: '#111827' }}>
                  -- Select Supplier --
                </option>
                {suppliers.map((s) => (
                  <option key={s._id} value={s._id} style={{ background: '#111827' }}>
                    {s.name} ({s.code})
                  </option>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6}>
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
            <Grid item xs={12} sm={4}>
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
            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                type="number"
                label={`Unit Cost (${currencySymbol})`}
                value={formData.costPrice}
                onChange={(e) => setFormData({ ...formData, costPrice: Number(e.target.value) })}
                InputLabelProps={{ shrink: true, style: { color: '#9ca3af' } }}
                InputProps={{ style: { color: '#fff' } }}
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                type="number"
                label={`Shipping Cost (${currencySymbol})`}
                value={formData.shippingCost}
                onChange={(e) => setFormData({ ...formData, shippingCost: Number(e.target.value) })}
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
            onClick={handleCreatePO}
            sx={{ background: '#8b5cf6', color: '#fff' }}
          >
            Issue Purchase Order
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
