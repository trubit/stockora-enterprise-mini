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
import QrCodeScannerIcon from '@mui/icons-material/QrCodeScanner';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import { api } from '../../api/client.ts';
import { toast } from 'react-hot-toast';
import { useRegionalSettings } from '../../hooks/useRegionalSettings.js';

export default function GoodsReceivingConsole() {
  const { formatAmount } = useRegionalSettings();
  const [goodsReceipts, setGoodsReceipts] = useState<any[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<any[]>([]);
  const [openModal, setOpenModal] = useState(false);
  const [formData, setFormData] = useState({
    poId: '',
    productId: '',
    quantityReceived: 10,
    batchNumber: 'BATCH-2026-001',
    notes: 'Received shipment in good order.',
  });

  const fetchData = async () => {
    try {
      const [grnRes, poRes] = await Promise.all([
        api.get('/procurement-advanced/receiving'),
        api.get('/procurement-advanced/purchase-orders'),
      ]);
      setGoodsReceipts(grnRes.data || []);
      setPurchaseOrders(poRes.data || []);
    } catch {
      toast.error('Failed to load goods receiving data.');
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleReceiveGoods = async () => {
    try {
      if (!formData.poId) {
        toast.error('Please select a Purchase Order.');
        return;
      }
      const selectedPO = purchaseOrders.find((p) => p._id === formData.poId);
      const targetProductId = formData.productId || selectedPO?.items?.[0]?.productId;

      if (!targetProductId) {
        toast.error('No target product found for this PO.');
        return;
      }

      await api.post('/procurement-advanced/receiving', {
        poId: formData.poId,
        items: [
          {
            productId: targetProductId,
            quantityReceived: Number(formData.quantityReceived),
            batchNumber: formData.batchNumber,
          },
        ],
        notes: formData.notes,
      });
      toast.success('Shipment received and stock updated!');
      setOpenModal(false);
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to process goods receipt.');
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
            <LocalShippingIcon fontSize="large" /> Barcode Goods Receiving Console
          </Typography>
          <Typography variant="body2" sx={{ color: '#9ca3af', mt: 0.5 }}>
            Process incoming vendor shipments against POs, run barcode scans & over-receiving
            validation
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<QrCodeScannerIcon />}
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
          Receive Shipment
        </Button>
      </Box>

      <Alert
        severity="info"
        sx={{ mb: 3, background: '#1e293b', color: '#38bdf8', border: '1px solid #334155' }}
      >
        Over-receiving variance limit is strictly capped at 5%. Received items automatically update
        weighted average product costs.
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
                <TableCell sx={{ color: '#9ca3af', fontWeight: 600 }}>GRN #</TableCell>
                <TableCell sx={{ color: '#9ca3af', fontWeight: 600 }}>PO Reference</TableCell>
                <TableCell sx={{ color: '#9ca3af', fontWeight: 600 }}>Received Date</TableCell>
                <TableCell sx={{ color: '#9ca3af', fontWeight: 600 }}>Quality Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {goodsReceipts.map((grn) => (
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
                        background:
                          grn.inspectionStatus === 'PASSED'
                            ? 'rgba(16, 185, 129, 0.2)'
                            : 'rgba(245, 158, 11, 0.2)',
                        color: grn.inspectionStatus === 'PASSED' ? '#34d399' : '#fbbf24',
                      }}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* Receive Shipment Modal */}
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
          Process Goods Receipt
        </DialogTitle>
        <DialogContent sx={{ mt: 2 }}>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <TextField
                select
                fullWidth
                label="Select Purchase Order"
                value={formData.poId}
                onChange={(e) => setFormData({ ...formData, poId: e.target.value })}
                SelectProps={{ native: true }}
                InputLabelProps={{ shrink: true, style: { color: '#9ca3af' } }}
                InputProps={{ style: { color: '#fff' } }}
              >
                <option value="" style={{ background: '#111827' }}>
                  -- Select PO --
                </option>
                {purchaseOrders.map((po) => (
                  <option key={po._id} value={po._id} style={{ background: '#111827' }}>
                    {po.poNumber} - {formatAmount(po.totalAmount)}
                  </option>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                type="number"
                label="Quantity Received"
                value={formData.quantityReceived}
                onChange={(e) =>
                  setFormData({ ...formData, quantityReceived: Number(e.target.value) })
                }
                InputLabelProps={{ shrink: true, style: { color: '#9ca3af' } }}
                InputProps={{ style: { color: '#fff' } }}
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                label="Batch / Lot #"
                value={formData.batchNumber}
                onChange={(e) => setFormData({ ...formData, batchNumber: e.target.value })}
                InputLabelProps={{ shrink: true, style: { color: '#9ca3af' } }}
                InputProps={{ style: { color: '#fff' } }}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Receiving Notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
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
            onClick={handleReceiveGoods}
            sx={{ background: '#8b5cf6', color: '#fff' }}
          >
            Confirm Goods Receipt
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
