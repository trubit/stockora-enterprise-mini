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
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useForm, useFieldArray } from 'react-hook-form';
import { apiClient } from '../../api/client.ts';
import { toast } from 'react-hot-toast';
import type { Product } from '../../../shared/types.js';
import { motion } from 'framer-motion';

const textFieldStyle = {};

interface Warehouse {
  _id: string;
  name: string;
  code: string;
}

interface TransferItem {
  productId: string;
  quantity: number;
}

interface Transfer {
  _id: string;
  transferNumber: string;
  fromWarehouseId: {
    _id: string;
    name: string;
    code: string;
  };
  toWarehouseId: {
    _id: string;
    name: string;
    code: string;
  };
  items: {
    productId: {
      name: string;
      sku: string;
    };
    quantity: number;
  }[];
  status: 'PENDING' | 'IN_TRANSIT' | 'COMPLETED' | 'CANCELLED';
  shippedAt?: string;
  receivedAt?: string;
  notes?: string;
  createdBy: {
    username: string;
  };
  receivedBy?: {
    username: string;
  };
  createdAt: string;
}

interface TransferForm {
  fromWarehouseId: string;
  toWarehouseId: string;
  items: TransferItem[];
  notes?: string;
}

export default function WarehouseTransfers() {
  const [open, setOpen] = useState(false);

  // Fetch transfers list
  const { data: transfers = [], refetch } = useQuery<Transfer[]>({
    queryKey: ['transfers'],
    queryFn: async () => {
      const { data } = await apiClient.get<Transfer[]>('/transfers');
      return data;
    },
  });

  // Fetch warehouses for selection
  const { data: warehouses = [] } = useQuery<Warehouse[]>({
    queryKey: ['warehouses'],
    queryFn: async () => {
      const { data } = await apiClient.get<Warehouse[]>('/org/warehouses');
      return data;
    },
  });

  // Fetch products for selection
  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ['products'],
    queryFn: async () => {
      const { data } = await apiClient.get<Product[]>('/products');
      return data;
    },
  });

  const { register, control, handleSubmit, reset } = useForm<TransferForm>({
    defaultValues: {
      fromWarehouseId: '',
      toWarehouseId: '',
      items: [{ productId: '', quantity: 1 }],
      notes: '',
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'items',
  });

  const createMutation = useMutation({
    mutationFn: async (payload: TransferForm) => {
      return await apiClient.post('/transfers', payload);
    },
    onSuccess: () => {
      toast.success('Warehouse transfer created successfully!');
      setOpen(false);
      reset();
      refetch();
    },
    onError: (err: unknown) => {
      const apiErr = err as { response?: { data?: { error?: { message?: string } } } };
      const msg = apiErr.response?.data?.error?.message || 'Failed to create transfer.';
      toast.error(msg);
    },
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      return await apiClient.put(`/transfers/${id}/status`, { status });
    },
    onSuccess: () => {
      toast.success('Transfer status updated successfully!');
      refetch();
    },
    onError: (err: unknown) => {
      const apiErr = err as { response?: { data?: { error?: { message?: string } } } };
      const msg = apiErr.response?.data?.error?.message || 'Failed to update transfer status.';
      toast.error(msg);
    },
  });

  const onSubmit = (data: TransferForm) => {
    createMutation.mutate({
      ...data,
      items: data.items.map((i) => ({ ...i, quantity: Number(i.quantity) })),
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PENDING':
        return 'warning';
      case 'IN_TRANSIT':
        return 'primary';
      case 'COMPLETED':
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
            Warehouse Transfers
          </Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setOpen(true)}
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
            Create Transfer
          </Button>
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 4 }}>
          Monitor intra-warehouse shipments, dispatch orders, and verify stock shipments receipt.
        </Typography>

        <TableContainer
          component={Paper}
          className="glass-panel"
          sx={{
            border: '1px solid rgba(255, 255, 255, 0.05)',
            background:
              'linear-gradient(135deg, rgba(30, 41, 59, 0.6) 0%, rgba(15, 23, 42, 0.75) 100%)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
            borderRadius: 3,
          }}
        >
          <Table>
            <TableHead sx={{ bgcolor: 'rgba(17, 24, 39, 0.5)' }}>
              <TableRow>
                <TableCell
                  sx={{ fontWeight: 800, borderBottom: '1px solid rgba(255,255,255,0.05)' }}
                >
                  Transfer Order
                </TableCell>
                <TableCell
                  sx={{ fontWeight: 800, borderBottom: '1px solid rgba(255,255,255,0.05)' }}
                >
                  Logistics Path
                </TableCell>
                <TableCell
                  sx={{ fontWeight: 800, borderBottom: '1px solid rgba(255,255,255,0.05)' }}
                >
                  Items Count
                </TableCell>
                <TableCell
                  sx={{ fontWeight: 800, borderBottom: '1px solid rgba(255,255,255,0.05)' }}
                >
                  Status
                </TableCell>
                <TableCell
                  sx={{ fontWeight: 800, borderBottom: '1px solid rgba(255,255,255,0.05)' }}
                >
                  Dispatched By
                </TableCell>
                <TableCell
                  sx={{
                    fontWeight: 800,
                    borderBottom: '1px solid rgba(255,255,255,0.05)',
                    textAlign: 'right',
                  }}
                >
                  Actions
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {transfers.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    align="center"
                    sx={{ py: 6, color: 'text.secondary', border: 'none' }}
                  >
                    No warehouse transfers logged.
                  </TableCell>
                </TableRow>
              ) : (
                transfers.map((t) => (
                  <TableRow
                    key={t._id}
                    sx={{ '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.01)' } }}
                  >
                    <TableCell
                      sx={{
                        borderBottom: '1px solid rgba(255,255,255,0.03)',
                        py: 2,
                        fontWeight: 700,
                      }}
                    >
                      <Box>
                        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                          {t.transferNumber}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {new Date(t.createdAt).toLocaleDateString()}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell sx={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {t.fromWarehouseId?.name || 'Origin'} →{' '}
                        {t.toWarehouseId?.name || 'Destination'}
                      </Typography>
                    </TableCell>
                    <TableCell
                      sx={{ borderBottom: '1px solid rgba(255,255,255,0.03)', fontWeight: 600 }}
                    >
                      {t.items.reduce((acc, i) => acc + i.quantity, 0)} units
                    </TableCell>
                    <TableCell sx={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                      <Chip
                        label={t.status}
                        size="small"
                        color={getStatusColor(t.status)}
                        sx={{ fontWeight: 700 }}
                      />
                    </TableCell>
                    <TableCell
                      sx={{ borderBottom: '1px solid rgba(255,255,255,0.03)', fontWeight: 500 }}
                    >
                      {t.createdBy?.username || 'Employee'}
                    </TableCell>
                    <TableCell
                      sx={{ borderBottom: '1px solid rgba(255,255,255,0.03)', textAlign: 'right' }}
                    >
                      {t.status === 'PENDING' && (
                        <>
                          <Tooltip title="Ship Transfer">
                            <IconButton
                              onClick={() =>
                                statusMutation.mutate({ id: t._id, status: 'IN_TRANSIT' })
                              }
                              sx={{ color: 'primary.light' }}
                              size="small"
                            >
                              <LocalShippingIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Cancel Transfer">
                            <IconButton
                              onClick={() =>
                                statusMutation.mutate({ id: t._id, status: 'CANCELLED' })
                              }
                              sx={{ color: 'error.light', ml: 1 }}
                              size="small"
                            >
                              <CancelIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </>
                      )}
                      {t.status === 'IN_TRANSIT' && (
                        <>
                          <Tooltip title="Receive / Complete">
                            <IconButton
                              onClick={() =>
                                statusMutation.mutate({ id: t._id, status: 'COMPLETED' })
                              }
                              sx={{ color: 'success.light' }}
                              size="small"
                            >
                              <CheckCircleIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Cancel Transfer">
                            <IconButton
                              onClick={() =>
                                statusMutation.mutate({ id: t._id, status: 'CANCELLED' })
                              }
                              sx={{ color: 'error.light', ml: 1 }}
                              size="small"
                            >
                              <CancelIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </>
                      )}
                      {(t.status === 'COMPLETED' || t.status === 'CANCELLED') && (
                        <Typography variant="caption" color="text.secondary">
                          Order Closed
                        </Typography>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>

        <Dialog
          open={open}
          onClose={() => setOpen(false)}
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
          <form onSubmit={handleSubmit(onSubmit)}>
            <DialogTitle
              sx={{
                fontWeight: 800,
                background: 'linear-gradient(90deg, #fff 0%, #a78bfa 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              Create Warehouse Transfer Shipment
            </DialogTitle>
            <DialogContent sx={{ pt: 2 }}>
              <Grid container spacing={3}>
                <Grid item xs={12} sm={6}>
                  <TextField
                    select
                    label="Source Warehouse"
                    fullWidth
                    defaultValue=""
                    {...register('fromWarehouseId', { required: true })}
                    sx={textFieldStyle}
                    InputLabelProps={{ shrink: true }}
                  >
                    {warehouses.map((w) => (
                      <MenuItem key={w._id} value={w._id}>
                        {w.name} ({w.code})
                      </MenuItem>
                    ))}
                  </TextField>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    select
                    label="Destination Warehouse"
                    fullWidth
                    defaultValue=""
                    {...register('toWarehouseId', { required: true })}
                    sx={textFieldStyle}
                    InputLabelProps={{ shrink: true }}
                  >
                    {warehouses.map((w) => (
                      <MenuItem key={w._id} value={w._id}>
                        {w.name} ({w.code})
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
                    Transfer Items
                  </Typography>
                  {fields.map((field, index) => (
                    <Grid container spacing={2} key={field.id} sx={{ mb: 2, alignItems: 'center' }}>
                      <Grid item xs={7}>
                        <TextField
                          select
                          label={`Product ${index + 1}`}
                          fullWidth
                          defaultValue=""
                          {...register(`items.${index}.productId`, { required: true })}
                          sx={textFieldStyle}
                          InputLabelProps={{ shrink: true }}
                        >
                          {products.map((p) => (
                            <MenuItem key={p._id || p.id} value={p._id || p.id}>
                              {p.name} ({p.sku}) — Avail: {p.quantity}
                            </MenuItem>
                          ))}
                        </TextField>
                      </Grid>
                      <Grid item xs={3}>
                        <TextField
                          label="Qty"
                          type="number"
                          fullWidth
                          {...register(`items.${index}.quantity`, { required: true, min: 1 })}
                          sx={textFieldStyle}
                          InputLabelProps={{ shrink: true }}
                        />
                      </Grid>
                      <Grid item xs={2}>
                        <Button
                          color="error"
                          onClick={() => remove(index)}
                          sx={{ fontWeight: 700 }}
                        >
                          Remove
                        </Button>
                      </Grid>
                    </Grid>
                  ))}
                  <Button
                    variant="outlined"
                    startIcon={<AddIcon />}
                    onClick={() => append({ productId: '', quantity: 1 })}
                    sx={{ textTransform: 'none', borderColor: 'rgba(255,255,255,0.08)' }}
                  >
                    Add Line Item
                  </Button>
                </Grid>

                <Grid item xs={12}>
                  <TextField
                    label="Shipment Notes / Reference Info"
                    multiline
                    rows={3}
                    fullWidth
                    {...register('notes')}
                    sx={textFieldStyle}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
              </Grid>
            </DialogContent>
            <DialogActions sx={{ p: 3, gap: 1.5 }}>
              <Button
                onClick={() => setOpen(false)}
                sx={{ color: 'text.secondary', textTransform: 'none', fontWeight: 600 }}
              >
                Cancel
              </Button>
              <Button
                variant="contained"
                type="submit"
                startIcon={<LocalShippingIcon />}
                sx={{
                  px: 4,
                  py: 1.2,
                  fontWeight: 700,
                  background: 'linear-gradient(90deg, #8b5cf6 0%, #6366f1 100%)',
                }}
              >
                Create Transfer
              </Button>
            </DialogActions>
          </form>
        </Dialog>
      </motion.div>
    </Box>
  );
}
