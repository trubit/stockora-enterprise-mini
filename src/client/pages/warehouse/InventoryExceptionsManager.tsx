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
  Alert,
} from '@mui/material';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import HandymanIcon from '@mui/icons-material/Handyman';
import { api } from '../../api/client.ts';
import { toast } from 'react-hot-toast';

export default function InventoryExceptionsManager() {
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [openModal, setOpenModal] = useState(false);
  const [dispositions] = useState<any[]>([
    {
      _id: 'disp-001',
      productName: 'Industrial Bolt Pack',
      warehouseName: 'Main Fulfillment Center',
      quantity: 15,
      disposition: 'QUARANTINE',
      reason: 'Damaged packaging during transit',
      createdAt: new Date().toISOString(),
    },
  ]);
  const [formData, setFormData] = useState({
    warehouseId: '',
    productId: '',
    quantity: 10,
    disposition: 'QUARANTINE',
    reason: 'Defective batch isolation',
  });

  const fetchData = async () => {
    try {
      const [whRes, prodRes] = await Promise.all([
        api.get('/warehouse-advanced/warehouses'),
        api.get('/products'),
      ]);
      setWarehouses(whRes.data || []);
      setProducts(prodRes.data?.data || prodRes.data || []);
    } catch {
      toast.error('Failed to load inventory exceptions.');
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleProcessDisposition = async () => {
    try {
      if (!formData.warehouseId || !formData.productId) {
        toast.error('Please select warehouse and product.');
        return;
      }
      await api.post('/warehouse-advanced/dispositions', {
        warehouseId: formData.warehouseId,
        productId: formData.productId,
        quantity: Number(formData.quantity),
        disposition: formData.disposition,
        reason: formData.reason,
      });
      toast.success(`Inventory disposition (${formData.disposition}) processed!`);
      setOpenModal(false);
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to process inventory disposition.');
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
            <WarningAmberIcon fontSize="large" /> Damaged & Quarantine Stock Dispositions
          </Typography>
          <Typography variant="body2" sx={{ color: '#9ca3af', mt: 0.5 }}>
            Isolate damaged or quarantined inventory, execute disposition workflows (Restock,
            Quarantine, Dispose, Return to Supplier)
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<HandymanIcon />}
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
          Process Stock Disposition
        </Button>
      </Box>

      <Alert
        severity="warning"
        sx={{ mb: 3, background: '#1e293b', color: '#f59e0b', border: '1px solid #334155' }}
      >
        Quarantined and damaged stock are automatically excluded from sellable inventory balances
        across POS and e-Commerce channels.
      </Alert>

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
                <TableCell sx={{ color: '#9ca3af', fontWeight: 600 }}>Product</TableCell>
                <TableCell sx={{ color: '#9ca3af', fontWeight: 600 }}>Facility</TableCell>
                <TableCell sx={{ color: '#9ca3af', fontWeight: 600 }}>Quantity</TableCell>
                <TableCell sx={{ color: '#9ca3af', fontWeight: 600 }}>Disposition Action</TableCell>
                <TableCell sx={{ color: '#9ca3af', fontWeight: 600 }}>Reason</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {dispositions.map((d) => (
                <TableRow key={d._id} sx={{ '&:hover': { background: '#1e293b' } }}>
                  <TableCell sx={{ color: '#f8fafc', fontWeight: 600 }}>{d.productName}</TableCell>
                  <TableCell sx={{ color: '#9ca3af' }}>{d.warehouseName}</TableCell>
                  <TableCell sx={{ color: '#fbbf24', fontWeight: 700 }}>
                    {d.quantity} units
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={d.disposition}
                      size="small"
                      sx={{
                        fontWeight: 600,
                        background:
                          d.disposition === 'RESTOCK'
                            ? 'rgba(16, 185, 129, 0.2)'
                            : 'rgba(239, 68, 68, 0.2)',
                        color: d.disposition === 'RESTOCK' ? '#34d399' : '#f87171',
                      }}
                    />
                  </TableCell>
                  <TableCell sx={{ color: '#cbd5e1' }}>{d.reason}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* Disposition Dialog */}
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
          Process Inventory Disposition
        </DialogTitle>
        <DialogContent sx={{ mt: 2 }}>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <TextField
                select
                fullWidth
                label="Target Warehouse"
                value={formData.warehouseId}
                onChange={(e) => setFormData({ ...formData, warehouseId: e.target.value })}
                SelectProps={{ native: true }}
                InputLabelProps={{ shrink: true, style: { color: '#9ca3af' } }}
                InputProps={{ style: { color: '#fff' } }}
              >
                <option value="" style={{ background: '#111827' }}>
                  -- Select Warehouse --
                </option>
                {warehouses.map((w) => (
                  <option key={w._id} value={w._id} style={{ background: '#111827' }}>
                    {w.name} ({w.code})
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
                select
                fullWidth
                label="Disposition Action"
                value={formData.disposition}
                onChange={(e) => setFormData({ ...formData, disposition: e.target.value as any })}
                SelectProps={{ native: true }}
                InputLabelProps={{ shrink: true, style: { color: '#9ca3af' } }}
                InputProps={{ style: { color: '#fff' } }}
              >
                <option value="QUARANTINE" style={{ background: '#111827' }}>
                  QUARANTINE - Isolate Stock
                </option>
                <option value="DAMAGED" style={{ background: '#111827' }}>
                  DAMAGED - Mark Damaged
                </option>
                <option value="RESTOCK" style={{ background: '#111827' }}>
                  RESTOCK - Return to Sellable
                </option>
                <option value="DISPOSE" style={{ background: '#111827' }}>
                  DISPOSE - Write Off
                </option>
                <option value="RETURN_TO_SUPPLIER" style={{ background: '#111827' }}>
                  RETURN TO SUPPLIER
                </option>
              </TextField>
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Disposition Reason"
                value={formData.reason}
                onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
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
            onClick={handleProcessDisposition}
            sx={{ background: '#8b5cf6', color: '#fff' }}
          >
            Confirm Disposition
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
