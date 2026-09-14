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
import PrecisionManufacturingIcon from '@mui/icons-material/PrecisionManufacturing';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { api } from '../../api/client.ts';
import { toast } from 'react-hot-toast';

export default function PickingConsole() {
  const [pickTasks, setPickTasks] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [openModal, setOpenModal] = useState(false);
  const [formData, setFormData] = useState({
    warehouseId: '',
    productId: '',
    requestedQuantity: 10,
    strategy: 'SINGLE',
    priority: 'NORMAL',
  });

  const fetchData = async () => {
    try {
      const [pickRes, whRes, prodRes] = await Promise.all([
        api.get('/warehouse-advanced/picking'),
        api.get('/warehouse-advanced/warehouses'),
        api.get('/products'),
      ]);
      setPickTasks(pickRes.data || []);
      setWarehouses(whRes.data || []);
      setProducts(prodRes.data?.data || prodRes.data || []);
    } catch {
      toast.error('Failed to load picking tasks.');
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreatePickTask = async () => {
    try {
      if (!formData.warehouseId || !formData.productId) {
        toast.error('Please select warehouse and product.');
        return;
      }
      await api.post('/warehouse-advanced/picking', {
        warehouseId: formData.warehouseId,
        strategy: formData.strategy,
        priority: formData.priority,
        items: [
          { productId: formData.productId, requestedQuantity: Number(formData.requestedQuantity) },
        ],
      });
      toast.success('Pick task assigned successfully!');
      setOpenModal(false);
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to assign pick task.');
    }
  };

  const handleExecutePick = async (task: any, item: any) => {
    try {
      await api.post('/warehouse-advanced/picking/execute', {
        pickTaskId: task._id,
        productId: item.productId,
        quantityPicked: item.requestedQuantity,
      });
      toast.success('Pick item executed & stock reserved!');
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to execute pick item.');
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
            <PrecisionManufacturingIcon fontSize="large" /> Advanced Picking Engine Console
          </Typography>
          <Typography variant="body2" sx={{ color: '#9ca3af', mt: 0.5 }}>
            Single order, batch & zone picking assignments with aisle route optimization and barcode
            scanning validation
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
          Create Pick Task
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
                <TableCell sx={{ color: '#9ca3af', fontWeight: 600 }}>Task #</TableCell>
                <TableCell sx={{ color: '#9ca3af', fontWeight: 600 }}>Strategy</TableCell>
                <TableCell sx={{ color: '#9ca3af', fontWeight: 600 }}>Priority</TableCell>
                <TableCell sx={{ color: '#9ca3af', fontWeight: 600 }}>Items to Pick</TableCell>
                <TableCell sx={{ color: '#9ca3af', fontWeight: 600 }}>Status</TableCell>
                <TableCell align="right" sx={{ color: '#9ca3af', fontWeight: 600 }}>
                  Actions
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {pickTasks.map((t) => (
                <TableRow key={t._id} sx={{ '&:hover': { background: '#1e293b' } }}>
                  <TableCell sx={{ color: '#818cf8', fontWeight: 700 }}>
                    {t.pickListNumber}
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={t.strategy || 'SINGLE'}
                      size="small"
                      sx={{ background: '#374151', color: '#cbd5e1', fontWeight: 600 }}
                    />
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={t.priority || 'NORMAL'}
                      size="small"
                      sx={{
                        background: 'rgba(245, 158, 11, 0.2)',
                        color: '#fbbf24',
                        fontWeight: 600,
                      }}
                    />
                  </TableCell>
                  <TableCell sx={{ color: '#cbd5e1' }}>{t.items?.length || 0} SKUs</TableCell>
                  <TableCell>
                    <Chip
                      label={t.status}
                      size="small"
                      sx={{
                        fontWeight: 600,
                        background:
                          t.status === 'COMPLETED'
                            ? 'rgba(16, 185, 129, 0.2)'
                            : 'rgba(56, 189, 248, 0.2)',
                        color: t.status === 'COMPLETED' ? '#34d399' : '#38bdf8',
                      }}
                    />
                  </TableCell>
                  <TableCell align="right">
                    {t.status !== 'COMPLETED' && t.items?.[0] && (
                      <Button
                        size="small"
                        variant="contained"
                        startIcon={<CheckCircleIcon />}
                        onClick={() => handleExecutePick(t, t.items[0])}
                        sx={{ background: '#10b981', color: '#fff' }}
                      >
                        Confirm Pick
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* Pick Task Dialog */}
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
          Assign New Pick Task
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
            <Grid item xs={4}>
              <TextField
                fullWidth
                type="number"
                label="Quantity"
                value={formData.requestedQuantity}
                onChange={(e) =>
                  setFormData({ ...formData, requestedQuantity: Number(e.target.value) })
                }
                InputLabelProps={{ shrink: true, style: { color: '#9ca3af' } }}
                InputProps={{ style: { color: '#fff' } }}
              />
            </Grid>
            <Grid item xs={4}>
              <TextField
                select
                fullWidth
                label="Strategy"
                value={formData.strategy}
                onChange={(e) => setFormData({ ...formData, strategy: e.target.value })}
                SelectProps={{ native: true }}
                InputLabelProps={{ shrink: true, style: { color: '#9ca3af' } }}
                InputProps={{ style: { color: '#fff' } }}
              >
                <option value="SINGLE" style={{ background: '#111827' }}>
                  SINGLE
                </option>
                <option value="BATCH" style={{ background: '#111827' }}>
                  BATCH
                </option>
                <option value="WAVE" style={{ background: '#111827' }}>
                  WAVE
                </option>
                <option value="ZONE" style={{ background: '#111827' }}>
                  ZONE
                </option>
              </TextField>
            </Grid>
            <Grid item xs={4}>
              <TextField
                select
                fullWidth
                label="Priority"
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                SelectProps={{ native: true }}
                InputLabelProps={{ shrink: true, style: { color: '#9ca3af' } }}
                InputProps={{ style: { color: '#fff' } }}
              >
                <option value="URGENT" style={{ background: '#111827' }}>
                  URGENT
                </option>
                <option value="HIGH" style={{ background: '#111827' }}>
                  HIGH
                </option>
                <option value="NORMAL" style={{ background: '#111827' }}>
                  NORMAL
                </option>
                <option value="LOW" style={{ background: '#111827' }}>
                  LOW
                </option>
              </TextField>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ p: 2.5, borderTop: '1px solid #1f2937' }}>
          <Button onClick={() => setOpenModal(false)} sx={{ color: '#9ca3af' }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleCreatePickTask}
            sx={{ background: '#8b5cf6', color: '#fff' }}
          >
            Assign Pick Task
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
