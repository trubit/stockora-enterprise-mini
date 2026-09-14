import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  LinearProgress,
  Button,
} from '@mui/material';
import WarningIcon from '@mui/icons-material/Warning';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import { motion } from 'framer-motion';
import { apiClient } from '../../api/client.ts';
import PageHeader from '../../components/PageHeader.tsx';
import StatCard from '../../components/StatCard.tsx';
import toast from 'react-hot-toast';

export default function AnomalyIntelligenceView() {
  const queryClient = useQueryClient();
  const [acknowledgedMap, setAcknowledgedMap] = useState<Record<string, boolean>>({});

  const { data, isLoading } = useQuery({
    queryKey: ['bi-anomaly-analytics'],
    queryFn: async () => {
      const res = await apiClient.get('/analytics/anomalies');
      return res.data;
    },
  });

  const ackMutation = useMutation({
    mutationFn: async (alertId: string) => {
      await apiClient.post(`/analytics/alerts/${alertId}/ack`);
      return alertId;
    },
    onSuccess: (alertId) => {
      setAcknowledgedMap((prev) => ({ ...prev, [alertId]: true }));
      toast.success(`Alert ${alertId} acknowledged`);
      queryClient.invalidateQueries({ queryKey: ['bi-anomaly-analytics'] });
    },
    onError: () => {
      toast.error('Failed to acknowledge alert');
    },
  });

  const resolveMutation = useMutation({
    mutationFn: async (alertId: string) => {
      await apiClient.post(`/analytics/alerts/${alertId}/resolve`);
      return alertId;
    },
    onSuccess: (alertId) => {
      toast.success(`Alert ${alertId} marked as resolved`);
      queryClient.invalidateQueries({ queryKey: ['bi-anomaly-analytics'] });
    },
    onError: () => {
      toast.error('Failed to resolve alert');
    },
  });

  if (isLoading || !data) {
    return (
      <Box sx={{ p: 4 }}>
        <LinearProgress color="primary" sx={{ borderRadius: 4, height: 6 }} />
        <Typography variant="body2" color="text.secondary" sx={{ mt: 2, textAlign: 'center' }}>
          Scanning transactional baselines and active anomaly detection models...
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
            title="Anomaly Detection & Business Risk Signals"
            subtitle="Automated baseline deviation monitoring across POS transactions, discount spikes, stock variances & payment gateway reliability"
            category="Decision Intelligence"
          />
        </Box>

        {/* 4 Core Anomaly KPI Stat Cards */}
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid item xs={12} sm={6} md={3}>
            <StatCard
              title="ACTIVE SIGNALS"
              value={(data.totalActiveAnomalies || 0).toLocaleString()}
              subtitle="Unusual deviations detected"
              icon={<WarningIcon />}
              color="amber"
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <StatCard
              title="CRITICAL RISKS"
              value={(data.criticalCount || 0).toLocaleString()}
              subtitle="Immediate intervention required"
              icon={<ErrorOutlineIcon />}
              color="rose"
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <StatCard
              title="WARNING ANOMALIES"
              value={(data.warningCount || 0).toLocaleString()}
              subtitle="Threshold variance elevated"
              icon={<WarningIcon />}
              color="violet"
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <StatCard
              title="INFO / BASELINE"
              value={(data.infoCount || 0).toLocaleString()}
              subtitle="Informational event notices"
              icon={<InfoOutlinedIcon />}
              color="emerald"
            />
          </Grid>
        </Grid>

        {/* Active Anomalies Table */}
        <Card className="glass-panel" sx={{ borderRadius: '16px', p: 3, mb: 4 }}>
          <CardContent>
            <Typography variant="h6" sx={{ fontWeight: 800, mb: 1 }}>
              Active Statistical Anomalies & Deviations
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 3 }}>
              Deviations identified by automated rolling baseline algorithms
            </Typography>

            <TableContainer component={Paper} sx={{ bgcolor: 'transparent', boxShadow: 'none' }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ color: 'text.secondary', fontWeight: 700 }}>
                      Signal ID
                    </TableCell>
                    <TableCell sx={{ color: 'text.secondary', fontWeight: 700 }}>
                      Category
                    </TableCell>
                    <TableCell sx={{ color: 'text.secondary', fontWeight: 700 }}>
                      Severity
                    </TableCell>
                    <TableCell sx={{ color: 'text.secondary', fontWeight: 700 }}>
                      Observed Deviation
                    </TableCell>
                    <TableCell sx={{ color: 'text.secondary', fontWeight: 700 }}>
                      Expected Range
                    </TableCell>
                    <TableCell sx={{ color: 'text.secondary', fontWeight: 700 }}>
                      Confidence
                    </TableCell>
                    <TableCell sx={{ color: 'text.secondary', fontWeight: 700 }}>
                      Actionable Context
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(data.anomalies || []).map((anom: any) => (
                    <TableRow
                      key={anom.id}
                      hover
                      sx={{ '&:last-child td, &:last-child th': { border: 0 } }}
                    >
                      <TableCell sx={{ fontWeight: 700 }}>{anom.id}</TableCell>
                      <TableCell>
                        <Chip
                          label={anom.category.replace('_', ' ')}
                          size="small"
                          sx={{ fontWeight: 700, fontSize: '0.72rem' }}
                        />
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={anom.severity}
                          size="small"
                          sx={{
                            bgcolor:
                              anom.severity === 'CRITICAL'
                                ? 'rgba(239, 68, 68, 0.2)'
                                : anom.severity === 'WARNING'
                                  ? 'rgba(245, 158, 11, 0.2)'
                                  : 'rgba(16, 185, 129, 0.2)',
                            color:
                              anom.severity === 'CRITICAL'
                                ? '#f87171'
                                : anom.severity === 'WARNING'
                                  ? '#fbbf24'
                                  : '#34d399',
                            fontWeight: 800,
                          }}
                        />
                      </TableCell>
                      <TableCell sx={{ fontWeight: 700, color: 'warning.light' }}>
                        {anom.observedValue}
                      </TableCell>
                      <TableCell sx={{ color: 'text.secondary', fontSize: '0.8rem' }}>
                        {anom.expectedRange}
                      </TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>
                        {Math.round(anom.confidence * 100)}%
                      </TableCell>
                      <TableCell
                        sx={{ fontSize: '0.8rem', color: 'text.secondary', maxWidth: 280 }}
                      >
                        {anom.reason}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>

        {/* Business Intelligence Alerts Lifecycle Section */}
        <Card className="glass-panel" sx={{ borderRadius: '16px', p: 3 }}>
          <CardContent>
            <Typography variant="h6" sx={{ fontWeight: 800, mb: 1 }}>
              Active Business Intelligence Alerts & Notification Queue
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 3 }}>
              Alert triage console with acknowledge, resolve, and cooldown deduplication mechanisms
            </Typography>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {(data.activeAlerts || []).map((alert: any) => {
                const isAcked = acknowledgedMap[alert.id] || alert.isAcknowledged;
                return (
                  <Box
                    key={alert.id}
                    sx={{
                      p: 2.5,
                      borderRadius: '12px',
                      bgcolor:
                        alert.severity === 'CRITICAL'
                          ? 'rgba(239, 68, 68, 0.06)'
                          : 'rgba(255, 255, 255, 0.02)',
                      border: `1px solid ${alert.severity === 'CRITICAL' ? 'rgba(239, 68, 68, 0.3)' : 'rgba(255, 255, 255, 0.06)'}`,
                      display: 'flex',
                      flexDirection: { xs: 'column', md: 'row' },
                      justifyContent: 'space-between',
                      alignItems: { md: 'center' },
                      gap: 2,
                    }}
                  >
                    <Box sx={{ flex: 1 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 0.5 }}>
                        <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                          {alert.title}
                        </Typography>
                        <Chip
                          label={alert.severity}
                          size="small"
                          sx={{
                            bgcolor:
                              alert.severity === 'CRITICAL'
                                ? 'rgba(239, 68, 68, 0.2)'
                                : 'rgba(245, 158, 11, 0.2)',
                            color: alert.severity === 'CRITICAL' ? '#f87171' : '#fbbf24',
                            fontWeight: 800,
                            fontSize: '0.7rem',
                          }}
                        />
                        {isAcked && (
                          <Chip
                            label="ACKNOWLEDGED"
                            size="small"
                            color="primary"
                            sx={{ fontWeight: 700, fontSize: '0.7rem' }}
                          />
                        )}
                      </Box>
                      <Typography variant="body2" color="text.secondary">
                        {alert.message}
                      </Typography>
                    </Box>

                    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                      {!isAcked && (
                        <Button
                          variant="outlined"
                          size="small"
                          onClick={() => ackMutation.mutate(alert.id)}
                          sx={{
                            borderColor: 'rgba(255,255,255,0.2)',
                            color: '#d1d5db',
                            fontSize: '0.75rem',
                          }}
                        >
                          Acknowledge
                        </Button>
                      )}
                      <Button
                        variant="contained"
                        size="small"
                        color="success"
                        startIcon={<CheckCircleOutlineIcon />}
                        onClick={() => resolveMutation.mutate(alert.id)}
                        sx={{ fontWeight: 700, fontSize: '0.75rem' }}
                      >
                        Resolve
                      </Button>
                    </Box>
                  </Box>
                );
              })}
            </Box>
          </CardContent>
        </Card>
      </motion.div>
    </Box>
  );
}
