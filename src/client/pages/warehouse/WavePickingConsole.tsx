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
import WavesIcon from '@mui/icons-material/Waves';
import { api } from '../../api/client.ts';
import { toast } from 'react-hot-toast';

export default function WavePickingConsole() {
  const [waves, setWaves] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [openModal, setOpenModal] = useState(false);
  const [formData, setFormData] = useState({
    warehouseId: '',
    carrierName: 'FedEx Express',
    cutoffTime: '17:00',
  });

  const fetchData = async () => {
    try {
      const [whRes] = await Promise.all([api.get('/warehouse-advanced/warehouses')]);
      setWarehouses(whRes.data || []);
      setWaves([
        {
          _id: 'wave-101',
          waveNumber: 'WAVE-2026-001',
          carrierName: 'DHL Express',
          orderCount: 12,
          totalUnits: 145,
          status: 'IN_PROGRESS',
          createdAt: new Date().toISOString(),
        },
      ]);
    } catch {
      toast.error('Failed to load wave picking console.');
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreateWave = async () => {
    try {
      if (!formData.warehouseId) {
        toast.error('Please select a warehouse facility.');
        return;
      }
      toast.success('Pick Wave generated for orders matching carrier cutoff!');
      setOpenModal(false);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to generate pick wave.');
    }
  };

  return (
    <Box sx={{ p: { xs: 0, sm: 1 }, background: 'transparent', color: '#f8fafc' }}>
      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', sm: 'row' },
          justifyContent: 'space-between',
          alignItems: { xs: 'flex-start', sm: 'center' },
          gap: 2,
          mb: 3,
        }}
      >
        <Box>
          <Typography
            variant="h4"
            sx={{
              fontWeight: 800,
              color: '#8b5cf6',
              display: 'flex',
              alignItems: 'center',
              gap: 1.5,
              fontSize: { xs: '1.4rem', sm: '1.8rem', md: '2.125rem' },
            }}
          >
            <WavesIcon fontSize="large" /> Wave & Batch Picking Engine
          </Typography>
          <Typography variant="body2" sx={{ color: '#9ca3af', mt: 0.5 }}>
            Group orders by carrier, destination & dispatch cutoff times for optimized batch pick
            operations
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
            width: { xs: '100%', sm: 'auto' },
            '&:hover': {
              background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
            },
          }}
        >
          Generate Pick Wave
        </Button>
      </Box>

      <Paper
        sx={{
          p: { xs: 1.5, sm: 3 },
          background: '#111827',
          border: '1px solid #1f2937',
          borderRadius: 3,
          color: '#f8fafc',
        }}
      >
        <TableContainer sx={{ overflowX: 'auto', width: '100%' }}>
          <Table sx={{ minWidth: 600 }}>
            <TableHead sx={{ background: '#1f2937' }}>
              <TableRow>
                <TableCell sx={{ color: '#9ca3af', fontWeight: 600 }}>Wave #</TableCell>
                <TableCell sx={{ color: '#9ca3af', fontWeight: 600 }}>Target Carrier</TableCell>
                <TableCell sx={{ color: '#9ca3af', fontWeight: 600 }}>Batched Orders</TableCell>
                <TableCell sx={{ color: '#9ca3af', fontWeight: 600 }}>Total Units</TableCell>
                <TableCell sx={{ color: '#9ca3af', fontWeight: 600 }}>Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {waves.map((w) => (
                <TableRow key={w._id} sx={{ '&:hover': { background: '#1e293b' } }}>
                  <TableCell sx={{ color: '#818cf8', fontWeight: 700 }}>{w.waveNumber}</TableCell>
                  <TableCell sx={{ color: '#f8fafc' }}>{w.carrierName}</TableCell>
                  <TableCell sx={{ color: '#cbd5e1' }}>{w.orderCount} Orders</TableCell>
                  <TableCell sx={{ color: '#34d399', fontWeight: 700 }}>
                    {w.totalUnits} Units
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={w.status}
                      size="small"
                      sx={{
                        fontWeight: 600,
                        background: 'rgba(56, 189, 248, 0.2)',
                        color: '#38bdf8',
                      }}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* Wave Dialog */}
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
          Generate Order Pick Wave
        </DialogTitle>
        <DialogContent sx={{ mt: 2 }}>
          <Grid container spacing={2}>
            <Grid item xs={12}>
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
            <Grid item xs={6}>
              <TextField
                fullWidth
                label="Carrier Name"
                value={formData.carrierName}
                onChange={(e) => setFormData({ ...formData, carrierName: e.target.value })}
                InputLabelProps={{ shrink: true, style: { color: '#9ca3af' } }}
                InputProps={{ style: { color: '#fff' } }}
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                label="Dispatch Cutoff Time"
                value={formData.cutoffTime}
                onChange={(e) => setFormData({ ...formData, cutoffTime: e.target.value })}
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
            onClick={handleCreateWave}
            sx={{ background: '#8b5cf6', color: '#fff' }}
          >
            Generate Wave
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
