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
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import CardGiftcardIcon from '@mui/icons-material/CardGiftcard';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { apiClient } from '../../api/client.ts';
import { notify } from '../../utils/notify.ts';
import { useConfirm } from '../../context/ConfirmDialogContext.tsx';
import type { Customer } from '../../../shared/types.js';
import { motion } from 'framer-motion';
import { Can } from '../../components/auth/Can.tsx';

const textFieldStyle = {};

export default function Customers() {
  const confirm = useConfirm();
  const [open, setOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const { data: customers = [], refetch } = useQuery({
    queryKey: ['customers'],
    queryFn: async () => {
      const { data } = await apiClient.get<Customer[]>('/customers');
      return data;
    },
  });

  const { register, handleSubmit, reset } = useForm<Customer>({
    defaultValues: {
      name: '',
      code: '',
      email: '',
      phone: '',
      group: 'RETAIL',
      creditLimit: 0,
      loyaltyPoints: 0,
      billingAddress: '',
      shippingAddress: '',
      isActive: true,
      notes: '',
    },
  });

  const createMutation = useMutation({
    mutationFn: async (newCustomer: Customer) => {
      return await apiClient.post('/customers', newCustomer);
    },
    onSuccess: () => {
      notify.success('Customer created successfully!');
      setOpen(false);
      reset();
      refetch();
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (updatedCustomer: Customer) => {
      return await apiClient.put(
        `/customers/${editingCustomer?._id || editingCustomer?.id}`,
        updatedCustomer
      );
    },
    onSuccess: () => {
      notify.success('Customer updated successfully!');
      setOpen(false);
      setEditingCustomer(null);
      reset();
      refetch();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiClient.delete(`/customers/${id}`);
    },
    onSuccess: () => {
      notify.success('Customer deactivated successfully.');
      refetch();
    },
  });

  const handleOpenCreate = () => {
    setEditingCustomer(null);
    reset({
      name: '',
      code: '',
      email: '',
      phone: '',
      group: 'RETAIL',
      creditLimit: 0,
      loyaltyPoints: 0,
      billingAddress: '',
      shippingAddress: '',
      isActive: true,
      notes: '',
    });
    setOpen(true);
  };

  const handleOpenEdit = (customer: Customer) => {
    setEditingCustomer(customer);
    reset(customer);
    setOpen(true);
  };

  const onSubmit = (data: Customer) => {
    const payload = {
      ...data,
      creditLimit: Number(data.creditLimit || 0),
      loyaltyPoints: Number(data.loyaltyPoints || 0),
    };
    if (editingCustomer) {
      updateMutation.mutate(payload);
    } else {
      createMutation.mutate(payload);
    }
  };

  const filteredCustomers = customers.filter(
    (c) =>
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
            Customer Directory
          </Typography>
          <Can permission="customers:write">
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={handleOpenCreate}
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
              Add Customer
            </Button>
          </Can>
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 4 }}>
          Manage wholesale and retail customers, loyalty point balances, and billing profiles.
        </Typography>

        <Box sx={{ mb: 3 }}>
          <TextField
            label="Search Customers by Name, Code, or Email..."
            fullWidth
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            sx={textFieldStyle}
          />
        </Box>

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
                  Customer
                </TableCell>
                <TableCell
                  sx={{ fontWeight: 800, borderBottom: '1px solid rgba(255,255,255,0.05)' }}
                >
                  Code
                </TableCell>
                <TableCell
                  sx={{ fontWeight: 800, borderBottom: '1px solid rgba(255,255,255,0.05)' }}
                >
                  Group
                </TableCell>
                <TableCell
                  sx={{ fontWeight: 800, borderBottom: '1px solid rgba(255,255,255,0.05)' }}
                >
                  Loyalty Points
                </TableCell>
                <TableCell
                  sx={{ fontWeight: 800, borderBottom: '1px solid rgba(255,255,255,0.05)' }}
                >
                  Credit Limit
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
              {filteredCustomers.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    align="center"
                    sx={{ py: 6, color: 'text.secondary', border: 'none' }}
                  >
                    No customers registered.
                  </TableCell>
                </TableRow>
              ) : (
                filteredCustomers.map((c) => (
                  <TableRow
                    key={c._id || c.id}
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
                          {c.name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {c.email} {c.phone ? `| ${c.phone}` : ''}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell sx={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                      <Chip
                        label={c.code}
                        size="small"
                        variant="outlined"
                        sx={{ fontWeight: 700, color: 'secondary.light' }}
                      />
                    </TableCell>
                    <TableCell sx={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                      <Chip
                        label={c.group}
                        size="small"
                        color={
                          c.group === 'VIP'
                            ? 'secondary'
                            : c.group === 'WHOLESALE'
                              ? 'primary'
                              : 'default'
                        }
                        sx={{ fontWeight: 700, fontSize: '0.75rem' }}
                      />
                    </TableCell>
                    <TableCell sx={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <CardGiftcardIcon sx={{ color: 'primary.light', fontSize: '1rem' }} />
                        <Typography variant="body2" sx={{ fontWeight: 700 }}>
                          {c.loyaltyPoints} pts
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell
                      sx={{ borderBottom: '1px solid rgba(255,255,255,0.03)', fontWeight: 700 }}
                    >
                      ${Number(c.creditLimit || 0).toLocaleString()}
                    </TableCell>
                    <TableCell
                      sx={{ borderBottom: '1px solid rgba(255,255,255,0.03)', textAlign: 'right' }}
                    >
                      <Can permission="customers:write">
                        <Tooltip title="Edit Customer">
                          <IconButton
                            onClick={() => handleOpenEdit(c)}
                            sx={{ color: 'primary.light' }}
                            size="small"
                          >
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Deactivate">
                          <IconButton
                            onClick={async () => {
                              if (!c._id) return;
                              const confirmed = await confirm({
                                title: 'Deactivate Customer',
                                message: `Are you sure you want to deactivate customer "${c.name}" (${c.code})? They will no longer be eligible for new sales orders or credit terms.`,
                                confirmText: 'Deactivate',
                                severity: 'error',
                              });
                              if (confirmed) {
                                deleteMutation.mutate(c._id);
                              }
                            }}
                            sx={{ color: 'error.light', ml: 1 }}
                            size="small"
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Can>
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
              {editingCustomer ? 'Modify Customer Record' : 'Register New Customer Account'}
            </DialogTitle>
            <DialogContent sx={{ pt: 2 }}>
              <Grid container spacing={3}>
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="Customer Name"
                    fullWidth
                    {...register('name', { required: true })}
                    sx={textFieldStyle}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="Customer Code (e.g., CUST-789)"
                    fullWidth
                    {...register('code', { required: true })}
                    sx={textFieldStyle}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="Email Address"
                    type="email"
                    fullWidth
                    {...register('email', { required: true })}
                    sx={textFieldStyle}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="Phone Number"
                    fullWidth
                    {...register('phone')}
                    sx={textFieldStyle}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    select
                    label="Customer Group"
                    fullWidth
                    defaultValue="RETAIL"
                    {...register('group')}
                    sx={textFieldStyle}
                    InputLabelProps={{ shrink: true }}
                  >
                    <MenuItem value="RETAIL">Retail Customer</MenuItem>
                    <MenuItem value="WHOLESALE">Wholesale Customer</MenuItem>
                    <MenuItem value="VIP">VIP Customer</MenuItem>
                  </TextField>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="Credit Limit ($)"
                    type="number"
                    fullWidth
                    {...register('creditLimit')}
                    sx={textFieldStyle}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="Billing Address"
                    fullWidth
                    {...register('billingAddress')}
                    sx={textFieldStyle}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="Shipping Address"
                    fullWidth
                    {...register('shippingAddress')}
                    sx={textFieldStyle}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    label="Additional Notes"
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
                sx={{
                  px: 4,
                  py: 1.2,
                  fontWeight: 700,
                  background: 'linear-gradient(90deg, #8b5cf6 0%, #6366f1 100%)',
                }}
              >
                {editingCustomer ? 'Update Customer' : 'Register Customer'}
              </Button>
            </DialogActions>
          </form>
        </Dialog>
      </motion.div>
    </Box>
  );
}
