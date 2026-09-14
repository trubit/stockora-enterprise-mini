import { useState, useRef, useEffect, useCallback } from 'react';
import type { ChangeEvent, FormEvent, SyntheticEvent } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api/client.ts';
import {
  Grid,
  Card,
  Typography,
  Box,
  TextField,
  Button,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Divider,
  Chip,
  Tabs,
  Tab,
  MenuItem,
  InputAdornment,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Paper,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
import DeleteIcon from '@mui/icons-material/Delete';
import DeleteSweepIcon from '@mui/icons-material/DeleteSweep';
import SearchIcon from '@mui/icons-material/Search';
import ScanIcon from '@mui/icons-material/QrCodeScanner';
import CheckoutIcon from '@mui/icons-material/ShoppingCartCheckout';
import PaymentsIcon from '@mui/icons-material/Payments';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import CreditCardIcon from '@mui/icons-material/CreditCard';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import type { Product, TransactionItem, Transaction, Branch, Receipt } from '../../shared/types.js';
import { useAuthStore } from '../store/auth.ts';
import { toast } from 'react-hot-toast';
import ReceiptModal, { type ReceiptData } from '../components/ReceiptModal';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import PrintIcon from '@mui/icons-material/Print';
import PageHeader from '../components/PageHeader.tsx';
import { useRegionalSettings } from '../hooks/useRegionalSettings.js';
import { useTranslation } from '../hooks/useTranslation.js';
import { CurrencySelector } from '../components/CurrencySelector.tsx';
import { useTenantStore } from '../store/tenant.ts';
import {
  queueOfflineTransaction,
  getPendingQueueCount,
  runSync,
  on as onSyncEvent,
} from '../offline/syncEngine.ts';

interface CartItem extends TransactionItem {
  priceTier: 'RETAIL' | 'WHOLESALE';
  retailPrice: number;
  wholesalePrice: number;
  currency?: string;
}
type PosManualTender = 'CASH' | 'BANK_TRANSFER' | 'CARD';

function generateOfflineId(): string {
  return `off-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
}

function generateOfflineTransactionNumber(): string {
  return `TX-OFF-${Date.now().toString().slice(-6)}`;
}

const fetchProducts = async (): Promise<Product[]> => {
  const { data } = await apiClient.get<Product[]>('/products');
  return data;
};

export default function POS() {
  const queryClient = useQueryClient();
  const { activeTenant } = useTenantStore();
  const { data: products = [] } = useQuery({
    queryKey: ['products'],
    queryFn: fetchProducts,
  });

  const [activePricingTier, setActivePricingTier] = useState<'RETAIL' | 'WHOLESALE'>('RETAIL');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [barcodeInput, setBarcodeInput] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [discount, setDiscount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<PosManualTender>('CASH');
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [offlineCount, setOfflineCount] = useState(0);

  // Manual Tender POS Checkout Modal States
  const [checkoutModalOpen, setCheckoutModalOpen] = useState(false);
  const [cashTendered, setCashTendered] = useState<number>(0);
  const [manualReference, setManualReference] = useState<string>('');

  // Receipt Modal and Recent Transactions states
  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null);
  const [receiptModalOpen, setReceiptModalOpen] = useState(false);
  const [recentSalesOpen, setRecentSalesOpen] = useState(false);

  const { user, accessToken } = useAuthStore();
  const { t } = useTranslation();
  const { baseCurrency, activeCurrency, currencySymbol, formatAmount, convertAmount } =
    useRegionalSettings();

  const { data: branches = [] } = useQuery({
    queryKey: ['branches'],
    queryFn: async () => {
      try {
        const { data } = await apiClient.get('/org/branches');
        return data;
      } catch {
        return [];
      }
    },
  });

  const activeBranchName =
    branches.find((b: Branch) => b.id === user?.branchId || b._id === user?.branchId)?.name ||
    'Main Store';
  const activeCashierName = user?.name || user?.email || 'Active Cashier';

  const { data: receipts = [] } = useQuery<Receipt[]>({
    queryKey: ['recent-receipts'],
    queryFn: async () => {
      const { data } = await apiClient.get<Receipt[]>('/receipts?limit=15');
      return data;
    },
  });

  const triggerPrintReceipt = (
    tx: {
      transactionNumber?: string;
      createdAt?: string;
      cashierName?: string;
      branchName?: string;
      customerEmail?: string;
      subtotal?: number;
      tax?: number;
      discount?: number;
      total?: number;
      items?: Array<TransactionItem | Record<string, unknown>>;
      paymentMethod?: string;
      companyName?: string;
      companyLegalName?: string;
      companyLogoUrl?: string;
      companyAddress?: string;
      companyPhone?: string;
      companyEmail?: string;
      companyTaxId?: string;
      currency?: string;
      receiptHeader?: string;
      receiptFooter?: string;
    },
    customEmail?: string
  ) => {
    const rawItems = tx.items || [];
    const items = rawItems.map((i) => {
      const itemObj = i as unknown as Record<string, unknown>;
      const productName = String(itemObj.productName || 'Item');
      const sku = String(itemObj.sku || 'N/A');
      const quantity = Number(itemObj.quantity || 1);
      const price = Number(itemObj.price ?? itemObj.unitPrice ?? 0);
      const total = Number(itemObj.total ?? itemObj.lineTotal ?? quantity * price);
      const priceTier = (itemObj.priceTier as 'RETAIL' | 'WHOLESALE') || undefined;
      return { productName, sku, quantity, price, total, priceTier };
    });

    const txAny = tx as any;
    const data: ReceiptData = {
      transactionNumber: tx.transactionNumber || generateOfflineTransactionNumber(),
      createdAt: tx.createdAt || new Date().toISOString(),
      cashierName: tx.cashierName || activeCashierName,
      branchName: tx.branchName || activeBranchName,
      customerEmail: customEmail || user?.email || 'customer@stockora.com',
      items,
      subtotal: tx.subtotal ?? items.reduce((acc, curr) => acc + curr.total, 0),
      tax: tx.tax ?? 0,
      discount: tx.discount ?? 0,
      total: tx.total ?? items.reduce((acc, curr) => acc + curr.total, 0),
      paymentMethod: String(tx.paymentMethod || paymentMethod),
      pricingMode: txAny.pricingMode || activePricingTier,
      currency: txAny.currency || activeCurrency || baseCurrency,
      companyName:
        txAny.companyName ||
        activeTenant?.name ||
        (user as any)?.tenantName ||
        (user as any)?.companyName,
      companyLegalName: txAny.companyLegalName || activeTenant?.legalName,
      companyLogoUrl:
        txAny.companyLogoUrl || activeTenant?.branding?.logoUrl || activeTenant?.logoUrl,
      companyAddress: (() => {
        const raw =
          txAny.companyAddress ||
          (activeTenant?.contact
            ? [
                activeTenant.contact.addressLine1,
                activeTenant.contact.city,
                activeTenant.contact.state,
                activeTenant.contact.country &&
                activeTenant.contact.country.trim().toUpperCase() !== 'US' &&
                activeTenant.contact.country.trim().toUpperCase() !== 'USA'
                  ? activeTenant.contact.country.trim()
                  : undefined,
              ]
                .filter(Boolean)
                .join(', ')
            : undefined);
        if (!raw) return undefined;
        const upper = raw.trim().toUpperCase().replace(/[\.,]/g, '');
        if (upper === 'US' || upper === 'USA' || upper === 'UNITED STATES') return undefined;
        const cleaned = raw
          .trim()
          .replace(/,\s*(US|USA|United States)$/i, '')
          .trim();
        return cleaned.toUpperCase() === 'US' || cleaned.toUpperCase() === 'USA'
          ? undefined
          : cleaned || undefined;
      })(),
      companyPhone: txAny.companyPhone || activeTenant?.contact?.phone,
      companyEmail: txAny.companyEmail || activeTenant?.contact?.email,
      companyTaxId: undefined,
      receiptHeader: txAny.receiptHeader || activeTenant?.branding?.receiptHeader,
      receiptFooter: txAny.receiptFooter || activeTenant?.branding?.receiptFooter,
    };

    setReceiptData(data);
    setReceiptModalOpen(true);
  };

  const barcodeInputRef = useRef<HTMLInputElement>(null);

  const syncOfflineTransactions = useCallback(async () => {
    if (!accessToken) return;
    const count = await getPendingQueueCount();
    if (count === 0) return;
    toast.loading(`Syncing ${count} offline transactions...`, { id: 'offline-sync' });
    try {
      const res = await runSync(accessToken);
      toast.dismiss('offline-sync');
      if (res.synced > 0) {
        toast.success(`Synced ${res.synced} transactions successfully!`);
        queryClient.invalidateQueries({ queryKey: ['products'] });
      }
    } catch (err) {
      toast.dismiss('offline-sync');
      console.error('Offline sync failed:', err);
    }
  }, [accessToken, queryClient]);

  useEffect(() => {
    getPendingQueueCount().then(setOfflineCount);

    const handleOnline = () => {
      setIsOnline(true);
      syncOfflineTransactions();
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const unsubComplete = onSyncEvent('sync:complete', (payload) => {
      if (payload.pendingCount !== undefined) {
        setOfflineCount(payload.pendingCount);
      } else {
        getPendingQueueCount().then(setOfflineCount);
      }
    });

    const unsubPending = onSyncEvent('pending:change', (payload) => {
      if (payload.pendingCount !== undefined) {
        setOfflineCount(payload.pendingCount);
      } else {
        getPendingQueueCount().then(setOfflineCount);
      }
    });

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      unsubComplete();
      unsubPending();
    };
  }, [syncOfflineTransactions]);

  // Clear only transient active-sale state without modifying auth/session/user state
  const clearCompletedSaleState = useCallback(() => {
    setCart([]);
    setDiscount(0);
    setManualReference('');
    setCashTendered(0);
    setBarcodeInput('');
    setCheckoutModalOpen(false);
  }, []);

  // Mutation to handle transaction checkout
  const checkoutMutation = useMutation({
    mutationFn: async (transactionData: unknown) => {
      const { data } = await apiClient.post<Transaction>('/transactions', transactionData);
      return data;
    },
    onSuccess: (data: Transaction) => {
      toast.success('Sale Completed & Recorded Successfully!');
      triggerPrintReceipt({
        ...data,
        items: cart,
        subtotal,
        tax,
        discount,
        total,
        paymentMethod,
      });
      clearCompletedSaleState();
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['recent-receipts'] });
    },
    onError: (err: any) => {
      const msg =
        err.response?.data?.error?.message ||
        err.response?.data?.message ||
        err.message ||
        'Checkout failed';
      toast.error(msg);
    },
  });

  // Unique categories list
  const categories = ['All', ...Array.from(new Set(products.map((p: Product) => p.category)))];

  // Filter products by search and category
  const filteredProducts = products.filter((p: Product) => {
    const matchesSearch =
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.barcode && p.barcode.includes(searchTerm));
    const matchesCategory = selectedCategory === 'All' || p.category === selectedCategory;
    return matchesSearch && matchesCategory && p.isActive;
  });

  // Switch global pricing tier between Wholesale and Retail
  const handleSwitchGlobalTier = (tier: 'RETAIL' | 'WHOLESALE') => {
    setActivePricingTier(tier);
    setCart((prevCart) =>
      prevCart.map((item) => {
        const newUnitPrice = tier === 'WHOLESALE' ? item.wholesalePrice : item.retailPrice;
        return {
          ...item,
          priceTier: tier,
          price: newUnitPrice,
          total: (newUnitPrice - (item.discount || 0)) * item.quantity,
        };
      })
    );
  };

  // Toggle individual cart item between Wholesale and Retail
  const toggleItemTier = (productId: string, currentTier: 'RETAIL' | 'WHOLESALE') => {
    const nextTier: 'RETAIL' | 'WHOLESALE' = currentTier === 'WHOLESALE' ? 'RETAIL' : 'WHOLESALE';
    setCart((prevCart) =>
      prevCart.map((item) => {
        if (item.productId === productId && item.priceTier === currentTier) {
          const newUnitPrice = nextTier === 'WHOLESALE' ? item.wholesalePrice : item.retailPrice;
          return {
            ...item,
            priceTier: nextTier,
            price: newUnitPrice,
            total: (newUnitPrice - (item.discount || 0)) * item.quantity,
          };
        }
        return item;
      })
    );
  };

  // Handle adding product to cart
  const addToCart = (product: Product) => {
    if (product.quantity <= 0) {
      toast.error(`${product.name} is out of stock!`);
      return;
    }

    const retailPrice = Number(product.retailPrice ?? product.price ?? product.sellingPrice ?? 0);
    const wholesalePrice =
      product.wholesalePrice != null ? Number(product.wholesalePrice) : retailPrice;
    const unitPrice = activePricingTier === 'WHOLESALE' ? wholesalePrice : retailPrice;

    setCart((prevCart) => {
      const existing = prevCart.find(
        (item) =>
          item.productId === (product.id || product._id) && item.priceTier === activePricingTier
      );
      if (existing) {
        if (existing.quantity >= (product.quantity || 0)) {
          toast.error(`Cannot add more. Only ${product.quantity} units available.`);
          return prevCart;
        }
        return prevCart.map((item) =>
          item.productId === (product.id || product._id) && item.priceTier === activePricingTier
            ? { ...item, quantity: item.quantity + 1, total: (item.quantity + 1) * item.price }
            : item
        );
      }
      const newItem: CartItem = {
        productId: product.id || product._id || '',
        productName: product.name,
        sku: product.sku,
        quantity: 1,
        price: unitPrice,
        discount: 0,
        total: unitPrice,
        priceTier: activePricingTier,
        retailPrice,
        wholesalePrice,
        currency: product.currency || baseCurrency,
      };
      return [...prevCart, newItem];
    });
  };

  // Adjust item quantity in cart
  const adjustQuantity = (productId: string, priceTier: 'RETAIL' | 'WHOLESALE', amount: number) => {
    const product = products.find((p) => (p.id || p._id) === productId);
    if (!product) return;

    setCart((prevCart) =>
      prevCart
        .map((item) => {
          if (item.productId !== productId || item.priceTier !== priceTier) return item;
          const newQty = item.quantity + amount;
          if (newQty > product.quantity) {
            toast.error(`Only ${product.quantity} units in inventory.`);
            return item;
          }
          return {
            ...item,
            quantity: newQty,
            total: newQty * item.price,
          };
        })
        .filter((item) => item.quantity > 0)
    );
  };

  // Remove item from cart
  const removeItem = (productId: string, priceTier: 'RETAIL' | 'WHOLESALE') => {
    setCart((prevCart) =>
      prevCart.filter((item) => !(item.productId === productId && item.priceTier === priceTier))
    );
  };

  // Barcode simulation handler
  const handleBarcodeSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!barcodeInput.trim()) return;

    const matchedProduct = products.find(
      (p: Product) => p.barcode === barcodeInput || p.sku === barcodeInput
    );

    if (matchedProduct) {
      addToCart(matchedProduct);
      toast.success(`Scanned: ${matchedProduct.name}`);
      setBarcodeInput('');
    } else {
      toast.error(`No item matching barcode "${barcodeInput}"`);
    }
  };

  // Computations
  const cartCurrency = cart.length > 0 ? cart[0].currency || baseCurrency : baseCurrency;
  const subtotal = cart.reduce((sum, item) => sum + item.total, 0);
  const totalWholesaleSavings = cart.reduce((acc, i) => {
    if (i.priceTier === 'WHOLESALE' && i.retailPrice > i.wholesalePrice) {
      return acc + (i.retailPrice - i.wholesalePrice) * i.quantity;
    }
    return acc;
  }, 0);
  const tax = 0;
  const total = Math.max(0, subtotal - discount);

  // Open Checkout Modal and initialize tender amount in active display currency
  const handleOpenCheckoutModal = () => {
    if (cart.length === 0) {
      toast.error('Cart is empty.');
      return;
    }
    const displayTotal = convertAmount(total, cartCurrency, activeCurrency);
    setCashTendered(Number(displayTotal.toFixed(2)));
    setManualReference('');
    setCheckoutModalOpen(true);
  };

  // Execute Cashier-Confirmed Payment
  const handleConfirmManualPayment = () => {
    if (cart.length === 0) {
      toast.error('Cart is empty.');
      return;
    }

    const displayTotal = convertAmount(total, cartCurrency, activeCurrency);
    if (paymentMethod === 'CASH' && cashTendered < displayTotal) {
      toast.error(
        `Cash tendered cannot be less than total (${formatAmount(total, { fromCurrency: cartCurrency, currency: activeCurrency })}).`
      );
      return;
    }

    const amountTenderedInCart =
      paymentMethod === 'CASH' ? convertAmount(cashTendered, activeCurrency, cartCurrency) : total;

    const payload = {
      items: cart.map((item) => ({
        productId: item.productId,
        productName: item.productName,
        sku: item.sku,
        quantity: item.quantity,
        price: item.price,
        discount: item.discount || 0,
        total: item.total,
        priceTier: item.priceTier,
        currency: item.currency || cartCurrency,
      })),
      pricingMode: activePricingTier,
      paymentMethod,
      amountTendered: amountTenderedInCart,
      referenceNumber: manualReference.trim() || undefined,
      discount,
      tax,
      subtotal,
      total,
      currency: cartCurrency,
      cashierName: activeCashierName,
      branchName: activeBranchName,
    };

    if (!navigator.onLine) {
      const txNum = generateOfflineTransactionNumber();
      queueOfflineTransaction({
        id: generateOfflineId(),
        transactionNumber: txNum,
        items: cart.map((item) => ({
          productId: item.productId,
          productName: item.productName,
          sku: item.sku,
          quantity: item.quantity,
          unitPrice: item.price,
          lineTotal: item.total,
        })),
        subtotal,
        tax,
        discount,
        total,
        paymentMethod,
        cashierName: activeCashierName,
        branchName: activeBranchName,
        capturedAt: new Date().toISOString(),
      }).then(async () => {
        const count = await getPendingQueueCount();
        setOfflineCount(count);
        triggerPrintReceipt({
          transactionNumber: txNum,
          items: cart,
          subtotal,
          tax,
          discount,
          total,
          currency: cartCurrency,
          paymentMethod: `${paymentMethod} (OFFLINE)`,
        });
        clearCompletedSaleState();
        toast.success('Offline sale recorded locally. Will sync automatically.');
      });
      return;
    }

    checkoutMutation.mutate(payload);
  };

  const displayTotal = convertAmount(total, cartCurrency, activeCurrency);
  const changeDue = Math.max(0, cashTendered - displayTotal);

  return (
    <Box sx={{ flexGrow: 1 }}>
      <PageHeader
        title={t('pos.terminal')}
        subtitle={t('pos.subtitle')}
        category="Operations"
        badgeText={
          isOnline
            ? t('pos.onlineSync')
            : offlineCount > 0
              ? `${t('pos.offlineMode')} (${offlineCount})`
              : t('pos.offlineMode')
        }
        badgeColor={isOnline ? 'secondary' : 'warning'}
        action={
          <Box
            sx={{
              display: 'flex',
              gap: 1.5,
              width: { xs: '100%', sm: 'auto' },
              alignItems: 'center',
              flexWrap: 'wrap',
            }}
          >
            <CurrencySelector size="small" />

            <Button
              variant="outlined"
              color="inherit"
              size="small"
              onClick={() => setRecentSalesOpen(true)}
              startIcon={<ReceiptLongIcon color="secondary" />}
              sx={{
                fontWeight: 700,
                borderRadius: '8px',
                borderColor: 'rgba(255,255,255,0.2)',
                whiteSpace: 'nowrap',
              }}
            >
              {t('pos.recentReceipts')}
            </Button>

            <Box
              component="form"
              onSubmit={handleBarcodeSubmit}
              sx={{ display: 'flex', gap: 1, flexGrow: 1 }}
            >
              <TextField
                inputRef={barcodeInputRef}
                size="small"
                placeholder={t('pos.scanBarcode')}
                value={barcodeInput}
                onChange={(e) => setBarcodeInput(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <ScanIcon fontSize="small" sx={{ color: 'text.secondary' }} />
                    </InputAdornment>
                  ),
                }}
                sx={{ width: { xs: '100%', sm: 220 } }}
              />
            </Box>
          </Box>
        }
      />

      <Grid container spacing={3}>
        {/* Left Column: Product Catalog & Fast Search */}
        <Grid item xs={12} md={7} lg={8}>
          {/* Global Pricing Mode Selector */}
          <Paper
            sx={{
              p: 1.5,
              mb: 2,
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 1.5,
              background:
                activePricingTier === 'WHOLESALE'
                  ? 'linear-gradient(135deg, rgba(147, 51, 234, 0.12) 0%, rgba(79, 70, 229, 0.08) 100%)'
                  : 'linear-gradient(135deg, rgba(59, 130, 246, 0.12) 0%, rgba(16, 185, 129, 0.08) 100%)',
              border: '1.5px solid',
              borderColor: activePricingTier === 'WHOLESALE' ? 'secondary.main' : 'primary.main',
              borderRadius: '16px',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, color: 'text.primary' }}>
                Customer Sales Tier:
              </Typography>
              <Chip
                label={
                  activePricingTier === 'WHOLESALE' ? '📦 WHOLESALE ACTIVE' : '🏷️ RETAIL ACTIVE'
                }
                color={activePricingTier === 'WHOLESALE' ? 'secondary' : 'primary'}
                size="small"
                sx={{ fontWeight: 800, fontSize: '0.75rem' }}
              />
            </Box>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                variant={activePricingTier === 'RETAIL' ? 'contained' : 'outlined'}
                color="primary"
                size="small"
                onClick={() => handleSwitchGlobalTier('RETAIL')}
                sx={{ fontWeight: 700, px: 2, borderRadius: '8px', textTransform: 'none' }}
              >
                🏷️ Retail Customer
              </Button>
              <Button
                variant={activePricingTier === 'WHOLESALE' ? 'contained' : 'outlined'}
                color="secondary"
                size="small"
                onClick={() => handleSwitchGlobalTier('WHOLESALE')}
                sx={{ fontWeight: 700, px: 2, borderRadius: '8px', textTransform: 'none' }}
              >
                📦 Wholesale Customer
              </Button>
            </Box>
          </Paper>

          <Card
            sx={{
              mb: 3,
              p: 2,
              background: 'rgba(255, 255, 255, 0.02)',
              border: '1px solid rgba(255, 255, 255, 0.05)',
              borderRadius: '16px',
            }}
          >
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  size="small"
                  placeholder={t('pos.searchPlaceholder')}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon sx={{ color: 'text.secondary' }} />
                      </InputAdornment>
                    ),
                  }}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <Tabs
                  value={selectedCategory}
                  onChange={(_: SyntheticEvent, val: string) => setSelectedCategory(val)}
                  variant="scrollable"
                  scrollButtons="auto"
                  sx={{
                    minHeight: 40,
                    '& .MuiTab-root': {
                      minHeight: 40,
                      py: 0.5,
                      px: 2,
                      textTransform: 'none',
                      fontWeight: 700,
                      fontSize: '0.85rem',
                      borderRadius: '8px',
                      color: 'text.secondary',
                      '&.Mui-selected': {
                        color: 'primary.main',
                        bgcolor: 'rgba(139, 92, 246, 0.1)',
                      },
                    },
                  }}
                >
                  {categories.map((cat: string) => (
                    <Tab key={cat} label={cat} value={cat} />
                  ))}
                </Tabs>
              </Grid>
            </Grid>
          </Card>

          {/* Product Grid Cards */}
          <Grid container spacing={2}>
            {filteredProducts.map((product: Product) => {
              const retailAmt = Number(
                product.retailPrice ?? product.price ?? product.sellingPrice ?? 0
              );
              const wholesaleAmt =
                product.wholesalePrice != null ? Number(product.wholesalePrice) : retailAmt;
              const activeAmt = activePricingTier === 'WHOLESALE' ? wholesaleAmt : retailAmt;

              return (
                <Grid item xs={12} sm={6} md={4} key={product.id || product._id}>
                  <Card
                    onClick={() => addToCart(product)}
                    sx={{
                      cursor: product.quantity > 0 ? 'pointer' : 'not-allowed',
                      opacity: product.quantity > 0 ? 1 : 0.6,
                      height: '100%',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      position: 'relative',
                      overflow: 'hidden',
                      p: 2,
                      background: 'rgba(255, 255, 255, 0.02)',
                      border: '1px solid',
                      borderColor:
                        activePricingTier === 'WHOLESALE'
                          ? 'rgba(147, 51, 234, 0.25)'
                          : 'rgba(59, 130, 246, 0.25)',
                      borderRadius: '16px',
                      transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                      '&:hover':
                        product.quantity > 0
                          ? {
                              transform: 'translateY(-4px)',
                              borderColor:
                                activePricingTier === 'WHOLESALE'
                                  ? 'secondary.main'
                                  : 'primary.main',
                              boxShadow: '0 8px 24px rgba(139, 92, 246, 0.15)',
                            }
                          : {},
                    }}
                  >
                    <Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                        <Chip
                          label={product.category}
                          size="small"
                          sx={{
                            height: 20,
                            fontSize: '0.675rem',
                            fontWeight: 700,
                            bgcolor: 'rgba(255, 255, 255, 0.05)',
                          }}
                        />
                        <Chip
                          label={`${product.quantity} in stock`}
                          size="small"
                          color={
                            product.quantity > 5
                              ? 'success'
                              : product.quantity > 0
                                ? 'warning'
                                : 'error'
                          }
                          sx={{ height: 20, fontSize: '0.675rem', fontWeight: 800 }}
                        />
                      </Box>
                      <Typography variant="subtitle1" sx={{ fontWeight: 800, mb: 0.5 }}>
                        {product.name}
                      </Typography>
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ fontFamily: 'monospace' }}
                      >
                        SKU: {product.sku}
                      </Typography>
                    </Box>

                    <Box sx={{ mt: 2 }}>
                      {/* Dual-price display */}
                      <Box
                        sx={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'baseline',
                          mb: 1,
                          p: 1,
                          borderRadius: '8px',
                          bgcolor: 'rgba(255, 255, 255, 0.03)',
                        }}
                      >
                        <Box>
                          <Typography
                            variant="caption"
                            sx={{
                              color:
                                activePricingTier === 'RETAIL' ? 'primary.main' : 'text.secondary',
                              display: 'block',
                              fontSize: '0.7rem',
                              fontWeight: activePricingTier === 'RETAIL' ? 700 : 400,
                            }}
                          >
                            Retail {activePricingTier === 'RETAIL' ? '✓' : ''}
                          </Typography>
                          <Typography
                            variant="subtitle2"
                            sx={{
                              fontWeight: activePricingTier === 'RETAIL' ? 800 : 500,
                              color:
                                activePricingTier === 'RETAIL' ? 'primary.main' : 'text.secondary',
                            }}
                          >
                            {formatAmount(retailAmt, {
                              fromCurrency: product.currency || baseCurrency,
                              currency: activeCurrency,
                            })}
                          </Typography>
                        </Box>
                        <Box sx={{ textAlign: 'right' }}>
                          <Typography
                            variant="caption"
                            sx={{
                              color:
                                activePricingTier === 'WHOLESALE'
                                  ? 'secondary.main'
                                  : 'text.secondary',
                              display: 'block',
                              fontSize: '0.7rem',
                              fontWeight: activePricingTier === 'WHOLESALE' ? 700 : 400,
                            }}
                          >
                            Wholesale {activePricingTier === 'WHOLESALE' ? '✓' : ''}
                          </Typography>
                          <Typography
                            variant="subtitle2"
                            sx={{
                              fontWeight: activePricingTier === 'WHOLESALE' ? 800 : 500,
                              color:
                                activePricingTier === 'WHOLESALE'
                                  ? 'secondary.main'
                                  : 'text.secondary',
                            }}
                          >
                            {formatAmount(wholesaleAmt, {
                              fromCurrency: product.currency || baseCurrency,
                              currency: activeCurrency,
                            })}
                          </Typography>
                        </Box>
                      </Box>

                      <Box
                        sx={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                        }}
                      >
                        <Chip
                          label={`+ Add ${activePricingTier === 'WHOLESALE' ? 'Wholesale' : 'Retail'} (${formatAmount(activeAmt, { fromCurrency: product.currency || baseCurrency, currency: activeCurrency })})`}
                          size="small"
                          color={activePricingTier === 'WHOLESALE' ? 'secondary' : 'primary'}
                          sx={{ fontSize: '0.7rem', height: '22px', fontWeight: 700 }}
                        />
                        <IconButton
                          size="small"
                          color={activePricingTier === 'WHOLESALE' ? 'secondary' : 'primary'}
                          disabled={product.quantity <= 0}
                          sx={{
                            bgcolor:
                              activePricingTier === 'WHOLESALE'
                                ? 'rgba(147, 51, 234, 0.15)'
                                : 'rgba(139, 92, 246, 0.1)',
                            '&:hover': {
                              bgcolor:
                                activePricingTier === 'WHOLESALE'
                                  ? 'secondary.main'
                                  : 'primary.main',
                              color: '#fff',
                            },
                          }}
                        >
                          <AddIcon fontSize="small" />
                        </IconButton>
                      </Box>
                    </Box>
                  </Card>
                </Grid>
              );
            })}
          </Grid>
        </Grid>

        {/* Right Column: Register Cart & Instant Tender Checkout */}
        <Grid item xs={12} md={5} lg={4}>
          <Card
            sx={{
              position: 'sticky',
              top: 24,
              background: 'rgba(255, 255, 255, 0.02)',
              border: '1px solid rgba(255, 255, 255, 0.05)',
              borderRadius: '20px',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <Box
              sx={{
                p: 2.5,
                bgcolor: 'rgba(255, 255, 255, 0.02)',
                borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
              }}
            >
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography
                  variant="h6"
                  sx={{ fontWeight: 800, display: 'flex', alignItems: 'center', gap: 1 }}
                >
                  <CheckoutIcon color="primary" /> {t('pos.cart')} (
                  {cart.reduce((a, b) => a + b.quantity, 0)})
                </Typography>
                {cart.length > 0 && (
                  <Button
                    size="small"
                    startIcon={<DeleteSweepIcon sx={{ fontSize: '1.05rem !important' }} />}
                    onClick={clearCompletedSaleState}
                    sx={{
                      textTransform: 'none',
                      fontWeight: 700,
                      fontSize: '0.8rem',
                      px: 1.5,
                      py: 0.4,
                      borderRadius: '8px',
                      color: '#f87171',
                      bgcolor: 'rgba(239, 68, 68, 0.08)',
                      border: '1px solid rgba(239, 68, 68, 0.22)',
                      backdropFilter: 'blur(8px)',
                      transition: 'all 0.2s ease-in-out',
                      '&:hover': {
                        bgcolor: 'rgba(239, 68, 68, 0.18)',
                        borderColor: '#ef4444',
                        color: '#fca5a5',
                        boxShadow: '0 2px 8px rgba(239, 68, 68, 0.25)',
                        transform: 'translateY(-1px)',
                      },
                      '&:active': {
                        transform: 'translateY(0)',
                      },
                    }}
                  >
                    {t('common.clear') || 'Clear'}
                  </Button>
                )}
              </Box>
            </Box>

            {/* Cart Items List */}
            <Box sx={{ maxHeight: 320, overflowY: 'auto', p: 1.5 }}>
              {cart.length === 0 ? (
                <Box sx={{ py: 6, textAlign: 'center' }}>
                  <Typography variant="body2" color="text.secondary">
                    {t('pos.emptyCart')}
                  </Typography>
                </Box>
              ) : (
                <List disablePadding>
                  {cart.map((item) => (
                    <ListItem
                      key={`${item.productId}-${item.priceTier}`}
                      secondaryAction={
                        <IconButton
                          edge="end"
                          color="error"
                          size="small"
                          onClick={() => removeItem(item.productId, item.priceTier)}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      }
                      sx={{ borderBottom: '1px solid rgba(255, 255, 255, 0.03)', py: 1.5, px: 1 }}
                    >
                      <ListItemText
                        disableTypography
                        primary={
                          <Box
                            sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}
                          >
                            <Typography
                              variant="body2"
                              sx={{ fontWeight: 700, fontSize: '0.85rem' }}
                            >
                              {item.productName}
                            </Typography>
                            <Chip
                              label={item.priceTier === 'WHOLESALE' ? '📦 WHOLESALE' : '🏷️ RETAIL'}
                              size="small"
                              color={item.priceTier === 'WHOLESALE' ? 'secondary' : 'primary'}
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleItemTier(item.productId, item.priceTier);
                              }}
                              clickable
                              title="Click to switch price tier for this item"
                              sx={{
                                fontSize: '0.65rem',
                                height: '20px',
                                fontWeight: 800,
                                cursor: 'pointer',
                              }}
                            />
                          </Box>
                        }
                        secondary={
                          <Box
                            sx={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 1,
                              mt: 0.5,
                              flexWrap: 'wrap',
                            }}
                          >
                            <Typography variant="caption" color="text.secondary">
                              {formatAmount(item.price, {
                                fromCurrency: item.currency || baseCurrency,
                                currency: activeCurrency,
                              })}{' '}
                              ea
                            </Typography>
                            {item.priceTier === 'WHOLESALE' &&
                              item.retailPrice > item.wholesalePrice && (
                                <Chip
                                  label={`Saved ${formatAmount((item.retailPrice - item.wholesalePrice) * item.quantity, { fromCurrency: item.currency || cartCurrency, currency: activeCurrency })}`}
                                  size="small"
                                  color="success"
                                  variant="outlined"
                                  sx={{ height: '18px', fontSize: '0.65rem', fontWeight: 700 }}
                                />
                              )}
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, ml: 1 }}>
                              <IconButton
                                size="small"
                                sx={{ p: 0.2, border: '1px solid rgba(255,255,255,0.06)' }}
                                onClick={() => adjustQuantity(item.productId, item.priceTier, -1)}
                              >
                                <RemoveIcon fontSize="inherit" sx={{ fontSize: '0.75rem' }} />
                              </IconButton>
                              <Typography
                                variant="body2"
                                sx={{ fontWeight: 800, px: 0.5, fontSize: '0.8rem' }}
                              >
                                {item.quantity}
                              </Typography>
                              <IconButton
                                size="small"
                                sx={{ p: 0.2, border: '1px solid rgba(255,255,255,0.06)' }}
                                onClick={() => adjustQuantity(item.productId, item.priceTier, 1)}
                              >
                                <AddIcon fontSize="inherit" sx={{ fontSize: '0.75rem' }} />
                              </IconButton>
                            </Box>
                          </Box>
                        }
                      />
                      <Typography
                        variant="subtitle2"
                        sx={{ mr: 2, fontWeight: 800, color: 'text.primary', fontSize: '0.85rem' }}
                      >
                        {formatAmount(item.total, {
                          fromCurrency: item.currency || cartCurrency,
                          currency: activeCurrency,
                        })}
                      </Typography>
                    </ListItem>
                  ))}
                </List>
              )}
            </Box>

            <Divider sx={{ borderColor: 'rgba(255,255,255,0.04)' }} />

            {/* Calculations & Quick Tender Selection */}
            <Box sx={{ p: 2.5, bgcolor: 'rgba(0, 0, 0, 0.1)' }}>
              <Grid container spacing={2} sx={{ mb: 2 }}>
                <Grid item xs={6}>
                  <TextField
                    label={`${t('pos.discount')} (${currencySymbol})`}
                    type="number"
                    size="small"
                    value={discount || ''}
                    onChange={(e: ChangeEvent<HTMLInputElement>) =>
                      setDiscount(Math.max(0, Number(e.target.value)))
                    }
                    fullWidth
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    select
                    label="Payment Tender"
                    size="small"
                    value={paymentMethod}
                    onChange={(e: ChangeEvent<HTMLInputElement>) =>
                      setPaymentMethod(e.target.value as PosManualTender)
                    }
                    fullWidth
                  >
                    <MenuItem value="CASH">💵 Cash (Manual)</MenuItem>
                    <MenuItem value="BANK_TRANSFER">🏦 Bank / Mobile Transfer</MenuItem>
                    <MenuItem value="CARD">💳 Card Terminal (POS)</MenuItem>
                  </TextField>
                </Grid>
              </Grid>

              {totalWholesaleSavings > 0 && (
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography
                    variant="body2"
                    sx={{ color: '#34d399', fontSize: '0.8rem', fontWeight: 700 }}
                  >
                    Wholesale Savings
                  </Typography>
                  <Typography
                    variant="body2"
                    sx={{ fontWeight: 700, color: '#34d399', fontSize: '0.8rem' }}
                  >
                    -
                    {formatAmount(totalWholesaleSavings, {
                      fromCurrency: cartCurrency,
                      currency: activeCurrency,
                    })}
                  </Typography>
                </Box>
              )}

              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8rem' }}>
                  {t('pos.subtotal')}
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.8rem' }}>
                  {formatAmount(subtotal, { fromCurrency: cartCurrency, currency: activeCurrency })}
                </Typography>
              </Box>
              {discount > 0 && (
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="body2" color="error" sx={{ fontSize: '0.8rem' }}>
                    {t('pos.discount')}
                  </Typography>
                  <Typography
                    variant="body2"
                    sx={{ fontWeight: 600, color: 'error.light', fontSize: '0.8rem' }}
                  >
                    -
                    {formatAmount(discount, {
                      fromCurrency: cartCurrency,
                      currency: activeCurrency,
                    })}
                  </Typography>
                </Box>
              )}
              <Divider sx={{ my: 1.5, borderColor: 'rgba(255,255,255,0.03)' }} />
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  mb: 2.5,
                  alignItems: 'center',
                }}
              >
                <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                  {t('pos.total')}
                </Typography>
                <Typography
                  variant="h5"
                  color="#34d399"
                  sx={{ fontWeight: 800, letterSpacing: '-0.01em' }}
                >
                  {formatAmount(total, { fromCurrency: cartCurrency, currency: activeCurrency })}
                </Typography>
              </Box>

              <Button
                variant="contained"
                color="secondary"
                fullWidth
                size="large"
                startIcon={<CheckoutIcon />}
                onClick={handleOpenCheckoutModal}
                disabled={cart.length === 0 || checkoutMutation.isPending}
                sx={{
                  py: 1.5,
                  fontSize: '0.925rem',
                  fontWeight: 700,
                  boxShadow: '0 4px 18px rgba(16, 185, 129, 0.25)',
                  background: 'linear-gradient(90deg, #10b981 0%, #059669 100%)',
                }}
              >
                {checkoutMutation.isPending ? t('pos.processing') : 'Complete & Record Sale'}
              </Button>
            </Box>
          </Card>
        </Grid>
      </Grid>

      {/* Manual Tender POS Checkout Modal */}
      <Dialog
        open={checkoutModalOpen}
        onClose={() => !checkoutMutation.isPending && setCheckoutModalOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            maxWidth: '520px !important',
            width: '100%',
            bgcolor: '#0f131f',
            backgroundImage: 'none',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '20px',
            color: '#f3f4f6',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
            p: { xs: 1.5, sm: 2 },
            m: { xs: 1.5, sm: 3 },
          },
        }}
      >
        <DialogTitle
          component="div"
          sx={{ fontWeight: 800, fontSize: '1.3rem', pb: 1, textAlign: 'center' }}
        >
          Tender Confirmation & Receipt
        </DialogTitle>
        <DialogContent sx={{ pb: 2 }}>
          <Box sx={{ textAlign: 'center', my: 1.5 }}>
            <Box sx={{ display: 'flex', justifyContent: 'center', mb: 1 }}>
              <Chip
                label={
                  activePricingTier === 'WHOLESALE'
                    ? '📦 WHOLESALE TRANSACTION'
                    : '🏷️ RETAIL TRANSACTION'
                }
                color={activePricingTier === 'WHOLESALE' ? 'secondary' : 'primary'}
                sx={{ fontWeight: 800, fontSize: '0.8rem' }}
              />
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>
              TOTAL AMOUNT DUE
            </Typography>
            <Typography variant="h3" sx={{ fontWeight: 900, color: '#34d399', my: 0.5 }}>
              {formatAmount(total, { fromCurrency: cartCurrency, currency: activeCurrency })}
            </Typography>
          </Box>

          <Divider sx={{ my: 2, borderColor: 'rgba(255,255,255,0.08)' }} />

          {/* Tender Type Selector Cards */}
          <Typography
            variant="caption"
            sx={{ fontWeight: 800, color: 'text.secondary', display: 'block', mb: 1 }}
          >
            SELECT TENDER METHOD
          </Typography>
          <Grid container spacing={1.5} sx={{ mb: 2.5 }}>
            <Grid item xs={4}>
              <Paper
                onClick={() => setPaymentMethod('CASH')}
                sx={{
                  p: 1.5,
                  textAlign: 'center',
                  cursor: 'pointer',
                  borderRadius: '12px',
                  border:
                    paymentMethod === 'CASH'
                      ? '2px solid #10b981'
                      : '1px solid rgba(255,255,255,0.1)',
                  bgcolor:
                    paymentMethod === 'CASH'
                      ? 'rgba(16, 185, 129, 0.12)'
                      : 'rgba(255,255,255,0.02)',
                  color: paymentMethod === 'CASH' ? '#34d399' : 'inherit',
                  transition: 'all 0.2s',
                }}
              >
                <PaymentsIcon sx={{ fontSize: 28, mb: 0.5 }} />
                <Typography variant="body2" sx={{ fontWeight: 800 }}>
                  Cash
                </Typography>
              </Paper>
            </Grid>
            <Grid item xs={4}>
              <Paper
                onClick={() => setPaymentMethod('BANK_TRANSFER')}
                sx={{
                  p: 1.5,
                  textAlign: 'center',
                  cursor: 'pointer',
                  borderRadius: '12px',
                  border:
                    paymentMethod === 'BANK_TRANSFER'
                      ? '2px solid #8b5cf6'
                      : '1px solid rgba(255,255,255,0.1)',
                  bgcolor:
                    paymentMethod === 'BANK_TRANSFER'
                      ? 'rgba(139, 92, 246, 0.12)'
                      : 'rgba(255,255,255,0.02)',
                  color: paymentMethod === 'BANK_TRANSFER' ? '#a78bfa' : 'inherit',
                  transition: 'all 0.2s',
                }}
              >
                <AccountBalanceIcon sx={{ fontSize: 28, mb: 0.5 }} />
                <Typography variant="body2" sx={{ fontWeight: 800 }}>
                  Transfer
                </Typography>
              </Paper>
            </Grid>
            <Grid item xs={4}>
              <Paper
                onClick={() => setPaymentMethod('CARD')}
                sx={{
                  p: 1.5,
                  textAlign: 'center',
                  cursor: 'pointer',
                  borderRadius: '12px',
                  border:
                    paymentMethod === 'CARD'
                      ? '2px solid #3b82f6'
                      : '1px solid rgba(255,255,255,0.1)',
                  bgcolor:
                    paymentMethod === 'CARD'
                      ? 'rgba(59, 130, 246, 0.12)'
                      : 'rgba(255,255,255,0.02)',
                  color: paymentMethod === 'CARD' ? '#60a5fa' : 'inherit',
                  transition: 'all 0.2s',
                }}
              >
                <CreditCardIcon sx={{ fontSize: 28, mb: 0.5 }} />
                <Typography variant="body2" sx={{ fontWeight: 800 }}>
                  Card POS
                </Typography>
              </Paper>
            </Grid>
          </Grid>

          {/* Tender-Specific Inputs */}
          {paymentMethod === 'CASH' && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <TextField
                label="Cash Amount Received"
                type="number"
                fullWidth
                value={cashTendered || ''}
                onChange={(e) => setCashTendered(Number(e.target.value))}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">{currencySymbol}</InputAdornment>
                  ),
                }}
                sx={{ input: { fontSize: '1.2rem', fontWeight: 800 } }}
              />

              {/* Quick Cash Buttons */}
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => setCashTendered(Number(displayTotal.toFixed(2)))}
                  sx={{ textTransform: 'none', fontWeight: 700 }}
                >
                  Exact (
                  {formatAmount(total, { fromCurrency: cartCurrency, currency: activeCurrency })})
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => setCashTendered(Math.ceil(displayTotal / 1000) * 1000)}
                  sx={{ textTransform: 'none', fontWeight: 700 }}
                >
                  Round Up 1k
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() =>
                    setCashTendered(Math.ceil(displayTotal / 5000) * 5000 || displayTotal + 5000)
                  }
                  sx={{ textTransform: 'none', fontWeight: 700 }}
                >
                  Round Up 5k
                </Button>
              </Box>

              <Paper
                sx={{
                  p: 2,
                  bgcolor: changeDue >= 0 ? 'rgba(16, 185, 129, 0.08)' : 'rgba(239, 68, 68, 0.08)',
                  border:
                    changeDue >= 0
                      ? '1px solid rgba(16, 185, 129, 0.3)'
                      : '1px solid rgba(239, 68, 68, 0.3)',
                  borderRadius: '12px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <Typography variant="body2" sx={{ fontWeight: 700, color: 'text.secondary' }}>
                  CHANGE TO RETURN:
                </Typography>
                <Typography
                  variant="h6"
                  sx={{
                    fontWeight: 900,
                    color: changeDue >= 0 ? '#34d399' : '#f87171',
                  }}
                >
                  {formatAmount(changeDue, { currency: activeCurrency, convert: false })}
                </Typography>
              </Paper>
            </Box>
          )}

          {paymentMethod === 'BANK_TRANSFER' && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Paper
                sx={{
                  p: 2,
                  bgcolor: 'rgba(139, 92, 246, 0.08)',
                  border: '1px solid rgba(139, 92, 246, 0.2)',
                  borderRadius: '12px',
                }}
              >
                <Typography variant="body2" sx={{ fontWeight: 600, color: '#c4b5fd' }}>
                  ℹ️ <strong>Cashier Verification:</strong> Please verify that the incoming transfer
                  alert of{' '}
                  <strong>
                    {formatAmount(total, { fromCurrency: cartCurrency, currency: activeCurrency })}
                  </strong>{' '}
                  has settled in the company bank account before confirming.
                </Typography>
              </Paper>

              <TextField
                label="Transfer Reference / Sender Name"
                fullWidth
                size="small"
                placeholder="e.g. TRF-98234 or John Doe"
                value={manualReference}
                onChange={(e) => setManualReference(e.target.value)}
              />
            </Box>
          )}

          {paymentMethod === 'CARD' && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Paper
                sx={{
                  p: 2,
                  bgcolor: 'rgba(59, 130, 246, 0.08)',
                  border: '1px solid rgba(59, 130, 246, 0.2)',
                  borderRadius: '12px',
                }}
              >
                <Typography variant="body2" sx={{ fontWeight: 600, color: '#93c5fd' }}>
                  💳 <strong>Physical POS Machine:</strong> Process{' '}
                  <strong>
                    {formatAmount(total, { fromCurrency: cartCurrency, currency: activeCurrency })}
                  </strong>{' '}
                  on your countertop POS card terminal. Confirm once the terminal prints "APPROVED".
                </Typography>
              </Paper>

              <TextField
                label="Card Terminal RRN / Auth Slip #"
                fullWidth
                size="small"
                placeholder="e.g. RRN-104928 or Slip 402"
                value={manualReference}
                onChange={(e) => setManualReference(e.target.value)}
              />
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button
            onClick={() => setCheckoutModalOpen(false)}
            disabled={checkoutMutation.isPending}
            color="inherit"
            sx={{ fontWeight: 700 }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            color="success"
            onClick={handleConfirmManualPayment}
            disabled={
              checkoutMutation.isPending ||
              (paymentMethod === 'CASH' && cashTendered < displayTotal)
            }
            startIcon={<CheckCircleIcon />}
            sx={{
              fontWeight: 800,
              borderRadius: '10px',
              px: 3,
              py: 1,
              background: 'linear-gradient(90deg, #10b981 0%, #059669 100%)',
            }}
          >
            {checkoutMutation.isPending ? 'Recording...' : 'Confirm & Print Receipt'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Printable Customer Receipt Invoice Modal */}
      <ReceiptModal
        open={receiptModalOpen}
        onClose={() => setReceiptModalOpen(false)}
        receiptData={receiptData}
      />

      {/* Recent Sales & Receipts Dialog */}
      <Dialog
        open={recentSalesOpen}
        onClose={() => setRecentSalesOpen(false)}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            bgcolor: '#0f131f',
            backgroundImage: 'none',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '16px',
            color: '#f3f4f6',
          },
        }}
      >
        <DialogTitle
          component="div"
          sx={{
            fontWeight: 800,
            fontSize: '1.25rem',
            pb: 1,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <ReceiptLongIcon color="secondary" />
            <Typography variant="h6" component="div" sx={{ fontWeight: 800 }}>
              {t('pos.recentSales')}
            </Typography>
          </Box>
          <Button onClick={() => setRecentSalesOpen(false)} color="inherit" size="small">
            {t('common.cancel')}
          </Button>
        </DialogTitle>
        <DialogContent dividers sx={{ borderColor: 'rgba(255,255,255,0.08)' }}>
          {receipts.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ py: 3, textAlign: 'center' }}>
              {t('pos.noProducts')}
            </Typography>
          ) : (
            <List disablePadding>
              {receipts.slice(0, 15).map((receipt, idx) => (
                <Box key={receipt.id || receipt._id || idx}>
                  <ListItem
                    sx={{
                      py: 1.5,
                      px: 2,
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      bgcolor: 'rgba(255,255,255,0.02)',
                      borderRadius: '8px',
                      mb: 1,
                    }}
                  >
                    <Box>
                      <Typography
                        variant="subtitle2"
                        sx={{ fontWeight: 800, fontFamily: 'monospace', color: 'primary.light' }}
                      >
                        {receipt.transactionNumber || `TX-${receipt.id || idx}`}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" display="block">
                        {receipt.createdAt
                          ? new Date(receipt.createdAt).toLocaleString()
                          : 'Recent'}{' '}
                        • Cashier: {receipt.data.cashierName || 'Staff'} •{' '}
                        {receipt.data.items?.length || 0} item(s)
                      </Typography>
                    </Box>

                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <Box sx={{ textAlign: 'right' }}>
                        <Typography
                          variant="subtitle2"
                          sx={{ fontWeight: 900, color: 'success.light' }}
                        >
                          {formatAmount(receipt.data.total || 0, activeCurrency)}
                        </Typography>
                        <Chip
                          label={receipt.data.paymentMethod || 'CASH'}
                          size="small"
                          sx={{ height: 18, fontSize: '0.625rem', fontWeight: 800 }}
                        />
                      </Box>
                      <Button
                        variant="contained"
                        color="primary"
                        size="small"
                        startIcon={<PrintIcon />}
                        onClick={() => {
                          const rData = (receipt.data || {}) as any;
                          triggerPrintReceipt({
                            transactionNumber: receipt.transactionNumber,
                            createdAt: rData.createdAt,
                            cashierName: rData.cashierName,
                            branchName: rData.branchName,
                            customerEmail: rData.customerEmail,
                            companyName: rData.companyName,
                            companyLegalName: rData.companyLegalName,
                            companyLogoUrl: rData.companyLogoUrl,
                            companyAddress: rData.companyAddress,
                            companyPhone: rData.companyPhone,
                            companyEmail: rData.companyEmail,
                            companyTaxId: rData.companyTaxId,
                            receiptHeader: rData.receiptHeader,
                            receiptFooter: rData.receiptFooter,
                            items: rData.items,
                            subtotal: rData.subtotal,
                            tax: rData.tax,
                            discount: rData.discount,
                            total: rData.total,
                            paymentMethod: rData.paymentMethod,
                          });
                          setRecentSalesOpen(false);
                        }}
                        sx={{ fontWeight: 700, borderRadius: '6px' }}
                      >
                        {t('pos.reopenReceipt')}
                      </Button>
                    </Box>
                  </ListItem>
                </Box>
              ))}
            </List>
          )}
        </DialogContent>
      </Dialog>
    </Box>
  );
}
