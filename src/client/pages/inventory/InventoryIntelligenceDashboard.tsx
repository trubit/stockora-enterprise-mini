import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../api/client.ts';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Button,
  TextField,
  CircularProgress,
} from '@mui/material';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import AssessmentIcon from '@mui/icons-material/Assessment';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import PageHeader from '../../components/PageHeader.tsx';
import StatCard from '../../components/StatCard.tsx';
import { toast } from 'react-hot-toast';

export default function InventoryIntelligenceDashboard() {
  const [copilotPrompt, setCopilotPrompt] = useState('');
  const [copilotReply, setCopilotReply] = useState('');
  const [isCopilotLoading, setIsCopilotLoading] = useState(false);

  const {
    data: dashboardData,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['inventory-intelligence-dashboard'],
    queryFn: async () => {
      const res = await apiClient.get('/inventory-intelligence/dashboard');
      return res.data.data;
    },
  });

  const handleAskCopilot = async () => {
    if (!copilotPrompt.trim()) return;
    setIsCopilotLoading(true);
    try {
      const res = await apiClient.post('/inventory-intelligence/copilot/query', {
        prompt: copilotPrompt,
      });
      setCopilotReply(res.data.data.answer);
      toast.success('AI Insights updated!');
    } catch {
      toast.error('Failed to contact Inventory AI Copilot.');
    } finally {
      setIsCopilotLoading(false);
    }
  };

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  const kpis = dashboardData?.kpis || {};

  return (
    <Box sx={{ p: 3 }}>
      <PageHeader
        title="Inventory Intelligence & Forecasting"
        subtitle="Predictive Analytics, Smart Replenishment & Procurement Optimization"
      />

      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Stockout Risks"
            value={kpis.totalStockoutRisks || 0}
            subtitle={`${kpis.criticalRisks || 0} Critical`}
            icon={<WarningAmberIcon color="error" />}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Pending Reorders"
            value={kpis.pendingReordersCount || 0}
            subtitle="Smart Replenishment"
            icon={<LocalShippingIcon color="primary" />}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Overstock Items"
            value={kpis.overstockItemsCount || 0}
            subtitle="Excess Capital"
            icon={<TrendingUpIcon color="warning" />}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Avg Supplier Score"
            value={`${kpis.avgSupplierScore || 85}%`}
            subtitle="Performance Index"
            icon={<AssessmentIcon color="success" />}
          />
        </Grid>
      </Grid>

      {/* AI Copilot Query Box */}
      <Card
        sx={{
          mb: 4,
          background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
          color: '#fff',
        }}
      >
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <SmartToyIcon color="primary" />
            <Typography variant="h6" sx={{ color: '#93c5fd', fontWeight: 600 }}>
              AI Inventory Intelligence Assistant
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField
              fullWidth
              size="small"
              placeholder="Ask Copilot e.g., 'Which items run out next week?' or 'Summarize supplier performance'"
              value={copilotPrompt}
              onChange={(e) => setCopilotPrompt(e.target.value)}
              sx={{ bg: '#ffffff', borderRadius: 1, input: { color: '#fff' } }}
            />
            <Button
              variant="contained"
              disabled={isCopilotLoading}
              onClick={handleAskCopilot}
              sx={{ minWidth: 120 }}
            >
              {isCopilotLoading ? <CircularProgress size={20} color="inherit" /> : 'Ask AI'}
            </Button>
          </Box>
          {copilotReply && (
            <Box sx={{ mt: 2, p: 2, bgcolor: 'rgba(255,255,255,0.08)', borderRadius: 1 }}>
              <Typography variant="subtitle2" sx={{ color: '#60a5fa', fontWeight: 600, mb: 1 }}>
                AI Recommendation:
              </Typography>
              <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                {copilotReply}
              </Typography>
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Reorder Recommendations */}
      <Card sx={{ mb: 4 }}>
        <CardContent>
          <Box
            sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}
          >
            <Typography variant="h6" fontWeight={600}>
              Top Smart Reorder Recommendations
            </Typography>
            <Button size="small" onClick={() => refetch()}>
              Refresh
            </Button>
          </Box>
          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead sx={{ bgcolor: '#f8fafc' }}>
                <TableRow>
                  <TableCell>SKU / Name</TableCell>
                  <TableCell align="right">Current Stock</TableCell>
                  <TableCell align="right">Reorder Point</TableCell>
                  <TableCell align="right">Safety Stock</TableCell>
                  <TableCell align="right">Recommended Qty</TableCell>
                  <TableCell>Primary Supplier</TableCell>
                  <TableCell>Status</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {(dashboardData?.recommendations || []).map((rec: any) => (
                  <TableRow key={rec._id}>
                    <TableCell>
                      <Typography variant="subtitle2">{rec.productSku}</Typography>
                      <Typography variant="caption" color="textSecondary">
                        {rec.productName}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">{rec.currentStock}</TableCell>
                    <TableCell align="right">{rec.reorderPoint}</TableCell>
                    <TableCell align="right">{rec.safetyStock}</TableCell>
                    <TableCell align="right">
                      <Typography fontWeight={600} color="primary.main">
                        {rec.recommendedQuantity}
                      </Typography>
                    </TableCell>
                    <TableCell>{rec.supplierName || 'Default Supplier'}</TableCell>
                    <TableCell>
                      <Chip
                        label={rec.status}
                        size="small"
                        color={rec.status === 'RECOMMENDED' ? 'warning' : 'success'}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      {/* Supplier Performance */}
      <Card>
        <CardContent>
          <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>
            Supplier Performance Scorecards
          </Typography>
          <Grid container spacing={2}>
            {(dashboardData?.supplierScores || []).map((supplier: any) => (
              <Grid item xs={12} sm={6} md={4} key={supplier._id}>
                <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="subtitle1" fontWeight={600}>
                      {supplier.supplierName || 'Supplier'}
                    </Typography>
                    <Chip
                      label={`${supplier.overallScore}%`}
                      color={supplier.overallScore >= 80 ? 'success' : 'warning'}
                      size="small"
                    />
                  </Box>
                  <Typography variant="caption" color="textSecondary" display="block">
                    Lead Time: {supplier.avgLeadTimeDays} days | Fill Rate: {supplier.fillRateScore}
                    %
                  </Typography>
                  <Typography variant="caption" color="textSecondary" display="block">
                    Risk Tier: {supplier.riskTier}
                  </Typography>
                </Paper>
              </Grid>
            ))}
          </Grid>
        </CardContent>
      </Card>
    </Box>
  );
}
