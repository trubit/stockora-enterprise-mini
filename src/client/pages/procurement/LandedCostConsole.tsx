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
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import { api } from '../../api/client.ts';
import { toast } from 'react-hot-toast';
import { useRegionalSettings } from '../../hooks/useRegionalSettings.js';

export default function LandedCostConsole() {
  const { formatAmount, currencySymbol } = useRegionalSettings();
  const [allocations, setAllocations] = useState<any[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<any[]>([]);
  const [openModal, setOpenModal] = useState(false);
  const [formData, setFormData] = useState({
    purchaseOrderId: '',
    totalFreightCost: 250,
    totalCustomsDuty: 150,
    totalInsuranceCost: 50,
    otherCosts: 25,
    allocationMethod: 'BY_VALUE',
  });

  const fetchData = async () => {
    try {
      const [costRes, poRes] = await Promise.all([
        api.get('/procurement-replenishment/landed-costs'),
        api.get('/procurement-advanced/purchase-orders'),
      ]);
      setAllocations(costRes.data || []);
      setPurchaseOrders(poRes.data || []);
    } catch {
      toast.error('Failed to load landed cost allocations.');
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleApplyLandedCost = async () => {
    try {
      if (!formData.purchaseOrderId) {
        toast.error('Please select a Purchase Order.');
        return;
      }
      await api.post('/procurement-replenishment/landed-costs', {
        purchaseOrderId: formData.purchaseOrderId,
        totalFreightCost: Number(formData.totalFreightCost),
        totalCustomsDuty: Number(formData.totalCustomsDuty),
        totalInsuranceCost: Number(formData.totalInsuranceCost),
        otherCosts: Number(formData.otherCosts),
        allocationMethod: formData.allocationMethod,
      });
      toast.success('Landed costs allocated & inventory unit costs updated!');
      setOpenModal(false);
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to apply landed cost allocation.');
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
            <AttachMoneyIcon fontSize="large" /> Landed Cost Allocation & Inventory Valuation
          </Typography>
          <Typography variant="body2" sx={{ color: '#9ca3af', mt: 0.5 }}>
            Allocate freight, import duties, customs & insurance into item cost prices for accurate
            inventory valuation
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
          Allocate Landed Cost
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
                <TableCell sx={{ color: '#9ca3af', fontWeight: 600 }}>Allocation #</TableCell>
                <TableCell sx={{ color: '#9ca3af', fontWeight: 600 }}>PO Reference</TableCell>
                <TableCell sx={{ color: '#9ca3af', fontWeight: 600 }}>
                  Freight / Duty / Insurance
                </TableCell>
                <TableCell sx={{ color: '#9ca3af', fontWeight: 600 }}>Total Landed Cost</TableCell>
                <TableCell sx={{ color: '#9ca3af', fontWeight: 600 }}>Allocation Method</TableCell>
                <TableCell sx={{ color: '#9ca3af', fontWeight: 600 }}>Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {allocations.map((lca) => (
                <TableRow key={lca._id} sx={{ '&:hover': { background: '#1e293b' } }}>
                  <TableCell sx={{ color: '#818cf8', fontWeight: 700 }}>
                    {lca.allocationNumber}
                  </TableCell>
                  <TableCell sx={{ color: '#f8fafc' }}>
                    {lca.purchaseOrderId?.poNumber || 'PO Ref'}
                  </TableCell>
                  <TableCell sx={{ color: '#cbd5e1' }}>
                    {formatAmount(lca.totalFreightCost)} / {formatAmount(lca.totalCustomsDuty)} /{' '}
                    {formatAmount(lca.totalInsuranceCost)}
                  </TableCell>
                  <TableCell sx={{ color: '#34d399', fontWeight: 700 }}>
                    {formatAmount(lca.totalLandedCost || 0)}
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={lca.allocationMethod}
                      size="small"
                      sx={{ background: '#374151', color: '#cbd5e1', fontWeight: 600 }}
                    />
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={lca.status}
                      size="small"
                      sx={{
                        fontWeight: 600,
                        background:
                          lca.status === 'APPLIED'
                            ? 'rgba(16, 185, 129, 0.2)'
                            : 'rgba(56, 189, 248, 0.2)',
                        color: lca.status === 'APPLIED' ? '#34d399' : '#38bdf8',
                      }}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* Landed Cost Dialog */}
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
          Allocate Landed Cost Expenses
        </DialogTitle>
        <DialogContent sx={{ mt: 2 }}>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <TextField
                select
                fullWidth
                label="Target Purchase Order"
                value={formData.purchaseOrderId}
                onChange={(e) => setFormData({ ...formData, purchaseOrderId: e.target.value })}
                SelectProps={{ native: true }}
                InputLabelProps={{ shrink: true, style: { color: '#9ca3af' } }}
                InputProps={{ style: { color: '#fff' } }}
              >
                <option value="" style={{ background: '#111827' }}>
                  -- Select Purchase Order --
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
                label={`Freight Shipping Cost (${currencySymbol})`}
                value={formData.totalFreightCost}
                onChange={(e) =>
                  setFormData({ ...formData, totalFreightCost: Number(e.target.value) })
                }
                InputLabelProps={{ shrink: true, style: { color: '#9ca3af' } }}
                InputProps={{ style: { color: '#fff' } }}
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                type="number"
                label={`Customs / Import Duty (${currencySymbol})`}
                value={formData.totalCustomsDuty}
                onChange={(e) =>
                  setFormData({ ...formData, totalCustomsDuty: Number(e.target.value) })
                }
                InputLabelProps={{ shrink: true, style: { color: '#9ca3af' } }}
                InputProps={{ style: { color: '#fff' } }}
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                type="number"
                label={`Insurance Cost (${currencySymbol})`}
                value={formData.totalInsuranceCost}
                onChange={(e) =>
                  setFormData({ ...formData, totalInsuranceCost: Number(e.target.value) })
                }
                InputLabelProps={{ shrink: true, style: { color: '#9ca3af' } }}
                InputProps={{ style: { color: '#fff' } }}
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                type="number"
                label={`Handling / Other Costs (${currencySymbol})`}
                value={formData.otherCosts}
                onChange={(e) => setFormData({ ...formData, otherCosts: Number(e.target.value) })}
                InputLabelProps={{ shrink: true, style: { color: '#9ca3af' } }}
                InputProps={{ style: { color: '#fff' } }}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                select
                fullWidth
                label="Allocation Strategy"
                value={formData.allocationMethod}
                onChange={(e) => setFormData({ ...formData, allocationMethod: e.target.value })}
                SelectProps={{ native: true }}
                InputLabelProps={{ shrink: true, style: { color: '#9ca3af' } }}
                InputProps={{ style: { color: '#fff' } }}
              >
                <option value="BY_VALUE" style={{ background: '#111827' }}>
                  BY VALUE - Proportional to Item Total Value
                </option>
                <option value="BY_QUANTITY" style={{ background: '#111827' }}>
                  BY QUANTITY - Proportional to Unit Count
                </option>
                <option value="EQUAL" style={{ background: '#111827' }}>
                  EQUAL SPLIT - Even Distribution Across Line Items
                </option>
              </TextField>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ p: 2.5, borderTop: '1px solid #1f2937' }}>
          <Button onClick={() => setOpenModal(false)} sx={{ color: '#9ca3af' }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleApplyLandedCost}
            sx={{ background: '#8b5cf6', color: '#fff' }}
          >
            Apply to Inventory Costs
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
