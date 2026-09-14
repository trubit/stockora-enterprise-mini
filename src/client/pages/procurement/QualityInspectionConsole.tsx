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
import VerifiedUserIcon from '@mui/icons-material/VerifiedUser';
import { api } from '../../api/client.ts';
import { toast } from 'react-hot-toast';

export default function QualityInspectionConsole() {
  const [inspections, setInspections] = useState<any[]>([]);
  const [goodsReceipts, setGoodsReceipts] = useState<any[]>([]);
  const [openModal, setOpenModal] = useState(false);
  const [formData, setFormData] = useState({
    grnId: '',
    productId: '',
    quantityInspected: 10,
    quantityPassed: 10,
    quantityFailed: 0,
    defectType: 'DAMAGED_PACKAGING',
    notes: 'Quality passed QA standards.',
  });

  const fetchData = async () => {
    try {
      const [qiRes, grnRes] = await Promise.all([
        api.get('/procurement-advanced/inspections'),
        api.get('/procurement-advanced/receiving'),
      ]);
      setInspections(qiRes.data || []);
      setGoodsReceipts(grnRes.data || []);
    } catch {
      toast.error('Failed to load quality inspections.');
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleProcessInspection = async () => {
    try {
      if (!formData.grnId) {
        toast.error('Please select a Goods Receipt.');
        return;
      }
      const selectedGRN = goodsReceipts.find((g) => g._id === formData.grnId);
      const targetProductId = formData.productId || selectedGRN?.items?.[0]?.productId;

      if (!targetProductId) {
        toast.error('No target product found for this GRN.');
        return;
      }

      await api.post('/procurement-advanced/inspections', {
        grnId: formData.grnId,
        items: [
          {
            productId: targetProductId,
            quantityInspected: Number(formData.quantityInspected),
            quantityPassed: Number(formData.quantityPassed),
            quantityFailed: Number(formData.quantityFailed),
            defectType: formData.defectType,
          },
        ],
        notes: formData.notes,
      });
      toast.success('Quality inspection submitted & quarantine recorded!');
      setOpenModal(false);
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to submit quality inspection.');
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
            <VerifiedUserIcon fontSize="large" /> Quality Inspection & Quarantine Console
          </Typography>
          <Typography variant="body2" sx={{ color: '#9ca3af', mt: 0.5 }}>
            Perform incoming quality inspections, record defect types, and isolate quarantined
            inventory
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
          New Inspection
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
                <TableCell sx={{ color: '#9ca3af', fontWeight: 600 }}>Inspection #</TableCell>
                <TableCell sx={{ color: '#9ca3af', fontWeight: 600 }}>GRN Reference</TableCell>
                <TableCell sx={{ color: '#9ca3af', fontWeight: 600 }}>Inspector</TableCell>
                <TableCell sx={{ color: '#9ca3af', fontWeight: 600 }}>Inspected Date</TableCell>
                <TableCell sx={{ color: '#9ca3af', fontWeight: 600 }}>Overall Result</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {inspections.map((qi) => (
                <TableRow key={qi._id} sx={{ '&:hover': { background: '#1e293b' } }}>
                  <TableCell sx={{ color: '#818cf8', fontWeight: 700 }}>
                    {qi.inspectionNumber}
                  </TableCell>
                  <TableCell sx={{ color: '#f8fafc' }}>{qi.grnNumber || 'GRN Reference'}</TableCell>
                  <TableCell sx={{ color: '#cbd5e1' }}>
                    {qi.inspectorName || 'QA Inspector'}
                  </TableCell>
                  <TableCell sx={{ color: '#9ca3af' }}>
                    {new Date(qi.inspectedAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={qi.overallStatus}
                      size="small"
                      sx={{
                        fontWeight: 600,
                        background:
                          qi.overallStatus === 'ACCEPTED'
                            ? 'rgba(16, 185, 129, 0.2)'
                            : 'rgba(239, 68, 68, 0.2)',
                        color: qi.overallStatus === 'ACCEPTED' ? '#34d399' : '#f87171',
                      }}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* New Quality Inspection Dialog */}
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
          Submit Quality Inspection
        </DialogTitle>
        <DialogContent sx={{ mt: 2 }}>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <TextField
                select
                fullWidth
                label="Target Goods Receipt (GRN)"
                value={formData.grnId}
                onChange={(e) => setFormData({ ...formData, grnId: e.target.value })}
                SelectProps={{ native: true }}
                InputLabelProps={{ shrink: true, style: { color: '#9ca3af' } }}
                InputProps={{ style: { color: '#fff' } }}
              >
                <option value="" style={{ background: '#111827' }}>
                  -- Select GRN --
                </option>
                {goodsReceipts.map((g) => (
                  <option key={g._id} value={g._id} style={{ background: '#111827' }}>
                    {g.grnNumber} (PO: {g.poNumber})
                  </option>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={4}>
              <TextField
                fullWidth
                type="number"
                label="Inspected Qty"
                value={formData.quantityInspected}
                onChange={(e) =>
                  setFormData({ ...formData, quantityInspected: Number(e.target.value) })
                }
                InputLabelProps={{ shrink: true, style: { color: '#9ca3af' } }}
                InputProps={{ style: { color: '#fff' } }}
              />
            </Grid>
            <Grid item xs={4}>
              <TextField
                fullWidth
                type="number"
                label="Passed Qty"
                value={formData.quantityPassed}
                onChange={(e) =>
                  setFormData({ ...formData, quantityPassed: Number(e.target.value) })
                }
                InputLabelProps={{ shrink: true, style: { color: '#9ca3af' } }}
                InputProps={{ style: { color: '#fff' } }}
              />
            </Grid>
            <Grid item xs={4}>
              <TextField
                fullWidth
                type="number"
                label="Failed Qty"
                value={formData.quantityFailed}
                onChange={(e) =>
                  setFormData({ ...formData, quantityFailed: Number(e.target.value) })
                }
                InputLabelProps={{ shrink: true, style: { color: '#9ca3af' } }}
                InputProps={{ style: { color: '#fff' } }}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Inspection Notes"
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
            onClick={handleProcessInspection}
            sx={{ background: '#8b5cf6', color: '#fff' }}
          >
            Save Quality Result
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
