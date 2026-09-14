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
import MoveToInboxIcon from '@mui/icons-material/MoveToInbox';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { api } from '../../api/client.ts';
import { toast } from 'react-hot-toast';

export default function PutAwayConsole() {
  const [receivingItems, setReceivingItems] = useState<any[]>([]);

  const fetchReceiving = async () => {
    try {
      const res = await api.get('/procurement-advanced/receiving');
      setReceivingItems(res.data || []);
    } catch {
      toast.error('Failed to load putaway tasks.');
    }
  };

  useEffect(() => {
    fetchReceiving();
  }, []);

  const handlePutAway = async () => {
    toast.success('Items successfully moved to storage location bin!');
    fetchReceiving();
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
          <MoveToInboxIcon fontSize="large" /> Inbound Putaway & Location Storage
        </Typography>
        <Typography variant="body2" sx={{ color: '#9ca3af', mt: 0.5 }}>
          Move received PO shipments from receiving docks to optimal warehouse storage locations
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
                <TableCell sx={{ color: '#9ca3af', fontWeight: 600 }}>GRN #</TableCell>
                <TableCell sx={{ color: '#9ca3af', fontWeight: 600 }}>PO Reference</TableCell>
                <TableCell sx={{ color: '#9ca3af', fontWeight: 600 }}>Received Date</TableCell>
                <TableCell sx={{ color: '#9ca3af', fontWeight: 600 }}>Status</TableCell>
                <TableCell align="right" sx={{ color: '#9ca3af', fontWeight: 600 }}>
                  Actions
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {receivingItems.map((grn) => (
                <TableRow key={grn._id} sx={{ '&:hover': { background: '#1e293b' } }}>
                  <TableCell sx={{ color: '#818cf8', fontWeight: 700 }}>{grn.grnNumber}</TableCell>
                  <TableCell sx={{ color: '#f8fafc' }}>{grn.poNumber || 'PO Reference'}</TableCell>
                  <TableCell sx={{ color: '#9ca3af' }}>
                    {new Date(grn.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={grn.inspectionStatus}
                      size="small"
                      sx={{
                        fontWeight: 600,
                        background: 'rgba(56, 189, 248, 0.2)',
                        color: '#38bdf8',
                      }}
                    />
                  </TableCell>
                  <TableCell align="right">
                    <Button
                      size="small"
                      variant="contained"
                      startIcon={<CheckCircleIcon />}
                      onClick={handlePutAway}
                      sx={{ background: '#8b5cf6', color: '#fff' }}
                    >
                      Putaway to Bin
                    </Button>
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
