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
  FormControlLabel,
  Checkbox,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  IconButton,
  Tooltip,
  Tabs,
  Tab,
  useTheme,
} from '@mui/material';
import Add from '@mui/icons-material/Add';
import Delete from '@mui/icons-material/Delete';
import Replay from '@mui/icons-material/Replay';
import Visibility from '@mui/icons-material/Visibility';
import Close from '@mui/icons-material/Close';
import ContentCopy from '@mui/icons-material/ContentCopy';
import { toast } from 'react-hot-toast';
import { apiClient } from '../../api/client.ts';
import { notify } from '../../utils/notify.ts';
import { useConfirm } from '../../context/ConfirmDialogContext.tsx';
import PageHeader from '../../components/PageHeader.tsx';
import StatusChip from '../../components/StatusChip.tsx';

interface WebhookSubscriptionItem {
  _id: string;
  name: string;
  events: string[];
  endpointUrl: string;
  secretPrefix: string;
  status: 'ACTIVE' | 'PAUSED' | 'FAILED' | 'DISABLED';
  consecutiveFailures: number;
  lastDeliveredAt?: string;
  lastDeliveryStatus?: 'SUCCESS' | 'FAILED';
  createdAt: string;
}

interface WebhookLogItem {
  _id: string;
  eventId: string;
  event: string;
  endpointUrl: string;
  attempt: number;
  statusCode?: number;
  durationMs: number;
  success: boolean;
  errorCategory?: string;
  errorMessage?: string;
  payloadSnippet: string;
  responseSnippet?: string;
  signature: string;
  deliveredAt: string;
  webhookId?: { name: string; endpointUrl: string };
}

const SUPPORTED_EVENTS = [
  'product.created',
  'product.updated',
  'inventory.updated',
  'inventory.low_stock',
  'order.created',
  'order.completed',
  'customer.created',
  'payment.completed',
  'invoice.issued',
  'import.completed',
];

