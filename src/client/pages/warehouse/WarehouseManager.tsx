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
import WarehouseIcon from '@mui/icons-material/Warehouse';
import { api } from '../../api/client.ts';
import { toast } from 'react-hot-toast';

export default function WarehouseManager() {
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [openModal, setOpenModal] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    warehouseType: 'MAIN',
    address: '',
    city: '',
    country: '',
    capacityUnits: 10000,
    capacityWeight: 50000,
  });

  const fetchWarehouses = async () => {
    try {
      const res = await api.get('/warehouse-advanced/warehouses');
      setWarehouses(res.data || []);
    } catch {
      toast.error('Failed to load warehouses directory.');
    }
  };

  useEffect(() => {
    fetchWarehouses();
  }, []);

  const handleCreateWarehouse = async () => {
    try {
      if (!formData.name || !formData.code) {
        toast.error('Warehouse name and code are required.');
        return;
      }
      await api.post('/warehouse-advanced/warehouses', {
        ...formData,
        capacityUnits: Number(formData.capacityUnits),
        capacityWeight: Number(formData.capacityWeight),
      });
      toast.success('Warehouse registered successfully!');
      setOpenModal(false);
      fetchWarehouses();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to register warehouse.');
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
            <WarehouseIcon fontSize="large" /> Multi-Warehouse Directory & Configuration
          </Typography>
          <Typography variant="body2" sx={{ color: '#9ca3af', mt: 0.5 }}>
            Configure multi-site fulfillment hubs, distribution centers, cold storage & capacity
            utilization thresholds
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
          Add Warehouse
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
          <Table sx={{ minWidth: 650 }}>
            <TableHead sx={{ background: '#1f2937' }}>
              <TableRow>
                <TableCell sx={{ color: '#9ca3af', fontWeight: 600 }}>Code</TableCell>
                <TableCell sx={{ color: '#9ca3af', fontWeight: 600 }}>Warehouse Name</TableCell>
                <TableCell sx={{ color: '#9ca3af', fontWeight: 600 }}>Type</TableCell>
                <TableCell sx={{ color: '#9ca3af', fontWeight: 600 }}>Location</TableCell>
                <TableCell sx={{ color: '#9ca3af', fontWeight: 600 }}>Capacity Units</TableCell>
                <TableCell sx={{ color: '#9ca3af', fontWeight: 600 }}>Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {warehouses.map((wh) => (
                <TableRow key={wh._id} sx={{ '&:hover': { background: '#1e293b' } }}>
                  <TableCell sx={{ color: '#818cf8', fontWeight: 700 }}>{wh.code}</TableCell>
                  <TableCell sx={{ color: '#f8fafc', fontWeight: 600 }}>{wh.name}</TableCell>
                  <TableCell>
                    <Chip
                      label={wh.warehouseType || 'MAIN'}
                      size="small"
                      sx={{ background: '#374151', color: '#cbd5e1', fontWeight: 600 }}
                    />
                  </TableCell>
                  <TableCell sx={{ color: '#9ca3af' }}>
                    {wh.city ? `${wh.city}, ${wh.country || ''}` : 'Primary Location'}
                  </TableCell>
                  <TableCell sx={{ color: '#34d399', fontWeight: 700 }}>
                    {(wh.capacityUnits || 10000).toLocaleString()} units
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={wh.isActive ? 'ACTIVE' : 'INACTIVE'}
                      size="small"
                      sx={{
                        fontWeight: 600,
                        background: wh.isActive
                          ? 'rgba(16, 185, 129, 0.2)'
                          : 'rgba(239, 68, 68, 0.2)',
                        color: wh.isActive ? '#34d399' : '#f87171',
                      }}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* Add Warehouse Dialog */}
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
          Register New Warehouse Facility
        </DialogTitle>
        <DialogContent sx={{ mt: 2 }}>
          <Grid container spacing={2}>
            <Grid item xs={6}>
              <TextField
                fullWidth
                label="Warehouse Name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                InputLabelProps={{ shrink: true, style: { color: '#9ca3af' } }}
                InputProps={{ style: { color: '#fff' } }}
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                label="Warehouse Code (e.g. WH-001)"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                InputLabelProps={{ shrink: true, style: { color: '#9ca3af' } }}
                InputProps={{ style: { color: '#fff' } }}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                select
                fullWidth
                label="Warehouse Type"
                value={formData.warehouseType}
                onChange={(e) => setFormData({ ...formData, warehouseType: e.target.value })}
                SelectProps={{ native: true }}
                InputLabelProps={{ shrink: true, style: { color: '#9ca3af' } }}
                InputProps={{ style: { color: '#fff' } }}
              >
                <option value="MAIN" style={{ background: '#111827' }}>
                  MAIN - Primary Hub
                </option>
                <option value="RETAIL" style={{ background: '#111827' }}>
                  RETAIL - Store Front
                </option>
                <option value="DISTRIBUTION" style={{ background: '#111827' }}>
                  DISTRIBUTION - Logistics Hub
                </option>
                <option value="FULFILLMENT" style={{ background: '#111827' }}>
                  FULFILLMENT - E-Commerce
                </option>
                <option value="COLD_STORAGE" style={{ background: '#111827' }}>
                  COLD_STORAGE - Temperature Controlled
                </option>
                <option value="TRANSIT" style={{ background: '#111827' }}>
                  TRANSIT - Cross-dock Staging
                </option>
              </TextField>
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                label="City"
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                InputLabelProps={{ shrink: true, style: { color: '#9ca3af' } }}
                InputProps={{ style: { color: '#fff' } }}
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                label="Country"
                value={formData.country}
                onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                InputLabelProps={{ shrink: true, style: { color: '#9ca3af' } }}
                InputProps={{ style: { color: '#fff' } }}
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                type="number"
                label="Capacity (Units)"
                value={formData.capacityUnits}
                onChange={(e) =>
                  setFormData({ ...formData, capacityUnits: Number(e.target.value) })
                }
                InputLabelProps={{ shrink: true, style: { color: '#9ca3af' } }}
                InputProps={{ style: { color: '#fff' } }}
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                type="number"
                label="Capacity (Weight kg)"
                value={formData.capacityWeight}
                onChange={(e) =>
                  setFormData({ ...formData, capacityWeight: Number(e.target.value) })
                }
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
            onClick={handleCreateWarehouse}
            sx={{ background: '#8b5cf6', color: '#fff' }}
          >
            Save Warehouse
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
