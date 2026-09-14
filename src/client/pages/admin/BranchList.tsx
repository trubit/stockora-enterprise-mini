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
  Grid,
  Card,
  CardContent,
  Chip,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { apiClient } from '../../api/client.ts';
import { toast } from 'react-hot-toast';
import type { Branch } from '../../../shared/types.js';
import { motion } from 'framer-motion';
import { Can } from '../../components/auth/Can.tsx';

const textFieldStyle = {};

export default function BranchList() {
  const [open, setOpen] = useState(false);
  const { data: branches = [], refetch } = useQuery({
    queryKey: ['branches'],
    queryFn: async () => {
      const { data } = await apiClient.get<Branch[]>('/org/branches');
      return data;
    },
  });

  const { register, handleSubmit, reset } = useForm({
    defaultValues: { name: '', code: '', address: '', phone: '' },
  });

  const createMutation = useMutation({
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    mutationFn: async (newBranch: any) => {
      // For multi-tenant support, bind to a placeholder company ID
      return await apiClient.post('/org/branches', {
        companyId: '507f1f77bcf86cd799439011',
        ...newBranch,
      });
    },
    onSuccess: () => {
      toast.success('Branch registered successfully!');
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
            Branches Manager
          </Typography>
          <Can permission="branches:write">
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
              Add Branch
            </Button>
          </Can>
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 4, fontWeight: 500 }}>
          Configure retail branches, operational physical outlets, and warehouse assignments.
        </Typography>

        <Grid container spacing={3}>
          {branches.map((b) => (
            <Grid item xs={12} sm={6} md={4} key={b._id || b.id}>
              <Card
                className="glass-panel"
                sx={{
                  border: '1px solid rgba(255, 255, 255, 0.05)',
                  background:
                    'linear-gradient(135deg, rgba(30, 41, 59, 0.6) 0%, rgba(15, 23, 42, 0.75) 100%)',
                  borderRadius: 3,
                  boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  overflow: 'hidden',
                  position: 'relative',
                  '&::before': {
                    content: '""',
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: '2px',
                    background: 'linear-gradient(90deg, #8b5cf6, #3b82f6)',
                    opacity: 0.6,
                  },
                  '&:hover': {
                    transform: 'translateY(-3px)',
                    boxShadow: '0 10px 25px rgba(139, 92, 246, 0.12)',
                    borderColor: 'rgba(139, 92, 246, 0.25)',
                    '&::before': {
                      opacity: 1,
                    },
                  },
                }}
              >
                <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, p: 3 }}>
                  <Box
                    sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                  >
                    <Typography variant="h6" sx={{ fontWeight: 800 }}>
                      {b.name}
                    </Typography>
                    <Chip
                      label={b.code}
                      size="small"
                      color="primary"
                      sx={{
                        fontWeight: 700,
                        fontSize: '0.75rem',
                        boxShadow: '0 2px 8px rgba(139, 92, 246, 0.2)',
                      }}
                    />
                  </Box>
                  <Typography
                    variant="body2"
                    sx={{ color: 'text.secondary', minHeight: 40, fontWeight: 500 }}
                  >
                    {b.address || 'No address registered'}
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>
                    Phone: {b.phone || 'N/A'}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>

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
              Register New Branch
            </DialogTitle>
            <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 3, pt: 2 }}>
              <TextField
                label="Branch Name"
                fullWidth
                {...register('name', { required: true })}
                sx={textFieldStyle}
                InputLabelProps={{ shrink: true }}
              />
              <TextField
                label="Branch Code (e.g., HQ-01)"
                fullWidth
                {...register('code', { required: true })}
                sx={textFieldStyle}
                InputLabelProps={{ shrink: true }}
              />
              <TextField
                label="Address"
                fullWidth
                {...register('address')}
                sx={textFieldStyle}
                InputLabelProps={{ shrink: true }}
              />
              <TextField
                label="Phone Number"
                fullWidth
                {...register('phone')}
                sx={textFieldStyle}
                InputLabelProps={{ shrink: true }}
              />
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
                {createMutation.isPending ? 'Registering...' : 'Register'}
              </Button>
            </DialogActions>
          </form>
        </Dialog>
      </motion.div>
    </Box>
  );
}
