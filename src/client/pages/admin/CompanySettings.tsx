import { Box, Typography, Button, TextField, Card, CardContent } from '@mui/material';
import { useForm } from 'react-hook-form';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiClient } from '../../api/client.ts';
import { toast } from 'react-hot-toast';
import { motion } from 'framer-motion';

const textFieldStyle = {};

export default function CompanySettings() {
  const { data: company, refetch } = useQuery({
    queryKey: ['company'],
    queryFn: async () => {
      try {
        const { data } = await apiClient.get('/org/company');
        return data;
      } catch {
        return null;
      }
    },
  });

  const { register, handleSubmit } = useForm({
    values: {
      name: company?.name || '',
      taxId: company?.taxId || '',
      address: company?.address || '',
      phone: company?.phone || '',
    },
  });

  const mutation = useMutation({
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    mutationFn: async (updatedData: any) => {
      if (company) {
        return await apiClient.put('/org/company', updatedData);
      } else {
        return await apiClient.post('/org/company', updatedData);
      }
    },
    onSuccess: () => {
      toast.success('Company settings saved successfully!');
      refetch();
    },
  });

  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  const onSubmit = (data: any) => {
    mutation.mutate(data);
  };

  return (
    <Box sx={{ p: { xs: 2, md: 4 } }}>
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <Typography
          variant="h4"
          sx={{
            fontWeight: 800,
            mb: 1,
            background: 'linear-gradient(90deg, #fff 0%, #a78bfa 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          Company Profile Settings
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 4, fontWeight: 500 }}>
          Initialize or modify the corporate tenancy details, tax codes, and addresses.
        </Typography>

        <Card
          className="glass-panel"
          sx={{
            maxWidth: 600,
            boxShadow: '0 8px 32px rgba(139, 92, 246, 0.08)',
            border: '1px solid rgba(255, 255, 255, 0.05)',
            background:
              'linear-gradient(135deg, rgba(30, 41, 59, 0.7) 0%, rgba(15, 23, 42, 0.8) 100%)',
            borderRadius: 3,
            position: 'relative',
            overflow: 'hidden',
            '&::before': {
              content: '""',
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: '3px',
              background: 'linear-gradient(90deg, #8b5cf6, #3b82f6)',
            },
          }}
        >
          <CardContent sx={{ p: { xs: 3, md: 4 } }}>
            <form
              onSubmit={handleSubmit(onSubmit)}
              style={{ display: 'flex', flexDirection: 'column', gap: 24 }}
            >
              <TextField
                label="Company Name"
                fullWidth
                {...register('name')}
                sx={textFieldStyle}
                InputLabelProps={{ shrink: true }}
              />
              <TextField
                label="Tax/VAT ID"
                fullWidth
                {...register('taxId')}
                sx={textFieldStyle}
                InputLabelProps={{ shrink: true }}
              />
              <TextField
                label="Corporate Address"
                fullWidth
                {...register('address')}
                sx={textFieldStyle}
                InputLabelProps={{ shrink: true }}
              />
              <TextField
                label="Contact Phone"
                fullWidth
                {...register('phone')}
                sx={textFieldStyle}
                InputLabelProps={{ shrink: true }}
              />

              <Button
                variant="contained"
                type="submit"
                disabled={mutation.isPending}
                sx={{
                  alignSelf: 'flex-start',
                  px: 5,
                  py: 1.4,
                  fontWeight: 700,
                  borderRadius: 2.5,
                  textTransform: 'none',
                  fontSize: '0.95rem',
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
                {mutation.isPending ? 'Saving Details...' : 'Save Details'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </motion.div>
    </Box>
  );
}