export const WebhookManager: React.FC = () => {
  const theme = useTheme();
  const confirm = useConfirm();
  const [activeTab, setActiveTab] = useState<'SUBSCRIPTIONS' | 'LOGS'>('SUBSCRIPTIONS');
  const [subscriptions, setSubscriptions] = useState<WebhookSubscriptionItem[]>([]);
  const [logs, setLogs] = useState<WebhookLogItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Create Modal
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [endpointUrl, setEndpointUrl] = useState('');
  const [selectedEvents, setSelectedEvents] = useState<string[]>([
    'product.created',
    'inventory.low_stock',
    'order.created',
  ]);
  const [creating, setCreating] = useState(false);

  // Secret Dialog
  const [secretModalOpen, setSecretModalOpen] = useState(false);
  const [revealedSecret, setRevealedSecret] = useState('');

  // Inspector Dialog
  const [selectedLog, setSelectedLog] = useState<WebhookLogItem | null>(null);
  const [inspectorOpen, setInspectorOpen] = useState(false);

  const isDark = theme.palette.mode === 'dark';

  useEffect(() => {
    fetchSubscriptions();
    fetchLogs();
  }, []);

  const fetchSubscriptions = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get('/integrations/webhooks');
      if (res.data?.success) {
        setSubscriptions(res.data.data);
      }
    } catch (err: any) {
      if (err.response?.status !== 401) {
        toast.error('Failed to load webhook subscriptions');
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchLogs = async () => {
    try {
      const res = await apiClient.get('/integrations/webhooks/logs');
      if (res.data?.success) {
        setLogs(res.data.data);
      }
    } catch {
      // ignore
    }
  };

  const handleCreate = async () => {
    if (!name.trim() || !endpointUrl.trim()) {
      toast.error('Name and Endpoint URL are required');
      return;
    }
    if (selectedEvents.length === 0) {
      toast.error('Select at least one event type');
      return;
    }

    try {
      setCreating(true);
      const res = await apiClient.post('/integrations/webhooks', {
        name,
        endpointUrl,
        events: selectedEvents,
      });

      if (res.data?.success) {
        notify.success('Webhook subscription created!');
        setSecretModalOpen(true);
        setRevealedSecret(res.data.data.secret);
        setCreateModalOpen(false);
        fetchSubscriptions();
      }
    } catch (err: any) {
      notify.error(err, { fallback: 'Failed to create webhook' });
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    const confirmed = await confirm({
      title: 'Remove Webhook Subscription',
      message:
        'Are you sure you want to remove this webhook subscription? Stockora will stop dispatching event payloads to this endpoint URL immediately.',
      confirmText: 'Remove Webhook',
      severity: 'error',
    });
    if (!confirmed) return;

    try {
      const res = await apiClient.delete(`/integrations/webhooks/${id}`);
      if (res.data?.success) {
        notify.success('Webhook subscription deleted.');
        fetchSubscriptions();
      }
    } catch (err) {
      notify.error(err, { fallback: 'Failed to delete webhook' });
    }
  };

  const handleReplay = async (logId: string) => {
    try {
      const res = await apiClient.post(`/integrations/webhooks/logs/${logId}/replay`);
      if (res.data?.success) {
        notify.success('Delivery replayed successfully!');
        fetchLogs();
      }
    } catch (err: any) {
      notify.error(err, { fallback: 'Replay failed' });
    }
  };

  const tableHeaderSx = {
    bgcolor: isDark ? 'rgba(30, 41, 59, 0.85)' : '#f1f5f9',
    color: isDark ? '#f8fafc' : '#0f172a',
    fontWeight: 800,
    fontSize: '0.8rem',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    py: 1.8,
    px: 2,
    borderBottom: isDark ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid #cbd5e1',
  };

  const tableCellSx = {
    color: isDark ? '#e2e8f0' : '#1e293b',
    fontWeight: 600,
    fontSize: '0.875rem',
    py: 1.6,
    px: 2,
    borderBottom: isDark ? '1px solid rgba(255, 255, 255, 0.04)' : '1px solid #f1f5f9',
  };

  return (
    <Box sx={{ p: { xs: 2, md: 4 }, maxWidth: 1440, mx: 'auto' }}>
      {/* Header */}
      <PageHeader
        title="Webhooks & Event Stream"
        subtitle="Configure real-time event dispatches, HMAC signature verification, and delivery replay."
        category="Developer Platform"
        action={
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={() => {
              setName('');
              setEndpointUrl('');
              setCreateModalOpen(true);
            }}
            sx={{
              fontWeight: 700,
              borderRadius: '10px',
              textTransform: 'none',
              background: 'linear-gradient(135deg, #8b5cf6 0%, #3b82f6 100%)',
            }}
          >
            Add Endpoint
          </Button>
        }
      />

      {/* Tabs */}
      <Box
        sx={{ borderBottom: 1, borderColor: isDark ? 'rgba(255,255,255,0.08)' : '#e2e8f0', mb: 3 }}
      >
        <Tabs value={activeTab} onChange={(_e, v) => setActiveTab(v)}>
          <Tab
            label={`Active Subscriptions (${subscriptions.length})`}
            value="SUBSCRIPTIONS"
            sx={{ fontWeight: 800 }}
          />
          <Tab label={`Delivery Logs (${logs.length})`} value="LOGS" sx={{ fontWeight: 800 }} />
        </Tabs>
      </Box>

      {/* Subscriptions Tab */}
      {activeTab === 'SUBSCRIPTIONS' && (
        <Card className="glass-panel" sx={{ borderRadius: '20px', overflow: 'hidden' }}>
          {loading ? (
            <CircularProgress size={35} sx={{ display: 'block', mx: 'auto', my: 4 }} />
          ) : subscriptions.length === 0 ? (
            <Box sx={{ p: 4, textAlign: 'center' }}>
              <Typography variant="body1" sx={{ color: isDark ? '#9ca3af' : '#64748b', mb: 2 }}>
                No active webhook endpoints configured yet.
              </Typography>
              <Button
                variant="outlined"
                startIcon={<Add />}
                onClick={() => setCreateModalOpen(true)}
                sx={{ fontWeight: 700, borderRadius: '10px' }}
              >
                Create Webhook Endpoint
              </Button>
            </Box>
          ) : (
            <Box sx={{ overflowX: 'auto' }}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell sx={tableHeaderSx}>Endpoint Name</TableCell>
                    <TableCell sx={tableHeaderSx}>Destination URL</TableCell>
                    <TableCell sx={tableHeaderSx}>Subscribed Events</TableCell>
                    <TableCell sx={tableHeaderSx}>Secret Prefix</TableCell>
                    <TableCell sx={tableHeaderSx}>Status</TableCell>
                    <TableCell sx={{ ...tableHeaderSx, textAlign: 'right' }}>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {subscriptions.map((sub) => (
                    <TableRow key={sub._id} hover>
                      <TableCell sx={{ ...tableCellSx, fontWeight: 800 }}>{sub.name}</TableCell>
                      <TableCell sx={{ ...tableCellSx, fontFamily: 'monospace', color: '#8b5cf6' }}>
                        {sub.endpointUrl}
                      </TableCell>
                      <TableCell sx={tableCellSx}>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                          {sub.events.map((e) => (
                            <Chip
                              key={e}
                              label={e}
                              size="small"
                              sx={{ fontSize: '0.65rem', height: 20 }}
                            />
                          ))}
                        </Box>
                      </TableCell>
                      <TableCell
                        sx={{ ...tableCellSx, fontFamily: 'monospace', fontSize: '0.8rem' }}
                      >
                        {sub.secretPrefix}
                      </TableCell>
                      <TableCell sx={tableCellSx}>
                        <StatusChip status={sub.status} label={sub.status} />
                      </TableCell>
                      <TableCell sx={{ ...tableCellSx, textAlign: 'right' }}>
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => handleDelete(sub._id)}
                        >
                          <Delete fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Box>
          )}
        </Card>
      )}

      {/* Logs Tab */}
      {activeTab === 'LOGS' && (
        <Card className="glass-panel" sx={{ borderRadius: '20px', overflow: 'hidden' }}>
          {logs.length === 0 ? (
            <Box sx={{ p: 4, textAlign: 'center' }}>
              <Typography variant="body1" sx={{ color: isDark ? '#9ca3af' : '#64748b' }}>
                No recent webhook deliveries recorded.
              </Typography>
            </Box>
          ) : (
            <Box sx={{ overflowX: 'auto' }}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell sx={tableHeaderSx}>Event</TableCell>
                    <TableCell sx={tableHeaderSx}>Status Code</TableCell>
                    <TableCell sx={tableHeaderSx}>Duration</TableCell>
                    <TableCell sx={tableHeaderSx}>Event ID</TableCell>
                    <TableCell sx={tableHeaderSx}>Timestamp</TableCell>
                    <TableCell sx={{ ...tableHeaderSx, textAlign: 'right' }}>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {logs.map((log) => (
                    <TableRow key={log._id} hover>
                      <TableCell sx={{ ...tableCellSx, fontWeight: 800 }}>{log.event}</TableCell>
                      <TableCell sx={tableCellSx}>
                        <Chip
                          label={log.statusCode ? `${log.statusCode}` : 'Failed'}
                          size="small"
                          color={log.success ? 'success' : 'error'}
                          sx={{ fontWeight: 800, height: 22 }}
                        />
                      </TableCell>
                      <TableCell
                        sx={{ ...tableCellSx, fontFamily: 'monospace', fontSize: '0.8rem' }}
                      >
                        {log.durationMs}ms
                      </TableCell>
                      <TableCell
                        sx={{
                          ...tableCellSx,
                          fontFamily: 'monospace',
                          color: '#8b5cf6',
                          fontSize: '0.8rem',
                        }}
                      >
                        {log.eventId}
                      </TableCell>
                      <TableCell
                        sx={{
                          ...tableCellSx,
                          color: isDark ? '#9ca3af' : '#64748b',
                          fontSize: '0.8rem',
                        }}
                      >
                        {new Date(log.deliveredAt).toLocaleTimeString()}
                      </TableCell>
                      <TableCell sx={{ ...tableCellSx, textAlign: 'right' }}>
                        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 0.5 }}>
                          <Tooltip title="Inspect Payload">
                            <IconButton
                              size="small"
                              onClick={() => {
                                setSelectedLog(log);
                                setInspectorOpen(true);
                              }}
                            >
                              <Visibility fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Replay Delivery">
                            <IconButton
                              size="small"
                              color="primary"
                              onClick={() => handleReplay(log._id)}
                            >
                              <Replay fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Box>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Box>
          )}
        </Card>
      )}

      {/* Create Dialog */}
      <Dialog
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        maxWidth="sm"
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
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 900 }}>
              Register Webhook Endpoint
            </Typography>
            <Typography variant="caption" sx={{ color: isDark ? '#9ca3af' : '#64748b' }}>
              Stockora will dispatch cryptographically signed HTTPS payloads
            </Typography>
          </Box>
          <IconButton onClick={() => setCreateModalOpen(false)}>
            <Close />
          </IconButton>
        </DialogTitle>

        <DialogContent sx={{ p: 3 }}>
          <TextField
            fullWidth
            label="Endpoint Name"
            placeholder="e.g. Order Processing Hook"
            value={name}
            onChange={(e) => setName(e.target.value)}
            sx={{ mb: 2.5 }}
          />

          <TextField
            fullWidth
            label="Destination HTTPS URL"
            placeholder="https://api.yourdomain.com/v1/webhooks"
            value={endpointUrl}
            onChange={(e) => setEndpointUrl(e.target.value)}
            sx={{ mb: 2.5 }}
          />

          <Typography
            variant="subtitle2"
            sx={{ fontWeight: 800, mb: 1, textTransform: 'uppercase', color: '#8b5cf6' }}
          >
            Event Triggers
          </Typography>

          <Grid container spacing={1}>
            {SUPPORTED_EVENTS.map((event) => (
              <Grid item xs={12} sm={6} key={event}>
                <FormControlLabel
                  control={
                    <Checkbox
                      size="small"
                      checked={selectedEvents.includes(event)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedEvents([...selectedEvents, event]);
                        } else {
                          setSelectedEvents(selectedEvents.filter((ev) => ev !== event));
                        }
                      }}
                    />
                  }
                  label={
                    <Typography variant="caption" sx={{ fontWeight: 600 }}>
                      {event}
                    </Typography>
                  }
                />
              </Grid>
            ))}
          </Grid>
        </DialogContent>

        <DialogActions sx={{ p: 3, pt: 0 }}>
          <Button onClick={() => setCreateModalOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleCreate}
            disabled={creating}
            sx={{
              fontWeight: 800,
              borderRadius: '10px',
              px: 3,
              background: 'linear-gradient(135deg, #8b5cf6 0%, #3b82f6 100%)',
            }}
          >
            {creating ? 'Registering...' : 'Register Endpoint'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Secret Dialog */}
      <Dialog
        open={secretModalOpen}
        onClose={() => setSecretModalOpen(false)}
        maxWidth="sm"
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
          sx={{
            p: 3,
            background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)',
            color: '#ffffff',
          }}
        >
          <Typography variant="h6" sx={{ fontWeight: 900 }}>
            Webhook Signing Secret
          </Typography>
          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)' }}>
            Use this secret to verify X-Stockora-Signature headers.
          </Typography>
        </DialogTitle>

        <DialogContent sx={{ p: 3.5 }}>
          <Card
            sx={{
              p: 2,
              bgcolor: isDark ? 'rgba(30, 41, 59, 0.6)' : '#f8fafc',
              borderRadius: '10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <Typography
              variant="body2"
              sx={{
                fontFamily: 'monospace',
                fontWeight: 800,
                wordBreak: 'break-all',
                color: '#8b5cf6',
              }}
            >
              {revealedSecret}
            </Typography>
            <IconButton
              onClick={() => {
                navigator.clipboard.writeText(revealedSecret);
                toast.success('Copied!');
              }}
              color="primary"
            >
              <ContentCopy />
            </IconButton>
          </Card>
        </DialogContent>

        <DialogActions sx={{ p: 3, pt: 0 }}>
          <Button
            variant="contained"
            onClick={() => setSecretModalOpen(false)}
            sx={{ fontWeight: 800, borderRadius: '10px' }}
          >
            Done
          </Button>
        </DialogActions>
      </Dialog>

      {/* Inspector Dialog */}
      <Dialog
        open={inspectorOpen}
        onClose={() => setInspectorOpen(false)}
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
          sx={{ p: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
        >
          <Typography variant="h6" sx={{ fontWeight: 900 }}>
            Webhook Payload Inspector
          </Typography>
          <IconButton onClick={() => setInspectorOpen(false)}>
            <Close />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ p: 3 }}>
          {selectedLog && (
            <Box>
              <Typography
                variant="caption"
                sx={{ fontWeight: 800, color: '#8b5cf6', textTransform: 'uppercase' }}
              >
                Event Payload Snippet
              </Typography>
              <Card
                sx={{
                  p: 2,
                  my: 1,
                  bgcolor: isDark ? 'rgba(30, 41, 59, 0.4)' : '#f8fafc',
                  borderRadius: '10px',
                }}
              >
                <pre
                  style={{
                    margin: 0,
                    fontSize: '0.8rem',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-all',
                  }}
                >
                  {selectedLog.payloadSnippet}
                </pre>
              </Card>

              {selectedLog.responseSnippet && (
                <>
                  <Typography
                    variant="caption"
                    sx={{
                      fontWeight: 800,
                      color: '#38bdf8',
                      textTransform: 'uppercase',
                      mt: 2,
                      display: 'block',
                    }}
                  >
                    Destination Response
                  </Typography>
                  <Card
                    sx={{
                      p: 2,
                      my: 1,
                      bgcolor: isDark ? 'rgba(30, 41, 59, 0.4)' : '#f8fafc',
                      borderRadius: '10px',
                    }}
                  >
                    <pre
                      style={{
                        margin: 0,
                        fontSize: '0.8rem',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-all',
                      }}
                    >
                      {selectedLog.responseSnippet}
                    </pre>
                  </Card>
                </>
              )}
            </Box>
          )}
        </DialogContent>
      </Dialog>
    </Box>
  );
};

export default WebhookManager;
