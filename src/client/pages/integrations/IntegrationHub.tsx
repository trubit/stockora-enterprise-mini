import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  Grid,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  IconButton,
  Tooltip,
  Alert,
  Divider,
  useTheme,
} from '@mui/material';
import AccountBalance from '@mui/icons-material/AccountBalance';
import LocalShipping from '@mui/icons-material/LocalShipping';
import Chat from '@mui/icons-material/Chat';
import Storefront from '@mui/icons-material/Storefront';
import Code from '@mui/icons-material/Code';
import Sync from '@mui/icons-material/Sync';
import CheckCircle from '@mui/icons-material/CheckCircle';
import Settings from '@mui/icons-material/Settings';
import PowerSettingsNew from '@mui/icons-material/PowerSettingsNew';
import History from '@mui/icons-material/History';
import Close from '@mui/icons-material/Close';
import Search from '@mui/icons-material/Search';
import CloudQueue from '@mui/icons-material/CloudQueue';
import { apiClient } from '../../api/client.ts';
import { notify } from '../../utils/notify.ts';
import { useConfirm } from '../../context/ConfirmDialogContext.tsx';
import PageHeader from '../../components/PageHeader.tsx';
import StatCard from '../../components/StatCard.tsx';
import StatusChip from '../../components/StatusChip.tsx';

interface IntegrationItem {
  provider: string;
  name: string;
  category: string;
  description: string;
  status: 'CONNECTED' | 'AVAILABLE' | 'PENDING' | 'FAILED' | 'DISABLED' | 'DEGRADED';
  isConfigured: boolean;
  configuration: Record<string, any>;
  hasCredentials?: boolean;
  requiredConfigFields: Array<{
    name: string;
    label: string;
    type: 'text' | 'password' | 'select' | 'url';
    options?: string[];
    required: boolean;
    helperText?: string;
  }>;
  syncSettings?: {
    enabled: boolean;
    direction: string;
    frequencyMinutes: number;
    syncedEntities: string[];
  };
  lastSyncAt?: string;
  lastSyncStatus?: string;
  lastError?: { message: string; timestamp: string };
}

