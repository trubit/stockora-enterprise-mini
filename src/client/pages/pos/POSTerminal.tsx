import { useState, useEffect, useTransition, useRef } from 'react';
import {
  Box,
  Grid,
  Paper,
  Typography,
  TextField,
  Button,
  IconButton,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Divider,
  List,
  ListItem,
  ListItemText,
  CircularProgress,
  InputAdornment,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import PointOfSaleIcon from '@mui/icons-material/PointOfSale';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
import PauseCircleIcon from '@mui/icons-material/PauseCircle';
import PlayCircleIcon from '@mui/icons-material/PlayCircle';
import ReceiptIcon from '@mui/icons-material/Receipt';
import WifiOffIcon from '@mui/icons-material/WifiOff';
import PersonIcon from '@mui/icons-material/Person';
import PaymentsIcon from '@mui/icons-material/Payments';
import CreditCardIcon from '@mui/icons-material/CreditCard';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import PageHeader from '../../components/PageHeader.tsx';
import { apiClient } from '../../api/client.ts';
import { toast } from 'react-hot-toast';
import { useRegionalSettings } from '../../hooks/useRegionalSettings.js';
import { CurrencySelector } from '../../components/CurrencySelector.tsx';
import { useAuthStore } from '../../store/auth.ts';
import { useTenantStore } from '../../store/tenant.ts';

interface ProductItem {
  _id: string;
  sku: string;
  name: string;
  sellingPrice: number;
  retailPrice?: number;
  wholesalePrice?: number;
  quantity: number;
  category?: string;
  currency?: string;
}

interface CartItem {
  productId: string;
  sku: string;
  name: string;
  quantity: number;
  priceTier: 'RETAIL' | 'WHOLESALE';
  retailPrice: number;
  wholesalePrice: number;
  unitPrice: number;
  discount: number;
  total: number;
  currency?: string;
}

export default function POSTerminal() {
  const { user } = useAuthStore();
  const { activeTenant } = useTenantStore();
  const { formatAmount, currencySymbol, baseCurrency, activeCurrency, convertAmount } =
    useRegionalSettings();

  const effectiveBranchId =
    user?.branchId ||
    (user as any)?.tenants?.[0]?.branchId ||
    (activeTenant as any)?.branches?.[0]?._id ||
    activeTenant?.branchId ||
    'MAIN-BRANCH';

  const effectiveWarehouseId =
    (user as any)?.warehouseId ||
    (activeTenant as any)?.warehouses?.[0]?._id ||
    activeTenant?.warehouseId ||
    'MAIN-WAREHOUSE';

  const effectiveCashierId = user?._id || user?.id || 'CASHIER';
  const effectiveCashierName = user?.username || user?.email || 'Operator';

  const [isPending, startTransition] = useTransition();
  const [searchQuery, setSearchQuery] = useState('');
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartDiscount, setCartDiscount] = useState<number>(0);
  const [activePricingTier, setActivePricingTier] = useState<'RETAIL' | 'WHOLESALE'>('RETAIL');
  const [selectedCustomer, setSelectedCustomer] = useState<{
    id: string;
    name: string;
    email: string;
  } | null>(null);
  const [mobileView, setMobileView] = useState<'catalog' | 'cart'>('catalog');

  // Modals & States
  const [checkoutModalOpen, setCheckoutModalOpen] = useState(false);
  const [heldModalOpen, setHeldModalOpen] = useState(false);
  const [heldSales, setHeldSales] = useState<any[]>([]);
  const [receiptData, setReceiptData] = useState<any | null>(null);
  const [receiptHistoryModalOpen, setReceiptHistoryModalOpen] = useState(false);
  const [recentOrders, setRecentOrders] = useState<any[]>([]);
  const [lookupOrderNumber, setLookupOrderNumber] = useState('');
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  // Manual Tender Inputs
  const [selectedTender, setSelectedTender] = useState<'CASH' | 'CARD' | 'BANK_TRANSFER'>('CASH');
  const [cashTendered, setCashTendered] = useState<number>(0);
  const [referenceNo, setReferenceNo] = useState<string>('');
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);
  const addingLockRef = useRef<{ [key: string]: number }>({});

  const handleFetchReceipt = async (orderNum: string) => {
    try {
      const res = await apiClient.get(`/pos/receipt/${orderNum}`);
      const rData = res.data?.data || res.data || res;
      setReceiptData(rData);
      setReceiptHistoryModalOpen(false);
    } catch {
      toast.error(`Receipt for order #${orderNum} not found.`);
    }
  };

  const printPosReceipt = (receipt: any) => {
    if (!receipt) return;
    const receiptCurrency = (receipt.currency || 'NGN').toUpperCase().trim();

    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    iframe.style.visibility = 'hidden';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (!doc) {
      window.print();
      return;
    }

    const itemsRows = (receipt.items || [])
      .map(
        (i: any) => `
        <tr>
          <td style="padding: 6px 4px 6px 0; border-bottom: 1px dashed #cbd5e1; vertical-align: top;">
            <div style="font-weight: 700; font-size: 12px; color: #0f172a;">${i.name || i.productName || 'Item'}</div>
            <div style="font-size: 10px; color: #64748b;">
              ${i.sku ? `SKU: ${i.sku} • ` : ''}Tier: <strong>${i.priceTier || receipt.pricingMode || 'RETAIL'}</strong>
            </div>
          </td>
          <td style="padding: 6px 4px; text-align: center; vertical-align: top; font-size: 12px; border-bottom: 1px dashed #cbd5e1; font-weight: 600;">
            ${i.qty || i.quantity || 1}
          </td>
          <td style="padding: 6px 4px; text-align: right; vertical-align: top; font-size: 12px; border-bottom: 1px dashed #cbd5e1;">
            ${formatAmount(i.price ?? i.unitPrice ?? 0, { fromCurrency: i.currency || receiptCurrency, currency: receiptCurrency, convert: false })}
          </td>
          <td style="padding: 6px 0 6px 4px; text-align: right; vertical-align: top; font-weight: 700; font-size: 12px; border-bottom: 1px dashed #cbd5e1; color: #0f172a;">
            ${formatAmount(i.total, { fromCurrency: receiptCurrency, currency: receiptCurrency, convert: false })}
          </td>
        </tr>
      `
      )
      .join('');

    const paymentsList = (receipt.payments || [])
      .map(
        (p: any) => `
        <div style="display: flex; justify-content: space-between; font-size: 11px; margin-top: 3px; color: #334155;">
          <span>Payment Tender (${p.method || 'CASH'}):</span>
          <span style="font-weight: 600;">${formatAmount(p.amount, { fromCurrency: receiptCurrency, currency: receiptCurrency, convert: false })}</span>
        </div>
      `
      )
      .join('');

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Receipt #${receipt.receiptNumber || 'POS'}</title>
          <style>
            @page {
              margin: 4mm 6mm;
              size: auto;
            }
            * {
              box-sizing: border-box;
              margin: 0;
              padding: 0;
            }
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
              color: #000000;
              background: #ffffff;
              font-size: 12px;
              line-height: 1.4;
              padding: 10px;
              width: 100%;
              max-width: 380px;
              margin: 0 auto;
            }
            .center { text-align: center; }
            .divider { border-top: 1px dashed #475569; margin: 8px 0; }
            .divider-solid { border-top: 2px solid #0f172a; margin: 8px 0; }
            table { width: 100%; border-collapse: collapse; margin: 6px 0; }
            th { border-bottom: 1.5px solid #0f172a; padding: 4px 2px; font-size: 11px; text-transform: uppercase; color: #0f172a; }
            td { page-break-inside: avoid; }
          </style>
        </head>
        <body>
          <div class="center" style="margin-bottom: 8px;">
            <h2 style="font-size: 19px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 3px; color: #0f172a;">
              ${receipt.businessName || receipt.storeName || 'TRUSON'}
            </h2>
            ${receipt.legalName && receipt.legalName !== receipt.businessName ? `<div style="font-size: 11px; color: #475569;">${receipt.legalName}</div>` : ''}
            ${receipt.address && receipt.address !== 'US' && receipt.address !== 'USA' ? `<div style="font-size: 11px; color: #475569;">${receipt.address}</div>` : ''}
            ${receipt.phone || receipt.email ? `<div style="font-size: 11px; color: #475569; font-weight: 500;">${[receipt.phone ? `Tel: ${receipt.phone}` : '', receipt.email ? `Email: ${receipt.email}` : ''].filter(Boolean).join(' • ')}</div>` : ''}
            ${receipt.headerNotice ? `<div style="font-size: 10px; font-style: italic; margin-top: 3px; color: #64748b;">${receipt.headerNotice}</div>` : ''}
          </div>

          <div class="divider"></div>

          <div style="font-size: 11px; line-height: 1.6; color: #1e293b;">
            <div style="display: flex; justify-content: space-between;">
              <span>Order #: <strong>#${receipt.receiptNumber || receipt.orderNumber || ''}</strong></span>
              <span>Pricing: <strong>${receipt.pricingMode || 'RETAIL'}</strong></span>
            </div>
            <div style="display: flex; justify-content: space-between;">
              <span>Date: ${new Date(receipt.date).toLocaleDateString()} ${new Date(receipt.date).toLocaleTimeString()}</span>
              <span>Cashier: <strong>${receipt.cashierName || 'Cashier'}</strong></span>
            </div>
            ${receipt.customerName ? `<div>Customer: <strong>${receipt.customerName}</strong></div>` : ''}
            ${receipt.branchName ? `<div>Branch: ${receipt.branchName}</div>` : ''}
          </div>

          <div class="divider"></div>

          <table>
            <thead>
              <tr>
                <th style="text-align: left;">Item</th>
                <th style="text-align: center; width: 35px;">Qty</th>
                <th style="text-align: right; width: 65px;">Price</th>
                <th style="text-align: right; width: 75px;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${itemsRows}
            </tbody>
          </table>

          <div class="divider"></div>

          <div style="font-size: 12px;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 3px; color: #334155;">
              <span>Subtotal:</span>
              <span style="font-weight: 600;">${formatAmount(receipt.subtotal, { fromCurrency: receiptCurrency, currency: receiptCurrency, convert: false })}</span>
            </div>
            ${
              receipt.discount > 0
                ? `
              <div style="display: flex; justify-content: space-between; margin-bottom: 3px; color: #16a34a;">
                <span>Discount:</span>
                <span style="font-weight: 600;">-${formatAmount(receipt.discount, { fromCurrency: receiptCurrency, currency: receiptCurrency, convert: false })}</span>
              </div>
            `
                : ''
            }
            <div class="divider-solid"></div>
            <div style="display: flex; justify-content: space-between; font-size: 16px; font-weight: 900; margin: 4px 0; color: #0f172a;">
              <span>TOTAL DUE:</span>
              <span>${formatAmount(receipt.total, { fromCurrency: receiptCurrency, currency: receiptCurrency, convert: false })}</span>
            </div>
            <div class="divider-solid"></div>
          </div>

          ${paymentsList ? `<div style="margin-bottom: 6px;">${paymentsList}</div>` : ''}

          <div class="center" style="margin-top: 14px;">
            <div style="font-size: 11px; color: #334155;">
              ${receipt.footer || 'Thank you for your patronage! Please retain receipt for your records.'}
            </div>
            <div style="font-size: 9px; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 6px;">
              ${receipt.platformAttribution || 'Powered by Stockora Enterprise Mini'}
            </div>
          </div>
        </body>
      </html>
    `;

    doc.open();
    doc.write(html);
    doc.close();

    iframe.contentWindow?.focus();
    setTimeout(() => {
      iframe.contentWindow?.print();
      setTimeout(() => {
        if (document.body.contains(iframe)) {
          document.body.removeChild(iframe);
        }
      }, 3000);
    }, 250);
  };

  const handleOpenRecentReceipts = async () => {
    try {
      const { data } = await apiClient.get('/orders', {
        params: { channel: 'POS', limit: 20 },
      });
      const orderList = Array.isArray(data) ? data : Array.isArray(data?.data) ? data.data : [];
      setRecentOrders(orderList);
      setReceiptHistoryModalOpen(true);
    } catch {
      toast.error('Failed to load recent sales history.');
    }
  };

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const fetchProducts = (query: string) => {
    startTransition(async () => {
      try {
        const { data } = await apiClient.get('/products', {
          params: { search: query },
        });
        const list: ProductItem[] = Array.isArray(data)
          ? data
          : Array.isArray((data as any)?.data)
            ? (data as any).data
            : [];

        if (query && query.trim() !== '') {
          const q = query.toLowerCase().trim();
          setProducts(
            list.filter(
              (p) =>
                p.name?.toLowerCase().includes(q) ||
                p.sku?.toLowerCase().includes(q) ||
                (p as any).barcode?.toLowerCase().includes(q) ||
                p.category?.toLowerCase().includes(q)
            )
          );
        } else {
          setProducts(list);
        }
      } catch {
        toast.error('Failed to load products.');
      }
    });
  };

  useEffect(() => {
    fetchProducts('');
  }, []);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchQuery(val);
    fetchProducts(val);
  };

  const handleSwitchGlobalTier = (newTier: 'RETAIL' | 'WHOLESALE') => {
    setActivePricingTier(newTier);
    if (cart.length > 0) {
      setCart((prev) =>
        prev.map((item) => {
          const newUnitPrice = newTier === 'WHOLESALE' ? item.wholesalePrice : item.retailPrice;
          return {
            ...item,
            priceTier: newTier,
            unitPrice: newUnitPrice,
            total: (newUnitPrice - item.discount) * item.quantity,
          };
        })
      );
      toast.success(`Switched active cart to ${newTier} pricing.`);
    }
  };

  const addToCart = (product: ProductItem) => {
    if (product.quantity <= 0) {
      toast.error(`${product.name} is out of stock.`);
      return;
    }

    const now = Date.now();
    const lockKey = `${product._id}-${activePricingTier}`;
    if (addingLockRef.current[lockKey] && now - addingLockRef.current[lockKey] < 280) {
      return; // Debounce rapid click multiplier (prevents x2, x3, x4 jump)
    }
    addingLockRef.current[lockKey] = now;

    const retPrice = Number(
      product.retailPrice && product.retailPrice > 0
        ? product.retailPrice
        : product.sellingPrice || 0
    );
    const whoPrice = Number(
      product.wholesalePrice && product.wholesalePrice > 0 ? product.wholesalePrice : retPrice
    );
    const chosenPrice = activePricingTier === 'WHOLESALE' ? whoPrice : retPrice;

    setCart((prev) => {
      const existingIndex = prev.findIndex(
        (i) => i.productId === product._id && i.priceTier === activePricingTier
      );
      if (existingIndex > -1) {
        const currentItem = prev[existingIndex];
        if (currentItem.quantity >= product.quantity) {
          toast.error(`Cannot exceed stock limit (${product.quantity}).`);
          return prev;
        }
        const updated = [...prev];
        const newQty = currentItem.quantity + 1;
        updated[existingIndex] = {
          ...currentItem,
          quantity: newQty,
          total: (currentItem.unitPrice - currentItem.discount) * newQty,
        };
        return updated;
      } else {
        return [
          ...prev,
          {
            productId: product._id,
            sku: product.sku,
            name: product.name,
            quantity: 1,
            priceTier: activePricingTier,
            retailPrice: retPrice,
            wholesalePrice: whoPrice,
            unitPrice: chosenPrice,
            discount: 0,
            total: chosenPrice,
            currency: product.currency || baseCurrency,
          },
        ];
      }
    });
  };

  const toggleItemTier = (productId: string, currentTier: 'RETAIL' | 'WHOLESALE') => {
    setCart((prev) =>
      prev.map((item) => {
        if (item.productId === productId && item.priceTier === currentTier) {
          const nextTier: 'RETAIL' | 'WHOLESALE' =
            currentTier === 'RETAIL' ? 'WHOLESALE' : 'RETAIL';
          const newUnitPrice = nextTier === 'WHOLESALE' ? item.wholesalePrice : item.retailPrice;
          return {
            ...item,
            priceTier: nextTier,
            unitPrice: newUnitPrice,
            total: (newUnitPrice - item.discount) * item.quantity,
          };
        }
        return item;
      })
    );
  };

  const updateQuantity = (productId: string, priceTier: 'RETAIL' | 'WHOLESALE', delta: number) => {
    setCart(
      (prev) =>
        prev
          .map((item) => {
            if (item.productId === productId && item.priceTier === priceTier) {
              const newQty = item.quantity + delta;
              if (newQty <= 0) return null;
              return {
                ...item,
                quantity: newQty,
                total: (item.unitPrice - item.discount) * newQty,
              };
            }
            return item;
          })
          .filter(Boolean) as CartItem[]
    );
  };

  const removeFromCart = (productId: string, priceTier: 'RETAIL' | 'WHOLESALE') => {
    setCart((prev) =>
      prev.filter((i) => !(i.productId === productId && i.priceTier === priceTier))
    );
  };

  // Calculations (in cart currency)
  const cartCurrency = cart.length > 0 ? cart[0].currency || baseCurrency : baseCurrency;
  const subtotal = cart.reduce((acc, i) => acc + i.unitPrice * i.quantity, 0);
  const totalItemDiscounts = cart.reduce((acc, i) => acc + i.discount * i.quantity, 0);
  const totalWholesaleSavings = cart.reduce((acc, i) => {
    if (i.priceTier === 'WHOLESALE' && i.retailPrice > i.wholesalePrice) {
      return acc + (i.retailPrice - i.wholesalePrice) * i.quantity;
    }
    return acc;
  }, 0);
  const taxableSubtotal = Math.max(0, subtotal - totalItemDiscounts - cartDiscount);
  const grandTotal = Number(taxableSubtotal.toFixed(2));

  const displayGrandTotal = convertAmount(grandTotal, cartCurrency, activeCurrency);

  const handleOpenCheckout = () => {
    if (cart.length === 0) {
      toast.error('Cart is empty.');
      return;
    }
    const currentTotal = Number(displayGrandTotal.toFixed(2));
    setSelectedTender('CASH');
    setCashTendered(currentTotal);
    setReferenceNo('');
    setCheckoutModalOpen(true);
  };

  const handleCompleteCheckout = async () => {
    const currentDisplayTotal = Number(
      convertAmount(grandTotal, cartCurrency, activeCurrency).toFixed(2)
    );
    if (
      selectedTender === 'CASH' &&
      Math.round(cashTendered * 100) < Math.round(currentDisplayTotal * 100)
    ) {
      toast.error(
        `Cash tendered (${formatAmount(cashTendered, { currency: activeCurrency, convert: false })}) is less than total due (${formatAmount(grandTotal, { fromCurrency: cartCurrency, currency: activeCurrency })}).`
      );
      return;
    }

    const amountTenderedInCart =
      selectedTender === 'CASH'
        ? convertAmount(cashTendered, activeCurrency, cartCurrency)
        : grandTotal;

    const checkoutPayload = {
      idempotencyKey: `POS-TX-${Date.now()}`,
      branchId: effectiveBranchId,
      warehouseId: effectiveWarehouseId,
      cashierId: effectiveCashierId,
      cashierName: effectiveCashierName,
      customerId: selectedCustomer?.id,
      customerName: selectedCustomer?.name,
      customerEmail: selectedCustomer?.email,
      pricingMode: activePricingTier,
      items: cart,
      paymentMethod: selectedTender,
      amountTendered: amountTenderedInCart,
      referenceNumber: referenceNo.trim() || undefined,
      payments: [
        {
          paymentMethod: selectedTender,
          amount: grandTotal,
          referenceNumber: referenceNo.trim() || undefined,
        },
      ],
      cartDiscount,
      taxRate: 0,
      currency: cartCurrency,
    };

    setIsSubmittingPayment(true);
    try {
      if (isOffline) {
        // Save to offline queue storage
        const queue = JSON.parse(localStorage.getItem('pos_offline_queue') || '[]');
        queue.push(checkoutPayload);
        localStorage.setItem('pos_offline_queue', JSON.stringify(queue));
        toast.success('Offline transaction saved locally! Will sync when connection resumes.');
      } else {
        const { data } = await apiClient.post('/pos/checkout', checkoutPayload);
        const resObj = data.data || data;
        const createdOrderNumber = resObj.orderNumber;
        toast.success(`Checkout Complete! Order #${createdOrderNumber}`);

        // Fetch & display receipt modal automatically
        await handleFetchReceipt(createdOrderNumber);
      }

      setCart([]);
      setCartDiscount(0);
      setSelectedCustomer(null);
      setCheckoutModalOpen(false);

      // Refresh product stock live on the cashier interface
      await fetchProducts(searchQuery);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Checkout failed.');
    } finally {
      setIsSubmittingPayment(false);
    }
  };

  const handleHoldCart = async () => {
    if (cart.length === 0) return;
    try {
      await apiClient.post('/pos/hold', {
        cashierId: effectiveCashierId,
        cashierName: effectiveCashierName,
        branchId: effectiveBranchId,
        cartItems: cart,
        customer: selectedCustomer,
      });
      toast.success('Cart parked successfully!');
      setCart([]);
    } catch {
      toast.error('Failed to park cart.');
    }
  };

  const handleFetchHeldSales = async () => {
    try {
      const { data } = await apiClient.get(`/pos/held/${effectiveBranchId}`);
      setHeldSales(data.data || []);
      setHeldModalOpen(true);
    } catch {
      toast.error('Failed to load held carts.');
    }
  };

  const handleResumeCart = async (holdId: string) => {
    try {
      const { data } = await apiClient.post(`/pos/resume/${holdId}`);
      setCart(data.data.cartItems || []);
      setHeldModalOpen(false);
      toast.success('Cart resumed!');
    } catch {
      toast.error('Failed to resume cart.');
    }
  };

  return (
    <Box sx={{ p: { xs: 0, sm: 1 }, pb: { xs: cart.length > 0 ? 10 : 2, md: 2 } }}>
      <PageHeader
        title="Point-of-Sale Terminal"
        subtitle="High-speed retail transaction cashier interface"
        action={
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
            <CurrencySelector size="small" />
            {isOffline && (
              <Chip
                icon={<WifiOffIcon />}
                label="Offline Mode Active"
                color="warning"
                size="small"
              />
            )}
            <Button
              variant="outlined"
              startIcon={<PauseCircleIcon />}
              onClick={handleHoldCart}
              disabled={cart.length === 0}
            >
              Hold Cart
            </Button>
            <Button
              variant="outlined"
              color="secondary"
              startIcon={<PlayCircleIcon />}
              onClick={handleFetchHeldSales}
            >
              Held Carts ({heldSales.length})
            </Button>
            <Button
              variant="outlined"
              color="info"
              startIcon={<ReceiptIcon />}
              onClick={handleOpenRecentReceipts}
            >
              Receipts & History
            </Button>
          </Box>
        }
      />

      {/* Mobile Catalog vs Cart Segmented Toggle */}
      <Box sx={{ display: { xs: 'flex', md: 'none' }, mb: 2, gap: 1 }}>
        <Button
          fullWidth
          variant={mobileView === 'catalog' ? 'contained' : 'outlined'}
          onClick={() => setMobileView('catalog')}
          sx={{ fontWeight: 700, py: 1 }}
        >
          Catalog ({products.length})
        </Button>
        <Button
          fullWidth
          variant={mobileView === 'cart' ? 'contained' : 'outlined'}
          color="primary"
          startIcon={<PointOfSaleIcon />}
          onClick={() => setMobileView('cart')}
          sx={{ fontWeight: 700, py: 1 }}
        >
          Cart ({cart.length}) • {formatAmount(grandTotal)}
        </Button>
      </Box>

      <Grid container spacing={3}>
        {/* Left: Product Grid */}
        <Grid
          item
          xs={12}
          md={7}
          sx={{ display: { xs: mobileView === 'catalog' ? 'block' : 'none', md: 'block' } }}
        >
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
              borderRadius: 2,
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
                sx={{ fontWeight: 700, px: 2, borderRadius: 1.5 }}
              >
                🏷️ Retail Customer
              </Button>
              <Button
                variant={activePricingTier === 'WHOLESALE' ? 'contained' : 'outlined'}
                color="secondary"
                size="small"
                onClick={() => handleSwitchGlobalTier('WHOLESALE')}
                sx={{ fontWeight: 700, px: 2, borderRadius: 1.5 }}
              >
                📦 Wholesale Customer
              </Button>
            </Box>
          </Paper>

          <Paper sx={{ p: 2, mb: 2, display: 'flex', alignItems: 'center' }}>
            <TextField
              fullWidth
              size="small"
              placeholder="Scan barcode or search product name / SKU..."
              value={searchQuery}
              onChange={handleSearchChange}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon color="action" />
                  </InputAdornment>
                ),
              }}
            />
          </Paper>

          {isPending ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
              <CircularProgress />
            </Box>
          ) : products.length === 0 ? (
            <Paper sx={{ p: 4, textAlign: 'center' }}>
              <Typography color="text.secondary">
                {searchQuery
                  ? `No products matching "${searchQuery}".`
                  : 'No products available in catalog.'}
              </Typography>
            </Paper>
          ) : (
            <Grid container spacing={2}>
              {products.map((p) => {
                const retailAmt = p.retailPrice ?? p.sellingPrice ?? 0;
                const wholesaleAmt = p.wholesalePrice != null ? p.wholesalePrice : retailAmt;
                const activeAmt = activePricingTier === 'WHOLESALE' ? wholesaleAmt : retailAmt;

                return (
                  <Grid item xs={12} sm={6} md={4} key={p._id}>
                    <Paper
                      elevation={0}
                      sx={{
                        p: 2,
                        cursor: p.quantity > 0 ? 'pointer' : 'not-allowed',
                        opacity: p.quantity > 0 ? 1 : 0.55,
                        borderRadius: '16px',
                        background:
                          'linear-gradient(145deg, rgba(20, 26, 44, 0.75) 0%, rgba(11, 15, 26, 0.9) 100%)',
                        border: '1px solid',
                        borderColor:
                          activePricingTier === 'WHOLESALE'
                            ? 'rgba(168, 85, 247, 0.35)'
                            : 'rgba(59, 130, 246, 0.35)',
                        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.3)',
                        transition: 'all 0.22s cubic-bezier(0.4, 0, 0.2, 1)',
                        userSelect: 'none',
                        '&:hover': {
                          transform: p.quantity > 0 ? 'translateY(-2px)' : 'none',
                          boxShadow:
                            p.quantity > 0
                              ? activePricingTier === 'WHOLESALE'
                                ? '0 10px 24px rgba(168, 85, 247, 0.25)'
                                : '0 10px 24px rgba(59, 130, 246, 0.25)'
                              : 'none',
                          borderColor:
                            activePricingTier === 'WHOLESALE'
                              ? 'rgba(168, 85, 247, 0.7)'
                              : 'rgba(59, 130, 246, 0.7)',
                        },
                        height: '100%',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                      }}
                      onClick={() => addToCart(p)}
                    >
                      <Box>
                        <Box
                          sx={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            mb: 0.5,
                          }}
                        >
                          <Typography
                            variant="caption"
                            sx={{
                              color: 'text.secondary',
                              fontWeight: 600,
                              letterSpacing: '0.02em',
                            }}
                          >
                            SKU: {p.sku}
                          </Typography>
                          <Chip
                            label={
                              p.quantity > 5
                                ? `${p.quantity} in stock`
                                : p.quantity > 0
                                  ? `Only ${p.quantity} left`
                                  : 'Out of Stock'
                            }
                            size="small"
                            color={
                              p.quantity > 5 ? 'success' : p.quantity > 0 ? 'warning' : 'error'
                            }
                            sx={{
                              fontSize: '0.68rem',
                              height: '20px',
                              fontWeight: 800,
                              borderRadius: '6px',
                            }}
                          />
                        </Box>
                        <Typography
                          variant="subtitle1"
                          sx={{ fontWeight: 800, lineHeight: 1.25, color: '#f8fafc' }}
                        >
                          {p.name}
                        </Typography>
                      </Box>
                      <Box sx={{ mt: 2 }}>
                        {/* Dual-price display */}
                        <Box
                          sx={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'baseline',
                            mb: 1.5,
                            p: 1.25,
                            borderRadius: '10px',
                            bgcolor: 'rgba(255, 255, 255, 0.03)',
                            border: '1px solid rgba(255, 255, 255, 0.06)',
                          }}
                        >
                          <Box>
                            <Typography
                              variant="caption"
                              sx={{
                                color:
                                  activePricingTier === 'RETAIL'
                                    ? 'primary.main'
                                    : 'text.secondary',
                                display: 'block',
                                fontSize: '0.7rem',
                                fontWeight: activePricingTier === 'RETAIL' ? 800 : 500,
                              }}
                            >
                              Retail {activePricingTier === 'RETAIL' ? '✓' : ''}
                            </Typography>
                            <Typography
                              variant="subtitle2"
                              sx={{
                                fontWeight: activePricingTier === 'RETAIL' ? 900 : 600,
                                color:
                                  activePricingTier === 'RETAIL'
                                    ? 'primary.main'
                                    : 'text.secondary',
                              }}
                            >
                              {formatAmount(retailAmt, {
                                fromCurrency: p.currency || baseCurrency,
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
                                fontWeight: activePricingTier === 'WHOLESALE' ? 800 : 500,
                              }}
                            >
                              Wholesale {activePricingTier === 'WHOLESALE' ? '✓' : ''}
                            </Typography>
                            <Typography
                              variant="subtitle2"
                              sx={{
                                fontWeight: activePricingTier === 'WHOLESALE' ? 900 : 600,
                                color:
                                  activePricingTier === 'WHOLESALE'
                                    ? 'secondary.main'
                                    : 'text.secondary',
                              }}
                            >
                              {formatAmount(wholesaleAmt, {
                                fromCurrency: p.currency || baseCurrency,
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
                            label={`+ Add ${activePricingTier === 'WHOLESALE' ? 'Wholesale' : 'Retail'} (${formatAmount(
                              activeAmt,
                              {
                                fromCurrency: p.currency || baseCurrency,
                                currency: activeCurrency,
                              }
                            )})`}
                            size="small"
                            color={activePricingTier === 'WHOLESALE' ? 'secondary' : 'primary'}
                            sx={{
                              fontSize: '0.72rem',
                              height: '24px',
                              fontWeight: 800,
                              borderRadius: '8px',
                            }}
                          />
                        </Box>
                      </Box>
                    </Paper>
                  </Grid>
                );
              })}
            </Grid>
          )}
        </Grid>

        {/* Right: Active Cart */}
        <Grid
          item
          xs={12}
          md={5}
          sx={{ display: { xs: mobileView === 'cart' ? 'block' : 'none', md: 'block' } }}
        >
          <Paper sx={{ p: 2, height: '100%', display: 'flex', flexDirection: 'column' }}>
            <Box
              sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}
            >
              <Typography
                variant="h6"
                sx={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 1 }}
              >
                <PointOfSaleIcon color="primary" /> Current Cart ({cart.length})
              </Typography>
              <Chip
                icon={<PersonIcon />}
                label={selectedCustomer ? selectedCustomer.name : 'Walk-in Customer'}
                color="info"
                variant="outlined"
                size="small"
              />
            </Box>

            <Divider sx={{ mb: 2 }} />

            <Box sx={{ flexGrow: 1, overflowY: 'auto', maxHeight: '420px', mb: 2 }}>
              {cart.length === 0 ? (
                <Typography color="text.secondary" align="center" sx={{ py: 6 }}>
                  No items in cart. Click products to add.
                </Typography>
              ) : (
                <List disablePadding>
                  {cart.map((item) => (
                    <ListItem
                      key={`${item.productId}-${item.priceTier}`}
                      sx={{
                        px: 1,
                        py: 1,
                        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <ListItemText
                        disableTypography
                        primary={
                          <Box
                            sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}
                          >
                            <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                              {item.name}
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
                            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                              {formatAmount(item.unitPrice, {
                                fromCurrency: item.currency || baseCurrency,
                                currency: activeCurrency,
                              })}{' '}
                              × {item.quantity}
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
                          </Box>
                        }
                      />
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <IconButton
                          size="small"
                          onClick={() => updateQuantity(item.productId, item.priceTier, -1)}
                        >
                          <RemoveIcon fontSize="small" />
                        </IconButton>
                        <Typography
                          sx={{ fontWeight: 'bold', minWidth: '20px', textAlign: 'center' }}
                        >
                          {item.quantity}
                        </Typography>
                        <IconButton
                          size="small"
                          onClick={() => updateQuantity(item.productId, item.priceTier, 1)}
                        >
                          <AddIcon fontSize="small" />
                        </IconButton>
                        <Typography sx={{ fontWeight: 'bold', width: '80px', textAlign: 'right' }}>
                          {formatAmount(item.total, {
                            fromCurrency: item.currency || cartCurrency,
                            currency: activeCurrency,
                          })}
                        </Typography>
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => removeFromCart(item.productId, item.priceTier)}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Box>
                    </ListItem>
                  ))}
                </List>
              )}
            </Box>

            <Divider sx={{ mb: 2 }} />

            {/* Calculations Summary */}
            <Box sx={{ mb: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                <Typography color="text.secondary">Subtotal</Typography>
                <Typography>
                  {formatAmount(subtotal, { fromCurrency: cartCurrency, currency: activeCurrency })}
                </Typography>
              </Box>
              {totalWholesaleSavings > 0 && (
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                  <Typography sx={{ color: 'success.main', fontWeight: 600 }}>
                    Wholesale Savings
                  </Typography>
                  <Typography sx={{ color: 'success.main', fontWeight: 700 }}>
                    -
                    {formatAmount(totalWholesaleSavings, {
                      fromCurrency: cartCurrency,
                      currency: activeCurrency,
                    })}
                  </Typography>
                </Box>
              )}
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                <Typography color="text.secondary">Discounts</Typography>
                <Typography color="error">
                  -
                  {formatAmount(totalItemDiscounts + cartDiscount, {
                    fromCurrency: cartCurrency,
                    currency: activeCurrency,
                  })}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1 }}>
                <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                  Total Due
                </Typography>
                <Typography variant="h5" color="primary.main" sx={{ fontWeight: 'bold' }}>
                  {formatAmount(grandTotal, {
                    fromCurrency: cartCurrency,
                    currency: activeCurrency,
                  })}
                </Typography>
              </Box>
            </Box>

            <Button
              variant="contained"
              color="primary"
              size="large"
              fullWidth
              disabled={cart.length === 0}
              onClick={handleOpenCheckout}
              sx={{ py: 1.5, fontSize: '1.1rem', fontWeight: 'bold' }}
            >
              Pay{' '}
              {formatAmount(grandTotal, { fromCurrency: cartCurrency, currency: activeCurrency })}
            </Button>
          </Paper>
        </Grid>
      </Grid>

      {/* Mobile Sticky Bottom Summary Bar */}
      {cart.length > 0 && mobileView === 'catalog' && (
        <Paper
          elevation={8}
          sx={{
            display: { xs: 'flex', md: 'none' },
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            zIndex: 1000,
            p: 1.5,
            px: 2,
            bgcolor: '#0f131f',
            borderTop: '1px solid rgba(139, 92, 246, 0.3)',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: '0 -4px 20px rgba(0,0,0,0.6)',
          }}
        >
          <Box>
            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
              {cart.length} item{cart.length > 1 ? 's' : ''} in cart
            </Typography>
            <Typography variant="subtitle1" sx={{ fontWeight: 800, color: 'primary.light' }}>
              {formatAmount(grandTotal, { fromCurrency: cartCurrency, currency: activeCurrency })}
            </Typography>
          </Box>
          <Button
            variant="contained"
            color="primary"
            onClick={() => setMobileView('cart')}
            sx={{ fontWeight: 700, px: 2.5 }}
          >
            Review Cart & Pay
          </Button>
        </Paper>
      )}

      {/* Checkout Split Payment Modal */}
      <Dialog
        open={checkoutModalOpen}
        onClose={() => setCheckoutModalOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            maxWidth: '520px !important',
            width: '100%',
            borderRadius: '20px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
            p: { xs: 1.5, sm: 2 },
            m: { xs: 1.5, sm: 3 },
          },
        }}
      >
        <DialogTitle component="div" sx={{ fontWeight: 'bold', textAlign: 'center' }}>
          POS Tender Confirmation
        </DialogTitle>
        <DialogContent dividers>
          <Box sx={{ display: 'flex', justifyContent: 'center', mb: 1.5 }}>
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
          <Typography
            variant="h4"
            color="success.main"
            align="center"
            sx={{ mb: 2, fontWeight: 'bold' }}
          >
            {formatAmount(grandTotal, { fromCurrency: cartCurrency, currency: activeCurrency })}
          </Typography>

          {/* Tender Selector */}
          <Typography
            variant="caption"
            sx={{ fontWeight: 800, color: 'text.secondary', display: 'block', mb: 1 }}
          >
            SELECT TENDER METHOD
          </Typography>
          <Grid container spacing={1.5} sx={{ mb: 2.5 }}>
            <Grid item xs={4}>
              <Paper
                onClick={() => setSelectedTender('CASH')}
                sx={{
                  p: 1.5,
                  textAlign: 'center',
                  cursor: 'pointer',
                  borderRadius: '12px',
                  border:
                    selectedTender === 'CASH'
                      ? '2px solid #10b981'
                      : '1px solid rgba(255,255,255,0.1)',
                  bgcolor:
                    selectedTender === 'CASH'
                      ? 'rgba(16, 185, 129, 0.12)'
                      : 'rgba(255,255,255,0.02)',
                  color: selectedTender === 'CASH' ? '#34d399' : 'inherit',
                  transition: 'all 0.2s',
                  userSelect: 'none',
                }}
              >
                <PaymentsIcon sx={{ fontSize: 26, mb: 0.5 }} />
                <Typography variant="body2" sx={{ fontWeight: 800 }}>
                  Cash
                </Typography>
              </Paper>
            </Grid>
            <Grid item xs={4}>
              <Paper
                onClick={() => setSelectedTender('CARD')}
                sx={{
                  p: 1.5,
                  textAlign: 'center',
                  cursor: 'pointer',
                  borderRadius: '12px',
                  border:
                    selectedTender === 'CARD'
                      ? '2px solid #3b82f6'
                      : '1px solid rgba(255,255,255,0.1)',
                  bgcolor:
                    selectedTender === 'CARD'
                      ? 'rgba(59, 130, 246, 0.12)'
                      : 'rgba(255,255,255,0.02)',
                  color: selectedTender === 'CARD' ? '#60a5fa' : 'inherit',
                  transition: 'all 0.2s',
                  userSelect: 'none',
                }}
              >
                <CreditCardIcon sx={{ fontSize: 26, mb: 0.5 }} />
                <Typography variant="body2" sx={{ fontWeight: 800 }}>
                  Card POS
                </Typography>
              </Paper>
            </Grid>
            <Grid item xs={4}>
              <Paper
                onClick={() => setSelectedTender('BANK_TRANSFER')}
                sx={{
                  p: 1.5,
                  textAlign: 'center',
                  cursor: 'pointer',
                  borderRadius: '12px',
                  border:
                    selectedTender === 'BANK_TRANSFER'
                      ? '2px solid #a855f7'
                      : '1px solid rgba(255,255,255,0.1)',
                  bgcolor:
                    selectedTender === 'BANK_TRANSFER'
                      ? 'rgba(168, 85, 247, 0.12)'
                      : 'rgba(255,255,255,0.02)',
                  color: selectedTender === 'BANK_TRANSFER' ? '#c084fc' : 'inherit',
                  transition: 'all 0.2s',
                  userSelect: 'none',
                }}
              >
                <AccountBalanceIcon sx={{ fontSize: 26, mb: 0.5 }} />
                <Typography variant="body2" sx={{ fontWeight: 800 }}>
                  Transfer
                </Typography>
              </Paper>
            </Grid>
          </Grid>

          {selectedTender === 'CASH' && (
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 1.5 }}>
                  <Chip
                    label={`Exact (${formatAmount(displayGrandTotal, { currency: activeCurrency, convert: false })})`}
                    size="small"
                    onClick={() => setCashTendered(Number(displayGrandTotal.toFixed(2)))}
                    clickable
                    color="primary"
                    variant="outlined"
                    sx={{ fontWeight: 700 }}
                  />
                  <Chip
                    label="Round Up 1k"
                    size="small"
                    onClick={() => setCashTendered(Math.ceil(displayGrandTotal / 1000) * 1000)}
                    clickable
                    variant="outlined"
                    sx={{ fontWeight: 700 }}
                  />
                  <Chip
                    label="Round Up 5k"
                    size="small"
                    onClick={() => setCashTendered(Math.ceil(displayGrandTotal / 5000) * 5000)}
                    clickable
                    variant="outlined"
                    sx={{ fontWeight: 700 }}
                  />
                </Box>
                <TextField
                  label={`Cash Received (${currencySymbol})`}
                  type="number"
                  fullWidth
                  value={cashTendered || ''}
                  onChange={(e) => setCashTendered(Number(e.target.value))}
                />
              </Grid>
              <Grid item xs={12}>
                <Paper
                  sx={{
                    p: 1.5,
                    bgcolor:
                      cashTendered >= displayGrandTotal
                        ? 'rgba(46, 125, 50, 0.08)'
                        : 'rgba(211, 47, 47, 0.08)',
                    display: 'flex',
                    justifyContent: 'space-between',
                  }}
                >
                  <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                    Change to Return:
                  </Typography>
                  <Typography
                    variant="body1"
                    sx={{
                      fontWeight: 'bold',
                      color: cashTendered >= displayGrandTotal ? 'success.main' : 'error.main',
                    }}
                  >
                    {formatAmount(Math.max(0, cashTendered - displayGrandTotal), {
                      currency: activeCurrency,
                      convert: false,
                    })}
                  </Typography>
                </Paper>
              </Grid>
            </Grid>
          )}

          {selectedTender === 'CARD' && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Typography variant="body2" color="text.secondary">
                💳 Process payment on physical card reader. Enter authorization or receipt reference
                below:
              </Typography>
              <TextField
                label="Card Terminal RRN / Auth Code"
                fullWidth
                size="small"
                value={referenceNo}
                onChange={(e) => setReferenceNo(e.target.value)}
                placeholder="e.g. RRN-104928"
              />
            </Box>
          )}

          {selectedTender === 'BANK_TRANSFER' && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Typography variant="body2" color="text.secondary">
                🏦 Confirm that incoming bank/mobile transfer of {formatAmount(grandTotal)} is
                verified.
              </Typography>
              <TextField
                label="Transfer Reference / Session ID"
                fullWidth
                size="small"
                value={referenceNo}
                onChange={(e) => setReferenceNo(e.target.value)}
                placeholder="e.g. TRF-98234"
              />
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setCheckoutModalOpen(false)} disabled={isSubmittingPayment}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color="success"
            onClick={handleCompleteCheckout}
            disabled={
              isSubmittingPayment ||
              (selectedTender === 'CASH' &&
                Math.round((cashTendered || 0) * 100) < Math.round(displayGrandTotal * 100))
            }
            startIcon={isSubmittingPayment ? <CircularProgress size={18} color="inherit" /> : null}
            sx={{ fontWeight: 800, px: 3 }}
          >
            {isSubmittingPayment ? 'Processing Payment...' : 'Confirm & Print Receipt'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Held Sales Dialog */}
      <Dialog
        open={heldModalOpen}
        onClose={() => setHeldModalOpen(false)}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            maxWidth: '680px !important',
            width: '100%',
            borderRadius: '20px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.75)',
            p: { xs: 1, sm: 2 },
            m: { xs: 1.5, sm: 3 },
          },
        }}
      >
        <DialogTitle component="div" sx={{ fontWeight: 'bold' }}>
          Parked & Held Carts
        </DialogTitle>
        <DialogContent dividers sx={{ p: { xs: 1, sm: 2 } }}>
          <Box sx={{ overflowX: 'auto', width: '100%' }}>
            <Table size="small" sx={{ minWidth: 550 }}>
              <TableHead>
                <TableRow>
                  <TableCell>Hold ID</TableCell>
                  <TableCell>Cashier</TableCell>
                  <TableCell>Customer</TableCell>
                  <TableCell>Items</TableCell>
                  <TableCell>Subtotal</TableCell>
                  <TableCell align="right">Action</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {heldSales.map((h) => (
                  <TableRow key={h.holdId}>
                    <TableCell>{h.holdId}</TableCell>
                    <TableCell>{h.cashierName}</TableCell>
                    <TableCell>{h.customerName || 'Walk-in'}</TableCell>
                    <TableCell>{h.cartItems.length} line items</TableCell>
                    <TableCell>{formatAmount(h.subtotal)}</TableCell>
                    <TableCell align="right">
                      <Button
                        size="small"
                        variant="contained"
                        onClick={() => handleResumeCart(h.holdId)}
                      >
                        Resume
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setHeldModalOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Receipts History & Lookup Dialog */}
      <Dialog
        open={receiptHistoryModalOpen}
        onClose={() => setReceiptHistoryModalOpen(false)}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            maxWidth: '720px !important',
            width: '100%',
            borderRadius: '20px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.75)',
            p: { xs: 1, sm: 2 },
            m: { xs: 1.5, sm: 3 },
          },
        }}
      >
        <DialogTitle component="div" sx={{ fontWeight: 'bold' }}>
          <ReceiptIcon color="primary" sx={{ verticalAlign: 'middle', mr: 1 }} />
          Recent Receipts & Invoice Lookup
        </DialogTitle>
        <DialogContent dividers>
          <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
            <TextField
              size="small"
              fullWidth
              placeholder="Enter Order # (e.g. POS-2026-000001)"
              value={lookupOrderNumber}
              onChange={(e) => setLookupOrderNumber(e.target.value)}
            />
            <Button
              variant="contained"
              disabled={!lookupOrderNumber.trim()}
              onClick={() => handleFetchReceipt(lookupOrderNumber.trim())}
            >
              Lookup
            </Button>
          </Box>

          <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1 }}>
            Recent POS Transactions
          </Typography>
          <Box sx={{ overflowX: 'auto', width: '100%' }}>
            <Table size="small" sx={{ minWidth: 550 }}>
              <TableHead>
                <TableRow>
                  <TableCell>Order Number</TableCell>
                  <TableCell>Customer</TableCell>
                  <TableCell>Total Amount</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right">Action</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {recentOrders.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} align="center">
                      No recent POS orders found.
                    </TableCell>
                  </TableRow>
                ) : (
                  recentOrders.map((o) => (
                    <TableRow key={o.orderNumber}>
                      <TableCell sx={{ fontWeight: 'bold' }}>{o.orderNumber}</TableCell>
                      <TableCell>{o.customerName || 'Walk-in'}</TableCell>
                      <TableCell>{formatAmount(o.grandTotal || 0)}</TableCell>
                      <TableCell>
                        <Chip label={o.status || 'COMPLETED'} color="success" size="small" />
                      </TableCell>
                      <TableCell align="right">
                        <Button
                          size="small"
                          variant="outlined"
                          startIcon={<ReceiptIcon />}
                          onClick={() => handleFetchReceipt(o.orderNumber)}
                        >
                          View & Print Receipt
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setReceiptHistoryModalOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Digital Receipt Viewer Dialog & Bulletproof Print Engine */}
      {receiptData && (
        <Dialog
          open={Boolean(receiptData)}
          onClose={() => setReceiptData(null)}
          maxWidth="xs"
          fullWidth
          PaperProps={{
            sx: {
              maxWidth: '460px !important',
              width: '100%',
              borderRadius: '20px',
              bgcolor: '#090d16',
              color: '#f8fafc',
              border: '1px solid rgba(16, 185, 129, 0.25)',
              boxShadow: '0 25px 60px -12px rgba(0, 0, 0, 0.85)',
              p: { xs: 1.5, sm: 2 },
              m: { xs: 1.5, sm: 3 },
            },
          }}
        >
          {/* Print specific CSS fallback to prevent clipping */}
          <style>{`
            @media print {
              @page {
                margin: 4mm 6mm;
                size: auto;
              }
              html, body {
                margin: 0 !important;
                padding: 0 !important;
                background: #ffffff !important;
                color: #000000 !important;
                height: auto !important;
                overflow: visible !important;
              }
              body * {
                visibility: hidden !important;
              }
              #printable-pos-receipt, #printable-pos-receipt * {
                visibility: visible !important;
              }
              #printable-pos-receipt {
                position: absolute !important;
                left: 0 !important;
                top: 0 !important;
                width: 100% !important;
                max-width: 380px !important;
                margin: 0 auto !important;
                padding: 12px !important;
                background: #ffffff !important;
                color: #000000 !important;
                box-shadow: none !important;
                border: none !important;
                display: block !important;
                overflow: visible !important;
                height: auto !important;
              }
              .MuiDialog-root, .MuiDialog-container, .MuiDialog-paper, .MuiDialogContent-root {
                position: static !important;
                overflow: visible !important;
                max-height: none !important;
                height: auto !important;
                width: 100% !important;
                max-width: none !important;
                margin: 0 !important;
                padding: 0 !important;
                background: transparent !important;
                box-shadow: none !important;
                border: none !important;
              }
              .MuiBackdrop-root, .MuiDialogTitle-root, .MuiDialogActions-root, .no-print {
                display: none !important;
              }
            }
          `}</style>

          <Box id="printable-pos-receipt">
            <DialogTitle
              component="div"
              sx={{ textAlign: 'center', fontWeight: 'bold', pb: 1, pt: 1 }}
            >
              {receiptData.logoUrl ? (
                <Box
                  component="img"
                  src={receiptData.logoUrl}
                  alt={receiptData.businessName}
                  sx={{
                    maxHeight: 44,
                    maxWidth: 150,
                    mx: 'auto',
                    mb: 1,
                    display: 'block',
                    objectFit: 'contain',
                  }}
                />
              ) : (
                <ReceiptIcon sx={{ color: '#10b981', fontSize: 36, mb: 0.5 }} />
              )}
              <Typography
                variant="h6"
                component="div"
                sx={{
                  fontWeight: 900,
                  textTransform: 'uppercase',
                  letterSpacing: '0.02em',
                  color: '#f8fafc',
                  fontFamily: 'Space Grotesk, sans-serif',
                }}
              >
                {receiptData.businessName || receiptData.storeName || 'TRUSON'}
              </Typography>
              {receiptData.legalName && receiptData.legalName !== receiptData.businessName && (
                <Typography variant="caption" component="div" color="text.secondary">
                  {receiptData.legalName}
                </Typography>
              )}
            </DialogTitle>
            <DialogContent
              dividers
              sx={{
                fontFamily: 'Plus Jakarta Sans, monospace, sans-serif',
                fontSize: '0.9rem',
                borderColor: 'rgba(255, 255, 255, 0.08)',
                px: { xs: 2, sm: 3 },
                maxHeight: { xs: '65vh', sm: '70vh' },
              }}
            >
              <Box sx={{ maxWidth: '400px', mx: 'auto' }}>
                {receiptData.address &&
                  receiptData.address.trim().toUpperCase() !== 'US' &&
                  receiptData.address.trim().toUpperCase() !== 'USA' && (
                    <Typography
                      align="center"
                      variant="caption"
                      display="block"
                      color="text.secondary"
                    >
                      {receiptData.address}
                    </Typography>
                  )}
                {(receiptData.phone || receiptData.email) && (
                  <Typography
                    align="center"
                    variant="caption"
                    display="block"
                    color="text.secondary"
                  >
                    {[
                      receiptData.phone ? `Tel: ${receiptData.phone}` : '',
                      receiptData.email ? `Email: ${receiptData.email}` : '',
                    ]
                      .filter(Boolean)
                      .join(' • ')}
                  </Typography>
                )}
                {receiptData.headerNotice && (
                  <Typography
                    align="center"
                    variant="caption"
                    display="block"
                    sx={{ fontStyle: 'italic', my: 0.5, color: 'text.secondary' }}
                  >
                    {receiptData.headerNotice}
                  </Typography>
                )}
                <Box
                  sx={{
                    mt: 1.5,
                    p: 1,
                    borderRadius: '8px',
                    bgcolor: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid rgba(255, 255, 255, 0.06)',
                  }}
                >
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.25 }}>
                    <Typography variant="caption" sx={{ fontWeight: 700, color: '#34d399' }}>
                      Order: #{receiptData.receiptNumber || receiptData.orderNumber}
                    </Typography>
                    <Typography
                      variant="caption"
                      sx={{
                        fontWeight: 800,
                        px: 0.75,
                        py: 0.1,
                        borderRadius: '4px',
                        bgcolor: 'rgba(16, 185, 129, 0.15)',
                        color: '#10b981',
                      }}
                    >
                      {receiptData.pricingMode || 'RETAIL'}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="caption" color="text.secondary">
                      Date: {new Date(receiptData.date).toLocaleDateString()}{' '}
                      {new Date(receiptData.date).toLocaleTimeString()}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Cashier: {receiptData.cashierName || 'Cashier'}
                    </Typography>
                  </Box>
                  {receiptData.customerName && (
                    <Typography variant="caption" display="block" color="text.secondary">
                      Customer: {receiptData.customerName}
                    </Typography>
                  )}
                </Box>

                <Divider sx={{ my: 1.5, borderColor: 'rgba(255, 255, 255, 0.08)' }} />

                {/* Line Items Table */}
                {receiptData.items?.map((i: any, idx: number) => {
                  const itemCurr = (i.currency || receiptData.currency || 'NGN')
                    .toUpperCase()
                    .trim();
                  const recCurr = (receiptData.currency || 'NGN').toUpperCase().trim();
                  return (
                    <Box
                      key={idx}
                      sx={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        mb: 1,
                        alignItems: 'flex-start',
                      }}
                    >
                      <Box sx={{ pr: 1 }}>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {i.name || i.productName}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {i.qty || i.quantity} ×{' '}
                          {formatAmount(i.price ?? i.unitPrice ?? 0, {
                            fromCurrency: itemCurr,
                            currency: itemCurr,
                            convert: false,
                          })}{' '}
                          •{' '}
                          <span style={{ color: '#34d399' }}>
                            {i.priceTier || receiptData.pricingMode || 'RETAIL'}
                          </span>
                        </Typography>
                      </Box>
                      <Typography
                        variant="body2"
                        sx={{ fontWeight: 700, color: '#f8fafc', whiteSpace: 'nowrap' }}
                      >
                        {formatAmount(i.total, {
                          fromCurrency: recCurr,
                          currency: recCurr,
                          convert: false,
                        })}
                      </Typography>
                    </Box>
                  );
                })}

                <Divider sx={{ my: 1.5, borderColor: 'rgba(255, 255, 255, 0.08)' }} />

                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                  <Typography variant="body2" color="text.secondary">
                    Subtotal:
                  </Typography>
                  <Typography variant="body2">
                    {formatAmount(receiptData.subtotal, {
                      fromCurrency: (receiptData.currency || 'NGN').toUpperCase().trim(),
                      currency: (receiptData.currency || 'NGN').toUpperCase().trim(),
                      convert: false,
                    })}
                  </Typography>
                </Box>
                {receiptData.discount > 0 && (
                  <Box
                    sx={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      mb: 0.5,
                      color: '#34d399',
                    }}
                  >
                    <Typography variant="body2">Discount:</Typography>
                    <Typography variant="body2">
                      -
                      {formatAmount(receiptData.discount, {
                        fromCurrency: (receiptData.currency || 'NGN').toUpperCase().trim(),
                        currency: (receiptData.currency || 'NGN').toUpperCase().trim(),
                        convert: false,
                      })}
                    </Typography>
                  </Box>
                )}
                <Box
                  sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'baseline',
                    mt: 1.5,
                    pt: 1,
                    borderTop: '1px solid rgba(255, 255, 255, 0.1)',
                  }}
                >
                  <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                    TOTAL:
                  </Typography>
                  <Typography variant="h5" sx={{ fontWeight: 900, color: '#10b981' }}>
                    {formatAmount(receiptData.total, {
                      fromCurrency: (receiptData.currency || 'NGN').toUpperCase().trim(),
                      currency: (receiptData.currency || 'NGN').toUpperCase().trim(),
                      convert: false,
                    })}
                  </Typography>
                </Box>

                {/* Tender Breakdown */}
                {receiptData.payments?.map((p: any, pIdx: number) => (
                  <Box
                    key={pIdx}
                    sx={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      mt: 0.5,
                      fontSize: '0.75rem',
                      color: 'text.secondary',
                    }}
                  >
                    <span>Tender ({p.method || 'CASH'}):</span>
                    <span>
                      {formatAmount(p.amount, {
                        fromCurrency: (receiptData.currency || 'NGN').toUpperCase().trim(),
                        currency: (receiptData.currency || 'NGN').toUpperCase().trim(),
                        convert: false,
                      })}
                    </span>
                  </Box>
                ))}

                <Divider sx={{ my: 1.5, borderColor: 'rgba(255, 255, 255, 0.08)' }} />
                <Typography align="center" variant="caption" display="block" color="text.secondary">
                  {receiptData.footer || 'Thank you for your business!'}
                </Typography>
                <Typography
                  align="center"
                  variant="caption"
                  display="block"
                  sx={{
                    mt: 1,
                    fontSize: '0.625rem',
                    letterSpacing: 0.5,
                    textTransform: 'uppercase',
                    color: '#34d399',
                    fontWeight: 700,
                  }}
                >
                  {receiptData.platformAttribution || 'Powered by Stockora Enterprise Mini'}
                </Typography>
              </Box>
            </DialogContent>
          </Box>

          <DialogActions
            sx={{ px: { xs: 2, sm: 3 }, py: 1.5, borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}
          >
            <Button onClick={() => setReceiptData(null)} sx={{ color: 'text.secondary' }}>
              Close
            </Button>
            <Button
              variant="contained"
              onClick={() => printPosReceipt(receiptData)}
              startIcon={<ReceiptIcon />}
              sx={{
                fontWeight: 800,
                borderRadius: '8px',
                px: 2.5,
                bgcolor: '#10b981',
                '&:hover': { bgcolor: '#059669' },
              }}
            >
              Print Receipt
            </Button>
          </DialogActions>
        </Dialog>
      )}
    </Box>
  );
}
