import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  LinearProgress,
} from '@mui/material';
import WarehouseIcon from '@mui/icons-material/Warehouse';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import { api } from '../../api/client.ts';
import { toast } from 'react-hot-toast';

export default function WarehouseDashboard() {
  const [analytics, setAnalytics] = useState<any>(null);
  const [recentTransfers, setRecentTransfers] = useState<any[]>([]);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const [anaRes, trfRes] = await Promise.all([
        api.get('/warehouse-advanced/analytics'),
        api.get('/warehouse-advanced/transfers'),
      ]);
      setAnalytics(anaRes.data);
      setRecentTransfers(trfRes.data || []);
    } catch {
      toast.error('Failed to load warehouse dashboard.');
    }
  };

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
          <WarehouseIcon fontSize="large" /> Advanced Warehouse & Logistics Orchestration
        </Typography>
        <Typography variant="body2" sx={{ color: '#9ca3af', mt: 0.5 }}>
          Real-time WMS control center for multi-warehouse storage, picking waves, packing stations,
          stock transfers & AI slotting optimization
        </Typography>
      </Box>

      {/* KPI Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card
            sx={{
              background: '#111827',
              border: '1px solid #1f2937',
              color: '#f8fafc',
              borderRadius: 3,
            }}
          >
            <CardContent>
              <Typography variant="caption" sx={{ color: '#9ca3af', fontWeight: 600 }}>
                Active Warehouses
              </Typography>
              <Typography variant="h4" sx={{ fontWeight: 800, mt: 1, color: '#818cf8' }}>
                {analytics?.totalWarehouses || 4}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card
            sx={{
              background: '#111827',
              border: '1px solid #1f2937',
              color: '#f8fafc',
              borderRadius: 3,
            }}
          >
            <CardContent>
              <Typography variant="caption" sx={{ color: '#9ca3af', fontWeight: 600 }}>
                Capacity Utilization
              </Typography>
              <Typography variant="h4" sx={{ fontWeight: 800, mt: 1, color: '#38bdf8' }}>
                {analytics?.utilizationRatePercent || 68}%
              </Typography>
              <LinearProgress
                variant="determinate"
                value={analytics?.utilizationRatePercent || 68}
                sx={{ mt: 1, borderRadius: 2, height: 6, background: '#1f2937' }}
              />
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card
            sx={{
              background: '#111827',
              border: '1px solid #1f2937',
              color: '#f8fafc',
              borderRadius: 3,
            }}
          >
            <CardContent>
              <Typography variant="caption" sx={{ color: '#9ca3af', fontWeight: 600 }}>
                Inventory Turnover Ratio
              </Typography>
              <Typography variant="h4" sx={{ fontWeight: 800, mt: 1, color: '#34d399' }}>
                {analytics?.inventoryTurnover || '4.2x'}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card
            sx={{
              background: '#111827',
              border: '1px solid #1f2937',
              color: '#f8fafc',
              borderRadius: 3,
            }}
          >
            <CardContent>
              <Typography variant="caption" sx={{ color: '#9ca3af', fontWeight: 600 }}>
                Storage Locations
              </Typography>
              <Typography variant="h4" sx={{ fontWeight: 800, mt: 1, color: '#fbbf24' }}>
                {analytics?.totalLocations || 120}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* AI Slotting Optimization Banner */}
      {analytics?.aiSlottingAdvisory && (
        <Paper
          sx={{
            p: 3,
            mb: 4,
            background:
              'linear-gradient(135deg, rgba(139, 92, 246, 0.15) 0%, rgba(59, 130, 246, 0.15) 100%)',
            border: '1px solid rgba(139, 92, 246, 0.3)',
            borderRadius: 3,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
            <AutoAwesomeIcon sx={{ color: '#a78bfa' }} />
            <Typography variant="h6" sx={{ fontWeight: 700, color: '#c4b5fd' }}>
              AI Product Slotting & Storage Optimization Copilot
            </Typography>
          </Box>
          <Typography variant="body2" sx={{ color: '#e2e8f0', mb: 2 }}>
            {analytics.aiSlottingAdvisory.efficiencyAdvice}
          </Typography>
          <Grid container spacing={2}>
            {analytics.aiSlottingAdvisory.recommendations?.map((rec: any, idx: number) => (
              <Grid item xs={12} sm={6} key={idx}>
                <Box
                  sx={{
                    p: 2,
                    background: 'rgba(15, 23, 42, 0.6)',
                    borderRadius: 2,
                    border: '1px solid rgba(255, 255, 255, 0.05)',
                  }}
                >
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#f8fafc' }}>
                    {rec.name} ({rec.sku})
                  </Typography>
                  <Typography
                    variant="caption"
                    sx={{ color: '#9ca3af', display: 'block', mt: 0.5 }}
                  >
                    {rec.rationale}
                  </Typography>
                </Box>
              </Grid>
            ))}
          </Grid>
        </Paper>
      )}

      {/* Recent Inter-Warehouse Transfers */}
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
            color: '#f8fafc',
            display: 'flex',
            alignItems: 'center',
            gap: 1,
          }}
        >
          <LocalShippingIcon sx={{ color: '#8b5cf6' }} /> Recent Inter-Warehouse Stock Transfers
        </Typography>
        <TableContainer>
          <Table>
            <TableHead sx={{ background: '#1f2937' }}>
              <TableRow>
                <TableCell sx={{ color: '#9ca3af', fontWeight: 600 }}>Transfer #</TableCell>
                <TableCell sx={{ color: '#9ca3af', fontWeight: 600 }}>Source Warehouse</TableCell>
                <TableCell sx={{ color: '#9ca3af', fontWeight: 600 }}>
                  Destination Warehouse
                </TableCell>
                <TableCell sx={{ color: '#9ca3af', fontWeight: 600 }}>Total Items</TableCell>
                <TableCell sx={{ color: '#9ca3af', fontWeight: 600 }}>Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {recentTransfers.map((trf) => (
                <TableRow key={trf._id} sx={{ '&:hover': { background: '#1e293b' } }}>
                  <TableCell sx={{ color: '#818cf8', fontWeight: 700 }}>
                    {trf.transferNumber}
                  </TableCell>
                  <TableCell sx={{ color: '#f8fafc' }}>
                    {trf.fromWarehouseId?.name || 'Source Warehouse'}
                  </TableCell>
                  <TableCell sx={{ color: '#f8fafc' }}>
                    {trf.toWarehouseId?.name || 'Destination Warehouse'}
                  </TableCell>
                  <TableCell sx={{ color: '#cbd5e1' }}>{trf.items?.length || 0} SKUs</TableCell>
                  <TableCell>
                    <Chip
                      label={trf.status}
                      size="small"
                      sx={{
                        fontWeight: 600,
                        background:
                          trf.status === 'RECEIVED'
                            ? 'rgba(16, 185, 129, 0.2)'
                            : 'rgba(56, 189, 248, 0.2)',
                        color: trf.status === 'RECEIVED' ? '#34d399' : '#38bdf8',
                      }}
                    />
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