export const IntegrationHub: React.FC = () => {
  const theme = useTheme();
  const confirm = useConfirm();
  const [integrations, setIntegrations] = useState<IntegrationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [selectedStatus, setSelectedStatus] = useState('ALL');

  // Configure Modal
  const [selectedItem, setSelectedItem] = useState<IntegrationItem | null>(null);
  const [configModalOpen, setConfigModalOpen] = useState(false);
  const [formConfig, setFormConfig] = useState<Record<string, any>>({});
  const [formCredentials, setFormCredentials] = useState('');
  const [testingConnection, setTestingConnection] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);
  const [syncingProvider, setSyncingProvider] = useState<string | null>(null);

  // Audit Logs Dialog
  const [logsModalOpen, setLogsModalOpen] = useState(false);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  const isDark = theme.palette.mode === 'dark';

  useEffect(() => {
    fetchIntegrations();
  }, []);

  const fetchIntegrations = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get('/integrations');
      if (res.data?.success) {
        setIntegrations(res.data.data);
      }
    } catch (err: any) {
      if (err.response?.status !== 401) {
        notify.error('Failed to load integrations catalog');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleOpenConfigure = (item: IntegrationItem) => {
    setSelectedItem(item);
    setFormConfig(item.configuration || {});
    setFormCredentials('');
    setConfigModalOpen(true);
  };

  const handleTestConnection = async () => {
    if (!selectedItem) return;
    try {
      setTestingConnection(true);
      const res = await apiClient.post(`/integrations/${selectedItem.provider}/test`, {
        configuration: formConfig,
        credentials: formCredentials || undefined,
      });

      if (res.data?.success && res.data.data?.connected) {
        notify.success(res.data.data.message || 'Connection verified successfully!');
      } else {
        notify.error(res.data?.data?.message || 'Connection test failed');
      }
    } catch (err: any) {
      notify.error(err, { fallback: 'Connection test failed' });
    } finally {
      setTestingConnection(false);
    }
  };

  const handleSaveConfiguration = async () => {
    if (!selectedItem) return;
    try {
      setSavingConfig(true);
      const res = await apiClient.post(`/integrations/${selectedItem.provider}/configure`, {
        configuration: formConfig,
        credentials: formCredentials || undefined,
      });

      if (res.data?.success) {
        notify.success(`${selectedItem.name} connected successfully!`);
        setConfigModalOpen(false);
        fetchIntegrations();
      }
    } catch (err: any) {
      notify.error(err, { fallback: 'Failed to save integration' });
    } finally {
      setSavingConfig(false);
    }
  };

  const handleDisconnect = async (provider: string) => {
    const confirmed = await confirm({
      title: 'Disconnect Integration',
      message:
        'Are you sure you want to disconnect this integration? Data synchronization and webhook events for this provider will be halted.',
      confirmText: 'Disconnect',
      severity: 'error',
    });
    if (!confirmed) return;

    try {
      const res = await apiClient.post(`/integrations/${provider}/disconnect`);
      if (res.data?.success) {
        notify.success('Integration disconnected.');
        fetchIntegrations();
      }
    } catch (err) {
      notify.error(err, { fallback: 'Failed to disconnect integration' });
    }
  };

  const handleTriggerSync = async (provider: string) => {
    try {
      setSyncingProvider(provider);
      const res = await apiClient.post(`/integrations/${provider}/sync`);
      if (res.data?.success) {
        notify.success(`Data sync completed for ${provider.toUpperCase()}`);
        fetchIntegrations();
      }
    } catch (err: any) {
      notify.error(err, { fallback: 'Sync failed' });
    } finally {
      setSyncingProvider(null);
    }
  };

  const handleOpenLogs = async () => {
    try {
      setLogsModalOpen(true);
      setLoadingLogs(true);
      const res = await apiClient.get('/integrations/audit-logs');
      if (res.data?.success) {
        setAuditLogs(res.data.data || []);
      }
    } catch {
      notify.error('Failed to fetch integration logs');
    } finally {
      setLoadingLogs(false);
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'Accounting':
        return <AccountBalance sx={{ color: '#8b5cf6' }} />;
      case 'Shipping':
        return <LocalShipping sx={{ color: '#38bdf8' }} />;
      case 'Messaging':
        return <Chat sx={{ color: '#34d399' }} />;
      case 'E-commerce':
        return <Storefront sx={{ color: '#fbbf24' }} />;
      default:
        return <Code sx={{ color: '#c084fc' }} />;
    }
  };

  const filteredIntegrations = integrations.filter((item) => {
    const matchesSearch =
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.category.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesCategory =
      selectedCategory === 'ALL' || item.category.toUpperCase() === selectedCategory;

    const matchesStatus = selectedStatus === 'ALL' || item.status.toUpperCase() === selectedStatus;

    return matchesSearch && matchesCategory && matchesStatus;
  });

  const connectedCount = integrations.filter((i) => i.status === 'CONNECTED').length;
  const availableCount = integrations.filter((i) => i.status === 'AVAILABLE').length;

  if (loading) {
    return (
      <Box
        sx={{
          minHeight: '65vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <CircularProgress size={45} sx={{ color: '#8b5cf6', mb: 2 }} />
        <Typography variant="body1" sx={{ color: isDark ? '#9ca3af' : '#64748b', fontWeight: 600 }}>
          Loading enterprise integration hub...
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 2, md: 4 }, maxWidth: 1440, mx: 'auto' }}>
      {/* Header */}
      <PageHeader
        title="Enterprise Integration Hub"
        subtitle="Connect third-party accounting, shipping carriers, e-commerce storefronts, and custom microservices."
        category="Connectivity & API Platform"
        action={
          <Box sx={{ display: 'flex', gap: 1.5 }}>
            <Button
              variant="outlined"
              startIcon={<History />}
              onClick={handleOpenLogs}
              sx={{
                fontWeight: 700,
                borderRadius: '10px',
                textTransform: 'none',
                borderColor: isDark ? 'rgba(255,255,255,0.15)' : '#cbd5e1',
                color: isDark ? '#f8fafc' : '#334155',
              }}
            >
              Activity Logs
            </Button>
            <Button
              variant="contained"
              startIcon={<Sync />}
              onClick={fetchIntegrations}
              sx={{
                fontWeight: 700,
                borderRadius: '10px',
                textTransform: 'none',
                background: 'linear-gradient(135deg, #8b5cf6 0%, #3b82f6 100%)',
              }}
            >
              Refresh Hub
            </Button>
          </Box>
        }
      />

      {/* KPI Overview */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="ACTIVE CONNECTORS"
            value={connectedCount}
            subtitle="Enabled tenant integrations"
            icon={<CheckCircle sx={{ fontSize: 22 }} />}
            color="emerald"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="AVAILABLE CATALOG"
            value={availableCount}
            subtitle="Ready-to-connect providers"
            icon={<CloudQueue sx={{ fontSize: 22 }} />}
            color="violet"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="ENCRYPTED VAULT"
            value="AES-256"
            subtitle="Zero-knowledge secret storage"
            icon={<Code sx={{ fontSize: 22 }} />}
            color="sky"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="TENANT ISOLATION"
            value="100%"
            subtitle="Strict partition enforcement"
            icon={<Storefront sx={{ fontSize: 22 }} />}
            color="amber"
          />
        </Grid>
      </Grid>

      {/* Filter and Search Controls */}
      <Card className="glass-panel" sx={{ p: 2.5, borderRadius: '16px', mb: 4 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={5}>
            <TextField
              fullWidth
              size="small"
              placeholder="Search connectors by name, category, or keyword..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              InputProps={{
                startAdornment: <Search sx={{ color: '#9ca3af', mr: 1 }} />,
              }}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3.5}>
            <TextField
              select
              fullWidth
              size="small"
              label="Category Filter"
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
            >
              <MenuItem value="ALL">All Categories</MenuItem>
              <MenuItem value="ACCOUNTING">Accounting & Finance</MenuItem>
              <MenuItem value="SHIPPING">Shipping & Logistics</MenuItem>
              <MenuItem value="MESSAGING">Messaging & Alerts</MenuItem>
              <MenuItem value="E-COMMERCE">E-commerce Storefronts</MenuItem>
              <MenuItem value="CUSTOM">Custom Webhooks</MenuItem>
            </TextField>
          </Grid>
          <Grid item xs={12} sm={6} md={3.5}>
            <TextField
              select
              fullWidth
              size="small"
              label="Status Filter"
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
            >
              <MenuItem value="ALL">All Statuses</MenuItem>
              <MenuItem value="CONNECTED">Connected Only</MenuItem>
              <MenuItem value="AVAILABLE">Available to Connect</MenuItem>
              <MenuItem value="DISABLED">Disabled</MenuItem>
            </TextField>
          </Grid>
        </Grid>
      </Card>

      {/* Integration Cards Grid */}
      <Grid container spacing={3}>
        {filteredIntegrations.map((item) => {
          const isConnected = item.status === 'CONNECTED';
          return (
            <Grid item xs={12} sm={6} lg={4} key={item.provider}>
              <Card
                className={`glass-panel ${isConnected ? 'glow-card-emerald' : ''}`}
                sx={{
                  p: 3,
                  borderRadius: '20px',
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  transition: 'transform 0.2s, box-shadow 0.2s',
                  '&:hover': {
                    transform: 'translateY(-3px)',
                  },
                }}
              >
                <Box>
                  <Box
                    sx={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      mb: 2,
                    }}
                  >
                    <Box
                      sx={{
                        p: 1.5,
                        borderRadius: '14px',
                        bgcolor: isDark ? 'rgba(255,255,255,0.05)' : '#f1f5f9',
                      }}
                    >
                      {getCategoryIcon(item.category)}
                    </Box>
                    <StatusChip status={item.status} label={item.status} />
                  </Box>

                  <Typography
                    variant="h6"
                    sx={{ fontWeight: 800, mb: 0.5, color: isDark ? '#f8fafc' : '#0f172a' }}
                  >
                    {item.name}
                  </Typography>
                  <Chip
                    label={item.category}
                    size="small"
                    sx={{ fontWeight: 700, fontSize: '0.7rem', height: 22, mb: 1.5 }}
                  />
                  <Typography
                    variant="body2"
                    sx={{
                      color: isDark ? '#9ca3af' : '#64748b',
                      fontSize: '0.85rem',
                      lineHeight: 1.5,
                      mb: 2,
                      minHeight: 52,
                    }}
                  >
                    {item.description}
                  </Typography>

                  {isConnected && item.lastSyncAt && (
                    <Box
                      sx={{
                        mb: 2,
                        p: 1.5,
                        borderRadius: '10px',
                        bgcolor: isDark ? 'rgba(16, 185, 129, 0.08)' : '#ecfdf5',
                      }}
                    >
                      <Typography
                        variant="caption"
                        sx={{ color: '#10b981', fontWeight: 700, display: 'block' }}
                      >
                        ● Last synced: {new Date(item.lastSyncAt).toLocaleTimeString()}
                      </Typography>
                    </Box>
                  )}

                  {item.lastError && (
                    <Alert severity="error" sx={{ mb: 2, py: 0.5, fontSize: '0.75rem' }}>
                      {item.lastError.message}
                    </Alert>
                  )}
                </Box>

                <Box
                  sx={{
                    pt: 2,
                    borderTop: isDark ? '1px solid rgba(255,255,255,0.06)' : '1px solid #e2e8f0',
                    display: 'flex',
                    gap: 1,
                  }}
                >
                  {isConnected ? (
                    <>
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={<Settings />}
                        onClick={() => handleOpenConfigure(item)}
                        sx={{
                          flex: 1,
                          borderRadius: '10px',
                          fontWeight: 700,
                          textTransform: 'none',
                        }}
                      >
                        Config
                      </Button>
                      <Button
                        size="small"
                        variant="contained"
                        startIcon={
                          syncingProvider === item.provider ? (
                            <CircularProgress size={14} color="inherit" />
                          ) : (
                            <Sync />
                          )
                        }
                        disabled={syncingProvider === item.provider}
                        onClick={() => handleTriggerSync(item.provider)}
                        sx={{
                          flex: 1,
                          borderRadius: '10px',
                          fontWeight: 700,
                          textTransform: 'none',
                          background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                        }}
                      >
                        Sync Now
                      </Button>
                      <Tooltip title="Disconnect Integration">
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => handleDisconnect(item.provider)}
                          sx={{ borderRadius: '10px' }}
                        >
                          <PowerSettingsNew fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </>
                  ) : (
                    <Button
                      fullWidth
                      variant="contained"
                      onClick={() => handleOpenConfigure(item)}
                      sx={{
                        py: 1.1,
                        borderRadius: '10px',
                        fontWeight: 800,
                        textTransform: 'none',
                        background: 'linear-gradient(135deg, #8b5cf6 0%, #3b82f6 100%)',
                      }}
                    >
                      Connect & Configure
                    </Button>
                  )}
                </Box>
              </Card>
            </Grid>
          );
        })}
      </Grid>

      {/* Configuration & Connect Dialog */}
      <Dialog
        open={configModalOpen}
        onClose={() => setConfigModalOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: '20px',
            bgcolor: isDark ? '#0b0f19' : '#ffffff',
            border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid #e2e8f0',
          },
        }}
      >
        <DialogTitle
          component="div"
          sx={{
            p: 3,
            background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)',
            color: '#ffffff',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 900, color: '#ffffff' }}>
              Configure {selectedItem?.name}
            </Typography>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)' }}>
              Encrypted credentials & runtime sync settings
            </Typography>
          </Box>
          <IconButton onClick={() => setConfigModalOpen(false)} sx={{ color: '#ffffff' }}>
            <Close />
          </IconButton>
        </DialogTitle>

        <DialogContent sx={{ p: 3.5 }}>
          {selectedItem && (
            <Box sx={{ mt: 1 }}>
              <Typography
                variant="caption"
                sx={{
                  color: isDark ? '#9ca3af' : '#64748b',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  display: 'block',
                  mb: 2,
                }}
              >
                Provider Configuration
              </Typography>

              {selectedItem.requiredConfigFields.map((field) => (
                <Box key={field.name} sx={{ mb: 2.5 }}>
                  {field.type === 'select' ? (
                    <TextField
                      select
                      fullWidth
                      label={field.label}
                      value={formConfig[field.name] || field.options?.[0] || ''}
                      onChange={(e) =>
                        setFormConfig({ ...formConfig, [field.name]: e.target.value })
                      }
                      helperText={field.helperText}
                    >
                      {field.options?.map((opt) => (
                        <MenuItem key={opt} value={opt}>
                          {opt}
                        </MenuItem>
                      ))}
                    </TextField>
                  ) : (
                    <TextField
                      fullWidth
                      type={field.type === 'password' ? 'password' : 'text'}
                      label={field.label}
                      value={formConfig[field.name] || ''}
                      onChange={(e) =>
                        setFormConfig({ ...formConfig, [field.name]: e.target.value })
                      }
                      helperText={field.helperText}
                    />
                  )}
                </Box>
              ))}

              <Divider sx={{ my: 2.5 }} />

              <Typography
                variant="caption"
                sx={{
                  color: isDark ? '#9ca3af' : '#64748b',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  display: 'block',
                  mb: 1.5,
                }}
              >
                Encrypted Credentials & Secret Key
              </Typography>

              <TextField
                fullWidth
                type="password"
                label={
                  selectedItem.hasCredentials
                    ? 'Update Secret / Token (Leave blank to keep existing)'
                    : 'Secret API Key / OAuth Access Token'
                }
                placeholder={
                  selectedItem.hasCredentials ? '••••••••••••••••••••' : 'Paste secret key...'
                }
                value={formCredentials}
                onChange={(e) => setFormCredentials(e.target.value)}
                helperText="Credentials are encrypted with AES-256-GCM at rest and never returned over the network."
              />
            </Box>
          )}
        </DialogContent>

        <DialogActions sx={{ p: 3, pt: 0, justifyContent: 'space-between' }}>
          <Button
            variant="outlined"
            onClick={handleTestConnection}
            disabled={testingConnection}
            sx={{ fontWeight: 700, borderRadius: '10px', textTransform: 'none' }}
          >
            {testingConnection ? 'Validating...' : 'Test Connection'}
          </Button>

          <Box sx={{ display: 'flex', gap: 1.5 }}>
            <Button
              onClick={() => setConfigModalOpen(false)}
              sx={{ color: isDark ? '#9ca3af' : '#64748b' }}
            >
              Cancel
            </Button>
            <Button
              variant="contained"
              onClick={handleSaveConfiguration}
              disabled={savingConfig}
              sx={{
                fontWeight: 800,
                borderRadius: '10px',
                px: 3,
                textTransform: 'none',
                background: 'linear-gradient(135deg, #8b5cf6 0%, #3b82f6 100%)',
              }}
            >
              {savingConfig ? 'Saving...' : 'Save & Enable'}
            </Button>
          </Box>
        </DialogActions>
      </Dialog>

      {/* Activity Logs Dialog */}
      <Dialog
        open={logsModalOpen}
        onClose={() => setLogsModalOpen(false)}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: '20px',
            bgcolor: isDark ? '#0b0f19' : '#ffffff',
          },
        }}
      >
        <DialogTitle
          component="div"
          sx={{ p: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
        >
          <Typography variant="h6" sx={{ fontWeight: 900 }}>
            Integration Activity & Audit Logs
          </Typography>
          <IconButton onClick={() => setLogsModalOpen(false)}>
            <Close />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ p: 3 }}>
          {loadingLogs ? (
            <CircularProgress size={30} sx={{ display: 'block', mx: 'auto', my: 4 }} />
          ) : auditLogs.length === 0 ? (
            <Typography variant="body2" sx={{ color: '#9ca3af', textAlign: 'center', my: 4 }}>
              No integration audit activity recorded yet.
            </Typography>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              {auditLogs.map((log) => (
                <Card
                  key={log._id}
                  sx={{
                    p: 2,
                    borderRadius: '12px',
                    bgcolor: isDark ? 'rgba(30, 41, 59, 0.4)' : '#f8fafc',
                  }}
                >
                  <Box
                    sx={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      mb: 0.5,
                    }}
                  >
                    <Chip
                      label={log.action}
                      size="small"
                      color="primary"
                      sx={{ fontWeight: 800, fontSize: '0.7rem' }}
                    />
                    <Typography variant="caption" sx={{ color: '#9ca3af' }}>
                      {new Date(log.createdAt).toLocaleString()}
                    </Typography>
                  </Box>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    Provider: <strong>{log.provider?.toUpperCase() || 'GENERAL'}</strong> —
                    Performed by: {log.performedBy}
                  </Typography>
                  {log.details && (
                    <Typography
                      variant="caption"
                      sx={{ color: '#9ca3af', fontFamily: 'monospace', display: 'block', mt: 0.5 }}
                    >
                      {JSON.stringify(log.details)}
                    </Typography>
                  )}
                </Card>
              ))}
            </Box>
          )}
        </DialogContent>
      </Dialog>
    </Box>
  );
};

export default IntegrationHub;
