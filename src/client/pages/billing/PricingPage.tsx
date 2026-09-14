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
  Divider,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  useTheme,
  IconButton,
  ButtonGroup,
} from '@mui/material';
import CheckCircle from '@mui/icons-material/CheckCircle';
import Remove from '@mui/icons-material/Remove';
import Close from '@mui/icons-material/Close';
import People from '@mui/icons-material/People';
import Store from '@mui/icons-material/Store';
import Apartment from '@mui/icons-material/Apartment';
import Inventory2 from '@mui/icons-material/Inventory2';
import Psychology from '@mui/icons-material/Psychology';
import { apiClient } from '../../api/client';
import { toast } from 'react-hot-toast';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useTenantStore } from '../../store/tenant.js';
import { getPublicFrontendUrl, safeExternalRedirect } from '../../utils/url.ts';
import { useRegionalSettings } from '../../hooks/useRegionalSettings.js';
import { CurrencySelector } from '../../components/CurrencySelector.tsx';

interface PlanLimit {
  count: number;
  unlimited: boolean;
}

interface PlanFeatures {
  [key: string]: boolean;
}

interface Plan {
  _id: string;
  name: string;
  slug: string;
  tier: string;
  description: string;
  price: number;
  yearlyDiscountPercent: number;
  currency: string;
  isPopular?: boolean;
  features: PlanFeatures;
  limits: {
    users: PlanLimit;
    branches: PlanLimit;
    warehouses: PlanLimit;
    products: PlanLimit;
    posTerminals: PlanLimit;
    aiRequestsMonthly: PlanLimit;
    [key: string]: any;
  };
  trialConfiguration: {
    trialDays: number;
    isTrialEnabled: boolean;
  };
}

