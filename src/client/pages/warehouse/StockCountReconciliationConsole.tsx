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
import AddIcon from '@mui/icons-material/Add';
import CalculateIcon from '@mui/icons-material/Calculate';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { api } from '../../api/client.ts';
import { toast } from 'react-hot-toast';

export default function StockCountReconciliationConsole() {
  const [counts, setCounts] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [openModal, setOpenModal] = useState(false);
  const [formData, setFormData] = useState({
    warehouseId: '',
    countType: 'CYCLE',
    productId: '',
    notes: 'Scheduled monthly cycle count',
  });

  const fetchData = async () => {
    try {
      const [cntRes, whRes, prodRes] = await Promise.all([
        api.get('/warehouse-advanced/counts'),
        api.get('/warehouse-advanced/warehouses'),
        api.get('/products'),
      ]);
      setCounts(cntRes.data || []);
      setWarehouses(whRes.data || []);
      setProducts(prodRes.data?.data || prodRes.data || []);
    } catch {
      toast.error('Failed to load stock count records.');
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreateCount = async () => {
    try {
      if (!formData.warehouseId || !formData.productId) {
        toast.error('Please select warehouse and target product.');
        return;
      }
      await api.post('/warehouse-advanced/counts', {
        warehouseId: formData.warehouseId,
        countType: formData.countType,
        items: [{ productId: formData.productId }],
        notes: formData.notes,
      });
      toast.success('Stock count order created!');
      setOpenModal(false);
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to initiate stock count.');
    }
  };

  const handleReconcile = async (id: string) => {
    try {
      await api.post(`/warehouse-advanced/counts/${id}/reconcile`);
      toast.success('Stock count variance reconciled & ledger updated!');
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to approve count reconciliation.');
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
            <CalculateIcon fontSize="large" /> Stock Counting & Reconciliation Console
          </Typography>
          <Typography variant="body2" sx={{ color: '#9ca3af', mt: 0.5 }}>
            Execute Full, Cycle & Blind physical stock counts, analyze system vs count variances &
            approve ledger reconciliations
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
          New Stock Count
        </Button>
      </Box>

      <Alert
        severity="info"
        sx={{ mb: 3, background: '#1e293b', color: '#38bdf8', border: '1px solid #334155' }}
      >
        Blind counting mode hides expected system quantities from stock counters to eliminate
        confirmation bias.
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
                <TableCell sx={{ color: '#9ca3af', fontWeight: 600 }}>Count #</TableCell>
                <TableCell sx={{ color: '#9ca3af', fontWeight: 600 }}>Count Type</TableCell>
                <TableCell sx={{ color: '#9ca3af', fontWeight: 600 }}>Items Counted</TableCell>
                <TableCell sx={{ color: '#9ca3af', fontWeight: 600 }}>Status</TableCell>
                <TableCell align="right" sx={{ color: '#9ca3af', fontWeight: 600 }}>
                  Actions
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {counts.map((cnt) => (
                <TableRow key={cnt._id} sx={{ '&:hover': { background: '#1e293b' } }}>
                  <TableCell sx={{ color: '#818cf8', fontWeight: 700 }}>
                    {cnt.countNumber}
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={cnt.countType || 'CYCLE'}
                      size="small"
                      sx={{ background: '#374151', color: '#cbd5e1', fontWeight: 600 }}
                    />
                  </TableCell>
                  <TableCell sx={{ color: '#cbd5e1' }}>{cnt.items?.length || 0} Products</TableCell>
                  <TableCell>
                    <Chip
                      label={cnt.status}
                      size="small"
                      sx={{
                        fontWeight: 600,
                        background:
                          cnt.status === 'COMPLETED'
                            ? 'rgba(16, 185, 129, 0.2)'
                            : 'rgba(245, 158, 11, 0.2)',
                        color: cnt.status === 'COMPLETED' ? '#34d399' : '#fbbf24',
                      }}
                    />
                  </TableCell>
                  <TableCell align="right">
                    {cnt.status !== 'COMPLETED' && (
                      <Button
                        size="small"
                        variant="contained"
                        startIcon={<CheckCircleIcon />}
                        onClick={() => handleReconcile(cnt._id)}
                        sx={{ background: '#10b981', color: '#fff' }}
                      >
                        Approve Reconciliation
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* Stock Count Dialog */}
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
          Initiate Physical Stock Count
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
                label="Count Strategy"
                value={formData.countType}
                onChange={(e) => setFormData({ ...formData, countType: e.target.value })}
                SelectProps={{ native: true }}
                InputLabelProps={{ shrink: true, style: { color: '#9ca3af' } }}
                InputProps={{ style: { color: '#fff' } }}
              >
                <option value="CYCLE" style={{ background: '#111827' }}>
                  CYCLE COUNT - Scheduled Rotation
                </option>
                <option value="FULL" style={{ background: '#111827' }}>
                  FULL COUNT - Facility Wall-to-Wall
                </option>
                <option value="BLIND" style={{ background: '#111827' }}>
                  BLIND COUNT - Hidden System Quantities
                </option>
                <option value="LOCATION" style={{ background: '#111827' }}>
                  LOCATION COUNT - Specific Zone/Rack
                </option>
              </TextField>
            </Grid>
            <Grid item xs={12}>
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
                  -- Select Product to Count --
                </option>
                {products.map((p) => (
                  <option key={p._id} value={p._id} style={{ background: '#111827' }}>
                    {p.name} ({p.sku})
                  </option>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Count Notes"
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
            onClick={handleCreateCount}
            sx={{ background: '#8b5cf6', color: '#fff' }}
          >
            Start Stock Count
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
