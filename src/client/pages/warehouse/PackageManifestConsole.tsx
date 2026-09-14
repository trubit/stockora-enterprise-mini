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
import DescriptionIcon from '@mui/icons-material/Description';
import QrCodeScannerIcon from '@mui/icons-material/QrCodeScanner';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import { api } from '../../api/client.ts';
import { toast } from 'react-hot-toast';

export default function PackageManifestConsole() {
  const [manifests, setManifests] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [packages, setPackages] = useState<any[]>([]);
  const [openModal, setOpenModal] = useState(false);
  const [formData, setFormData] = useState({
    warehouseId: '',
    carrierName: 'DHL Express',
    driverName: 'John Doe',
    driverPhone: '+1-555-0192',
    vehiclePlateNumber: 'KJA-982-AA',
    selectedPackageIds: [] as string[],
  });

  const fetchData = async () => {
    try {
      const [mnfRes, whRes, pkgRes] = await Promise.all([
        api.get('/warehouse-advanced/manifests'),
        api.get('/warehouse-advanced/warehouses'),
        api.get('/warehouse-advanced/packages'),
      ]);
      setManifests(mnfRes.data || []);
      setWarehouses(whRes.data || []);
      setPackages(pkgRes.data || []);
    } catch {
      toast.error('Failed to load dispatch manifests.');
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreateManifest = async () => {
    try {
      if (!formData.warehouseId || !formData.carrierName) {
        toast.error('Please select warehouse and carrier.');
        return;
      }
      const pkgIds =
        formData.selectedPackageIds.length > 0
          ? formData.selectedPackageIds
          : packages.slice(0, 3).map((p) => p._id);
      await api.post('/warehouse-advanced/manifests', {
        warehouseId: formData.warehouseId,
        carrierName: formData.carrierName,
        driverName: formData.driverName,
        driverPhone: formData.driverPhone,
        vehiclePlateNumber: formData.vehiclePlateNumber,
        packageIds: pkgIds,
      });
      toast.success('Shipment manifest created!');
      setOpenModal(false);
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to create shipment manifest.');
    }
  };

  const handleVerifyPackage = async (manifestId: string, packageNumber: string) => {
    try {
      await api.post(`/warehouse-advanced/manifests/${manifestId}/verify`, { packageNumber });
      toast.success(`Package ${packageNumber} verified loaded!`);
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Package loading scan failed.');
    }
  };

  const handleDispatchManifest = async (id: string) => {
    try {
      await api.post(`/warehouse-advanced/manifests/${id}/dispatch`);
      toast.success('Carrier handover complete & manifest dispatched!');
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to dispatch manifest.');
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
            <DescriptionIcon fontSize="large" /> Shipment Manifest & Loading Verification
          </Typography>
          <Typography variant="body2" sx={{ color: '#9ca3af', mt: 0.5 }}>
            Create carrier shipment manifests, perform loading scan verification, and log carrier
            handover
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
          Create Manifest
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
                <TableCell sx={{ color: '#9ca3af', fontWeight: 600 }}>Manifest #</TableCell>
                <TableCell sx={{ color: '#9ca3af', fontWeight: 600 }}>Carrier</TableCell>
                <TableCell sx={{ color: '#9ca3af', fontWeight: 600 }}>Driver / Vehicle</TableCell>
                <TableCell sx={{ color: '#9ca3af', fontWeight: 600 }}>Packages</TableCell>
                <TableCell sx={{ color: '#9ca3af', fontWeight: 600 }}>Status</TableCell>
                <TableCell align="right" sx={{ color: '#9ca3af', fontWeight: 600 }}>
                  Actions
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {manifests.map((m) => (
                <TableRow key={m._id} sx={{ '&:hover': { background: '#1e293b' } }}>
                  <TableCell sx={{ color: '#818cf8', fontWeight: 700 }}>
                    {m.manifestNumber}
                  </TableCell>
                  <TableCell sx={{ color: '#f8fafc', fontWeight: 600 }}>{m.carrierName}</TableCell>
                  <TableCell sx={{ color: '#cbd5e1' }}>
                    {m.driverName || 'Driver'} ({m.vehiclePlateNumber || 'Plate'})
                  </TableCell>
                  <TableCell sx={{ color: '#34d399', fontWeight: 700 }}>
                    {m.totalPackages || 0} PKGs
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={m.status}
                      size="small"
                      sx={{
                        fontWeight: 600,
                        background:
                          m.status === 'DISPATCHED'
                            ? 'rgba(16, 185, 129, 0.2)'
                            : 'rgba(56, 189, 248, 0.2)',
                        color: m.status === 'DISPATCHED' ? '#34d399' : '#38bdf8',
                      }}
                    />
                  </TableCell>
                  <TableCell align="right">
                    {m.status !== 'DISPATCHED' && (
                      <>
                        <Button
                          size="small"
                          variant="outlined"
                          startIcon={<QrCodeScannerIcon />}
                          onClick={() =>
                            handleVerifyPackage(m._id, m.items?.[0]?.packageNumber || 'PKG-001')
                          }
                          sx={{ color: '#38bdf8', borderColor: '#38bdf8', mr: 1 }}
                        >
                          Scan Package
                        </Button>
                        <Button
                          size="small"
                          variant="contained"
                          startIcon={<LocalShippingIcon />}
                          onClick={() => handleDispatchManifest(m._id)}
                          sx={{ background: '#10b981', color: '#fff' }}
                        >
                          Carrier Handover & Dispatch
                        </Button>
                      </>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* Manifest Modal */}
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
          Create Shipment Manifest
        </DialogTitle>
        <DialogContent sx={{ mt: 2 }}>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <TextField
                select
                fullWidth
                label="Dispatch Warehouse"
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
                label="Driver Name"
                value={formData.driverName}
                onChange={(e) => setFormData({ ...formData, driverName: e.target.value })}
                InputLabelProps={{ shrink: true, style: { color: '#9ca3af' } }}
                InputProps={{ style: { color: '#fff' } }}
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                label="Driver Phone"
                value={formData.driverPhone}
                onChange={(e) => setFormData({ ...formData, driverPhone: e.target.value })}
                InputLabelProps={{ shrink: true, style: { color: '#9ca3af' } }}
                InputProps={{ style: { color: '#fff' } }}
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                label="Vehicle Plate Number"
                value={formData.vehiclePlateNumber}
                onChange={(e) => setFormData({ ...formData, vehiclePlateNumber: e.target.value })}
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
            onClick={handleCreateManifest}
            sx={{ background: '#8b5cf6', color: '#fff' }}
          >
            Generate Manifest
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
