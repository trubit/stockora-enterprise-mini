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
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { apiClient } from '../../api/client.ts';
import { toast } from 'react-hot-toast';
import type { MasterData } from '../../../shared/types.js';
import { motion } from 'framer-motion';
import { Can } from '../../components/auth/Can.tsx';

const textFieldStyle = {};

export default function MasterDataList() {
  const [open, setOpen] = useState(false);
  const [filterType, setFilterType] = useState<string>('CATEGORY');

  const { data: list = [], refetch } = useQuery({
    queryKey: ['master-data', filterType],
    queryFn: async () => {
      const { data } = await apiClient.get<MasterData[]>(`/org/master-data?type=${filterType}`);
      return data;
    },
  });

  const { register, handleSubmit, reset } = useForm({
    defaultValues: { name: '', code: '', value: '' },
  });

  const createMutation = useMutation({
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    mutationFn: async (newData: any) => {
      return await apiClient.post('/org/master-data', { type: filterType, ...newData });
    },
    onSuccess: () => {
      toast.success('Master record added successfully!');
      setOpen(false);
      reset();
      refetch();
    },
  });

  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  const onSubmit = (data: any) => {
    createMutation.mutate(data);
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
            Master Data Registries
          </Typography>
          <Can permission="master_data:write">
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
                fontSize: '0.9rem',
                background: 'linear-gradient(90deg, #8b5cf6 0%, #6366f1 100%)',
                boxShadow: '0 4px 15px rgba(139, 92, 246, 0.3)',
                transition: 'all 0.3s ease',
                '&:hover': {
                  background: 'linear-gradient(90deg, #7c3aed 0%, #4f46e5 100%)',
                  boxShadow: '0 6px 20px rgba(139, 92, 246, 0.45)',
                  transform: 'translateY(-1px)',
                },
              }}
            >
              Add Master Record
            </Button>
          </Can>
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 4, fontWeight: 500 }}>
          Manage static configurations, tax rates, standard categories, and default units of
          measure.
        </Typography>

        <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
          <TextField
            select
            label="Registry Type"
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            sx={{ ...textFieldStyle, width: 260 }}
            InputLabelProps={{ shrink: true }}
          >
            <MenuItem value="CATEGORY">Product Categories</MenuItem>
            <MenuItem value="BRAND">Brands</MenuItem>
            <MenuItem value="UOM">Units of Measure (UOM)</MenuItem>
            <MenuItem value="TAX_RATE">Tax Rates</MenuItem>
            <MenuItem value="CUSTOMER_TYPE">Customer Types</MenuItem>
            <MenuItem value="SUPPLIER_TYPE">Supplier Types</MenuItem>
          </TextField>
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
            overflow: 'hidden',
          }}
        >
          <Table>
            <TableHead sx={{ bgcolor: 'rgba(17, 24, 39, 0.5)' }}>
              <TableRow>
                <TableCell
                  sx={{
                    fontWeight: 800,
                    fontSize: '0.9rem',
                    py: 2,
                    borderBottom: '1px solid rgba(255,255,255,0.05)',
                  }}
                >
                  Name
                </TableCell>
                <TableCell
                  sx={{
                    fontWeight: 800,
                    fontSize: '0.9rem',
                    py: 2,
                    borderBottom: '1px solid rgba(255,255,255,0.05)',
                  }}
                >
                  Code
                </TableCell>
                <TableCell
                  sx={{
                    fontWeight: 800,
                    fontSize: '0.9rem',
                    py: 2,
                    borderBottom: '1px solid rgba(255,255,255,0.05)',
                  }}
                >
                  Value / Rate
                </TableCell>
                <TableCell
                  sx={{
                    fontWeight: 800,
                    fontSize: '0.9rem',
                    py: 2,
                    borderBottom: '1px solid rgba(255,255,255,0.05)',
                  }}
                >
                  Status
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {list.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    align="center"
                    sx={{ py: 6, color: 'text.secondary', borderBottom: 'none' }}
                  >
                    No master records registered in this registry category.
                  </TableCell>
                </TableRow>
              ) : (
                list.map((item) => (
                  <TableRow
                    key={item._id || item.id}
                    sx={{
                      '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.01)' },
                      transition: 'background 0.2s',
                    }}
                  >
                    <TableCell
                      sx={{
                        borderBottom: '1px solid rgba(255,255,255,0.03)',
                        py: 2,
                        fontWeight: 600,
                      }}
                    >
                      {item.name}
                    </TableCell>
                    <TableCell sx={{ borderBottom: '1px solid rgba(255,255,255,0.03)', py: 2 }}>
                      <Chip
                        label={item.code}
                        size="small"
                        variant="outlined"
                        sx={{
                          fontWeight: 700,
                          color: 'primary.light',
                          borderColor: 'rgba(139, 92, 246, 0.3)',
                        }}
                      />
                    </TableCell>
                    <TableCell
                      sx={{
                        borderBottom: '1px solid rgba(255,255,255,0.03)',
                        py: 2,
                        fontWeight: 700,
                        color: 'secondary.light',
                      }}
                    >
                      {item.value !== undefined ? String(item.value) : 'N/A'}
                    </TableCell>
                    <TableCell sx={{ borderBottom: '1px solid rgba(255,255,255,0.03)', py: 2 }}>
                      <Chip
                        label={item.isActive ? 'Active' : 'Inactive'}
                        size="small"
                        color={item.isActive ? 'success' : 'default'}
                        sx={{ fontWeight: 700, fontSize: '0.75rem' }}
                      />
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
          maxWidth="xs"
          fullWidth
          PaperProps={{
            sx: {
              background:
                'linear-gradient(135deg, rgba(23, 27, 44, 0.95) 0%, rgba(11, 13, 26, 0.98) 100%)',
              backdropFilter: 'blur(16px)',
              border: '1px solid rgba(139, 92, 246, 0.2)',
              borderRadius: 4,
              p: 1,
            },
          }}
        >
          <form onSubmit={handleSubmit(onSubmit)}>
            <DialogTitle
              sx={{
                fontWeight: 800,
                fontSize: '1.25rem',
                background: 'linear-gradient(90deg, #fff 0%, #a78bfa 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                pb: 1,
              }}
            >
              Create {filterType} Record
            </DialogTitle>
            <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 3, pt: 2 }}>
              <TextField
                label="Name"
                fullWidth
                {...register('name', { required: true })}
                sx={textFieldStyle}
                InputLabelProps={{ shrink: true }}
              />
              <TextField
                label="Code (e.g., TAX-VAT-15)"
                fullWidth
                {...register('code', { required: true })}
                sx={textFieldStyle}
                InputLabelProps={{ shrink: true }}
              />
              {filterType === 'TAX_RATE' && (
                <TextField
                  label="Tax Rate Value (e.g., 0.15)"
                  type="number"
                  inputProps={{ step: 0.01 }}
                  fullWidth
                  {...register('value')}
                  sx={textFieldStyle}
                  InputLabelProps={{ shrink: true }}
                />
              )}
              {filterType === 'UOM' && (
                <TextField
                  label="UOM Abbreviation (e.g., KG)"
                  fullWidth
                  {...register('value')}
                  sx={textFieldStyle}
                  InputLabelProps={{ shrink: true }}
                />
              )}
            </DialogContent>
            <DialogActions sx={{ p: 3, gap: 1.5 }}>
              <Button
                onClick={() => setOpen(false)}
                sx={{
                  textTransform: 'none',
                  fontWeight: 600,
                  color: 'text.secondary',
                  '&:hover': { color: 'text.primary' },
                }}
              >
                Cancel
              </Button>
              <Button
                variant="contained"
                type="submit"
                disabled={createMutation.isPending}
                sx={{
                  px: 4,
                  py: 1,
                  fontWeight: 700,
                  borderRadius: 2,
                  textTransform: 'none',
                  background: 'linear-gradient(90deg, #8b5cf6 0%, #6366f1 100%)',
                  boxShadow: '0 4px 12px rgba(139, 92, 246, 0.25)',
                  '&:hover': {
                    background: 'linear-gradient(90deg, #7c3aed 0%, #4f46e5 100%)',
                    boxShadow: '0 6px 16px rgba(139, 92, 246, 0.4)',
                  },
                }}
              >
                Create
              </Button>
            </DialogActions>
          </form>
        </Dialog>
      </motion.div>
    </Box>
  );
}
