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
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useForm, useFieldArray } from 'react-hook-form';
import { apiClient } from '../../api/client.ts';
import { toast } from 'react-hot-toast';
import type { Product, Customer } from '../../../shared/types.js';
import { motion } from 'framer-motion';

const textFieldStyle = {};

interface SalesReturn {
  _id: string;
  returnNumber: string;
  customerId: { name: string; code: string };
  orderId?: { orderNumber: string };
  items: { productId: { name: string; sku: string }; quantity: number; refundAmount: number }[];
  reason: string;
  status: string;
  createdAt: string;
}

interface ReturnForm {
  customerId: string;
  orderId?: string;
  items: { productId: string; quantity: number; price: number; refundAmount: number }[];
  reason: string;
}

export default function SalesReturns() {
  const [open, setOpen] = useState(false);

  // Fetch Returns
  const { data: returns = [], refetch } = useQuery<SalesReturn[]>({
    queryKey: ['sales-returns'],
    queryFn: async () => {
      const { data } = await apiClient.get<SalesReturn[]>('/sales-returns');
      return data;
    },
  });

  // Fetch Customers
  const { data: customers = [] } = useQuery<Customer[]>({
    queryKey: ['customers'],
    queryFn: async () => {
      const { data } = await apiClient.get<Customer[]>('/customers');
      return data;
    },
  });

  // Fetch Products
  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ['products'],
    queryFn: async () => {
      const { data } = await apiClient.get<Product[]>('/products');
      return data;
    },
  });

  const { register, control, handleSubmit, reset } = useForm<ReturnForm>({
    defaultValues: {
      customerId: '',
      orderId: '',
      items: [{ productId: '', quantity: 1, price: 0, refundAmount: 0 }],
      reason: '',
    },
  });
  const { fields, append, remove } = useFieldArray({
    control,
    name: 'items',
  });

  const returnMutation = useMutation({
    mutationFn: async (payload: ReturnForm) => {
      return await apiClient.post('/sales-returns', payload);
    },
    onSuccess: () => {
      toast.success('Customer return processed and inventory updated!');
      setOpen(false);
      reset();
      refetch();
    },
    onError: (err: unknown) => {
      const apiErr = err as { response?: { data?: { error?: { message?: string } } } };
      const msg = apiErr.response?.data?.error?.message || 'Failed to process return.';
      toast.error(msg);
    },
  });

  const onSubmit = (data: ReturnForm) => {
    returnMutation.mutate({
      ...data,
      items: data.items.map((i) => ({
        ...i,
        quantity: Number(i.quantity),
        price: Number(i.price),
        refundAmount: Number(i.refundAmount),
      })),
    });
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
            Customer Returns & Refunds
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
            Process Return
          </Button>
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 4 }}>
          Register customer returns, reconcile returned products into active stock, and log refund
          parameters.
        </Typography>

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
                <TableCell sx={{ fontWeight: 800 }}>Return Number</TableCell>
                <TableCell sx={{ fontWeight: 800 }}>Client Customer</TableCell>
                <TableCell sx={{ fontWeight: 800 }}>Items Count</TableCell>
                <TableCell sx={{ fontWeight: 800 }}>Total Refund</TableCell>
                <TableCell sx={{ fontWeight: 800 }}>Reason / Notes</TableCell>
                <TableCell sx={{ fontWeight: 800 }}>Date</TableCell>
                <TableCell sx={{ fontWeight: 800 }}>Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {returns.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    align="center"
                    sx={{ py: 6, color: 'text.secondary', border: 'none' }}
                  >
                    No returns records logged.
                  </TableCell>
                </TableRow>
              ) : (
                returns.map((r) => (
                  <TableRow key={r._id} sx={{ '&:hover': { bgcolor: 'rgba(255,255,255,0.01)' } }}>
                    <TableCell sx={{ fontWeight: 700 }}>{r.returnNumber}</TableCell>
                    <TableCell>{r.customerId?.name || 'Walk-in Customer'}</TableCell>
                    <TableCell>{r.items.reduce((acc, i) => acc + i.quantity, 0)} items</TableCell>
                    <TableCell sx={{ fontWeight: 800 }}>
                      ${r.items.reduce((acc, i) => acc + i.refundAmount, 0).toFixed(2)}
                    </TableCell>
                    <TableCell color="text.secondary">{r.reason}</TableCell>
                    <TableCell>{new Date(r.createdAt).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <Chip
                        label={r.status}
                        size="small"
                        color="success"
                        sx={{ fontWeight: 700 }}
                      />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>

        {/* Process Return Dialog */}
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
              Process Customer Return & Refund
            </DialogTitle>
            <DialogContent sx={{ pt: 2 }}>
              <Grid container spacing={3}>
                <Grid item xs={12} sm={6}>
                  <TextField
                    select
                    label="Customer Link"
                    fullWidth
                    defaultValue=""
                    {...register('customerId', { required: true })}
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
                    label="Associated SO Number (Optional)"
                    fullWidth
                    {...register('orderId')}
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
                    Returned Line Items
                  </Typography>
                  {fields.map((field, index) => (
                    <Grid container spacing={2} key={field.id} sx={{ mb: 2, alignItems: 'center' }}>
                      <Grid item xs={4}>
                        <TextField
                          select
                          label="Product"
                          fullWidth
                          defaultValue=""
                          {...register(`items.${index}.productId` as const, { required: true })}
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
                      <Grid item xs={2}>
                        <TextField
                          label="Qty"
                          type="number"
                          fullWidth
                          {...register(`items.${index}.quantity` as const, { required: true })}
                          sx={textFieldStyle}
                          InputLabelProps={{ shrink: true }}
                        />
                      </Grid>
                      <Grid item xs={3}>
                        <TextField
                          label="Sale Price ($)"
                          type="number"
                          fullWidth
                          {...register(`items.${index}.price` as const, { required: true })}
                          sx={textFieldStyle}
                          InputLabelProps={{ shrink: true }}
                        />
                      </Grid>
                      <Grid item xs={2}>
                        <TextField
                          label="Refund ($)"
                          type="number"
                          fullWidth
                          {...register(`items.${index}.refundAmount` as const, { required: true })}
                          sx={textFieldStyle}
                          InputLabelProps={{ shrink: true }}
                        />
                      </Grid>
                      <Grid item xs={1}>
                        <Button color="error" onClick={() => remove(index)}>
                          X
                        </Button>
                      </Grid>
                    </Grid>
                  ))}
                  <Button
                    variant="outlined"
                    onClick={() =>
                      append({ productId: '', quantity: 1, price: 0, refundAmount: 0 })
                    }
                    sx={{ textTransform: 'none', borderColor: 'rgba(255,255,255,0.08)' }}
                  >
                    Add Line Item
                  </Button>
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    label="Reason for Return / Defect details"
                    multiline
                    rows={3}
                    fullWidth
                    {...register('reason', { required: true })}
                    sx={textFieldStyle}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
              </Grid>
            </DialogContent>
            <DialogActions sx={{ p: 3, gap: 1.5 }}>
              <Button
                onClick={() => setOpen(false)}
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
                Complete Return
              </Button>
            </DialogActions>
          </form>
        </Dialog>
      </motion.div>
    </Box>
  );
}
