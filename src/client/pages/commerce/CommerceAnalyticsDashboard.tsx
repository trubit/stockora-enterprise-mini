import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import PaymentsIcon from '@mui/icons-material/Payments';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import { api } from '../../api/client.ts';
import { toast } from 'react-hot-toast';
import { useRegionalSettings } from '../../hooks/useRegionalSettings.js';

export default function CommerceAnalyticsDashboard() {
  const { formatAmount } = useRegionalSettings();
  const [analytics, setAnalytics] = useState<any>(null);
  const [forecast, setForecast] = useState<any>(null);

  const fetchAnalytics = async () => {
    try {
      const prodRes = await api.get('/products');
      const prodList = prodRes.data?.data || prodRes.data || [];
      const targetId = prodList.length > 0 ? prodList[0]._id : 'default';

      const [anaRes, fcRes] = await Promise.all([
        api.get('/omnichannel-commerce/analytics'),
        api.get(`/omnichannel-commerce/ai-forecast/${targetId}`),
      ]);
      setAnalytics(anaRes.data || null);
      setForecast(fcRes.data || null);
    } catch {
      toast.error('Failed to load commerce analytics data.');
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, []);

  return (
    <Box sx={{ p: 3, background: '#0b0f19', minHeight: '100vh', color: '#f8fafc' }}>
      <Box sx={{ mb: 3 }}>
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
          <AutoAwesomeIcon fontSize="large" /> Commerce Analytics & AI Sales Intelligence
        </Typography>
        <Typography variant="body2" sx={{ color: '#9ca3af', mt: 0.5 }}>
          Cross-channel revenue performance, payment channel mix breakdowns, operator audits & AI
          demand forecasting
        </Typography>
      </Box>

      {/* AI Sales Forecast Banner */}
      {forecast && (
        <Paper
          sx={{
            p: 3,
            mb: 4,
            background: 'linear-gradient(135deg, #1e1b4b 0%, #311b92 100%)',
            border: '1px solid #6366f1',
            borderRadius: 3,
          }}
        >
          <Box
            sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}
          >
            <Typography
              variant="h6"
              sx={{
                fontWeight: 800,
                color: '#c4b5fd',
                display: 'flex',
                alignItems: 'center',
                gap: 1,
              }}
            >
              <TrendingUpIcon /> AI Predictive Sales & Cross-Selling Advice: {forecast.productName}
            </Typography>
            <Chip
              label={`Trend: ${forecast.trend}`}
              size="small"
              sx={{ background: '#10b981', color: '#fff', fontWeight: 700 }}
            />
          </Box>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={4}>
              <Typography variant="caption" sx={{ color: '#c4b5fd' }}>
                Daily Forecast Demand
              </Typography>
              <Typography variant="h5" sx={{ fontWeight: 800, color: '#fff' }}>
                {forecast.dailyForecastDemand} Units / Day
              </Typography>
            </Grid>
            <Grid item xs={4}>
              <Typography variant="caption" sx={{ color: '#c4b5fd' }}>
                Monthly Demand
              </Typography>
              <Typography variant="h5" sx={{ fontWeight: 800, color: '#fff' }}>
                {forecast.monthlyForecastDemand} Units / Month
              </Typography>
            </Grid>
            <Grid item xs={4}>
              <Typography variant="caption" sx={{ color: '#c4b5fd' }}>
                Recommended Cross-Sell
              </Typography>
              <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#34d399' }}>
                {forecast.crossSellingRecommendations?.[0]?.name} (Score:{' '}
                {forecast.crossSellingRecommendations?.[0]?.confidenceScore}%)
              </Typography>
            </Grid>
          </Grid>
        </Paper>
      )}

      {/* Channel Performance Table */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} md={6}>
          <Paper
            sx={{
              p: 3,
              background: '#111827',
              border: '1px solid #1f2937',
              borderRadius: 3,
              color: '#f8fafc',
            }}
          >
            <Typography
              variant="h6"
              sx={{
                fontWeight: 700,
                mb: 2,
                color: '#818cf8',
                display: 'flex',
                alignItems: 'center',
                gap: 1,
              }}
            >
              <ShoppingCartIcon /> Channel Performance Breakdown
            </Typography>
            <TableContainer>
              <Table size="small">
                <TableHead sx={{ background: '#1f2937' }}>
                  <TableRow>
                    <TableCell sx={{ color: '#9ca3af' }}>Channel</TableCell>
                    <TableCell sx={{ color: '#9ca3af' }}>Revenue</TableCell>
                    <TableCell sx={{ color: '#9ca3af' }}>Transactions</TableCell>
                    <TableCell sx={{ color: '#9ca3af' }}>AOV</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {analytics?.channels?.map((c: any) => (
                    <TableRow key={c.channel} sx={{ '&:hover': { background: '#1e293b' } }}>
                      <TableCell sx={{ color: '#f8fafc', fontWeight: 700 }}>{c.channel}</TableCell>
                      <TableCell sx={{ color: '#34d399', fontWeight: 700 }}>
                        {formatAmount(c.totalRevenue)}
                      </TableCell>
                      <TableCell sx={{ color: '#cbd5e1' }}>{c.transactionCount}</TableCell>
                      <TableCell sx={{ color: '#fbbf24', fontWeight: 700 }}>
                        {formatAmount(c.averageOrderValue)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Grid>

        {/* Payment Mix Table */}
        <Grid item xs={12} md={6}>
          <Paper
            sx={{
              p: 3,
              background: '#111827',
              border: '1px solid #1f2937',
              borderRadius: 3,
              color: '#f8fafc',
            }}
          >
            <Typography
              variant="h6"
              sx={{
                fontWeight: 700,
                mb: 2,
                color: '#38bdf8',
                display: 'flex',
                alignItems: 'center',
                gap: 1,
              }}
            >
              <PaymentsIcon /> Payment Method Mix
            </Typography>
            <TableContainer>
              <Table size="small">
                <TableHead sx={{ background: '#1f2937' }}>
                  <TableRow>
                    <TableCell sx={{ color: '#9ca3af' }}>Payment Method</TableCell>
                    <TableCell sx={{ color: '#9ca3af' }}>Total Amount</TableCell>
                    <TableCell sx={{ color: '#9ca3af' }}>Percentage Share</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {analytics?.payments?.map((p: any) => (
                    <TableRow key={p.method} sx={{ '&:hover': { background: '#1e293b' } }}>
                      <TableCell sx={{ color: '#f8fafc', fontWeight: 700 }}>{p.method}</TableCell>
                      <TableCell sx={{ color: '#34d399', fontWeight: 700 }}>
                        {formatAmount(p.amount)}
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={`${p.percentage}%`}
                          size="small"
                          sx={{
                            background: 'rgba(56, 189, 248, 0.2)',
                            color: '#38bdf8',
                            fontWeight: 700,
                          }}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}
