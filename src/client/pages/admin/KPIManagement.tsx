import { useQuery } from '@tanstack/react-query';
import { Box, Card, CardContent, Typography, Grid, LinearProgress } from '@mui/material';
import { apiClient } from '../../api/client.ts';
import PageHeader from '../../components/PageHeader.tsx';
import { motion } from 'framer-motion';

interface KPI {
  code: string;
  name: string;
  category: string;
  formula: string;
  targetValue: number;
  currentValue: number;
}

export default function KPIManagement() {
  const { data: kpis = [], isLoading } = useQuery<KPI[]>({
    queryKey: ['kpi-management'],
    queryFn: async () => {
      const { data } = await apiClient.get<KPI[]>('/reports/kpis');
      return data;
    },
  });

  if (isLoading) {
    return <LinearProgress color="primary" />;
  }

  return (
    <Box sx={{ p: { xs: 2, md: 4 } }}>
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <PageHeader
          title="KPI Management Console"
          subtitle="Configure target thresholds, review calculated performance, and set goals"
          category="Analytics"
        />

        <Grid container spacing={3}>
          {kpis.map((kpi) => {
            const progress =
              Math.min(100, Math.round((kpi.currentValue / kpi.targetValue) * 100)) || 0;
            return (
              <Grid item xs={12} md={6} key={kpi.code}>
                <Card className="glass-panel" sx={{ borderRadius: '16px', p: 3 }}>
                  <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <Box
                      sx={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <Typography variant="h6" sx={{ fontWeight: 800 }}>
                        {kpi.name}
                      </Typography>
                      <Typography
                        variant="caption"
                        sx={{ color: 'primary.light', fontWeight: 800 }}
                      >
                        {kpi.category}
                      </Typography>
                    </Box>
                    <Typography variant="body2" color="text.secondary">
                      Formula: <code>{kpi.formula}</code>
                    </Typography>
                    <Box sx={{ mt: 2 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                          Current: {kpi.currentValue.toLocaleString()}
                        </Typography>
                        <Typography
                          variant="subtitle2"
                          sx={{ fontWeight: 700 }}
                          color="text.secondary"
                        >
                          Goal: {kpi.targetValue.toLocaleString()}
                        </Typography>
                      </Box>
                      <LinearProgress
                        variant="determinate"
                        value={progress}
                        sx={{ height: 10, borderRadius: 5 }}
                        color={progress >= 80 ? 'success' : progress >= 50 ? 'warning' : 'error'}
                      />
                      <Typography
                        variant="caption"
                        sx={{ mt: 1, display: 'block', textAlign: 'right', fontWeight: 800 }}
                      >
                        {progress}% achieved
                      </Typography>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            );
          })}
        </Grid>
      </motion.div>
    </Box>
  );
}
