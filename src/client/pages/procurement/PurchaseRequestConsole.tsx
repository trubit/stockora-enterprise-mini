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
import ShoppingBagIcon from '@mui/icons-material/ShoppingBag';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { api } from '../../api/client.ts';
import { toast } from 'react-hot-toast';
import { useRegionalSettings } from '../../hooks/useRegionalSettings.js';

export default function PurchaseRequestConsole() {
  const { formatAmount, currencySymbol } = useRegionalSettings();
  const [requisitions, setRequisitions] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [openModal, setOpenModal] = useState(false);
  const [formData, setFormData] = useState({
    productId: '',
    quantity: 10,
    estimatedCost: 15,
    priority: 'MEDIUM',
    reason: 'Restocking inventory',
  });

  const fetchRequisitions = async () => {
    try {
      const [reqRes, prodRes] = await Promise.all([
        api.get('/procurement-advanced/requests'),
        api.get('/products'),
      ]);
      setRequisitions(reqRes.data || []);
      setProducts(prodRes.data?.data || prodRes.data || []);
    } catch {
      toast.error('Failed to load requisitions.');
    }
  };

  useEffect(() => {
    fetchRequisitions();
  }, []);

  const handleCreateRequisition = async () => {
    try {
      if (!formData.productId) {
        toast.error('Please select a product.');
        return;
      }
      await api.post('/procurement-advanced/requests', {
        items: [
          {
            productId: formData.productId,
            quantity: Number(formData.quantity),
            estimatedCost: Number(formData.estimatedCost),
            reason: formData.reason,
          },
        ],
        priority: formData.priority,
      });
      toast.success('Purchase requisition submitted!');
      setOpenModal(false);
      fetchRequisitions();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to submit requisition.');
    }
  };

  const handleApproveRequisition = async (id: string) => {
    try {
      await api.post(`/procurement-advanced/requests/${id}/approve`);
      toast.success('Purchase requisition approved!');
      fetchRequisitions();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to approve requisition.');
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
            <ShoppingBagIcon fontSize="large" /> Purchase Requisitions & Approvals
          </Typography>
          <Typography variant="body2" sx={{ color: '#9ca3af', mt: 0.5 }}>
            Submit internal purchase requests, route through threshold approval policies, and
            convert to POs
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
          New Requisition
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
                <TableCell sx={{ color: '#9ca3af', fontWeight: 600 }}>Requisition #</TableCell>
                <TableCell sx={{ color: '#9ca3af', fontWeight: 600 }}>Requester</TableCell>
                <TableCell sx={{ color: '#9ca3af', fontWeight: 600 }}>Priority</TableCell>
                <TableCell sx={{ color: '#9ca3af', fontWeight: 600 }}>Estimated Cost</TableCell>
                <TableCell sx={{ color: '#9ca3af', fontWeight: 600 }}>Status</TableCell>
                <TableCell align="right" sx={{ color: '#9ca3af', fontWeight: 600 }}>
                  Actions
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {requisitions.map((req) => (
                <TableRow key={req._id} sx={{ '&:hover': { background: '#1e293b' } }}>
                  <TableCell sx={{ color: '#818cf8', fontWeight: 700 }}>
                    {req.requisitionNumber}
                  </TableCell>
                  <TableCell sx={{ color: '#f8fafc' }}>
                    {req.requesterName || 'Department Staff'}
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={req.priority}
                      size="small"
                      sx={{ background: '#374151', color: '#cbd5e1', fontWeight: 600 }}
                    />
                  </TableCell>
                  <TableCell sx={{ color: '#34d399', fontWeight: 700 }}>
                    {formatAmount(req.estimatedTotalCost || 0)}
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={req.status}
                      size="small"
                      sx={{
                        fontWeight: 600,
                        background:
                          req.status === 'APPROVED'
                            ? 'rgba(16, 185, 129, 0.2)'
                            : 'rgba(245, 158, 11, 0.2)',
                        color: req.status === 'APPROVED' ? '#34d399' : '#fbbf24',
                      }}
                    />
                  </TableCell>
                  <TableCell align="right">
                    {req.status === 'SUBMITTED' && (
                      <Button
                        size="small"
                        variant="contained"
                        startIcon={<CheckCircleIcon />}
                        onClick={() => handleApproveRequisition(req._id)}
                        sx={{
                          background: '#10b981',
                          color: '#fff',
                          '&:hover': { background: '#059669' },
                        }}
                      >
                        Approve
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* New Requisition Dialog */}
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
          New Purchase Requisition
        </DialogTitle>
        <DialogContent sx={{ mt: 2 }}>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <TextField
                select
                fullWidth
                label="Select Product"
                value={formData.productId}
                onChange={(e) => setFormData({ ...formData, productId: e.target.value })}
                SelectProps={{ native: true }}
                InputLabelProps={{ shrink: true, style: { color: '#9ca3af' } }}
                InputProps={{ style: { color: '#fff' } }}
              >
                <option value="" style={{ background: '#111827' }}>
                  -- Select Target Product --
                </option>
                {products.map((p) => (
                  <option key={p._id} value={p._id} style={{ background: '#111827' }}>
                    {p.name} ({p.sku})
                  </option>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                type="number"
                label="Quantity Needed"
                value={formData.quantity}
                onChange={(e) => setFormData({ ...formData, quantity: Number(e.target.value) })}
                InputLabelProps={{ shrink: true, style: { color: '#9ca3af' } }}
                InputProps={{ style: { color: '#fff' } }}
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                type="number"
                label={`Estimated Unit Cost (${currencySymbol})`}
                value={formData.estimatedCost}
                onChange={(e) =>
                  setFormData({ ...formData, estimatedCost: Number(e.target.value) })
                }
                InputLabelProps={{ shrink: true, style: { color: '#9ca3af' } }}
                InputProps={{ style: { color: '#fff' } }}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Requisition Reason"
                value={formData.reason}
                onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
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
            onClick={handleCreateRequisition}
            sx={{ background: '#8b5cf6', color: '#fff' }}
          >
            Submit Request
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
