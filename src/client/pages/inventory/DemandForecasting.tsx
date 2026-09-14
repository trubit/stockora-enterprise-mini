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
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  CircularProgress,
} from '@mui/material';
import PageHeader from '../../components/PageHeader.tsx';
import { toast } from 'react-hot-toast';

export default function DemandForecasting() {
  const [selectedProduct, setSelectedProduct] = useState('');
  const [selectedMethod, setSelectedMethod] = useState('WEIGHTED_MOVING_AVERAGE');
  const [period, setPeriod] = useState('MONTHLY');

  const { data: productsData } = useQuery({
    queryKey: ['products-list'],
    queryFn: async () => {
      const res = await apiClient.get('/products');
      return res.data;
    },
  });

  const products = Array.isArray(productsData) ? productsData : productsData?.data || [];

  const {
    data: forecasts,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['demand-forecasts', selectedProduct],
    queryFn: async () => {
      const res = await apiClient.get('/inventory-intelligence/forecasts', {
        params: { productId: selectedProduct || undefined },
      });
      return res.data.data;
    },
  });

  const generateMutation = useMutation({
    mutationFn: async () => {
      if (!selectedProduct) {
        throw new Error('Please select a product first');
      }
      const res = await apiClient.post('/inventory-intelligence/forecast', {
        productId: selectedProduct,
        method: selectedMethod,
        period,
      });
      return res.data.data;
    },
    onSuccess: () => {
      toast.success('Demand Forecast generated successfully!');
      refetch();
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to generate forecast.');
    },
  });

  return (
    <Box sx={{ p: 3 }}>
      <PageHeader
        title="Demand Forecasting Engine"
        subtitle="Multi-model statistical and AI hybrid demand predictions"
      />

      <Card sx={{ mb: 4 }}>
        <CardContent>
          <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>
            Generate New Forecast
          </Typography>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} sm={4}>
              <FormControl fullWidth size="small">
                <InputLabel>Product</InputLabel>
                <Select
                  value={selectedProduct}
                  label="Product"
                  onChange={(e) => setSelectedProduct(e.target.value)}
                >
                  {(products || []).map((p: any) => (
                    <MenuItem key={p._id} value={p._id}>
                      {p.name} ({p.sku})
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={3}>
              <FormControl fullWidth size="small">
                <InputLabel>Forecast Strategy</InputLabel>
                <Select
                  value={selectedMethod}
                  label="Forecast Strategy"
                  onChange={(e) => setSelectedMethod(e.target.value)}
                >
                  <MenuItem value="MOVING_AVERAGE">Simple Moving Average</MenuItem>
                  <MenuItem value="WEIGHTED_MOVING_AVERAGE">Weighted Moving Average</MenuItem>
                  <MenuItem value="EXPONENTIAL_SMOOTHING">Exponential Smoothing</MenuItem>
                  <MenuItem value="SEASONAL_TREND">Seasonal Trend Model</MenuItem>
                  <MenuItem value="AI_HYBRID">AI Hybrid Strategy</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={3}>
              <FormControl fullWidth size="small">
                <InputLabel>Period</InputLabel>
                <Select value={period} label="Period" onChange={(e) => setPeriod(e.target.value)}>
                  <MenuItem value="DAILY">Daily</MenuItem>
                  <MenuItem value="WEEKLY">Weekly</MenuItem>
                  <MenuItem value="MONTHLY">Monthly</MenuItem>
                  <MenuItem value="QUARTERLY">Quarterly</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={2}>
              <Button
                fullWidth
                variant="contained"
                disabled={generateMutation.isPending || !selectedProduct}
                onClick={() => generateMutation.mutate()}
              >
                {generateMutation.isPending ? <CircularProgress size={24} /> : 'Forecast'}
              </Button>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>
            Historical Forecast Results & Error Metrics
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
                    <TableCell>Product / SKU</TableCell>
                    <TableCell>Period</TableCell>
                    <TableCell align="right">Forecasted Demand</TableCell>
                    <TableCell align="right">Confidence Score</TableCell>
                    <TableCell align="right">MAE</TableCell>
                    <TableCell align="right">MAPE (%)</TableCell>
                    <TableCell>Strategy</TableCell>
                    <TableCell>Date Generated</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(forecasts || []).map((f: any) => (
                    <TableRow key={f._id}>
                      <TableCell>
                        <Typography variant="subtitle2">{f.productSku}</Typography>
                        <Typography variant="caption" color="textSecondary">
                          {f.productName}
                        </Typography>
                      </TableCell>
                      <TableCell>{f.period}</TableCell>
                      <TableCell align="right">
                        <Typography fontWeight={600} color="primary.main">
                          {f.forecastedDemand} units
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Chip
                          label={`${f.confidenceScore}%`}
                          size="small"
                          color={f.confidenceScore >= 80 ? 'success' : 'warning'}
                        />
                      </TableCell>
                      <TableCell align="right">{f.historicalAccuracy?.mae || 0}</TableCell>
                      <TableCell align="right">{f.historicalAccuracy?.mape || 0}%</TableCell>
                      <TableCell>{f.method}</TableCell>
                      <TableCell>{new Date(f.createdAt).toLocaleDateString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}
