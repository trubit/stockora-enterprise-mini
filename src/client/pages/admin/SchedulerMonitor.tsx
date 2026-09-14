import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../api/client.ts';
import {
  Box,
  Typography,
  Button,
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
  LinearProgress,
  Tabs,
  Tab,
} from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import PlayCircleIcon from '@mui/icons-material/PlayCircle';
import RefreshIcon from '@mui/icons-material/Refresh';
import ScheduleIcon from '@mui/icons-material/Schedule';
import { toast } from 'react-hot-toast';

// ---- Types ------------------------------------------------------------------

interface QueueMetric {
  name: string;
  status: 'HEALTHY' | 'PAUSED' | 'ERROR';
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  concurrency: number;
  isPaused: boolean;
}

interface MonitorData {
  activeWorkers: string[];
  queues: QueueMetric[];
}

interface CronJobSpec {
  queueName: string;
  jobName: string;
  cron: string;
}

// ---- Job trigger definitions ------------------------------------------------

const ALL_TASKS = [
  { name: 'CHECK_LOW_STOCK', label: 'Scan Low Stock', color: 'warning' as const },
  { name: 'DB_CLEANUP', label: 'Rotate Audit Logs', color: 'inherit' as const },
  { name: 'EXPIRE_PROMOTIONS', label: 'Expire Promotions', color: 'secondary' as const },
  { name: 'EXPIRE_GIFT_CARDS', label: 'Expire Gift Cards', color: 'secondary' as const },
  { name: 'REORDER_SUGGESTIONS', label: 'Reorder Suggestions', color: 'info' as const },
  { name: 'LOYALTY_TIER_RECALC', label: 'Recalculate Tiers', color: 'primary' as const },
  { name: 'FLUSH_SCHEDULED_NOTIFS', label: 'Flush Notifications', color: 'info' as const },
  { name: 'SYNC_OFFLINE_STATS', label: 'Sync Offline Stats', color: 'inherit' as const },
  { name: 'GENERATE_DAILY_REPORT', label: 'Generate Daily Report', color: 'success' as const },
  { name: 'WARRANTY_EXPIRY_ALERT', label: 'Warranty Expiry Alerts', color: 'error' as const },
];

// ---- Component --------------------------------------------------------------

