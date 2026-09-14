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
import CategoryIcon from '@mui/icons-material/Category';
import { api } from '../../api/client.ts';
import { toast } from 'react-hot-toast';
import { useRegionalSettings } from '../../hooks/useRegionalSettings.js';

export default function SupplierProductManager() {
  const { formatAmount, currencySymbol } = useRegionalSettings();
  const [supplierProducts, setSupplierProducts] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [openModal, setOpenModal] = useState(false);
  const [formData, setFormData] = useState({
    supplierId: '',
    productId: '',
    supplierSku: '',
    purchaseCost: 10,
    minimumOrderQuantity: 10,
    leadTimeDays: 5,
  });

  const fetchData = async () => {
    try {
      const [spRes, supRes, prodRes] = await Promise.all([
        api.get('/procurement-advanced/supplier-products'),
        api.get('/procurement-advanced/suppliers'),
        api.get('/products'),
      ]);
      setSupplierProducts(spRes.data || []);
      setSuppliers(supRes.data || []);
      setProducts(prodRes.data?.data || prodRes.data || []);
    } catch {
      toast.error('Failed to load supplier product catalog.');
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleAddSupplierProduct = async () => {
    try {
      if (!formData.supplierId || !formData.productId || !formData.supplierSku) {
        toast.error('Please complete all required fields.');
        return;
      }
      await api.post('/procurement-advanced/supplier-products', {
        ...formData,
        purchaseCost: Number(formData.purchaseCost),
        minimumOrderQuantity: Number(formData.minimumOrderQuantity),
        leadTimeDays: Number(formData.leadTimeDays),
      });
      toast.success('Supplier product pricing mapped successfully!');
      setOpenModal(false);
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to add supplier product mapping.');
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
            <CategoryIcon fontSize="large" /> Supplier Product Catalog & Price History
          </Typography>
          <Typography variant="body2" sx={{ color: '#9ca3af', mt: 0.5 }}>
            Map vendor SKUs, configure tiered costs, MOQ rules, and maintain historical price trends
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
          Map Supplier Product
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
                <TableCell sx={{ color: '#9ca3af', fontWeight: 600 }}>Supplier SKU</TableCell>
                <TableCell sx={{ color: '#9ca3af', fontWeight: 600 }}>Supplier Name</TableCell>
                <TableCell sx={{ color: '#9ca3af', fontWeight: 600 }}>Internal Product</TableCell>
                <TableCell sx={{ color: '#9ca3af', fontWeight: 600 }}>Purchase Cost</TableCell>
                <TableCell sx={{ color: '#9ca3af', fontWeight: 600 }}>MOQ</TableCell>
                <TableCell sx={{ color: '#9ca3af', fontWeight: 600 }}>Lead Time</TableCell>
                <TableCell sx={{ color: '#9ca3af', fontWeight: 600 }}>Preferred</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {supplierProducts.map((sp) => (
                <TableRow key={sp._id} sx={{ '&:hover': { background: '#1e293b' } }}>
                  <TableCell sx={{ color: '#818cf8', fontWeight: 700 }}>{sp.supplierSku}</TableCell>
                  <TableCell sx={{ color: '#f8fafc' }}>
                    {sp.supplierId?.name || 'Supplier'}
                  </TableCell>
                  <TableCell sx={{ color: '#cbd5e1' }}>{sp.productId?.name || 'Product'}</TableCell>
                  <TableCell sx={{ color: '#34d399', fontWeight: 700 }}>
                    {formatAmount(sp.purchaseCost || 0)}
                  </TableCell>
                  <TableCell sx={{ color: '#9ca3af' }}>{sp.minimumOrderQuantity} units</TableCell>
                  <TableCell sx={{ color: '#9ca3af' }}>{sp.leadTimeDays} days</TableCell>
                  <TableCell>
                    <Chip
                      label={sp.isPreferred ? 'PREFERRED' : 'STANDARD'}
                      size="small"
                      sx={{
                        fontWeight: 600,
                        background: sp.isPreferred
                          ? 'rgba(16, 185, 129, 0.2)'
                          : 'rgba(107, 114, 128, 0.2)',
                        color: sp.isPreferred ? '#34d399' : '#9ca3af',
                      }}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* Map Supplier Product Dialog */}
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
          Map Supplier Product Pricing
        </DialogTitle>
        <DialogContent sx={{ mt: 2 }}>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <TextField
                select
                fullWidth
                label="Supplier"
                value={formData.supplierId}
                onChange={(e) => setFormData({ ...formData, supplierId: e.target.value })}
                SelectProps={{ native: true }}
                InputLabelProps={{ shrink: true, style: { color: '#9ca3af' } }}
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
                label="Product"
                value={formData.productId}
                onChange={(e) => setFormData({ ...formData, productId: e.target.value })}
                SelectProps={{ native: true }}
                InputLabelProps={{ shrink: true, style: { color: '#9ca3af' } }}
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
                label="Supplier SKU"
                value={formData.supplierSku}
                onChange={(e) => setFormData({ ...formData, supplierSku: e.target.value })}
                InputLabelProps={{ shrink: true, style: { color: '#9ca3af' } }}
                InputProps={{ style: { color: '#fff' } }}
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                type="number"
                label={`Purchase Cost (${currencySymbol})`}
                value={formData.purchaseCost}
                onChange={(e) => setFormData({ ...formData, purchaseCost: Number(e.target.value) })}
                InputLabelProps={{ shrink: true, style: { color: '#9ca3af' } }}
                InputProps={{ style: { color: '#fff' } }}
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                type="number"
                label="MOQ (Units)"
                value={formData.minimumOrderQuantity}
                onChange={(e) =>
                  setFormData({ ...formData, minimumOrderQuantity: Number(e.target.value) })
                }
                InputLabelProps={{ shrink: true, style: { color: '#9ca3af' } }}
                InputProps={{ style: { color: '#fff' } }}
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                type="number"
                label="Lead Time (Days)"
                value={formData.leadTimeDays}
                onChange={(e) => setFormData({ ...formData, leadTimeDays: Number(e.target.value) })}
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
            onClick={handleAddSupplierProduct}
            sx={{ background: '#8b5cf6', color: '#fff' }}
          >
            Save Mapping
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
