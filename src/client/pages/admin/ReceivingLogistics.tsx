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
import AssignmentReturnedIcon from '@mui/icons-material/AssignmentReturned';
import FactCheckIcon from '@mui/icons-material/FactCheck';
import PaymentIcon from '@mui/icons-material/Payment';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useForm, useFieldArray } from 'react-hook-form';
import { apiClient } from '../../api/client.ts';
import { toast } from 'react-hot-toast';
import { motion } from 'framer-motion';

const textFieldStyle = {};

interface PurchaseOrder {
  _id: string;
  poNumber: string;
  supplierId: { _id: string; name: string; code: string };
  items: {
    productId: { _id: string; name: string; sku: string };
    quantity: number;
    costPrice: number;
    receivedQuantity: number;
  }[];
  totalAmount: number;
  status: string;
}

interface Invoice {
  _id: string;
  invoiceNumber: string;
  supplierId: { name: string; code: string };
  poId: { poNumber: string; totalAmount: number };
  amount: number;
  dueDate: string;
  status: 'UNPAID' | 'PARTIALLY_PAID' | 'PAID' | 'OVERDUE';
}

export default function ReceivingLogistics() {
  const [activeTab, setActiveTab] = useState(0);
  const [receiveOpen, setReceiveOpen] = useState(false);
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const [selectedPO, setSelectedPO] = useState<PurchaseOrder | null>(null);

  // Fetch POs
  const { data: pos = [], refetch: refetchPOs } = useQuery<PurchaseOrder[]>({
    queryKey: ['purchase-orders'],
    queryFn: async () => {
      const { data } = await apiClient.get<PurchaseOrder[]>('/purchase-orders');
      return data;
    },
  });

  // Fetch Invoices
  const { data: invoices = [], refetch: refetchInvoices } = useQuery<Invoice[]>({
    queryKey: ['invoices'],
    queryFn: async () => {
      const { data } = await apiClient.get<Invoice[]>('/invoices');
      return data;
    },
  });

  // Receive Form
  const {
    register: recReg,
    control: recControl,
    handleSubmit: recSubmit,
    reset: recReset,
  } = useForm({
    defaultValues: {
      items: [{ productId: '', quantityReceived: 0, productName: '' }],
      notes: '',
    },
  });
  const { fields: recFields } = useFieldArray({
    control: recControl,
    name: 'items',
  });

  // Invoice Form
  const {
    register: invReg,
    handleSubmit: invSubmit,
    reset: invReset,
  } = useForm({
    defaultValues: {
      invoiceNumber: '',
      poId: '',
      supplierId: '',
      amount: 0,
      dueDate: '',
      paymentTerms: 'NET 30',
      notes: '',
    },
  });

  interface ReceivePayload {
    items: { productId: string; quantityReceived: number; productName?: string }[];
    notes?: string;
  }

  interface InvoicePayload {
    invoiceNumber: string;
    poId: string;
    supplierId: string;
    amount: number;
    dueDate: string;
    paymentTerms: string;
    notes?: string;
  }

  const receiveMutation = useMutation({
    mutationFn: async (payload: ReceivePayload) => {
      return await apiClient.post(`/purchase-orders/${selectedPO?._id}/receive`, payload);
    },
    onSuccess: () => {
      toast.success('Goods receipt recorded successfully!');
      setReceiveOpen(false);
      recReset();
      refetchPOs();
    },
    onError: (err: unknown) => {
      const apiErr = err as { response?: { data?: { error?: { message?: string } } } };
      const msg = apiErr.response?.data?.error?.message || 'Failed to receive goods.';
      toast.error(msg);
    },
  });

  const createInvoiceMutation = useMutation({
    mutationFn: async (payload: InvoicePayload) => {
      return await apiClient.post('/invoices', payload);
    },
    onSuccess: () => {
      toast.success('Invoice matched and accounts payable logged!');
      setInvoiceOpen(false);
      invReset();
      refetchInvoices();
      refetchPOs();
    },
    onError: (err: unknown) => {
      const apiErr = err as { response?: { data?: { error?: { message?: string } } } };
      const msg = apiErr.response?.data?.error?.message || 'Failed to match invoice.';
      toast.error(msg);
    },
  });

  const payInvoiceMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiClient.put(`/invoices/${id}/pay`);
    },
    onSuccess: () => {
      toast.success('Invoice payment registered successfully!');
      refetchInvoices();
    },
  });

  const handleOpenReceive = (po: PurchaseOrder) => {
    setSelectedPO(po);
    // Prefill items with remaining quantity needed
    const prefill = po.items.map((i) => ({
      productId: i.productId._id,
      quantityReceived: i.quantity - i.receivedQuantity,
      productName: i.productId.name,
    }));
    recReset({
      items: prefill,
      notes: '',
    });
    setReceiveOpen(true);
  };

  const handleOpenInvoice = (po: PurchaseOrder) => {
    invReset({
      invoiceNumber: `INV-${Date.now()}`,
      poId: po._id,
      supplierId: po.supplierId._id,
      amount: po.totalAmount,
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      paymentTerms: 'NET 30',
      notes: `Invoice matching Purchase Order ${po.poNumber}`,
    });
    setInvoiceOpen(true);
  };

  const onRecSubmit = (data: ReceivePayload) => {
    receiveMutation.mutate({
      items: data.items.map((i) => ({
        productId: i.productId,
        quantityReceived: Number(i.quantityReceived),
      })),
      notes: data.notes,
    });
  };

  const onInvSubmit = (data: InvoicePayload) => {
    createInvoiceMutation.mutate({
      ...data,
      amount: Number(data.amount),
    });
  };

  // filter only POs that are APPROVED, SENT, PARTIALLY_RECEIVED
  const pendingReceivePOs = pos.filter((po) =>
    ['APPROVED', 'SENT', 'PARTIALLY_RECEIVED'].includes(po.status)
  );

  return (
    <Box sx={{ p: { xs: 2, md: 4 } }}>
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <Box sx={{ mb: 1 }}>
          <Typography
            variant="h4"
            sx={{
              fontWeight: 800,
              background: 'linear-gradient(90deg, #fff 0%, #a78bfa 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            Logistics & Accounts Payable
          </Typography>
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 4 }}>
          Receive warehouse shipments, execute stock matching, and reconcile accounts payable
          invoices.
        </Typography>

        <Tabs
          value={activeTab}
          onChange={(_e, v) => setActiveTab(v)}
          sx={{ mb: 3, borderBottom: '1px solid rgba(255,255,255,0.08)' }}
        >
          <Tab label="Goods Receiving (GRN)" sx={{ textTransform: 'none', fontWeight: 700 }} />
          <Tab label="Accounts Payable Invoices" sx={{ textTransform: 'none', fontWeight: 700 }} />
        </Tabs>

        {activeTab === 0 && (
          <TableContainer
            component={Paper}
            className="glass-panel"
            sx={{
              border: '1px solid rgba(255, 255, 255, 0.05)',
              background:
                'linear-gradient(135deg, rgba(30, 41, 59, 0.6) 0%, rgba(15, 23, 42, 0.75) 100%)',
              borderRadius: 3,
            }}
          >
            <Table>
              <TableHead sx={{ bgcolor: 'rgba(17, 24, 39, 0.5)' }}>
                <TableRow>
                  <TableCell sx={{ fontWeight: 800 }}>Purchase Order</TableCell>
                  <TableCell sx={{ fontWeight: 800 }}>Vendor Supplier</TableCell>
                  <TableCell sx={{ fontWeight: 800 }}>Items Receiving Status</TableCell>
                  <TableCell sx={{ fontWeight: 800 }}>Status</TableCell>
                  <TableCell sx={{ fontWeight: 800, textAlign: 'right' }}>
                    Logistics Actions
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {pendingReceivePOs.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      align="center"
                      sx={{ py: 6, color: 'text.secondary', border: 'none' }}
                    >
                      No active purchase orders pending reception.
                    </TableCell>
                  </TableRow>
                ) : (
                  pendingReceivePOs.map((po) => (
                    <TableRow
                      key={po._id}
                      sx={{ '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.01)' } }}
                    >
                      <TableCell sx={{ fontWeight: 700 }}>{po.poNumber}</TableCell>
                      <TableCell>{po.supplierId?.name || 'Supplier'}</TableCell>
                      <TableCell>
                        <Box>
                          <Typography variant="body2" sx={{ fontWeight: 700 }}>
                            {po.items.reduce((acc, i) => acc + i.receivedQuantity, 0)} /{' '}
                            {po.items.reduce((acc, i) => acc + i.quantity, 0)} received
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={po.status}
                          size="small"
                          color="primary"
                          sx={{ fontWeight: 700 }}
                        />
                      </TableCell>
                      <TableCell sx={{ textAlign: 'right' }}>
                        <Button
                          variant="contained"
                          size="small"
                          startIcon={<AssignmentReturnedIcon />}
                          onClick={() => handleOpenReceive(po)}
                          sx={{
                            textTransform: 'none',
                            background: 'linear-gradient(90deg, #8b5cf6 0%, #6366f1 100%)',
                          }}
                        >
                          Receive Stock
                        </Button>
                        <Button
                          variant="outlined"
                          size="small"
                          startIcon={<FactCheckIcon />}
                          onClick={() => handleOpenInvoice(po)}
                          sx={{
                            textTransform: 'none',
                            ml: 1.5,
                            borderColor: 'rgba(255,255,255,0.08)',
                          }}
                        >
                          Match Invoice
                        </Button>
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
              border: '1px solid rgba(255, 255, 255, 0.05)',
              background:
                'linear-gradient(135deg, rgba(30, 41, 59, 0.6) 0%, rgba(15, 23, 42, 0.75) 100%)',
              borderRadius: 3,
            }}
          >
            <Table>
              <TableHead sx={{ bgcolor: 'rgba(17, 24, 39, 0.5)' }}>
                <TableRow>
                  <TableCell sx={{ fontWeight: 800 }}>Invoice Number</TableCell>
                  <TableCell sx={{ fontWeight: 800 }}>Vendor Supplier</TableCell>
                  <TableCell sx={{ fontWeight: 800 }}>Matched PO</TableCell>
                  <TableCell sx={{ fontWeight: 800 }}>Due Date</TableCell>
                  <TableCell sx={{ fontWeight: 800 }}>Invoice Amount</TableCell>
                  <TableCell sx={{ fontWeight: 800 }}>Payment Status</TableCell>
                  <TableCell sx={{ fontWeight: 800, textAlign: 'right' }}>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {invoices.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      align="center"
                      sx={{ py: 6, color: 'text.secondary', border: 'none' }}
                    >
                      No AP invoices recorded.
                    </TableCell>
                  </TableRow>
                ) : (
                  invoices.map((inv) => (
                    <TableRow
                      key={inv._id}
                      sx={{ '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.01)' } }}
                    >
                      <TableCell sx={{ fontWeight: 700 }}>{inv.invoiceNumber}</TableCell>
                      <TableCell>{inv.supplierId?.name || 'Supplier'}</TableCell>
                      <TableCell sx={{ fontWeight: 600, color: 'primary.light' }}>
                        {inv.poId?.poNumber || 'PO'}
                      </TableCell>
                      <TableCell>{new Date(inv.dueDate).toLocaleDateString()}</TableCell>
                      <TableCell sx={{ fontWeight: 800 }}>
                        ${inv.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={inv.status}
                          size="small"
                          color={inv.status === 'PAID' ? 'success' : 'warning'}
                          sx={{ fontWeight: 700 }}
                        />
                      </TableCell>
                      <TableCell sx={{ textAlign: 'right' }}>
                        {inv.status !== 'PAID' && (
                          <Button
                            variant="contained"
                            size="small"
                            startIcon={<PaymentIcon />}
                            onClick={() => payInvoiceMutation.mutate(inv._id)}
                            sx={{
                              textTransform: 'none',
                              bgcolor: 'success.main',
                              '&:hover': { bgcolor: 'success.dark' },
                            }}
                          >
                            Mark Paid
                          </Button>
                        )}
                        {inv.status === 'PAID' && (
                          <Typography variant="caption" color="text.secondary">
                            Paid Reconciled
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

        {/* Goods Receive Dialog */}
        <Dialog
          open={receiveOpen}
          onClose={() => setReceiveOpen(false)}
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
          <form onSubmit={recSubmit(onRecSubmit)}>
            <DialogTitle
              sx={{
                fontWeight: 800,
                background: 'linear-gradient(90deg, #fff 0%, #a78bfa 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              Receive Stock for PO: {selectedPO?.poNumber}
            </DialogTitle>
            <DialogContent sx={{ pt: 2 }}>
              <Grid container spacing={3}>
                <Grid item xs={12}>
                  <Typography
                    variant="subtitle2"
                    color="text.secondary"
                    sx={{ mb: 2, fontWeight: 700 }}
                  >
                    Record quantity arriving in warehouse
                  </Typography>
                  {recFields.map((field, index) => (
                    <Grid container spacing={2} key={field.id} sx={{ mb: 2, alignItems: 'center' }}>
                      <Grid item xs={8}>
                        <Typography variant="body2" sx={{ fontWeight: 700 }}>
                          {recReg(`items.${index}.productName` as const) && field.productName}
                        </Typography>
                      </Grid>
                      <Grid item xs={4}>
                        <TextField
                          label="Qty Received"
                          type="number"
                          fullWidth
                          {...recReg(`items.${index}.quantityReceived` as const, {
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
                <Grid item xs={12}>
                  <TextField
                    label="Receiving notes / comments"
                    multiline
                    rows={3}
                    fullWidth
                    {...recReg('notes')}
                    sx={textFieldStyle}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
              </Grid>
            </DialogContent>
            <DialogActions sx={{ p: 3, gap: 1.5 }}>
              <Button
                onClick={() => setReceiveOpen(false)}
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
                Submit Goods Receipt
              </Button>
            </DialogActions>
          </form>
        </Dialog>

        {/* Invoice Match Dialog */}
        <Dialog
          open={invoiceOpen}
          onClose={() => setInvoiceOpen(false)}
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
          <form onSubmit={invSubmit(onInvSubmit)}>
            <DialogTitle
              sx={{
                fontWeight: 800,
                background: 'linear-gradient(90deg, #fff 0%, #a78bfa 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              Reconcile & Match Supplier Invoice
            </DialogTitle>
            <DialogContent sx={{ pt: 2 }}>
              <Grid container spacing={3}>
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="Invoice Number Reference"
                    fullWidth
                    {...invReg('invoiceNumber', { required: true })}
                    sx={textFieldStyle}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="Invoice Amount ($)"
                    type="number"
                    fullWidth
                    {...invReg('amount', { required: true })}
                    sx={textFieldStyle}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="Payment Due Date"
                    type="date"
                    fullWidth
                    {...invReg('dueDate', { required: true })}
                    sx={textFieldStyle}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    select
                    label="Terms"
                    fullWidth
                    defaultValue="NET 30"
                    {...invReg('paymentTerms')}
                    sx={textFieldStyle}
                    InputLabelProps={{ shrink: true }}
                  >
                    <MenuItem value="NET 15">NET 15</MenuItem>
                    <MenuItem value="NET 30">NET 30</MenuItem>
                    <MenuItem value="NET 60">NET 60</MenuItem>
                    <MenuItem value="Due on Receipt">Due on Receipt</MenuItem>
                  </TextField>
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    label="AP Notes / Audit details"
                    multiline
                    rows={3}
                    fullWidth
                    {...invReg('notes')}
                    sx={textFieldStyle}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
              </Grid>
            </DialogContent>
            <DialogActions sx={{ p: 3, gap: 1.5 }}>
              <Button
                onClick={() => setInvoiceOpen(false)}
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
                Reconcile Invoice
              </Button>
            </DialogActions>
          </form>
        </Dialog>
      </motion.div>
    </Box>
  );
}