export default function SchedulerMonitor() {
  const [activeTab, setActiveTab] = useState(0);
  const queryClient = useQueryClient();

  const { data: metrics = { activeWorkers: [], queues: [] }, isLoading: metricsLoading } =
    useQuery<MonitorData>({
      queryKey: ['scheduler-metrics'],
      queryFn: async () => (await apiClient.get('/automation/metrics')).data,
      refetchInterval: 10000,
    });

  const { data: cronJobs = [] } = useQuery<CronJobSpec[]>({
    queryKey: ['cron-jobs'],
    queryFn: async () => (await apiClient.get('/automation/cron-jobs')).data,
  });

  const runJobMutation = useMutation({
    mutationFn: async (task: string) =>
      (await apiClient.post('/automation/trigger', { task })).data,
    onSuccess: (data: { message: string; jobId: string }) => {
      toast.success(`${data.message} (Job: ${data.jobId})`);
      queryClient.invalidateQueries({ queryKey: ['scheduler-metrics'] });
    },
    onError: (err: { response?: { data?: { error?: { message?: string } } } }) =>
      toast.error(err.response?.data?.error?.message || 'Failed to trigger job.'),
  });

  const pauseMutation = useMutation({
    mutationFn: async (name: string) =>
      (await apiClient.post(`/automation/queue/${name}/pause`)).data,
    onSuccess: (_data, name) => {
      toast.success(`Queue [${name}] paused.`);
      queryClient.invalidateQueries({ queryKey: ['scheduler-metrics'] });
    },
  });

  const resumeMutation = useMutation({
    mutationFn: async (name: string) =>
      (await apiClient.post(`/automation/queue/${name}/resume`)).data,
    onSuccess: (_data, name) => {
      toast.success(`Queue [${name}] resumed.`);
      queryClient.invalidateQueries({ queryKey: ['scheduler-metrics'] });
    },
  });

  // ---- Render ---------------------------------------------------------------

  return (
    <Box sx={{ width: '100%' }}>
      {/* Header */}
      <Box
        sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}
      >
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800 }}>
            Scheduler & Queue Monitor
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Inspect BullMQ queue health, trigger background jobs, and manage cron schedules.
          </Typography>
        </Box>
        <Tooltip title="Refresh metrics">
          <IconButton
            onClick={() => queryClient.invalidateQueries({ queryKey: ['scheduler-metrics'] })}
          >
            <RefreshIcon />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Worker KPIs */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={4}>
          <Paper className="glass-panel" sx={{ p: 3 }}>
            <Typography variant="caption" color="text.secondary">
              Active Workers
            </Typography>
            <Typography variant="h4" sx={{ fontWeight: 800, color: 'success.light' }}>
              {metrics.activeWorkers.length}
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 1 }}>
              {metrics.activeWorkers.map((w) => (
                <Chip key={w} label={w} color="primary" size="small" />
              ))}
            </Box>
          </Paper>
        </Grid>
        {(metrics.queues ?? []).map((q) => (
          <Grid item xs={12} sm={4} key={q.name}>
            <Paper className="glass-panel" sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="caption" color="text.secondary">
                  {q.name}
                </Typography>
                <Chip
                  label={q.status}
                  color={
                    q.status === 'HEALTHY' ? 'success' : q.status === 'PAUSED' ? 'warning' : 'error'
                  }
                  size="small"
                />
              </Box>
              {metricsLoading ? (
                <LinearProgress sx={{ mt: 1 }} />
              ) : (
                <Grid container spacing={1} sx={{ mt: 1 }}>
                  {[
                    { label: 'Waiting', value: q.waiting, color: 'info.light' },
                    { label: 'Active', value: q.active, color: 'success.light' },
                    { label: 'Failed', value: q.failed, color: 'error.light' },
                    { label: 'Done', value: q.completed, color: 'text.secondary' },
                  ].map((stat) => (
                    <Grid item xs={3} key={stat.label}>
                      <Typography variant="caption" color="text.secondary" display="block">
                        {stat.label}
                      </Typography>
                      <Typography variant="h6" sx={{ fontWeight: 800, color: stat.color }}>
                        {stat.value}
                      </Typography>
                    </Grid>
                  ))}
                </Grid>
              )}
              <Box sx={{ mt: 1.5, display: 'flex', gap: 1 }}>
                {!q.isPaused ? (
                  <Tooltip title="Pause queue">
                    <IconButton
                      size="small"
                      color="warning"
                      onClick={() => pauseMutation.mutate(q.name)}
                    >
                      <PauseIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                ) : (
                  <Tooltip title="Resume queue">
                    <IconButton
                      size="small"
                      color="success"
                      onClick={() => resumeMutation.mutate(q.name)}
                    >
                      <PlayCircleIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                )}
              </Box>
            </Paper>
          </Grid>
        ))}
      </Grid>

      <Tabs value={activeTab} onChange={(_, idx) => setActiveTab(idx)} sx={{ mb: 3 }}>
        <Tab label="Manual Triggers" />
        <Tab
          label={`Cron Schedule (${cronJobs.length})`}
          icon={<ScheduleIcon />}
          iconPosition="end"
        />
      </Tabs>

      {/* ---- Tab 0: Manual Triggers ---- */}
      {activeTab === 0 && (
        <Grid container spacing={2}>
          {ALL_TASKS.map((task) => (
            <Grid item xs={12} sm={6} md={4} key={task.name}>
              <Paper
                className="glass-panel"
                sx={{
                  p: 2.5,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                    {task.label}
                  </Typography>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ fontFamily: 'monospace' }}
                  >
                    {task.name}
                  </Typography>
                </Box>
                <Button
                  variant="contained"
                  size="small"
                  startIcon={<PlayArrowIcon />}
                  color={task.color}
                  onClick={() => runJobMutation.mutate(task.name)}
                  disabled={runJobMutation.isPending}
                  sx={{ minWidth: 90 }}
                >
                  Run
                </Button>
              </Paper>
            </Grid>
          ))}
        </Grid>
      )}

      {/* ---- Tab 1: Cron Schedule ---- */}
      {activeTab === 1 && (
        <TableContainer component={Paper} className="glass-panel">
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Job Name</TableCell>
                <TableCell>Queue</TableCell>
                <TableCell>Cron Expression</TableCell>
                <TableCell>Human-Readable</TableCell>
                <TableCell>Trigger Now</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {cronJobs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} align="center">
                    No cron jobs registered yet.
                  </TableCell>
                </TableRow>
              ) : (
                cronJobs.map((job) => {
                  const task = ALL_TASKS.find((t) => t.name === job.jobName);
                  return (
                    <TableRow key={job.jobName}>
                      <TableCell>
                        <Typography fontWeight={700} variant="body2">
                          {job.jobName}
                        </Typography>
                        {task && (
                          <Typography variant="caption" color="text.secondary">
                            {task.label}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell
                        sx={{
                          fontFamily: 'monospace',
                          fontSize: '0.8rem',
                          color: 'secondary.light',
                        }}
                      >
                        {job.queueName}
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={job.cron}
                          size="small"
                          sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}
                        />
                      </TableCell>
                      <TableCell sx={{ fontSize: '0.8rem', color: 'text.secondary' }}>
                        {job.cron === '0 * * * *'
                          ? 'Every hour'
                          : job.cron === '*/5 * * * *'
                            ? 'Every 5 minutes'
                            : job.cron === '0 2 * * *'
                              ? 'Daily at 02:00'
                              : job.cron === '30 0 * * *'
                                ? 'Daily at 00:30'
                                : job.cron === '45 0 * * *'
                                  ? 'Daily at 00:45'
                                  : job.cron === '0 8 * * 1-5'
                                    ? 'Mon–Fri at 08:00'
                                    : job.cron === '0 3 * * 0'
                                      ? 'Sundays at 03:00'
                                      : job.cron === '55 23 * * *'
                                        ? 'Daily at 23:55'
                                        : job.cron === '0 9 * * *'
                                          ? 'Daily at 09:00'
                                          : job.cron}
                      </TableCell>
                      <TableCell>
                        <Tooltip title="Trigger immediately">
                          <IconButton
                            size="small"
                            color="primary"
                            onClick={() => runJobMutation.mutate(job.jobName)}
                            disabled={runJobMutation.isPending}
                          >
                            <PlayArrowIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
}
