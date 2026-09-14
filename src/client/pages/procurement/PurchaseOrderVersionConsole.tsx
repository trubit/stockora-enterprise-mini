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
import HistoryIcon from '@mui/icons-material/History';
import { api } from '../../api/client.ts';
import { toast } from 'react-hot-toast';
import { useRegionalSettings } from '../../hooks/useRegionalSettings.js';

export default function PurchaseOrderVersionConsole() {
  const { formatAmount, currencySymbol } = useRegionalSettings();
  const [purchaseOrders, setPurchaseOrders] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [openModal, setOpenModal] = useState(false);
  const [openReviseModal, setOpenReviseModal] = useState(false);
  const [selectedPO, setSelectedPO] = useState<any>(null);

  const [formData, setFormData] = useState({
    supplierId: '',
    productId: '',
    quantity: 100,
    costPrice: 25,
    notes: 'Standard replenishment purchase order',
  });

  const [reviseForm, setReviseForm] = useState({
    reason: 'Price adjustment per vendor updated rate card',
    newQuantity: 120,
    newPrice: 24,
  });

  const fetchData = async () => {
    try {
      const [poRes, suppRes, prodRes] = await Promise.all([
        api.get('/procurement-advanced/purchase-orders'),
        api.get('/procurement-advanced/suppliers'),
        api.get('/products'),
      ]);
      setPurchaseOrders(poRes.data || []);
      setSuppliers(suppRes.data || []);
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
        toast.error('Supplier and Product are required.');
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
        notes: formData.notes,
      });
      toast.success('Purchase Order generated successfully!');
      setOpenModal(false);
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to generate PO.');
    }
  };

  const handleRevisePO = async () => {
    try {
      if (!selectedPO) return;
      await api.post(`/procurement-replenishment/purchase-orders/${selectedPO._id}/revise`, {
        reason: reviseForm.reason,
        updatedItems: [
          {
            productId: selectedPO.items[0]?.productId?._id || selectedPO.items[0]?.productId,
            quantity: Number(reviseForm.newQuantity),
            costPrice: Number(reviseForm.newPrice),
          },
        ],
      });
      toast.success(
        `Purchase Order ${selectedPO.poNumber} revised to Version v${(selectedPO.version || 1) + 1}!`
      );
      setOpenReviseModal(false);
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to revise Purchase Order.');
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
            <ShoppingCartIcon fontSize="large" /> Purchase Order Console & Version Control
          </Typography>
          <Typography variant="body2" sx={{ color: '#9ca3af', mt: 0.5 }}>
            Issue purchase orders, track version revision histories, monitor supplier
            acknowledgements & counter-proposals
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
                <TableCell sx={{ color: '#9ca3af', fontWeight: 600 }}>Version</TableCell>
                <TableCell sx={{ color: '#9ca3af', fontWeight: 600 }}>Supplier</TableCell>
                <TableCell sx={{ color: '#9ca3af', fontWeight: 600 }}>Total Amount</TableCell>
                <TableCell sx={{ color: '#9ca3af', fontWeight: 600 }}>Acknowledgement</TableCell>
                <TableCell sx={{ color: '#9ca3af', fontWeight: 600 }}>Status</TableCell>
                <TableCell align="right" sx={{ color: '#9ca3af', fontWeight: 600 }}>
                  Actions
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {purchaseOrders.map((po) => (
                <TableRow key={po._id} sx={{ '&:hover': { background: '#1e293b' } }}>
                  <TableCell sx={{ color: '#818cf8', fontWeight: 700 }}>{po.poNumber}</TableCell>
                  <TableCell>
                    <Chip
                      label={`v${po.version || 1}`}
                      size="small"
                      sx={{ background: '#374151', color: '#cbd5e1', fontWeight: 700 }}
                    />
                  </TableCell>
                  <TableCell sx={{ color: '#f8fafc', fontWeight: 600 }}>
                    {po.supplierId?.name || po.supplierName || 'Vendor'}
                  </TableCell>
                  <TableCell sx={{ color: '#34d399', fontWeight: 700 }}>
                    {formatAmount(po.totalAmount || 0)}
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={po.acknowledgementStatus || 'SENT'}
                      size="small"
                      sx={{
                        fontWeight: 600,
                        background:
                          po.acknowledgementStatus === 'ACKNOWLEDGED'
                            ? 'rgba(16, 185, 129, 0.2)'
                            : 'rgba(56, 189, 248, 0.2)',
                        color: po.acknowledgementStatus === 'ACKNOWLEDGED' ? '#34d399' : '#38bdf8',
                      }}
                    />
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={po.status}
                      size="small"
                      sx={{
                        fontWeight: 600,
                        background: 'rgba(139, 92, 246, 0.2)',
                        color: '#c4b5fd',
                      }}
                    />
                  </TableCell>
                  <TableCell align="right">
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<HistoryIcon />}
                      onClick={() => {
                        setSelectedPO(po);
                        setOpenReviseModal(true);
                      }}
                      sx={{ color: '#8b5cf6', borderColor: '#8b5cf6' }}
                    >
                      Revise Version
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* PO Modal */}
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
          Issue Purchase Order
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
            <Grid item xs={6}>
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
            <Grid item xs={6}>
              <TextField
                fullWidth
                type="number"
                label={`Unit Cost Price (${currencySymbol})`}
                value={formData.costPrice}
                onChange={(e) => setFormData({ ...formData, costPrice: Number(e.target.value) })}
                InputLabelProps={{ shrink: true, style: { color: '#9ca3af' } }}
                InputProps={{ style: { color: '#fff' } }}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Order Terms / Notes"
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
            onClick={handleCreatePO}
            sx={{ background: '#8b5cf6', color: '#fff' }}
          >
            Issue Order
          </Button>
        </DialogActions>
      </Dialog>

      {/* Revise Modal */}
      <Dialog
        open={openReviseModal}
        onClose={() => setOpenReviseModal(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: { background: '#111827', color: '#f8fafc', border: '1px solid #1f2937' },
        }}
      >
        <DialogTitle sx={{ fontWeight: 700, borderBottom: '1px solid #1f2937' }}>
          Revise Purchase Order ({selectedPO?.poNumber} - Current v{selectedPO?.version || 1})
        </DialogTitle>
        <DialogContent sx={{ mt: 2 }}>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Revision Reason"
                value={reviseForm.reason}
                onChange={(e) => setReviseForm({ ...reviseForm, reason: e.target.value })}
                InputLabelProps={{ shrink: true, style: { color: '#9ca3af' } }}
                InputProps={{ style: { color: '#fff' } }}
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                type="number"
                label="Revised Quantity"
                value={reviseForm.newQuantity}
                onChange={(e) =>
                  setReviseForm({ ...reviseForm, newQuantity: Number(e.target.value) })
                }
                InputLabelProps={{ shrink: true, style: { color: '#9ca3af' } }}
                InputProps={{ style: { color: '#fff' } }}
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                type="number"
                label={`Revised Unit Price (${currencySymbol})`}
                value={reviseForm.newPrice}
                onChange={(e) => setReviseForm({ ...reviseForm, newPrice: Number(e.target.value) })}
                InputLabelProps={{ shrink: true, style: { color: '#9ca3af' } }}
                InputProps={{ style: { color: '#fff' } }}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ p: 2.5, borderTop: '1px solid #1f2937' }}>
          <Button onClick={() => setOpenReviseModal(false)} sx={{ color: '#9ca3af' }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleRevisePO}
            sx={{ background: '#8b5cf6', color: '#fff' }}
          >
            Submit Revision v{(selectedPO?.version || 1) + 1}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
