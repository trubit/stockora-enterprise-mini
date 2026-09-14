import { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Button,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Typography,
} from '@mui/material';
import LockIcon from '@mui/icons-material/Lock';
import PageHeader from '../../components/PageHeader';
import { apiClient } from '../../api/client';
import { toast } from 'react-hot-toast';

export default function FiscalPeriodManager() {
  const [periods, setPeriods] = useState<any[]>([]);
  const [closeModalOpen, setCloseModalOpen] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<any>(null);
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchPeriods = async () => {
    try {
      const res = await apiClient.get('/finance/periods');
      const resData = res.data?.data;
      const list = Array.isArray(resData) ? resData : Array.isArray(res.data) ? res.data : [];
      setPeriods(list);
    } catch {
      toast.error('Failed to load fiscal periods.');
      setPeriods([]);
    }
  };

  useEffect(() => {
    fetchPeriods();
  }, []);

  const handleOpenCloseModal = (period: any) => {
    setSelectedPeriod(period);
    setNotes('');
    setCloseModalOpen(true);
  };

  const handleConfirmClosePeriod = async () => {
    if (!selectedPeriod) return;
    setIsSubmitting(true);
    try {
      await apiClient.post(`/finance/periods/${selectedPeriod._id}/close`, { notes });
      toast.success(`Fiscal Period ${selectedPeriod.periodCode} Closed & Locked Successfully!`);
      setCloseModalOpen(false);
      fetchPeriods();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to close fiscal period.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <PageHeader
        title="Fiscal Period Governance & Period Locking"
        subtitle="Manage fiscal periods and enforce period locking controls to prevent retroactive accounting changes"
      />

      <Card sx={{ borderRadius: 2, boxShadow: 2 }}>
        <CardContent>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Period Code</TableCell>
                <TableCell>Period Name</TableCell>
                <TableCell>Fiscal Year / Quarter</TableCell>
                <TableCell>Date Range</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="center">Action</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {periods.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 3 }}>
                    No fiscal periods configured yet.
                  </TableCell>
                </TableRow>
              ) : (
                periods.map((p) => (
                  <TableRow key={p._id || p.periodCode}>
                    <TableCell sx={{ fontWeight: 'bold' }}>{p.periodCode}</TableCell>
                    <TableCell>{p.name || `Month ${p.month}`}</TableCell>
                    <TableCell>
                      FY {p.year} (Q{p.quarter || Math.ceil((p.month || 1) / 3)})
                    </TableCell>
                    <TableCell>
                      {new Date(p.startDate).toLocaleDateString()} —{' '}
                      {new Date(p.endDate).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={p.status}
                        size="small"
                        color={
                          p.status === 'OPEN'
                            ? 'success'
                            : p.status === 'CLOSED'
                              ? 'error'
                              : 'warning'
                        }
                      />
                    </TableCell>
                    <TableCell align="center">
                      {p.status === 'OPEN' && (
                        <Button
                          size="small"
                          variant="outlined"
                          color="error"
                          startIcon={<LockIcon />}
                          onClick={() => handleOpenCloseModal(p)}
                        >
                          Lock & Close
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog
        open={closeModalOpen}
        onClose={() => setCloseModalOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 'bold' }}>
          Lock Fiscal Period: {selectedPeriod?.periodCode}
        </DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          <Typography variant="body2" color="error.main" sx={{ fontWeight: 'bold' }}>
            Warning: Closing this period will reject any subsequent direct postings or edits for
            dates within this period.
          </Typography>
          <TextField
            label="Closing Notes / Audit Reference"
            placeholder="e.g. Month-end books closed by Financial Controller"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            multiline
            rows={3}
            fullWidth
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCloseModalOpen(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleConfirmClosePeriod}
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Locking...' : 'Lock & Close Period'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
