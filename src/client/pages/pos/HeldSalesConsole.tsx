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
} from '@mui/material';
import PauseCircleIcon from '@mui/icons-material/PauseCircle';
import PlayCircleIcon from '@mui/icons-material/PlayCircle';
import { api } from '../../api/client.ts';
import { toast } from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { useRegionalSettings } from '../../hooks/useRegionalSettings.js';
import { CurrencySelector } from '../../components/CurrencySelector.tsx';

export default function HeldSalesConsole() {
  const { formatAmount } = useRegionalSettings();
  const [heldSales, setHeldSales] = useState<any[]>([]);
  const navigate = useNavigate();

  const fetchHeldSales = async () => {
    try {
      const res = await api.get('/pos-advanced/held');
      setHeldSales(res.data || []);
    } catch {
      toast.error('Failed to load held sales.');
    }
  };

  useEffect(() => {
    fetchHeldSales();
  }, []);

  const handleResume = async (holdId: string) => {
    try {
      await api.post(`/pos-advanced/resume/${holdId}`);
      toast.success(`Held sale ${holdId} restored to active POS cart!`);
      navigate('/pos/terminal');
    } catch {
      toast.error('Failed to restore held sale.');
    }
  };

  return (
    <Box sx={{ p: 3, background: '#0b0f19', minHeight: '100vh', color: '#f8fafc' }}>
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          mb: 3,
          flexWrap: 'wrap',
          gap: 2,
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
            }}
          >
            <PauseCircleIcon fontSize="large" /> Held Sales & Transaction Suspensions
          </Typography>
          <Typography variant="body2" sx={{ color: '#9ca3af', mt: 0.5 }}>
            Resume suspended customer carts, inspect held transaction items & clear expired queue
            holds
          </Typography>
        </Box>
        <CurrencySelector size="small" />
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
                <TableCell sx={{ color: '#9ca3af', fontWeight: 600 }}>Hold Reference #</TableCell>
                <TableCell sx={{ color: '#9ca3af', fontWeight: 600 }}>Cashier</TableCell>
                <TableCell sx={{ color: '#9ca3af', fontWeight: 600 }}>Customer</TableCell>
                <TableCell sx={{ color: '#9ca3af', fontWeight: 600 }}>Cart Items</TableCell>
                <TableCell sx={{ color: '#9ca3af', fontWeight: 600 }}>Subtotal</TableCell>
                <TableCell sx={{ color: '#9ca3af', fontWeight: 600 }}>Held Timestamp</TableCell>
                <TableCell align="right" sx={{ color: '#9ca3af', fontWeight: 600 }}>
                  Action
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {heldSales.map((h) => (
                <TableRow key={h._id} sx={{ '&:hover': { background: '#1e293b' } }}>
                  <TableCell sx={{ color: '#818cf8', fontWeight: 700 }}>{h.holdId}</TableCell>
                  <TableCell sx={{ color: '#f8fafc' }}>{h.cashierName}</TableCell>
                  <TableCell sx={{ color: '#cbd5e1' }}>
                    {h.customerName || 'Walk-in Guest'}
                  </TableCell>
                  <TableCell sx={{ color: '#cbd5e1' }}>
                    {h.cartItems?.length || 0} Products
                  </TableCell>
                  <TableCell sx={{ color: '#34d399', fontWeight: 700 }}>
                    {formatAmount(h.subtotal)}
                  </TableCell>
                  <TableCell sx={{ color: '#9ca3af' }}>
                    {new Date(h.createdAt).toLocaleTimeString()}
                  </TableCell>
                  <TableCell align="right">
                    <Button
                      size="small"
                      variant="contained"
                      startIcon={<PlayCircleIcon />}
                      onClick={() => handleResume(h.holdId)}
                      sx={{ background: '#8b5cf6', color: '#fff' }}
                    >
                      Restore Cart
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
