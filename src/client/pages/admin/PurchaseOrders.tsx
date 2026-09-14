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
  IconButton,
  Tooltip,
  Tab,
  Tabs,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useForm, useFieldArray } from 'react-hook-form';
import { apiClient } from '../../api/client.ts';
import { toast } from 'react-hot-toast';
import type { Product, Supplier } from '../../../shared/types.js';
import { motion } from 'framer-motion';
import { usePermission } from '../../hooks/usePermission.js';

const textFieldStyle = {};

interface Requisition {
  _id: string;
  requisitionNumber: string;
  requestedBy: { username: string };
  items: {
    productId: { name: string; sku: string };
    quantity: number;
    estimatedCost: number;
  }[];
  status: 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED';
  notes?: string;
  createdAt: string;
}

interface PurchaseOrder {
  _id: string;
  poNumber: string;
  supplierId: { name: string; code: string };
  items: {
    productId: { name: string; sku: string };
    quantity: number;
    costPrice: number;
    receivedQuantity: number;
  }[];
  totalAmount: number;
  status:
    | 'DRAFT'
    | 'PENDING_APPROVAL'
    | 'APPROVED'
    | 'SENT'
    | 'PARTIALLY_RECEIVED'
    | 'RECEIVED'
    | 'BILLED'
    | 'CANCELLED';
  approvedBy?: { username: string };
  notes?: string;
  createdAt: string;
}

