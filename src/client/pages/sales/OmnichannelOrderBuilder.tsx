import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Grid,
  Button,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  IconButton,
  Divider,
} from '@mui/material';
import ShoppingBagIcon from '@mui/icons-material/ShoppingBag';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import { api } from '../../api/client.ts';
import { toast } from 'react-hot-toast';
import { useRegionalSettings } from '../../hooks/useRegionalSettings.js';
import { CurrencySelector } from '../../components/CurrencySelector.tsx';

interface ProductItem {
  _id: string;
  sku: string;
  name: string;
  price: number;
  quantity: number;
}

interface CustomerItem {
  _id: string;
  name: string;
  code: string;
  group: string;
  creditLimit: number;
  totalSpending: number;
}

export default function OmnichannelOrderBuilder() {
  const { formatAmount } = useRegionalSettings();
  const [customers, setCustomers] = useState<CustomerItem[]>([]);
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [channelCode, setChannelCode] = useState<string>('POS');
  const [customerPoNumber, setCustomerPoNumber] = useState<string>('');
  const [promotionCode, setPromotionCode] = useState<string>('');
  const [couponCode, setCouponCode] = useState<string>('');

  const [cart, setCart] = useState<{ productId: string; quantity: number }[]>([]);
  const [cartPreview, setCartPreview] = useState<any>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    try {
      const [custRes, prodRes] = await Promise.all([api.get('/customers'), api.get('/products')]);
      setCustomers(custRes.data || []);
      setProducts(prodRes.data || []);
    } catch {
      toast.error('Failed to load customers and products.');
    }
  };

  const selectedCustomer = customers.find((c) => c._id === selectedCustomerId);

  const addToCart = (productId: string) => {
    const existing = cart.find((item) => item.productId === productId);
    if (existing) {
      setCart(
        cart.map((item) =>
          item.productId === productId ? { ...item, quantity: item.quantity + 1 } : item
        )
      );
    } else {
      setCart([...cart, { productId, quantity: 1 }]);
    }
  };

  const removeFromCart = (productId: string) => {
    setCart(cart.filter((item) => item.productId !== productId));
  };

  useEffect(() => {
    if (cart.length === 0) {
      setCartPreview(null);
      return;
    }

    const previewCart = async () => {
      try {
        setLoadingPreview(true);
        const res = await api.post('/sales-advanced/evaluate-cart', {
          items: cart,
          customerId: selectedCustomerId || undefined,
          channelCode,
          promotionCode: promotionCode || undefined,
          couponCode: couponCode || undefined,
        });
        setCartPreview(res.data);
      } catch (err: any) {
        toast.error(err.response?.data?.message || 'Error evaluating cart totals.');
      } finally {
        setLoadingPreview(false);
      }
    };

    const timer = setTimeout(previewCart, 300);
    return () => clearTimeout(timer);
  }, [cart, selectedCustomerId, channelCode, promotionCode, couponCode]);

  const handleSubmitOrder = async () => {
    if (cart.length === 0) {
      toast.error('Please add items to cart before submitting.');
      return;
    }

    try {
      setSubmitting(true);
      const idempotencyKey = `REQ-SO-${Date.now()}`;
      const res = await api.post(
        '/sales-advanced/orders',
        {
          items: cart,
          customerId: selectedCustomerId || undefined,
          channelCode,
          customerPoNumber: customerPoNumber || undefined,
          promotionCode: promotionCode || undefined,
          couponCode: couponCode || undefined,
          allowBackorders: true,
        },
        {
          headers: { 'x-idempotency-key': idempotencyKey },
        }
      );

      toast.success(
        `Sales Order ${res.data.orderNumber} created successfully! Status: ${res.data.status}`
      );
      setCart([]);
      setCartPreview(null);
      setCustomerPoNumber('');
      setPromotionCode('');
      setCouponCode('');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to submit sales order.');
    } finally {
      setSubmitting(false);
    }
  };

  const isCreditExceeded =
    selectedCustomer &&
    (selectedCustomer.creditLimit || 0) > 0 &&
    (selectedCustomer.totalSpending || 0) + (cartPreview?.grandTotal || 0) >
      (selectedCustomer.creditLimit || 0);

  return (
    <Box sx={{ p: 3, background: '#0b0f19', minHeight: '100vh', color: '#f8fafc' }}>
      {/* Header */}
      <Box
        sx={{
          mb: 3,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 2,
        }}
      >
        <Box>
          <Typography
            variant="h4"
            sx={{
              fontWeight: 800,
              color: '#8b5cf6',
              display: 'flex',
              alignItems: 'center',
              gap: 1.5,
            }}
          >
            <ShoppingBagIcon fontSize="large" /> Omnichannel Order Builder
          </Typography>
          <Typography variant="body2" sx={{ color: '#9ca3af', mt: 0.5 }}>
            Multi-warehouse inventory reservation, tiered cart pricing & credit limit orchestration
          </Typography>
        </Box>
        <CurrencySelector size="small" />
      </Box>

      <Grid container spacing={3}>
        <Grid item xs={12} md={7}>
          {/* Configuration Card */}
          <Paper
            sx={{
              p: 3,
              mb: 3,
              background: '#111827',
              border: '1px solid #1f2937',
              borderRadius: 3,
              color: '#f8fafc',
            }}
          >
            <Typography
              variant="h6"
              sx={{
                fontWeight: 700,
                mb: 2,
                color: '#f8fafc',
                display: 'flex',
                alignItems: 'center',
                gap: 1,
              }}
            >
              <AccountCircleIcon sx={{ color: '#8b5cf6' }} /> Customer & Channel Configuration
            </Typography>

            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth size="small" sx={{ background: '#1f2937', borderRadius: 1 }}>
                  <InputLabel sx={{ color: '#9ca3af' }}>Sales Channel</InputLabel>
                  <Select
                    value={channelCode}
                    label="Sales Channel"
                    onChange={(e) => setChannelCode(e.target.value)}
                    sx={{ color: '#f8fafc' }}
                  >
                    <MenuItem value="POS">POS (Retail Store)</MenuItem>
                    <MenuItem value="ONLINE">Web Online Store</MenuItem>
                    <MenuItem value="B2B">B2B Corporate Portal</MenuItem>
                    <MenuItem value="WHOLESALE">Wholesale Channel</MenuItem>
                    <MenuItem value="SALES_REP">Sales Representative</MenuItem>
                    <MenuItem value="MARKETPLACE">External Marketplace</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} sm={6}>
                <FormControl fullWidth size="small" sx={{ background: '#1f2937', borderRadius: 1 }}>
                  <InputLabel sx={{ color: '#9ca3af' }}>Customer</InputLabel>
                  <Select
                    value={selectedCustomerId}
                    label="Customer"
                    onChange={(e) => setSelectedCustomerId(e.target.value)}
                    sx={{ color: '#f8fafc' }}
                  >
                    <MenuItem value="">-- Guest / Walk-in Customer --</MenuItem>
                    {customers.map((c) => (
                      <MenuItem key={c._id} value={c._id}>
                        {c.name} ({c.code}) - {c.group}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              {channelCode === 'B2B' && (
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Customer PO Number"
                    placeholder="e.g. PO-2026-9901"
                    value={customerPoNumber}
                    onChange={(e) => setCustomerPoNumber(e.target.value)}
                    sx={{
                      background: '#1f2937',
                      borderRadius: 1,
                      input: { color: '#f8fafc' },
                      label: { color: '#9ca3af' },
                    }}
                  />
                </Grid>
              )}
            </Grid>

            {selectedCustomer && (
              <Box
                sx={{
                  mt: 2.5,
                  p: 2,
                  borderRadius: 2,
                  background: 'rgba(31, 41, 55, 0.6)',
                  border: '1px solid #374151',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <Box>
                  <Typography variant="caption" sx={{ color: '#9ca3af' }}>
                    Credit Exposure / Limit
                  </Typography>
                  <Typography variant="body1" sx={{ fontWeight: 700, color: '#f8fafc' }}>
                    {formatAmount(selectedCustomer.totalSpending || 0)} /{' '}
                    {formatAmount(selectedCustomer.creditLimit || 0)}
                  </Typography>
                </Box>
                {isCreditExceeded ? (
                  <Chip
                    icon={<ErrorIcon />}
                    label="Credit Exceeded (Order Hold)"
                    color="error"
                    sx={{ fontWeight: 600 }}
                  />
                ) : (
                  <Chip
                    icon={<CheckCircleIcon />}
                    label="Credit Verified"
                    color="success"
                    sx={{ fontWeight: 600 }}
                  />
                )}
              </Box>
            )}
          </Paper>

          {/* Product Catalog */}
          <Paper
            sx={{
              p: 3,
              background: '#111827',
              border: '1px solid #1f2937',
              borderRadius: 3,
              color: '#f8fafc',
            }}
          >
            <Typography
              variant="h6"
              sx={{
                fontWeight: 700,
                mb: 2,
                color: '#f8fafc',
                display: 'flex',
                alignItems: 'center',
                gap: 1,
              }}
            >
              <ShoppingBagIcon sx={{ color: '#8b5cf6' }} /> Product Catalog
            </Typography>

            <TableContainer>
              <Table>
                <TableHead sx={{ background: '#1f2937' }}>
                  <TableRow>
                    <TableCell sx={{ color: '#9ca3af', fontWeight: 600 }}>Product</TableCell>
                    <TableCell sx={{ color: '#9ca3af', fontWeight: 600 }}>SKU</TableCell>
                    <TableCell sx={{ color: '#9ca3af', fontWeight: 600 }}>Stock</TableCell>
                    <TableCell sx={{ color: '#9ca3af', fontWeight: 600 }}>Price</TableCell>
                    <TableCell align="right" sx={{ color: '#9ca3af', fontWeight: 600 }}>
                      Action
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {products.map((p) => (
                    <TableRow key={p._id} sx={{ '&:hover': { background: '#1e293b' } }}>
                      <TableCell sx={{ color: '#f8fafc', fontWeight: 600 }}>{p.name}</TableCell>
                      <TableCell>
                        <Chip
                          label={p.sku}
                          size="small"
                          sx={{ background: '#374151', color: '#cbd5e1' }}
                        />
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={`${p.quantity} units`}
                          size="small"
                          sx={{
                            background:
                              p.quantity > 5
                                ? 'rgba(16, 185, 129, 0.2)'
                                : 'rgba(245, 158, 11, 0.2)',
                            color: p.quantity > 5 ? '#34d399' : '#fbbf24',
                            fontWeight: 600,
                          }}
                        />
                      </TableCell>
                      <TableCell sx={{ color: '#818cf8', fontWeight: 700 }}>
                        {formatAmount(p.price)}
                      </TableCell>
                      <TableCell align="right">
                        <Button
                          size="small"
                          variant="contained"
                          startIcon={<AddIcon />}
                          onClick={() => addToCart(p._id)}
                          sx={{
                            background: '#6366f1',
                            borderRadius: '9999px',
                            textTransform: 'none',
                            fontWeight: 600,
                            '&:hover': { background: '#4f46e5' },
                          }}
                        >
                          Add
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Grid>

        {/* Cart Summary Side Panel */}
        <Grid item xs={12} md={5}>
          <Paper
            sx={{
              p: 3,
              background: '#111827',
              border: '1px solid #1f2937',
              borderRadius: 3,
              color: '#f8fafc',
              position: 'sticky',
              top: 20,
            }}
          >
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 2, color: '#f8fafc' }}>
              Order Cart Summary
            </Typography>

            {cart.length === 0 ? (
              <Box sx={{ textCenter: 'center', py: 5, textAlign: 'center', color: '#6b7280' }}>
                <ShoppingBagIcon sx={{ fontSize: 48, mb: 1, opacity: 0.4 }} />
                <Typography variant="body2">
                  Cart is empty. Add products from the catalog.
                </Typography>
              </Box>
            ) : (
              <>
                <Box sx={{ maxHeight: 260, overflowY: 'auto', mb: 2 }}>
                  {cartPreview?.items?.map((item: any) => (
                    <Box
                      key={item.productId}
                      sx={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        p: 1.5,
                        mb: 1,
                        borderRadius: 2,
                        background: '#1f2937',
                        border: '1px solid #374151',
                      }}
                    >
                      <Box>
                        <Typography variant="body2" sx={{ fontWeight: 600, color: '#f8fafc' }}>
                          {item.name}
                        </Typography>
                        <Typography variant="caption" sx={{ color: '#9ca3af' }}>
                          {formatAmount(item.unitPrice)} × {item.quantity}
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <Typography
                          variant="body2"
                          sx={{ fontWeight: 700, color: '#34d399', mr: 2 }}
                        >
                          {formatAmount(item.itemSubtotal)}
                        </Typography>
                        <IconButton
                          size="small"
                          sx={{ color: '#f87171' }}
                          onClick={() => removeFromCart(item.productId)}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Box>
                    </Box>
                  ))}
                </Box>

                <Grid container spacing={1} sx={{ mb: 2 }}>
                  <Grid item xs={6}>
                    <TextField
                      fullWidth
                      size="small"
                      label="Promo Code"
                      value={promotionCode}
                      onChange={(e) => setPromotionCode(e.target.value)}
                      sx={{
                        background: '#1f2937',
                        borderRadius: 1,
                        input: { color: '#f8fafc' },
                        label: { color: '#9ca3af' },
                      }}
                    />
                  </Grid>
                  <Grid item xs={6}>
                    <TextField
                      fullWidth
                      size="small"
                      label="Coupon Code"
                      value={couponCode}
                      onChange={(e) => setCouponCode(e.target.value)}
                      sx={{
                        background: '#1f2937',
                        borderRadius: 1,
                        input: { color: '#f8fafc' },
                        label: { color: '#9ca3af' },
                      }}
                    />
                  </Grid>
                </Grid>

                {cartPreview && (
                  <Box
                    sx={{
                      p: 2,
                      borderRadius: 2,
                      background: '#1f2937',
                      border: '1px solid #374151',
                      mb: 3,
                    }}
                  >
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                      <Typography variant="body2" sx={{ color: '#9ca3af' }}>
                        Subtotal
                      </Typography>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {formatAmount(cartPreview.subtotal)}
                      </Typography>
                    </Box>
                    {cartPreview.totalDiscount > 0 && (
                      <Box
                        sx={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          mb: 1,
                          color: '#f87171',
                        }}
                      >
                        <Typography variant="body2">Total Discounts</Typography>
                        <Typography variant="body2">
                          -{formatAmount(cartPreview.totalDiscount)}
                        </Typography>
                      </Box>
                    )}
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                      <Typography variant="body2" sx={{ color: '#9ca3af' }}>
                        Est. Tax
                      </Typography>
                      <Typography variant="body2">{formatAmount(cartPreview.taxTotal)}</Typography>
                    </Box>
                    <Divider sx={{ borderColor: '#374151', my: 1 }} />
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="h6" sx={{ fontWeight: 800 }}>
                        Grand Total
                      </Typography>
                      <Typography variant="h6" sx={{ fontWeight: 800, color: '#818cf8' }}>
                        {formatAmount(cartPreview.grandTotal)}
                      </Typography>
                    </Box>
                  </Box>
                )}

                <Button
                  fullWidth
                  variant="contained"
                  size="large"
                  onClick={handleSubmitOrder}
                  disabled={submitting || loadingPreview}
                  sx={{
                    background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                    borderRadius: '9999px',
                    fontWeight: 700,
                    py: 1.5,
                    color: '#ffffff',
                    '&:hover': {
                      background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
                    },
                  }}
                >
                  {submitting ? 'Processing Order...' : 'Submit & Reserve Order'}
                </Button>
              </>
            )}
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}
