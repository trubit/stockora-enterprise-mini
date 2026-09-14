import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiClient } from '../../api/client.ts';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Chip,
  Paper,
  Divider,
  Button,
  CircularProgress,
} from '@mui/material';
import PageHeader from '../../components/PageHeader.tsx';
import { toast } from 'react-hot-toast';

export default function Customer360() {
  const { id } = useParams<{ id: string }>();
  const [selectedCustomerId, setSelectedCustomerId] = useState(id || '');

  const { data: customers } = useQuery({
    queryKey: ['customers-list'],
    queryFn: async () => {
      const res = await apiClient.get('/customers');
      return Array.isArray(res.data) ? res.data : res.data?.data || [];
    },
  });

  useEffect(() => {
    if (id) {
      setSelectedCustomerId(id);
    } else if (customers && customers.length > 0 && !selectedCustomerId) {
      setSelectedCustomerId(customers[0]._id);
    }
  }, [id, customers, selectedCustomerId]);

  const {
    data: customer360,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['customer-360', selectedCustomerId],
    enabled: !!selectedCustomerId,
    queryFn: async () => {
      const res = await apiClient.get(`/crm/customers/${selectedCustomerId}/360`);
      return res.data.data;
    },
    retry: 1,
  });

  const recalcMutation = useMutation({
    mutationFn: async () => {
      if (!selectedCustomerId) return;
      const res = await apiClient.post(`/crm/customers/${selectedCustomerId}/recalculate`);
      return res.data.data;
    },
    onSuccess: () => {
      toast.success('Customer 360 metrics recalculated!');
      refetch();
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || err.message || 'Failed to recalculate metrics.');
    },
  });

  const customer = customer360?.customer;
  const timeline = customer360?.timeline || [];

  return (
    <Box sx={{ p: 3 }}>
      <PageHeader
        title="Customer 360 & Activity Timeline"
        subtitle="Unified Customer Identity, CLV, Churn Risk & Complete Behavioral Trail"
      />

      <Card sx={{ mb: 4 }}>
        <CardContent>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} sm={8}>
              <FormControl fullWidth size="small">
                <InputLabel>Select Customer</InputLabel>
                <Select
                  value={selectedCustomerId}
                  label="Select Customer"
                  onChange={(e) => setSelectedCustomerId(e.target.value)}
                >
                  {(customers || []).map((c: any) => (
                    <MenuItem key={c._id} value={c._id}>
                      {c.name} ({c.email}) - {c.code}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={4}>
              <Button
                fullWidth
                variant="outlined"
                disabled={!selectedCustomerId || recalcMutation.isPending}
                onClick={() => recalcMutation.mutate()}
              >
                Recalculate CLV & Churn
              </Button>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 6 }}>
          <CircularProgress />
        </Box>
      ) : customer ? (
        <Grid container spacing={3}>
          {/* Identity & Financial Summary */}
          <Grid item xs={12} md={5}>
            <Card sx={{ mb: 3 }}>
              <CardContent>
                <Box
                  sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    mb: 2,
                  }}
                >
                  <Typography variant="h6" fontWeight={600}>
                    {customer.name}
                  </Typography>
                  <Chip label={customer.loyaltyTier} color="warning" size="small" />
                </Box>
                <Typography variant="body2" color="textSecondary" gutterBottom>
                  Email: {customer.email}
                </Typography>
                <Typography variant="body2" color="textSecondary" gutterBottom>
                  Phone: {customer.phone || 'N/A'}
                </Typography>
                <Typography variant="body2" color="textSecondary" gutterBottom>
                  Customer Group: {customer.group}
                </Typography>

                <Divider sx={{ my: 2 }} />

                <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                  Financial Intelligence
                </Typography>
                <Grid container spacing={2} sx={{ mt: 0.5 }}>
                  <Grid item xs={6}>
                    <Typography variant="caption" color="textSecondary" display="block">
                      Total Spending
                    </Typography>
                    <Typography variant="h6" fontWeight={600} color="primary.main">
                      ${customer.totalSpending || 0}
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="caption" color="textSecondary" display="block">
                      Total Orders
                    </Typography>
                    <Typography variant="h6" fontWeight={600}>
                      {customer.totalOrders || 0}
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="caption" color="textSecondary" display="block">
                      Estimated CLV
                    </Typography>
                    <Typography variant="h6" fontWeight={600} color="success.main">
                      ${customer.clvScore || 0}
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="caption" color="textSecondary" display="block">
                      Loyalty Points
                    </Typography>
                    <Typography variant="h6" fontWeight={600} color="warning.main">
                      {customer.loyaltyPoints || 0}
                    </Typography>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>

            <Card>
              <CardContent>
                <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                  Churn Risk Scorecard
                </Typography>
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    mt: 1,
                  }}
                >
                  <Typography variant="body2" color="textSecondary">
                    Risk Level: <strong>{customer.churnRiskLevel || 'LOW'}</strong>
                  </Typography>
                  <Chip
                    label={`${customer.churnRiskScore || 15}% Risk`}
                    color={customer.churnRiskScore > 50 ? 'error' : 'success'}
                  />
                </Box>
              </CardContent>
            </Card>
          </Grid>

          {/* Activity Timeline */}
          <Grid item xs={12} md={7}>
            <Card>
              <CardContent>
                <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>
                  Chronological Activity Timeline
                </Typography>
                {timeline.length === 0 ? (
                  <Typography variant="body2" color="textSecondary">
                    No activity recorded yet for this customer.
                  </Typography>
                ) : (
                  <Box>
                    {timeline.map((event: any) => (
                      <Paper
                        variant="outlined"
                        key={event._id}
                        sx={{ p: 2, mb: 1.5, borderRadius: 2 }}
                      >
                        <Box
                          sx={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                          }}
                        >
                          <Typography variant="subtitle2" fontWeight={600}>
                            {event.title}
                          </Typography>
                          <Chip label={event.eventType} size="small" variant="outlined" />
                        </Box>
                        {event.description && (
                          <Typography variant="body2" color="textSecondary" sx={{ mt: 0.5 }}>
                            {event.description}
                          </Typography>
                        )}
                        <Typography
                          variant="caption"
                          color="textSecondary"
                          display="block"
                          sx={{ mt: 1 }}
                        >
                          {new Date(event.createdAt).toLocaleString()}
                        </Typography>
                      </Paper>
                    ))}
                  </Box>
                )}
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      ) : (
        <Paper variant="outlined" sx={{ p: 4, textAlign: 'center' }}>
          <Typography color="textSecondary">
            Select a customer above to view their Customer 360 profile.
          </Typography>
        </Paper>
      )}
    </Box>
  );
}
