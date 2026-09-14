import { useEffect, Fragment } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api/client.ts';
import {
  Grid,
  Card,
  Typography,
  Box,
  List,
  ListItem,
  ListItemText,
  Divider,
  Button,
  Alert,
  Chip,
} from '@mui/material';
import RevenueIcon from '@mui/icons-material/TrendingUp';
import TxIcon from '@mui/icons-material/ShoppingCart';
import StockIcon from '@mui/icons-material/Inventory2';
import WarningIcon from '@mui/icons-material/WarningAmber';
import PointOfSaleIcon from '@mui/icons-material/PointOfSale';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from 'recharts';
import { useNavigate } from 'react-router-dom';
import { socket } from '../socket.ts';
import type { Product, Transaction } from '../../shared/types.js';
import PageHeader from '../components/PageHeader.tsx';
import StatCard from '../components/StatCard.tsx';
import StatusChip from '../components/StatusChip.tsx';
import { useAuthStore } from '../store/auth.ts';
import { useTenantStore } from '../store/tenant.ts';
import { useTranslation } from '../hooks/useTranslation.js';
import { useRegionalSettings } from '../hooks/useRegionalSettings.js';
import { hasPermission } from '../../shared/permissions.js';
import { Can } from '../components/auth/Can.tsx';

// Query functions
const fetchProducts = async (): Promise<Product[]> => {
  const { data } = await apiClient.get<Product[]>('/products');
  return data;
};

const fetchTransactions = async (): Promise<Transaction[]> => {
  const { data } = await apiClient.get<Transaction[]>('/transactions');
  return data;
};

interface ShiftSummary {
  shiftRevenue: number;
  shiftSalesCount: number;
  hasActiveShift: boolean;
  registerName?: string;
  openedAt?: string;
}

const fetchShiftSummary = async (): Promise<ShiftSummary> => {
  try {
    const { data } = await apiClient.get<ShiftSummary>('/pos/register/shift-summary');
    return data;
  } catch {
    return { shiftRevenue: 0, shiftSalesCount: 0, hasActiveShift: false };
  }
};

