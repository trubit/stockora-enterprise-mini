import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  Grid,
  Button,
  LinearProgress,
  Chip,
  CircularProgress,
  useTheme,
  Alert,
  AlertTitle,
} from '@mui/material';
import People from '@mui/icons-material/People';
import Store from '@mui/icons-material/Store';
import Apartment from '@mui/icons-material/Apartment';
import PointOfSale from '@mui/icons-material/PointOfSale';
import Inventory2 from '@mui/icons-material/Inventory2';
import ContactMail from '@mui/icons-material/ContactMail';
import ReceiptLong from '@mui/icons-material/ReceiptLong';
import Storage from '@mui/icons-material/Storage';
import Code from '@mui/icons-material/Code';
import Psychology from '@mui/icons-material/Psychology';
import AutoMode from '@mui/icons-material/AutoMode';
import Sync from '@mui/icons-material/Sync';
import Stars from '@mui/icons-material/Stars';
import { apiClient } from '../../api/client.ts';
import { toast } from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../../components/PageHeader.tsx';

export const UsageDashboard: React.FC = () => {
  const [usage, setUsage] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [reconciling, setReconciling] = useState(false);

  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const navigate = useNavigate();

  useEffect(() => {
    fetchUsage();
  }, []);

  const fetchUsage = async () => {
    const token = localStorage.getItem('stockora_mini_token');
    if (!token) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const res = await apiClient.get('/billing/usage');
      if (res.data?.success) {
        setUsage(res.data.data);
      }
    } catch (err: any) {
      if (err?.response?.status !== 401) {
        toast.error('Failed to load usage data');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleReconcile = async () => {
    try {
      setReconciling(true);
      const res = await apiClient.post('/billing/usage/reconcile', {});
      if (res.data?.success) {
        toast.success('Authoritative quota usage reconciled!');
        await fetchUsage();
      }
    } catch {
      toast.error('Reconciliation failed');
    } finally {
      setReconciling(false);
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
          Loading real-time resource quota telemetry...
        </Typography>
      </Box>
    );
  }

  const metricConfig: Record<
    string,
    {
      title: string;
      icon: any;
      desc: string;
      color: 'violet' | 'sky' | 'emerald' | 'amber' | 'rose';
    }
  > = {
    users: {
      title: 'Staff & Team Seats',
      icon: People,
      desc: 'Active team members with dashboard access',
      color: 'violet',
    },
    branches: {
      title: 'Store Branches',
      icon: Store,
      desc: 'Physical retail store sites & points of sale',
      color: 'sky',
    },
    warehouses: {
      title: 'Warehouses & Hubs',
      icon: Apartment,
      desc: 'Logistics depots & storage fulfillment centers',
      color: 'emerald',
    },
    posTerminals: {
      title: 'POS Terminals',
      icon: PointOfSale,
      desc: 'Active physical checkout registers',
      color: 'sky',
    },
    products: {
      title: 'Catalog Products & SKUs',
      icon: Inventory2,
      desc: 'Master inventory records and items',
      color: 'amber',
    },
    customers: {
      title: 'CRM Customer Profiles',
      icon: ContactMail,
      desc: 'Recorded clients, contacts & customer accounts',
      color: 'violet',
    },
    orders: {
      title: 'Sales Transactions',
      icon: ReceiptLong,
      desc: 'Orders processed within this billing period',
      color: 'sky',
    },
    storageMb: {
      title: 'Storage Capacity (MB)',
      icon: Storage,
      desc: 'Product imagery and document asset storage',
      color: 'emerald',
    },
    apiRequestsMonthly: {
      title: 'API Requests / Month',
      icon: Code,
      desc: 'External REST API and Webhook calls',
      color: 'violet',
    },
    aiRequestsMonthly: {
      title: 'AI Copilot Prompts',
      icon: Psychology,
      desc: 'Monthly AI query tokens & smart analytics',
      color: 'amber',
    },
    automations: {
      title: 'Active Automations',
      icon: AutoMode,
      desc: 'Workflow bot pipelines and background cron jobs',
      color: 'emerald',
    },
  };

  const hasExceeded =
    usage && Object.entries(usage).some(([_, val]: [string, any]) => val.isExceeded);

  return (
    <Box sx={{ p: { xs: 2, md: 4 }, maxWidth: 1440, mx: 'auto' }}>
      {/* Header */}
      <PageHeader
        title="Resource Quota & Usage Telemetry"
        subtitle="Real-time quota guards, active resource utilization meters, and authoritative billing reconciliation."
        category="SaaS Management"
        badgeText="LIVE TELEMETRY"
        badgeColor="info"
        action={
          <Box sx={{ display: 'flex', gap: 1.5 }}>
            <Button
              variant="outlined"
              startIcon={<Sync className={reconciling ? 'animate-spin' : ''} />}
              onClick={handleReconcile}
              disabled={reconciling}
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
              {reconciling ? 'Reconciling Quotas...' : 'Sync & Reconcile'}
            </Button>
            <Button
              variant="contained"
              startIcon={<Stars />}
              onClick={() => navigate('/pricing')}
              sx={{
                fontWeight: 700,
                borderRadius: '10px',
                px: 3,
                textTransform: 'none',
                background: 'linear-gradient(135deg, #8b5cf6 0%, #3b82f6 100%)',
                boxShadow: '0 4px 15px rgba(139, 92, 246, 0.4)',
                '&:hover': {
                  background: 'linear-gradient(135deg, #7c3aed 0%, #2563eb 100%)',
                },
              }}
            >
              Upgrade Limits
            </Button>
          </Box>
        }
      />

      {/* Exceeded Warning Alert */}
      {hasExceeded && (
        <Alert
          severity="error"
          sx={{
            mb: 4,
            borderRadius: '16px',
            bgcolor: isDark ? 'rgba(239, 68, 68, 0.12)' : '#fef2f2',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            alignItems: 'center',
          }}
          action={
            <Button
              color="error"
              size="small"
              variant="contained"
              onClick={() => navigate('/pricing')}
              sx={{ fontWeight: 800, borderRadius: '8px', textTransform: 'none' }}
            >
              Upgrade Plan Tier
            </Button>
          }
        >
          <AlertTitle sx={{ fontWeight: 800 }}>
            One or more enterprise plan limits reached!
          </AlertTitle>
          You have exhausted the allocated quota for some metered assets. Creating new records in
          these modules is blocked until you upgrade your plan tier.
        </Alert>
      )}

      {/* Grid of Metered Resources */}
      {usage && (
        <Grid container spacing={3}>
          {Object.entries(usage).map(([key, stat]: [string, any]) => {
            const config = metricConfig[key] || {
              title: key,
              icon: Inventory2,
              desc: 'Metered system resource',
              color: 'sky' as const,
            };
            const IconComp = config.icon;
            const pct = stat.percentage || 0;
            const isExceeded = stat.isExceeded;
            const isWarning =
              stat.warningLevel === 'WARNING_75' || stat.warningLevel === 'CRITICAL_90';

            return (
              <Grid item xs={12} sm={6} lg={4} key={key}>
                <Card
                  className={`glass-panel ${isExceeded ? 'glow-card-error' : isWarning ? 'glow-card' : ''}`}
                  sx={{
                    borderRadius: '18px',
                    p: 3,
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                  }}
                >
                  <Box>
                    <Box
                      sx={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        mb: 2,
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        <Box
                          sx={{
                            p: 1.2,
                            borderRadius: '12px',
                            bgcolor: isDark ? 'rgba(139, 92, 246, 0.15)' : '#f3e8ff',
                            color: '#8b5cf6',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <IconComp sx={{ fontSize: 24 }} />
                        </Box>
                        <Box>
                          <Typography
                            variant="subtitle1"
                            sx={{ fontWeight: 800, color: isDark ? '#f8fafc' : '#0f172a' }}
                          >
                            {config.title}
                          </Typography>
                          <Typography
                            variant="caption"
                            sx={{ color: isDark ? '#9ca3af' : '#64748b' }}
                          >
                            {config.desc}
                          </Typography>
                        </Box>
                      </Box>

                      {stat.unlimited ? (
                        <Chip
                          label="Unlimited"
                          size="small"
                          color="success"
                          sx={{ fontWeight: 700, height: 22 }}
                        />
                      ) : isExceeded ? (
                        <Chip
                          label="100% Limit"
                          size="small"
                          color="error"
                          sx={{ fontWeight: 700, height: 22 }}
                        />
                      ) : pct >= 75 ? (
                        <Chip
                          label={`${pct}% Used`}
                          size="small"
                          color="warning"
                          sx={{ fontWeight: 700, height: 22 }}
                        />
                      ) : (
                        <Chip
                          label={`${pct}% Used`}
                          size="small"
                          sx={{ fontWeight: 700, height: 22 }}
                        />
                      )}
                    </Box>

                    <Box
                      sx={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'baseline',
                        my: 2.5,
                      }}
                    >
                      <Typography
                        variant="h4"
                        sx={{
                          fontWeight: 900,
                          fontFamily: 'monospace',
                          color: isDark ? '#f8fafc' : '#0f172a',
                        }}
                      >
                        {(stat.used || 0).toLocaleString()}
                      </Typography>
                      <Typography variant="body2" sx={{ color: isDark ? '#9ca3af' : '#64748b' }}>
                        Quota Cap:{' '}
                        <Typography
                          component="span"
                          sx={{
                            fontWeight: 800,
                            fontFamily: 'monospace',
                            color: isDark ? '#e2e8f0' : '#1e293b',
                          }}
                        >
                          {stat.unlimited ? '∞' : (stat.limit || 0).toLocaleString()}
                        </Typography>
                      </Typography>
                    </Box>

                    <Box sx={{ mb: 2 }}>
                      <LinearProgress
                        variant="determinate"
                        value={stat.unlimited ? 100 : Math.min(100, pct)}
                        color={
                          stat.unlimited
                            ? 'success'
                            : isExceeded
                              ? 'error'
                              : pct >= 85
                                ? 'warning'
                                : 'primary'
                        }
                        sx={{
                          height: 8,
                          borderRadius: 4,
                          bgcolor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
                        }}
                      />
                    </Box>
                  </Box>

                  <Box
                    sx={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      pt: 1.5,
                      borderTop: isDark ? '1px solid rgba(255,255,255,0.06)' : '1px solid #f1f5f9',
                    }}
                  >
                    <Typography variant="caption" sx={{ color: isDark ? '#9ca3af' : '#64748b' }}>
                      Remaining capacity:{' '}
                      <Typography
                        component="span"
                        variant="caption"
                        sx={{
                          fontWeight: 800,
                          fontFamily: 'monospace',
                          color: isDark ? '#e2e8f0' : '#1e293b',
                        }}
                      >
                        {stat.unlimited ? 'Unlimited' : (stat.remaining || 0).toLocaleString()}
                      </Typography>
                    </Typography>

                    {isExceeded && (
                      <Typography
                        variant="caption"
                        onClick={() => navigate('/pricing')}
                        sx={{
                          color: '#8b5cf6',
                          fontWeight: 800,
                          cursor: 'pointer',
                          '&:hover': { textDecoration: 'underline' },
                        }}
                      >
                        Upgrade →
                      </Typography>
                    )}
                  </Box>
                </Card>
              </Grid>
            );
          })}
        </Grid>
      )}
    </Box>
  );
};

export default UsageDashboard;
