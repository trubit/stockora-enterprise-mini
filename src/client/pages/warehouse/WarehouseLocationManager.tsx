import { useEffect, useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Chip,
  Grid,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import { api } from '../../api/client.ts';
import { toast } from 'react-hot-toast';

export default function WarehouseLocationManager() {
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [openModal, setOpenModal] = useState(false);
  const [formData, setFormData] = useState({
    warehouseId: '',
    locationCode: '',
    aisle: 'A',
    rack: '01',
    shelf: '01',
    bin: '01',
    locationType: 'STORAGE',
    capacityUnits: 500,
    capacityWeight: 2000,
  });

  const fetchData = async () => {
    try {
      const [whRes, locRes] = await Promise.all([
        api.get('/warehouse-advanced/warehouses'),
        api.get('/warehouse-advanced/locations'),
      ]);
      setWarehouses(whRes.data || []);
      setLocations(locRes.data || []);
    } catch {
      toast.error('Failed to load warehouse locations.');
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreateLocation = async () => {
    try {
      if (!formData.warehouseId || !formData.locationCode) {
        toast.error('Warehouse and Location Code are required.');
        return;
      }
      await api.post('/warehouse-advanced/locations', {
        ...formData,
        capacityUnits: Number(formData.capacityUnits),
        capacityWeight: Number(formData.capacityWeight),
      });
      toast.success('Storage location created!');
      setOpenModal(false);
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to create location.');
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
            <LocationOnIcon fontSize="large" /> Storage Location Hierarchy & Capacity
          </Typography>
          <Typography variant="body2" sx={{ color: '#9ca3af', mt: 0.5 }}>
            Configure Zone → Aisle → Rack → Shelf → Bin hierarchy and monitor capacity utilization %
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
          Add Location
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
                <TableCell sx={{ color: '#9ca3af', fontWeight: 600 }}>Location Code</TableCell>
                <TableCell sx={{ color: '#9ca3af', fontWeight: 600 }}>Type</TableCell>
                <TableCell sx={{ color: '#9ca3af', fontWeight: 600 }}>
                  Aisle / Rack / Shelf / Bin
                </TableCell>
                <TableCell sx={{ color: '#9ca3af', fontWeight: 600 }}>Occupancy</TableCell>
                <TableCell sx={{ color: '#9ca3af', fontWeight: 600 }}>Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {locations.map((loc) => (
                <TableRow key={loc._id} sx={{ '&:hover': { background: '#1e293b' } }}>
                  <TableCell sx={{ color: '#818cf8', fontWeight: 700 }}>
                    {loc.locationCode}
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={loc.locationType}
                      size="small"
                      sx={{ background: '#374151', color: '#cbd5e1', fontWeight: 600 }}
                    />
                  </TableCell>
                  <TableCell sx={{ color: '#cbd5e1' }}>
                    Aisle {loc.aisle || 'A'} • Rack {loc.rack || '01'} • Shelf {loc.shelf || '01'} •
                    Bin {loc.bin || '01'}
                  </TableCell>
                  <TableCell sx={{ color: '#34d399', fontWeight: 700 }}>
                    {loc.currentUnits || 0} / {loc.capacityUnits || 500} units
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={loc.isActive ? 'ACTIVE' : 'INACTIVE'}
                      size="small"
                      sx={{
                        fontWeight: 600,
                        background: loc.isActive
                          ? 'rgba(16, 185, 129, 0.2)'
                          : 'rgba(239, 68, 68, 0.2)',
                        color: loc.isActive ? '#34d399' : '#f87171',
                      }}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* Add Location Modal */}
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
          Add Storage Location
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
                label="Location Code (e.g. A-01-02-B1)"
                value={formData.locationCode}
                onChange={(e) => setFormData({ ...formData, locationCode: e.target.value })}
                InputLabelProps={{ shrink: true, style: { color: '#9ca3af' } }}
                InputProps={{ style: { color: '#fff' } }}
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                select
                fullWidth
                label="Location Type"
                value={formData.locationType}
                onChange={(e) => setFormData({ ...formData, locationType: e.target.value as any })}
                SelectProps={{ native: true }}
                InputLabelProps={{ shrink: true, style: { color: '#9ca3af' } }}
                InputProps={{ style: { color: '#fff' } }}
              >
                <option value="STORAGE" style={{ background: '#111827' }}>
                  STORAGE - Pallet / Shelf
                </option>
                <option value="PICKING" style={{ background: '#111827' }}>
                  PICKING - Fast Pick
                </option>
                <option value="RECEIVING" style={{ background: '#111827' }}>
                  RECEIVING - Inbound Dock
                </option>
                <option value="PACKING" style={{ background: '#111827' }}>
                  PACKING - Station
                </option>
                <option value="DISPATCH" style={{ background: '#111827' }}>
                  DISPATCH - Staging Dock
                </option>
                <option value="QUARANTINE" style={{ background: '#111827' }}>
                  QUARANTINE - Hold
                </option>
                <option value="DAMAGED" style={{ background: '#111827' }}>
                  DAMAGED - Defective Hold
                </option>
                <option value="RETURNS" style={{ background: '#111827' }}>
                  RETURNS - Customer Return Staging
                </option>
              </TextField>
            </Grid>
            <Grid item xs={3}>
              <TextField
                fullWidth
                label="Aisle"
                value={formData.aisle}
                onChange={(e) => setFormData({ ...formData, aisle: e.target.value })}
                InputLabelProps={{ shrink: true, style: { color: '#9ca3af' } }}
                InputProps={{ style: { color: '#fff' } }}
              />
            </Grid>
            <Grid item xs={3}>
              <TextField
                fullWidth
                label="Rack"
                value={formData.rack}
                onChange={(e) => setFormData({ ...formData, rack: e.target.value })}
                InputLabelProps={{ shrink: true, style: { color: '#9ca3af' } }}
                InputProps={{ style: { color: '#fff' } }}
              />
            </Grid>
            <Grid item xs={3}>
              <TextField
                fullWidth
                label="Shelf"
                value={formData.shelf}
                onChange={(e) => setFormData({ ...formData, shelf: e.target.value })}
                InputLabelProps={{ shrink: true, style: { color: '#9ca3af' } }}
                InputProps={{ style: { color: '#fff' } }}
              />
            </Grid>
            <Grid item xs={3}>
              <TextField
                fullWidth
                label="Bin"
                value={formData.bin}
                onChange={(e) => setFormData({ ...formData, bin: e.target.value })}
                InputLabelProps={{ shrink: true, style: { color: '#9ca3af' } }}
                InputProps={{ style: { color: '#fff' } }}
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                type="number"
                label="Max Unit Capacity"
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
                label="Max Weight (kg)"
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
            onClick={handleCreateLocation}
            sx={{ background: '#8b5cf6', color: '#fff' }}
          >
            Save Location
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
