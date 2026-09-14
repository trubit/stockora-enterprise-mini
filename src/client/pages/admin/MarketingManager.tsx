import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../api/client.ts';
import {
  Box,
  Typography,
  Tabs,
  Tab,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  Grid,
  Chip,
  IconButton,
  LinearProgress,
  Tooltip,
  Badge,
  Collapse,
  List,
  ListItem,
  ListItemText,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import StarIcon from '@mui/icons-material/Star';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import ToggleOnIcon from '@mui/icons-material/ToggleOn';
import ToggleOffIcon from '@mui/icons-material/ToggleOff';
import BlockIcon from '@mui/icons-material/Block';
import HistoryIcon from '@mui/icons-material/History';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import { toast } from 'react-hot-toast';
import { useRegionalSettings } from '../../hooks/useRegionalSettings.js';

// ---- Types ------------------------------------------------------------------

interface Promotion {
  _id: string;
  code: string;
  type: string;
  value: number;
  minPurchase: number;
  usageLimit?: number;
  usageCount: number;
  startDate?: string;
  expiresAt: string;
  isActive: boolean;
  description?: string;
  applicableCategories: string[];
  applicableBrands: string[];
}

interface GiftCardTx {
  transactionNumber: string;
  type: string;
  amount: number;
  balanceAfter: number;
  note?: string;
  createdAt: string;
}

interface GiftCard {
  _id: string;
  code: string;
  initialBalance: number;
  balance: number;
  expiresAt: string;
  isActive: boolean;
  purchasedByName?: string;
  transactions: GiftCardTx[];
}

interface LoyaltyHistoryEntry {
  date: string;
  points: number;
  reason: string;
  referenceId?: string;
}

interface Customer {
  _id: string;
  name: string;
  email: string;
  group: string;
  loyaltyPoints: number;
  loyaltyTier: 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM';
  loyaltyHistory?: LoyaltyHistoryEntry[];
}

// ---- Constants --------------------------------------------------------------

const TIER_COLORS: Record<
  string,
  'default' | 'success' | 'warning' | 'error' | 'info' | 'primary' | 'secondary'
> = {
  BRONZE: 'default',
  SILVER: 'info',
  GOLD: 'warning',
  PLATINUM: 'secondary',
};

const TIER_THRESHOLDS: Record<string, number> = {
  BRONZE: 0,
  SILVER: 500,
  GOLD: 2000,
  PLATINUM: 5000,
};

const NEXT_TIER: Record<string, string | null> = {
  BRONZE: 'SILVER',
  SILVER: 'GOLD',
  GOLD: 'PLATINUM',
  PLATINUM: null,
};

function getTierProgress(points: number, tier: string): number {
  const current = TIER_THRESHOLDS[tier] ?? 0;
  const next = TIER_THRESHOLDS[NEXT_TIER[tier] ?? ''] ?? null;
  if (next === null) return 100;
  return Math.min(100, Math.round(((points - current) / (next - current)) * 100));
}

const textFieldStyle = { mt: 1 };

// ---- Component --------------------------------------------------------------

export default function MarketingManager() {
  const { formatAmount, currencySymbol } = useRegionalSettings();
  const [activeTab, setActiveTab] = useState(0);

  // Promo dialog
  const [openPromoDialog, setOpenPromoDialog] = useState(false);
  const [promoCode, setPromoCode] = useState('');
  const [promoType, setPromoType] = useState('PERCENTAGE');
  const [promoVal, setPromoVal] = useState(10);
  const [promoMin, setPromoMin] = useState(0);
  const [promoLimit, setPromoLimit] = useState('');
  const [promoStartDate, setPromoStartDate] = useState('');
  const [promoExpires, setPromoExpires] = useState('');
  const [promoDescription, setPromoDescription] = useState('');
  const [promoCategories, setPromoCategories] = useState('');
  const [promoBrands, setPromoBrands] = useState('');

  // Gift card dialog
  const [openGiftCardDialog, setOpenGiftCardDialog] = useState(false);
  const [cardCode, setCardCode] = useState('');
  const [cardBalance, setCardBalance] = useState(50);
  const [cardExpires, setCardExpires] = useState('');
  const [cardPurchasedBy, setCardPurchasedBy] = useState('');

  // Gift card top-up dialog
  const [openTopUpDialog, setOpenTopUpDialog] = useState(false);
  const [topUpCard, setTopUpCard] = useState<GiftCard | null>(null);
  const [topUpAmount, setTopUpAmount] = useState(50);

  // Loyalty dialog
  const [openLoyaltyDialog, setOpenLoyaltyDialog] = useState(false);
  const [selectedCust, setSelectedCust] = useState<Customer | null>(null);
  const [loyaltyPts, setLoyaltyPts] = useState(100);
  const [loyaltyType, setLoyaltyType] = useState('ADD');
  const [loyaltyReason, setLoyaltyReason] = useState('');

  // History expansion
  const [expandedCustomer, setExpandedCustomer] = useState<string | null>(null);
  const [expandedGiftCard, setExpandedGiftCard] = useState<string | null>(null);

  const queryClient = useQueryClient();

  // --- Queries ---------------------------------------------------------------

  const { data: promotions = [] } = useQuery<Promotion[]>({
    queryKey: ['promotions'],
    queryFn: async () => (await apiClient.get('/marketing')).data,
  });

  const { data: giftCards = [] } = useQuery<GiftCard[]>({
    queryKey: ['gift-cards'],
    queryFn: async () => (await apiClient.get('/marketing/gift-cards')).data,
  });

  const { data: customers = [] } = useQuery<Customer[]>({
    queryKey: ['customers'],
    queryFn: async () => (await apiClient.get('/customers')).data,
  });

  const { data: leaderboard = [] } = useQuery<Customer[]>({
    queryKey: ['loyalty-leaderboard'],
    queryFn: async () => (await apiClient.get('/marketing/loyalty/leaderboard')).data,
  });

  // --- Mutations -------------------------------------------------------------

  const promoMutation = useMutation({
    mutationFn: async (payload: Record<string, unknown>) =>
      (await apiClient.post('/marketing', payload)).data,
    onSuccess: () => {
      toast.success('Promotion published!');
      queryClient.invalidateQueries({ queryKey: ['promotions'] });
      setOpenPromoDialog(false);
      resetPromoForm();
    },
    onError: (err: { response?: { data?: { error?: { message?: string } } } }) =>
      toast.error(err.response?.data?.error?.message || 'Failed to create promotion.'),
  });

  const togglePromoMutation = useMutation({
    mutationFn: async (id: string) => (await apiClient.patch(`/marketing/${id}/toggle`)).data,
    onSuccess: () => {
      toast.success('Promotion status toggled.');
      queryClient.invalidateQueries({ queryKey: ['promotions'] });
    },
  });

  const giftCardMutation = useMutation({
    mutationFn: async (payload: Record<string, unknown>) =>
      (await apiClient.post('/marketing/gift-cards', payload)).data,
    onSuccess: () => {
      toast.success('Gift card issued!');
      queryClient.invalidateQueries({ queryKey: ['gift-cards'] });
      setOpenGiftCardDialog(false);
      resetCardForm();
    },
    onError: (err: { response?: { data?: { error?: { message?: string } } } }) =>
      toast.error(err.response?.data?.error?.message || 'Failed to issue gift card.'),
  });

  const topUpMutation = useMutation({
    mutationFn: async (payload: { code: string; amount: number; transactionNumber: string }) =>
      (await apiClient.post('/marketing/gift-cards/topup', payload)).data,
    onSuccess: () => {
      toast.success('Gift card topped up!');
      queryClient.invalidateQueries({ queryKey: ['gift-cards'] });
      setOpenTopUpDialog(false);
    },
    onError: (err: { response?: { data?: { error?: { message?: string } } } }) =>
      toast.error(err.response?.data?.error?.message || 'Top-up failed.'),
  });

  const deactivateCardMutation = useMutation({
    mutationFn: async (code: string) =>
      (await apiClient.patch(`/marketing/gift-cards/${code}/deactivate`)).data,
    onSuccess: () => {
      toast.success('Gift card deactivated.');
      queryClient.invalidateQueries({ queryKey: ['gift-cards'] });
    },
  });

  const loyaltyMutation = useMutation({
    mutationFn: async (payload: Record<string, unknown>) =>
      (await apiClient.post('/marketing/loyalty', payload)).data,
    onSuccess: (data: { loyaltyPoints: number; loyaltyTier: string }) => {
      toast.success(
        `Points adjusted. New balance: ${data.loyaltyPoints} pts (${data.loyaltyTier})`
      );
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['loyalty-leaderboard'] });
      setOpenLoyaltyDialog(false);
    },
    onError: (err: { response?: { data?: { error?: { message?: string } } } }) =>
      toast.error(err.response?.data?.error?.message || 'Loyalty adjustment failed.'),
  });

  // --- Handlers --------------------------------------------------------------

  const resetPromoForm = () => {
    setPromoCode('');
    setPromoType('PERCENTAGE');
    setPromoVal(10);
    setPromoMin(0);
    setPromoLimit('');
    setPromoStartDate('');
    setPromoExpires('');
    setPromoDescription('');
    setPromoCategories('');
    setPromoBrands('');
  };

  const resetCardForm = () => {
    setCardCode('');
    setCardBalance(50);
    setCardExpires('');
    setCardPurchasedBy('');
  };

  const handleCreatePromo = () => {
    promoMutation.mutate({
      code: promoCode,
      type: promoType,
      value: promoVal,
      minPurchase: promoMin,
      usageLimit: promoLimit ? Number(promoLimit) : undefined,
      startDate: promoStartDate || undefined,
      expiresAt: promoExpires,
      description: promoDescription || undefined,
      applicableCategories: promoCategories ? promoCategories.split(',').map((s) => s.trim()) : [],
      applicableBrands: promoBrands ? promoBrands.split(',').map((s) => s.trim()) : [],
    });
  };

  const handleCreateGiftCard = () => {
    giftCardMutation.mutate({
      code: cardCode,
      balance: cardBalance,
      expiresAt: cardExpires,
      purchasedByName: cardPurchasedBy || undefined,
    });
  };

  const handleTopUp = () => {
    if (!topUpCard) return;
    topUpMutation.mutate({
      code: topUpCard.code,
      amount: topUpAmount,
      transactionNumber: `TU-${Date.now()}`,
    });
  };

  const handleAdjustLoyalty = () => {
    if (!selectedCust) return;
    loyaltyMutation.mutate({
      customerId: selectedCust._id,
      points: loyaltyPts,
      type: loyaltyType,
      reason: loyaltyReason || 'Manual adjustment',
    });
  };

  // ---- Render ---------------------------------------------------------------

  return (
    <Box sx={{ width: '100%' }}>
      {/* Header */}
      <Box
        sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}
      >
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800 }}>
            Marketing & Loyalty Hub
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Manage promotions, gift cards, BOGO campaigns, and customer loyalty tiers.
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setOpenPromoDialog(true)}
            sx={{ background: 'linear-gradient(90deg, #8b5cf6 0%, #7c3aed 100%)' }}
          >
            Create Promo
          </Button>
          <Button
            variant="outlined"
            startIcon={<AccountBalanceWalletIcon />}
            onClick={() => setOpenGiftCardDialog(true)}
          >
            Issue Gift Card
          </Button>
        </Box>
      </Box>

      <Tabs value={activeTab} onChange={(_, idx) => setActiveTab(idx)} sx={{ mb: 3 }}>
        <Tab label="Campaigns & Coupons" />
        <Tab label="Gift Cards Ledger" />
        <Tab label="Loyalty Members" />
        <Tab label="Leaderboard" />
      </Tabs>

      {/* ---- Tab 0: Promotions ---- */}
      {activeTab === 0 && (
        <TableContainer component={Paper} className="glass-panel">
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Promo Code</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Discount</TableCell>
                <TableCell>Min Purchase</TableCell>
                <TableCell>Usage</TableCell>
                <TableCell>Valid Period</TableCell>
                <TableCell>Scope</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Toggle</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {promotions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} align="center">
                    No promotions yet.
                  </TableCell>
                </TableRow>
              ) : (
                promotions.map((p) => (
                  <TableRow key={p._id}>
                    <TableCell>
                      <Typography fontWeight={700} variant="body2">
                        {p.code}
                      </Typography>
                      {p.description && (
                        <Typography variant="caption" color="text.secondary">
                          {p.description}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={p.type}
                        size="small"
                        color={
                          p.type === 'BOGO' ? 'secondary' : p.type === 'BUNDLE' ? 'info' : 'default'
                        }
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell sx={{ fontWeight: 700, color: 'success.light' }}>
                      {p.type === 'PERCENTAGE'
                        ? `${p.value}%`
                        : p.type === 'FIXED'
                          ? formatAmount(p.value)
                          : p.type === 'BOGO'
                            ? 'BOGO'
                            : `${p.value}%`}
                    </TableCell>
                    <TableCell>{formatAmount(p.minPurchase)}</TableCell>
                    <TableCell>
                      {p.usageCount} / {p.usageLimit || '∞'}
                    </TableCell>
                    <TableCell sx={{ fontSize: '0.72rem', color: 'text.secondary' }}>
                      {p.startDate ? new Date(p.startDate).toLocaleDateString() : 'Now'} →{' '}
                      {new Date(p.expiresAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell sx={{ fontSize: '0.72rem', color: 'text.secondary' }}>
                      {[...(p.applicableCategories || []), ...(p.applicableBrands || [])].join(
                        ', '
                      ) || 'All items'}
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={
                          new Date(p.expiresAt) < new Date()
                            ? 'Expired'
                            : p.isActive
                              ? 'Active'
                              : 'Paused'
                        }
                        color={
                          new Date(p.expiresAt) < new Date()
                            ? 'error'
                            : p.isActive
                              ? 'success'
                              : 'warning'
                        }
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      <Tooltip title={p.isActive ? 'Pause Promo' : 'Activate Promo'}>
                        <IconButton
                          size="small"
                          color={p.isActive ? 'success' : 'default'}
                          onClick={() => togglePromoMutation.mutate(p._id)}
                        >
                          {p.isActive ? <ToggleOnIcon /> : <ToggleOffIcon />}
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* ---- Tab 1: Gift Cards ---- */}
      {activeTab === 1 && (
        <TableContainer component={Paper} className="glass-panel">
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Gift Card Code</TableCell>
                <TableCell>Purchased By</TableCell>
                <TableCell>Initial</TableCell>
                <TableCell>Remaining</TableCell>
                <TableCell>Expiry</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Actions</TableCell>
                <TableCell>Transactions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {giftCards.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} align="center">
                    No gift cards issued.
                  </TableCell>
                </TableRow>
              ) : (
                giftCards.map((gc) => (
                  <React.Fragment key={gc._id}>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 700 }}>{gc.code}</TableCell>
                      <TableCell sx={{ color: 'text.secondary', fontSize: '0.8rem' }}>
                        {gc.purchasedByName || '—'}
                      </TableCell>
                      <TableCell>{formatAmount(gc.initialBalance)}</TableCell>
                      <TableCell
                        sx={{
                          color: gc.balance === 0 ? 'error.light' : 'success.light',
                          fontWeight: 600,
                        }}
                      >
                        {formatAmount(gc.balance)}
                        <LinearProgress
                          variant="determinate"
                          value={gc.initialBalance > 0 ? (gc.balance / gc.initialBalance) * 100 : 0}
                          sx={{ mt: 0.5, height: 3, borderRadius: 2 }}
                          color={gc.balance === 0 ? 'error' : 'success'}
                        />
                      </TableCell>
                      <TableCell sx={{ fontSize: '0.8rem' }}>
                        {new Date(gc.expiresAt) < new Date() ? (
                          <Chip label="Expired" color="error" size="small" />
                        ) : (
                          new Date(gc.expiresAt).toLocaleDateString()
                        )}
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={gc.isActive ? 'Active' : 'Inactive'}
                          color={gc.isActive ? 'success' : 'default'}
                          size="small"
                        />
                      </TableCell>
                      <TableCell sx={{ display: 'flex', gap: 0.5 }}>
                        <Tooltip title="Top Up">
                          <span>
                            <IconButton
                              size="small"
                              color="primary"
                              disabled={!gc.isActive}
                              onClick={() => {
                                setTopUpCard(gc);
                                setOpenTopUpDialog(true);
                              }}
                            >
                              <AccountBalanceWalletIcon fontSize="small" />
                            </IconButton>
                          </span>
                        </Tooltip>
                        <Tooltip title="Deactivate">
                          <span>
                            <IconButton
                              size="small"
                              color="error"
                              disabled={!gc.isActive}
                              onClick={() => deactivateCardMutation.mutate(gc.code)}
                            >
                              <BlockIcon fontSize="small" />
                            </IconButton>
                          </span>
                        </Tooltip>
                      </TableCell>
                      <TableCell>
                        <IconButton
                          size="small"
                          onClick={() =>
                            setExpandedGiftCard(expandedGiftCard === gc._id ? null : gc._id)
                          }
                        >
                          <Badge badgeContent={gc.transactions.length} color="primary">
                            <HistoryIcon fontSize="small" />
                          </Badge>
                        </IconButton>
                      </TableCell>
                    </TableRow>
                    {expandedGiftCard === gc._id && (
                      <TableRow key={`${gc._id}-hist`}>
                        <TableCell colSpan={8} sx={{ p: 0, background: 'rgba(0,0,0,0.2)' }}>
                          <Collapse in>
                            <List dense sx={{ px: 3 }}>
                              {gc.transactions.map((tx, i) => (
                                <ListItem key={i} sx={{ py: 0.25 }}>
                                  <ListItemText
                                    primary={`${tx.type} — ${tx.amount > 0 ? '+' : ''}${formatAmount(tx.amount)} (Balance: ${formatAmount(tx.balanceAfter)})`}
                                    secondary={`${tx.transactionNumber} · ${new Date(tx.createdAt).toLocaleString()}${tx.note ? ' · ' + tx.note : ''}`}
                                    primaryTypographyProps={{
                                      variant: 'body2',
                                      color: tx.amount < 0 ? 'error.light' : 'success.light',
                                    }}
                                    secondaryTypographyProps={{ variant: 'caption' }}
                                  />
                                </ListItem>
                              ))}
                            </List>
                          </Collapse>
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* ---- Tab 2: Loyalty Members ---- */}
      {activeTab === 2 && (
        <TableContainer component={Paper} className="glass-panel">
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Customer</TableCell>
                <TableCell>Group</TableCell>
                <TableCell>Tier</TableCell>
                <TableCell>Points</TableCell>
                <TableCell>Tier Progress</TableCell>
                <TableCell>History</TableCell>
                <TableCell>Adjust</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {customers.map((c) => (
                <React.Fragment key={c._id}>
                  <TableRow>
                    <TableCell>
                      <Typography fontWeight={700} variant="body2">
                        {c.name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {c.email}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip label={c.group} size="small" variant="outlined" />
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={c.loyaltyTier || 'BRONZE'}
                        color={TIER_COLORS[c.loyaltyTier || 'BRONZE']}
                        size="small"
                        icon={<EmojiEventsIcon />}
                      />
                    </TableCell>
                    <TableCell sx={{ fontWeight: 800, color: 'secondary.light' }}>
                      {(c.loyaltyPoints || 0).toLocaleString()} pts
                    </TableCell>
                    <TableCell sx={{ minWidth: 140 }}>
                      {NEXT_TIER[c.loyaltyTier] ? (
                        <>
                          <LinearProgress
                            variant="determinate"
                            value={getTierProgress(c.loyaltyPoints, c.loyaltyTier)}
                            sx={{ height: 6, borderRadius: 3, mb: 0.25 }}
                            color="secondary"
                          />
                          <Typography variant="caption" color="text.secondary">
                            {Math.max(
                              0,
                              (TIER_THRESHOLDS[NEXT_TIER[c.loyaltyTier]!] ?? 0) - c.loyaltyPoints
                            )}{' '}
                            pts to {NEXT_TIER[c.loyaltyTier]}
                          </Typography>
                        </>
                      ) : (
                        <Typography variant="caption" color="secondary.light">
                          ✦ Max Tier
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <IconButton
                        size="small"
                        onClick={() =>
                          setExpandedCustomer(expandedCustomer === c._id ? null : c._id)
                        }
                      >
                        {expandedCustomer === c._id ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                      </IconButton>
                    </TableCell>
                    <TableCell>
                      <IconButton
                        color="primary"
                        size="small"
                        onClick={() => {
                          setSelectedCust(c);
                          setOpenLoyaltyDialog(true);
                        }}
                      >
                        <StarIcon />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                  {expandedCustomer === c._id && (
                    <TableRow key={`${c._id}-hist`}>
                      <TableCell colSpan={7} sx={{ p: 0, background: 'rgba(0,0,0,0.18)' }}>
                        <Collapse in>
                          <List dense sx={{ px: 3, maxHeight: 200, overflow: 'auto' }}>
                            {(c.loyaltyHistory || []).length === 0 ? (
                              <ListItem>
                                <ListItemText secondary="No loyalty history yet." />
                              </ListItem>
                            ) : (
                              [...(c.loyaltyHistory || [])].reverse().map((h, i) => (
                                <ListItem key={i} sx={{ py: 0.2 }}>
                                  <ListItemText
                                    primary={`${h.points > 0 ? '+' : ''}${h.points} pts — ${h.reason}`}
                                    secondary={new Date(h.date).toLocaleString()}
                                    primaryTypographyProps={{
                                      variant: 'body2',
                                      color: h.points > 0 ? 'success.light' : 'error.light',
                                    }}
                                    secondaryTypographyProps={{ variant: 'caption' }}
                                  />
                                </ListItem>
                              ))
                            )}
                          </List>
                        </Collapse>
                      </TableCell>
                    </TableRow>
                  )}
                </React.Fragment>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* ---- Tab 3: Leaderboard ---- */}
      {activeTab === 3 && (
        <TableContainer component={Paper} className="glass-panel">
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Rank</TableCell>
                <TableCell>Customer</TableCell>
                <TableCell>Group</TableCell>
                <TableCell>Tier</TableCell>
                <TableCell>Points</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {leaderboard.map((c, idx) => (
                <TableRow
                  key={c._id}
                  sx={{
                    background:
                      idx === 0
                        ? 'rgba(255,200,0,0.07)'
                        : idx === 1
                          ? 'rgba(180,180,180,0.06)'
                          : idx === 2
                            ? 'rgba(180,100,50,0.05)'
                            : 'inherit',
                  }}
                >
                  <TableCell
                    sx={{
                      fontWeight: 800,
                      fontSize: '1rem',
                      color:
                        idx === 0
                          ? 'warning.light'
                          : idx === 1
                            ? 'info.light'
                            : idx === 2
                              ? 'error.light'
                              : 'text.primary',
                    }}
                  >
                    {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`}
                  </TableCell>
                  <TableCell>
                    <Typography fontWeight={700} variant="body2">
                      {c.name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {c.email}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip label={c.group} size="small" variant="outlined" />
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={c.loyaltyTier || 'BRONZE'}
                      color={TIER_COLORS[c.loyaltyTier || 'BRONZE']}
                      size="small"
                      icon={<EmojiEventsIcon />}
                    />
                  </TableCell>
                  <TableCell sx={{ fontWeight: 800, color: 'secondary.light', fontSize: '1rem' }}>
                    {(c.loyaltyPoints || 0).toLocaleString()} pts
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* ===== DIALOGS ===== */}

      {/* Create Promotion */}
      <Dialog
        open={openPromoDialog}
        onClose={() => setOpenPromoDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Create Discount Promotion</DialogTitle>
        <DialogContent>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Promo Code"
                fullWidth
                value={promoCode}
                onChange={(e) => setPromoCode(e.target.value)}
                sx={textFieldStyle}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                select
                label="Promo Type"
                fullWidth
                value={promoType}
                onChange={(e) => setPromoType(e.target.value)}
                sx={textFieldStyle}
              >
                <MenuItem value="PERCENTAGE">Percentage Discount (%)</MenuItem>
                <MenuItem value="FIXED">Fixed Amount Discount ({currencySymbol})</MenuItem>
                <MenuItem value="BOGO">Buy One Get One (BOGO)</MenuItem>
                <MenuItem value="BUNDLE">Bundle Discount</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                type="number"
                label="Discount Value"
                fullWidth
                value={promoVal}
                onChange={(e) => setPromoVal(Number(e.target.value))}
                sx={textFieldStyle}
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                type="number"
                label={`Min Purchase (${currencySymbol})`}
                fullWidth
                value={promoMin}
                onChange={(e) => setPromoMin(Number(e.target.value))}
                sx={textFieldStyle}
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                type="number"
                label="Usage Limit"
                fullWidth
                value={promoLimit}
                onChange={(e) => setPromoLimit(e.target.value)}
                sx={textFieldStyle}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                type="date"
                label="Start Date"
                fullWidth
                InputLabelProps={{ shrink: true }}
                value={promoStartDate}
                onChange={(e) => setPromoStartDate(e.target.value)}
                sx={textFieldStyle}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                type="date"
                label="Expiration Date"
                fullWidth
                InputLabelProps={{ shrink: true }}
                value={promoExpires}
                onChange={(e) => setPromoExpires(e.target.value)}
                sx={textFieldStyle}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                label="Description (optional)"
                fullWidth
                value={promoDescription}
                onChange={(e) => setPromoDescription(e.target.value)}
                sx={textFieldStyle}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Applicable Categories (comma-separated)"
                fullWidth
                value={promoCategories}
                onChange={(e) => setPromoCategories(e.target.value)}
                sx={textFieldStyle}
                helperText="e.g. Electronics, Clothing"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Applicable Brands (comma-separated)"
                fullWidth
                value={promoBrands}
                onChange={(e) => setPromoBrands(e.target.value)}
                sx={textFieldStyle}
                helperText="e.g. Samsung, Nike"
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenPromoDialog(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleCreatePromo}
            disabled={promoMutation.isPending}
          >
            {promoMutation.isPending ? 'Publishing…' : 'Publish'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Issue Gift Card */}
      <Dialog
        open={openGiftCardDialog}
        onClose={() => setOpenGiftCardDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Issue Gift Card</DialogTitle>
        <DialogContent>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <TextField
                label="Gift Card Code"
                fullWidth
                value={cardCode}
                onChange={(e) => setCardCode(e.target.value)}
                sx={textFieldStyle}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                type="number"
                label={`Initial Balance (${currencySymbol})`}
                fullWidth
                value={cardBalance}
                onChange={(e) => setCardBalance(Number(e.target.value))}
                sx={textFieldStyle}
                inputProps={{ min: 1 }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                type="date"
                label="Expiration Date"
                fullWidth
                InputLabelProps={{ shrink: true }}
                value={cardExpires}
                onChange={(e) => setCardExpires(e.target.value)}
                sx={textFieldStyle}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                label="Purchased By (optional)"
                fullWidth
                value={cardPurchasedBy}
                onChange={(e) => setCardPurchasedBy(e.target.value)}
                sx={textFieldStyle}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenGiftCardDialog(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleCreateGiftCard}
            disabled={giftCardMutation.isPending}
          >
            {giftCardMutation.isPending ? 'Issuing…' : 'Issue Card'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Gift Card Top-Up */}
      <Dialog
        open={openTopUpDialog}
        onClose={() => setOpenTopUpDialog(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Top Up Gift Card — {topUpCard?.code}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Current balance: <strong>{topUpCard ? formatAmount(topUpCard.balance) : ''}</strong>
          </Typography>
          <TextField
            type="number"
            label={`Top-Up Amount (${currencySymbol})`}
            fullWidth
            value={topUpAmount}
            onChange={(e) => setTopUpAmount(Number(e.target.value))}
            inputProps={{ min: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenTopUpDialog(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleTopUp} disabled={topUpMutation.isPending}>
            {topUpMutation.isPending ? 'Processing…' : 'Top Up'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Adjust Loyalty */}
      <Dialog
        open={openLoyaltyDialog}
        onClose={() => setOpenLoyaltyDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Adjust Loyalty Points — {selectedCust?.name}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Current: <strong>{selectedCust?.loyaltyPoints?.toLocaleString()} pts</strong>{' '}
            <Chip
              label={selectedCust?.loyaltyTier || 'BRONZE'}
              color={TIER_COLORS[selectedCust?.loyaltyTier || 'BRONZE']}
              size="small"
              sx={{ ml: 1 }}
            />
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <TextField
                select
                label="Action"
                fullWidth
                value={loyaltyType}
                onChange={(e) => setLoyaltyType(e.target.value)}
                sx={textFieldStyle}
              >
                <MenuItem value="ADD">Award Points</MenuItem>
                <MenuItem value="DEDUCT">Redeem / Deduct Points</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                type="number"
                label="Points"
                fullWidth
                value={loyaltyPts}
                onChange={(e) => setLoyaltyPts(Number(e.target.value))}
                sx={textFieldStyle}
                inputProps={{ min: 1 }}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                label="Reason"
                fullWidth
                value={loyaltyReason}
                onChange={(e) => setLoyaltyReason(e.target.value)}
                sx={textFieldStyle}
                placeholder="e.g. Birthday bonus, Manual correction"
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenLoyaltyDialog(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleAdjustLoyalty}
            disabled={loyaltyMutation.isPending}
          >
            {loyaltyMutation.isPending ? 'Saving…' : 'Update Points'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