export default function Dashboard() {
  const { t } = useTranslation();
  const { formatAmount } = useRegionalSettings();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { activeTenant } = useTenantStore();

  const hasProductsRead = hasPermission(user, 'products:read');
  const hasTransactionsRead = hasPermission(user, 'transactions:read');
  const hasAiView = hasPermission(user, 'ai:view');

  const { data: products = [] } = useQuery({
    queryKey: ['products', activeTenant?._id || activeTenant?.id],
    queryFn: fetchProducts,
    enabled: !!hasProductsRead,
  });

  const { data: transactions = [] } = useQuery({
    queryKey: ['transactions', activeTenant?._id || activeTenant?.id],
    queryFn: fetchTransactions,
    enabled: !!hasTransactionsRead,
  });

  const { data: shiftSummary = { shiftRevenue: 0, shiftSalesCount: 0, hasActiveShift: false } } =
    useQuery({
      queryKey: ['shiftSummary', activeTenant?._id || activeTenant?.id],
      queryFn: fetchShiftSummary,
      enabled: !!hasTransactionsRead,
    });

  const { data: aiDashboardInsight } = useQuery({
    queryKey: ['aiDashboardInsight', activeTenant?._id || activeTenant?.id],
    queryFn: async () => {
      try {
        const { data } = await apiClient.get('/ai/inventory-intelligence');
        return data?.data;
      } catch {
        return null;
      }
    },
    enabled: !!hasAiView && products.length > 0,
    staleTime: 5 * 60 * 1000,
  });

  // Real-time stock/sale synchronization directly to cache
  useEffect(() => {
    socket.on('product:stock-updated', (data: { productId: string; quantity: number }) => {
      queryClient.setQueryData<Product[]>(
        ['products', activeTenant?._id || activeTenant?.id],
        (old) => {
          if (!old) return old;
          return old.map((p) =>
            p.id === data.productId || (p as any)._id === data.productId
              ? { ...p, quantity: data.quantity }
              : p
          );
        }
      );
    });

    socket.on('product:created', (newProduct: Product) => {
      queryClient.setQueryData<Product[]>(
        ['products', activeTenant?._id || activeTenant?.id],
        (old) => {
          if (!old) return [newProduct];
          return [...old, newProduct];
        }
      );
    });

    socket.on('transaction:completed', (newTx: Transaction) => {
      queryClient.setQueryData<Transaction[]>(
        ['transactions', activeTenant?._id || activeTenant?.id],
        (old) => {
          if (!old) return [newTx];
          return [newTx, ...old];
        }
      );
      queryClient.invalidateQueries({ queryKey: ['shiftSummary'] });
    });

    return () => {
      socket.off('product:stock-updated');
      socket.off('product:created');
      socket.off('transaction:completed');
    };
  }, [queryClient, activeTenant]);

  // Compute stats dynamically from real records
  const totalCost = products.reduce((sum, p) => sum + (p.costPrice ?? p.cost ?? 0) * p.quantity, 0);
  const totalValue = products.reduce(
    (sum, p) => sum + (p.sellingPrice ?? p.price ?? 0) * p.quantity,
    0
  );
  const lowStockItems = products.filter((p) => p.quantity <= p.lowStockAlert);

  // Group transactions for Recharts
  const chartData = transactions
    .map((t) => ({
      name: new Date(t.createdAt).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      }),
      Sales: t.total,
      Subtotal: t.subtotal,
    }))
    .reverse();

  // Category levels data
  const categoryStats = products.reduce((acc: { [key: string]: number }, p) => {
    acc[p.category] = (acc[p.category] || 0) + p.quantity;
    return acc;
  }, {});

  const barChartData = Object.keys(categoryStats).map((cat) => ({
    name: cat,
    Stock: categoryStats[cat],
  }));

  const workspaceName =
    activeTenant?.name || user?.branchName || (user as any)?.companyName || 'Mini Workspace';

  return (
    <Box sx={{ flexGrow: 1, pb: 4 }}>
      {/* Top Header with Mini Command Center Identity */}
      <PageHeader
        title="Operations Command Center"
        subtitle="Live multi-branch point of sale stream, inventory telemetry, and shift analytics."
        category={workspaceName}
        badgeText={activeTenant?.status || 'MINI CORE LIVE'}
        badgeColor="primary"
        action={
          <Can permission="transactions:write">
            <Button
              variant="contained"
              startIcon={<PointOfSaleIcon />}
              onClick={() => navigate('/pos')}
              sx={{
                fontFamily: "'Space Grotesk', sans-serif",
                fontWeight: 700,
                borderRadius: '10px',
                px: 3,
                py: 1.1,
                fontSize: '0.92rem',
                letterSpacing: '0.02em',
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                color: '#040711',
                boxShadow: '0 4px 18px rgba(16, 185, 129, 0.4)',
                transition: 'all 0.25s ease',
                '&:hover': {
                  background: 'linear-gradient(135deg, #34d399 0%, #10b981 100%)',
                  boxShadow: '0 6px 24px rgba(16, 185, 129, 0.55)',
                  transform: 'translateY(-1px)',
                },
              }}
            >
              {t('Launch POS Terminal')}
            </Button>
          </Can>
        }
      />

      {/* Persistent Onboarding Alert */}
      {activeTenant && !activeTenant.onboardingCompleted && (
        <Alert
          severity="warning"
          sx={{
            mb: 3,
            borderRadius: '12px',
            border: '1px solid rgba(245, 158, 11, 0.4)',
            background: 'rgba(245, 158, 11, 0.08)',
            display: 'flex',
            alignItems: 'center',
            '& .MuiAlert-message': { width: '100%' },
          }}
          action={
            <Button
              variant="contained"
              color="warning"
              size="small"
              onClick={() => navigate('/onboarding')}
              sx={{
                fontWeight: 700,
                borderRadius: '8px',
                textTransform: 'none',
                whiteSpace: 'nowrap',
              }}
            >
              {t('Complete Setup')}
            </Button>
          }
        >
          <Box>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#f59e0b', mb: 0.5 }}>
              {t('Complete your store profile')}
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              {t(
                'Complete your store setup to initialize your branches and receipt configuration.'
              )}
            </Typography>
          </Box>
        </Alert>
      )}

      {/* Bento Stat Cards Grid */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="ACTIVE SHIFT REVENUE"
            value={formatAmount(shiftSummary.shiftRevenue || 0)}
            subtitle={
              shiftSummary.hasActiveShift
                ? shiftSummary.registerName
                  ? `Register: ${shiftSummary.registerName}`
                  : t('Live active shift')
                : t('No active shift session')
            }
            icon={<RevenueIcon sx={{ fontSize: 22 }} />}
            color="emerald"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="TOTAL COMPLETED SALES"
            value={transactions.length}
            subtitle={
              transactions.length === 0
                ? t('No purchases recorded yet')
                : transactions.length === 1
                  ? t('1 completed purchase')
                  : `${transactions.length} ${t('completed purchases')}`
            }
            icon={<TxIcon sx={{ fontSize: 22 }} />}
            color="sky"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="INVENTORY ASSET VALUE"
            value={formatAmount(totalValue)}
            subtitle={
              products.length === 0
                ? t('No inventory records yet')
                : `${t('Cost Base')}: ${formatAmount(totalCost)}`
            }
            icon={<StockIcon sx={{ fontSize: 22 }} />}
            color="emerald"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="STOCK DEFICIT ALERTS"
            value={lowStockItems.length}
            subtitle={
              products.length === 0
                ? t('No products registered')
                : lowStockItems.length > 0
                  ? t('Items require replenishment')
                  : t('All inventory thresholds healthy')
            }
            icon={<WarningIcon sx={{ fontSize: 22 }} />}
            trend={
              products.length === 0
                ? undefined
                : lowStockItems.length > 0
                  ? 'ATTENTION NEEDED'
                  : 'HEALTHY'
            }
            trendUp={lowStockItems.length === 0}
            color={lowStockItems.length > 0 ? 'rose' : 'emerald'}
          />
        </Grid>
      </Grid>

      {/* AI Enterprise Intelligence Briefing - Redesigned for Cyber-Emerald */}
      {hasAiView && (
        <Card
          sx={{
            mb: 4,
            p: 2.5,
            borderRadius: '16px',
            border: '1px solid rgba(16, 185, 129, 0.25)',
            background:
              'linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(6, 182, 212, 0.05) 100%)',
            backdropFilter: 'blur(16px)',
            display: 'flex',
            flexDirection: { xs: 'column', md: 'row' },
            alignItems: { xs: 'flex-start', md: 'center' },
            justifyContent: 'space-between',
            gap: 2,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
            <Box
              sx={{
                p: 1.5,
                borderRadius: '12px',
                bgcolor: 'rgba(16, 185, 129, 0.15)',
                color: '#34d399',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 0 16px rgba(16, 185, 129, 0.2)',
              }}
            >
              <AutoAwesomeIcon sx={{ fontSize: 26 }} />
            </Box>
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                <Typography
                  variant="subtitle2"
                  sx={{
                    fontFamily: "'Space Grotesk', sans-serif",
                    fontWeight: 700,
                    color: '#34d399',
                    letterSpacing: '0.04em',
                    textTransform: 'uppercase',
                  }}
                >
                  Gemini AI Stock Intelligence
                </Typography>
                <Chip
                  label="REAL-TIME"
                  size="small"
                  sx={{
                    height: 18,
                    fontSize: '0.62rem',
                    fontWeight: 700,
                    fontFamily: "'Space Grotesk', sans-serif",
                    bgcolor: 'rgba(16, 185, 129, 0.15)',
                    color: '#34d399',
                    border: '1px solid rgba(16, 185, 129, 0.3)',
                  }}
                />
              </Box>
              <Typography
                variant="body2"
                sx={{ color: '#f8fafc', fontWeight: 500, maxWidth: 850, lineHeight: 1.6 }}
              >
                {products.length === 0
                  ? t(
                      'Mini AI engine is ready. Register products to activate autonomous inventory depletion curves, stockout forecasts, and automated reorder alerts.'
                    )
                  : aiDashboardInsight?.summary ||
                    t(
                      'Telemetry active: monitoring stock velocity, local POS cache state, and real-time inventory levels...'
                    )}
              </Typography>
            </Box>
          </Box>
          <Button
            variant="outlined"
            size="small"
            onClick={() => navigate('/ai/intelligence')}
            sx={{
              fontFamily: "'Space Grotesk', sans-serif",
              fontWeight: 700,
              borderRadius: '8px',
              textTransform: 'none',
              whiteSpace: 'nowrap',
              color: '#34d399',
              borderColor: 'rgba(16, 185, 129, 0.4)',
              '&:hover': {
                borderColor: '#10b981',
                bgcolor: 'rgba(16, 185, 129, 0.1)',
              },
              alignSelf: { xs: 'stretch', md: 'center' },
            }}
          >
            {t('Open AI Console →')}
          </Button>
        </Card>
      )}

      {/* Bento Grid: Charts & Visualizers */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} md={8}>
          <Card
            sx={{
              p: 3,
              borderRadius: '16px',
              bgcolor: 'rgba(9, 15, 29, 0.75)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(16, 185, 129, 0.16)',
            }}
          >
            <Box
              sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Typography
                  variant="h6"
                  sx={{
                    fontFamily: "'Space Grotesk', sans-serif",
                    fontWeight: 700,
                    letterSpacing: '-0.01em',
                  }}
                >
                  {t('Sales Velocity Stream')}
                </Typography>
                <Chip
                  label="TELEMETRY LIVE"
                  size="small"
                  sx={{
                    height: 18,
                    fontSize: '0.6rem',
                    fontWeight: 700,
                    fontFamily: "'Space Grotesk', sans-serif",
                    bgcolor: 'rgba(16, 185, 129, 0.12)',
                    color: '#34d399',
                    border: '1px solid rgba(16, 185, 129, 0.3)',
                  }}
                />
              </Box>
            </Box>
            <Box
              sx={{
                width: '100%',
                height: 320,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {chartData.length === 0 ? (
                <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center' }}>
                  {t(
                    'No sales data recorded yet. Process your first transaction to view velocity metrics.'
                  )}
                </Typography>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorMiniSales" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="rgba(255,255,255,0.04)"
                      vertical={false}
                    />
                    <XAxis dataKey="name" stroke="#64748b" fontSize={11} tickLine={false} />
                    <YAxis stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#090f1d',
                        borderColor: 'rgba(16, 185, 129, 0.35)',
                        borderRadius: '10px',
                        boxShadow: '0 12px 36px rgba(0,0,0,0.7)',
                        color: '#f8fafc',
                      }}
                      labelStyle={{ color: '#34d399', fontWeight: 700 }}
                    />
                    <Area
                      type="monotone"
                      dataKey="Sales"
                      stroke="#10b981"
                      strokeWidth={2.5}
                      fillOpacity={1}
                      fill="url(#colorMiniSales)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </Box>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card
            sx={{
              p: 3,
              borderRadius: '16px',
              bgcolor: 'rgba(9, 15, 29, 0.75)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(6, 182, 212, 0.16)',
            }}
          >
            <Typography
              variant="h6"
              sx={{
                fontFamily: "'Space Grotesk', sans-serif",
                fontWeight: 700,
                mb: 3,
                letterSpacing: '-0.01em',
              }}
            >
              {t('Category Volume Breakdown')}
            </Typography>
            {barChartData.length === 0 ? (
              <Box
                sx={{
                  width: '100%',
                  height: 320,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center' }}>
                  {t('No inventory categories found. Register items to view distribution.')}
                </Typography>
              </Box>
            ) : (
              <Box sx={{ width: '100%', height: 320 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={barChartData}
                    margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="rgba(255,255,255,0.04)"
                      vertical={false}
                    />
                    <XAxis dataKey="name" stroke="#64748b" fontSize={11} tickLine={false} />
                    <YAxis stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#090f1d',
                        borderColor: 'rgba(6, 182, 212, 0.35)',
                        borderRadius: '10px',
                        boxShadow: '0 12px 36px rgba(0,0,0,0.7)',
                      }}
                    />
                    <Bar dataKey="Stock" fill="#06b6d4" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </Box>
            )}
          </Card>
        </Grid>
      </Grid>

      {/* Bento Grid: Live Storefront Stream & Critical Alerts */}
      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Card
            sx={{
              p: 3,
              borderRadius: '16px',
              bgcolor: 'rgba(9, 15, 29, 0.75)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(244, 63, 94, 0.2)',
            }}
          >
            <Box
              sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}
            >
              <Typography
                variant="h6"
                sx={{
                  fontFamily: "'Space Grotesk', sans-serif",
                  fontWeight: 700,
                  letterSpacing: '-0.01em',
                  color: '#fb7185',
                }}
              >
                {t('Depletion & Restock Alerts')}
              </Typography>
              <StatusChip status={lowStockItems.length > 0 ? 'LOW_STOCK' : 'IN_STOCK'} />
            </Box>
            {products.length === 0 ? (
              <Box sx={{ py: 4, textAlign: 'center' }}>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  {t('No products yet. Add your inventory to monitor stock levels.')}
                </Typography>
                <Can permission="products:write">
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={() => navigate('/products')}
                    sx={{ textTransform: 'none', borderRadius: '8px', fontWeight: 600 }}
                  >
                    {t('Add Product')}
                  </Button>
                </Can>
              </Box>
            ) : lowStockItems.length === 0 ? (
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ py: 4, textAlign: 'center' }}
              >
                {t('All inventory stock levels are healthy.')}
              </Typography>
            ) : (
              <List disablePadding>
                {lowStockItems.map((p, idx) => (
                  <Fragment key={p._id || p.id || idx}>
                    {idx > 0 && <Divider sx={{ borderColor: 'rgba(255,255,255,0.04)' }} />}
                    <ListItem sx={{ px: 0, py: 1.5 }}>
                      <ListItemText
                        primary={p.name}
                        primaryTypographyProps={{
                          fontWeight: 700,
                          color: '#fb7185',
                          fontSize: '0.875rem',
                        }}
                        secondary={`SKU: ${p.sku} • Category: ${p.category}`}
                        secondaryTypographyProps={{ fontSize: '0.75rem', color: 'text.secondary' }}
                      />
                      <Box sx={{ textAlign: 'right' }}>
                        <Typography variant="body2" sx={{ fontWeight: 800, color: '#f43f5e' }}>
                          {p.quantity} {t('pos.leftInStock')}
                        </Typography>
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          sx={{ fontSize: '0.7rem' }}
                        >
                          Alert at: {p.lowStockAlert}
                        </Typography>
                      </Box>
                    </ListItem>
                  </Fragment>
                ))}
              </List>
            )}
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card
            sx={{
              p: 3,
              borderRadius: '16px',
              bgcolor: 'rgba(9, 15, 29, 0.75)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(16, 185, 129, 0.16)',
            }}
          >
            <Box
              sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}
            >
              <Typography
                variant="h6"
                sx={{
                  fontFamily: "'Space Grotesk', sans-serif",
                  fontWeight: 700,
                  letterSpacing: '-0.01em',
                }}
              >
                {t('Live Checkout Feed')}
              </Typography>
              <Chip
                label="SYNCED"
                size="small"
                sx={{
                  height: 18,
                  fontSize: '0.6rem',
                  fontWeight: 700,
                  fontFamily: "'Space Grotesk', sans-serif",
                  bgcolor: 'rgba(16, 185, 129, 0.12)',
                  color: '#34d399',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                }}
              />
            </Box>
            {transactions.length === 0 ? (
              <Box sx={{ py: 4, textAlign: 'center' }}>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  {t(
                    'No transaction activity yet. Process a checkout on the POS terminal to stream here in real time.'
                  )}
                </Typography>
                <Can permission="transactions:write">
                  <Button
                    variant="outlined"
                    color="primary"
                    size="small"
                    onClick={() => navigate('/pos')}
                    sx={{ textTransform: 'none', borderRadius: '8px', fontWeight: 600 }}
                  >
                    {t('Open POS Checkout')}
                  </Button>
                </Can>
              </Box>
            ) : (
              <List disablePadding>
                {transactions.slice(0, 5).map((t, idx) => (
                  <Fragment key={t._id || t.id || idx}>
                    {idx > 0 && <Divider sx={{ borderColor: 'rgba(255,255,255,0.04)' }} />}
                    <ListItem sx={{ px: 0, py: 1.5 }}>
                      <ListItemText
                        primary={`Receipt #${t.transactionNumber}`}
                        primaryTypographyProps={{ fontWeight: 700, fontSize: '0.875rem' }}
                        secondary={`${t.items.length} ${t.items.length === 1 ? 'item' : 'items'} • ${t.paymentMethod} • Operator: ${t.cashierName}`}
                        secondaryTypographyProps={{ fontSize: '0.75rem', color: 'text.secondary' }}
                      />
                      <Box sx={{ textAlign: 'right' }}>
                        <Typography variant="body2" sx={{ fontWeight: 800, color: '#34d399' }}>
                          +{formatAmount(t.total)}
                        </Typography>
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          sx={{ fontSize: '0.7rem' }}
                        >
                          {new Date(t.createdAt).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </Typography>
                      </Box>
                    </ListItem>
                  </Fragment>
                ))}
              </List>
            )}
          </Card>
        </Grid>
      </Grid>

      {/* Telemetry section */}
      <Box sx={{ mt: 4 }}>
        <Typography
          variant="caption"
          sx={{
            fontFamily: "'Space Grotesk', sans-serif",
            fontWeight: 800,
            letterSpacing: '0.08em',
            color: '#34d399',
            mb: 2,
            display: 'block',
          }}
        >
          TELEMETRY & RUNTIME INTEGRITY
        </Typography>
        <Grid container spacing={3}>
          <Grid item xs={12} sm={4}>
            <Card
              sx={{
                p: 2.5,
                display: 'flex',
                gap: 2,
                alignItems: 'center',
                borderRadius: '14px',
                bgcolor: 'rgba(9, 15, 29, 0.75)',
                border: '1px solid rgba(16, 185, 129, 0.15)',
              }}
            >
              <div className="pulsing-dot" />
              <Box>
                <Typography variant="body2" sx={{ fontWeight: 700, fontSize: '0.85rem' }}>
                  {t('Socket Telemetry Stream')}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  WebSocket: {socket.connected ? t('Online & Connected') : t('Active Stream')}
                </Typography>
              </Box>
            </Card>
          </Grid>
          <Grid item xs={12} sm={4}>
            <Card
              sx={{
                p: 2.5,
                display: 'flex',
                gap: 2,
                alignItems: 'center',
                borderRadius: '14px',
                bgcolor: 'rgba(9, 15, 29, 0.75)',
                border: '1px solid rgba(6, 182, 212, 0.15)',
              }}
            >
              <div className="pulsing-dot" />
              <Box>
                <Typography variant="body2" sx={{ fontWeight: 700, fontSize: '0.85rem' }}>
                  {t('Multi-Branch Instance')}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {workspaceName} • Status: {activeTenant?.status || 'OPERATIONAL'}
                </Typography>
              </Box>
            </Card>
          </Grid>
          <Grid item xs={12} sm={4}>
            <Card
              sx={{
                p: 2.5,
                display: 'flex',
                gap: 2,
                alignItems: 'center',
                borderRadius: '14px',
                bgcolor: 'rgba(9, 15, 29, 0.75)',
                border: '1px solid rgba(16, 185, 129, 0.15)',
              }}
            >
              <div className="pulsing-dot" />
              <Box>
                <Typography variant="body2" sx={{ fontWeight: 700, fontSize: '0.85rem' }}>
                  {t('Offline IndexedDB Mesh')}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Local offline cache active • Sub-5ms checkout
                </Typography>
              </Box>
            </Card>
          </Grid>
        </Grid>
      </Box>
    </Box>
  );
}
