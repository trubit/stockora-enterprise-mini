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
} from '@mui/material';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { api } from '../../api/client.ts';
import { toast } from 'react-hot-toast';

export default function DispatchConsole() {
  const [manifests, setManifests] = useState<any[]>([]);

  const fetchManifests = async () => {
    try {
      const res = await api.get('/warehouse-advanced/manifests');
      setManifests(res.data || []);
    } catch {
      toast.error('Failed to load dispatch manifests.');
    }
  };

  useEffect(() => {
    fetchManifests();
  }, []);

  const handleDispatch = async (id: string) => {
    try {
      await api.post(`/warehouse-advanced/manifests/${id}/dispatch`);
      toast.success('Carrier handover completed & shipment dispatched!');
      fetchManifests();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to dispatch manifest.');
    }
  };

  return (
    <Box sx={{ p: 3, background: '#0b0f19', minHeight: '100vh', color: '#f8fafc' }}>
      <Box sx={{ mb: 3 }}>
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
          <LocalShippingIcon fontSize="large" /> Carrier Handover & Dispatch Verification
        </Typography>
        <Typography variant="body2" sx={{ color: '#9ca3af', mt: 0.5 }}>
          Verify staged outbound shipments, perform driver sign-off & log carrier handover dispatch
          events
        </Typography>
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
                <TableCell sx={{ color: '#9ca3af', fontWeight: 600 }}>Total Packages</TableCell>
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
                      <Button
                        size="small"
                        variant="contained"
                        startIcon={<CheckCircleIcon />}
                        onClick={() => handleDispatch(m._id)}
                        sx={{ background: '#10b981', color: '#fff' }}
                      >
                        Handover & Dispatch
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </Box>
  );
}
