import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  MenuItem,
  Grid,
  LinearProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
} from '@mui/material';
import { useForm } from 'react-hook-form';
import { toast } from 'react-hot-toast';
import { apiClient } from '../../api/client.ts';
import PageHeader from '../../components/PageHeader.tsx';
import { motion } from 'framer-motion';

interface Schedule {
  _id: string;
  name: string;
  cronExpression: string;
  format: string;
  recipients: string[];
  isActive: boolean;
}

interface ScheduledReportsForm {
  name: string;
  savedReportId: string;
  cronExpression: string;
  format: string;
  recipients: string;
}

export default function ScheduledReports() {
  const {
    data: schedules = [],
    isLoading,
    refetch,
  } = useQuery<Schedule[]>({
    queryKey: ['scheduled-reports'],
    queryFn: async () => {
      const { data } = await apiClient.get<Schedule[]>('/reports/scheduled');
      return data;
    },
  });

  const { register, handleSubmit, reset } = useForm<ScheduledReportsForm>({
    defaultValues: {
      name: '',
      savedReportId: '64d4b1a4c9b841a4c9b84002',
      cronExpression: '0 9 * * 1', // Weekly on Mondays at 9am
      format: 'PDF',
      recipients: 'owner@stockora.com',
    },
  });

  const [saving, setSaving] = useState(false);

  const onSubmit = async (data: ScheduledReportsForm) => {
    setSaving(true);
    try {
      await apiClient.post('/reports/scheduled', {
        name: data.name,
        savedReportId: data.savedReportId,
        cronExpression: data.cronExpression,
        format: data.format,
        recipients: data.recipients.split(',').map((r: string) => r.trim()),
      });
      toast.success('Report delivery schedule registered successfully!');
      reset();
      refetch();
    } catch (err: unknown) {
      const errorMsg =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error
          ?.message || 'Failed to register schedule.';
      toast.error(errorMsg);
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return <LinearProgress color="primary" />;
  }

  return (
    <Box sx={{ p: { xs: 2, md: 4 } }}>
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <PageHeader
          title="Scheduled Reports"
          subtitle="Configure background automated reports distribution via BullMQ email pipelines"
          category="Analytics"
        />

        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid item xs={12} lg={4}>
            <Card className="glass-panel" sx={{ borderRadius: '12px', p: 3 }}>
              <CardContent>
                <Typography variant="h6" sx={{ fontWeight: 800, mb: 3 }}>
                  Create Delivery Schedule
                </Typography>
                <form onSubmit={handleSubmit(onSubmit)}>
                  <TextField
                    {...register('name', { required: true })}
                    fullWidth
                    label="Schedule Reference Name"
                    placeholder="e.g. Sales Weekly Summary"
                    sx={{ mb: 3 }}
                  />

                  <TextField
                    {...register('cronExpression', { required: true })}
                    fullWidth
                    label="Cron Schedule String"
                    placeholder="e.g. 0 9 * * 1"
                    sx={{ mb: 3 }}
                  />

                  <TextField
                    {...register('format')}
                    defaultValue="PDF"
                    fullWidth
                    select
                    label="Distribution Format"
                    sx={{ mb: 3 }}
                  >
                    <MenuItem value="PDF">PDF Branded Asset</MenuItem>
                    <MenuItem value="EXCEL">MS Excel spreadsheet</MenuItem>
                    <MenuItem value="CSV">Flat CSV table</MenuItem>
                    <MenuItem value="JSON">Raw JSON data</MenuItem>
                  </TextField>

                  <TextField
                    {...register('recipients', { required: true })}
                    fullWidth
                    label="Email Recipients"
                    helperText="Comma separated values"
                    placeholder="e.g. boss@hq.com, manager@branch.com"
                    sx={{ mb: 4 }}
                  />

                  <Button
                    type="submit"
                    variant="contained"
                    disabled={saving}
                    fullWidth
                    sx={{
                      background: 'linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)',
                      fontWeight: 700,
                    }}
                  >
                    {saving ? 'Registering...' : 'Register Schedule'}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} lg={8}>
            <TableContainer component={Paper} className="glass-panel" sx={{ borderRadius: '12px' }}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Schedule Name</TableCell>
                    <TableCell>Cron Setting</TableCell>
                    <TableCell>Format</TableCell>
                    <TableCell>Target Emails</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {schedules.map((s) => (
                    <TableRow key={s._id}>
                      <TableCell sx={{ fontWeight: 700 }}>{s.name}</TableCell>
                      <TableCell>{s.cronExpression}</TableCell>
                      <TableCell>{s.format}</TableCell>
                      <TableCell>{s.recipients.join(', ')}</TableCell>
                    </TableRow>
                  ))}
                  {schedules.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} align="center" sx={{ py: 4 }}>
                        No repeating report triggers active.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Grid>
        </Grid>
      </motion.div>
    </Box>
  );
}
