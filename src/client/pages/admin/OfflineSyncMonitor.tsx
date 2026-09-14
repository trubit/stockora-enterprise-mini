/**
 * OfflineSyncMonitor.tsx
 * Admin page for monitoring offline POS sync status, job history,
 * and manually triggering sync operations.
 */

import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../api/client.ts';
import {
  Box,
  Typography,
  Button,
  Paper,
  Grid,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  LinearProgress,
  Alert,
  Collapse,
  IconButton,
  Tooltip,
  List,
  ListItem,
  ListItemText,
  Tabs,
  Tab,
  Badge,
} from '@mui/material';
import SyncIcon from '@mui/icons-material/Sync';
import CloudDoneIcon from '@mui/icons-material/CloudDone';
import CloudOffIcon from '@mui/icons-material/CloudOff';
import ReplayIcon from '@mui/icons-material/Replay';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import { toast } from 'react-hot-toast';
import { getPendingCount, getSyncLog, type SyncLogEntry } from '../../offline/offlineStore.ts';
import { runSync, on as onSyncEvent } from '../../offline/syncEngine.ts';
import { useAuthStore } from '../../store/auth.ts';

// ---- Types ------------------------------------------------------------------

interface SyncJob {
  jobId: string;
  startedAt: string;
  completedAt?: string;
  status: 'RUNNING' | 'COMPLETED' | 'FAILED';
  synced: number;
  conflicts: number;
  failures: number;
  logs: string[];
}

interface SyncStatusResponse {
  dbTransactionCount: number;
  recentJobs: SyncJob[];
  totalSynced: number;
  totalConflicts: number;
  totalFailures: number;
}

// ---- Component --------------------------------------------------------------

