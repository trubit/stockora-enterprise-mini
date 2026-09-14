import { useState, useEffect, useRef } from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  TextField,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Card,
  CardContent,
  MenuItem,
} from '@mui/material';
import PointOfSaleIcon from '@mui/icons-material/PointOfSale';
import SearchIcon from '@mui/icons-material/Search';
import QrCodeScannerIcon from '@mui/icons-material/QrCodeScanner';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
import PaymentsIcon from '@mui/icons-material/Payments';
import PauseCircleIcon from '@mui/icons-material/PauseCircle';
import { api } from '../../api/client.ts';
import { toast } from 'react-hot-toast';
import { useRegionalSettings } from '../../hooks/useRegionalSettings.js';
import { CurrencySelector } from '../../components/CurrencySelector.tsx';

export default function POSTerminalConsole() {
  const { formatAmount, currencySymbol, baseCurrency, activeCurrency, convertAmount } =
    useRegionalSettings();
  const [products, setProducts] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [cart, setCart] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [discountTotal] = useState(0);

  const [openPaymentModal, setOpenPaymentModal] = useState(false);
  const [openReceiptModal, setOpenReceiptModal] = useState(false);
  const [lastReceipt, setLastReceipt] = useState<any>(null);

  const [paymentSplit, setPaymentSplit] = useState({
    cashAmount: 0,
    cardAmount: 0,
    paymentMethod: 'CASH',
  });

  const searchInputRef = useRef<HTMLInputElement>(null);

  const fetchData = async () => {
    try {
      const [prodRes, custRes] = await Promise.all([api.get('/products'), api.get('/customers')]);
      setProducts(prodRes.data?.data || prodRes.data || []);
      setCustomers(custRes.data?.data || custRes.data || []);
    } catch {
      toast.error('Failed to load POS catalog data.');
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const subtotal = cart.reduce(
    (sum, item) => sum + (item.lineTotal || item.quantity * item.unitPrice),
    0
  );
  const grandTotal = Math.max(0, subtotal - discountTotal);

  // Keyboard Navigation Shortcuts (F2: Focus Search, F4: Hold Sale, F8: Checkout, Esc: Clear)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F2') {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (e.key === 'F4') {
        e.preventDefault();
        handleHoldSale();
      } else if (e.key === 'F8') {
        e.preventDefault();
        if (cart.length > 0) {
          const displayGrandTotal = convertAmount(grandTotal, baseCurrency, activeCurrency);
          setPaymentSplit({
            cashAmount: Number(displayGrandTotal.toFixed(2)),
            cardAmount: 0,
            paymentMethod: 'CASH',
          });
          setOpenPaymentModal(true);
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setCart([]);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cart, grandTotal, baseCurrency, activeCurrency, convertAmount]);

  const handleScanOrSearch = async (query: string) => {
    setSearchQuery(query);
    if (!query.trim()) return;
    try {
      const res = await api.get(`/pos-advanced/scan/${encodeURIComponent(query.trim())}`);
      if (res.data?.product) {
        addToCart(res.data.product);
        setSearchQuery('');
      }
    } catch {
      // Soft search fallback handled by grid filtering
    }
  };

  const addToCart = (product: any) => {
    if ((product.quantity || 0) <= 0) {
      toast.error('Item is out of stock.');
      return;
    }
    setCart((prev) => {
      const existing = prev.find((item) => item.productId === product._id);
      if (existing) {
        if (existing.quantity >= (product.quantity || 999)) {
          toast.error('Cannot add more than available stock.');
          return prev;
        }
        return prev.map((item) =>
          item.productId === product._id
            ? {
                ...item,
                quantity: item.quantity + 1,
                lineTotal: (item.quantity + 1) * item.unitPrice,
              }
            : item
        );
      }
      return [
        ...prev,
        {
          productId: product._id,
          sku: product.sku,
          name: product.name,
          quantity: 1,
          unitPrice: product.price || 10,
          discountAmount: 0,
          lineTotal: product.price || 10,
        },
      ];
    });
  };

  const updateQuantity = (productId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.productId === productId) {
            const newQty = item.quantity + delta;
            if (newQty <= 0) return null;
            return { ...item, quantity: newQty, lineTotal: newQty * item.unitPrice };
          }
          return item;
        })
        .filter(Boolean)
    );
  };

  const removeFromCart = (productId: string) => {
    setCart((prev) => prev.filter((item) => item.productId !== productId));
  };

  const handleHoldSale = async () => {
    if (cart.length === 0) {
      toast.error('Cart is empty. Nothing to hold.');
      return;
    }
    try {
      await api.post('/pos-advanced/hold', {
        branchId: '60c72b2f9b1d8b0015b8b8b8',
        cartItems: cart,
        customerId: selectedCustomerId || undefined,
      });
      toast.success('Sale held successfully!');
      setCart([]);
    } catch {
      toast.error('Failed to hold sale.');
    }
  };

  const handleOpenPayment = () => {
    if (cart.length === 0) return;
    const displayGrandTotal = convertAmount(grandTotal, baseCurrency, activeCurrency);
    setPaymentSplit({
      cashAmount: Number(displayGrandTotal.toFixed(2)),
      cardAmount: 0,
      paymentMethod: 'CASH',
    });
    setOpenPaymentModal(true);
  };

  const handleCompleteCheckout = async () => {
    try {
      const payments = [];
      if (paymentSplit.paymentMethod === 'SPLIT') {
        if (paymentSplit.cashAmount > 0) {
          const cashInBase = convertAmount(
            Number(paymentSplit.cashAmount),
            activeCurrency,
            baseCurrency
          );
          payments.push({ method: 'CASH', amount: cashInBase });
        }
        if (paymentSplit.cardAmount > 0) {
          const cardInBase = convertAmount(
            Number(paymentSplit.cardAmount),
            activeCurrency,
            baseCurrency
          );
          payments.push({ method: 'CARD', amount: cardInBase });
        }
      } else {
        payments.push({ method: paymentSplit.paymentMethod, amount: grandTotal });
      }

      const res = await api.post('/omnichannel-commerce/checkout', {
        channel: 'POS',
        customerId: selectedCustomerId || undefined,
        items: cart.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          discountAmount: item.discountAmount,
        })),
        payments,
        currency: baseCurrency,
        idempotencyKey: `POS-${Date.now()}`,
      });

      const receipt = await api.get(`/pos-advanced/receipt/${res.data._id}`);
      setLastReceipt(receipt.data);
      toast.success(`Transaction ${res.data.transactionNumber} completed!`);
      setOpenPaymentModal(false);
      setOpenReceiptModal(true);
      setCart([]);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Checkout failed.');
    }
  };

  const filteredProducts = products.filter(
    (p) =>
      p.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.sku?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.barcode?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <Box sx={{ p: 2, background: '#0b0f19', minHeight: '100vh', color: '#f8fafc' }}>
      {/* Header Bar */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          mb: 2,
          flexWrap: 'wrap',
          gap: 1,
        }}
      >
        <Typography
          variant="h5"
          sx={{ fontWeight: 800, color: '#8b5cf6', display: 'flex', alignItems: 'center', gap: 1 }}
        >
          <PointOfSaleIcon fontSize="large" /> High-Speed POS Operator Console
        </Typography>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          <CurrencySelector size="small" />
          <Chip label="F2: Search" size="small" sx={{ background: '#1f2937', color: '#9ca3af' }} />
          <Chip
            label="F4: Hold Sale"
            size="small"
            sx={{ background: '#1f2937', color: '#9ca3af' }}
          />
          <Chip
            label="F8: Checkout"
            size="small"
            sx={{ background: '#1f2937', color: '#9ca3af' }}
          />
          <Chip
            label="Esc: Clear Cart"
            size="small"
            sx={{ background: '#1f2937', color: '#9ca3af' }}
          />
        </Box>
      </Box>

      {/* Operator Layout Grid */}
      <Grid container spacing={2}>
        {/* Left: Product Catalog & Quick Add (60% width) */}
        <Grid item xs={12} md={7}>
          <Paper
            sx={{
              p: 2,
              background: '#111827',
              border: '1px solid #1f2937',
              borderRadius: 3,
              mb: 2,
            }}
          >
            <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
              <TextField
                inputRef={searchInputRef}
                fullWidth
                placeholder="Scan Barcode or Search SKU / Product Name (F2)..."
                value={searchQuery}
                onChange={(e) => handleScanOrSearch(e.target.value)}
                InputProps={{
                  startAdornment: <SearchIcon sx={{ color: '#9ca3af', mr: 1 }} />,
                  style: { color: '#fff', background: '#1e293b', borderRadius: 8 },
                }}
              />
              <IconButton
                sx={{ background: '#8b5cf6', color: '#fff', '&:hover': { background: '#7c3aed' } }}
              >
                <QrCodeScannerIcon />
              </IconButton>
            </Box>

            <Typography
              variant="caption"
              sx={{ color: '#9ca3af', mb: 1, display: 'block', fontWeight: 700 }}
            >
              PRODUCT CATALOG & QUICK ADD SELECTION
            </Typography>

            <Grid container spacing={1.5} sx={{ maxHeight: '65vh', overflowY: 'auto' }}>
              {filteredProducts.map((p) => (
                <Grid item xs={6} sm={4} key={p._id}>
                  <Card
                    onClick={() => addToCart(p)}
                    sx={{
                      background: '#1e293b',
                      color: '#f8fafc',
                      borderRadius: 2,
                      cursor: 'pointer',
                      border: '1px solid #334155',
                      '&:hover': { borderColor: '#8b5cf6', background: '#334155' },
                    }}
                  >
                    <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                      <Typography variant="subtitle2" noWrap sx={{ fontWeight: 700 }}>
                        {p.name}
                      </Typography>
                      <Typography variant="caption" sx={{ color: '#9ca3af', display: 'block' }}>
                        SKU: {p.sku}
                      </Typography>
                      <Box
                        sx={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          mt: 1,
                        }}
                      >
                        <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#34d399' }}>
                          {formatAmount(p.price || 10)}
                        </Typography>
                        <Chip
                          label={p.quantity > 0 ? `${p.quantity} in stock` : 'Out of Stock'}
                          size="small"
                          sx={{
                            fontSize: '0.65rem',
                            height: 20,
                            background:
                              p.quantity > 0 ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                            color: p.quantity > 0 ? '#34d399' : '#f87171',
                          }}
                        />
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </Paper>
        </Grid>

        {/* Right: Current Cart & Checkout Action (40% width) */}
        <Grid item xs={12} md={5}>
          <Paper
            sx={{
              p: 2,
              background: '#111827',
              border: '1px solid #1f2937',
              borderRadius: 3,
              display: 'flex',
              flexDirection: 'column',
              height: '82vh',
            }}
          >
            <Box
              sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}
            >
              <Typography variant="h6" sx={{ fontWeight: 700, color: '#f8fafc' }}>
                Active Cart ({cart.reduce((a, c) => a + c.quantity, 0)} Items)
              </Typography>
              <Button
                size="small"
                startIcon={<DeleteIcon />}
                onClick={() => setCart([])}
                sx={{ color: '#f87171' }}
              >
                Clear
              </Button>
            </Box>

            {/* Customer Selector */}
            <Box sx={{ mb: 2 }}>
              <TextField
                select
                fullWidth
                size="small"
                label="Customer Identification"
                value={selectedCustomerId}
                onChange={(e) => setSelectedCustomerId(e.target.value)}
                InputLabelProps={{ shrink: true, style: { color: '#9ca3af' } }}
                InputProps={{ style: { color: '#fff', background: '#1e293b' } }}
                SelectProps={{
                  MenuProps: {
                    PaperProps: {
                      sx: { background: '#111827', border: '1px solid #1f2937', color: '#f8fafc' },
                    },
                  },
                }}
              >
                <MenuItem value="" sx={{ color: '#9ca3af', background: '#111827' }}>
                  -- Walk-in Guest --
                </MenuItem>
                {customers.map((c) => (
                  <MenuItem
                    key={c._id}
                    value={c._id}
                    sx={{
                      color: '#f8fafc',
                      background: '#111827',
                      '&:hover': { background: '#1e293b' },
                    }}
                  >
                    {c.name} ({c.code}) - {c.loyaltyTier}
                  </MenuItem>
                ))}
              </TextField>
            </Box>

            {/* Cart Items Table */}
            <TableContainer sx={{ flexGrow: 1, overflowY: 'auto' }}>
              <Table size="small">
                <TableHead sx={{ background: '#1f2937' }}>
                  <TableRow>
                    <TableCell sx={{ color: '#9ca3af' }}>Item</TableCell>
                    <TableCell sx={{ color: '#9ca3af' }}>Qty</TableCell>
                    <TableCell sx={{ color: '#9ca3af' }}>Total</TableCell>
                    <TableCell align="right" sx={{ color: '#9ca3af' }}></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {cart.map((item) => (
                    <TableRow key={item.productId}>
                      <TableCell sx={{ color: '#f8fafc', fontWeight: 600 }}>{item.name}</TableCell>
                      <TableCell sx={{ color: '#cbd5e1' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <IconButton
                            size="small"
                            onClick={() => updateQuantity(item.productId, -1)}
                            sx={{ color: '#9ca3af', p: 0.2 }}
                          >
                            <RemoveIcon fontSize="small" />
                          </IconButton>
                          <Typography variant="body2" sx={{ fontWeight: 700, px: 0.5 }}>
                            {item.quantity}
                          </Typography>
                          <IconButton
                            size="small"
                            onClick={() => updateQuantity(item.productId, 1)}
                            sx={{ color: '#9ca3af', p: 0.2 }}
                          >
                            <AddIcon fontSize="small" />
                          </IconButton>
                        </Box>
                      </TableCell>
                      <TableCell sx={{ color: '#34d399', fontWeight: 700 }}>
                        {formatAmount(item.lineTotal)}
                      </TableCell>
                      <TableCell align="right">
                        <IconButton
                          size="small"
                          onClick={() => removeFromCart(item.productId)}
                          sx={{ color: '#f87171', p: 0.2 }}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>

            {/* Totals Summary & Actions */}
            <Box sx={{ pt: 2, borderTop: '1px solid #1f2937', mt: 1 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                <Typography variant="body2" sx={{ color: '#9ca3af' }}>
                  Subtotal
                </Typography>
                <Typography variant="body2" sx={{ color: '#f8fafc', fontWeight: 700 }}>
                  {formatAmount(subtotal)}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#f8fafc' }}>
                  Total Payable
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 800, color: '#34d399' }}>
                  {formatAmount(grandTotal)}
                </Typography>
              </Box>

              <Grid container spacing={1}>
                <Grid item xs={6}>
                  <Button
                    fullWidth
                    variant="outlined"
                    startIcon={<PauseCircleIcon />}
                    onClick={handleHoldSale}
                    sx={{ color: '#fbbf24', borderColor: '#fbbf24' }}
                  >
                    Hold (F4)
                  </Button>
                </Grid>
                <Grid item xs={6}>
                  <Button
                    fullWidth
                    variant="contained"
                    startIcon={<PaymentsIcon />}
                    onClick={handleOpenPayment}
                    disabled={cart.length === 0}
                    sx={{
                      background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                      color: '#fff',
                      fontWeight: 700,
                    }}
                  >
                    Pay (F8)
                  </Button>
                </Grid>
              </Grid>
            </Box>
          </Paper>
        </Grid>
      </Grid>

      {/* Payment Checkout Dialog */}
      <Dialog
        open={openPaymentModal}
        onClose={() => setOpenPaymentModal(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{
          sx: { background: '#111827', color: '#f8fafc', border: '1px solid #1f2937' },
        }}
      >
        <DialogTitle sx={{ fontWeight: 700, borderBottom: '1px solid #1f2937' }}>
          Complete Checkout ({formatAmount(grandTotal)})
        </DialogTitle>
        <DialogContent sx={{ mt: 2 }}>
          <TextField
            select
            fullWidth
            label="Payment Method"
            value={paymentSplit.paymentMethod}
            onChange={(e) => setPaymentSplit({ ...paymentSplit, paymentMethod: e.target.value })}
            InputLabelProps={{ shrink: true, style: { color: '#9ca3af' } }}
            InputProps={{ style: { color: '#fff' } }}
            SelectProps={{
              MenuProps: {
                PaperProps: {
                  sx: { background: '#111827', border: '1px solid #1f2937', color: '#f8fafc' },
                },
              },
            }}
            sx={{ mb: 2 }}
          >
            <MenuItem value="CASH" sx={{ color: '#f8fafc', background: '#111827' }}>
              CASH
            </MenuItem>
            <MenuItem value="CARD" sx={{ color: '#f8fafc', background: '#111827' }}>
              CARD / DEBIT TERMINAL
            </MenuItem>
            <MenuItem value="PAYSTACK" sx={{ color: '#f8fafc', background: '#111827' }}>
              PAYSTACK ONLINE GATEWAY
            </MenuItem>
            <MenuItem value="BANK_TRANSFER" sx={{ color: '#f8fafc', background: '#111827' }}>
              BANK TRANSFER
            </MenuItem>
            <MenuItem value="SPLIT" sx={{ color: '#f8fafc', background: '#111827' }}>
              SPLIT PAYMENT (CASH + CARD)
            </MenuItem>
          </TextField>

          {paymentSplit.paymentMethod === 'SPLIT' && (
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <TextField
                  fullWidth
                  type="number"
                  label={`Cash Amount (${currencySymbol})`}
                  value={paymentSplit.cashAmount}
                  onChange={(e) =>
                    setPaymentSplit({ ...paymentSplit, cashAmount: Number(e.target.value) })
                  }
                  InputLabelProps={{ shrink: true, style: { color: '#9ca3af' } }}
                  InputProps={{ style: { color: '#fff' } }}
                />
              </Grid>
              <Grid item xs={6}>
                <TextField
                  fullWidth
                  type="number"
                  label={`Card Amount (${currencySymbol})`}
                  value={paymentSplit.cardAmount}
                  onChange={(e) =>
                    setPaymentSplit({ ...paymentSplit, cardAmount: Number(e.target.value) })
                  }
                  InputLabelProps={{ shrink: true, style: { color: '#9ca3af' } }}
                  InputProps={{ style: { color: '#fff' } }}
                />
              </Grid>
            </Grid>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2.5, borderTop: '1px solid #1f2937' }}>
          <Button onClick={() => setOpenPaymentModal(false)} sx={{ color: '#9ca3af' }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleCompleteCheckout}
            sx={{ background: '#10b981', color: '#fff', fontWeight: 700 }}
          >
            Confirm & Print Receipt
          </Button>
        </DialogActions>
      </Dialog>

      {/* Receipt Modal */}
      <Dialog
        open={openReceiptModal}
        onClose={() => setOpenReceiptModal(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{ sx: { background: '#ffffff', color: '#000000', p: 1 } }}
      >
        <DialogContent>
          {lastReceipt && (
            <Box sx={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>
              {lastReceipt.header?.logoUrl && (
                <Box
                  component="img"
                  src={lastReceipt.header.logoUrl}
                  alt={lastReceipt.header.businessName}
                  sx={{
                    maxHeight: 40,
                    maxWidth: 140,
                    mx: 'auto',
                    mb: 1,
                    display: 'block',
                    objectFit: 'contain',
                  }}
                />
              )}
              <Typography
                variant="subtitle1"
                align="center"
                sx={{ fontWeight: 800, textTransform: 'uppercase' }}
              >
                {lastReceipt.header?.businessName || 'Retail Store'}
              </Typography>
              {lastReceipt.header?.legalName &&
                lastReceipt.header.legalName !== lastReceipt.header.businessName && (
                  <Typography
                    variant="caption"
                    align="center"
                    display="block"
                    color="text.secondary"
                  >
                    {lastReceipt.header.legalName}
                  </Typography>
                )}
              {lastReceipt.header?.address && (
                <Typography variant="caption" align="center" display="block" color="text.secondary">
                  {lastReceipt.header.address}
                </Typography>
              )}
              {(lastReceipt.header?.phone || lastReceipt.header?.email) && (
                <Typography variant="caption" align="center" display="block" color="text.secondary">
                  {[
                    lastReceipt.header.phone ? `Tel: ${lastReceipt.header.phone}` : '',
                    lastReceipt.header.email ? `Email: ${lastReceipt.header.email}` : '',
                  ]
                    .filter(Boolean)
                    .join(' • ')}
                </Typography>
              )}
              {lastReceipt.header?.headerNotice && (
                <Typography
                  variant="caption"
                  align="center"
                  display="block"
                  sx={{ fontStyle: 'italic', my: 0.5 }}
                >
                  {lastReceipt.header.headerNotice}
                </Typography>
              )}
              <Typography variant="caption" align="center" display="block">
                Receipt #: {lastReceipt.transactionNumber}
              </Typography>
              <Typography variant="caption" align="center" display="block">
                Cashier: {lastReceipt.cashier}
              </Typography>
              <Box sx={{ borderBottom: '1px dashed #000', my: 1 }} />
              {lastReceipt.items?.map((item: any, idx: number) => (
                <Box key={idx} sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>
                    {item.qty}x {item.name}
                  </span>
                  <span>{formatAmount(item.total)}</span>
                </Box>
              ))}
              <Box sx={{ borderBottom: '1px dashed #000', my: 1 }} />
              <Box sx={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800 }}>
                <span>TOTAL PAID</span>
                <span>{formatAmount(lastReceipt.totals?.totalAmount)}</span>
              </Box>
              <Typography variant="caption" align="center" display="block" sx={{ mt: 2 }}>
                {lastReceipt.footerNote || 'Thank you for your patronage!'}
              </Typography>
              <Typography
                variant="caption"
                align="center"
                display="block"
                color="text.secondary"
                sx={{
                  mt: 1,
                  fontSize: '0.625rem',
                  letterSpacing: 0.5,
                  textTransform: 'uppercase',
                  color: '#10b981',
                  fontWeight: 700,
                }}
              >
                {lastReceipt.platformAttribution || 'Powered by Stockora Enterprise Mini'}
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenReceiptModal(false)}>Close</Button>
          <Button
            variant="contained"
            sx={{ bgcolor: '#10b981', '&:hover': { bgcolor: '#059669' } }}
            onClick={() => window.print()}
          >
            Print Receipt
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
