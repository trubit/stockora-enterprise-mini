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
  TextField,
  Paper,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  Tab,
  Alert,
} from '@mui/material';
import CardGiftcardIcon from '@mui/icons-material/CardGiftcard';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import PageHeader from '../../components/PageHeader.tsx';
import { toast } from 'react-hot-toast';

export default function LoyaltyDashboard() {
  const [redeemModalOpen, setRedeemModalOpen] = useState(false);
  const [earnModalOpen, setEarnModalOpen] = useState(false);

  // Redeem state
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [redemptionType, setRedemptionType] = useState<'CUSTOM' | 'CATALOG'>('CUSTOM');
  const [selectedRewardId, setSelectedRewardId] = useState('');
  const [pointsToRedeem, setPointsToRedeem] = useState('');
  const [rewardReason, setRewardReason] = useState('');

  // Earn state
  const [earnCustomerId, setEarnCustomerId] = useState('');
  const [pointsToEarn, setPointsToEarn] = useState('500');
  const [earnReason, setEarnReason] = useState('Customer Loyalty Bonus');

  const {
    data: customers,
    isLoading: isLoadingCustomers,
    refetch: refetchCustomers,
  } = useQuery({
    queryKey: ['loyalty-customers-list'],
    queryFn: async () => {
      const res = await apiClient.get('/customers');
      return Array.isArray(res.data) ? res.data : res.data?.data || [];
    },
  });

  const {
    data: rewards,
    isLoading: isLoadingRewards,
    refetch: refetchRewards,
  } = useQuery({
    queryKey: ['loyalty-rewards-list'],
    queryFn: async () => {
      const res = await apiClient.get('/crm/loyalty/rewards');
      return res.data.data || [];
    },
  });

  const selectedCustomer = (customers || []).find((c: any) => c._id === selectedCustomerId);

  const redeemMutation = useMutation({
    mutationFn: async () => {
      if (!selectedCustomerId) {
        throw new Error('Please select a customer.');
      }

      const availablePoints = selectedCustomer?.loyaltyPoints || 0;

      if (redemptionType === 'CATALOG') {
        if (!selectedRewardId) {
          throw new Error('Please select a reward from the catalog.');
        }
        const reward = (rewards || []).find((r: any) => r._id === selectedRewardId);
        if (reward && availablePoints < reward.pointsCost) {
          throw new Error(
            `Insufficient points: Customer has ${availablePoints} pts, but reward costs ${reward.pointsCost} pts.`
          );
        }
        const res = await apiClient.post('/crm/loyalty/redeem', {
          customerId: selectedCustomerId,
          rewardId: selectedRewardId,
        });
        return res.data.data;
      } else {
        const pts = Number(pointsToRedeem);
        if (!pointsToRedeem || pts <= 0) {
          throw new Error('Please enter a valid points amount to redeem.');
        }
        if (pts > availablePoints) {
          throw new Error(
            `Insufficient points: Customer only has ${availablePoints} points available.`
          );
        }
        const res = await apiClient.post('/crm/loyalty/redeem', {
          customerId: selectedCustomerId,
          pointsToRedeem: pts,
          rewardReason: rewardReason || 'Manual Points Redemption',
        });
        return res.data.data;
      }
    },
    onSuccess: () => {
      toast.success('Loyalty points redeemed successfully!');
      setRedeemModalOpen(false);
      setPointsToRedeem('');
      setRewardReason('');
      setSelectedRewardId('');
      refetchCustomers();
      refetchRewards();
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || err.message || 'Failed to redeem points.');
    },
  });

  const earnMutation = useMutation({
    mutationFn: async () => {
      if (!earnCustomerId) {
        throw new Error('Please select a customer.');
      }
      const pts = Number(pointsToEarn);
      if (!pointsToEarn || pts <= 0) {
        throw new Error('Please enter a valid points amount to award.');
      }
      const res = await apiClient.post('/crm/loyalty/earn', {
        customerId: earnCustomerId,
        points: pts,
        reason: earnReason || 'Loyalty Points Credit',
      });
      return res.data.data;
    },
    onSuccess: () => {
      toast.success('Loyalty points awarded successfully!');
      setEarnModalOpen(false);
      refetchCustomers();
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || err.message || 'Failed to award points.');
    },
  });

  const handleOpenRedeemWithReward = (reward: any) => {
    setRedemptionType('CATALOG');
    setSelectedRewardId(reward._id);
    setRedeemModalOpen(true);
  };

  const handleOpenAwardPoints = (cust?: any) => {
    if (cust?._id) {
      setEarnCustomerId(cust._id);
    } else if (customers && customers.length > 0) {
      setEarnCustomerId(customers[0]._id);
    }
    setEarnModalOpen(true);
  };

  return (
    <Box sx={{ p: 3 }}>
      <PageHeader
        title="Loyalty Program & Rewards System"
        subtitle="Tier Thresholds (Bronze, Silver, Gold, Platinum), Points Earning & Catalog Redemptions"
      />

      {/* Tier Multiplier Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Paper
            variant="outlined"
            sx={{ p: 2, textAlign: 'center', borderLeft: '4px solid #cd7f32' }}
          >
            <Typography variant="subtitle2" color="textSecondary">
              Bronze Tier
            </Typography>
            <Typography variant="h6">0 - 499 Points</Typography>
            <Typography variant="caption" color="textSecondary">
              Base 1.0x Point Earning
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Paper
            variant="outlined"
            sx={{ p: 2, textAlign: 'center', borderLeft: '4px solid #c0c0c0' }}
          >
            <Typography variant="subtitle2" color="textSecondary">
              Silver Tier
            </Typography>
            <Typography variant="h6">500 - 1,999 Points</Typography>
            <Typography variant="caption" color="textSecondary">
              1.25x Multiplier
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Paper
            variant="outlined"
            sx={{ p: 2, textAlign: 'center', borderLeft: '4px solid #ffd700' }}
          >
            <Typography variant="subtitle2" color="textSecondary">
              Gold Tier
            </Typography>
            <Typography variant="h6">2,000 - 4,999 Points</Typography>
            <Typography variant="caption" color="textSecondary">
              1.5x Multiplier
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Paper
            variant="outlined"
            sx={{ p: 2, textAlign: 'center', borderLeft: '4px solid #e5e4e2' }}
          >
            <Typography variant="subtitle2" color="textSecondary">
              Platinum Tier
            </Typography>
            <Typography variant="h6">5,000+ Points</Typography>
            <Typography variant="caption" color="textSecondary">
              2.0x Double Multiplier
            </Typography>
          </Paper>
        </Grid>
      </Grid>

      <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2, mb: 3 }}>
        <Button
          variant="outlined"
          color="primary"
          startIcon={<AddCircleOutlineIcon />}
          onClick={() => handleOpenAwardPoints()}
        >
          Award / Add Points
        </Button>
        <Button
          variant="contained"
          startIcon={<CardGiftcardIcon />}
          onClick={() => {
            setRedemptionType('CUSTOM');
            setRedeemModalOpen(true);
          }}
        >
          Redeem Rewards Points
        </Button>
      </Box>

      {/* Rewards Catalog */}
      <Card sx={{ mb: 4 }}>
        <CardContent>
          <Box
            sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}
          >
            <Typography variant="h6" fontWeight={600}>
              Rewards Catalogue
            </Typography>
            <Button size="small" onClick={() => refetchRewards()}>
              Refresh
            </Button>
          </Box>

          {isLoadingRewards ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
              <CircularProgress />
            </Box>
          ) : (rewards || []).length === 0 ? (
            <Paper variant="outlined" sx={{ p: 3, textAlign: 'center' }}>
              <Typography color="textSecondary">
                No specific rewards catalog items configured yet.
              </Typography>
            </Paper>
          ) : (
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead sx={{ bgcolor: '#f8fafc' }}>
                  <TableRow>
                    <TableCell>Reward Name / Code</TableCell>
                    <TableCell>Description</TableCell>
                    <TableCell align="right">Points Cost</TableCell>
                    <TableCell>Minimum Tier</TableCell>
                    <TableCell align="right">Redeemed Count</TableCell>
                    <TableCell align="center">Action</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rewards.map((r: any) => (
                    <TableRow key={r._id}>
                      <TableCell>
                        <Typography variant="subtitle2">{r.name}</Typography>
                        <Typography variant="caption" color="textSecondary">
                          {r.code}
                        </Typography>
                      </TableCell>
                      <TableCell>{r.description || 'N/A'}</TableCell>
                      <TableCell align="right">
                        <Typography fontWeight={700} color="primary.main">
                          {r.pointsCost} pts
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={r.minimumTier}
                          size="small"
                          color={r.minimumTier === 'PLATINUM' ? 'warning' : 'default'}
                        />
                      </TableCell>
                      <TableCell align="right">{r.redeemedCount || 0}</TableCell>
                      <TableCell align="center">
                        <Button
                          size="small"
                          variant="outlined"
                          startIcon={<CardGiftcardIcon />}
                          onClick={() => handleOpenRedeemWithReward(r)}
                        >
                          Redeem
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>

      {/* Customer Loyalty Accounts */}
      <Card>
        <CardContent>
          <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>
            Customer Loyalty Accounts
          </Typography>

          {isLoadingCustomers ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
              <CircularProgress />
            </Box>
          ) : (
            <Grid container spacing={2}>
              {(customers || []).map((cust: any) => (
                <Grid item xs={12} sm={6} md={4} key={cust._id}>
                  <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                      <Typography variant="subtitle1" fontWeight={600}>
                        {cust.name}
                      </Typography>
                      <Chip label={cust.loyaltyTier || 'BRONZE'} size="small" color="warning" />
                    </Box>
                    <Typography variant="caption" color="textSecondary" display="block">
                      Email: {cust.email}
                    </Typography>
                    <Box
                      sx={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        mt: 1,
                      }}
                    >
                      <Typography variant="h6" color="primary.main" sx={{ fontWeight: 700 }}>
                        {cust.loyaltyPoints || 0} Points
                      </Typography>
                      <Button
                        size="small"
                        variant="text"
                        onClick={() => handleOpenAwardPoints(cust)}
                      >
                        + Add Pts
                      </Button>
                    </Box>
                  </Paper>
                </Grid>
              ))}
            </Grid>
          )}
        </CardContent>
      </Card>

      {/* Redeem Points Modal */}
      <Dialog
        open={redeemModalOpen}
        onClose={() => setRedeemModalOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Redeem Loyalty Points</DialogTitle>
        <DialogContent>
          <FormControl fullWidth size="small" sx={{ mb: 2, mt: 1 }}>
            <InputLabel>Select Customer</InputLabel>
            <Select
              value={selectedCustomerId}
              label="Select Customer"
              onChange={(e) => setSelectedCustomerId(e.target.value)}
            >
              {(customers || []).map((c: any) => (
                <MenuItem key={c._id} value={c._id}>
                  {c.name} ({c.loyaltyPoints || 0} Points Available - {c.loyaltyTier || 'BRONZE'})
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {selectedCustomer && (selectedCustomer.loyaltyPoints || 0) <= 0 && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              This customer currently has 0 loyalty points. Click "Award / Add Points" to credit
              them points before redeeming.
            </Alert>
          )}

          <Tabs
            value={redemptionType}
            onChange={(_, val) => setRedemptionType(val)}
            sx={{ mb: 2, borderBottom: 1, borderColor: 'divider' }}
          >
            <Tab label="Custom Points Redemption" value="CUSTOM" />
            <Tab
              label="Catalog Reward"
              value="CATALOG"
              disabled={!rewards || rewards.length === 0}
            />
          </Tabs>

          {redemptionType === 'CATALOG' ? (
            <FormControl fullWidth size="small" sx={{ mb: 2 }}>
              <InputLabel>Select Catalog Reward</InputLabel>
              <Select
                value={selectedRewardId}
                label="Select Catalog Reward"
                onChange={(e) => setSelectedRewardId(e.target.value)}
              >
                {(rewards || []).map((r: any) => (
                  <MenuItem key={r._id} value={r._id}>
                    {r.name} - {r.pointsCost} Points ({r.minimumTier}+)
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          ) : (
            <>
              <TextField
                fullWidth
                type="number"
                label="Points to Redeem"
                helperText={
                  selectedCustomer
                    ? `Max available: ${selectedCustomer.loyaltyPoints || 0} points`
                    : ''
                }
                value={pointsToRedeem}
                onChange={(e) => setPointsToRedeem(e.target.value)}
                sx={{ mb: 2 }}
              />
              <TextField
                fullWidth
                label="Reward / Reason (e.g., $10 Store Voucher)"
                value={rewardReason}
                onChange={(e) => setRewardReason(e.target.value)}
              />
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRedeemModalOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            disabled={
              redeemMutation.isPending ||
              !selectedCustomerId ||
              (selectedCustomer && (selectedCustomer.loyaltyPoints || 0) <= 0)
            }
            onClick={() => redeemMutation.mutate()}
          >
            {redeemMutation.isPending ? <CircularProgress size={20} /> : 'Confirm Redemption'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Award / Add Points Modal */}
      <Dialog open={earnModalOpen} onClose={() => setEarnModalOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Award Loyalty Points</DialogTitle>
        <DialogContent>
          <FormControl fullWidth size="small" sx={{ mb: 2, mt: 1 }}>
            <InputLabel>Select Customer</InputLabel>
            <Select
              value={earnCustomerId}
              label="Select Customer"
              onChange={(e) => setEarnCustomerId(e.target.value)}
            >
              {(customers || []).map((c: any) => (
                <MenuItem key={c._id} value={c._id}>
                  {c.name} (Current: {c.loyaltyPoints || 0} pts - {c.loyaltyTier || 'BRONZE'})
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            fullWidth
            type="number"
            label="Points to Award"
            value={pointsToEarn}
            onChange={(e) => setPointsToEarn(e.target.value)}
            sx={{ mb: 2 }}
          />
          <TextField
            fullWidth
            label="Reason / Note (e.g., VIP Welcome Bonus, Store Promotion)"
            value={earnReason}
            onChange={(e) => setEarnReason(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEarnModalOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            disabled={earnMutation.isPending || !earnCustomerId}
            onClick={() => earnMutation.mutate()}
          >
            {earnMutation.isPending ? <CircularProgress size={20} /> : 'Award Points'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
