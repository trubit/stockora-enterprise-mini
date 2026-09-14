import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../api/client.ts';
import {
  Box,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Grid,
  Chip,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import MonetizationOnIcon from '@mui/icons-material/MonetizationOn';
import { toast } from 'react-hot-toast';

interface ExchangeRate {
  _id: string;
  code: string;
  symbol: string;
  rate: number;
  isActive: boolean;
}

const textFieldStyle = { mt: 1 };

export default function CurrencySettings() {
  const [openRateDialog, setOpenRateDialog] = useState(false);
  const [rateCode, setRateCode] = useState('');
  const [rateSymbol, setRateSymbol] = useState('');
  const [rateValue, setRateValue] = useState(1.0);

  const queryClient = useQueryClient();

  const { data: rates = [] } = useQuery<ExchangeRate[]>({
    queryKey: ['exchange-rates'],
    queryFn: async () => (await apiClient.get('/currency/rates')).data,
  });

  const rateMutation = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const { data } = await apiClient.post('/currency/rates', payload);
      return data;
    },
    onSuccess: () => {
      toast.success('Exchange rate updated successfully.');
      queryClient.invalidateQueries({ queryKey: ['exchange-rates'] });
      setOpenRateDialog(false);
      setRateCode('');
      setRateSymbol('');
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onError: (err: any) => {
      toast.error(err.response?.data?.error?.message || 'Failed to update rate.');
    },
  });

  const handleUpdateRate = () => {
    rateMutation.mutate({
      code: rateCode,
      symbol: rateSymbol,
      rate: rateValue,
    });
  };

  return (
    <Box sx={{ width: '100%' }}>
      <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800 }}>
            Currency Configurations
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Manage multi-currency conversions and global exchange rates.
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setOpenRateDialog(true)}
          sx={{ background: 'linear-gradient(90deg, #8b5cf6 0%, #7c3aed 100%)' }}
        >
          Add Currency Rate
        </Button>
      </Box>

      <Paper className="glass-panel">
        <Box
          sx={{
            p: 2.5,
            borderBottom: '1px solid rgba(255,255,255,0.05)',
            display: 'flex',
            alignItems: 'center',
            gap: 1,
          }}
        >
          <MonetizationOnIcon color="primary" />
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            Conversion Rates Ledger
          </Typography>
        </Box>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Code</TableCell>
                <TableCell>Symbol</TableCell>
                <TableCell>Conversion Factor (1 USD = X)</TableCell>
                <TableCell>Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rates.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} align="center">
                    No active foreign currency rates loaded.
                  </TableCell>
                </TableRow>
              ) : (
                rates.map((r) => (
                  <TableRow key={r._id}>
                    <TableCell sx={{ fontWeight: 750 }}>{r.code}</TableCell>
                    <TableCell>{r.symbol}</TableCell>
                    <TableCell sx={{ fontWeight: 700, color: 'secondary.light' }}>
                      {r.rate.toFixed(4)}
                    </TableCell>
                    <TableCell>
                      <Chip label="Active" color="success" size="small" />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* add rate dialog */}
      <Dialog open={openRateDialog} onClose={() => setOpenRateDialog(false)}>
        <DialogTitle>Add / Update Currency Rate</DialogTitle>
        <DialogContent>
          <Grid container spacing={2.5}>
            <Grid item xs={12}>
              <TextField
                label="Currency Code (e.g. EUR, NGN)"
                fullWidth
                value={rateCode}
                onChange={(e) => setRateCode(e.target.value)}
                sx={textFieldStyle}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Currency Symbol (e.g. €, ₦)"
                fullWidth
                value={rateSymbol}
                onChange={(e) => setRateSymbol(e.target.value)}
                sx={textFieldStyle}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                type="number"
                label="Factor (relative to USD)"
                fullWidth
                value={rateValue}
                onChange={(e) => setRateValue(Number(e.target.value))}
                sx={textFieldStyle}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenRateDialog(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleUpdateRate} disabled={rateMutation.isPending}>
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
