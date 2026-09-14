import { useQuery } from '@tanstack/react-query';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Chip,
  LinearProgress,
  Divider,
} from '@mui/material';
import DatabaseIcon from '@mui/icons-material/Storage';
import CacheIcon from '@mui/icons-material/Memory';
import ErrorIcon from '@mui/icons-material/Error';
import { apiClient } from '../../api/client.ts';
import PageHeader from '../../components/PageHeader.tsx';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { motion } from 'framer-motion';

interface IncidentItem {
  _id: string;
  title: string;
  severity: string;
  status: string;
  createdAt: string;
}

export default function OperationsCenter() {
  const { data: metrics } = useQuery({
    queryKey: ['observabilityMetrics'],
    queryFn: async () => {
      try {
        const res = await apiClient.get('/observability/metrics');
        return res.data.data;
      } catch {
        return null;
      }
    },
    refetchInterval: 15000,
  });

  const { data: incidents = [], isLoading: loading } = useQuery({
    queryKey: ['observabilityIncidents'],
    queryFn: async () => {
      try {
        const res = await apiClient.get('/observability/incidents');
        return res.data.data as IncidentItem[];
      } catch {
        return [];
      }
    },
    refetchInterval: 15000,
  });

  // Simulated latency chart data
  const data = [
    { time: '10:00', latency: 45 },
    { time: '10:05', latency: 50 },
    { time: '10:10', latency: 48 },
    { time: '10:15', latency: 90 },
    { time: '10:20', latency: 55 },
    { time: '10:25', latency: 42 },
  ];

  const getStatusColor = (status: string) => {
    return status === 'HEALTHY' ? 'success' : 'error';
  };

  return (
    <Box p={3}>
      <PageHeader
        title="Real-Time Operations Center (SRE)"
        subtitle="High-fidelity cluster telemetry, metrics logs, and incident dashboards"
      />

      {loading ? (
        <LinearProgress color="primary" />
      ) : (
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <Card
                sx={{
                  background: 'rgba(255,255,255,0.05)',
                  backdropFilter: 'blur(10px)',
                  color: '#fff',
                  borderRadius: '16px',
                  border: '1px solid rgba(255,255,255,0.1)',
                }}
              >
                <CardContent>
                  <Typography variant="h6" gutterBottom color="primary">
                    Platform Nodes Integrity
                  </Typography>
                  <Divider sx={{ mb: 2, background: 'rgba(255,255,255,0.1)' }} />
                  <Box display="flex" justifyContent="space-between" mb={2}>
                    <Box display="flex" alignItems="center" gap={1}>
                      <DatabaseIcon color="primary" />
                      <Typography>MongoDB Instance</Typography>
                    </Box>
                    <Chip
                      label={metrics?.services?.database || 'UNKNOWN'}
                      color={getStatusColor(metrics?.services?.database)}
                      size="small"
                    />
                  </Box>
                  <Box display="flex" justifyContent="space-between" mb={2}>
                    <Box display="flex" alignItems="center" gap={1}>
                      <CacheIcon color="secondary" />
                      <Typography>Redis Distributed Cache</Typography>
                    </Box>
                    <Chip
                      label={metrics?.services?.cache || 'UNKNOWN'}
                      color={getStatusColor(metrics?.services?.cache)}
                      size="small"
                    />
                  </Box>
                  <Box display="flex" justifyContent="space-between">
                    <Typography color="textSecondary">API Gateway Avg Latency</Typography>
                    <Typography>
                      <strong>{metrics?.apiMetrics?.avgLatencyMs || 0} ms</strong>
                    </Typography>
                  </Box>
                </CardContent>
              </Card>
            </motion.div>
          </Grid>

          <Grid item xs={12} md={6}>
            <Card
              sx={{
                background: 'rgba(255,255,255,0.05)',
                backdropFilter: 'blur(10px)',
                color: '#fff',
                borderRadius: '16px',
                border: '1px solid rgba(255,255,255,0.1)',
              }}
            >
              <CardContent>
                <Typography variant="h6" gutterBottom color="primary">
                  System CPU / Memory Load
                </Typography>
                <Divider sx={{ mb: 2, background: 'rgba(255,255,255,0.1)' }} />
                <Typography variant="body2" color="textSecondary" gutterBottom>
                  CPU Core Count: {metrics?.cpu?.count || 1}
                </Typography>
                <Box mb={2}>
                  <Box display="flex" justifyContent="space-between" mb={0.5}>
                    <Typography variant="caption">CPU Load Average (1m)</Typography>
                    <Typography variant="caption">
                      {metrics?.cpu?.loadAvg ? metrics?.cpu?.loadAvg[0].toFixed(2) : '0.00'}
                    </Typography>
                  </Box>
                  <LinearProgress
                    variant="determinate"
                    value={
                      metrics?.cpu?.loadAvg
                        ? Math.min((metrics?.cpu?.loadAvg[0] / metrics?.cpu?.count) * 100, 100)
                        : 0
                    }
                  />
                </Box>
                <Box>
                  <Box display="flex" justifyContent="space-between" mb={0.5}>
                    <Typography variant="caption">Internal Process Node Heap Size</Typography>
                    <Typography variant="caption">
                      {metrics?.memory?.processHeap
                        ? `${Math.round(metrics.memory.processHeap / 1024 / 1024)} MB`
                        : '0 MB'}
                    </Typography>
                  </Box>
                  <LinearProgress variant="determinate" color="secondary" value={50} />
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={8}>
            <Card
              sx={{
                background: 'rgba(255,255,255,0.05)',
                backdropFilter: 'blur(10px)',
                color: '#fff',
                borderRadius: '16px',
                border: '1px solid rgba(255,255,255,0.1)',
              }}
            >
              <CardContent>
                <Typography variant="h6" gutterBottom color="primary">
                  API Gateway Request Traffic Latency Trends
                </Typography>
                <Box height={240}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data}>
                      <defs>
                        <linearGradient id="colorLatency" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#8884d8" stopOpacity={0.8} />
                          <stop offset="95%" stopColor="#8884d8" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="time" stroke="#aaa" />
                      <YAxis stroke="#aaa" />
                      <Tooltip
                        contentStyle={{
                          background: '#333',
                          border: 'none',
                          borderRadius: '8px',
                          color: '#fff',
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="latency"
                        stroke="#8884d8"
                        fillOpacity={1}
                        fill="url(#colorLatency)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={4}>
            <Card
              sx={{
                background: 'rgba(255,255,255,0.05)',
                backdropFilter: 'blur(10px)',
                color: '#fff',
                borderRadius: '16px',
                border: '1px solid rgba(255,255,255,0.1)',
              }}
            >
              <CardContent>
                <Typography variant="h6" gutterBottom color="primary">
                  Active Alert Timeline Incidents
                </Typography>
                <Divider sx={{ mb: 2, background: 'rgba(255,255,255,0.1)' }} />
                {incidents.length === 0 ? (
                  <Box display="flex" flexDirection="column" alignItems="center" py={4}>
                    <ErrorIcon color="success" sx={{ fontSize: 40, mb: 1 }} />
                    <Typography color="textSecondary" align="center">
                      No active alarms or critical tickets.
                    </Typography>
                  </Box>
                ) : (
                  incidents.slice(0, 5).map((inc) => (
                    <Box
                      key={inc._id}
                      mb={2}
                      p={1.5}
                      sx={{
                        background: 'rgba(255,255,255,0.02)',
                        borderRadius: '8px',
                        border: '1px solid rgba(255,255,255,0.05)',
                      }}
                    >
                      <Box display="flex" justifyContent="space-between" mb={0.5}>
                        <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                          {inc.title}
                        </Typography>
                        <Chip
                          label={inc.severity}
                          color="error"
                          size="small"
                          sx={{ fontSize: '10px' }}
                        />
                      </Box>
                      <Typography variant="caption" color="textSecondary">
                        {new Date(inc.createdAt).toLocaleString()}
                      </Typography>
                    </Box>
                  ))
                )}
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}
    </Box>
  );
}
