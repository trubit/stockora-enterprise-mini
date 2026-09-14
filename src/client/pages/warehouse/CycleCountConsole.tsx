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
import CalculateIcon from '@mui/icons-material/Calculate';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { api } from '../../api/client.ts';
import { toast } from 'react-hot-toast';

export default function CycleCountConsole() {
  const [counts, setCounts] = useState<any[]>([]);

  const fetchCounts = async () => {
    try {
      const res = await api.get('/warehouse-advanced/counts');
      setCounts(res.data || []);
    } catch {
      toast.error('Failed to load cycle counts.');
    }
  };

  useEffect(() => {
    fetchCounts();
  }, []);

  const handleReconcile = async (id: string) => {
    try {
      await api.post(`/warehouse-advanced/counts/${id}/reconcile`);
      toast.success('Stock count reconciled successfully!');
      fetchCounts();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to reconcile count.');
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
          <CalculateIcon fontSize="large" /> Scheduled Cycle Counting Console
        </Typography>
        <Typography variant="body2" sx={{ color: '#9ca3af', mt: 0.5 }}>
          Manage recurring cycle count rotations, review physical counts & reconcile inventory
          variances
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
                <TableCell sx={{ color: '#9ca3af', fontWeight: 600 }}>Count #</TableCell>
                <TableCell sx={{ color: '#9ca3af', fontWeight: 600 }}>Count Type</TableCell>
                <TableCell sx={{ color: '#9ca3af', fontWeight: 600 }}>Total Items</TableCell>
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
                        Reconcile Variance
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
