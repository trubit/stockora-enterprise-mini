import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Button,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
  Checkbox,
  FormControlLabel,
  TextField,
  useTheme,
  IconButton,
} from '@mui/material';
import CreditCard from '@mui/icons-material/CreditCard';
import Receipt from '@mui/icons-material/Receipt';
import Close from '@mui/icons-material/Close';
import Print from '@mui/icons-material/Print';
import Store from '@mui/icons-material/Store';
import People from '@mui/icons-material/People';
import Inventory2 from '@mui/icons-material/Inventory2';
import Apartment from '@mui/icons-material/Apartment';
import Stars from '@mui/icons-material/Stars';
import { apiClient } from '../../api/client.ts';
import { toast } from 'react-hot-toast';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useTenantStore } from '../../store/tenant.js';
import PageHeader from '../../components/PageHeader.tsx';
import StatCard from '../../components/StatCard.tsx';
import StatusChip from '../../components/StatusChip.tsx';
import { useRegionalSettings } from '../../hooks/useRegionalSettings.js';
import { CurrencySelector } from '../../components/CurrencySelector.tsx';

export const BillingDashboard: React.FC = () => {
  const { formatAmount, activeCurrency } = useRegionalSettings();

  const formatInvoiceCurrency = (
    amount: number | null | undefined,
    invCurrency?: string,
    showOriginal = false
  ) => {
    const docCurrency = (invCurrency || 'NGN').toUpperCase().trim();
    const formatted = formatAmount(amount, {
      fromCurrency: docCurrency,
    });

    if (showOriginal && activeCurrency !== docCurrency && amount != null && amount > 0) {
      const originalFormatted = formatAmount(amount, {
        currency: docCurrency,
        fromCurrency: docCurrency,
        convert: false,
      });
      return (
        <span>
          {formatted}{' '}
          <Typography
            component="span"
            variant="caption"
            sx={{ opacity: 0.75, fontSize: '0.72rem', ml: 0.5 }}
          >
            ({originalFormatted})
          </Typography>
        </span>
      );
    }

    return formatted;
  };

  const [subscription, setSubscription] = useState<any>(null);
  const [usage, setUsage] = useState<any>(null);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cancelImmediately, setCancelImmediately] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);

  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    fetchBillingData();
    handleGatewayCallback();
  }, []);

  const handleGatewayCallback = async () => {
    const reference = searchParams.get('reference') || searchParams.get('trxref');
    const provider = (searchParams.get('provider') as string) || 'PAYSTACK';

    if (!reference) return;

    try {
      toast.loading('Verifying payment with gateway...', { id: 'dashboard-gateway-verify' });

      const verifyRes = await apiClient.post('/billing/subscription/verify', {
        reference,
        provider,
      });

      toast.dismiss('dashboard-gateway-verify');

      if (verifyRes.data?.success) {
        toast.success(verifyRes.data?.message || 'Payment confirmed! Subscription active! 🎉', {
          duration: 5000,
        });
        await fetchBillingData();
        await useTenantStore.getState().fetchCurrentTenant();
        queryClient.invalidateQueries({ queryKey: ['subscription'] });
        queryClient.invalidateQueries({ queryKey: ['billing'] });
        queryClient.invalidateQueries({ queryKey: ['tenant'] });
        navigate('/company/billing', { replace: true });
      } else {
        toast.error(verifyRes.data?.message || 'Payment verification failed at gateway.');
        navigate('/company/billing', { replace: true });
      }
    } catch (e: any) {
      toast.dismiss('dashboard-gateway-verify');
      const verifyErrMsg =
        e.response?.data?.error?.message ||
        e.response?.data?.message ||
        e.message ||
        'Payment verification failed';
      toast.error(verifyErrMsg);
      navigate('/company/billing', { replace: true });
    }
  };

  const fetchBillingData = async () => {
    const token = localStorage.getItem('stockora_mini_token');
    if (!token) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      const [subRes, usageRes, invRes, txRes] = await Promise.all([
        apiClient.get('/billing/subscription'),
        apiClient.get('/billing/usage'),
        apiClient.get('/billing/invoices'),
        apiClient.get('/billing/transactions'),
      ]);

      if (subRes.data?.success) setSubscription(subRes.data.data);
      if (usageRes.data?.success) setUsage(usageRes.data.data);
      if (invRes.data?.success) setInvoices(invRes.data.data);
      if (txRes.data?.success) setTransactions(txRes.data.data);
    } catch (err: any) {
      if (err?.response?.status !== 401) {
        toast.error('Failed to load billing details');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCancelSubscription = async () => {
    try {
      setCancelling(true);
      const res = await apiClient.post('/billing/subscription/cancel', {
        immediately: cancelImmediately,
        reason: cancelReason,
      });

      if (res.data?.success) {
        toast.success(
          cancelImmediately
            ? 'Subscription cancelled immediately.'
            : 'Subscription will cancel at the end of the billing period.'
        );
        setCancelModalOpen(false);
        fetchBillingData();
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Cancellation failed');
    } finally {
      setCancelling(false);
    }
  };

  const handleReactivate = async () => {
    try {
      const res = await apiClient.post('/billing/subscription/reactivate', {});
      if (res.data?.success) {
        toast.success('Subscription reactivated successfully!');
        fetchBillingData();
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Reactivation failed');
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
          Loading enterprise subscription records & quotas...
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
    py: 1.5,
    borderBottom: isDark ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid #cbd5e1',
  };

  const tableCellSx = {
    color: isDark ? '#e2e8f0' : '#1e293b',
    fontWeight: 500,
    fontSize: '0.875rem',
    py: 1.5,
    borderBottom: isDark ? '1px solid rgba(255, 255, 255, 0.04)' : '1px solid #f1f5f9',
  };

  return (
    <Box sx={{ p: { xs: 2, md: 4 }, maxWidth: 1440, mx: 'auto' }}>
      {/* Page Header */}
      <PageHeader
        title="Billing & Subscription Suite"
        subtitle="Manage plan tier, live quota protection, automated gateway transactions, and official VAT tax invoices."
        category="Enterprise Billing"
        badgeText="PAYSTACK SECURE"
        badgeColor="success"
        action={
          <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
            <CurrencySelector size="small" />
            <Button
              variant="outlined"
              onClick={() => navigate('/company/usage')}
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
              Usage Telemetry
            </Button>
            <Button
              variant="contained"
              onClick={() => navigate('/pricing')}
              startIcon={<Stars />}
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
              Change / Upgrade Plan
            </Button>
          </Box>
        }
      />

      {/* Hero Subscription Card */}
      <Card
        className="glass-panel"
        sx={{
          borderRadius: '20px',
          mb: 4,
          position: 'relative',
          overflow: 'hidden',
          background: isDark
            ? 'linear-gradient(135deg, #090d16 0%, #13122b 50%, #0d1e3a 100%)'
            : 'linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)',
          color: '#ffffff',
          border: '1px solid rgba(139, 92, 246, 0.3)',
          boxShadow: '0 12px 40px rgba(0,0,0,0.4)',
        }}
      >
        <Box
          sx={{
            position: 'absolute',
            top: '-50%',
            right: '-10%',
            width: 450,
            height: 450,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(139, 92, 246, 0.25) 0%, transparent 70%)',
            pointerEvents: 'none',
          }}
        />

        <CardContent sx={{ p: { xs: 3, md: 4.5 } }}>
          <Grid container spacing={3} alignItems="center">
            <Grid item xs={12} lg={8}>
              <Box
                sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1.5, flexWrap: 'wrap' }}
              >
                <Typography
                  variant="h4"
                  sx={{
                    fontWeight: 900,
                    letterSpacing: '-0.02em',
                    color: '#ffffff',
                  }}
                >
                  {subscription?.planSnapshot?.name || 'Enterprise Pro Plan'}
                </Typography>
                <StatusChip
                  status={subscription?.status || 'ACTIVE'}
                  label={
                    subscription?.status === 'ACTIVE'
                      ? 'Active Enterprise Tier'
                      : subscription?.status
                  }
                />
                {subscription?.cancelAtPeriodEnd && (
                  <Chip
                    label={`Cancels on ${new Date(subscription.currentPeriodEnd).toLocaleDateString()}`}
                    color="error"
                    size="small"
                    sx={{ fontWeight: 700 }}
                  />
                )}
              </Box>

              <Typography
                variant="body1"
                sx={{
                  color: 'rgba(255, 255, 255, 0.8)',
                  mb: 3.5,
                  maxWidth: 680,
                  lineHeight: 1.6,
                }}
              >
                Multi-tenant tenant isolation with runtime quota guards, automatic VAT invoice
                generation, and Paystack recurring settlement.
              </Typography>

              <Grid
                container
                spacing={3}
                sx={{ pt: 2, borderTop: '1px solid rgba(255, 255, 255, 0.12)' }}
              >
                <Grid item xs={6} sm={4}>
                  <Typography
                    variant="caption"
                    sx={{
                      color: 'rgba(255, 255, 255, 0.6)',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                    }}
                  >
                    Billing Interval
                  </Typography>
                  <Typography
                    variant="h6"
                    sx={{ fontWeight: 800, color: '#ffffff', textTransform: 'uppercase' }}
                  >
                    {subscription?.billingInterval || 'MONTHLY'}
                  </Typography>
                </Grid>

                <Grid item xs={6} sm={4}>
                  <Typography
                    variant="caption"
                    sx={{
                      color: 'rgba(255, 255, 255, 0.6)',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                    }}
                  >
                    Recurring Rate
                  </Typography>
                  <Typography
                    variant="h6"
                    sx={{ fontWeight: 800, color: '#ffffff', fontFamily: 'monospace' }}
                  >
                    {formatAmount(subscription?.price || 0, {
                      fromCurrency: subscription?.currency || 'NGN',
                    })}
                    <Typography
                      component="span"
                      variant="body2"
                      sx={{ color: 'rgba(255,255,255,0.7)', ml: 0.5 }}
                    >
                      /{subscription?.billingInterval === 'YEARLY' ? 'yr' : 'mo'}
                    </Typography>
                  </Typography>
                </Grid>

                <Grid item xs={12} sm={4}>
                  <Typography
                    variant="caption"
                    sx={{
                      color: 'rgba(255, 255, 255, 0.6)',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                    }}
                  >
                    Next Renewal Date
                  </Typography>
                  <Typography variant="h6" sx={{ fontWeight: 800, color: '#ffffff' }}>
                    {subscription?.renewalDate
                      ? new Date(subscription.renewalDate).toLocaleDateString()
                      : 'Continuous Active'}
                  </Typography>
                </Grid>
              </Grid>
            </Grid>

            <Grid item xs={12} lg={4} sx={{ textAlign: { xs: 'left', lg: 'right' } }}>
              <Box
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 1.5,
                  alignItems: { xs: 'flex-start', lg: 'flex-end' },
                }}
              >
                {subscription?.cancelAtPeriodEnd ? (
                  <Button
                    variant="contained"
                    onClick={handleReactivate}
                    sx={{
                      bgcolor: '#ffffff',
                      color: '#0f172a',
                      fontWeight: 800,
                      px: 3,
                      py: 1.2,
                      borderRadius: '10px',
                      textTransform: 'none',
                      '&:hover': { bgcolor: '#f1f5f9' },
                    }}
                  >
                    Reactivate Subscription
                  </Button>
                ) : (
                  <Button
                    variant="outlined"
                    onClick={() => setCancelModalOpen(true)}
                    sx={{
                      color: '#ffffff',
                      borderColor: 'rgba(255, 255, 255, 0.3)',
                      fontWeight: 700,
                      borderRadius: '10px',
                      textTransform: 'none',
                      '&:hover': {
                        borderColor: '#ef4444',
                        color: '#ef4444',
                        bgcolor: 'rgba(239, 68, 68, 0.1)',
                      },
                    }}
                  >
                    Cancel Plan
                  </Button>
                )}
                <Button
                  variant="text"
                  onClick={() => navigate('/pricing')}
                  sx={{
                    color: 'rgba(255, 255, 255, 0.75)',
                    textTransform: 'none',
                    fontSize: '0.85rem',
                    p: 0,
                    '&:hover': { color: '#ffffff', bgcolor: 'transparent' },
                  }}
                >
                  Explore all plan tiers & limits →
                </Button>
              </Box>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Quota Overview Stat Cards */}
      {usage && (
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid item xs={12} sm={6} md={3}>
            <StatCard
              title="ACTIVE USER SEATS"
              value={`${usage.users?.used || 0} / ${usage.users?.unlimited ? '∞' : usage.users?.limit || 0}`}
              subtitle={`${usage.users?.percentage || 0}% Allocated`}
              icon={<People sx={{ fontSize: 22 }} />}
              color="violet"
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <StatCard
              title="STORE BRANCHES"
              value={`${usage.branches?.used || 0} / ${usage.branches?.unlimited ? '∞' : usage.branches?.limit || 0}`}
              subtitle={`${usage.branches?.percentage || 0}% Allocated`}
              icon={<Store sx={{ fontSize: 22 }} />}
              color="sky"
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <StatCard
              title="LOGISTICS WAREHOUSES"
              value={`${usage.warehouses?.used || 0} / ${usage.warehouses?.unlimited ? '∞' : usage.warehouses?.limit || 0}`}
              subtitle={`${usage.warehouses?.percentage || 0}% Allocated`}
              icon={<Apartment sx={{ fontSize: 22 }} />}
              color="emerald"
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <StatCard
              title="CATALOG PRODUCTS (SKUS)"
              value={`${(usage.products?.used || 0).toLocaleString()} / ${usage.products?.unlimited ? '∞' : (usage.products?.limit || 0).toLocaleString()}`}
              subtitle={`${usage.products?.percentage || 0}% Allocated`}
              icon={<Inventory2 sx={{ fontSize: 22 }} />}
              color="amber"
            />
          </Grid>
        </Grid>
      )}

      {/* Invoices and Transactions */}
      <Grid container spacing={3}>
        {/* Invoices Table */}
        <Grid item xs={12} lg={7}>
          <Card className="glass-panel" sx={{ borderRadius: '18px', overflow: 'hidden' }}>
            <Box
              sx={{ p: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
            >
              <Box>
                <Typography
                  variant="h6"
                  sx={{ fontWeight: 800, color: isDark ? '#f8fafc' : '#0f172a' }}
                >
                  Official SaaS Invoices & Tax Receipts
                </Typography>
                <Typography variant="caption" sx={{ color: isDark ? '#9ca3af' : '#64748b' }}>
                  Itemized billing records with VAT compliance
                </Typography>
              </Box>
              <Chip label={`${invoices.length} Invoices`} size="small" sx={{ fontWeight: 700 }} />
            </Box>

            <Box sx={{ overflowX: 'auto' }}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell sx={tableHeaderSx}>Invoice #</TableCell>
                    <TableCell sx={tableHeaderSx}>Issue Date</TableCell>
                    <TableCell sx={tableHeaderSx}>Total Due</TableCell>
                    <TableCell sx={tableHeaderSx}>Amount Paid</TableCell>
                    <TableCell sx={tableHeaderSx}>Status</TableCell>
                    <TableCell sx={{ ...tableHeaderSx, textAlign: 'right' }}>Action</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {invoices.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={6}
                        sx={{ textAlign: 'center', py: 5, color: isDark ? '#9ca3af' : '#64748b' }}
                      >
                        <Receipt
                          sx={{ fontSize: 40, opacity: 0.3, mb: 1, display: 'block', mx: 'auto' }}
                        />
                        No billing invoices generated yet.
                      </TableCell>
                    </TableRow>
                  ) : (
                    invoices.map((inv) => (
                      <TableRow key={inv._id} hover>
                        <TableCell
                          sx={{
                            ...tableCellSx,
                            fontFamily: 'monospace',
                            fontWeight: 700,
                            color: '#8b5cf6',
                          }}
                        >
                          {inv.invoiceNumber}
                        </TableCell>
                        <TableCell sx={tableCellSx}>
                          {new Date(inv.issueDate).toLocaleDateString()}
                        </TableCell>
                        <TableCell
                          sx={{ ...tableCellSx, fontFamily: 'monospace', fontWeight: 700 }}
                        >
                          {formatInvoiceCurrency(inv.total, inv.currency)}
                        </TableCell>
                        <TableCell
                          sx={{
                            ...tableCellSx,
                            fontFamily: 'monospace',
                            fontWeight: 700,
                            color: inv.status === 'PAID' ? '#10b981' : undefined,
                          }}
                        >
                          {formatInvoiceCurrency(
                            inv.amountPaid ?? (inv.status === 'PAID' ? inv.total : 0),
                            inv.currency
                          )}
                        </TableCell>
                        <TableCell sx={tableCellSx}>
                          <StatusChip status={inv.status} label={inv.status} />
                        </TableCell>
                        <TableCell sx={{ ...tableCellSx, textAlign: 'right' }}>
                          <Button
                            size="small"
                            variant="outlined"
                            onClick={() => setSelectedInvoice(inv)}
                            sx={{
                              borderRadius: '8px',
                              textTransform: 'none',
                              fontWeight: 700,
                              fontSize: '0.75rem',
                              borderColor: isDark ? 'rgba(255,255,255,0.15)' : '#cbd5e1',
                            }}
                          >
                            View
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </Box>
          </Card>
        </Grid>

        {/* Transactions Table */}
        <Grid item xs={12} lg={5}>
          <Card className="glass-panel" sx={{ borderRadius: '18px', overflow: 'hidden' }}>
            <Box sx={{ p: 3 }}>
              <Typography
                variant="h6"
                sx={{ fontWeight: 800, color: isDark ? '#f8fafc' : '#0f172a' }}
              >
                Paystack Gateway Settlements
              </Typography>
              <Typography variant="caption" sx={{ color: isDark ? '#9ca3af' : '#64748b' }}>
                Direct real-time payment provider logs
              </Typography>
            </Box>

            <Box sx={{ overflowX: 'auto' }}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell sx={tableHeaderSx}>Reference</TableCell>
                    <TableCell sx={tableHeaderSx}>Amount</TableCell>
                    <TableCell sx={{ ...tableHeaderSx, textAlign: 'right' }}>Status</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {transactions.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={3}
                        sx={{ textAlign: 'center', py: 5, color: isDark ? '#9ca3af' : '#64748b' }}
                      >
                        <CreditCard
                          sx={{ fontSize: 40, opacity: 0.3, mb: 1, display: 'block', mx: 'auto' }}
                        />
                        No gateway transactions recorded.
                      </TableCell>
                    </TableRow>
                  ) : (
                    transactions.slice(0, 6).map((tx) => (
                      <TableRow key={tx._id} hover>
                        <TableCell sx={tableCellSx}>
                          <Typography
                            variant="body2"
                            sx={{ fontFamily: 'monospace', fontWeight: 600, fontSize: '0.8rem' }}
                          >
                            {tx.providerReference}
                          </Typography>
                          <Typography
                            variant="caption"
                            sx={{ color: isDark ? '#9ca3af' : '#64748b' }}
                          >
                            {new Date(tx.createdAt).toLocaleDateString()}
                          </Typography>
                        </TableCell>
                        <TableCell
                          sx={{ ...tableCellSx, fontFamily: 'monospace', fontWeight: 700 }}
                        >
                          {formatInvoiceCurrency(tx.amount, tx.currency)}
                        </TableCell>
                        <TableCell sx={{ ...tableCellSx, textAlign: 'right' }}>
                          <StatusChip status={tx.status} label={tx.status} />
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </Box>
          </Card>
        </Grid>
      </Grid>

      {/* Invoice Detail Dialog */}
      <Dialog
        open={Boolean(selectedInvoice)}
        onClose={() => setSelectedInvoice(null)}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: '20px',
            bgcolor: isDark ? '#0b0f19' : '#ffffff',
            border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid #e2e8f0',
            backgroundImage: 'none',
          },
        }}
      >
        {selectedInvoice && (
          <>
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
                <Typography
                  variant="h6"
                  sx={{ fontWeight: 900, color: '#ffffff', letterSpacing: '-0.01em' }}
                >
                  STOCKORA ENTERPRISE
                </Typography>
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)' }}>
                  Official SaaS Tax Invoice & Receipt
                </Typography>
              </Box>
              <IconButton onClick={() => setSelectedInvoice(null)} sx={{ color: '#ffffff' }}>
                <Close />
              </IconButton>
            </DialogTitle>

            <DialogContent sx={{ p: 4 }}>
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  mb: 3,
                  flexWrap: 'wrap',
                  gap: 2,
                }}
              >
                <Box>
                  <Typography
                    variant="caption"
                    sx={{
                      color: isDark ? '#9ca3af' : '#64748b',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                    }}
                  >
                    Invoice Number
                  </Typography>
                  <Typography
                    variant="h6"
                    sx={{ fontWeight: 800, fontFamily: 'monospace', color: '#8b5cf6' }}
                  >
                    {selectedInvoice.invoiceNumber}
                  </Typography>
                </Box>
                <Box sx={{ textAlign: 'right' }}>
                  <Typography
                    variant="caption"
                    sx={{
                      color: isDark ? '#9ca3af' : '#64748b',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                    }}
                  >
                    Payment Status
                  </Typography>
                  <Box sx={{ mt: 0.5 }}>
                    <StatusChip status={selectedInvoice.status} label={selectedInvoice.status} />
                  </Box>
                </Box>
              </Box>

              <Card
                sx={{
                  p: 2.5,
                  mb: 3,
                  borderRadius: '12px',
                  bgcolor: isDark ? 'rgba(30, 41, 59, 0.4)' : '#f8fafc',
                }}
              >
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <Typography
                      variant="caption"
                      sx={{
                        color: isDark ? '#9ca3af' : '#64748b',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                      }}
                    >
                      Billed To
                    </Typography>
                    <Typography variant="body1" sx={{ fontWeight: 700 }}>
                      {selectedInvoice.tenantName || 'Enterprise Tenant'}
                    </Typography>
                    <Typography variant="caption" sx={{ color: isDark ? '#9ca3af' : '#64748b' }}>
                      {selectedInvoice.tenantEmail || 'admin@enterprise.com'}
                    </Typography>
                  </Grid>
                  <Grid item xs={12} sm={6} sx={{ textAlign: { sm: 'right' } }}>
                    <Typography
                      variant="caption"
                      sx={{
                        color: isDark ? '#9ca3af' : '#64748b',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                      }}
                    >
                      Date of Issue
                    </Typography>
                    <Typography variant="body1" sx={{ fontWeight: 600 }}>
                      {new Date(selectedInvoice.issueDate).toLocaleDateString()}
                    </Typography>
                    <Typography variant="caption" sx={{ color: isDark ? '#9ca3af' : '#64748b' }}>
                      Ref: {selectedInvoice.transactionReference || 'N/A'}
                    </Typography>
                  </Grid>
                </Grid>
              </Card>

              <Table sx={{ mb: 2 }}>
                <TableHead>
                  <TableRow>
                    <TableCell sx={tableHeaderSx}>Description / Plan</TableCell>
                    <TableCell sx={{ ...tableHeaderSx, textAlign: 'right' }}>Amount</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {selectedInvoice.lineItems?.map((li: any, idx: number) => (
                    <TableRow key={idx}>
                      <TableCell sx={tableCellSx}>{li.description}</TableCell>
                      <TableCell
                        sx={{ ...tableCellSx, textAlign: 'right', fontFamily: 'monospace' }}
                      >
                        {formatInvoiceCurrency(li.amount, selectedInvoice.currency)}
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700 }}>Subtotal:</TableCell>
                    <TableCell
                      sx={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 700 }}
                    >
                      {formatInvoiceCurrency(
                        selectedInvoice.subtotal ?? selectedInvoice.total,
                        selectedInvoice.currency
                      )}
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700 }}>
                      VAT ({((selectedInvoice.taxRate ?? 0.075) * 100).toFixed(1)}%):
                    </TableCell>
                    <TableCell
                      sx={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 700 }}
                    >
                      {formatInvoiceCurrency(selectedInvoice.tax || 0, selectedInvoice.currency)}
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 800 }}>Invoice Total Due:</TableCell>
                    <TableCell
                      sx={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 800 }}
                    >
                      {formatInvoiceCurrency(selectedInvoice.total, selectedInvoice.currency, true)}
                    </TableCell>
                  </TableRow>
                  <TableRow sx={{ bgcolor: isDark ? 'rgba(16, 185, 129, 0.15)' : '#ecfdf5' }}>
                    <TableCell sx={{ fontWeight: 900, fontSize: '1rem', color: '#10b981' }}>
                      Amount Actually Paid:
                    </TableCell>
                    <TableCell
                      sx={{
                        textAlign: 'right',
                        fontFamily: 'monospace',
                        fontWeight: 900,
                        fontSize: '1.1rem',
                        color: '#10b981',
                      }}
                    >
                      {formatInvoiceCurrency(
                        selectedInvoice.amountPaid ??
                          (selectedInvoice.status === 'PAID' ? selectedInvoice.total : 0),
                        selectedInvoice.currency,
                        true
                      )}
                    </TableCell>
                  </TableRow>
                  {selectedInvoice.amountOutstanding > 0 && (
                    <TableRow sx={{ bgcolor: isDark ? 'rgba(239, 68, 68, 0.15)' : '#fef2f2' }}>
                      <TableCell sx={{ fontWeight: 800, color: '#ef4444' }}>
                        Outstanding Balance:
                      </TableCell>
                      <TableCell
                        sx={{
                          textAlign: 'right',
                          fontFamily: 'monospace',
                          fontWeight: 800,
                          color: '#ef4444',
                        }}
                      >
                        {formatInvoiceCurrency(
                          selectedInvoice.amountOutstanding,
                          selectedInvoice.currency,
                          true
                        )}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </DialogContent>

            <DialogActions sx={{ p: 3, pt: 0 }}>
              <Button
                onClick={() => setSelectedInvoice(null)}
                sx={{ color: isDark ? '#9ca3af' : '#64748b' }}
              >
                Close
              </Button>
              <Button
                variant="contained"
                startIcon={<Print />}
                onClick={() => window.print()}
                sx={{
                  bgcolor: '#8b5cf6',
                  fontWeight: 700,
                  borderRadius: '8px',
                  textTransform: 'none',
                  '&:hover': { bgcolor: '#7c3aed' },
                }}
              >
                Print Invoice Receipt
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>

      {/* Cancel Plan Dialog */}
      <Dialog
        open={cancelModalOpen}
        onClose={() => !cancelling && setCancelModalOpen(false)}
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
        <DialogTitle sx={{ fontWeight: 800, color: '#ef4444' }}>
          Cancel Enterprise Subscription
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: isDark ? '#9ca3af' : '#64748b', mb: 2 }}>
            Are you sure you want to cancel your plan? You can retain access until the end of your
            billing cycle or cancel immediately.
          </Typography>

          <FormControlLabel
            control={
              <Checkbox
                checked={cancelImmediately}
                onChange={(e) => setCancelImmediately(e.target.checked)}
                sx={{ color: '#ef4444', '&.Mui-checked': { color: '#ef4444' } }}
              />
            }
            label={
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                Cancel immediately (Revoke tenant quotas today)
              </Typography>
            }
            sx={{ mb: 2 }}
          />

          <TextField
            fullWidth
            multiline
            rows={2}
            label="Reason for cancellation (optional)"
            placeholder="Tell us why you are leaving..."
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
          />
        </DialogContent>
        <DialogActions sx={{ p: 3, pt: 0 }}>
          <Button
            onClick={() => setCancelModalOpen(false)}
            disabled={cancelling}
            sx={{ color: isDark ? '#9ca3af' : '#64748b' }}
          >
            Keep Subscription
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleCancelSubscription}
            disabled={cancelling}
            sx={{ fontWeight: 700, borderRadius: '8px', textTransform: 'none' }}
          >
            {cancelling ? 'Cancelling...' : 'Confirm Cancellation'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default BillingDashboard;
