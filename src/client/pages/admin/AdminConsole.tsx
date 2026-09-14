import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../api/client.ts';
import {
  Box,
  Typography,
  Tabs,
  Tab,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Switch,
  FormControlLabel,
  Card,
  CardContent,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  TextField,
  Grid,
  Divider,
  IconButton,
  Tooltip,
  CircularProgress,
  Chip,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import SaveIcon from '@mui/icons-material/Save';
import SecurityIcon from '@mui/icons-material/Security';
import BlockIcon from '@mui/icons-material/Block';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import DownloadIcon from '@mui/icons-material/Download';
import HealthAndSafetyIcon from '@mui/icons-material/HealthAndSafety';
import GppGoodIcon from '@mui/icons-material/GppGood';
import RefreshIcon from '@mui/icons-material/Refresh';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { toast } from 'react-hot-toast';

// ---- Interfaces -------------------------------------------------------------

interface IPasswordPolicy {
  minLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumbers: boolean;
  requireSpecialChars: boolean;
}

interface SystemConfig {
  _id: string;
  maintenanceMode: boolean;
  featureFlags: { [key: string]: boolean };
  allowedIPs: string[];
  deniedIPs: string[];
  maxConcurrentSessions: number;
  sessionTimeoutMinutes: number;
  passwordPolicy: IPasswordPolicy;
}

interface AuditLogEntry {
  _id: string;
  userId?: { username: string; email: string } | string;
  action: string;
  targetModel: string;
  targetId: string;
  previousValues?: Record<string, unknown>;
  newValues?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  sessionId?: string;
  createdAt: string;
}

interface PaginatedAuditLogs {
  logs: AuditLogEntry[];
  total: number;
  page: number;
  totalPages: number;
}

interface UserSession {
  _id: string;
  userId: string;
  ipAddress: string;
  userAgent: string;
  isActive: boolean;
  lastSeenAt: string;
  expiresAt: string;
  createdAt: string;
}

interface HealthReport {
  timestamp: string;
  nodeVersion: string;
  uptime: number;
  mongoose: {
    connectionState: string;
  };
  redis: {
    status: string;
  };
  memory: {
    rss: string;
    heapTotal: string;
    heapUsed: string;
  };
}

const textFieldStyle = { mt: 1 };

export default function AdminConsole() {
  const [activeTab, setActiveTab] = useState(0);
  const queryClient = useQueryClient();

  // --- Settings tab state ---
  const [mMode, setMMode] = useState(false);
  const [flags, setFlags] = useState<{ [key: string]: boolean }>({});
  const [allowedIPsStr, setAllowedIPsStr] = useState('');
  const [deniedIPsStr, setDeniedIPsStr] = useState('');
  const [maxSessions, setMaxSessions] = useState(3);
  const [sessionTimeout, setSessionTimeout] = useState(60);

  // Password policy state
  const [passMinLength, setPassMinLength] = useState(8);
  const [passRequireUpper, setPassRequireUpper] = useState(true);
  const [passRequireLower, setPassRequireLower] = useState(true);
  const [passRequireNumber, setPassRequireNumber] = useState(true);
  const [passRequireSpecial, setPassRequireSpecial] = useState(true);

  // --- Audit Logs pagination & filters state ---
  const [auditPage, setAuditPage] = useState(1);
  const [filterAction, setFilterAction] = useState('');
  const [filterModel, setFilterModel] = useState('');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');

  // --- Security / Sessions states ---
  const [targetSessionUserId, setTargetSessionUserId] = useState('');
  const [forceLogoutUserIdInput, setForceLogoutUserIdInput] = useState('');

  // --- GDPR states ---
  const [gdprUserId, setGdprUserId] = useState('');
  const [isExportingGdpr, setIsExportingGdpr] = useState(false);

  // --- Queries ---------------------------------------------------------------

  useQuery<SystemConfig>({
    queryKey: ['system-config'],
    queryFn: async () => {
      const { data } = await apiClient.get('/admin/settings');
      setMMode(data.maintenanceMode);
      setFlags(data.featureFlags || {});
      setAllowedIPsStr(data.allowedIPs?.join(', ') || '');
      setDeniedIPsStr(data.deniedIPs?.join(', ') || '');
      setMaxSessions(data.maxConcurrentSessions ?? 3);
      setSessionTimeout(data.sessionTimeoutMinutes ?? 60);

      const policy = data.passwordPolicy || {};
      setPassMinLength(policy.minLength ?? 8);
      setPassRequireUpper(policy.requireUppercase ?? true);
      setPassRequireLower(policy.requireLowercase ?? true);
      setPassRequireNumber(policy.requireNumbers ?? true);
      setPassRequireSpecial(policy.requireSpecialChars ?? true);
      return data;
    },
  });

  const { data: auditData, isLoading: auditLoading } = useQuery<PaginatedAuditLogs>({
    queryKey: ['audit-logs', auditPage, filterAction, filterModel, filterStartDate, filterEndDate],
    queryFn: async () => {
      const params: Record<string, string | number> = { page: auditPage, limit: 15 };
      if (filterAction) params.action = filterAction;
      if (filterModel) params.targetModel = filterModel;
      if (filterStartDate) params.startDate = filterStartDate;
      if (filterEndDate) params.endDate = filterEndDate;

      const { data } = await apiClient.get('/admin/audit-logs', { params });
      return data;
    },
  });

  const { data: activeSessions = [], refetch: refetchSessions } = useQuery<UserSession[]>({
    queryKey: ['active-sessions', targetSessionUserId],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (targetSessionUserId) params.userId = targetSessionUserId;
      const { data } = await apiClient.get('/security/sessions', { params });
      return data;
    },
  });

  const { data: healthReport, refetch: refetchHealth } = useQuery<HealthReport>({
    queryKey: ['health-report'],
    queryFn: async () => {
      const { data } = await apiClient.get('/security/health');
      return data;
    },
    refetchInterval: 30000, // Poll every 30s
  });

  // --- Mutations -------------------------------------------------------------

  const updateConfigMutation = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const { data } = await apiClient.post('/admin/settings', payload);
      return data;
    },
    onSuccess: () => {
      toast.success('System security & server settings saved successfully.');
      queryClient.invalidateQueries({ queryKey: ['system-config'] });
    },
    onError: (err: unknown) => {
      const error = err as { response?: { data?: { error?: { message?: string } } } };
      toast.error(error.response?.data?.error?.message || 'Failed to update system config.');
    },
  });

  const revokeSessionMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      const { data } = await apiClient.post(`/security/sessions/${sessionId}/revoke`);
      return data;
    },
    onSuccess: () => {
      toast.success('Session has been revoked.');
      refetchSessions();
    },
    onError: (err: unknown) => {
      const error = err as { response?: { data?: { error?: { message?: string } } } };
      toast.error(error.response?.data?.error?.message || 'Failed to revoke session.');
    },
  });

  const forceLogoutUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      const { data } = await apiClient.post(`/security/users/${userId}/force-logout`);
      return data;
    },
    onSuccess: () => {
      toast.success('User terminated globally from all session scopes.');
      setForceLogoutUserIdInput('');
      refetchSessions();
    },
    onError: (err: unknown) => {
      const error = err as { response?: { data?: { error?: { message?: string } } } };
      toast.error(error.response?.data?.error?.message || 'Failed to force logout user.');
    },
  });

  // --- Handlers --------------------------------------------------------------

  const handleFlagToggle = (flagName: string) => {
    setFlags((prev) => ({
      ...prev,
      [flagName]: !prev[flagName],
    }));
  };

  const handleSaveSettings = () => {
    const allowedIPs = allowedIPsStr
      .split(',')
      .map((ip) => ip.trim())
      .filter((ip) => ip.length > 0);

    const deniedIPs = deniedIPsStr
      .split(',')
      .map((ip) => ip.trim())
      .filter((ip) => ip.length > 0);

    updateConfigMutation.mutate({
      maintenanceMode: mMode,
      featureFlags: flags,
      allowedIPs,
      deniedIPs,
      maxConcurrentSessions: maxSessions,
      sessionTimeoutMinutes: sessionTimeout,
      passwordPolicy: {
        minLength: passMinLength,
        requireUppercase: passRequireUpper,
        requireLowercase: passRequireLower,
        requireNumbers: passRequireNumber,
        requireSpecialChars: passRequireSpecial,
      },
    });
  };

  const handleGDPRDataExport = async () => {
    if (!gdprUserId) {
      toast.error('Please enter a User ID for the GDPR export request.');
      return;
    }
    setIsExportingGdpr(true);
    try {
      const { data } = await apiClient.get(`/security/gdpr/${gdprUserId}`);
      const jsonStr = JSON.stringify(data, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `GDPR_DataExport_User_${gdprUserId}.json`);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
      toast.success('GDPR profile data bundle generated and downloaded successfully.');
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: { message?: string } } } };
      toast.error(error.response?.data?.error?.message || 'GDPR Export request failed.');
    } finally {
      setIsExportingGdpr(false);
    }
  };

  // ---- Render ---------------------------------------------------------------

  return (
    <Box sx={{ width: '100%' }}>
      <Box
        sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}
      >
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800 }}>
            System Administration Console
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Configure security policies, maintenance settings, manage user active device sessions,
            and inspect SOC 2 audit logs.
          </Typography>
        </Box>
      </Box>

      <Tabs
        value={activeTab}
        onChange={(_, idx) => setActiveTab(idx)}
        sx={{ mb: 3 }}
        variant="scrollable"
        scrollButtons="auto"
      >
        <Tab label="System Configuration" />
        <Tab label="Compliance & Audit Logs" />
        <Tab label="Device Session Management" />
        <Tab label="GDPR Compliance Center" />
        <Tab label="Health Diagnostics" icon={<HealthAndSafetyIcon />} iconPosition="end" />
      </Tabs>

      {/* ---- Tab 0: System Configurations ---- */}
      {activeTab === 0 && (
        <Grid container spacing={3}>
          <Grid item xs={12} md={8}>
            <Card className="glass-panel" sx={{ p: 1, mb: 3 }}>
              <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
                    System Maintenance Control
                  </Typography>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={mMode}
                        onChange={(e) => setMMode(e.target.checked)}
                        color="error"
                      />
                    }
                    label="Activate System Maintenance Mode (Disables user-facing features, allowing admin-only access)"
                  />
                </Box>

                <Divider sx={{ opacity: 0.1 }} />

                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
                    Session Controls & Network Access Rules
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        type="number"
                        label="Max Concurrent Sessions per User"
                        fullWidth
                        value={maxSessions}
                        onChange={(e) => setMaxSessions(Number(e.target.value))}
                        sx={textFieldStyle}
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        type="number"
                        label="Session Inactivity Timeout (Minutes)"
                        fullWidth
                        value={sessionTimeout}
                        onChange={(e) => setSessionTimeout(Number(e.target.value))}
                        sx={textFieldStyle}
                      />
                    </Grid>
                    <Grid item xs={12}>
                      <TextField
                        label="IP Address Allowlist (Comma Separated)"
                        fullWidth
                        value={allowedIPsStr}
                        onChange={(e) => setAllowedIPsStr(e.target.value)}
                        placeholder="e.g. 192.168.1.1, 10.0.0.1"
                        sx={textFieldStyle}
                      />
                    </Grid>
                    <Grid item xs={12}>
                      <TextField
                        label="IP Address Denylist (Comma Separated)"
                        fullWidth
                        value={deniedIPsStr}
                        onChange={(e) => setDeniedIPsStr(e.target.value)}
                        placeholder="e.g. 198.51.100.42, 203.0.113.1"
                        sx={textFieldStyle}
                      />
                    </Grid>
                  </Grid>
                </Box>

                <Divider sx={{ opacity: 0.1 }} />

                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
                    Active Feature Flags
                  </Typography>
                  <Grid container spacing={1}>
                    {Object.keys(flags).map((flag) => (
                      <Grid item xs={12} sm={6} key={flag}>
                        <FormControlLabel
                          control={
                            <Switch checked={flags[flag]} onChange={() => handleFlagToggle(flag)} />
                          }
                          label={`Enable: ${flag.replace(/([A-Z])/g, ' $1').toUpperCase()}`}
                        />
                      </Grid>
                    ))}
                  </Grid>
                </Box>

                <Box sx={{ display: 'flex', justifyContent: 'flex-start', pt: 1 }}>
                  <Button
                    variant="contained"
                    startIcon={<SaveIcon />}
                    onClick={handleSaveSettings}
                    disabled={updateConfigMutation.isPending}
                    sx={{ background: 'linear-gradient(90deg, #8b5cf6 0%, #7c3aed 100%)' }}
                  >
                    Save System Settings
                  </Button>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={4}>
            <Card className="glass-panel" sx={{ p: 1 }}>
              <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Typography
                  variant="h6"
                  sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}
                >
                  <SecurityIcon color="primary" /> Password Policy Rules
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Enforce complexity specifications during password registration or change events.
                </Typography>

                <TextField
                  type="number"
                  label="Minimum Password Length"
                  fullWidth
                  value={passMinLength}
                  onChange={(e) => setPassMinLength(Number(e.target.value))}
                  sx={textFieldStyle}
                />

                <FormControlLabel
                  control={
                    <Switch
                      checked={passRequireUpper}
                      onChange={(e) => setPassRequireUpper(e.target.checked)}
                    />
                  }
                  label="Require Uppercase Letter"
                  sx={{ mt: 1 }}
                />

                <FormControlLabel
                  control={
                    <Switch
                      checked={passRequireLower}
                      onChange={(e) => setPassRequireLower(e.target.checked)}
                    />
                  }
                  label="Require Lowercase Letter"
                />

                <FormControlLabel
                  control={
                    <Switch
                      checked={passRequireNumber}
                      onChange={(e) => setPassRequireNumber(e.target.checked)}
                    />
                  }
                  label="Require Numeric Digit"
                />

                <FormControlLabel
                  control={
                    <Switch
                      checked={passRequireSpecial}
                      onChange={(e) => setPassRequireSpecial(e.target.checked)}
                    />
                  }
                  label="Require Special Character"
                />

                <Button
                  variant="outlined"
                  startIcon={<SaveIcon />}
                  fullWidth
                  onClick={handleSaveSettings}
                  sx={{ mt: 2 }}
                >
                  Apply Password Policy
                </Button>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* ---- Tab 1: Audit & Compliance Trails ---- */}
      {activeTab === 1 && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {/* SOC 2 Informational Badge */}
          <Box
            sx={{
              p: 2,
              display: 'flex',
              alignItems: 'center',
              gap: 1.5,
              bgcolor: 'rgba(239, 68, 68, 0.04)',
              borderRadius: 2,
              border: '1px solid rgba(239, 68, 68, 0.1)',
            }}
          >
            <SecurityIcon color="error" />
            <Typography variant="body2" color="error.light">
              Compliance audits are non-repudiable and track all login, session revocation, returns,
              and inventory modifications.
            </Typography>
          </Box>

          {/* Filters card */}
          <Card className="glass-panel" sx={{ p: 2 }}>
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} sm={3}>
                <TextField
                  label="Filter by Action"
                  fullWidth
                  value={filterAction}
                  onChange={(e) => {
                    setFilterAction(e.target.value);
                    setAuditPage(1);
                  }}
                  placeholder="e.g. LOGIN_SUCCESS"
                />
              </Grid>
              <Grid item xs={12} sm={3}>
                <TextField
                  label="Filter by Entity"
                  fullWidth
                  value={filterModel}
                  onChange={(e) => {
                    setFilterModel(e.target.value);
                    setAuditPage(1);
                  }}
                  placeholder="e.g. Session, Product"
                />
              </Grid>
              <Grid item xs={12} sm={3}>
                <TextField
                  type="date"
                  label="Start Date"
                  fullWidth
                  InputLabelProps={{ shrink: true }}
                  value={filterStartDate}
                  onChange={(e) => {
                    setFilterStartDate(e.target.value);
                    setAuditPage(1);
                  }}
                />
              </Grid>
              <Grid item xs={12} sm={3}>
                <TextField
                  type="date"
                  label="End Date"
                  fullWidth
                  InputLabelProps={{ shrink: true }}
                  value={filterEndDate}
                  onChange={(e) => {
                    setFilterEndDate(e.target.value);
                    setAuditPage(1);
                  }}
                />
              </Grid>
            </Grid>
          </Card>

          <TableContainer component={Paper} className="glass-panel">
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Timestamp</TableCell>
                  <TableCell>Operator</TableCell>
                  <TableCell>Action Type</TableCell>
                  <TableCell>IP Address</TableCell>
                  <TableCell>User Agent / Client</TableCell>
                  <TableCell>Properties Diff (Accordion)</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {auditLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} align="center">
                      <CircularProgress />
                    </TableCell>
                  </TableRow>
                ) : !auditData || auditData.logs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} align="center">
                      No matching SOC 2 compliance logs found.
                    </TableCell>
                  </TableRow>
                ) : (
                  auditData.logs.map((log) => (
                    <TableRow key={log._id}>
                      <TableCell sx={{ fontSize: '0.78rem' }}>
                        {new Date(log.createdAt).toLocaleString()}
                      </TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>
                        {typeof log.userId === 'object'
                          ? log.userId.username
                          : log.userId || 'SYSTEM PROCESS'}
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={log.action}
                          size="small"
                          variant="outlined"
                          color={log.action.includes('FAILED') ? 'error' : 'default'}
                        />
                      </TableCell>
                      <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>
                        {log.ipAddress || '—'}
                      </TableCell>
                      <TableCell
                        sx={{
                          fontSize: '0.725rem',
                          maxWidth: 150,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        <Tooltip title={log.userAgent || ''}>
                          <span>{log.userAgent || '—'}</span>
                        </Tooltip>
                      </TableCell>
                      <TableCell sx={{ minWidth: 260 }}>
                        <Accordion
                          sx={{
                            bgcolor: 'rgba(0,0,0,0.15)',
                            border: '1px solid rgba(255,255,255,0.02)',
                          }}
                        >
                          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                            <Typography variant="caption" sx={{ fontWeight: 700 }}>
                              Diff Schema Details
                            </Typography>
                          </AccordionSummary>
                          <AccordionDetails>
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                              <Typography variant="caption" color="text.secondary">
                                Target: {log.targetModel} ({log.targetId})
                              </Typography>
                              {log.previousValues && (
                                <Box>
                                  <Typography
                                    variant="caption"
                                    color="text.secondary"
                                    display="block"
                                  >
                                    PREVIOUS VALUES:
                                  </Typography>
                                  <pre
                                    style={{
                                      fontSize: '0.725rem',
                                      overflowX: 'auto',
                                      margin: 0,
                                      padding: 4,
                                      background: 'rgba(0,0,0,0.2)',
                                      borderRadius: 4,
                                    }}
                                  >
                                    {JSON.stringify(log.previousValues, null, 2)}
                                  </pre>
                                </Box>
                              )}
                              {log.newValues && (
                                <Box sx={{ mt: 1 }}>
                                  <Typography
                                    variant="caption"
                                    color="secondary.light"
                                    display="block"
                                  >
                                    NEW MUTATED VALUES:
                                  </Typography>
                                  <pre
                                    style={{
                                      fontSize: '0.725rem',
                                      overflowX: 'auto',
                                      margin: 0,
                                      padding: 4,
                                      background: 'rgba(0,0,0,0.2)',
                                      borderRadius: 4,
                                    }}
                                  >
                                    {JSON.stringify(log.newValues, null, 2)}
                                  </pre>
                                </Box>
                              )}
                            </Box>
                          </AccordionDetails>
                        </Accordion>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>

          {/* Pagination Controls */}
          {auditData && auditData.totalPages > 1 && (
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'flex-end',
                alignItems: 'center',
                gap: 2,
                mt: 1,
              }}
            >
              <Typography variant="caption" color="text.secondary">
                Page {auditData.page} of {auditData.totalPages} ({auditData.total} logs)
              </Typography>
              <Box>
                <IconButton
                  disabled={auditPage <= 1}
                  onClick={() => setAuditPage((prev) => prev - 1)}
                >
                  <ChevronLeftIcon />
                </IconButton>
                <IconButton
                  disabled={auditPage >= auditData.totalPages}
                  onClick={() => setAuditPage((prev) => prev + 1)}
                >
                  <ChevronRightIcon />
                </IconButton>
              </Box>
            </Box>
          )}
        </Box>
      )}

      {/* ---- Tab 2: Device Session Management ---- */}
      {activeTab === 2 && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <Grid container spacing={3}>
            {/* Force user logout panel */}
            <Grid item xs={12} sm={6}>
              <Card className="glass-panel" sx={{ p: 1 }}>
                <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <Typography variant="h6" sx={{ fontWeight: 700, color: 'error.light' }}>
                    Force Global User Logout
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Force revoke all sessions, device connections, and refresh tokens for a specific
                    user ID.
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 2, mt: 1 }}>
                    <TextField
                      label="User ID to Logout"
                      fullWidth
                      value={forceLogoutUserIdInput}
                      onChange={(e) => setForceLogoutUserIdInput(e.target.value)}
                    />
                    <Button
                      variant="contained"
                      color="error"
                      onClick={() => forceLogoutUserMutation.mutate(forceLogoutUserIdInput)}
                      disabled={forceLogoutUserMutation.isPending}
                    >
                      Forcelogout
                    </Button>
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            {/* Session Search/Filter Panel */}
            <Grid item xs={12} sm={6}>
              <Card className="glass-panel" sx={{ p: 1, height: '100%' }}>
                <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <Typography variant="h6" sx={{ fontWeight: 700 }}>
                    Active Sessions Search
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Filter active device sessions by user database ID.
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 2, mt: 1 }}>
                    <TextField
                      label="Filter by User ID (Optional)"
                      fullWidth
                      value={targetSessionUserId}
                      onChange={(e) => setTargetSessionUserId(e.target.value)}
                    />
                    <Button
                      variant="outlined"
                      onClick={() => refetchSessions()}
                      startIcon={<RefreshIcon />}
                    >
                      Reload
                    </Button>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {/* Active sessions list */}
          <TableContainer component={Paper} className="glass-panel">
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Session ID</TableCell>
                  <TableCell>User ID</TableCell>
                  <TableCell>IP Address</TableCell>
                  <TableCell>User Agent (Device Details)</TableCell>
                  <TableCell>Last Active</TableCell>
                  <TableCell>Expires</TableCell>
                  <TableCell>Action</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {activeSessions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} align="center">
                      No active sessions found.
                    </TableCell>
                  </TableRow>
                ) : (
                  activeSessions.map((session) => (
                    <TableRow key={session._id}>
                      <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>
                        {session._id.slice(-6)}
                      </TableCell>
                      <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>
                        {session.userId}
                      </TableCell>
                      <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.78rem' }}>
                        {session.ipAddress}
                      </TableCell>
                      <TableCell
                        sx={{
                          fontSize: '0.725rem',
                          maxWidth: 200,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        <Tooltip title={session.userAgent}>
                          <span>{session.userAgent}</span>
                        </Tooltip>
                      </TableCell>
                      <TableCell sx={{ fontSize: '0.78rem' }}>
                        {new Date(session.lastSeenAt).toLocaleString()}
                      </TableCell>
                      <TableCell sx={{ fontSize: '0.78rem' }}>
                        {new Date(session.expiresAt).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <Button
                          size="small"
                          color="error"
                          variant="outlined"
                          onClick={() => revokeSessionMutation.mutate(session._id)}
                          disabled={revokeSessionMutation.isPending}
                        >
                          Revoke
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      )}

      {/* ---- Tab 3: GDPR Compliance Center ---- */}
      {activeTab === 3 && (
        <Card className="glass-panel" sx={{ p: 2 }}>
          <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
            <Typography
              variant="h6"
              sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}
            >
              <GppGoodIcon color="primary" /> GDPR Right to Access & Portability
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Input a user's database identifier to generate and download a complete cryptographic
              export bundle of all recorded profile information, login sessions, and audit entries.
            </Typography>
            <Box sx={{ display: 'flex', gap: 2, maxWidth: 600, mt: 1 }}>
              <TextField
                label="Target User ID"
                fullWidth
                value={gdprUserId}
                onChange={(e) => setGdprUserId(e.target.value)}
                placeholder="e.g. 64b8a24c53825bf1538a8e1b"
              />
              <Button
                variant="contained"
                startIcon={<DownloadIcon />}
                onClick={handleGDPRDataExport}
                disabled={isExportingGdpr}
                sx={{
                  minWidth: 200,
                  background: 'linear-gradient(90deg, #8b5cf6 0%, #7c3aed 100%)',
                }}
              >
                {isExportingGdpr ? 'Generating Bundle…' : 'Export GDPR Bundle'}
              </Button>
            </Box>
          </CardContent>
        </Card>
      )}

      {/* ---- Tab 4: Health Diagnostics ---- */}
      {activeTab === 4 && healthReport && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              Cluster Diagnostics Report
            </Typography>
            <Button variant="outlined" startIcon={<RefreshIcon />} onClick={() => refetchHealth()}>
              Refresh Diagnostics
            </Button>
          </Box>

          <Grid container spacing={3}>
            {/* Database Mongoose status */}
            <Grid item xs={12} sm={6} md={3}>
              <Paper
                className="glass-panel"
                sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 1 }}
              >
                <Typography variant="caption" color="text.secondary">
                  Mongoose DB State
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  {healthReport.mongoose.connectionState === 'CONNECTED' ? (
                    <CheckCircleIcon color="success" />
                  ) : (
                    <BlockIcon color="error" />
                  )}
                  <Typography variant="h6" sx={{ fontWeight: 800 }}>
                    {healthReport.mongoose.connectionState}
                  </Typography>
                </Box>
              </Paper>
            </Grid>

            {/* Redis database state */}
            <Grid item xs={12} sm={6} md={3}>
              <Paper
                className="glass-panel"
                sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 1 }}
              >
                <Typography variant="caption" color="text.secondary">
                  Redis Pub/Sub State
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  {healthReport.redis.status === 'HEALTHY' ? (
                    <CheckCircleIcon color="success" />
                  ) : (
                    <BlockIcon color="error" />
                  )}
                  <Typography variant="h6" sx={{ fontWeight: 800 }}>
                    {healthReport.redis.status}
                  </Typography>
                </Box>
              </Paper>
            </Grid>

            {/* CPU uptime */}
            <Grid item xs={12} sm={6} md={3}>
              <Paper
                className="glass-panel"
                sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 1 }}
              >
                <Typography variant="caption" color="text.secondary">
                  Process Uptime
                </Typography>
                <Typography variant="h6" sx={{ fontWeight: 800, color: 'primary.light' }}>
                  {Math.round(healthReport.uptime)} seconds
                </Typography>
              </Paper>
            </Grid>

            {/* Node Version */}
            <Grid item xs={12} sm={6} md={3}>
              <Paper
                className="glass-panel"
                sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 1 }}
              >
                <Typography variant="caption" color="text.secondary">
                  Node.js Engine
                </Typography>
                <Typography variant="h6" sx={{ fontWeight: 800, color: 'secondary.light' }}>
                  {healthReport.nodeVersion}
                </Typography>
              </Paper>
            </Grid>
          </Grid>

          {/* Memory Heap card */}
          <Card className="glass-panel" sx={{ p: 1 }}>
            <CardContent>
              <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
                Thread Memory Allocation Diagnostics
              </Typography>
              <Grid container spacing={3}>
                <Grid item xs={4}>
                  <Typography variant="caption" color="text.secondary" display="block">
                    RSS Allocation (Resident Set Size)
                  </Typography>
                  <Typography variant="h5" sx={{ fontWeight: 800 }}>
                    {healthReport.memory.rss}
                  </Typography>
                </Grid>
                <Grid item xs={4}>
                  <Typography variant="caption" color="text.secondary" display="block">
                    Heap Total Pool Size
                  </Typography>
                  <Typography variant="h5" sx={{ fontWeight: 800 }}>
                    {healthReport.memory.heapTotal}
                  </Typography>
                </Grid>
                <Grid item xs={4}>
                  <Typography variant="caption" color="text.secondary" display="block">
                    Heap Active Memory Usage
                  </Typography>
                  <Typography variant="h5" sx={{ fontWeight: 800, color: 'warning.light' }}>
                    {healthReport.memory.heapUsed}
                  </Typography>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Box>
      )}
    </Box>
  );
}
