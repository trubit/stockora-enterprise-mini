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
  Tabs,
  Tab,
} from '@mui/material';
import Inventory2Icon from '@mui/icons-material/Inventory2';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import AutorenewIcon from '@mui/icons-material/Autorenew';
import SpeedIcon from '@mui/icons-material/Speed';
import DownloadIcon from '@mui/icons-material/Download';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';
import { motion } from 'framer-motion';
import { apiClient } from '../../api/client.ts';
import PageHeader from '../../components/PageHeader.tsx';
import StatCard from '../../components/StatCard.tsx';
import toast from 'react-hot-toast';
import { useRegionalSettings } from '../../hooks/useRegionalSettings.js';

const AGING_COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444'];

export default function InventoryAnalyticsView() {
  const { formatAmount } = useRegionalSettings();
  const [activeTab, setActiveTab] = useState(0);
  const [isExporting, setIsExporting] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['bi-inventory-analytics'],
    queryFn: async () => {
      const res = await apiClient.get('/analytics/inventory');
      return res.data;
    },
  });

  const handleExport = async () => {
    try {
      setIsExporting(true);
      const res = await apiClient.post(
        '/analytics/export',
        { domain: 'INVENTORY', format: 'CSV', period: '30_DAYS' },
        { responseType: 'blob' }
      );
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `stockora_inventory_analytics_${Date.now()}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success('Inventory intelligence report exported successfully!');
    } catch {
      toast.error('Failed to export inventory report');
    } finally {
      setIsExporting(false);
    }
  };

  if (isLoading || !data) {
    return (
      <Box sx={{ p: 4 }}>
        <LinearProgress color="primary" sx={{ borderRadius: 4, height: 6 }} />
        <Typography variant="body2" color="text.secondary" sx={{ mt: 2, textAlign: 'center' }}>
          Calculating authoritative warehouse inventory valuation and velocity metrics...
        </Typography>
      </Box>
    );
  }

  const agingChartData = [
    {
      name: '0–30 Days (Fresh)',
      value: data.agingBands?.band0To30Days || 0,
      color: AGING_COLORS[0],
    },
    {
      name: '31–60 Days (Normal)',
      value: data.agingBands?.band31To60Days || 0,
      color: AGING_COLORS[1],
    },
    {
      name: '61–90 Days (Aging)',
      value: data.agingBands?.band61To90Days || 0,
      color: AGING_COLORS[2],
    },
    {
      name: '90+ Days (At Risk)',
      value: data.agingBands?.band90PlusDays || 0,
      color: AGING_COLORS[3],
    },
  ];

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
            title="Inventory Intelligence & Stock Health"
            subtitle="Authoritative stock valuation, annualized turnover ratios, aging classification & automated replenishment intelligence"
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
            Export Stock Report
          </Button>
        </Box>

        {/* 4 Core Inventory KPI Stat Cards */}
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid item xs={12} sm={6} md={3}>
            <StatCard
              title="TOTAL INVENTORY VALUE"
              value={formatAmount(data.stockValue || 0)}
              subtitle={`Cost valuation: ${formatAmount(data.inventoryCostValue || 0)}`}
              icon={<Inventory2Icon />}
              color="emerald"
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <StatCard
              title="TURNOVER RATIO (ITR)"
              value={`${data.inventoryTurnoverRatio || 0}x`}
              subtitle="Annualized COGS / Avg Inventory"
              icon={<AutorenewIcon />}
              color="violet"
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <StatCard
              title="ACTIVE CATALOG SKUS"
              value={(data.totalSkus || 0).toLocaleString()}
              subtitle={`${(data.totalUnits || 0).toLocaleString()} total warehouse units`}
              icon={<SpeedIcon />}
              color="sky"
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <StatCard
              title="STOCKOUT LOSS EST."
              value={formatAmount(data.stockoutMetrics?.estimatedLostSalesValue || 0)}
              subtitle={`${data.stockoutMetrics?.stockoutCount || 0} SKUs zero stock`}
              icon={<WarningAmberIcon />}
              color="rose"
            />
          </Grid>
        </Grid>

        {/* Aging Bands and Stockout Analytics */}
        <Grid container spacing={3} sx={{ mb: 4 }}>
          {/* Inventory Aging Bands */}
          <Grid item xs={12} lg={6}>
            <Card className="glass-panel" sx={{ borderRadius: '16px', p: 3, height: '100%' }}>
              <CardContent>
                <Typography variant="h6" sx={{ fontWeight: 800, mb: 1 }}>
                  Inventory Aging Classification
                </Typography>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ display: 'block', mb: 2 }}
                >
                  Valuation distribution by holding duration in warehouses
                </Typography>

                <Box sx={{ height: 240, width: '100%' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={agingChartData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={90}
                        paddingAngle={4}
                      >
                        {agingChartData.map((entry, index) => (
                          <Cell key={`aging-cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#111827',
                          borderColor: '#374151',
                          borderRadius: '8px',
                        }}
                        formatter={(val: any) => [formatAmount(Number(val)), 'Valuation']}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </Box>

                <Grid container spacing={1} sx={{ mt: 1 }}>
                  {agingChartData.map((item) => (
                    <Grid item xs={6} key={item.name}>
                      <Box
                        sx={{
                          p: 1.5,
                          borderRadius: '8px',
                          bgcolor: 'rgba(255,255,255,0.02)',
                          border: '1px solid rgba(255,255,255,0.04)',
                        }}
                      >
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                          <Box
                            sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: item.color }}
                          />
                          <Typography variant="caption" sx={{ fontWeight: 700 }}>
                            {item.name}
                          </Typography>
                        </Box>
                        <Typography variant="body2" sx={{ fontWeight: 800 }}>
                          {formatAmount(item.value)}
                        </Typography>
                      </Box>
                    </Grid>
                  ))}
                </Grid>
              </CardContent>
            </Card>
          </Grid>

          {/* Stockout Impact & Lost Sales Analysis */}
          <Grid item xs={12} lg={6}>
            <Card className="glass-panel" sx={{ borderRadius: '16px', p: 3, height: '100%' }}>
              <CardContent>
                <Typography variant="h6" sx={{ fontWeight: 800, mb: 1 }}>
                  Stockout Impact & Revenue Loss
                </Typography>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ display: 'block', mb: 3 }}
                >
                  Estimated lost sales derived from 30-day historical daily sales velocity
                </Typography>

                <Box
                  sx={{
                    p: 2.5,
                    borderRadius: '12px',
                    bgcolor: 'rgba(239, 68, 68, 0.08)',
                    border: '1px solid rgba(239, 68, 68, 0.2)',
                    mb: 3,
                  }}
                >
                  <Box
                    sx={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      mb: 1,
                    }}
                  >
                    <Typography variant="subtitle2" sx={{ fontWeight: 800, color: 'error.light' }}>
                      Estimated Lost Sales:{' '}
                      {formatAmount(data.stockoutMetrics?.estimatedLostSalesValue || 0)}
                    </Typography>
                    <Chip
                      label="Probabilistic Model"
                      size="small"
                      sx={{ bgcolor: 'rgba(239, 68, 68, 0.2)', color: '#f87171', fontWeight: 700 }}
                    />
                  </Box>
                  <Typography variant="caption" color="text.secondary">
                    {data.stockoutMetrics?.lostSalesDisclaimer}
                  </Typography>
                </Box>

                <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
                  Critical Out-of-Stock SKUs
                </Typography>
                <TableContainer
                  component={Paper}
                  sx={{ bgcolor: 'transparent', boxShadow: 'none' }}
                >
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ color: 'text.secondary', fontWeight: 700 }}>
                          Product
                        </TableCell>
                        <TableCell align="right" sx={{ color: 'text.secondary', fontWeight: 700 }}>
                          Reorder Pt
                        </TableCell>
                        <TableCell align="right" sx={{ color: 'text.secondary', fontWeight: 700 }}>
                          Lost Sales Est.
                        </TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {(data.stockoutMetrics?.criticalSkus || []).map((item: any) => (
                        <TableRow
                          key={item.sku}
                          hover
                          sx={{ '&:last-child td, &:last-child th': { border: 0 } }}
                        >
                          <TableCell>
                            <Typography variant="body2" sx={{ fontWeight: 700 }}>
                              {item.name}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {item.sku}
                            </Typography>
                          </TableCell>
                          <TableCell align="right" sx={{ fontWeight: 600 }}>
                            {item.reorderPoint} units
                          </TableCell>
                          <TableCell align="right" sx={{ color: 'error.light', fontWeight: 700 }}>
                            {formatAmount(item.lostSalesEst || 0)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Tabbed Intelligence Section: Reorder Recommendations vs Fast/Slow Movers vs Dead Stock */}
        <Card className="glass-panel" sx={{ borderRadius: '16px', p: 3 }}>
          <CardContent>
            <Tabs
              value={activeTab}
              onChange={(_, val) => setActiveTab(val)}
              sx={{
                mb: 3,
                borderBottom: '1px solid rgba(255,255,255,0.06)',
                '& .MuiTab-root': { fontWeight: 700, textTransform: 'none', fontSize: '0.9rem' },
              }}
            >
              <Tab
                icon={<LocalShippingIcon fontSize="small" />}
                iconPosition="start"
                label="Reorder Recommendations"
              />
              <Tab
                icon={<SpeedIcon fontSize="small" />}
                iconPosition="start"
                label="Fast & Slow Movers"
              />
              <Tab
                icon={<HourglassEmptyIcon fontSize="small" />}
                iconPosition="start"
                label="Dead Stock & Idle Capital"
              />
            </Tabs>

            {activeTab === 0 && (
              <Box>
                <Typography variant="subtitle1" sx={{ fontWeight: 800, mb: 1 }}>
                  Automated Reorder Intelligence & Safety Stock
                </Typography>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ display: 'block', mb: 3 }}
                >
                  Recommendations computed with supplier lead times, safety buffer formulas &
                  current depletion velocity
                </Typography>

                <TableContainer
                  component={Paper}
                  sx={{ bgcolor: 'transparent', boxShadow: 'none' }}
                >
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ color: 'text.secondary', fontWeight: 700 }}>
                          Product / SKU
                        </TableCell>
                        <TableCell align="right" sx={{ color: 'text.secondary', fontWeight: 700 }}>
                          Current Stock
                        </TableCell>
                        <TableCell align="right" sx={{ color: 'text.secondary', fontWeight: 700 }}>
                          Lead Time
                        </TableCell>
                        <TableCell align="right" sx={{ color: 'text.secondary', fontWeight: 700 }}>
                          Recommended Qty
                        </TableCell>
                        <TableCell align="center" sx={{ color: 'text.secondary', fontWeight: 700 }}>
                          Urgency
                        </TableCell>
                        <TableCell sx={{ color: 'text.secondary', fontWeight: 700 }}>
                          Decision Rationale
                        </TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {(data.reorderRecommendations || []).map((rec: any) => (
                        <TableRow
                          key={rec.sku}
                          hover
                          sx={{ '&:last-child td, &:last-child th': { border: 0 } }}
                        >
                          <TableCell>
                            <Typography variant="body2" sx={{ fontWeight: 700 }}>
                              {rec.name}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {rec.sku}
                            </Typography>
                          </TableCell>
                          <TableCell align="right" sx={{ fontWeight: 600 }}>
                            {rec.currentStock}
                          </TableCell>
                          <TableCell align="right" sx={{ fontWeight: 600 }}>
                            {rec.leadTimeDays} days
                          </TableCell>
                          <TableCell align="right" sx={{ fontWeight: 800, color: 'primary.light' }}>
                            +{rec.recommendedQuantity} units
                          </TableCell>
                          <TableCell align="center">
                            <Chip
                              label={rec.recommendedReorderDate}
                              size="small"
                              sx={{
                                bgcolor:
                                  rec.recommendedReorderDate === 'Immediate'
                                    ? 'rgba(239, 68, 68, 0.15)'
                                    : 'rgba(245, 158, 11, 0.15)',
                                color:
                                  rec.recommendedReorderDate === 'Immediate'
                                    ? '#ef4444'
                                    : '#f59e0b',
                                fontWeight: 700,
                                fontSize: '0.72rem',
                              }}
                            />
                          </TableCell>
                          <TableCell
                            sx={{ fontSize: '0.8rem', color: 'text.secondary', maxWidth: 300 }}
                          >
                            {rec.reason}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Box>
            )}

            {activeTab === 1 && (
              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <Typography
                    variant="subtitle2"
                    sx={{ fontWeight: 800, mb: 1, color: 'success.light' }}
                  >
                    ⚡ High-Velocity Fast Movers (&lt;14 Days Supply)
                  </Typography>
                  <TableContainer
                    component={Paper}
                    sx={{ bgcolor: 'transparent', boxShadow: 'none' }}
                  >
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell sx={{ color: 'text.secondary', fontWeight: 700 }}>
                            Product
                          </TableCell>
                          <TableCell
                            align="right"
                            sx={{ color: 'text.secondary', fontWeight: 700 }}
                          >
                            Velocity/Day
                          </TableCell>
                          <TableCell
                            align="right"
                            sx={{ color: 'text.secondary', fontWeight: 700 }}
                          >
                            Days Left
                          </TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {(data.fastMoving || []).map((p: any) => (
                          <TableRow key={p.sku} hover>
                            <TableCell>
                              <Typography variant="body2" sx={{ fontWeight: 700 }}>
                                {p.name}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                {p.sku}
                              </Typography>
                            </TableCell>
                            <TableCell align="right" sx={{ fontWeight: 600 }}>
                              {p.velocityPerDay} units
                            </TableCell>
                            <TableCell
                              align="right"
                              sx={{ fontWeight: 800, color: 'warning.light' }}
                            >
                              {p.daysOfSupplyEst}d
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Grid>

                <Grid item xs={12} md={6}>
                  <Typography
                    variant="subtitle2"
                    sx={{ fontWeight: 800, mb: 1, color: 'warning.light' }}
                  >
                    🐢 Slow-Moving Inventory (60–120 Days Supply)
                  </Typography>
                  <TableContainer
                    component={Paper}
                    sx={{ bgcolor: 'transparent', boxShadow: 'none' }}
                  >
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell sx={{ color: 'text.secondary', fontWeight: 700 }}>
                            Product
                          </TableCell>
                          <TableCell
                            align="right"
                            sx={{ color: 'text.secondary', fontWeight: 700 }}
                          >
                            Current Stock
                          </TableCell>
                          <TableCell
                            align="right"
                            sx={{ color: 'text.secondary', fontWeight: 700 }}
                          >
                            Days Supply
                          </TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {(data.slowMoving || []).map((p: any) => (
                          <TableRow key={p.sku} hover>
                            <TableCell>
                              <Typography variant="body2" sx={{ fontWeight: 700 }}>
                                {p.name}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                {p.sku}
                              </Typography>
                            </TableCell>
                            <TableCell align="right" sx={{ fontWeight: 600 }}>
                              {p.stockRemaining} units
                            </TableCell>
                            <TableCell
                              align="right"
                              sx={{ fontWeight: 700, color: 'text.secondary' }}
                            >
                              {p.daysOfSupply}d
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Grid>
              </Grid>
            )}

            {activeTab === 2 && (
              <Box>
                <Typography
                  variant="subtitle1"
                  sx={{ fontWeight: 800, mb: 1, color: 'error.light' }}
                >
                  Dead Stock & Idle Working Capital (&gt;90 Days Without Sale)
                </Typography>
                <TableContainer
                  component={Paper}
                  sx={{ bgcolor: 'transparent', boxShadow: 'none' }}
                >
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ color: 'text.secondary', fontWeight: 700 }}>
                          Product / SKU
                        </TableCell>
                        <TableCell align="right" sx={{ color: 'text.secondary', fontWeight: 700 }}>
                          Stock Qty
                        </TableCell>
                        <TableCell align="right" sx={{ color: 'text.secondary', fontWeight: 700 }}>
                          Capital Tied Up
                        </TableCell>
                        <TableCell align="right" sx={{ color: 'text.secondary', fontWeight: 700 }}>
                          Holding Duration
                        </TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {(data.deadStock || []).map((p: any) => (
                        <TableRow key={p.sku} hover>
                          <TableCell>
                            <Typography variant="body2" sx={{ fontWeight: 700 }}>
                              {p.name}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {p.sku}
                            </Typography>
                          </TableCell>
                          <TableCell align="right" sx={{ fontWeight: 600 }}>
                            {p.quantity} units
                          </TableCell>
                          <TableCell align="right" sx={{ fontWeight: 800, color: 'error.light' }}>
                            {formatAmount(p.value || 0)}
                          </TableCell>
                          <TableCell align="right">
                            <Chip
                              label={`${p.holdingDays} days`}
                              size="small"
                              sx={{
                                bgcolor: 'rgba(239, 68, 68, 0.15)',
                                color: '#ef4444',
                                fontWeight: 700,
                              }}
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Box>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </Box>
  );
}
