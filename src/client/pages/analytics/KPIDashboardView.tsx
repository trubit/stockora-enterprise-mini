import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  LinearProgress,
  Button,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningIcon from '@mui/icons-material/Warning';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import { motion } from 'framer-motion';
import { apiClient } from '../../api/client.ts';
import PageHeader from '../../components/PageHeader.tsx';
import toast from 'react-hot-toast';

export default function KPIDashboardView() {
  const queryClient = useQueryClient();
  const [editingKPI, setEditingKPI] = useState<any>(null);
  const [targetVal, setTargetVal] = useState<number>(0);
  const [warnVal, setWarnVal] = useState<number>(0);
  const [critVal, setCritVal] = useState<number>(0);

  const { data, isLoading } = useQuery({
    queryKey: ['bi-kpis'],
    queryFn: async () => {
      const res = await apiClient.get('/analytics/kpis');
      return res.data;
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (payload: {
      code: string;
      targetValue: number;
      warningThreshold?: number;
      criticalThreshold?: number;
    }) => {
      const res = await apiClient.post('/analytics/kpis/targets', payload);
      return res.data;
    },
    onSuccess: () => {
      toast.success('KPI target threshold updated successfully!');
      setEditingKPI(null);
      queryClient.invalidateQueries({ queryKey: ['bi-kpis'] });
    },
    onError: () => {
      toast.error('Failed to update KPI target');
    },
  });

  const handleOpenEdit = (kpi: any) => {
    setEditingKPI(kpi);
    setTargetVal(kpi.targetValue);
    setWarnVal(kpi.warningThreshold || kpi.targetValue * 0.8);
    setCritVal(kpi.criticalThreshold || kpi.targetValue * 0.6);
  };

  const handleSave = () => {
    if (!editingKPI) return;
    updateMutation.mutate({
      code: editingKPI.code,
      targetValue: Number(targetVal),
      warningThreshold: Number(warnVal),
      criticalThreshold: Number(critVal),
    });
  };

  if (isLoading || !data) {
    return (
      <Box sx={{ p: 4 }}>
        <LinearProgress color="primary" sx={{ borderRadius: 4, height: 6 }} />
        <Typography variant="body2" color="text.secondary" sx={{ mt: 2, textAlign: 'center' }}>
          Loading executive KPI benchmarks and calculated goal progress...
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 2, md: 4 } }}>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
          <PageHeader
            title="Strategic KPI Management & Target Engine"
            subtitle="Authoritative key performance indicator benchmarks with dynamic math formulas, warning thresholds & goal status tracking"
            category="Decision Intelligence"
          />
        </Box>

        <Grid container spacing={3}>
          {(data.kpis || []).map((kpi: any) => {
            const statusColorMap: Record<string, { bg: string; text: string; icon: any }> = {
              EXCEEDED: {
                bg: 'rgba(16, 185, 129, 0.15)',
                text: '#10b981',
                icon: <EmojiEventsIcon fontSize="small" />,
              },
              ON_TRACK: {
                bg: 'rgba(59, 130, 246, 0.15)',
                text: '#3b82f6',
                icon: <CheckCircleIcon fontSize="small" />,
              },
              AT_RISK: {
                bg: 'rgba(245, 158, 11, 0.15)',
                text: '#f59e0b',
                icon: <WarningIcon fontSize="small" />,
              },
              BEHIND: {
                bg: 'rgba(239, 68, 68, 0.15)',
                text: '#ef4444',
                icon: <ErrorOutlineIcon fontSize="small" />,
              },
            };
            const statusConfig = statusColorMap[kpi.status] || statusColorMap.ON_TRACK;

            return (
              <Grid item xs={12} md={6} key={kpi.code}>
                <Card className="glass-panel" sx={{ borderRadius: '16px', p: 3, height: '100%' }}>
                  <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <Box
                      sx={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                      }}
                    >
                      <Box>
                        <Typography variant="h6" sx={{ fontWeight: 800 }}>
                          {kpi.name}
                        </Typography>
                        <Chip
                          label={kpi.category}
                          size="small"
                          color="primary"
                          sx={{ fontWeight: 700, fontSize: '0.7rem', mt: 0.5 }}
                        />
                      </Box>
                      <Chip
                        icon={statusConfig.icon}
                        label={kpi.status.replace('_', ' ')}
                        size="small"
                        sx={{
                          bgcolor: statusConfig.bg,
                          color: statusConfig.text,
                          fontWeight: 800,
                          fontSize: '0.75rem',
                        }}
                      />
                    </Box>

                    <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8rem' }}>
                      Formula: <code>{kpi.formula}</code>
                    </Typography>

                    <Box sx={{ mt: 1 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                          Current: {kpi.currentValue.toLocaleString()}
                        </Typography>
                        <Typography
                          variant="subtitle2"
                          sx={{ fontWeight: 700 }}
                          color="text.secondary"
                        >
                          Goal: {kpi.targetValue.toLocaleString()} ({kpi.timeframe})
                        </Typography>
                      </Box>

                      <LinearProgress
                        variant="determinate"
                        value={Math.min(100, kpi.progressPct)}
                        sx={{
                          height: 10,
                          borderRadius: 5,
                          bgcolor: 'rgba(255,255,255,0.06)',
                          '& .MuiLinearProgress-bar': {
                            bgcolor:
                              kpi.status === 'EXCEEDED'
                                ? '#10b981'
                                : kpi.status === 'ON_TRACK'
                                  ? '#3b82f6'
                                  : kpi.status === 'AT_RISK'
                                    ? '#f59e0b'
                                    : '#ef4444',
                          },
                        }}
                      />

                      <Box
                        sx={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          mt: 1,
                        }}
                      >
                        <Typography
                          variant="caption"
                          sx={{ fontWeight: 800, color: statusConfig.text }}
                        >
                          {kpi.progressPct}% achieved
                        </Typography>
                        <Button
                          size="small"
                          startIcon={<EditIcon />}
                          onClick={() => handleOpenEdit(kpi)}
                          sx={{ fontSize: '0.75rem', color: '#a78bfa' }}
                        >
                          Configure Target
                        </Button>
                      </Box>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            );
          })}
        </Grid>

        {/* Target Threshold Config Dialog */}
        <Dialog
          open={!!editingKPI}
          onClose={() => setEditingKPI(null)}
          fullWidth
          maxWidth="xs"
          PaperProps={{
            sx: {
              bgcolor: '#111827',
              color: '#fff',
              borderRadius: '16px',
              border: '1px solid rgba(255,255,255,0.1)',
              p: 1,
              width: '100%',
              maxWidth: 420,
              m: { xs: 1.5, sm: 2 },
            },
          }}
        >
          <DialogTitle component="div" sx={{ fontWeight: 800 }}>
            Configure KPI Target: {editingKPI?.name}
          </DialogTitle>
          <DialogContent>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, mt: 1 }}>
              <TextField
                label="Target Goal Value"
                type="number"
                fullWidth
                size="small"
                value={targetVal}
                onChange={(e) => setTargetVal(Number(e.target.value))}
                InputLabelProps={{ style: { color: '#9ca3af' } }}
                InputProps={{ style: { color: '#fff' } }}
              />
              <TextField
                label="Warning Threshold (At Risk)"
                type="number"
                fullWidth
                size="small"
                value={warnVal}
                onChange={(e) => setWarnVal(Number(e.target.value))}
                InputLabelProps={{ style: { color: '#9ca3af' } }}
                InputProps={{ style: { color: '#fff' } }}
              />
              <TextField
                label="Critical Threshold (Behind)"
                type="number"
                fullWidth
                size="small"
                value={critVal}
                onChange={(e) => setCritVal(Number(e.target.value))}
                InputLabelProps={{ style: { color: '#9ca3af' } }}
                InputProps={{ style: { color: '#fff' } }}
              />
            </Box>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={() => setEditingKPI(null)} sx={{ color: '#9ca3af' }}>
              Cancel
            </Button>
            <Button
              variant="contained"
              color="primary"
              onClick={handleSave}
              sx={{ fontWeight: 700 }}
            >
              Save Thresholds
            </Button>
          </DialogActions>
        </Dialog>
      </motion.div>
    </Box>
  );
}
