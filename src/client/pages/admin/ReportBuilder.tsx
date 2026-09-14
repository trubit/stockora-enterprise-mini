import { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  MenuItem,
  Grid,
  Checkbox,
  FormControlLabel,
} from '@mui/material';
import { useForm } from 'react-hook-form';
import { toast } from 'react-hot-toast';
import { apiClient } from '../../api/client.ts';
import PageHeader from '../../components/PageHeader.tsx';
import { motion } from 'framer-motion';

const templates = [
  { id: '64d4b1a4c9b841a4c9b84001', name: 'Inventory Valuation Report', category: 'INVENTORY' },
  { id: '64d4b1a4c9b841a4c9b84002', name: 'Sales Performance Report', category: 'SALES' },
];

interface ReportBuilderForm {
  name: string;
  templateId: string;
  fields: string[];
  chartType: string;
}

export default function ReportBuilder() {
  const { register, handleSubmit, reset } = useForm<ReportBuilderForm>({
    defaultValues: {
      name: '',
      templateId: '64d4b1a4c9b841a4c9b84002',
      fields: ['productName', 'quantity', 'lineTotal'],
      chartType: 'bar',
    },
  });

  const [saving, setSaving] = useState(false);

  const onSubmit = async (data: ReportBuilderForm) => {
    setSaving(true);
    try {
      await apiClient.post('/reports/saved', {
        name: data.name,
        templateId: data.templateId,
        configuration: {
          fields: data.fields,
          filters: {},
          chartType: data.chartType,
        },
      });
      toast.success('Custom report config stored successfully!');
      reset();
    } catch (err: unknown) {
      const errorMsg =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error
          ?.message || 'Failed to save configuration.';
      toast.error(errorMsg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box sx={{ p: { xs: 2, md: 4 } }}>
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <PageHeader
          title="Visual Report Builder"
          subtitle="Select columns, grouping dimensions, dynamic math, and save customized report views"
          category="Analytics"
        />

        <Card className="glass-panel" sx={{ borderRadius: '16px', p: 3 }}>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)}>
              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <TextField
                    {...register('name', { required: true })}
                    fullWidth
                    label="Report View Name"
                    placeholder="e.g. Sales Q3 Analytics"
                    sx={{ mb: 3 }}
                  />

                  <TextField
                    {...register('templateId')}
                    defaultValue="64d4b1a4c9b841a4c9b84002"
                    fullWidth
                    select
                    label="Target Base Template"
                    sx={{ mb: 3 }}
                  >
                    {templates.map((t) => (
                      <MenuItem key={t.id} value={t.id}>
                        {t.name}
                      </MenuItem>
                    ))}
                  </TextField>

                  <TextField
                    {...register('chartType')}
                    defaultValue="bar"
                    fullWidth
                    select
                    label="Default Chart Type"
                  >
                    <MenuItem value="line">Line Chart</MenuItem>
                    <MenuItem value="bar">Bar Chart</MenuItem>
                    <MenuItem value="pie">Pie Chart</MenuItem>
                    <MenuItem value="area">Area Chart</MenuItem>
                  </TextField>
                </Grid>

                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
                    Select Fields / Columns
                  </Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    <FormControlLabel
                      control={<Checkbox defaultChecked disabled />}
                      label="Product Name / SKU"
                    />
                    <FormControlLabel
                      control={<Checkbox defaultChecked disabled />}
                      label="Transaction Volume"
                    />
                    <FormControlLabel
                      control={<Checkbox defaultChecked disabled />}
                      label="Aggregation Revenue"
                    />
                  </Box>
                </Grid>
              </Grid>

              <Box sx={{ mt: 4, display: 'flex', justifyContent: 'flex-end' }}>
                <Button
                  type="submit"
                  variant="contained"
                  disabled={saving}
                  sx={{
                    background: 'linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)',
                    fontWeight: 700,
                  }}
                >
                  {saving ? 'Saving...' : 'Save Configuration'}
                </Button>
              </Box>
            </form>
          </CardContent>
        </Card>
      </motion.div>
    </Box>
  );
}
