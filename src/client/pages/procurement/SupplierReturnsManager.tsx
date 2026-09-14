import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  TextField,
  Grid,
  Chip,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import ReturnIcon from '@mui/icons-material/AssignmentReturn';
import { api } from '../../api/client.ts';
import { toast } from 'react-hot-toast';
import { useRegionalSettings } from '../../hooks/useRegionalSettings.js';

export default function SupplierReturnsManager() {
  const { formatAmount, currencySymbol } = useRegionalSettings();
  const [supplierReturns, setSupplierReturns] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [openModal, setOpenModal] = useState(false);
  const [formData, setFormData] = useState({
    supplierId: '',
    productId: '',
    quantity: 5,
    unitCost: 25,
    returnReason: 'Defective shipment items',
  });

  const fetchData = async () => {
    try {
      const [retRes, supRes, prodRes] = await Promise.all([
        api.get('/procurement-advanced/returns'),
        api.get('/procurement-advanced/suppliers'),
        api.get('/products'),
      ]);
      setSupplierReturns(retRes.data || []);
      setSuppliers(supRes.data || []);
      setProducts(prodRes.data?.data || prodRes.data || []);
    } catch {
      toast.error('Failed to load supplier returns data.');
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreateReturn = async () => {
    try {
      if (!formData.supplierId || !formData.productId) {
        toast.error('Please select both supplier and product.');
        return;
      }
      await api.post('/procurement-advanced/returns', {
        supplierId: formData.supplierId,
        items: [
          {
            productId: formData.productId,
            quantity: Number(formData.quantity),
            unitCost: Number(formData.unitCost),
            returnReason: formData.returnReason,
          },
        ],
      });
      toast.success('Supplier return request created!');
      setOpenModal(false);
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to create supplier return.');
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
            <ReturnIcon fontSize="large" /> Supplier Returns & Credit Management
          </Typography>
          <Typography variant="body2" sx={{ color: '#9ca3af', mt: 0.5 }}>
            Initiate vendor return requests for defective/damaged stock and auto-generate supplier
            credit notes
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
          Create Supplier Return
        </Button>
      </Box>

      <Alert
        severity="info"
        sx={{ mb: 3, background: '#1e293b', color: '#38bdf8', border: '1px solid #334155' }}
      >
        Supplier returns deduct defective quantities from inventory and generate credit memos
        integrated with Accounts Payable.
      </Alert>

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
                <TableCell sx={{ color: '#9ca3af', fontWeight: 600 }}>Return #</TableCell>
                <TableCell sx={{ color: '#9ca3af', fontWeight: 600 }}>Created Date</TableCell>
                <TableCell sx={{ color: '#9ca3af', fontWeight: 600 }}>
                  Total Credit Amount
                </TableCell>
                <TableCell sx={{ color: '#9ca3af', fontWeight: 600 }}>Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {supplierReturns.map((ret) => (
                <TableRow key={ret._id} sx={{ '&:hover': { background: '#1e293b' } }}>
                  <TableCell sx={{ color: '#818cf8', fontWeight: 700 }}>
                    {ret.returnNumber}
                  </TableCell>
                  <TableCell sx={{ color: '#9ca3af' }}>
                    {new Date(ret.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell sx={{ color: '#34d399', fontWeight: 700 }}>
                    {formatAmount(ret.totalAmount || 0)}
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={ret.status}
                      size="small"
                      sx={{
                        fontWeight: 600,
                        background:
                          ret.status === 'APPROVED'
                            ? 'rgba(16, 185, 129, 0.2)'
                            : 'rgba(245, 158, 11, 0.2)',
                        color: ret.status === 'APPROVED' ? '#34d399' : '#fbbf24',
                      }}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* Create Return Modal */}
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
          Create Supplier Return
        </DialogTitle>
        <DialogContent sx={{ mt: 2 }}>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <TextField
                select
                fullWidth
                label="Target Supplier"
                value={formData.supplierId}
                onChange={(e) => setFormData({ ...formData, supplierId: e.target.value })}
                SelectProps={{ native: true }}
                InputLabelProps={{ style: { color: '#9ca3af' } }}
                InputProps={{ style: { color: '#fff' } }}
              >
                <option value="" style={{ background: '#111827' }}>
                  -- Select Supplier --
                </option>
                {suppliers.map((s) => (
                  <option key={s._id} value={s._id} style={{ background: '#111827' }}>
                    {s.name} ({s.code})
                  </option>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                select
                fullWidth
                label="Defective Product"
                value={formData.productId}
                onChange={(e) => setFormData({ ...formData, productId: e.target.value })}
                SelectProps={{ native: true }}
                InputLabelProps={{ style: { color: '#9ca3af' } }}
                InputProps={{ style: { color: '#fff' } }}
              >
                <option value="" style={{ background: '#111827' }}>
                  -- Select Product --
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
                label="Quantity to Return"
                value={formData.quantity}
                onChange={(e) => setFormData({ ...formData, quantity: Number(e.target.value) })}
                InputLabelProps={{ style: { color: '#9ca3af' } }}
                InputProps={{ style: { color: '#fff' } }}
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                type="number"
                label={`Unit Cost (${currencySymbol})`}
                value={formData.unitCost}
                onChange={(e) => setFormData({ ...formData, unitCost: Number(e.target.value) })}
                InputLabelProps={{ style: { color: '#9ca3af' } }}
                InputProps={{ style: { color: '#fff' } }}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Return Reason"
                value={formData.returnReason}
                onChange={(e) => setFormData({ ...formData, returnReason: e.target.value })}
                InputLabelProps={{ style: { color: '#9ca3af' } }}
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
            onClick={handleCreateReturn}
            sx={{ background: '#8b5cf6', color: '#fff' }}
          >
            Submit Supplier Return
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
