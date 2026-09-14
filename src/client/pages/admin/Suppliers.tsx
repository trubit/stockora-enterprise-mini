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
import StarIcon from '@mui/icons-material/Star';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { apiClient } from '../../api/client.ts';
import { notify } from '../../utils/notify.ts';
import { useConfirm } from '../../context/ConfirmDialogContext.tsx';
import type { Supplier } from '../../../shared/types.js';
import { motion } from 'framer-motion';
import { Can } from '../../components/auth/Can.tsx';

const textFieldStyle = {};

export default function Suppliers() {
  const confirm = useConfirm();
  const [open, setOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const { data: suppliers = [], refetch } = useQuery({
    queryKey: ['suppliers'],
    queryFn: async () => {
      const { data } = await apiClient.get<Supplier[]>('/suppliers');
      return data;
    },
  });

  const { register, handleSubmit, reset } = useForm<Supplier>({
    defaultValues: {
      name: '',
      code: '',
      contactPerson: '',
      email: '',
      phone: '',
      address: '',
      paymentTerms: 'NET 30',
      creditLimit: 0,
      taxId: '',
      rating: 5,
      notes: '',
      isActive: true,
    },
  });

  const createMutation = useMutation({
    mutationFn: async (newSupplier: Supplier) => {
      return await apiClient.post('/suppliers', newSupplier);
    },
    onSuccess: () => {
      notify.success('Supplier created successfully!');
      setOpen(false);
      reset();
      refetch();
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (updatedSupplier: Supplier) => {
      return await apiClient.put(
        `/suppliers/${editingSupplier?._id || editingSupplier?.id}`,
        updatedSupplier
      );
    },
    onSuccess: () => {
      notify.success('Supplier updated successfully!');
      setOpen(false);
      setEditingSupplier(null);
      reset();
      refetch();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiClient.delete(`/suppliers/${id}`);
    },
    onSuccess: () => {
      notify.success('Supplier deactivated successfully.');
      refetch();
    },
  });

  const handleOpenCreate = () => {
    setEditingSupplier(null);
    reset({
      name: '',
      code: '',
      contactPerson: '',
      email: '',
      phone: '',
      address: '',
      paymentTerms: 'NET 30',
      creditLimit: 0,
      taxId: '',
      rating: 5,
      notes: '',
      isActive: true,
    });
    setOpen(true);
  };

  const handleOpenEdit = (supplier: Supplier) => {
    setEditingSupplier(supplier);
    reset(supplier);
    setOpen(true);
  };

  const onSubmit = (data: Supplier) => {
    const payload = {
      ...data,
      creditLimit: Number(data.creditLimit || 0),
      rating: Number(data.rating || 5),
    };
    if (editingSupplier) {
      updateMutation.mutate(payload);
    } else {
      createMutation.mutate(payload);
    }
  };

  const filteredSuppliers = suppliers.filter(
    (s) =>
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.contactPerson.toLowerCase().includes(searchQuery.toLowerCase())
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
            Supplier Directory
          </Typography>
          <Can permission="suppliers:write">
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
              Register Supplier
            </Button>
          </Can>
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 4 }}>
          Manage wholesale suppliers, operational accounts, and pricing parameters.
        </Typography>

        <Box sx={{ mb: 3 }}>
          <TextField
            label="Search Suppliers by Name, Code, or Contact Person..."
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
                  Supplier
                </TableCell>
                <TableCell
                  sx={{ fontWeight: 800, borderBottom: '1px solid rgba(255,255,255,0.05)' }}
                >
                  Code
                </TableCell>
                <TableCell
                  sx={{ fontWeight: 800, borderBottom: '1px solid rgba(255,255,255,0.05)' }}
                >
                  Contact Details
                </TableCell>
                <TableCell
                  sx={{ fontWeight: 800, borderBottom: '1px solid rgba(255,255,255,0.05)' }}
                >
                  Terms & Credit
                </TableCell>
                <TableCell
                  sx={{ fontWeight: 800, borderBottom: '1px solid rgba(255,255,255,0.05)' }}
                >
                  Rating
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
              {filteredSuppliers.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    align="center"
                    sx={{ py: 6, color: 'text.secondary', border: 'none' }}
                  >
                    No suppliers registered.
                  </TableCell>
                </TableRow>
              ) : (
                filteredSuppliers.map((s) => (
                  <TableRow
                    key={s._id || s.id}
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
                          {s.name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {s.address}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell sx={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                      <Chip
                        label={s.code}
                        size="small"
                        variant="outlined"
                        sx={{ fontWeight: 700, color: 'secondary.light' }}
                      />
                    </TableCell>
                    <TableCell sx={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                      <Box>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {s.contactPerson}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {s.email} | {s.phone}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell sx={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                      <Box>
                        <Typography variant="body2" sx={{ fontWeight: 700 }}>
                          ${Number(s.creditLimit || 0).toLocaleString()} limit
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {s.paymentTerms}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell sx={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <StarIcon sx={{ color: '#fbbf24', fontSize: '1rem' }} />
                        <Typography variant="body2" sx={{ fontWeight: 700 }}>
                          {s.rating}.0
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell
                      sx={{ borderBottom: '1px solid rgba(255,255,255,0.03)', textAlign: 'right' }}
                    >
                      <Can permission="suppliers:write">
                        <Tooltip title="Edit Supplier">
                          <IconButton
                            onClick={() => handleOpenEdit(s)}
                            sx={{ color: 'primary.light' }}
                            size="small"
                          >
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Deactivate">
                          <IconButton
                            onClick={async () => {
                              if (!s._id) return;
                              const confirmed = await confirm({
                                title: 'Deactivate Supplier',
                                message: `Are you sure you want to deactivate supplier "${s.name}" (${s.code})? Purchase orders and procurement links with this vendor will be archived.`,
                                confirmText: 'Deactivate',
                                severity: 'error',
                              });
                              if (confirmed) {
                                deleteMutation.mutate(s._id);
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
              {editingSupplier ? 'Modify Supplier Information' : 'Register New Vendor/Supplier'}
            </DialogTitle>
            <DialogContent sx={{ pt: 2 }}>
              <Grid container spacing={3}>
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="Supplier Name"
                    fullWidth
                    {...register('name', { required: true })}
                    sx={textFieldStyle}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="Supplier Code (e.g., SUP-MAIN)"
                    fullWidth
                    {...register('code', { required: true })}
                    sx={textFieldStyle}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="Contact Person"
                    fullWidth
                    {...register('contactPerson', { required: true })}
                    sx={textFieldStyle}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="Contact Email"
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
                    {...register('phone', { required: true })}
                    sx={textFieldStyle}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="Tax/VAT ID"
                    fullWidth
                    {...register('taxId')}
                    sx={textFieldStyle}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    select
                    label="Payment Terms"
                    fullWidth
                    defaultValue="NET 30"
                    {...register('paymentTerms')}
                    sx={textFieldStyle}
                    InputLabelProps={{ shrink: true }}
                  >
                    <MenuItem value="NET 15">NET 15</MenuItem>
                    <MenuItem value="NET 30">NET 30</MenuItem>
                    <MenuItem value="NET 60">NET 60</MenuItem>
                    <MenuItem value="Due on Receipt">Due on Receipt</MenuItem>
                    <MenuItem value="Prepaid">Prepaid</MenuItem>
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
                    select
                    label="Rating Star"
                    fullWidth
                    defaultValue={5}
                    {...register('rating')}
                    sx={textFieldStyle}
                    InputLabelProps={{ shrink: true }}
                  >
                    <MenuItem value={1}>1 Star</MenuItem>
                    <MenuItem value={2}>2 Star</MenuItem>
                    <MenuItem value={3}>3 Star</MenuItem>
                    <MenuItem value={4}>4 Star</MenuItem>
                    <MenuItem value={5}>5 Star</MenuItem>
                  </TextField>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="Physical Corporate Address"
                    fullWidth
                    {...register('address', { required: true })}
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
                {editingSupplier ? 'Update Supplier' : 'Register Supplier'}
              </Button>
            </DialogActions>
          </form>
        </Dialog>
      </motion.div>
    </Box>
  );
}
