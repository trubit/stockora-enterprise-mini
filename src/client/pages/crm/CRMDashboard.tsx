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
import PeopleIcon from '@mui/icons-material/People';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import WarningIcon from '@mui/icons-material/Warning';
import CampaignIcon from '@mui/icons-material/Campaign';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import PageHeader from '../../components/PageHeader.tsx';
import StatCard from '../../components/StatCard.tsx';
import { toast } from 'react-hot-toast';
import { useRegionalSettings } from '../../hooks/useRegionalSettings.js';

export default function CRMDashboard() {
  const { formatAmount } = useRegionalSettings();
  const [copilotPrompt, setCopilotPrompt] = useState('');
  const [copilotReply, setCopilotReply] = useState('');
  const [isCopilotLoading, setIsCopilotLoading] = useState(false);

  const {
    data: dashboardData,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['crm-dashboard'],
    queryFn: async () => {
      const res = await apiClient.get('/crm/dashboard');
      return res.data.data;
    },
  });

  const handleAskCopilot = async () => {
    if (!copilotPrompt.trim()) return;
    setIsCopilotLoading(true);
    try {
      const res = await apiClient.post('/crm/copilot/query', {
        prompt: copilotPrompt,
      });
      setCopilotReply(res.data.data.answer);
      toast.success('CRM AI Insights updated!');
    } catch {
      toast.error('Failed to contact CRM AI Copilot.');
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
        title="Enterprise CRM & Customer Intelligence"
        subtitle="Customer 360, Churn Analytics, Dynamic Segmentation & Marketing Automation"
      />

      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Total Customers"
            value={kpis.totalCustomers || 0}
            subtitle="Active Directory"
            icon={<PeopleIcon color="primary" />}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="VIP (Platinum)"
            value={kpis.vipCustomers || 0}
            subtitle="Top Tier Loyalty"
            icon={<EmojiEventsIcon color="warning" />}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="At-Risk Customers"
            value={kpis.atRiskCustomers || 0}
            subtitle="High Churn Risk"
            icon={<WarningIcon color="error" />}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Active Campaigns"
            value={kpis.activeCampaigns || 0}
            subtitle="Marketing Automation"
            icon={<CampaignIcon color="success" />}
          />
        </Grid>
      </Grid>

      {/* AI Copilot CRM Query */}
      <Card
        sx={{
          mb: 4,
          background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)',
          color: '#fff',
        }}
      >
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <SmartToyIcon color="primary" />
            <Typography variant="h6" sx={{ color: '#c084fc', fontWeight: 600 }}>
              AI Customer Intelligence Assistant
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField
              fullWidth
              size="small"
              placeholder="Ask Copilot e.g., 'Who are my top spending customers?' or 'Suggest campaign for at-risk users'"
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
              <Typography variant="subtitle2" sx={{ color: '#a855f7', fontWeight: 600, mb: 1 }}>
                AI CRM Recommendation:
              </Typography>
              <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                {copilotReply}
              </Typography>
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Top Valuable Customers */}
      <Card>
        <CardContent>
          <Box
            sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}
          >
            <Typography variant="h6" fontWeight={600}>
              Top Valuable Customers (By Total Spending)
            </Typography>
            <Button size="small" onClick={() => refetch()}>
              Refresh
            </Button>
          </Box>
          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead sx={{ bgcolor: '#f8fafc' }}>
                <TableRow>
                  <TableCell>Customer Name / Code</TableCell>
                  <TableCell>Email / Phone</TableCell>
                  <TableCell align="right">Total Orders</TableCell>
                  <TableCell align="right">Total Spending</TableCell>
                  <TableCell align="right">CLV Score</TableCell>
                  <TableCell>Loyalty Tier</TableCell>
                  <TableCell>Churn Risk</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {(dashboardData?.topCustomers || []).map((c: any) => (
                  <TableRow key={c._id}>
                    <TableCell>
                      <Typography variant="subtitle2">{c.name}</Typography>
                      <Typography variant="caption" color="textSecondary">
                        {c.code}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">{c.email}</Typography>
                      <Typography variant="caption" color="textSecondary">
                        {c.phone || 'N/A'}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">{c.totalOrders || 0}</TableCell>
                    <TableCell align="right">{formatAmount(c.totalSpending || 0)}</TableCell>
                    <TableCell align="right">
                      <Typography fontWeight={600} color="primary.main">
                        {formatAmount(c.clvScore || 0)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={c.loyaltyTier}
                        size="small"
                        color={c.loyaltyTier === 'PLATINUM' ? 'warning' : 'default'}
                      />
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={c.churnRiskLevel || 'LOW'}
                        size="small"
                        color={
                          c.churnRiskLevel === 'CRITICAL'
                            ? 'error'
                            : c.churnRiskLevel === 'HIGH'
                              ? 'warning'
                              : 'success'
                        }
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>
    </Box>
  );
}
