import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  Grid,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControlLabel,
  Checkbox,
  MenuItem,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  useTheme,
  IconButton,
} from '@mui/material';
import AccountBalanceWallet from '@mui/icons-material/AccountBalanceWallet';
import TrendingUp from '@mui/icons-material/TrendingUp';
import Apartment from '@mui/icons-material/Apartment';
import HourglassEmpty from '@mui/icons-material/HourglassEmpty';
import Edit from '@mui/icons-material/Edit';
import Sync from '@mui/icons-material/Sync';
import Close from '@mui/icons-material/Close';
import { apiClient } from '../../api/client.ts';
import { toast } from 'react-hot-toast';
import PageHeader from '../../components/PageHeader.tsx';
import StatCard from '../../components/StatCard.tsx';
import StatusChip from '../../components/StatusChip.tsx';
import { useRegionalSettings } from '../../hooks/useRegionalSettings.js';

export const PlatformBillingAdmin: React.FC = () => {
  const { formatAmount } = useRegionalSettings();
  const [metrics, setMetrics] = useState<any>(null);
  const [plans, setPlans] = useState<any[]>([]);
  const [subscriptions, setSubscriptions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editPlanModal, setEditPlanModal] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<any>(null);
  const [savingPlan, setSavingPlan] = useState(false);

  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  useEffect(() => {
    fetchAdminBillingData();
  }, []);

  const fetchAdminBillingData = async () => {
    const token = localStorage.getItem('stockora_mini_token');
    if (!token) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      const [metricsRes, plansRes, subsRes] = await Promise.all([
        apiClient.get('/billing/admin/metrics'),
        apiClient.get('/billing/admin/plans'),
        apiClient.get('/billing/admin/subscriptions'),
      ]);

      if (metricsRes.data?.success) setMetrics(metricsRes.data.data);
      if (plansRes.data?.success) setPlans(plansRes.data.data);
      if (subsRes.data?.success) setSubscriptions(subsRes.data.data);
    } catch {
      toast.error('Failed to load platform billing data');
    } finally {
      setLoading(false);
    }
  };

  const handleSavePlan = async () => {
    if (!selectedPlan) return;
    try {
      setSavingPlan(true);
      const res = await apiClient.put(`/billing/admin/plans/${selectedPlan._id}`, selectedPlan);

      if (res.data?.success) {
        toast.success('Plan configuration updated successfully!');
        setEditPlanModal(false);
        fetchAdminBillingData();
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to update plan');
    } finally {
      setSavingPlan(false);
    }
  };

  if (loading) {
    return (
      <Box
        sx={{
          minHeight: '65vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <CircularProgress size={45} sx={{ color: '#8b5cf6', mb: 2 }} />
        <Typography variant="body1" sx={{ color: isDark ? '#9ca3af' : '#64748b', fontWeight: 600 }}>
          Loading platform billing & monetization telemetry...
        </Typography>
      </Box>
    );
  }

  const tableHeaderSx = {
    bgcolor: isDark ? 'rgba(30, 41, 59, 0.85)' : '#f1f5f9',
    color: isDark ? '#f8fafc' : '#0f172a',
    fontWeight: 800,
    fontSize: '0.8rem',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    py: 1.8,
    px: 2,
    borderBottom: isDark ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid #cbd5e1',
  };

  const tableCellSx = {
    color: isDark ? '#e2e8f0' : '#1e293b',
    fontWeight: 600,
    fontSize: '0.875rem',
    py: 1.6,
    px: 2,
    borderBottom: isDark ? '1px solid rgba(255, 255, 255, 0.04)' : '1px solid #f1f5f9',
  };

  return (
    <Box sx={{ p: { xs: 2, md: 4 }, maxWidth: 1440, mx: 'auto' }}>
      {/* Header */}
      <PageHeader
        title="Platform Billing & Governance"
        subtitle="Global MRR/ARR monetization telemetry, dynamic tier quotas, and multi-tenant ledger."
        category="Super Administrator"
        badgeText="OWNER PRIVILEGE"
        badgeColor="error"
        action={
          <Button
            variant="outlined"
            startIcon={<Sync />}
            onClick={fetchAdminBillingData}
            sx={{
              fontWeight: 700,
              borderRadius: '10px',
              textTransform: 'none',
              borderColor: isDark ? 'rgba(255,255,255,0.15)' : '#cbd5e1',
              color: isDark ? '#f8fafc' : '#334155',
              '&:hover': {
                borderColor: '#8b5cf6',
                bgcolor: isDark ? 'rgba(139, 92, 246, 0.08)' : '#f5f3ff',
              },
            }}
          >
            Refresh Telemetry
          </Button>
        }
      />

      {/* Global Revenue KPIs */}
      {metrics && (
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid item xs={12} sm={6} md={3}>
            <StatCard
              title="MONTHLY RECURRING (MRR)"
              value={formatAmount(metrics.mrr || 0, { fromCurrency: 'NGN' })}
              subtitle="Normalized active monthly run-rate"
              icon={<AccountBalanceWallet sx={{ fontSize: 22 }} />}
              color="violet"
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <StatCard
              title="ANNUAL RUN RATE (ARR)"
              value={formatAmount(metrics.arr || 0, { fromCurrency: 'NGN' })}
              subtitle="12-Month gross projection"
              icon={<TrendingUp sx={{ fontSize: 22 }} />}
              color="emerald"
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <StatCard
              title="ACTIVE TENANTS"
              value={metrics.activeSubscriptions}
              subtitle="Paid active organizations"
              icon={<Apartment sx={{ fontSize: 22 }} />}
              color="sky"
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <StatCard
              title="TRIAL PIPELINE"
              value={metrics.trialingSubscriptions}
              subtitle="14-day evaluation accounts"
              icon={<HourglassEmpty sx={{ fontSize: 22 }} />}
              color="amber"
            />
          </Grid>
        </Grid>
      )}

      {/* Plan Catalog Management */}
      <Card className="glass-panel" sx={{ borderRadius: '20px', mb: 4, overflow: 'hidden' }}>
        <Box sx={{ p: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box>
            <Typography
              variant="h6"
              sx={{ fontWeight: 900, color: isDark ? '#f8fafc' : '#0f172a' }}
            >
              Configurable SaaS Plan Catalog
            </Typography>
            <Typography variant="caption" sx={{ color: isDark ? '#9ca3af' : '#64748b' }}>
              Direct runtime pricing definition and resource threshold governance
            </Typography>
          </Box>
          <Chip label={`${plans.length} Tier Profiles`} size="small" sx={{ fontWeight: 700 }} />
        </Box>

        <Box sx={{ overflowX: 'auto' }}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell sx={tableHeaderSx}>Plan Name</TableCell>
                <TableCell sx={tableHeaderSx}>Tier</TableCell>
                <TableCell sx={tableHeaderSx}>Monthly Rate</TableCell>
                <TableCell sx={tableHeaderSx}>Status</TableCell>
                <TableCell sx={tableHeaderSx}>Version</TableCell>
                <TableCell sx={tableHeaderSx}>Quotas Summary</TableCell>
                <TableCell sx={{ ...tableHeaderSx, textAlign: 'right' }}>Action</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {plans.map((p) => (
                <TableRow key={p._id} hover>
                  <TableCell sx={{ ...tableCellSx, fontWeight: 800 }}>{p.name}</TableCell>
                  <TableCell sx={tableCellSx}>
                    <Chip
                      label={p.tier}
                      size="small"
                      color="primary"
                      sx={{ fontWeight: 700, height: 22 }}
                    />
                  </TableCell>
                  <TableCell sx={{ ...tableCellSx, fontFamily: 'monospace', fontWeight: 800 }}>
                    {formatAmount(p.price, { fromCurrency: p.currency || 'NGN' })}
                  </TableCell>
                  <TableCell sx={tableCellSx}>
                    <StatusChip status={p.status} label={p.status} />
                  </TableCell>
                  <TableCell sx={{ ...tableCellSx, fontFamily: 'monospace', fontSize: '0.8rem' }}>
                    v{p.version}
                  </TableCell>
                  <TableCell
                    sx={{
                      ...tableCellSx,
                      color: isDark ? '#9ca3af' : '#64748b',
                      fontSize: '0.8rem',
                    }}
                  >
                    <strong>{p.limits?.users?.unlimited ? '∞' : p.limits?.users?.count}</strong>{' '}
                    users,{' '}
                    <strong>
                      {p.limits?.branches?.unlimited ? '∞' : p.limits?.branches?.count}
                    </strong>{' '}
                    branches,{' '}
                    <strong>
                      {p.limits?.warehouses?.unlimited ? '∞' : p.limits?.warehouses?.count}
                    </strong>{' '}
                    warehouses
                  </TableCell>
                  <TableCell sx={{ ...tableCellSx, textAlign: 'right' }}>
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<Edit />}
                      onClick={() => {
                        setSelectedPlan(JSON.parse(JSON.stringify(p)));
                        setEditPlanModal(true);
                      }}
                      sx={{
                        borderRadius: '8px',
                        textTransform: 'none',
                        fontWeight: 700,
                        fontSize: '0.75rem',
                        borderColor: isDark ? 'rgba(255,255,255,0.15)' : '#cbd5e1',
                      }}
                    >
                      Edit Plan
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
      </Card>

      {/* Tenant Subscriptions Registry */}
      <Card className="glass-panel" sx={{ borderRadius: '20px', overflow: 'hidden' }}>
        <Box sx={{ p: 3 }}>
          <Typography variant="h6" sx={{ fontWeight: 900, color: isDark ? '#f8fafc' : '#0f172a' }}>
            Tenant Subscriptions Registry
          </Typography>
          <Typography variant="caption" sx={{ color: isDark ? '#9ca3af' : '#64748b' }}>
            Active organization tenant accounts, intervals, and renewal ledger
          </Typography>
        </Box>

        <Box sx={{ overflowX: 'auto' }}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell sx={tableHeaderSx}>Tenant Identifier</TableCell>
                <TableCell sx={tableHeaderSx}>Active Tier</TableCell>
                <TableCell sx={tableHeaderSx}>Interval</TableCell>
                <TableCell sx={tableHeaderSx}>Billing Amount</TableCell>
                <TableCell sx={tableHeaderSx}>Status</TableCell>
                <TableCell sx={{ ...tableHeaderSx, textAlign: 'right' }}>Renewal Date</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {subscriptions.map((s) => (
                <TableRow key={s._id} hover>
                  <TableCell
                    sx={{
                      ...tableCellSx,
                      fontFamily: 'monospace',
                      fontWeight: 800,
                      color: '#8b5cf6',
                    }}
                  >
                    {s.tenantId}
                  </TableCell>
                  <TableCell sx={tableCellSx}>
                    <Chip
                      label={s.planSlug?.toUpperCase()}
                      size="small"
                      color="info"
                      sx={{ fontWeight: 700, height: 22 }}
                    />
                  </TableCell>
                  <TableCell
                    sx={{ ...tableCellSx, textTransform: 'uppercase', fontSize: '0.8rem' }}
                  >
                    {s.billingInterval}
                  </TableCell>
                  <TableCell sx={{ ...tableCellSx, fontFamily: 'monospace', fontWeight: 800 }}>
                    {formatAmount(s.price || 0, { fromCurrency: s.currency || 'NGN' })}
                  </TableCell>
                  <TableCell sx={tableCellSx}>
                    <StatusChip status={s.status} label={s.status} />
                  </TableCell>
                  <TableCell
                    sx={{
                      ...tableCellSx,
                      textAlign: 'right',
                      color: isDark ? '#9ca3af' : '#64748b',
                    }}
                  >
                    {new Date(s.currentPeriodEnd).toLocaleDateString()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
      </Card>

      {/* Edit Plan Dialog */}
      <Dialog
        open={editPlanModal}
        onClose={() => setEditPlanModal(false)}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: '20px',
            bgcolor: isDark ? '#0b0f19' : '#ffffff',
            border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid #e2e8f0',
          },
        }}
      >
        <DialogTitle
          component="div"
          sx={{
            p: 3.5,
            background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)',
            color: '#ffffff',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 900, color: '#ffffff' }}>
              Edit Plan Configuration
            </Typography>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)' }}>
              {selectedPlan?.name} Tier Settings
            </Typography>
          </Box>
          <IconButton onClick={() => setEditPlanModal(false)} sx={{ color: '#ffffff' }}>
            <Close />
          </IconButton>
        </DialogTitle>

        <DialogContent sx={{ p: 3.5 }}>
          {selectedPlan && (
            <Box sx={{ mt: 1 }}>
              <Grid container spacing={2.5} sx={{ mb: 3 }}>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Plan Name"
                    value={selectedPlan.name}
                    onChange={(e) => setSelectedPlan({ ...selectedPlan, name: e.target.value })}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    type="number"
                    label="Base Monthly Rate (₦ NGN)"
                    value={selectedPlan.price}
                    onChange={(e) =>
                      setSelectedPlan({ ...selectedPlan, price: Number(e.target.value) })
                    }
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    type="number"
                    label="Yearly Discount %"
                    value={selectedPlan.yearlyDiscountPercent || 0}
                    onChange={(e) =>
                      setSelectedPlan({
                        ...selectedPlan,
                        yearlyDiscountPercent: Number(e.target.value),
                      })
                    }
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    select
                    label="Status"
                    value={selectedPlan.status}
                    onChange={(e) => setSelectedPlan({ ...selectedPlan, status: e.target.value })}
                  >
                    <MenuItem value="ACTIVE">ACTIVE</MenuItem>
                    <MenuItem value="DRAFT">DRAFT</MenuItem>
                    <MenuItem value="ARCHIVED">ARCHIVED</MenuItem>
                  </TextField>
                </Grid>
              </Grid>

              <Typography
                variant="subtitle2"
                sx={{ fontWeight: 800, mb: 1.5, textTransform: 'uppercase', color: '#8b5cf6' }}
              >
                Resource Quota Caps & Allocations
              </Typography>

              <Grid container spacing={2}>
                {['users', 'branches', 'warehouses', 'posTerminals', 'products'].map((resKey) => (
                  <Grid item xs={12} sm={6} md={4} key={resKey}>
                    <Card
                      sx={{
                        p: 2,
                        borderRadius: '12px',
                        bgcolor: isDark ? 'rgba(30, 41, 59, 0.3)' : '#f8fafc',
                        border: isDark ? '1px solid rgba(255,255,255,0.06)' : '1px solid #e2e8f0',
                      }}
                    >
                      <Typography
                        variant="caption"
                        sx={{
                          fontWeight: 800,
                          textTransform: 'uppercase',
                          display: 'block',
                          mb: 1,
                        }}
                      >
                        {resKey} Limit
                      </Typography>
                      <TextField
                        size="small"
                        type="number"
                        fullWidth
                        disabled={selectedPlan.limits?.[resKey]?.unlimited}
                        value={selectedPlan.limits?.[resKey]?.count || 0}
                        onChange={(e) =>
                          setSelectedPlan({
                            ...selectedPlan,
                            limits: {
                              ...selectedPlan.limits,
                              [resKey]: {
                                ...selectedPlan.limits[resKey],
                                count: Number(e.target.value),
                              },
                            },
                          })
                        }
                        sx={{ mb: 1 }}
                      />
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={Boolean(selectedPlan.limits?.[resKey]?.unlimited)}
                            onChange={(e) =>
                              setSelectedPlan({
                                ...selectedPlan,
                                limits: {
                                  ...selectedPlan.limits,
                                  [resKey]: {
                                    ...selectedPlan.limits[resKey],
                                    unlimited: e.target.checked,
                                  },
                                },
                              })
                            }
                            size="small"
                          />
                        }
                        label={
                          <Typography variant="caption" sx={{ fontWeight: 700 }}>
                            Unlimited Quota
                          </Typography>
                        }
                      />
                    </Card>
                  </Grid>
                ))}
              </Grid>
            </Box>
          )}
        </DialogContent>

        <DialogActions sx={{ p: 3, pt: 0 }}>
          <Button
            onClick={() => setEditPlanModal(false)}
            disabled={savingPlan}
            sx={{ color: isDark ? '#9ca3af' : '#64748b' }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleSavePlan}
            disabled={savingPlan}
            sx={{
              fontWeight: 800,
              borderRadius: '10px',
              px: 3,
              py: 1,
              textTransform: 'none',
              background: 'linear-gradient(135deg, #8b5cf6 0%, #3b82f6 100%)',
            }}
          >
            {savingPlan ? 'Saving Changes...' : 'Save & Publish Plan'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default PlatformBillingAdmin;
