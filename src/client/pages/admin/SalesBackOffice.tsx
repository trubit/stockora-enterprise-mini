import { useState } from 'react';
import {
  Box,
  Typography,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Grid,
  Tab,
  Tabs,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useForm, useFieldArray } from 'react-hook-form';
import { apiClient } from '../../api/client.ts';
import { useAuthStore } from '../../store/auth.ts';
import { SYSTEM_PERMISSIONS, hasAnyPermission } from '../../../shared/permissions.js';
import { toast } from 'react-hot-toast';
import type { Product, Customer } from '../../../shared/types.js';
import { motion } from 'framer-motion';
import { useRegionalSettings } from '../../hooks/useRegionalSettings.js';
import { CurrencySelector } from '../../components/CurrencySelector.tsx';

const textFieldStyle = {};

interface Quote {
  _id: string;
  quoteNumber: string;
  customerId?: { name: string; code: string };
  items: { productId: { name: string; sku: string }; quantity: number; price: number }[];
  subtotal: number;
  total: number;
  status: string;
  validUntil: string;
}

interface SalesOrder {
  _id: string;
  orderNumber: string;
  customerId?: { name: string; code: string };
  items: {
    productId: { _id: string; name: string; sku: string };
    quantity: number;
    price: number;
    shippedQuantity: number;
  }[];
  total: number;
  status: string;
}

interface QuoteForm {
  customerId: string;
  items: { productId: string; quantity: number; price: number }[];
  discount: number;
  validUntil: string;
  notes?: string;
}

interface OrderForm {
  customerId: string;
  items: { productId: string; quantity: number; price: number }[];
  discount: number;
  notes?: string;
}

interface ShipForm {
  items: { productId: string; quantityShipped: number; productName: string }[];
  carrier?: string;
  trackingNumber?: string;
}

const DEFAULT_VALID_UNTIL = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  .toISOString()
  .split('T')[0];