export default function OfflineSyncMonitor() {
  const [activeTab, setActiveTab] = useState(0);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);
  const [syncLog, setSyncLog] = useState<SyncLogEntry[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [expandedJob, setExpandedJob] = useState<string | null>(null);
  const [syncProgress, setSyncProgress] = useState<{
    synced: number;
    conflicts: number;
    failures: number;
    total: number;
  } | null>(null);

  const queryClient = useQueryClient();
  const { accessToken: token } = useAuthStore();

  // --- Server sync status query ---
  const { data: serverStatus, isLoading: serverLoading } = useQuery<SyncStatusResponse>({
    queryKey: ['sync-status'],
    queryFn: async () => (await apiClient.get('/branch-sync/status')).data,
    refetchInterval: 15000,
  });

  // --- Load local IndexedDB state ---
  const refreshLocalState = useCallback(async () => {
    const [count, log] = await Promise.all([getPendingCount(), getSyncLog(50)]);
    setPendingCount(count);
    setSyncLog(log);
  }, []);

  useEffect(() => {
    Promise.resolve().then(() => refreshLocalState());

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Listen to sync engine events
    const offStart = onSyncEvent('sync:start', ({ total }) => {
      setIsSyncing(true);
      setSyncProgress({ synced: 0, conflicts: 0, failures: 0, total: total ?? 0 });
    });
    const offProgress = onSyncEvent('sync:progress', ({ synced, conflicts, failures, total }) => {
      setSyncProgress({
        synced: synced ?? 0,
        conflicts: conflicts ?? 0,
        failures: failures ?? 0,
        total: total ?? 0,
      });
    });
    const offComplete = onSyncEvent('sync:complete', ({ pendingCount: pc }) => {
      setIsSyncing(false);
      setPendingCount(pc ?? 0);
      queryClient.invalidateQueries({ queryKey: ['sync-status'] });
      refreshLocalState();
      setSyncProgress(null);
    });
    const offPending = onSyncEvent('pending:change', () => refreshLocalState());

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      offStart();
      offProgress();
      offComplete();
      offPending();
    };
  }, [refreshLocalState, queryClient]);

  // --- Manual sync mutation ---
  const manualSyncMutation = useMutation({
    mutationFn: async () => {
      if (!token) throw new Error('Not authenticated.');
      return runSync(token);
    },
    onSuccess: (result) => {
      toast.success(
        `Sync complete: ${result.synced} synced, ${result.conflicts} conflicts, ${result.failures} failed.`
      );
      queryClient.invalidateQueries({ queryKey: ['sync-status'] });
      refreshLocalState();
    },
    onError: (err: { message?: string }) => toast.error(err.message || 'Sync failed.'),
  });

  const retryMutation = useMutation({
    mutationFn: async (jobId: string) => (await apiClient.post(`/branch-sync/retry/${jobId}`)).data,
    onSuccess: () => {
      toast.success('Job flagged for retry.');
      queryClient.invalidateQueries({ queryKey: ['sync-status'] });
    },
  });

  // ---- Helpers ---------------------------------------------------------------

  const syncPercent =
    syncProgress && syncProgress.total > 0
      ? Math.round(
          ((syncProgress.synced + syncProgress.conflicts + syncProgress.failures) /
            syncProgress.total) *
            100
        )
      : 0;

  // ---- Render ---------------------------------------------------------------

  return (
    <Box sx={{ width: '100%' }}>
      {/* Header */}
      <Box
        sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}
      >
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800 }}>
            Offline POS Sync Monitor
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Monitor IndexedDB queue, sync job history, and manually trigger synchronisation.
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={
            isSyncing ? (
              <SyncIcon
                sx={{
                  animation: 'spin 1s linear infinite',
                  '@keyframes spin': {
                    from: { transform: 'rotate(0deg)' },
                    to: { transform: 'rotate(360deg)' },
                  },
                }}
              />
            ) : (
              <SyncIcon />
            )
          }
          onClick={() => manualSyncMutation.mutate()}
          disabled={isSyncing || !isOnline || pendingCount === 0}
          sx={{ background: 'linear-gradient(90deg, #8b5cf6 0%, #7c3aed 100%)' }}
        >
          {isSyncing ? 'Syncing…' : `Sync Now (${pendingCount})`}
        </Button>
      </Box>

      {/* Network Status Banner */}
      <Collapse in={!isOnline}>
        <Alert severity="error" sx={{ mb: 3 }} icon={<CloudOffIcon />}>
          <strong>Offline Mode Active</strong> — POS transactions are being queued locally. They
          will sync automatically when connectivity is restored.
        </Alert>
      </Collapse>

      {/* Sync Progress */}
      {isSyncing && syncProgress && (
        <Paper className="glass-panel" sx={{ p: 2, mb: 3 }}>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            Syncing {syncProgress.total} transactions… ({syncPercent}%)
          </Typography>
          <LinearProgress
            variant="determinate"
            value={syncPercent}
            sx={{ height: 8, borderRadius: 4 }}
          />
          <Box sx={{ display: 'flex', gap: 2, mt: 1 }}>
            <Typography variant="caption" color="success.light">
              ✓ {syncProgress.synced} synced
            </Typography>
            <Typography variant="caption" color="warning.light">
              ⚡ {syncProgress.conflicts} conflicts
            </Typography>
            <Typography variant="caption" color="error.light">
              ✗ {syncProgress.failures} failed
            </Typography>
          </Box>
        </Paper>
      )}

      {/* KPI Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {[
          {
            label: 'Network Status',
            value: isOnline ? 'Online' : 'Offline',
            icon: isOnline ? (
              <CloudDoneIcon sx={{ color: 'success.light', fontSize: 36 }} />
            ) : (
              <CloudOffIcon sx={{ color: 'error.light', fontSize: 36 }} />
            ),
            color: isOnline ? 'success.light' : 'error.light',
          },
          {
            label: 'Pending in Queue',
            value: pendingCount,
            color: pendingCount > 0 ? 'warning.light' : 'success.light',
            icon: (
              <Badge
                badgeContent={pendingCount}
                color={pendingCount > 0 ? 'warning' : 'success'}
                max={999}
              >
                <SyncIcon sx={{ fontSize: 36 }} />
              </Badge>
            ),
          },
          {
            label: 'DB Transactions',
            value: serverStatus?.dbTransactionCount ?? '—',
            color: 'primary.light',
            icon: <CloudDoneIcon sx={{ color: 'primary.light', fontSize: 36 }} />,
          },
          {
            label: 'Recent Jobs (Synced)',
            value: serverStatus?.totalSynced ?? 0,
            color: 'secondary.light',
            icon: <SyncIcon sx={{ color: 'secondary.light', fontSize: 36 }} />,
          },
        ].map((kpi) => (
          <Grid item xs={12} sm={6} md={3} key={kpi.label}>
            <Paper
              className="glass-panel"
              sx={{ p: 3, display: 'flex', alignItems: 'center', gap: 2 }}
            >
              {kpi.icon}
              <Box>
                <Typography variant="caption" color="text.secondary">
                  {kpi.label}
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 800, color: kpi.color }}>
                  {kpi.value}
                </Typography>
              </Box>
            </Paper>
          </Grid>
        ))}
      </Grid>

      <Tabs value={activeTab} onChange={(_, idx) => setActiveTab(idx)} sx={{ mb: 3 }}>
        <Tab label="Server Job History" />
        <Tab
          label={
            <Badge badgeContent={syncLog.length} color="primary" max={99}>
              Local Sync Log
            </Badge>
          }
        />
      </Tabs>

      {/* ---- Tab 0: Server Job History ---- */}
      {activeTab === 0 && (
        <TableContainer component={Paper} className="glass-panel">
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Job ID</TableCell>
                <TableCell>Started</TableCell>
                <TableCell>Completed</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Synced</TableCell>
                <TableCell>Conflicts</TableCell>
                <TableCell>Failures</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {serverLoading ? (
                <TableRow>
                  <TableCell colSpan={8}>
                    <LinearProgress />
                  </TableCell>
                </TableRow>
              ) : (serverStatus?.recentJobs ?? []).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} align="center">
                    No sync jobs recorded yet.
                  </TableCell>
                </TableRow>
              ) : (
                (serverStatus?.recentJobs ?? []).map((job) => (
                  <>
                    <TableRow key={job.jobId}>
                      <TableCell
                        sx={{
                          fontFamily: 'monospace',
                          fontSize: '0.75rem',
                          color: 'secondary.light',
                        }}
                      >
                        {job.jobId}
                      </TableCell>
                      <TableCell sx={{ fontSize: '0.78rem' }}>
                        {new Date(job.startedAt).toLocaleString()}
                      </TableCell>
                      <TableCell sx={{ fontSize: '0.78rem' }}>
                        {job.completedAt ? new Date(job.completedAt).toLocaleString() : '—'}
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={job.status}
                          color={
                            job.status === 'COMPLETED'
                              ? 'success'
                              : job.status === 'RUNNING'
                                ? 'info'
                                : 'error'
                          }
                          size="small"
                        />
                      </TableCell>
                      <TableCell sx={{ color: 'success.light', fontWeight: 700 }}>
                        {job.synced}
                      </TableCell>
                      <TableCell sx={{ color: 'warning.light', fontWeight: 700 }}>
                        {job.conflicts}
                      </TableCell>
                      <TableCell sx={{ color: 'error.light', fontWeight: 700 }}>
                        {job.failures}
                      </TableCell>
                      <TableCell sx={{ display: 'flex', gap: 0.5 }}>
                        {job.status === 'FAILED' && (
                          <Tooltip title="Retry job">
                            <IconButton
                              size="small"
                              color="warning"
                              onClick={() => retryMutation.mutate(job.jobId)}
                            >
                              <ReplayIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                        {job.logs.length > 0 && (
                          <Tooltip title="View logs">
                            <IconButton
                              size="small"
                              onClick={() =>
                                setExpandedJob(expandedJob === job.jobId ? null : job.jobId)
                              }
                            >
                              {expandedJob === job.jobId ? (
                                <ExpandLessIcon fontSize="small" />
                              ) : (
                                <ExpandMoreIcon fontSize="small" />
                              )}
                            </IconButton>
                          </Tooltip>
                        )}
                      </TableCell>
                    </TableRow>
                    {expandedJob === job.jobId && (
                      <TableRow key={`${job.jobId}-logs`}>
                        <TableCell colSpan={8} sx={{ p: 0, background: 'rgba(0,0,0,0.2)' }}>
                          <Collapse in>
                            <List dense sx={{ px: 3, py: 1 }}>
                              {job.logs.map((log, i) => (
                                <ListItem key={i} sx={{ py: 0.1 }}>
                                  <ListItemText
                                    primary={log}
                                    primaryTypographyProps={{
                                      variant: 'caption',
                                      fontFamily: 'monospace',
                                      color: log.startsWith('Conflict')
                                        ? 'warning.light'
                                        : log.startsWith('Failure')
                                          ? 'error.light'
                                          : 'success.light',
                                    }}
                                  />
                                </ListItem>
                              ))}
                            </List>
                          </Collapse>
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* ---- Tab 1: Local Sync Log ---- */}
      {activeTab === 1 && (
        <TableContainer component={Paper} className="glass-panel">
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Transaction Number</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Message</TableCell>
                <TableCell>Synced At</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {syncLog.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} align="center">
                    No local sync log entries.
                  </TableCell>
                </TableRow>
              ) : (
                syncLog.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell sx={{ fontWeight: 700 }}>{entry.transactionNumber}</TableCell>
                    <TableCell>
                      <Chip
                        label={entry.status}
                        color={
                          entry.status === 'SUCCESS'
                            ? 'success'
                            : entry.status === 'CONFLICT'
                              ? 'warning'
                              : 'error'
                        }
                        size="small"
                      />
                    </TableCell>
                    <TableCell sx={{ fontSize: '0.78rem', color: 'text.secondary' }}>
                      {entry.message}
                    </TableCell>
                    <TableCell sx={{ fontSize: '0.78rem' }}>
                      {new Date(entry.syncedAt).toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
}
