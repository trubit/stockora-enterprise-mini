import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiClient } from '../../api/client.ts';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Button,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  CircularProgress,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import PageHeader from '../../components/PageHeader.tsx';
import { toast } from 'react-hot-toast';

export default function ReorderRecommendations() {
  const [overrideModalOpen, setOverrideModalOpen] = useState(false);
  const [selectedRec, setSelectedRec] = useState<any>(null);
  const [overrideQty, setOverrideQty] = useState('');
  const [overrideReason, setOverrideReason] = useState('');

  const {
    data: recommendations,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['reorder-recommendations'],
    queryFn: async () => {
      const res = await apiClient.get('/inventory-intelligence/reorders');
      return res.data.data;
    },
  });

  const overrideMutation = useMutation({
    mutationFn: async () => {
      if (!selectedRec || !overrideQty || !overrideReason) {
        throw new Error('Please enter both quantity and a detailed reason.');
      }
      const res = await apiClient.post(
        `/inventory-intelligence/reorders/${selectedRec._id}/override`,
        {
          overrideQuantity: Number(overrideQty),
          reason: overrideReason,
        }
      );
      return res.data.data;
    },
    onSuccess: () => {
      toast.success('Recommendation overridden successfully with audit log!');
      setOverrideModalOpen(false);
      setSelectedRec(null);
      setOverrideQty('');
      setOverrideReason('');
      refetch();
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to override recommendation.');
    },
  });

  const handleOpenOverride = (rec: any) => {
    setSelectedRec(rec);
    setOverrideQty(String(rec.recommendedQuantity));
    setOverrideReason('');
    setOverrideModalOpen(true);
  };

  return (
    <Box sx={{ p: 3 }}>
      <PageHeader
        title="Smart Replenishment & Reorder Recommendations"
        subtitle="Automated Safety Stock, Reorder Point Engine & Procurement Drafts"
      />

      <Card>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
            <Typography variant="h6" fontWeight={600}>
              Pending Reorder Recommendations
            </Typography>
            <Button variant="outlined" onClick={() => refetch()}>
              Refresh Recommendations
            </Button>
          </Box>

          {isLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
              <CircularProgress />
            </Box>
          ) : (
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead sx={{ bgcolor: '#f8fafc' }}>
                  <TableRow>
                    <TableCell>Product SKU / Name</TableCell>
                    <TableCell align="right">Current Stock</TableCell>
                    <TableCell align="right">Reorder Point (ROP)</TableCell>
                    <TableCell align="right">Safety Stock</TableCell>
                    <TableCell align="right">Lead Time Demand</TableCell>
                    <TableCell align="right">Recommended Order Qty</TableCell>
                    <TableCell>Supplier</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell align="center">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(recommendations || []).map((rec: any) => (
                    <TableRow key={rec._id}>
                      <TableCell>
                        <Typography variant="subtitle2">{rec.productSku}</Typography>
                        <Typography variant="caption" color="textSecondary">
                          {rec.productName}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">{rec.currentStock}</TableCell>
                      <TableCell align="right">{rec.reorderPoint}</TableCell>
                      <TableCell align="right">{rec.safetyStock}</TableCell>
                      <TableCell align="right">{rec.expectedDemandLeadTime}</TableCell>
                      <TableCell align="right">
                        <Typography fontWeight={700} color="primary.main">
                          {rec.status === 'OVERRIDDEN'
                            ? rec.overrideQuantity
                            : rec.recommendedQuantity}
                        </Typography>
                      </TableCell>
                      <TableCell>{rec.supplierName || 'Primary Supplier'}</TableCell>
                      <TableCell>
                        <Chip
                          label={rec.status}
                          size="small"
                          color={rec.status === 'OVERRIDDEN' ? 'info' : 'warning'}
                        />
                      </TableCell>
                      <TableCell align="center">
                        <Button
                          size="small"
                          startIcon={<EditIcon />}
                          onClick={() => handleOpenOverride(rec)}
                        >
                          Override
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>

      {/* Override Modal */}
      <Dialog
        open={overrideModalOpen}
        onClose={() => setOverrideModalOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Override Reorder Recommendation</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
            Adjust the reorder quantity for <strong>{selectedRec?.productSku}</strong>. Mandatory
            audit log entry will be created.
          </Typography>
          <TextField
            fullWidth
            label="Override Quantity"
            type="number"
            value={overrideQty}
            onChange={(e) => setOverrideQty(e.target.value)}
            sx={{ mb: 2 }}
          />
          <TextField
            fullWidth
            multiline
            rows={3}
            label="Reason for Override (Min 5 chars)"
            value={overrideReason}
            onChange={(e) => setOverrideReason(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOverrideModalOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            disabled={overrideMutation.isPending}
            onClick={() => overrideMutation.mutate()}
          >
            Submit Override
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