export const PricingPage: React.FC = () => {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [billingInterval, setBillingInterval] = useState<'MONTHLY' | 'YEARLY'>('MONTHLY');
  const [selectedProvider, setSelectedProvider] = useState<'PAYSTACK' | 'STRIPE'>('PAYSTACK');
  const [currentSub, setCurrentSub] = useState<any>(null);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [checkoutModalOpen, setCheckoutModalOpen] = useState(false);
  const [processingPayment, setProcessingPayment] = useState(false);

  const { formatAmount, activeCurrency } = useRegionalSettings();
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    fetchPlans();
    fetchCurrentSubscription();
    handleGatewayCallback();
  }, []);

  const handleGatewayCallback = async () => {
    const reference = searchParams.get('reference') || searchParams.get('trxref');
    const provider = (searchParams.get('provider') as 'PAYSTACK' | 'STRIPE') || 'PAYSTACK';

    if (!reference) return;

    try {
      toast.loading('Verifying payment with gateway...', { id: 'gateway-verify' });

      const verifyRes = await apiClient.post('/billing/subscription/verify', {
        reference,
        provider,
      });

      toast.dismiss('gateway-verify');

      if (verifyRes.data?.success) {
        toast.success(
          verifyRes.data?.message || 'Payment confirmed! Subscription activated successfully! 🎉',
          {
            duration: 5000,
          }
        );
        await fetchCurrentSubscription();
        await useTenantStore.getState().fetchCurrentTenant();
        queryClient.invalidateQueries({ queryKey: ['subscription'] });
        queryClient.invalidateQueries({ queryKey: ['billing'] });
        queryClient.invalidateQueries({ queryKey: ['tenant'] });
        navigate('/pricing', { replace: true });
      } else {
        toast.error(verifyRes.data?.message || 'Payment verification failed at gateway.');
        navigate('/pricing', { replace: true });
      }
    } catch (e: any) {
      toast.dismiss('gateway-verify');
      const verifyErrMsg =
        e.response?.data?.error?.message ||
        e.response?.data?.message ||
        e.message ||
        'Payment verification failed';
      toast.error(verifyErrMsg);
      navigate('/pricing', { replace: true });
    }
  };

  const fetchPlans = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get('/billing/plans');
      if (res.data?.success) {
        setPlans(res.data.data);
      }
    } catch {
      toast.error('Failed to load subscription plans');
    } finally {
      setLoading(false);
    }
  };

  const fetchCurrentSubscription = async () => {
    try {
      const res = await apiClient.get('/billing/subscription');
      if (res.data?.success) {
        setCurrentSub(res.data.data);
      }
    } catch {
      // Ignore if unauthenticated
    }
  };

  const handleSelectPlan = (plan: Plan) => {
    const token = localStorage.getItem('stockora_mini_token');
    if (!token) {
      navigate('/login');
      return;
    }
    setSelectedPlan(plan);
    setCheckoutModalOpen(true);
  };

  const handleConfirmCheckout = async () => {
    if (!selectedPlan) return;
    try {
      setProcessingPayment(true);

      if (selectedPlan.price === 0) {
        const res = await apiClient.post('/billing/subscription/change-plan', {
          newPlanId: selectedPlan._id,
          billingInterval,
        });
        if (res.data?.success) {
          toast.success('Successfully switched to Free Starter Plan!');
          setCheckoutModalOpen(false);
          fetchCurrentSubscription();
          navigate('/company/billing');
        }
        return;
      }

      const callbackUrl = `${getPublicFrontendUrl()}/pricing?payment_status=callback&provider=${selectedProvider}`;

      const initRes = await apiClient.post('/billing/subscription/initialize', {
        planId: selectedPlan._id,
        billingInterval,
        provider: selectedProvider,
        callbackUrl,
      });

      if (initRes.data?.success) {
        const { reference, authorizationUrl } = initRes.data.data;

        if (authorizationUrl) {
          toast.success(
            `Redirecting to secure ${selectedProvider === 'STRIPE' ? 'Stripe' : 'Paystack'} checkout...`,
            {
              duration: 2500,
            }
          );
          setCheckoutModalOpen(false);
          setTimeout(() => {
            safeExternalRedirect(authorizationUrl);
          }, 800);
          return;
        }

        // Direct server verification fallback for testing / simulation
        toast.loading(`Verifying payment reference ${reference}...`, { duration: 2500 });
        const verifyRes = await apiClient.post('/billing/subscription/verify', {
          reference,
          provider: selectedProvider,
        });

        if (verifyRes.data?.success) {
          toast.success(`Upgraded to ${selectedPlan.name} successfully! 🎉`);
          setCheckoutModalOpen(false);
          await fetchCurrentSubscription();
          await useTenantStore.getState().fetchCurrentTenant();
          queryClient.invalidateQueries({ queryKey: ['subscription'] });
          queryClient.invalidateQueries({ queryKey: ['billing'] });
          queryClient.invalidateQueries({ queryKey: ['tenant'] });
          navigate('/company/billing');
        } else {
          toast.error(verifyRes.data?.message || 'Payment verification failed');
        }
      }
    } catch (err: any) {
      const errMsg =
        err.response?.data?.error?.message ||
        err.response?.data?.message ||
        (typeof err.response?.data?.error === 'string' ? err.response.data.error : null) ||
        err.message ||
        'Checkout failed';
      toast.error(errMsg);
    } finally {
      setProcessingPayment(false);
    }
  };

  const formatPrice = (plan: Plan) => {
    if (plan.price === 0) return 'Free';
    const price =
      billingInterval === 'YEARLY'
        ? Math.round(plan.price * 12 * (1 - (plan.yearlyDiscountPercent || 0) / 100))
        : plan.price;
    return formatAmount(price, { fromCurrency: plan.currency || 'NGN' });
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
        <CircularProgress size={45} sx={{ color: '#2563eb', mb: 2 }} />
        <Typography variant="body1" sx={{ color: isDark ? '#9ca3af' : '#64748b', fontWeight: 600 }}>
          Loading enterprise SaaS tiers...
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
      {/* Hero Header */}
      <Box sx={{ textAlign: 'center', mb: 6 }}>
        <Chip
          label="MULTI-TENANT SAAS PRICING"
          color="primary"
          size="small"
          sx={{ fontWeight: 800, mb: 2, letterSpacing: '0.05em' }}
        />
        <Typography
          variant="h3"
          sx={{
            fontWeight: 900,
            letterSpacing: '-0.03em',
            background: 'linear-gradient(135deg, #ffffff 0%, #c084fc 50%, #818cf8 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: isDark ? 'transparent' : '#0f172a',
            mb: 1.5,
          }}
        >
          Flexible SaaS Plans for Modern Enterprises
        </Typography>
        <Typography
          variant="body1"
          sx={{
            color: isDark ? '#9ca3af' : '#64748b',
            maxWidth: 680,
            mx: 'auto',
            lineHeight: 1.6,
            mb: 4,
          }}
        >
          Scale seamlessly from single-store retail to nationwide multi-warehouse distribution with
          complete quota isolation and instant Paystack settlement.
        </Typography>

        {/* Interval Selector Toggle & Currency Switcher */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 2,
            flexWrap: 'wrap',
          }}
        >
          <Box
            sx={{
              display: 'inline-flex',
              p: 0.6,
              borderRadius: '99px',
              bgcolor: isDark ? 'rgba(30, 41, 59, 0.6)' : '#f1f5f9',
              border: isDark ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid #e2e8f0',
            }}
          >
            <Button
              onClick={() => setBillingInterval('MONTHLY')}
              sx={{
                borderRadius: '99px',
                px: 3.5,
                py: 1,
                fontWeight: 800,
                textTransform: 'none',
                color: billingInterval === 'MONTHLY' ? '#ffffff' : isDark ? '#9ca3af' : '#64748b',
                bgcolor:
                  billingInterval === 'MONTHLY'
                    ? 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)'
                    : 'transparent',
                boxShadow:
                  billingInterval === 'MONTHLY' ? '0 4px 14px rgba(37, 99, 235, 0.4)' : 'none',
                '&:hover': {
                  bgcolor:
                    billingInterval === 'MONTHLY'
                      ? 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)'
                      : isDark
                        ? 'rgba(255, 255, 255, 0.05)'
                        : '#e2e8f0',
                },
              }}
            >
              Monthly Billing
            </Button>
            <Button
              onClick={() => setBillingInterval('YEARLY')}
              endIcon={
                <Chip
                  label="Save 20%"
                  size="small"
                  color="success"
                  sx={{ height: 20, fontSize: '0.7rem', fontWeight: 800 }}
                />
              }
              sx={{
                borderRadius: '99px',
                px: 3.5,
                py: 1,
                fontWeight: 800,
                textTransform: 'none',
                color: billingInterval === 'YEARLY' ? '#ffffff' : isDark ? '#9ca3af' : '#64748b',
                bgcolor:
                  billingInterval === 'YEARLY'
                    ? 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)'
                    : 'transparent',
                boxShadow:
                  billingInterval === 'YEARLY' ? '0 4px 14px rgba(37, 99, 235, 0.4)' : 'none',
                '&:hover': {
                  bgcolor:
                    billingInterval === 'YEARLY'
                      ? 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)'
                      : isDark
                        ? 'rgba(255, 255, 255, 0.05)'
                        : '#e2e8f0',
                },
              }}
            >
              Yearly Billing
            </Button>
          </Box>
          <CurrencySelector size="small" />
        </Box>
      </Box>

      {/* Plan Cards Grid */}
      <Grid container spacing={3} sx={{ mb: 6 }} alignItems="stretch" justifyContent="center">
        {plans.map((plan) => {
          const isCurrent = currentSub?.planSlug === plan.slug;
          return (
            <Grid
              item
              xs={12}
              sm={plans.length === 1 ? 10 : 6}
              md={plans.length === 1 ? 8 : 4}
              lg={plans.length === 1 ? 6 : 3}
              key={plan._id}
              sx={{ display: 'flex' }}
            >
              <Card
                className={`glass-panel ${plan.isPopular ? 'glow-card' : ''}`}
                sx={{
                  borderRadius: '22px',
                  width: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  p: 3.5,
                  position: 'relative',
                  border: plan.isPopular
                    ? '2px solid rgba(37, 99, 235, 0.6) !important'
                    : undefined,
                }}
              >
                <Box>
                  {plan.isPopular && (
                    <Box sx={{ mb: 1.5 }}>
                      <Chip
                        label="★ Most Popular Choice"
                        size="small"
                        color="secondary"
                        sx={{ fontWeight: 800, fontSize: '0.72rem', width: '100%' }}
                      />
                    </Box>
                  )}

                  <Typography
                    variant="h5"
                    sx={{ fontWeight: 900, mb: 0.5, color: isDark ? '#f8fafc' : '#0f172a' }}
                  >
                    {plan.name}
                  </Typography>
                  <Typography
                    variant="caption"
                    sx={{ color: isDark ? '#9ca3af' : '#64748b', display: 'block', minHeight: 36 }}
                  >
                    {plan.description}
                  </Typography>

                  <Box sx={{ display: 'flex', alignItems: 'baseline', mt: 2, mb: 1 }}>
                    <Typography
                      variant="h3"
                      sx={{
                        fontWeight: 900,
                        fontFamily: 'monospace',
                        color: isDark ? '#f8fafc' : '#0f172a',
                      }}
                    >
                      {formatPrice(plan)}
                    </Typography>
                    {plan.price > 0 && (
                      <Typography
                        variant="caption"
                        sx={{ color: isDark ? '#9ca3af' : '#64748b', ml: 0.5, fontWeight: 700 }}
                      >
                        /{billingInterval === 'YEARLY' ? 'yr' : 'mo'}
                      </Typography>
                    )}
                  </Box>

                  {billingInterval === 'YEARLY' && plan.price > 0 && (
                    <Typography
                      variant="caption"
                      sx={{ color: '#34d399', fontWeight: 800, display: 'block', mb: 2 }}
                    >
                      Equivalent to{' '}
                      {formatAmount(plan.price * 0.8, { fromCurrency: plan.currency || 'NGN' })}/mo
                    </Typography>
                  )}

                  <Divider
                    sx={{ my: 2, borderColor: isDark ? 'rgba(255,255,255,0.08)' : '#e2e8f0' }}
                  />

                  {/* Quota Limits List */}
                  <Typography
                    variant="caption"
                    sx={{
                      color: isDark ? '#9ca3af' : '#64748b',
                      fontWeight: 800,
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      display: 'block',
                      mb: 1.5,
                    }}
                  >
                    Resource Quotas
                  </Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mb: 3 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <People sx={{ fontSize: 18, color: '#8b5cf6' }} />
                      <Typography variant="body2" sx={{ fontSize: '0.85rem' }}>
                        <strong>
                          {plan.limits.users.unlimited ? 'Unlimited' : plan.limits.users.count}
                        </strong>{' '}
                        Staff Seats
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Store sx={{ fontSize: 18, color: '#38bdf8' }} />
                      <Typography variant="body2" sx={{ fontSize: '0.85rem' }}>
                        <strong>
                          {plan.limits.branches.unlimited
                            ? 'Unlimited'
                            : plan.limits.branches.count}
                        </strong>{' '}
                        Store Branches
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Apartment sx={{ fontSize: 18, color: '#34d399' }} />
                      <Typography variant="body2" sx={{ fontSize: '0.85rem' }}>
                        <strong>
                          {plan.limits.warehouses.unlimited
                            ? 'Unlimited'
                            : plan.limits.warehouses.count}
                        </strong>{' '}
                        Warehouses
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Inventory2 sx={{ fontSize: 18, color: '#fbbf24' }} />
                      <Typography variant="body2" sx={{ fontSize: '0.85rem' }}>
                        <strong>
                          {plan.limits.products.unlimited
                            ? 'Unlimited'
                            : plan.limits.products.count.toLocaleString()}
                        </strong>{' '}
                        SKUs / Products
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Psychology sx={{ fontSize: 18, color: '#c084fc' }} />
                      <Typography variant="body2" sx={{ fontSize: '0.85rem' }}>
                        <strong>
                          {plan.limits.aiRequestsMonthly.unlimited
                            ? 'Unlimited'
                            : plan.limits.aiRequestsMonthly.count}
                        </strong>{' '}
                        AI Prompts/mo
                      </Typography>
                    </Box>
                  </Box>

                  <Typography
                    variant="caption"
                    sx={{
                      color: isDark ? '#9ca3af' : '#64748b',
                      fontWeight: 800,
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      display: 'block',
                      mb: 1,
                    }}
                  >
                    Features Included
                  </Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.8, mb: 3 }}>
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1,
                        opacity: plan.features.pos ? 1 : 0.4,
                      }}
                    >
                      <CheckCircle
                        sx={{ fontSize: 16, color: plan.features.pos ? '#34d399' : 'inherit' }}
                      />
                      <Typography variant="caption" sx={{ fontWeight: 600 }}>
                        POS Terminal Checkout
                      </Typography>
                    </Box>
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1,
                        opacity: plan.features.crm ? 1 : 0.4,
                      }}
                    >
                      <CheckCircle
                        sx={{ fontSize: 16, color: plan.features.crm ? '#34d399' : 'inherit' }}
                      />
                      <Typography variant="caption" sx={{ fontWeight: 600 }}>
                        CRM & Loyalty Rewards
                      </Typography>
                    </Box>
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1,
                        opacity: plan.features.aiAssistant ? 1 : 0.4,
                      }}
                    >
                      <CheckCircle
                        sx={{
                          fontSize: 16,
                          color: plan.features.aiAssistant ? '#34d399' : 'inherit',
                        }}
                      />
                      <Typography variant="caption" sx={{ fontWeight: 600 }}>
                        Copilot AI Assistant
                      </Typography>
                    </Box>
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1,
                        opacity: plan.features.multiBranch ? 1 : 0.4,
                      }}
                    >
                      <CheckCircle
                        sx={{
                          fontSize: 16,
                          color: plan.features.multiBranch ? '#34d399' : 'inherit',
                        }}
                      />
                      <Typography variant="caption" sx={{ fontWeight: 600 }}>
                        Multi-Branch Sync
                      </Typography>
                    </Box>
                  </Box>
                </Box>

                <Button
                  variant={isCurrent ? 'outlined' : plan.isPopular ? 'contained' : 'outlined'}
                  disabled={isCurrent}
                  onClick={() => handleSelectPlan(plan)}
                  sx={{
                    width: '100%',
                    py: 1.4,
                    borderRadius: '12px',
                    fontWeight: 800,
                    textTransform: 'none',
                    background:
                      !isCurrent && plan.isPopular
                        ? 'linear-gradient(135deg, #8b5cf6 0%, #3b82f6 100%)'
                        : undefined,
                    boxShadow:
                      !isCurrent && plan.isPopular
                        ? '0 4px 15px rgba(139, 92, 246, 0.4)'
                        : undefined,
                  }}
                >
                  {isCurrent
                    ? 'Current Plan Tier'
                    : plan.price === 0
                      ? 'Start Free'
                      : 'Select Plan'}
                </Button>
              </Card>
            </Grid>
          );
        })}
      </Grid>

      {/* Feature & Quota Comparison Matrix */}
      <Card className="glass-panel" sx={{ borderRadius: '20px', overflow: 'hidden' }}>
        <Box sx={{ p: 3 }}>
          <Typography variant="h6" sx={{ fontWeight: 900, color: isDark ? '#f8fafc' : '#0f172a' }}>
            Detailed Feature & Quota Comparison Matrix
          </Typography>
          <Typography variant="caption" sx={{ color: isDark ? '#9ca3af' : '#64748b' }}>
            Enterprise breakdown of functional modules and rate limits per tier.
          </Typography>
        </Box>

        <Box sx={{ overflowX: 'auto' }}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell sx={tableHeaderSx}>Feature / Metric</TableCell>
                {plans.map((p) => (
                  <TableCell key={p._id} sx={{ ...tableHeaderSx, textAlign: 'center' }}>
                    {p.name}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              <TableRow sx={{ bgcolor: isDark ? 'rgba(30, 41, 59, 0.3)' : '#f8fafc' }}>
                <TableCell
                  colSpan={plans.length + 1}
                  sx={{
                    fontWeight: 800,
                    color: '#8b5cf6',
                    fontSize: '0.8rem',
                    textTransform: 'uppercase',
                  }}
                >
                  Resource Quota Limits
                </TableCell>
              </TableRow>
              <TableRow hover>
                <TableCell sx={tableCellSx}>Staff & User Accounts</TableCell>
                {plans.map((p) => (
                  <TableCell
                    key={p._id}
                    sx={{ ...tableCellSx, textAlign: 'center', fontFamily: 'monospace' }}
                  >
                    {p.limits.users.unlimited ? 'Unlimited' : p.limits.users.count}
                  </TableCell>
                ))}
              </TableRow>
              <TableRow hover>
                <TableCell sx={tableCellSx}>Physical Store Branches</TableCell>
                {plans.map((p) => (
                  <TableCell
                    key={p._id}
                    sx={{ ...tableCellSx, textAlign: 'center', fontFamily: 'monospace' }}
                  >
                    {p.limits.branches.unlimited ? 'Unlimited' : p.limits.branches.count}
                  </TableCell>
                ))}
              </TableRow>
              <TableRow hover>
                <TableCell sx={tableCellSx}>Logistics Warehouses</TableCell>
                {plans.map((p) => (
                  <TableCell
                    key={p._id}
                    sx={{ ...tableCellSx, textAlign: 'center', fontFamily: 'monospace' }}
                  >
                    {p.limits.warehouses.unlimited ? 'Unlimited' : p.limits.warehouses.count}
                  </TableCell>
                ))}
              </TableRow>
              <TableRow hover>
                <TableCell sx={tableCellSx}>POS Registers / Terminals</TableCell>
                {plans.map((p) => (
                  <TableCell
                    key={p._id}
                    sx={{ ...tableCellSx, textAlign: 'center', fontFamily: 'monospace' }}
                  >
                    {p.limits.posTerminals.unlimited ? 'Unlimited' : p.limits.posTerminals.count}
                  </TableCell>
                ))}
              </TableRow>
              <TableRow hover>
                <TableCell sx={tableCellSx}>Catalog Products (SKUs)</TableCell>
                {plans.map((p) => (
                  <TableCell
                    key={p._id}
                    sx={{ ...tableCellSx, textAlign: 'center', fontFamily: 'monospace' }}
                  >
                    {p.limits.products.unlimited
                      ? 'Unlimited'
                      : p.limits.products.count.toLocaleString()}
                  </TableCell>
                ))}
              </TableRow>
              <TableRow hover>
                <TableCell sx={tableCellSx}>AI Copilot Tokens/mo</TableCell>
                {plans.map((p) => (
                  <TableCell
                    key={p._id}
                    sx={{ ...tableCellSx, textAlign: 'center', fontFamily: 'monospace' }}
                  >
                    {p.limits.aiRequestsMonthly.unlimited
                      ? 'Unlimited'
                      : p.limits.aiRequestsMonthly.count.toLocaleString()}
                  </TableCell>
                ))}
              </TableRow>

              <TableRow sx={{ bgcolor: isDark ? 'rgba(30, 41, 59, 0.3)' : '#f8fafc' }}>
                <TableCell
                  colSpan={plans.length + 1}
                  sx={{
                    fontWeight: 800,
                    color: '#8b5cf6',
                    fontSize: '0.8rem',
                    textTransform: 'uppercase',
                  }}
                >
                  Enterprise Modules
                </TableCell>
              </TableRow>
              <TableRow hover>
                <TableCell sx={tableCellSx}>POS Terminal & Barcode Scanning</TableCell>
                {plans.map((p) => (
                  <TableCell key={p._id} sx={{ ...tableCellSx, textAlign: 'center' }}>
                    {p.features.pos ? (
                      <CheckCircle sx={{ color: '#34d399', fontSize: 18 }} />
                    ) : (
                      <Remove sx={{ color: '#9ca3af', fontSize: 18 }} />
                    )}
                  </TableCell>
                ))}
              </TableRow>
              <TableRow hover>
                <TableCell sx={tableCellSx}>CRM & Customer Segmentation</TableCell>
                {plans.map((p) => (
                  <TableCell key={p._id} sx={{ ...tableCellSx, textAlign: 'center' }}>
                    {p.features.crm ? (
                      <CheckCircle sx={{ color: '#34d399', fontSize: 18 }} />
                    ) : (
                      <Remove sx={{ color: '#9ca3af', fontSize: 18 }} />
                    )}
                  </TableCell>
                ))}
              </TableRow>
              <TableRow hover>
                <TableCell sx={tableCellSx}>Copilot AI Assistant</TableCell>
                {plans.map((p) => (
                  <TableCell key={p._id} sx={{ ...tableCellSx, textAlign: 'center' }}>
                    {p.features.aiAssistant ? (
                      <CheckCircle sx={{ color: '#34d399', fontSize: 18 }} />
                    ) : (
                      <Remove sx={{ color: '#9ca3af', fontSize: 18 }} />
                    )}
                  </TableCell>
                ))}
              </TableRow>
              <TableRow hover>
                <TableCell sx={tableCellSx}>Multi-Warehouse Inter-Transfer</TableCell>
                {plans.map((p) => (
                  <TableCell key={p._id} sx={{ ...tableCellSx, textAlign: 'center' }}>
                    {p.features.warehouseManagement ? (
                      <CheckCircle sx={{ color: '#34d399', fontSize: 18 }} />
                    ) : (
                      <Remove sx={{ color: '#9ca3af', fontSize: 18 }} />
                    )}
                  </TableCell>
                ))}
              </TableRow>
              <TableRow hover>
                <TableCell sx={tableCellSx}>REST API & Webhooks Access</TableCell>
                {plans.map((p) => (
                  <TableCell key={p._id} sx={{ ...tableCellSx, textAlign: 'center' }}>
                    {p.features.apiAccess ? (
                      <CheckCircle sx={{ color: '#34d399', fontSize: 18 }} />
                    ) : (
                      <Remove sx={{ color: '#9ca3af', fontSize: 18 }} />
                    )}
                  </TableCell>
                ))}
              </TableRow>
            </TableBody>
          </Table>
        </Box>
      </Card>

      {/* Checkout Dialog */}
      <Dialog
        open={checkoutModalOpen}
        onClose={() => !processingPayment && setCheckoutModalOpen(false)}
        maxWidth="sm"
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
              Confirm Subscription Upgrade
            </Typography>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)' }}>
              {selectedProvider === 'STRIPE' ? 'Stripe Gateway' : 'Paystack Gateway'} Secure
              Checkout
            </Typography>
          </Box>
          <IconButton onClick={() => setCheckoutModalOpen(false)} sx={{ color: '#ffffff' }}>
            <Close />
          </IconButton>
        </DialogTitle>

        <DialogContent sx={{ p: 3.5 }}>
          {selectedPlan && (
            <Box>
              <Card
                sx={{
                  p: 2.5,
                  mb: 2.5,
                  borderRadius: '12px',
                  bgcolor: isDark ? 'rgba(30, 41, 59, 0.4)' : '#f8fafc',
                }}
              >
                <Box
                  sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                >
                  <Box>
                    <Typography variant="h6" sx={{ fontWeight: 800 }}>
                      {selectedPlan.name}
                    </Typography>
                    <Typography
                      variant="caption"
                      sx={{
                        color: isDark ? '#9ca3af' : '#64748b',
                        textTransform: 'uppercase',
                        fontWeight: 700,
                      }}
                    >
                      {billingInterval} Billing Interval
                    </Typography>
                  </Box>
                  <Box sx={{ textAlign: 'right' }}>
                    <Typography
                      variant="h5"
                      sx={{ fontWeight: 900, fontFamily: 'monospace', color: '#2563eb' }}
                    >
                      {formatPrice(selectedPlan)}
                    </Typography>
                    <Typography variant="caption" sx={{ color: isDark ? '#9ca3af' : '#64748b' }}>
                      {activeCurrency !== (selectedPlan.currency || 'NGN')
                        ? `(Plan Base: ${selectedPlan.currency || 'NGN'})`
                        : selectedPlan.currency}
                    </Typography>
                  </Box>
                </Box>
              </Card>

              {/* Payment Provider Selection */}
              <Box sx={{ mb: 2.5 }}>
                <Typography
                  variant="subtitle2"
                  sx={{ fontWeight: 700, mb: 1, color: isDark ? '#e2e8f0' : '#1e293b' }}
                >
                  Select Payment Gateway:
                </Typography>
                <ButtonGroup fullWidth sx={{ borderRadius: '10px', overflow: 'hidden' }}>
                  <Button
                    variant={selectedProvider === 'PAYSTACK' ? 'contained' : 'outlined'}
                    onClick={() => setSelectedProvider('PAYSTACK')}
                    sx={{
                      fontWeight: 700,
                      textTransform: 'none',
                      bgcolor: selectedProvider === 'PAYSTACK' ? '#0ba4db' : 'transparent',
                      borderColor: '#0ba4db',
                      '&:hover': {
                        bgcolor:
                          selectedProvider === 'PAYSTACK' ? '#098dbd' : 'rgba(11,164,219,0.08)',
                      },
                    }}
                  >
                    Paystack (NGN / Local)
                  </Button>
                  <Button
                    variant={selectedProvider === 'STRIPE' ? 'contained' : 'outlined'}
                    onClick={() => setSelectedProvider('STRIPE')}
                    sx={{
                      fontWeight: 700,
                      textTransform: 'none',
                      bgcolor: selectedProvider === 'STRIPE' ? '#635bff' : 'transparent',
                      borderColor: '#635bff',
                      '&:hover': {
                        bgcolor: selectedProvider === 'STRIPE' ? '#5347e8' : 'rgba(99,91,255,0.08)',
                      },
                    }}
                  >
                    Stripe (USD / Global)
                  </Button>
                </ButtonGroup>
              </Box>

              <Typography variant="body2" sx={{ color: isDark ? '#9ca3af' : '#64748b', mb: 3 }}>
                Payments are encrypted and processed securely via{' '}
                <strong>{selectedProvider === 'STRIPE' ? 'Stripe' : 'Paystack'}</strong>. Your
                account will automatically activate new limits and generate an official invoice upon
                confirmation.
              </Typography>

              {(() => {
                const effectiveSubtotal =
                  billingInterval === 'YEARLY'
                    ? Math.round(
                        selectedPlan.price *
                          12 *
                          (1 - (selectedPlan.yearlyDiscountPercent || 0) / 100)
                      )
                    : selectedPlan.price;
                const totalDue = effectiveSubtotal;
                const gatewayCurrency =
                  selectedPlan.currency || (selectedProvider === 'STRIPE' ? 'USD' : 'NGN');

                const gatewaySubtotal = formatAmount(effectiveSubtotal, {
                  currency: gatewayCurrency,
                  fromCurrency: gatewayCurrency,
                  convert: false,
                });
                const gatewayTotal = formatAmount(totalDue, {
                  currency: gatewayCurrency,
                  fromCurrency: gatewayCurrency,
                  convert: false,
                });

                const isDifferentFromActive = activeCurrency !== gatewayCurrency;
                const convertedEstimate = formatAmount(totalDue, {
                  fromCurrency: gatewayCurrency,
                });

                return (
                  <Card
                    sx={{
                      p: 2.5,
                      borderRadius: '12px',
                      border: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid #e2e8f0',
                    }}
                  >
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                      <Typography variant="body2" sx={{ color: isDark ? '#9ca3af' : '#64748b' }}>
                        Subtotal ({billingInterval}):
                      </Typography>
                      <Typography variant="body2" sx={{ fontWeight: 700, fontFamily: 'monospace' }}>
                        {gatewaySubtotal}
                      </Typography>
                    </Box>
                    <Divider sx={{ my: 1.5 }} />
                    <Box
                      sx={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'baseline',
                      }}
                    >
                      <Box>
                        <Typography variant="subtitle1" sx={{ fontWeight: 900 }}>
                          Total Gateway Charge:
                        </Typography>
                        <Typography
                          variant="caption"
                          sx={{ color: isDark ? '#9ca3af' : '#64748b', display: 'block' }}
                        >
                          Billed directly in {gatewayCurrency} via{' '}
                          {selectedProvider === 'STRIPE' ? 'Stripe' : 'Paystack'}
                        </Typography>
                      </Box>
                      <Typography
                        variant="subtitle1"
                        sx={{ fontWeight: 900, color: '#2563eb', fontFamily: 'monospace' }}
                      >
                        {gatewayTotal}
                      </Typography>
                    </Box>
                    {isDifferentFromActive && (
                      <Box
                        sx={{
                          mt: 1.5,
                          p: 1.5,
                          borderRadius: '8px',
                          bgcolor: isDark ? 'rgba(139, 92, 246, 0.1)' : '#f5f3ff',
                          border: '1px solid rgba(139, 92, 246, 0.2)',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                        }}
                      >
                        <Typography variant="caption" sx={{ fontWeight: 700, color: '#8b5cf6' }}>
                          Display Currency Equivalent ({activeCurrency}):
                        </Typography>
                        <Typography
                          variant="body2"
                          sx={{ fontWeight: 800, fontFamily: 'monospace', color: '#8b5cf6' }}
                        >
                          ≈ {convertedEstimate}
                        </Typography>
                      </Box>
                    )}
                  </Card>
                );
              })()}
            </Box>
          )}
        </DialogContent>

        <DialogActions sx={{ p: 3, pt: 0 }}>
          <Button
            onClick={() => setCheckoutModalOpen(false)}
            disabled={processingPayment}
            sx={{ color: isDark ? '#9ca3af' : '#64748b' }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleConfirmCheckout}
            disabled={processingPayment}
            sx={{
              fontWeight: 800,
              borderRadius: '10px',
              px: 3,
              py: 1,
              textTransform: 'none',
              background:
                selectedProvider === 'STRIPE'
                  ? 'linear-gradient(135deg, #635bff 0%, #4f46e5 100%)'
                  : 'linear-gradient(135deg, #0ba4db 0%, #3b82f6 100%)',
            }}
          >
            {processingPayment
              ? `Processing ${selectedProvider === 'STRIPE' ? 'Stripe' : 'Paystack'}...`
              : `Proceed to Pay with ${selectedProvider === 'STRIPE' ? 'Stripe' : 'Paystack'}`}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default PricingPage;
