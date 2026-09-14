import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  Button,
  CircularProgress,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
} from '@mui/material';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import ShoppingBagIcon from '@mui/icons-material/ShoppingBag';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import RefreshIcon from '@mui/icons-material/Refresh';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { api } from '../../api/client.ts';
import { toast } from 'react-hot-toast';
import { useRegionalSettings } from '../../hooks/useRegionalSettings.js';

interface AnalyticsData {
  totalRevenue: number;
  totalOrders: number;
  averageOrderValue: number;
  quoteConversionRate: number;
  revenueByChannel: {
    channelCode: string;
    channelName: string;
    revenue: number;
    orderCount: number;
  }[];
  topProducts: {
    productId: string;
    name: string;
    sku: string;
    totalSold: number;
    totalRevenue: number;
  }[];
  aiSalesIntelligence: {
    growthChannel: string;
    topRevenueCategory: string;
    atRiskCustomersCount: number;
    quoteConversionAdvice: string;
    reorderAlerts: string[];
    upsellRecommendations: { baseProduct: string; recommendedProduct: string; rationale: string }[];
  };
}

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#3b82f6'];

export default function SalesAnalyticsDashboard() {
  const { formatAmount } = useRegionalSettings();
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const res = await api.get('/sales-advanced/analytics/overview');
      setData(res.data);
    } catch {
      toast.error('Failed to load sales analytics.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '60vh',
          background: '#0a0e17',
        }}
      >
        <CircularProgress sx={{ color: '#8b5cf6' }} />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 4, background: '#0a0e17', minHeight: '100vh', color: '#f8fafc' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800, color: '#f8fafc', mb: 0.5 }}>
            Omnichannel Sales Analytics & Revenue Intelligence
          </Typography>
          <Typography variant="body2" sx={{ color: '#9ca3af' }}>
            Real-time pipeline health, multi-channel performance distribution, and autonomous sales
            insights.
          </Typography>
        </Box>
        <Button
          variant="outlined"
          startIcon={<RefreshIcon />}
          onClick={fetchAnalytics}
          sx={{
            borderColor: '#374151',
            color: '#cbd5e1',
            '&:hover': { borderColor: '#6366f1', color: '#fff' },
          }}
        >
          Refresh Data
        </Button>
      </Box>

      {/* KPI Cards */}
      <Grid container spacing={2.5} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card
            sx={{
              background: '#111827',
              border: '1px solid #1f2937',
              borderRadius: 3,
              color: '#f8fafc',
            }}
          >
            <CardContent sx={{ display: 'flex', alignItems: 'center', p: 2.5 }}>
              <Box
                sx={{
                  p: 1.5,
                  borderRadius: 2,
                  background: 'rgba(99, 102, 241, 0.15)',
                  color: '#818cf8',
                  mr: 2,
                }}
              >
                <AttachMoneyIcon fontSize="large" />
              </Box>
              <Box>
                <Typography variant="caption" sx={{ color: '#9ca3af', fontWeight: 500 }}>
                  Total Revenue
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 800, color: '#f8fafc' }}>
                  {formatAmount(data?.totalRevenue || 0)}
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card
            sx={{
              background: '#111827',
              border: '1px solid #1f2937',
              borderRadius: 3,
              color: '#f8fafc',
            }}
          >
            <CardContent sx={{ display: 'flex', alignItems: 'center', p: 2.5 }}>
              <Box
                sx={{
                  p: 1.5,
                  borderRadius: 2,
                  background: 'rgba(16, 185, 129, 0.15)',
                  color: '#34d399',
                  mr: 2,
                }}
              >
                <ShoppingBagIcon fontSize="large" />
              </Box>
              <Box>
                <Typography variant="caption" sx={{ color: '#9ca3af', fontWeight: 500 }}>
                  Total Orders
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 800, color: '#f8fafc' }}>
                  {data?.totalOrders || 0}
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card
            sx={{
              background: '#111827',
              border: '1px solid #1f2937',
              borderRadius: 3,
              color: '#f8fafc',
            }}
          >
            <CardContent sx={{ display: 'flex', alignItems: 'center', p: 2.5 }}>
              <Box
                sx={{
                  p: 1.5,
                  borderRadius: 2,
                  background: 'rgba(245, 158, 11, 0.15)',
                  color: '#fbbf24',
                  mr: 2,
                }}
              >
                <TrendingUpIcon fontSize="large" />
              </Box>
              <Box>
                <Typography variant="caption" sx={{ color: '#9ca3af', fontWeight: 500 }}>
                  Average Order Value (AOV)
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 800, color: '#f8fafc' }}>
                  {formatAmount(data?.averageOrderValue || 0)}
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card
            sx={{
              background: '#111827',
              border: '1px solid #1f2937',
              borderRadius: 3,
              color: '#f8fafc',
            }}
          >
            <CardContent sx={{ display: 'flex', alignItems: 'center', p: 2.5 }}>
              <Box
                sx={{
                  p: 1.5,
                  borderRadius: 2,
                  background: 'rgba(236, 72, 153, 0.15)',
                  color: '#f472b6',
                  mr: 2,
                }}
              >
                <CheckCircleIcon fontSize="large" />
              </Box>
              <Box>
                <Typography variant="caption" sx={{ color: '#9ca3af', fontWeight: 500 }}>
                  Quote Conversion Rate
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 800, color: '#f8fafc' }}>
                  {data?.quoteConversionRate || 0}%
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* AI Sales Intelligence Banner */}
      <Card
        sx={{
          mb: 3,
          background: 'linear-gradient(135deg, #1e1b4b 0%, #0f172a 100%)',
          border: '1px solid rgba(139, 92, 246, 0.3)',
          borderRadius: 3,
          color: '#f8fafc',
          boxShadow: '0 8px 32px rgba(139, 92, 246, 0.15)',
        }}
      >
        <CardContent sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <AutoAwesomeIcon sx={{ color: '#fbbf24' }} />
            <Typography variant="h6" sx={{ fontWeight: 700, color: '#fbbf24' }}>
              AI Executive Sales Intelligence & Advisory
            </Typography>
          </Box>
          <Grid container spacing={2}>
            <Grid item xs={12} md={4}>
              <Box
                sx={{
                  p: 2,
                  borderRadius: 2,
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                }}
              >
                <Typography variant="caption" sx={{ color: '#94a3b8' }}>
                  Highest Growth Channel
                </Typography>
                <Typography variant="body1" sx={{ fontWeight: 700, color: '#38bdf8', mt: 0.5 }}>
                  {data?.aiSalesIntelligence?.growthChannel || 'POS'}
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={12} md={4}>
              <Box
                sx={{
                  p: 2,
                  borderRadius: 2,
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                }}
              >
                <Typography variant="caption" sx={{ color: '#94a3b8' }}>
                  At-Risk Churn Customers
                </Typography>
                <Typography variant="body1" sx={{ fontWeight: 700, color: '#f87171', mt: 0.5 }}>
                  {data?.aiSalesIntelligence?.atRiskCustomersCount || 0} High Risk Customers
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={12} md={4}>
              <Box
                sx={{
                  p: 2,
                  borderRadius: 2,
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                }}
              >
                <Typography variant="caption" sx={{ color: '#94a3b8' }}>
                  Optimization Recommendation
                </Typography>
                <Typography variant="body1" sx={{ fontWeight: 600, color: '#a78bfa', mt: 0.5 }}>
                  {data?.aiSalesIntelligence?.quoteConversionAdvice || 'Monitor quote conversions'}
                </Typography>
              </Box>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Charts Section */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} md={7}>
          <Paper
            sx={{
              p: 3,
              background: '#111827',
              border: '1px solid #1f2937',
              borderRadius: 3,
              color: '#f8fafc',
              height: '100%',
            }}
          >
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 2.5, color: '#f8fafc' }}>
              Revenue by Sales Channel
            </Typography>
            <Box style={{ width: '100%', height: 300 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data?.revenueByChannel || []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
                  <XAxis dataKey="channelName" stroke="#9ca3af" tick={{ fill: '#9ca3af' }} />
                  <YAxis stroke="#9ca3af" tick={{ fill: '#9ca3af' }} />
                  <Tooltip
                    contentStyle={{
                      background: '#1e293b',
                      border: '1px solid #374151',
                      borderRadius: '8px',
                      color: '#fff',
                    }}
                    formatter={(value: any) => [formatAmount(value), 'Revenue']}
                  />
                  <Bar dataKey="revenue" fill="#6366f1" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Box>
          </Paper>
        </Grid>

        <Grid item xs={12} md={5}>
          <Paper
            sx={{
              p: 3,
              background: '#111827',
              border: '1px solid #1f2937',
              borderRadius: 3,
              color: '#f8fafc',
              height: '100%',
            }}
          >
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 2.5, color: '#f8fafc' }}>
              Channel Share Distribution
            </Typography>
            <Box style={{ width: '100%', height: 300 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data?.revenueByChannel || []}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={5}
                    dataKey="revenue"
                    nameKey="channelName"
                  >
                    {(data?.revenueByChannel || []).map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: '#1e293b',
                      border: '1px solid #374151',
                      borderRadius: '8px',
                      color: '#fff',
                    }}
                    formatter={(value: any) => [formatAmount(value), 'Revenue']}
                  />
                </PieChart>
              </ResponsiveContainer>
            </Box>
          </Paper>
        </Grid>
      </Grid>

      {/* Top Products Table */}
      <Paper
        sx={{
          p: 3,
          background: '#111827',
          border: '1px solid #1f2937',
          borderRadius: 3,
          color: '#f8fafc',
        }}
      >
        <Typography variant="h6" sx={{ fontWeight: 700, mb: 2, color: '#f8fafc' }}>
          Top Selling Products
        </Typography>
        <TableContainer>
          <Table>
            <TableHead sx={{ background: '#1f2937' }}>
              <TableRow>
                <TableCell sx={{ color: '#9ca3af', fontWeight: 600 }}>Product Name</TableCell>
                <TableCell sx={{ color: '#9ca3af', fontWeight: 600 }}>SKU</TableCell>
                <TableCell sx={{ color: '#9ca3af', fontWeight: 600 }}>Units Sold</TableCell>
                <TableCell sx={{ color: '#9ca3af', fontWeight: 600 }}>Total Revenue</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(data?.topProducts || []).map((p) => (
                <TableRow key={p.productId} sx={{ '&:hover': { background: '#1e293b' } }}>
                  <TableCell sx={{ color: '#f8fafc', fontWeight: 600 }}>{p.name}</TableCell>
                  <TableCell>
                    <Chip
                      label={p.sku}
                      size="small"
                      sx={{ background: '#374151', color: '#cbd5e1', fontWeight: 500 }}
                    />
                  </TableCell>
                  <TableCell sx={{ color: '#f8fafc' }}>{p.totalSold}</TableCell>
                  <TableCell sx={{ color: '#34d399', fontWeight: 700 }}>
                    {formatAmount(p.totalRevenue || 0)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </Box>
  );
}