export default function PurchaseOrders() {
  const [activeTab, setActiveTab] = useState(0);
  const [prOpen, setPrOpen] = useState(false);
  const [poOpen, setPoOpen] = useState(false);

  const canWriteSuppliers = usePermission('suppliers:write');

  // Fetch requisitions
  const { data: requisitions = [], refetch: refetchPRs } = useQuery<Requisition[]>({
    queryKey: ['requisitions'],
    queryFn: async () => {
      const { data } = await apiClient.get<Requisition[]>('/requisitions');
      return data;
    },
  });

  // Fetch POs
  const { data: pos = [], refetch: refetchPOs } = useQuery<PurchaseOrder[]>({
    queryKey: ['purchase-orders'],
    queryFn: async () => {
      const { data } = await apiClient.get<PurchaseOrder[]>('/purchase-orders');
      return data;
    },
  });

  // Fetch suppliers list
  const { data: suppliers = [] } = useQuery<Supplier[]>({
    queryKey: ['suppliers'],
    queryFn: async () => {
      const { data } = await apiClient.get<Supplier[]>('/suppliers');
      return data;
    },
  });

  // Fetch products
  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ['products'],
    queryFn: async () => {
      const { data } = await apiClient.get<Product[]>('/products');
      return data;
    },
  });

  // PR Form
  const {
    register: prReg,
    control: prControl,
    handleSubmit: prSubmit,
    reset: prReset,
  } = useForm({
    defaultValues: {
      items: [{ productId: '', quantity: 1, estimatedCost: 0 }],
      notes: '',
    },
  });
  const {
    fields: prFields,
    append: prAppend,
    remove: prRemove,
  } = useFieldArray({
    control: prControl,
    name: 'items',
  });

  // PO Form
  const {
    register: poReg,
    control: poControl,
    handleSubmit: poSubmit,
    reset: poReset,
  } = useForm({
    defaultValues: {
      supplierId: '',
      items: [{ productId: '', quantity: 1, costPrice: 0 }],
      notes: '',
    },
  });
  const {
    fields: poFields,
    append: poAppend,
    remove: poRemove,
  } = useFieldArray({
    control: poControl,
    name: 'items',
  });

  interface PRPayload {
    items: { productId: string; quantity: number; estimatedCost: number }[];
    notes?: string;
  }

  interface POPayload {
    supplierId: string;
    items: { productId: string; quantity: number; costPrice: number }[];
    notes?: string;
  }

  const createPRMutation = useMutation({
    mutationFn: async (payload: PRPayload) => {
      return await apiClient.post('/requisitions', payload);
    },
    onSuccess: () => {
      toast.success('Requisition submitted for approval!');
      setPrOpen(false);
      prReset();
      refetchPRs();
    },
  });

  const approvePRMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiClient.put(`/requisitions/${id}/approve`);
    },
    onSuccess: () => {
      toast.success('Requisition approved!');
      refetchPRs();
    },
  });

  const rejectPRMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiClient.put(`/requisitions/${id}/reject`);
    },
    onSuccess: () => {
      toast.success('Requisition rejected.');
      refetchPRs();
    },
  });

  const createPOMutation = useMutation({
    mutationFn: async (payload: POPayload) => {
      return await apiClient.post('/purchase-orders', payload);
    },
    onSuccess: () => {
      toast.success('Purchase Order registered successfully!');
      setPoOpen(false);
      poReset();
      refetchPOs();
    },
  });

  const approvePOMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiClient.put(`/purchase-orders/${id}/approve`);
    },
    onSuccess: () => {
      toast.success('Purchase Order approved!');
      refetchPOs();
    },
  });

  const onPrSubmit = (data: PRPayload) => {
    createPRMutation.mutate(data);
  };

  const onPoSubmit = (data: POPayload) => {
    createPOMutation.mutate(data);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PENDING_APPROVAL':
        return 'warning';
      case 'APPROVED':
        return 'success';
      case 'REJECTED':
        return 'error';
      case 'SENT':
        return 'info';
      case 'PARTIALLY_RECEIVED':
        return 'primary';
      case 'RECEIVED':
        return 'success';
      case 'CANCELLED':
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
            Purchasing & Procurement
          </Typography>
          {canWriteSuppliers && (
            <Box sx={{ display: 'flex', gap: 2 }}>
              <Button
                variant="outlined"
                startIcon={<AddIcon />}
                onClick={() => setPrOpen(true)}
                sx={{ textTransform: 'none', px: 2, borderColor: 'rgba(255,255,255,0.08)' }}
              >
                New Requisition
              </Button>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => setPoOpen(true)}
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
                Create PO
              </Button>
            </Box>
          )}
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 4 }}>
          Control procurement replenishments, request approvals, and record purchase orders.
        </Typography>

        <Tabs
          value={activeTab}
          onChange={(_e, v) => setActiveTab(v)}
          sx={{ mb: 3, borderBottom: '1px solid rgba(255,255,255,0.08)' }}
        >
          <Tab label="Purchase Requisitions" sx={{ textTransform: 'none', fontWeight: 700 }} />
          <Tab label="Purchase Orders (PO)" sx={{ textTransform: 'none', fontWeight: 700 }} />
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
                  <TableCell sx={{ fontWeight: 800 }}>Requisition ID</TableCell>
                  <TableCell sx={{ fontWeight: 800 }}>Requested By</TableCell>
                  <TableCell sx={{ fontWeight: 800 }}>Lines Details</TableCell>
                  <TableCell sx={{ fontWeight: 800 }}>Status</TableCell>
                  <TableCell sx={{ fontWeight: 800 }}>Date</TableCell>
                  <TableCell sx={{ fontWeight: 800, textAlign: 'right' }}>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {requisitions.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      align="center"
                      sx={{ py: 6, color: 'text.secondary', border: 'none' }}
                    >
                      No requisitions logged.
                    </TableCell>
                  </TableRow>
                ) : (
                  requisitions.map((pr) => (
                    <TableRow
                      key={pr._id}
                      sx={{ '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.01)' } }}
                    >
                      <TableCell sx={{ fontWeight: 700 }}>{pr.requisitionNumber}</TableCell>
                      <TableCell>{pr.requestedBy?.username || 'Employee'}</TableCell>
                      <TableCell>
                        <Box>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            {pr.items.length} items
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            Estimated: $
                            {pr.items
                              .reduce((acc, i) => acc + i.estimatedCost * i.quantity, 0)
                              .toLocaleString()}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={pr.status}
                          size="small"
                          color={getStatusColor(pr.status)}
                          sx={{ fontWeight: 700 }}
                        />
                      </TableCell>
                      <TableCell>{new Date(pr.createdAt).toLocaleDateString()}</TableCell>
                      <TableCell sx={{ textAlign: 'right' }}>
                        {pr.status === 'PENDING_APPROVAL' && canWriteSuppliers && (
                          <>
                            <Tooltip title="Approve">
                              <IconButton
                                onClick={() => approvePRMutation.mutate(pr._id)}
                                sx={{ color: 'success.light' }}
                                size="small"
                              >
                                <CheckCircleIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Reject">
                              <IconButton
                                onClick={() => rejectPRMutation.mutate(pr._id)}
                                sx={{ color: 'error.light', ml: 1 }}
                                size="small"
                              >
                                <CancelIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </>
                        )}
                        {pr.status !== 'PENDING_APPROVAL' && (
                          <Typography variant="caption" color="text.secondary">
                            Processed
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
              border: '1px solid rgba(255, 255, 255, 0.05)',
              background:
                'linear-gradient(135deg, rgba(30, 41, 59, 0.6) 0%, rgba(15, 23, 42, 0.75) 100%)',
              borderRadius: 3,
            }}
          >
            <Table>
              <TableHead sx={{ bgcolor: 'rgba(17, 24, 39, 0.5)' }}>
                <TableRow>
                  <TableCell sx={{ fontWeight: 800 }}>PO Order Number</TableCell>
                  <TableCell sx={{ fontWeight: 800 }}>Vendor Supplier</TableCell>
                  <TableCell sx={{ fontWeight: 800 }}>Contract Total</TableCell>
                  <TableCell sx={{ fontWeight: 800 }}>Stock Received</TableCell>
                  <TableCell sx={{ fontWeight: 800 }}>Status</TableCell>
                  <TableCell sx={{ fontWeight: 800 }}>Date</TableCell>
                  <TableCell sx={{ fontWeight: 800, textAlign: 'right' }}>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {pos.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      align="center"
                      sx={{ py: 6, color: 'text.secondary', border: 'none' }}
                    >
                      No purchase orders recorded.
                    </TableCell>
                  </TableRow>
                ) : (
                  pos.map((po) => (
                    <TableRow
                      key={po._id}
                      sx={{ '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.01)' } }}
                    >
                      <TableCell sx={{ fontWeight: 700 }}>{po.poNumber}</TableCell>
                      <TableCell>{po.supplierId?.name || 'Supplier'}</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>
                        ${po.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell>
                        {po.items.reduce((acc, i) => acc + i.receivedQuantity, 0)} /{' '}
                        {po.items.reduce((acc, i) => acc + i.quantity, 0)} received
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={po.status}
                          size="small"
                          color={getStatusColor(po.status)}
                          sx={{ fontWeight: 700 }}
                        />
                      </TableCell>
                      <TableCell>{new Date(po.createdAt).toLocaleDateString()}</TableCell>
                      <TableCell sx={{ textAlign: 'right' }}>
                        {po.status === 'PENDING_APPROVAL' && canWriteSuppliers && (
                          <Button
                            variant="contained"
                            size="small"
                            onClick={() => approvePOMutation.mutate(po._id)}
                            sx={{
                              textTransform: 'none',
                              bgcolor: 'success.main',
                              '&:hover': { bgcolor: 'success.dark' },
                            }}
                          >
                            Approve PO
                          </Button>
                        )}
                        {po.status !== 'PENDING_APPROVAL' && (
                          <Typography variant="caption" color="text.secondary">
                            Order Active
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

        {/* PR Create Modal */}
        <Dialog
          open={prOpen}
          onClose={() => setPrOpen(false)}
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
          <form onSubmit={prSubmit(onPrSubmit)}>
            <DialogTitle
              sx={{
                fontWeight: 800,
                background: 'linear-gradient(90deg, #fff 0%, #a78bfa 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              Create Purchase Requisition Request
            </DialogTitle>
            <DialogContent sx={{ pt: 2 }}>
              <Grid container spacing={3}>
                <Grid item xs={12}>
                  <Typography
                    variant="subtitle2"
                    color="text.secondary"
                    sx={{ mb: 1, fontWeight: 700 }}
                  >
                    Replenishment Line Items
                  </Typography>
                  {prFields.map((field, index) => (
                    <Grid container spacing={2} key={field.id} sx={{ mb: 2, alignItems: 'center' }}>
                      <Grid item xs={5}>
                        <TextField
                          select
                          label="Select Product"
                          fullWidth
                          defaultValue=""
                          {...prReg(`items.${index}.productId` as const, { required: true })}
                          sx={textFieldStyle}
                          InputLabelProps={{ shrink: true }}
                        >
                          {products.map((p) => (
                            <MenuItem key={p._id || p.id} value={p._id || p.id}>
                              {p.name}
                            </MenuItem>
                          ))}
                        </TextField>
                      </Grid>
                      <Grid item xs={3}>
                        <TextField
                          label="Qty"
                          type="number"
                          fullWidth
                          {...prReg(`items.${index}.quantity` as const, { required: true })}
                          sx={textFieldStyle}
                          InputLabelProps={{ shrink: true }}
                        />
                      </Grid>
                      <Grid item xs={3}>
                        <TextField
                          label="Est. Cost Price ($)"
                          type="number"
                          fullWidth
                          {...prReg(`items.${index}.estimatedCost` as const, { required: true })}
                          sx={textFieldStyle}
                          InputLabelProps={{ shrink: true }}
                        />
                      </Grid>
                      <Grid item xs={1}>
                        <Button color="error" onClick={() => prRemove(index)}>
                          X
                        </Button>
                      </Grid>
                    </Grid>
                  ))}
                  <Button
                    variant="outlined"
                    onClick={() => prAppend({ productId: '', quantity: 1, estimatedCost: 0 })}
                    sx={{ textTransform: 'none', borderColor: 'rgba(255,255,255,0.08)' }}
                  >
                    Add Line Item
                  </Button>
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    label="Internal Notes / Justification details"
                    multiline
                    rows={3}
                    fullWidth
                    {...prReg('notes')}
                    sx={textFieldStyle}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
              </Grid>
            </DialogContent>
            <DialogActions sx={{ p: 3, gap: 1.5 }}>
              <Button
                onClick={() => setPrOpen(false)}
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
                Submit Requisition
              </Button>
            </DialogActions>
          </form>
        </Dialog>

        {/* PO Create Modal */}
        <Dialog
          open={poOpen}
          onClose={() => setPoOpen(false)}
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
          <form onSubmit={poSubmit(onPoSubmit)}>
            <DialogTitle
              sx={{
                fontWeight: 800,
                background: 'linear-gradient(90deg, #fff 0%, #a78bfa 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              Issue Purchase Order (PO) to Vendor
            </DialogTitle>
            <DialogContent sx={{ pt: 2 }}>
              <Grid container spacing={3}>
                <Grid item xs={12}>
                  <TextField
                    select
                    label="Select Target Supplier"
                    fullWidth
                    defaultValue=""
                    {...poReg('supplierId', { required: true })}
                    sx={textFieldStyle}
                    InputLabelProps={{ shrink: true }}
                  >
                    {suppliers.map((s) => (
                      <MenuItem key={s._id} value={s._id}>
                        {s.name} ({s.code})
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
                    Contract Order Items
                  </Typography>
                  {poFields.map((field, index) => (
                    <Grid container spacing={2} key={field.id} sx={{ mb: 2, alignItems: 'center' }}>
                      <Grid item xs={5}>
                        <TextField
                          select
                          label="Select Product"
                          fullWidth
                          defaultValue=""
                          {...poReg(`items.${index}.productId` as const, { required: true })}
                          sx={textFieldStyle}
                          InputLabelProps={{ shrink: true }}
                        >
                          {products.map((p) => (
                            <MenuItem key={p._id || p.id} value={p._id || p.id}>
                              {p.name}
                            </MenuItem>
                          ))}
                        </TextField>
                      </Grid>
                      <Grid item xs={3}>
                        <TextField
                          label="Qty"
                          type="number"
                          fullWidth
                          {...poReg(`items.${index}.quantity` as const, { required: true })}
                          sx={textFieldStyle}
                          InputLabelProps={{ shrink: true }}
                        />
                      </Grid>
                      <Grid item xs={3}>
                        <TextField
                          label="Negotiated Cost Price ($)"
                          type="number"
                          fullWidth
                          {...poReg(`items.${index}.costPrice` as const, { required: true })}
                          sx={textFieldStyle}
                          InputLabelProps={{ shrink: true }}
                        />
                      </Grid>
                      <Grid item xs={1}>
                        <Button color="error" onClick={() => poRemove(index)}>
                          X
                        </Button>
                      </Grid>
                    </Grid>
                  ))}
                  <Button
                    variant="outlined"
                    onClick={() => poAppend({ productId: '', quantity: 1, costPrice: 0 })}
                    sx={{ textTransform: 'none', borderColor: 'rgba(255,255,255,0.08)' }}
                  >
                    Add Line Item
                  </Button>
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    label="Supplier Delivery Notes / Terms specifications"
                    multiline
                    rows={3}
                    fullWidth
                    {...poReg('notes')}
                    sx={textFieldStyle}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
              </Grid>
            </DialogContent>
            <DialogActions sx={{ p: 3, gap: 1.5 }}>
              <Button
                onClick={() => setPoOpen(false)}
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
                Create Purchase Order
              </Button>
            </DialogActions>
          </form>
        </Dialog>
      </motion.div>
    </Box>
  );
}
