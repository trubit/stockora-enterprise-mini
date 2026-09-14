import { useQuery, useMutation } from '@tanstack/react-query';
import { apiClient } from '../../api/client.ts';
import {
  Box,
  Typography,
  Grid,
  Button,
  Chip,
  Paper,
  LinearProgress,
  CircularProgress,
} from '@mui/material';
import PageHeader from '../../components/PageHeader.tsx';
import { toast } from 'react-hot-toast';

export default function SupplierIntelligence() {
  const {
    data: scores,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['supplier-scores'],
    queryFn: async () => {
      const res = await apiClient.get('/inventory-intelligence/suppliers');
      return res.data.data;
    },
  });

  const evaluateMutation = useMutation({
    mutationFn: async () => {
      const res = await apiClient.post('/inventory-intelligence/suppliers/evaluate');
      return res.data.data;
    },
    onSuccess: () => {
      toast.success('Supplier performance scores recalculated!');
      refetch();
    },
    onError: (err: any) => {
      toast.error(err.message || 'Evaluation failed.');
    },
  });

  return (
    <Box sx={{ p: 3 }}>
      <PageHeader
        title="Supplier Intelligence & Scoring"
        subtitle="Automated Vendor Performance Scorecards, Lead Time Analysis & Risk Metrics"
      />

      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 3 }}>
        <Button
          variant="contained"
          disabled={evaluateMutation.isPending}
          onClick={() => evaluateMutation.mutate()}
        >
          {evaluateMutation.isPending ? (
            <CircularProgress size={24} />
          ) : (
            'Recalculate Supplier Scores'
          )}
        </Button>
      </Box>

      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 6 }}>
          <CircularProgress />
        </Box>
      ) : (
        <Grid container spacing={3}>
          {(scores || []).map((supplier: any) => (
            <Grid item xs={12} sm={6} md={4} key={supplier._id}>
              <Paper variant="outlined" sx={{ p: 3, borderRadius: 2 }}>
                <Box
                  sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    mb: 2,
                  }}
                >
                  <Typography variant="h6" fontWeight={600}>
                    {supplier.supplierName || 'Supplier'}
                  </Typography>
                  <Chip
                    label={`${supplier.overallScore}% Overall`}
                    color={
                      supplier.overallScore >= 80
                        ? 'success'
                        : supplier.overallScore >= 60
                          ? 'warning'
                          : 'error'
                    }
                  />
                </Box>

                <Box sx={{ mb: 1.5 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                    <Typography variant="body2" color="textSecondary">
                      Delivery Performance:
                    </Typography>
                    <Typography variant="body2" fontWeight={600}>
                      {supplier.deliveryPerformanceScore}%
                    </Typography>
                  </Box>
                  <LinearProgress
                    variant="determinate"
                    value={supplier.deliveryPerformanceScore}
                    color={supplier.deliveryPerformanceScore >= 80 ? 'success' : 'warning'}
                  />
                </Box>

                <Box sx={{ mb: 1.5 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                    <Typography variant="body2" color="textSecondary">
                      Order Fill Rate:
                    </Typography>
                    <Typography variant="body2" fontWeight={600}>
                      {supplier.fillRateScore}%
                    </Typography>
                  </Box>
                  <LinearProgress
                    variant="determinate"
                    value={supplier.fillRateScore}
                    color="primary"
                  />
                </Box>

                <Box
                  sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    mt: 2,
                    pt: 1,
                    borderTop: '1px solid #e2e8f0',
                  }}
                >
                  <Typography variant="caption" color="textSecondary">
                    Lead Time: {supplier.avgLeadTimeDays} days
                  </Typography>
                  <Typography variant="caption" color="textSecondary">
                    Risk Tier: <strong>{supplier.riskTier}</strong>
                  </Typography>
                </Box>
              </Paper>
            </Grid>
          ))}
        </Grid>
      )}
    </Box>
  );
}