export default function SalesBackOffice() {
  const { user } = useAuthStore();
  const { formatAmount, convertAmount, activeCurrency, baseCurrency, currencySymbol } =
    useRegionalSettings();
  const [activeTab, setActiveTab] = useState(0);
  const [quoteOpen, setQuoteOpen] = useState(false);
  const [orderOpen, setOrderOpen] = useState(false);
  const [shipOpen, setShipOpen] = useState(false);
  const [selectedSO, setSelectedSO] = useState<SalesOrder | null>(null);

  const canCreateQuote = hasAnyPermission(user, [
    SYSTEM_PERMISSIONS.TRANSACTIONS_WRITE,
    SYSTEM_PERMISSIONS.PRODUCTS_WRITE,
  ]);
  const canCreateOrder = hasAnyPermission(user, [
    SYSTEM_PERMISSIONS.TRANSACTIONS_WRITE,
    SYSTEM_PERMISSIONS.PRODUCTS_WRITE,
  ]);
  const canShip = hasAnyPermission(user, [
    SYSTEM_PERMISSIONS.TRANSACTIONS_WRITE,
    SYSTEM_PERMISSIONS.WAREHOUSES_WRITE,
    SYSTEM_PERMISSIONS.PRODUCTS_WRITE,
  ]);

  const canReadQuotes = hasAnyPermission(user, [
    SYSTEM_PERMISSIONS.TRANSACTIONS_READ,
    SYSTEM_PERMISSIONS.PRODUCTS_READ,
  ]);
  const canReadOrders = hasAnyPermission(user, [
    SYSTEM_PERMISSIONS.TRANSACTIONS_READ,
    SYSTEM_PERMISSIONS.PRODUCTS_READ,
  ]);
  const canReadCustomers = hasAnyPermission(user, [
    SYSTEM_PERMISSIONS.CUSTOMERS_READ,
    SYSTEM_PERMISSIONS.TRANSACTIONS_READ,
  ]);
  const canReadProducts = hasAnyPermission(user, [
    SYSTEM_PERMISSIONS.PRODUCTS_READ,
    SYSTEM_PERMISSIONS.TRANSACTIONS_READ,
  ]);

  // Fetch Quotes
  const { data: quotes = [], refetch: refetchQuotes } = useQuery<Quote[]>({
    queryKey: ['quotes'],
    enabled: !!user && Boolean(canReadQuotes),
    retry: (failureCount, error: any) =>
      error?.response?.status !== 403 && error?.response?.status !== 401 && failureCount < 2,
    queryFn: async () => {
      const { data } = await apiClient.get<Quote[]>('/quotes');
      return data;
    },
  });

  // Fetch Sales Orders
  const { data: orders = [], refetch: refetchOrders } = useQuery<SalesOrder[]>({
    queryKey: ['sales-orders'],
    enabled: !!user && Boolean(canReadOrders),
    retry: (failureCount, error: any) =>
      error?.response?.status !== 403 && error?.response?.status !== 401 && failureCount < 2,
    queryFn: async () => {
      const { data } = await apiClient.get<SalesOrder[]>('/sales-orders');
      return data;
    },
  });

  // Fetch Customers (only needed when creating a quote or order dialog is open, and user has customer read permission)
  const { data: customers = [] } = useQuery<Customer[]>({
    queryKey: ['customers'],
    enabled: !!user && Boolean(canReadCustomers) && (quoteOpen || orderOpen),
    retry: (failureCount, error: any) =>
      error?.response?.status !== 403 && error?.response?.status !== 401 && failureCount < 2,
    queryFn: async () => {
      const { data } = await apiClient.get<Customer[]>('/customers');
      return data;
    },
  });

  // Fetch Products (only needed when creating a quote or order dialog is open, and user has product read permission)
  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ['products'],
    enabled: !!user && Boolean(canReadProducts) && (quoteOpen || orderOpen),
    retry: (failureCount, error: any) =>
      error?.response?.status !== 403 && error?.response?.status !== 401 && failureCount < 2,
    queryFn: async () => {
      const { data } = await apiClient.get<Product[]>('/products');
      return data;
    },
  });

  // Quote Form
  const {
    register: qReg,
    control: qControl,
    handleSubmit: qSubmit,
    reset: qReset,
  } = useForm<QuoteForm>({
    defaultValues: {
      customerId: '',
      items: [{ productId: '', quantity: 1, price: 0 }],
      discount: 0,
      validUntil: DEFAULT_VALID_UNTIL,
      notes: '',
    },
  });
  const {
    fields: qFields,
    append: qAppend,
    remove: qRemove,
  } = useFieldArray({
    control: qControl,
    name: 'items',
  });

  // Order Form
  const {
    register: oReg,
    control: oControl,
    handleSubmit: oSubmit,
    reset: oReset,
  } = useForm<OrderForm>({
    defaultValues: {
      customerId: '',
      items: [{ productId: '', quantity: 1, price: 0 }],
      discount: 0,
      notes: '',
    },
  });
  const {
    fields: oFields,
    append: oAppend,
    remove: oRemove,
  } = useFieldArray({
    control: oControl,
    name: 'items',
  });

  // Ship Form
  const {
    register: sReg,
    control: sControl,
    handleSubmit: sSubmit,
    reset: sReset,
  } = useForm<ShipForm>({
    defaultValues: {
      items: [{ productId: '', quantityShipped: 0, productName: '' }],
      carrier: '',
      trackingNumber: '',
    },
  });
  const { fields: sFields } = useFieldArray({
    control: sControl,
    name: 'items',
  });

  const createQuoteMutation = useMutation({
    mutationFn: async (payload: QuoteForm) => {
      return await apiClient.post('/quotes', payload);
    },
    onSuccess: () => {
      toast.success('Sales Quote generated successfully!');
      setQuoteOpen(false);
      qReset();
      refetchQuotes();
    },
  });

  const acceptQuoteMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiClient.put(`/quotes/${id}/accept`);
    },
    onSuccess: () => {
      toast.success('Quote Accepted!');
      refetchQuotes();
    },
  });

  const createOrderMutation = useMutation({
    mutationFn: async (payload: OrderForm) => {
      return await apiClient.post('/sales-orders', payload);
    },
    onSuccess: () => {
      toast.success('Sales Order confirmed successfully!');
      setOrderOpen(false);
      oReset();
      refetchOrders();
    },
  });

  interface ShipmentPayload {
    items: { productId: string; quantityShipped: number }[];
    carrier?: string;
    trackingNumber?: string;
  }

  const shipMutation = useMutation({
    mutationFn: async (payload: ShipmentPayload) => {
      return await apiClient.post(`/sales-orders/${selectedSO?._id}/ship`, payload);
    },
    onSuccess: () => {
      toast.success('Shipment dispatched and stock updated!');
      setShipOpen(false);
      sReset();
      refetchOrders();
    },
    onError: (err: unknown) => {
      const apiErr = err as { response?: { data?: { error?: { message?: string } } } };
      const msg = apiErr.response?.data?.error?.message || 'Failed to dispatch shipment.';
      toast.error(msg);
    },
  });

  const handleOpenShip = (so: SalesOrder) => {
    setSelectedSO(so);
    const prefill = so.items.map((i) => ({
      productId: i.productId._id,
      quantityShipped: i.quantity - i.shippedQuantity,
      productName: i.productId.name,
    }));
    sReset({
      items: prefill,
      carrier: '',
      trackingNumber: '',
    });
    setShipOpen(true);
  };

  const onQuoteSubmit = (data: QuoteForm) => {
    createQuoteMutation.mutate({
      ...data,
      discount: convertAmount(Number(data.discount || 0), activeCurrency, baseCurrency),
      items: data.items.map((i) => ({
        ...i,
        quantity: Number(i.quantity),
        price: convertAmount(Number(i.price || 0), activeCurrency, baseCurrency),
      })),
    });
  };

  const onOrderSubmit = (data: OrderForm) => {
    createOrderMutation.mutate({
      ...data,
      discount: convertAmount(Number(data.discount || 0), activeCurrency, baseCurrency),
      items: data.items.map((i) => ({
        ...i,
        quantity: Number(i.quantity),
        price: convertAmount(Number(i.price || 0), activeCurrency, baseCurrency),
      })),
    });
  };

  const onShipSubmit = (data: ShipForm) => {
    shipMutation.mutate({
      items: data.items.map((i) => ({
        productId: i.productId,
        quantityShipped: Number(i.quantityShipped),
      })),
      carrier: data.carrier,
      trackingNumber: data.trackingNumber,
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PENDING':
        return 'warning';
      case 'ACCEPTED':
      case 'APPROVED':
      case 'SHIPPED':
        return 'success';
      case 'PARTIALLY_SHIPPED':
        return 'primary';
      case 'REJECTED':
      case 'CANCELLED':
      case 'EXPIRED':
        return 'error';
      default:
        return 'default';
    }
  };

  return (
    <Box sx={{ p: { xs: 2, md: 4 } }}>
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
          <Typography
            variant="h4"
            sx={{
              fontWeight: 800,
              background: 'linear-gradient(90deg, #fff 0%, #a78bfa 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            Commercial Sales & Back Office
          </Typography>
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
            <CurrencySelector size="small" />
            {canCreateQuote && (
              <Button
                variant="outlined"
                startIcon={<AddIcon />}
                onClick={() => setQuoteOpen(true)}
                sx={{ textTransform: 'none', px: 2, borderColor: 'rgba(255,255,255,0.08)' }}
              >
                New Sales Quote
              </Button>
            )}
            {canCreateOrder && (
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => setOrderOpen(true)}
                sx={{
                  fontWeight: 700,
                  px: 3,
                  py: 1.2,
                  borderRadius: 2.5,
                  textTransform: 'none',
                  background: 'linear-gradient(90deg, #8b5cf6 0%, #6366f1 100%)',
                  boxShadow: '0 4px 15px rgba(139, 92, 246, 0.3)',
                  '&:hover': {
                    background: 'linear-gradient(90deg, #7c3aed 0%, #4f46e5 100%)',
                    boxShadow: '0 6px 20px rgba(139, 92, 246, 0.45)',
                  },
                }}
              >
                Confirm Sales Order
              </Button>
            )}
          </Box>
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 4 }}>
          Manage customer sales quotes, process sales orders, and coordinate warehouse dispatches.
        </Typography>

        <Tabs
          value={activeTab}
          onChange={(_e, v) => setActiveTab(v)}
          sx={{ mb: 3, borderBottom: '1px solid rgba(255,255,255,0.08)' }}
        >
          <Tab label="Sales Quotes" sx={{ textTransform: 'none', fontWeight: 700 }} />
          <Tab label="Sales Orders (SO)" sx={{ textTransform: 'none', fontWeight: 700 }} />
        </Tabs>

        {activeTab === 0 && (
          <TableContainer
            component={Paper}
            className="glass-panel"
            sx={{
              border: '1px solid rgba(255,255,255,0.05)',
              background:
                'linear-gradient(135deg, rgba(30, 41, 59, 0.6) 0%, rgba(15, 23, 42, 0.75) 100%)',
              borderRadius: 3,
            }}
          >
            <Table>
              <TableHead sx={{ bgcolor: 'rgba(17, 24, 39, 0.5)' }}>
                <TableRow>
                  <TableCell sx={{ fontWeight: 800 }}>Quote Number</TableCell>
                  <TableCell sx={{ fontWeight: 800 }}>Client Customer</TableCell>
                  <TableCell sx={{ fontWeight: 800 }}>Subtotal</TableCell>
                  <TableCell sx={{ fontWeight: 800 }}>Total Value</TableCell>
                  <TableCell sx={{ fontWeight: 800 }}>Valid Until</TableCell>
                  <TableCell sx={{ fontWeight: 800 }}>Status</TableCell>
                  <TableCell sx={{ fontWeight: 800, textAlign: 'right' }}>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {quotes.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      align="center"
                      sx={{ py: 6, color: 'text.secondary', border: 'none' }}
                    >
                      No sales quotes registered.
                    </TableCell>
                  </TableRow>
                ) : (
                  quotes.map((q) => (
                    <TableRow key={q._id} sx={{ '&:hover': { bgcolor: 'rgba(255,255,255,0.01)' } }}>
                      <TableCell sx={{ fontWeight: 700 }}>{q.quoteNumber}</TableCell>
                      <TableCell>{q.customerId?.name || 'Walk-in Customer'}</TableCell>
                      <TableCell>{formatAmount(q.subtotal)}</TableCell>
                      <TableCell sx={{ fontWeight: 800 }}>{formatAmount(q.total)}</TableCell>
                      <TableCell>{new Date(q.validUntil).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <Chip
                          label={q.status}
                          size="small"
                          color={getStatusColor(q.status)}
                          sx={{ fontWeight: 700 }}
                        />
                      </TableCell>
                      <TableCell sx={{ textAlign: 'right' }}>
                        {q.status === 'PENDING' && canCreateOrder && (
                          <Button
                            variant="contained"
                            size="small"
                            startIcon={<CheckCircleIcon />}
                            onClick={() => acceptQuoteMutation.mutate(q._id)}
                            sx={{
                              textTransform: 'none',
                              bgcolor: 'success.main',
                              '&:hover': { bgcolor: 'success.dark' },
                            }}
                          >
                            Accept
                          </Button>
                        )}
                        {q.status === 'PENDING' && !canCreateOrder && (
                          <Typography variant="caption" color="text.secondary">
                            Pending Approval
                          </Typography>
                        )}
                        {q.status !== 'PENDING' && (
                          <Typography variant="caption" color="text.secondary">
                            Finalized
                          </Typography>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}

        {activeTab === 1 && (
          <TableContainer
            component={Paper}
            className="glass-panel"
            sx={{
              border: '1px solid rgba(255,255,255,0.05)',
              background:
                'linear-gradient(135deg, rgba(30, 41, 59, 0.6) 0%, rgba(15, 23, 42, 0.75) 100%)',
              borderRadius: 3,
            }}
          >
            <Table>
              <TableHead sx={{ bgcolor: 'rgba(17, 24, 39, 0.5)' }}>
                <TableRow>
                  <TableCell sx={{ fontWeight: 800 }}>Sales Order Number</TableCell>
                  <TableCell sx={{ fontWeight: 800 }}>Client Customer</TableCell>
                  <TableCell sx={{ fontWeight: 800 }}>Total Value</TableCell>
                  <TableCell sx={{ fontWeight: 800 }}>Items Shipped</TableCell>
                  <TableCell sx={{ fontWeight: 800 }}>Status</TableCell>
                  <TableCell sx={{ fontWeight: 800, textAlign: 'right' }}>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {orders.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      align="center"
                      sx={{ py: 6, color: 'text.secondary', border: 'none' }}
                    >
                      No sales orders confirmed.
                    </TableCell>
                  </TableRow>
                ) : (
                  orders.map((so) => (
                    <TableRow
                      key={so._id}
                      sx={{ '&:hover': { bgcolor: 'rgba(255,255,255,0.01)' } }}
                    >
                      <TableCell sx={{ fontWeight: 700 }}>{so.orderNumber}</TableCell>
                      <TableCell>{so.customerId?.name || 'Walk-in Customer'}</TableCell>
                      <TableCell sx={{ fontWeight: 800 }}>{formatAmount(so.total)}</TableCell>
                      <TableCell>
                        {so.items.reduce((acc, i) => acc + i.shippedQuantity, 0)} /{' '}
                        {so.items.reduce((acc, i) => acc + i.quantity, 0)} shipped
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={so.status}
                          size="small"
                          color={getStatusColor(so.status)}
                          sx={{ fontWeight: 700 }}
                        />
                      </TableCell>
                      <TableCell sx={{ textAlign: 'right' }}>
                        {['PENDING', 'APPROVED', 'PARTIALLY_SHIPPED'].includes(so.status) &&
                          canShip && (
                            <Button
                              variant="contained"
                              size="small"
                              startIcon={<LocalShippingIcon />}
                              onClick={() => handleOpenShip(so)}
                              sx={{
                                textTransform: 'none',
                                background: 'linear-gradient(90deg, #8b5cf6 0%, #6366f1 100%)',
                              }}
                            >
                              Dispatch Shipment
                            </Button>
                          )}
                        {['PENDING', 'APPROVED', 'PARTIALLY_SHIPPED'].includes(so.status) &&
                          !canShip && (
                            <Typography variant="caption" color="text.secondary">
                              Awaiting Dispatch
                            </Typography>
                          )}
                        {so.status === 'SHIPPED' && (
                          <Typography variant="caption" color="text.secondary">
                            All Dispatched
                          </Typography>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}

        {/* Create Quote Dialog */}
        <Dialog
          open={quoteOpen}
          onClose={() => setQuoteOpen(false)}
          maxWidth="md"
          fullWidth
          PaperProps={{
            sx: {
              background:
                'linear-gradient(135deg, rgba(23, 27, 44, 0.98) 0%, rgba(11, 13, 26, 0.99) 100%)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(139, 92, 246, 0.2)',
              borderRadius: 4,
            },
          }}
        >
          <form onSubmit={qSubmit(onQuoteSubmit)}>
            <DialogTitle
              sx={{
                fontWeight: 800,
                background: 'linear-gradient(90deg, #fff 0%, #a78bfa 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              Create Sales Quote Request
            </DialogTitle>
            <DialogContent sx={{ pt: 2 }}>
              <Grid container spacing={3}>
                <Grid item xs={12} sm={6}>
                  <TextField
                    select
                    label="Customer Link"
                    fullWidth
                    defaultValue=""
                    {...qReg('customerId')}
                    sx={textFieldStyle}
                    InputLabelProps={{ shrink: true }}
                  >
                    {customers.map((c) => (
                      <MenuItem key={c._id} value={c._id}>
                        {c.name}
                      </MenuItem>
                    ))}
                  </TextField>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="Valid Deadline"
                    type="date"
                    fullWidth
                    {...qReg('validUntil')}
                    sx={textFieldStyle}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
                <Grid item xs={12}>
                  <Typography
                    variant="subtitle2"
                    color="text.secondary"
                    sx={{ mb: 1, fontWeight: 700 }}
                  >
                    Quote Line Items
                  </Typography>
                  {qFields.map((field, index) => (
                    <Grid container spacing={2} key={field.id} sx={{ mb: 2, alignItems: 'center' }}>
                      <Grid item xs={5}>
                        <TextField
                          select
                          label="Product"
                          fullWidth
                          defaultValue=""
                          {...qReg(`items.${index}.productId` as const, { required: true })}
                          sx={textFieldStyle}
                          InputLabelProps={{ shrink: true }}
                        >
                          {products.map((p) => (
                            <MenuItem key={p._id || p.id} value={p._id || p.id}>
                              {p.name} ({formatAmount(p.price)})
                            </MenuItem>
                          ))}
                        </TextField>
                      </Grid>
                      <Grid item xs={3}>
                        <TextField
                          label="Quantity"
                          type="number"
                          fullWidth
                          {...qReg(`items.${index}.quantity` as const, { required: true })}
                          sx={textFieldStyle}
                          InputLabelProps={{ shrink: true }}
                        />
                      </Grid>
                      <Grid item xs={3}>
                        <TextField
                          label={`Unit Price (${currencySymbol})`}
                          type="number"
                          fullWidth
                          {...qReg(`items.${index}.price` as const, { required: true })}
                          sx={textFieldStyle}
                          InputLabelProps={{ shrink: true }}
                        />
                      </Grid>
                      <Grid item xs={1}>
                        <Button color="error" onClick={() => qRemove(index)}>
                          X
                        </Button>
                      </Grid>
                    </Grid>
                  ))}
                  <Button
                    variant="outlined"
                    onClick={() => qAppend({ productId: '', quantity: 1, price: 0 })}
                    sx={{ textTransform: 'none', borderColor: 'rgba(255,255,255,0.08)' }}
                  >
                    Add Line Item
                  </Button>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    label={`Discount (${currencySymbol})`}
                    type="number"
                    fullWidth
                    {...qReg('discount')}
                    sx={textFieldStyle}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    label="Internal Notes / Terms"
                    multiline
                    rows={2}
                    fullWidth
                    {...qReg('notes')}
                    sx={textFieldStyle}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
              </Grid>
            </DialogContent>
            <DialogActions sx={{ p: 3, gap: 1.5 }}>
              <Button
                onClick={() => setQuoteOpen(false)}
                sx={{ color: 'text.secondary', textTransform: 'none' }}
              >
                Cancel
              </Button>
              <Button
                variant="contained"
                type="submit"
                sx={{
                  px: 4,
                  py: 1.2,
                  fontWeight: 700,
                  background: 'linear-gradient(90deg, #8b5cf6 0%, #6366f1 100%)',
                }}
              >
                Create Quote
              </Button>
            </DialogActions>
          </form>
        </Dialog>

        {/* Create Sales Order Dialog */}
        <Dialog
          open={orderOpen}
          onClose={() => setOrderOpen(false)}
          maxWidth="md"
          fullWidth
          PaperProps={{
            sx: {
              background:
                'linear-gradient(135deg, rgba(23, 27, 44, 0.98) 0%, rgba(11, 13, 26, 0.99) 100%)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(139, 92, 246, 0.2)',
              borderRadius: 4,
            },
          }}
        >
          <form onSubmit={oSubmit(onOrderSubmit)}>
            <DialogTitle
              sx={{
                fontWeight: 800,
                background: 'linear-gradient(90deg, #fff 0%, #a78bfa 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              Confirm Customer Sales Order (SO)
            </DialogTitle>
            <DialogContent sx={{ pt: 2 }}>
              <Grid container spacing={3}>
                <Grid item xs={12}>
                  <TextField
                    select
                    label="Customer Link"
                    fullWidth
                    defaultValue=""
                    {...oReg('customerId')}
                    sx={textFieldStyle}
                    InputLabelProps={{ shrink: true }}
                  >
                    {customers.map((c) => (
                      <MenuItem key={c._id} value={c._id}>
                        {c.name}
                      </MenuItem>
                    ))}
                  </TextField>
                </Grid>
                <Grid item xs={12}>
                  <Typography
                    variant="subtitle2"
                    color="text.secondary"
                    sx={{ mb: 1, fontWeight: 700 }}
                  >
                    Order Line Items
                  </Typography>
                  {oFields.map((field, index) => (
                    <Grid container spacing={2} key={field.id} sx={{ mb: 2, alignItems: 'center' }}>
                      <Grid item xs={5}>
                        <TextField
                          select
                          label="Product"
                          fullWidth
                          defaultValue=""
                          {...oReg(`items.${index}.productId` as const, { required: true })}
                          sx={textFieldStyle}
                          InputLabelProps={{ shrink: true }}
                        >
                          {products.map((p) => (
                            <MenuItem key={p._id || p.id} value={p._id || p.id}>
                              {p.name} ({formatAmount(p.price)})
                            </MenuItem>
                          ))}
                        </TextField>
                      </Grid>
                      <Grid item xs={3}>
                        <TextField
                          label="Quantity"
                          type="number"
                          fullWidth
                          {...oReg(`items.${index}.quantity` as const, { required: true })}
                          sx={textFieldStyle}
                          InputLabelProps={{ shrink: true }}
                        />
                      </Grid>
                      <Grid item xs={3}>
                        <TextField
                          label={`Unit Price (${currencySymbol})`}
                          type="number"
                          fullWidth
                          {...oReg(`items.${index}.price` as const, { required: true })}
                          sx={textFieldStyle}
                          InputLabelProps={{ shrink: true }}
                        />
                      </Grid>
                      <Grid item xs={1}>
                        <Button color="error" onClick={() => oRemove(index)}>
                          X
                        </Button>
                      </Grid>
                    </Grid>
                  ))}
                  <Button
                    variant="outlined"
                    onClick={() => oAppend({ productId: '', quantity: 1, price: 0 })}
                    sx={{ textTransform: 'none', borderColor: 'rgba(255,255,255,0.08)' }}
                  >
                    Add Line Item
                  </Button>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    label={`Discount (${currencySymbol})`}
                    type="number"
                    fullWidth
                    {...oReg('discount')}
                    sx={textFieldStyle}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    label="Internal Notes / Shipping Instructions"
                    multiline
                    rows={2}
                    fullWidth
                    {...oReg('notes')}
                    sx={textFieldStyle}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
              </Grid>
            </DialogContent>
            <DialogActions sx={{ p: 3, gap: 1.5 }}>
              <Button
                onClick={() => setOrderOpen(false)}
                sx={{ color: 'text.secondary', textTransform: 'none' }}
              >
                Cancel
              </Button>
              <Button
                variant="contained"
                type="submit"
                sx={{
                  px: 4,
                  py: 1.2,
                  fontWeight: 700,
                  background: 'linear-gradient(90deg, #8b5cf6 0%, #6366f1 100%)',
                }}
              >
                Confirm Order
              </Button>
            </DialogActions>
          </form>
        </Dialog>

        {/* Dispatch Shipment Dialog */}
        <Dialog
          open={shipOpen}
          onClose={() => setShipOpen(false)}
          maxWidth="sm"
          fullWidth
          PaperProps={{
            sx: {
              background:
                'linear-gradient(135deg, rgba(23, 27, 44, 0.98) 0%, rgba(11, 13, 26, 0.99) 100%)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(139, 92, 246, 0.2)',
              borderRadius: 4,
            },
          }}
        >
          <form onSubmit={sSubmit(onShipSubmit)}>
            <DialogTitle
              sx={{
                fontWeight: 800,
                background: 'linear-gradient(90deg, #fff 0%, #a78bfa 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              Dispatch Items for SO: {selectedSO?.orderNumber}
            </DialogTitle>
            <DialogContent sx={{ pt: 2 }}>
              <Grid container spacing={3}>
                <Grid item xs={12}>
                  <Typography
                    variant="subtitle2"
                    color="text.secondary"
                    sx={{ mb: 2, fontWeight: 700 }}
                  >
                    Record quantity shipped in dispatcher
                  </Typography>
                  {sFields.map((field, index) => (
                    <Grid container spacing={2} key={field.id} sx={{ mb: 2, alignItems: 'center' }}>
                      <Grid item xs={8}>
                        <Typography variant="body2" sx={{ fontWeight: 700 }}>
                          {sReg(`items.${index}.productName` as const) && field.productName}
                        </Typography>
                      </Grid>
                      <Grid item xs={4}>
                        <TextField
                          label="Qty Shipped"
                          type="number"
                          fullWidth
                          {...sReg(`items.${index}.quantityShipped` as const, {
                            required: true,
                            min: 0,
                          })}
                          sx={textFieldStyle}
                          InputLabelProps={{ shrink: true }}
                        />
                      </Grid>
                    </Grid>
                  ))}
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="Shipping Carrier"
                    fullWidth
                    {...sReg('carrier')}
                    sx={textFieldStyle}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="Tracking Number"
                    fullWidth
                    {...sReg('trackingNumber')}
                    sx={textFieldStyle}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
              </Grid>
            </DialogContent>
            <DialogActions sx={{ p: 3, gap: 1.5 }}>
              <Button
                onClick={() => setShipOpen(false)}
                sx={{ color: 'text.secondary', textTransform: 'none' }}
              >
                Cancel
              </Button>
              <Button
                variant="contained"
                type="submit"
                sx={{
                  px: 4,
                  py: 1.2,
                  fontWeight: 700,
                  background: 'linear-gradient(90deg, #8b5cf6 0%, #6366f1 100%)',
                }}
              >
                Dispatch Shipment
              </Button>
            </DialogActions>
          </form>
        </Dialog>
      </motion.div>
    </Box>
  );
}
