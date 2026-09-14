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
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Alert,
} from '@mui/material';
import WarningIcon from '@mui/icons-material/Warning';
import LoopIcon from '@mui/icons-material/Loop';
import SendIcon from '@mui/icons-material/Send';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import PageHeader from '../../components/PageHeader.tsx';
import StatCard from '../../components/StatCard.tsx';
import { toast } from 'react-hot-toast';
import { useRegionalSettings } from '../../hooks/useRegionalSettings.js';

export default function CustomerRetention() {
  const { formatAmount } = useRegionalSettings();
  const [winBackModalOpen, setWinBackModalOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [couponCode, setCouponCode] = useState('WINBACK20');
  const [isSending, setIsSending] = useState(false);

  const {
    data: retentionData,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['crm-retention-radar'],
    queryFn: async () => {
      const res = await apiClient.get('/crm/retention');
      return res.data.data;
    },
  });

  const handleOpenWinBack = (cust: any) => {
    setSelectedCustomer(cust);
    setWinBackModalOpen(true);
  };

  const handleSendWinBack = async () => {
    if (!selectedCustomer) return;
    setIsSending(true);
    try {
      await apiClient.post('/crm/campaigns', {
        title: `Exclusive Win-Back Offer for ${selectedCustomer.name}`,
        type: 'WIN_BACK',
        channel: 'EMAIL',
        messageTemplate: `Hi ${selectedCustomer.name}, we miss you! Use code ${couponCode} for 20% off your next purchase.`,
        couponCode,
      });
      toast.success(`Win-Back Campaign created for ${selectedCustomer.name}!`);
      setWinBackModalOpen(false);
    } catch {
      toast.error('Failed to create win-back campaign.');
    } finally {
      setIsSending(false);
    }
  };

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  const kpis = retentionData?.kpis || {};
  const winBackCandidates = retentionData?.winBackCandidates || [];
  const nextBestActions = retentionData?.nextBestActions || [];

  return (
    <Box sx={{ p: 3 }}>
      <PageHeader
        title="Customer Retention & Churn Intelligence"
        subtitle="AI-driven churn signals, inactive win-back automation & Next-Best-Action recommendations"
      />

      {/* KPI Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Repeat Purchase Rate"
            value={`${kpis.repeatPurchaseRate || 0}%`}
            subtitle="Customer Loyalty Ratio"
            icon={<LoopIcon color="primary" />}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="At-Risk Customers"
            value={kpis.atRiskCustomers || 0}
            subtitle="High / Critical Churn"
            icon={<WarningIcon color="error" />}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Average Lifetime Value (CLV)"
            value={formatAmount(kpis.averageCLV || 0)}
            subtitle="Historical Value Score"
            icon={<AutoAwesomeIcon color="success" />}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Active vs Inactive"
            value={`${kpis.activeCustomers || 0} / ${kpis.inactiveCustomers || 0}`}
            subtitle="Active Ratio"
            icon={<LoopIcon color="info" />}
          />
        </Grid>
      </Grid>

      {/* Next-Best-Action Recommendations */}
      <Card sx={{ mb: 4, borderRadius: 2, boxShadow: 2 }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <AutoAwesomeIcon color="primary" />
            <Typography variant="h6" fontWeight={600}>
              AI Next-Best-Action Retention Radar
            </Typography>
          </Box>
          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead sx={{ bgcolor: '#f8fafc' }}>
                <TableRow>
                  <TableCell>Customer</TableCell>
                  <TableCell>Recommended Action</TableCell>
                  <TableCell>AI Rationale</TableCell>
                  <TableCell>Urgency</TableCell>
                  <TableCell align="right">Estimated Impact</TableCell>
                  <TableCell align="center">Action</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {nextBestActions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} align="center" sx={{ py: 3 }}>
                      All customer relationships are healthy. No urgent retention actions required!
                    </TableCell>
                  </TableRow>
                ) : (
                  nextBestActions.map((nba: any, idx: number) => (
                    <TableRow key={idx}>
                      <TableCell sx={{ fontWeight: 'bold' }}>{nba.customerName}</TableCell>
                      <TableCell>
                        <Chip
                          label={nba.recommendedAction.replace(/_/g, ' ')}
                          size="small"
                          color={nba.urgency === 'HIGH' ? 'error' : 'primary'}
                        />
                      </TableCell>
                      <TableCell>{nba.rationale}</TableCell>
                      <TableCell>
                        <Chip
                          label={nba.urgency}
                          size="small"
                          variant="outlined"
                          color={
                            nba.urgency === 'HIGH'
                              ? 'error'
                              : nba.urgency === 'MEDIUM'
                                ? 'warning'
                                : 'default'
                          }
                        />
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold', color: 'success.main' }}>
                        +${nba.estimatedImpactRevenue}
                      </TableCell>
                      <TableCell align="center">
                        <Button
                          size="small"
                          variant="contained"
                          onClick={() =>
                            handleOpenWinBack({ name: nba.customerName, id: nba.customerId })
                          }
                        >
                          Execute
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      {/* Inactive Win-Back Candidates Table */}
      <Card sx={{ borderRadius: 2, boxShadow: 2 }}>
        <CardContent>
          <Box
            sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}
          >
            <Typography variant="h6" fontWeight={600}>
              Inactive Win-Back Candidates (No Purchase &gt; 45 Days)
            </Typography>
            <Button size="small" onClick={() => refetch()}>
              Refresh Radar
            </Button>
          </Box>
          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead sx={{ bgcolor: '#f8fafc' }}>
                <TableRow>
                  <TableCell>Customer</TableCell>
                  <TableCell>Email</TableCell>
                  <TableCell align="right">Total Orders</TableCell>
                  <TableCell align="right">Total Spend</TableCell>
                  <TableCell>Last Purchase Date</TableCell>
                  <TableCell>Churn Level</TableCell>
                  <TableCell align="center">Win-Back</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {winBackCandidates.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} align="center" sx={{ py: 3 }}>
                      No inactive customers detected.
                    </TableCell>
                  </TableRow>
                ) : (
                  winBackCandidates.map((c: any) => (
                    <TableRow key={c._id}>
                      <TableCell sx={{ fontWeight: 'bold' }}>{c.name}</TableCell>
                      <TableCell>{c.email}</TableCell>
                      <TableCell align="right">{c.totalOrders}</TableCell>
                      <TableCell align="right">{formatAmount(c.totalSpending || 0)}</TableCell>
                      <TableCell>
                        {c.lastPurchaseDate
                          ? new Date(c.lastPurchaseDate).toLocaleDateString()
                          : 'Never'}
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={c.churnRiskLevel}
                          size="small"
                          color={c.churnRiskLevel === 'CRITICAL' ? 'error' : 'warning'}
                        />
                      </TableCell>
                      <TableCell align="center">
                        <Button
                          size="small"
                          variant="outlined"
                          startIcon={<SendIcon />}
                          onClick={() => handleOpenWinBack(c)}
                        >
                          Recover
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      {/* Win-Back Modal */}
      <Dialog
        open={winBackModalOpen}
        onClose={() => setWinBackModalOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 'bold' }}>
          Dispatch Win-Back Campaign for {selectedCustomer?.name}
        </DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          <Alert severity="info">
            This will schedule an automated personalized win-back offer to re-activate this
            customer.
          </Alert>
          <TextField
            label="Incentive Coupon Code"
            value={couponCode}
            onChange={(e) => setCouponCode(e.target.value)}
            fullWidth
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setWinBackModalOpen(false)} disabled={isSending}>
            Cancel
          </Button>
          <Button variant="contained" onClick={handleSendWinBack} disabled={isSending}>
            {isSending ? 'Dispatching...' : 'Dispatch Win-Back'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
