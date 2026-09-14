import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiClient } from '../../api/client.ts';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Button,
  TextField,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  CircularProgress,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import PageHeader from '../../components/PageHeader.tsx';
import { toast } from 'react-hot-toast';
import { useRegionalSettings } from '../../hooks/useRegionalSettings.js';

export default function CouponsPromotions() {
  const { formatAmount, currencySymbol } = useRegionalSettings();
  const [modalOpen, setModalOpen] = useState(false);
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [discountType, setDiscountType] = useState('PERCENTAGE');
  const [discountValue, setDiscountValue] = useState('10');
  const [minPurchaseAmount, setMinPurchaseAmount] = useState('50');

  const {
    data: coupons,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['crm-coupons'],
    queryFn: async () => {
      const res = await apiClient.get('/crm/coupons');
      return res.data.data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!code || !discountValue) throw new Error('Code and discount value are required.');
      const res = await apiClient.post('/crm/coupons', {
        code,
        description,
        discountType,
        discountValue: Number(discountValue),
        minPurchaseAmount: Number(minPurchaseAmount),
      });
      return res.data.data;
    },
    onSuccess: () => {
      toast.success('Promotional Coupon created!');
      setModalOpen(false);
      setCode('');
      setDescription('');
      refetch();
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to create coupon.');
    },
  });

  return (
    <Box sx={{ p: 3 }}>
      <PageHeader
        title="Promotional Coupon & Discount Engine"
        subtitle="Percentage & Fixed Discounts, Minimum Purchase Thresholds & Expiration Controls"
      />

      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 3 }}>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setModalOpen(true)}>
          Create Coupon
        </Button>
      </Box>

      <Card>
        <CardContent>
          <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>
            Active Promotional Coupons
          </Typography>

          {isLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
              <CircularProgress />
            </Box>
          ) : (
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead sx={{ bgcolor: '#f8fafc' }}>
                  <TableRow>
                    <TableCell>Coupon Code</TableCell>
                    <TableCell>Description</TableCell>
                    <TableCell>Discount</TableCell>
                    <TableCell align="right">Min Spend</TableCell>
                    <TableCell align="right">Usage Count</TableCell>
                    <TableCell>Valid Until</TableCell>
                    <TableCell>Status</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(coupons || []).map((cpn: any) => (
                    <TableRow key={cpn._id}>
                      <TableCell>
                        <Typography variant="subtitle2" fontWeight={700} color="primary.main">
                          {cpn.code}
                        </Typography>
                      </TableCell>
                      <TableCell>{cpn.description || 'N/A'}</TableCell>
                      <TableCell>
                        {cpn.discountType === 'PERCENTAGE'
                          ? `${cpn.discountValue}% OFF`
                          : `${formatAmount(cpn.discountValue)} OFF`}
                      </TableCell>
                      <TableCell align="right">
                        {formatAmount(cpn.minPurchaseAmount || 0)}
                      </TableCell>
                      <TableCell align="right">{cpn.currentUsageCount || 0}</TableCell>
                      <TableCell>{new Date(cpn.validUntil).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <Chip
                          label={cpn.isActive ? 'Active' : 'Expired'}
                          size="small"
                          color={cpn.isActive ? 'success' : 'default'}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>

      {/* Create Coupon Modal */}
      <Dialog open={modalOpen} onClose={() => setModalOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Create Promotional Coupon</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="Coupon Code (e.g. SUMMER15)"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            sx={{ mb: 2, mt: 1 }}
          />
          <TextField
            fullWidth
            label="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            sx={{ mb: 2 }}
          />
          <Grid container spacing={2} sx={{ mb: 2 }}>
            <Grid item xs={6}>
              <FormControl fullWidth size="small">
                <InputLabel>Discount Type</InputLabel>
                <Select
                  value={discountType}
                  label="Discount Type"
                  onChange={(e) => setDiscountType(e.target.value)}
                >
                  <MenuItem value="PERCENTAGE">Percentage (%)</MenuItem>
                  <MenuItem value="FIXED">Fixed Amount ({currencySymbol})</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                size="small"
                type="number"
                label="Discount Value"
                value={discountValue}
                onChange={(e) => setDiscountValue(e.target.value)}
              />
            </Grid>
          </Grid>
          <TextField
            fullWidth
            type="number"
            label={`Minimum Purchase Amount (${currencySymbol})`}
            value={minPurchaseAmount}
            onChange={(e) => setMinPurchaseAmount(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setModalOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            disabled={createMutation.isPending}
            onClick={() => createMutation.mutate()}
          >
            Create Coupon
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
