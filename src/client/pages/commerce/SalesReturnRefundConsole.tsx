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
  MenuItem,
  Grid,
} from '@mui/material';
import AssignmentReturnIcon from '@mui/icons-material/AssignmentReturn';
import AddIcon from '@mui/icons-material/Add';
import { api } from '../../api/client.ts';
import { toast } from 'react-hot-toast';
import { useRegionalSettings } from '../../hooks/useRegionalSettings.js';

export default function SalesReturnRefundConsole() {
  const { formatAmount } = useRegionalSettings();
  const [transactions, setTransactions] = useState<any[]>([]);
  const [openModal, setOpenModal] = useState(false);
  const [formData, setFormData] = useState({
    transactionId: '',
    productId: '',
    quantity: 1,
    returnReason: 'Customer changed mind / incorrect size',
    refundMethod: 'CASH',
    inventoryDisposition: 'RESTOCK',
  });

  const fetchTransactions = async () => {
    try {
      const res = await api.get('/omnichannel-commerce/transactions');
      setTransactions(res.data || []);
    } catch {
      toast.error('Failed to load transactions.');
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, []);

  const handleProcessReturn = async () => {
    try {
      if (!formData.transactionId || !formData.productId) {
        toast.error('Transaction and Product selection are required.');
        return;
      }
      await api.post('/omnichannel-commerce/returns', {
        transactionId: formData.transactionId,
        items: [
          {
            productId: formData.productId,
            quantity: Number(formData.quantity),
            returnReason: formData.returnReason,
          },
        ],
        refundMethod: formData.refundMethod,
        inventoryDisposition: formData.inventoryDisposition,
      });
      toast.success('Sales return & refund processed successfully!');
      setOpenModal(false);
      fetchTransactions();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to process return.');
    }
  };

  const selectedTx = transactions.find((t) => t._id === formData.transactionId);

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
            <AssignmentReturnIcon fontSize="large" /> Sales Returns, Exchanges & Refund Console
          </Typography>
          <Typography variant="body2" sx={{ color: '#9ca3af', mt: 0.5 }}>
            Process omnichannel product returns, perform inspection dispositions (Restock,
            Quarantine, Damaged) & issue refunds
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
          Process Return / Refund
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
                <TableCell sx={{ color: '#9ca3af', fontWeight: 600 }}>Transaction #</TableCell>
                <TableCell sx={{ color: '#9ca3af', fontWeight: 600 }}>Customer</TableCell>
                <TableCell sx={{ color: '#9ca3af', fontWeight: 600 }}>Total Paid</TableCell>
                <TableCell sx={{ color: '#9ca3af', fontWeight: 600 }}>Status</TableCell>
                <TableCell align="right" sx={{ color: '#9ca3af', fontWeight: 600 }}>
                  Actions
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {transactions.map((tx) => (
                <TableRow key={tx._id} sx={{ '&:hover': { background: '#1e293b' } }}>
                  <TableCell sx={{ color: '#818cf8', fontWeight: 700 }}>
                    {tx.transactionNumber}
                  </TableCell>
                  <TableCell sx={{ color: '#f8fafc' }}>
                    {tx.customerName || 'Walk-in Guest'}
                  </TableCell>
                  <TableCell sx={{ color: '#34d399', fontWeight: 700 }}>
                    {formatAmount(tx.totalAmount)}
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={tx.status}
                      size="small"
                      sx={{ background: '#374151', color: '#cbd5e1', fontWeight: 600 }}
                    />
                  </TableCell>
                  <TableCell align="right">
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() => {
                        setFormData({ ...formData, transactionId: tx._id });
                        setOpenModal(true);
                      }}
                      sx={{ color: '#8b5cf6', borderColor: '#8b5cf6' }}
                    >
                      Return Items
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* Return Dialog */}
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
          Process Sales Return & Refund
        </DialogTitle>
        <DialogContent sx={{ mt: 2 }}>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <TextField
                select
                fullWidth
                label="Target Transaction"
                value={formData.transactionId}
                onChange={(e) =>
                  setFormData({ ...formData, transactionId: e.target.value, productId: '' })
                }
                InputLabelProps={{ shrink: true, style: { color: '#9ca3af' } }}
                InputProps={{ style: { color: '#fff' } }}
                SelectProps={{
                  MenuProps: {
                    PaperProps: {
                      sx: { background: '#111827', border: '1px solid #1f2937', color: '#f8fafc' },
                    },
                  },
                }}
              >
                <MenuItem value="" sx={{ color: '#9ca3af', background: '#111827' }}>
                  -- Select Transaction --
                </MenuItem>
                {transactions.map((t) => (
                  <MenuItem
                    key={t._id}
                    value={t._id}
                    sx={{
                      color: '#f8fafc',
                      background: '#111827',
                      '&:hover': { background: '#1e293b' },
                    }}
                  >
                    {t.transactionNumber} — {t.customerName || 'Walk-in Guest'} (
                    {formatAmount(t.totalAmount)})
                  </MenuItem>
                ))}
              </TextField>
            </Grid>

            {selectedTx && (
              <Grid item xs={12}>
                <TextField
                  select
                  fullWidth
                  label="Select Product to Return"
                  value={formData.productId}
                  onChange={(e) => setFormData({ ...formData, productId: e.target.value })}
                  InputLabelProps={{ shrink: true, style: { color: '#9ca3af' } }}
                  InputProps={{ style: { color: '#fff' } }}
                  SelectProps={{
                    MenuProps: {
                      PaperProps: {
                        sx: {
                          background: '#111827',
                          border: '1px solid #1f2937',
                          color: '#f8fafc',
                        },
                      },
                    },
                  }}
                >
                  <MenuItem value="" sx={{ color: '#9ca3af', background: '#111827' }}>
                    -- Select Purchased Item --
                  </MenuItem>
                  {selectedTx.items?.map((item: any) => (
                    <MenuItem
                      key={item.productId}
                      value={item.productId}
                      sx={{
                        color: '#f8fafc',
                        background: '#111827',
                        '&:hover': { background: '#1e293b' },
                      }}
                    >
                      {item.name} ({item.quantity} purchased @ {formatAmount(item.unitPrice)})
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>
            )}

            <Grid item xs={6}>
              <TextField
                fullWidth
                type="number"
                label="Return Quantity"
                value={formData.quantity}
                onChange={(e) => setFormData({ ...formData, quantity: Number(e.target.value) })}
                InputLabelProps={{ shrink: true, style: { color: '#9ca3af' } }}
                InputProps={{ style: { color: '#fff' } }}
              />
            </Grid>

            <Grid item xs={6}>
              <TextField
                select
                fullWidth
                label="Refund Method"
                value={formData.refundMethod}
                onChange={(e) => setFormData({ ...formData, refundMethod: e.target.value as any })}
                InputLabelProps={{ shrink: true, style: { color: '#9ca3af' } }}
                InputProps={{ style: { color: '#fff' } }}
                SelectProps={{
                  MenuProps: {
                    PaperProps: {
                      sx: { background: '#111827', border: '1px solid #1f2937', color: '#f8fafc' },
                    },
                  },
                }}
              >
                <MenuItem value="CASH" sx={{ color: '#f8fafc', background: '#111827' }}>
                  CASH REFUND
                </MenuItem>
                <MenuItem value="CARD" sx={{ color: '#f8fafc', background: '#111827' }}>
                  ORIGINAL CARD REFUND
                </MenuItem>
                <MenuItem value="STORE_CREDIT" sx={{ color: '#f8fafc', background: '#111827' }}>
                  STORE CREDIT / VOUCHER
                </MenuItem>
              </TextField>
            </Grid>

            <Grid item xs={12}>
              <TextField
                select
                fullWidth
                label="Inventory Inspection Disposition"
                value={formData.inventoryDisposition}
                onChange={(e) =>
                  setFormData({ ...formData, inventoryDisposition: e.target.value as any })
                }
                InputLabelProps={{ shrink: true, style: { color: '#9ca3af' } }}
                InputProps={{ style: { color: '#fff' } }}
                SelectProps={{
                  MenuProps: {
                    PaperProps: {
                      sx: { background: '#111827', border: '1px solid #1f2937', color: '#f8fafc' },
                    },
                  },
                }}
              >
                <MenuItem value="RESTOCK" sx={{ color: '#f8fafc', background: '#111827' }}>
                  RESTOCK - Perfect Condition (Add to Inventory)
                </MenuItem>
                <MenuItem value="QUARANTINE" sx={{ color: '#f8fafc', background: '#111827' }}>
                  QUARANTINE - Pending Testing / QC
                </MenuItem>
                <MenuItem value="DAMAGED" sx={{ color: '#f8fafc', background: '#111827' }}>
                  DAMAGED - Write Off / Scrap
                </MenuItem>
              </TextField>
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Return Reason"
                value={formData.returnReason}
                onChange={(e) => setFormData({ ...formData, returnReason: e.target.value })}
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
            onClick={handleProcessReturn}
            sx={{ background: '#8b5cf6', color: '#fff' }}
          >
            Process Refund
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
