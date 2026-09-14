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
  Alert,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import FactCheckIcon from '@mui/icons-material/FactCheck';
import { api } from '../../api/client.ts';
import { toast } from 'react-hot-toast';
import { useRegionalSettings } from '../../hooks/useRegionalSettings.js';

export default function ThreeWayMatchingConsole() {
  const { formatAmount, currencySymbol } = useRegionalSettings();
  const [invoices, setInvoices] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<any[]>([]);
  const [openModal, setOpenModal] = useState(false);
  const [formData, setFormData] = useState({
    supplierId: '',
    invoiceNumber: `INV-${Date.now().toString().slice(-6)}`,
    poId: '',
    amount: 1000,
  });

  const fetchData = async () => {
    try {
      const [invRes, supRes, poRes] = await Promise.all([
        api.get('/procurement-advanced/invoices'),
        api.get('/procurement-advanced/suppliers'),
        api.get('/procurement-advanced/purchase-orders'),
      ]);
      setInvoices(invRes.data || []);
      setSuppliers(supRes.data || []);
      setPurchaseOrders(poRes.data || []);
    } catch {
      toast.error('Failed to load invoice matching data.');
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleMatchInvoice = async () => {
    try {
      if (!formData.supplierId || !formData.poId || !formData.invoiceNumber) {
        toast.error('Please complete all required fields.');
        return;
      }
      await api.post('/procurement-advanced/match-invoice', {
        supplierId: formData.supplierId,
        poId: formData.poId,
        invoiceNumber: formData.invoiceNumber,
        amount: Number(formData.amount),
      });
      toast.success('Supplier invoice 3-way match processed!');
      setOpenModal(false);
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to process 3-way invoice match.');
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
            <FactCheckIcon fontSize="large" /> Three-Way Invoice Matching Engine
          </Typography>
          <Typography variant="body2" sx={{ color: '#9ca3af', mt: 0.5 }}>
            Automated verification across Purchase Orders, Goods Receipts & Supplier Invoices with
            duplicate invoice protection
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
          Submit Supplier Invoice
        </Button>
      </Box>

      <Alert
        severity="info"
        sx={{ mb: 3, background: '#1e293b', color: '#38bdf8', border: '1px solid #334155' }}
      >
        Invoices that match Purchase Orders & Goods Receipts within configured price/quantity
        tolerances are automatically posted to Accounts Payable.
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
                <TableCell sx={{ color: '#9ca3af', fontWeight: 600 }}>Invoice #</TableCell>
                <TableCell sx={{ color: '#9ca3af', fontWeight: 600 }}>Supplier</TableCell>
                <TableCell sx={{ color: '#9ca3af', fontWeight: 600 }}>PO Number</TableCell>
                <TableCell sx={{ color: '#9ca3af', fontWeight: 600 }}>Amount</TableCell>
                <TableCell sx={{ color: '#9ca3af', fontWeight: 600 }}>3-Way Match Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {invoices.map((inv) => (
                <TableRow key={inv._id} sx={{ '&:hover': { background: '#1e293b' } }}>
                  <TableCell sx={{ color: '#818cf8', fontWeight: 700 }}>
                    {inv.invoiceNumber}
                  </TableCell>
                  <TableCell sx={{ color: '#f8fafc' }}>{inv.supplierName || 'Supplier'}</TableCell>
                  <TableCell sx={{ color: '#9ca3af' }}>{inv.poNumber || 'N/A'}</TableCell>
                  <TableCell sx={{ color: '#34d399', fontWeight: 700 }}>
                    {formatAmount(inv.amount || 0)}
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={inv.matchingStatus}
                      size="small"
                      sx={{
                        fontWeight: 600,
                        background:
                          inv.matchingStatus === 'MATCHED'
                            ? 'rgba(16, 185, 129, 0.2)'
                            : 'rgba(239, 68, 68, 0.2)',
                        color: inv.matchingStatus === 'MATCHED' ? '#34d399' : '#f87171',
                      }}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* Submit Invoice Modal */}
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
          Submit Invoice for 3-Way Match
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
                label="Linked PO"
                value={formData.poId}
                onChange={(e) => setFormData({ ...formData, poId: e.target.value })}
                SelectProps={{ native: true }}
                InputLabelProps={{ shrink: true, style: { color: '#9ca3af' } }}
                InputProps={{ style: { color: '#fff' } }}
              >
                <option value="" style={{ background: '#111827' }}>
                  -- Select PO --
                </option>
                {purchaseOrders.map((p) => (
                  <option key={p._id} value={p._id} style={{ background: '#111827' }}>
                    {p.poNumber} ({formatAmount(p.totalAmount)})
                  </option>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                label="Invoice Number"
                value={formData.invoiceNumber}
                onChange={(e) => setFormData({ ...formData, invoiceNumber: e.target.value })}
                InputLabelProps={{ shrink: true, style: { color: '#9ca3af' } }}
                InputProps={{ style: { color: '#fff' } }}
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                type="number"
                label={`Invoice Total Amount (${currencySymbol})`}
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: Number(e.target.value) })}
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
            onClick={handleMatchInvoice}
            sx={{ background: '#8b5cf6', color: '#fff' }}
          >
            Run 3-Way Match
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
