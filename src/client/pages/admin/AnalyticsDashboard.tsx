import { useQuery } from '@tanstack/react-query';
import { Box, Card, CardContent, Typography, Grid, LinearProgress } from '@mui/material';
import { apiClient } from '../../api/client.ts';
import PageHeader from '../../components/PageHeader.tsx';
import StatCard from '../../components/StatCard.tsx';
import RevenueIcon from '@mui/icons-material/TrendingUp';
import SalesIcon from '@mui/icons-material/ShoppingCart';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { motion } from 'framer-motion';
import { useRegionalSettings } from '../../hooks/useRegionalSettings.js';

interface SalesReport {
  revenue: number;
  averageSale: number;
  count: number;
  chartData: { date: string; sales: number }[];
}

export default function AnalyticsDashboard() {
  const { formatAmount } = useRegionalSettings();
  const { data: sales, isLoading } = useQuery<SalesReport>({
    queryKey: ['sales-analytics'],
    queryFn: async () => {
      const { data } = await apiClient.get<SalesReport>('/reports/sales');
      return data;
    },
  });

  if (isLoading || !sales) {
    return <LinearProgress color="primary" />;
  }

  return (
    <Box sx={{ p: { xs: 2, md: 4 } }}>
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <PageHeader
          title="Business Intelligence Dashboard"
          subtitle="Advanced sales metrics streams and time-series trends visualizer"
          category="Analytics"
        />

        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid item xs={12} sm={4}>
            <StatCard
              title="AGGREGATED SALES VOLUME"
              value={formatAmount(sales.revenue)}
              subtitle="All shift tickets combined"
              icon={<RevenueIcon />}
              color="emerald"
            />
          </Grid>
          <Grid item xs={12} sm={4}>
            <StatCard
              title="AVERAGE BASKET SIZE"
              value={formatAmount(sales.averageSale)}
              subtitle="Mean amount per checkout transaction"
              icon={<SalesIcon />}
              color="violet"
            />
          </Grid>
          <Grid item xs={12} sm={4}>
            <StatCard
              title="TRANSACTIONS CAPTURED"
              value={sales.count}
              subtitle="Successful operations count"
              icon={<RevenueIcon />}
              color="sky"
            />
          </Grid>
        </Grid>

        <Card className="glass-panel" sx={{ borderRadius: '16px', p: 3 }}>
          <CardContent>
            <Typography variant="h6" sx={{ fontWeight: 800, mb: 3 }}>
              Sales Activity Time-Series
            </Typography>
            <Box sx={{ height: 350, width: '100%' }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={sales.chartData}
                  margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="date" stroke="#9ca3af" style={{ fontSize: 11 }} />
                  <YAxis stroke="#9ca3af" style={{ fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#111827',
                      border: '1px solid rgba(255,255,255,0.08)',
                    }}
                    formatter={(val) => [formatAmount(Number(val)), 'Sales']}
                  />
                  <Area
                    type="monotone"
                    dataKey="sales"
                    stroke="#8b5cf6"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#salesGrad)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </Box>
          </CardContent>
        </Card>
      </motion.div>
    </Box>
  );
}
