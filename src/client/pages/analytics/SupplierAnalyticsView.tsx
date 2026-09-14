import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Box,
  Grid,
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
  Chip,
  LinearProgress,
  Button,
} from '@mui/material';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import DownloadIcon from '@mui/icons-material/Download';
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
import { apiClient } from '../../api/client.ts';
import PageHeader from '../../components/PageHeader.tsx';
import StatCard from '../../components/StatCard.tsx';
import toast from 'react-hot-toast';
import { useRegionalSettings } from '../../hooks/useRegionalSettings.js';

export default function SupplierAnalyticsView() {
  const { formatAmount } = useRegionalSettings();
  const [isExporting, setIsExporting] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['bi-supplier-analytics'],
    queryFn: async () => {
      const res = await apiClient.get('/analytics/suppliers');
      return res.data;
    },
  });

  const handleExport = async () => {
    try {
      setIsExporting(true);
      const res = await apiClient.post(
        '/analytics/export',
        { domain: 'SUPPLIERS', format: 'CSV', period: '30_DAYS' },
        { responseType: 'blob' }
      );
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `stockora_supplier_analytics_${Date.now()}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success('Supplier scorecard exported successfully!');
    } catch {
      toast.error('Failed to export supplier report');
    } finally {
      setIsExporting(false);
    }
  };

  if (isLoading || !data) {
    return (
      <Box sx={{ p: 4 }}>
        <LinearProgress color="primary" sx={{ borderRadius: 4, height: 6 }} />
        <Typography variant="body2" color="text.secondary" sx={{ mt: 2, textAlign: 'center' }}>
          Loading vendor scorecard evaluations and supply chain lead times...
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 2, md: 4 } }}>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <Box
          sx={{
            display: 'flex',
            flexDirection: { xs: 'column', md: 'row' },
            justifyContent: 'space-between',
            alignItems: { md: 'center' },
            gap: 2,
            mb: 4,
          }}
        >
          <PageHeader
            title="Supplier Performance & Supply Chain Intelligence"
            subtitle="Vendor scorecards, on-time delivery reliability, lead time benchmarks & purchasing spend trends"
            category="Business Intelligence"
          />
          <Button
            variant="outlined"
            startIcon={<DownloadIcon />}
            onClick={handleExport}
            disabled={isExporting}
            sx={{
              borderColor: 'rgba(139, 92, 246, 0.4)',
              color: '#a78bfa',
              '&:hover': { borderColor: '#8b5cf6', bgcolor: 'rgba(139, 92, 246, 0.08)' },
            }}
          >
            Export Scorecards
          </Button>
        </Box>

        {/* 4 Core Supplier KPI Stat Cards */}
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid item xs={12} sm={6} md={3}>
            <StatCard
              title="PROCUREMENT SPEND"
              value={formatAmount(data.totalSpend || 0)}
              subtitle={`${data.purchaseOrdersCount || 0} purchase orders completed`}
              icon={<AttachMoneyIcon />}
              color="emerald"
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <StatCard
              title="ON-TIME DELIVERY"
              value={`${data.onTimeDeliveryRatePct || 0}%`}
              subtitle="Weighted vendor fulfillment rate"
              icon={<CheckCircleIcon />}
              color="violet"
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <StatCard
              title="AVERAGE LEAD TIME"
              value={`${data.averageLeadTimeDays || 0} days`}
              subtitle="From PO release to goods receipt"
              icon={<AccessTimeIcon />}
              color="sky"
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <StatCard
              title="DEFECT / RETURN RATE"
              value={`${data.defectRatePct || 0}%`}
              subtitle={`Quality pass rate: ${data.qualityPassRatePct || 98.5}%`}
              icon={<LocalShippingIcon />}
              color="amber"
            />
          </Grid>
        </Grid>

        {/* Purchasing Spend Time Series Chart */}
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid item xs={12}>
            <Card className="glass-panel" sx={{ borderRadius: '16px', p: 3 }}>
              <CardContent>
                <Typography variant="h6" sx={{ fontWeight: 800, mb: 1 }}>
                  Purchasing Spend & Requisition Trends
                </Typography>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ display: 'block', mb: 3 }}
                >
                  Monthly committed capital across authorized supplier purchase orders
                </Typography>

                <Box sx={{ height: 260, width: '100%' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={data.purchasingTrends || []}
                      margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient id="spendGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                      <XAxis dataKey="month" stroke="#9ca3af" style={{ fontSize: 11 }} />
                      <YAxis
                        stroke="#9ca3af"
                        style={{ fontSize: 11 }}
                        tickFormatter={(val) => `$${val.toLocaleString()}`}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#111827',
                          borderColor: '#374151',
                          borderRadius: '8px',
                        }}
                        formatter={(val: any) => [`$${Number(val).toLocaleString()}`, 'Spend']}
                      />
                      <Area
                        type="monotone"
                        dataKey="spend"
                        name="Purchasing Spend ($)"
                        stroke="#10b981"
                        strokeWidth={3}
                        fillOpacity={1}
                        fill="url(#spendGrad)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Supplier Scorecards Table */}
        <Card className="glass-panel" sx={{ borderRadius: '16px', p: 3 }}>
          <CardContent>
            <Typography variant="h6" sx={{ fontWeight: 800, mb: 1 }}>
              Supplier Scorecards & Reliability Index
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 3 }}>
              Multi-criteria evaluation based on actual goods receipt timings, quality inspection
              logs & defect rates
            </Typography>

            <TableContainer component={Paper} sx={{ bgcolor: 'transparent', boxShadow: 'none' }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ color: 'text.secondary', fontWeight: 700 }}>
                      Supplier Name
                    </TableCell>
                    <TableCell sx={{ color: 'text.secondary', fontWeight: 700 }}>Code</TableCell>
                    <TableCell align="right" sx={{ color: 'text.secondary', fontWeight: 700 }}>
                      Total Spend
                    </TableCell>
                    <TableCell align="right" sx={{ color: 'text.secondary', fontWeight: 700 }}>
                      POs
                    </TableCell>
                    <TableCell align="right" sx={{ color: 'text.secondary', fontWeight: 700 }}>
                      On-Time %
                    </TableCell>
                    <TableCell align="right" sx={{ color: 'text.secondary', fontWeight: 700 }}>
                      Lead Time
                    </TableCell>
                    <TableCell align="right" sx={{ color: 'text.secondary', fontWeight: 700 }}>
                      Quality %
                    </TableCell>
                    <TableCell align="center" sx={{ color: 'text.secondary', fontWeight: 700 }}>
                      Reliability Score
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(data.scorecards || []).map((sup: any) => (
                    <TableRow
                      key={sup.supplierId}
                      hover
                      sx={{ '&:last-child td, &:last-child th': { border: 0 } }}
                    >
                      <TableCell sx={{ fontWeight: 700 }}>{sup.supplierName}</TableCell>
                      <TableCell sx={{ color: 'text.secondary', fontSize: '0.8rem' }}>
                        {sup.code}
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700, color: 'success.light' }}>
                        ${(sup.totalSpend || 0).toLocaleString()}
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 600 }}>
                        {sup.purchaseOrdersCount}
                      </TableCell>
                      <TableCell
                        align="right"
                        sx={{
                          fontWeight: 700,
                          color:
                            sup.onTimeDeliveryRatePct >= 90 ? 'success.light' : 'warning.light',
                        }}
                      >
                        {sup.onTimeDeliveryRatePct}%
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 600 }}>
                        {sup.averageLeadTimeDays}d
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 600 }}>
                        {sup.qualityPassRatePct}%
                      </TableCell>
                      <TableCell align="center">
                        <Chip
                          label={`${sup.reliabilityOverallScorePct || 92}%`}
                          size="small"
                          sx={{
                            bgcolor:
                              (sup.reliabilityOverallScorePct || 92) >= 90
                                ? 'rgba(16, 185, 129, 0.15)'
                                : 'rgba(245, 158, 11, 0.15)',
                            color:
                              (sup.reliabilityOverallScorePct || 92) >= 90 ? '#10b981' : '#f59e0b',
                            fontWeight: 800,
                            fontSize: '0.75rem',
                          }}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      </motion.div>
    </Box>
  );
}
