import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../api/client.ts';
import { toast } from 'react-hot-toast';
import {
  Box,
  Typography,
  Button,
  Paper,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  Grid,
  Chip,
  List,
  ListItem,
  ListItemText,
  Divider,
  Tabs,
  Tab,
  IconButton,
  Tooltip,
  Badge,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  FormControlLabel,
  Switch,
} from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';
import DoneAllIcon from '@mui/icons-material/DoneAll';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import CodeIcon from '@mui/icons-material/Code';
import ScheduleSendIcon from '@mui/icons-material/ScheduleSend';
import { notify } from '../../utils/notify.ts';
import { useConfirm } from '../../context/ConfirmDialogContext.tsx';
import { socket } from '../../socket.ts';

// ---- Types ------------------------------------------------------------------

interface NotificationItem {
  _id: string;
  type: 'INFO' | 'WARNING' | 'SECURITY' | 'SYSTEM' | 'PROMO' | 'TASK';
  title: string;
  body: string;
  status: 'UNREAD' | 'READ';
  channels: string[];
  targetRole?: string;
  scheduledAt?: string;
  createdAt: string;
}

interface NotificationTemplate {
  _id: string;
  key: string;
  name: string;
  type: string;
  channels: string[];
  titleTemplate: string;
  bodyTemplate: string;
  isActive: boolean;
  createdAt: string;
}

// ---- Constants --------------------------------------------------------------

const TYPE_COLORS: Record<
  string,
  'default' | 'success' | 'warning' | 'error' | 'info' | 'primary' | 'secondary'
> = {
  INFO: 'info',
  WARNING: 'warning',
  SECURITY: 'error',
  SYSTEM: 'default',
  PROMO: 'secondary',
  TASK: 'primary',
};

const textFieldStyle = { mt: 1 };

// ---- Component --------------------------------------------------------------

export default function CommunicationCenter() {
  const confirm = useConfirm();
  const [activeTab, setActiveTab] = useState(0);
  const [unreadOnly, setUnreadOnly] = useState(false);

  // Broadcast dialog
  const [openBroadcastDialog, setOpenBroadcastDialog] = useState(false);
  const [bType, setBType] = useState<NotificationItem['type']>('INFO');
  const [bTitle, setBTitle] = useState('');
  const [bBody, setBBody] = useState('');
  const [bChannels, setBChannels] = useState<string[]>(['IN_APP']);
  const [bTargetRole, setBTargetRole] = useState('');
  const [bScheduledAt, setBScheduledAt] = useState('');
  const [bUseSchedule, setBUseSchedule] = useState(false);

  // Template dialog
  const [openTemplateDialog, setOpenTemplateDialog] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<NotificationTemplate | null>(null);
  const [tKey, setTKey] = useState('');
  const [tName, setTName] = useState('');
  const [tType, setTType] = useState('INFO');
  const [tTitleTemplate, setTTitleTemplate] = useState('');
  const [tBodyTemplate, setTBodyTemplate] = useState('');

  const queryClient = useQueryClient();

  // --- Queries ---------------------------------------------------------------

  const { data: notifications = [] } = useQuery<NotificationItem[]>({
    queryKey: ['notifications', unreadOnly],
    queryFn: async () =>
      (
        await apiClient.get('/notifications', {
          params: { unreadOnly: unreadOnly ? 'true' : 'false' },
        })
      ).data,
  });

  const { data: templates = [] } = useQuery<NotificationTemplate[]>({
    queryKey: ['notification-templates'],
    queryFn: async () => (await apiClient.get('/notifications/templates')).data,
  });

  const unreadCount = notifications.filter((n) => n.status === 'UNREAD').length;

  // Real-time WebSocket push
  useEffect(() => {
    const handler = (newNotif: NotificationItem) => {
      toast(`🔔 ${newNotif.title}`, {
        style: {
          borderRadius: '10px',
          background: '#111827',
          color: '#fff',
          border: '1px solid rgba(139, 92, 246, 0.3)',
        },
        duration: 5000,
      });
      queryClient.setQueryData<NotificationItem[]>(['notifications', false], (old) =>
        old ? [newNotif, ...old] : [newNotif]
      );
      queryClient.setQueryData<NotificationItem[]>(['notifications', true], (old) =>
        old ? [newNotif, ...old] : [newNotif]
      );
    };
    socket.on('notification:received', handler);
    return () => {
      socket.off('notification:received', handler);
    };
  }, [queryClient]);

  // --- Mutations -------------------------------------------------------------

  const readMutation = useMutation({
    mutationFn: async (id: string) => (await apiClient.patch(`/notifications/${id}/read`)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const markAllReadMutation = useMutation({
    mutationFn: async () => (await apiClient.patch('/notifications/mark-all-read')).data,
    onSuccess: (data: { markedRead: number }) => {
      notify.success(`Marked ${data.markedRead} notifications as read.`);
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => (await apiClient.delete(`/notifications/${id}`)).data,
    onSuccess: () => {
      notify.success('Notification removed.');
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const broadcastMutation = useMutation({
    mutationFn: async (payload: Record<string, unknown>) =>
      (await apiClient.post('/notifications/broadcast', payload)).data,
    onSuccess: () => {
      notify.success(
        bUseSchedule ? 'Notification scheduled.' : 'Broadcast dispatched to all targets.'
      );
      setOpenBroadcastDialog(false);
      resetBroadcastForm();
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
    onError: (err: any) => {
      notify.error(err, { fallback: 'Broadcast failed.' });
    },
  });

  const templateMutation = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      if (editingTemplate) {
        return (await apiClient.put(`/notifications/templates/${editingTemplate._id}`, payload))
          .data;
      }
      return (await apiClient.post('/notifications/templates', payload)).data;
    },
    onSuccess: () => {
      toast.success(editingTemplate ? 'Template updated.' : 'Template created.');
      queryClient.invalidateQueries({ queryKey: ['notification-templates'] });
      setOpenTemplateDialog(false);
      resetTemplateForm();
    },
    onError: (err: { response?: { data?: { error?: { message?: string } } } }) =>
      toast.error(err.response?.data?.error?.message || 'Template save failed.'),
  });

  const deleteTemplateMutation = useMutation({
    mutationFn: async (id: string) =>
      (await apiClient.delete(`/notifications/templates/${id}`)).data,
    onSuccess: () => {
      toast.success('Template deleted.');
      queryClient.invalidateQueries({ queryKey: ['notification-templates'] });
    },
  });

  // --- Handlers --------------------------------------------------------------

  const resetBroadcastForm = () => {
    setBTitle('');
    setBBody('');
    setBType('INFO');
    setBChannels(['IN_APP']);
    setBTargetRole('');
    setBScheduledAt('');
    setBUseSchedule(false);
  };

  const resetTemplateForm = () => {
    setEditingTemplate(null);
    setTKey('');
    setTName('');
    setTType('INFO');
    setTTitleTemplate('');
    setTBodyTemplate('');
  };

  const handleBroadcast = () => {
    broadcastMutation.mutate({
      type: bType,
      title: bTitle,
      body: bBody,
      channels: bChannels,
      targetRole: bTargetRole || undefined,
      scheduledAt: bUseSchedule && bScheduledAt ? bScheduledAt : undefined,
    });
  };

  const handleSaveTemplate = () => {
    templateMutation.mutate({
      key: tKey,
      name: tName,
      type: tType,
      titleTemplate: tTitleTemplate,
      bodyTemplate: tBodyTemplate,
    });
  };

  const openEditTemplate = (t: NotificationTemplate) => {
    setEditingTemplate(t);
    setTKey(t.key);
    setTName(t.name);
    setTType(t.type);
    setTTitleTemplate(t.titleTemplate);
    setTBodyTemplate(t.bodyTemplate);
    setOpenTemplateDialog(true);
  };

  // ---- Render ---------------------------------------------------------------

  return (
    <Box sx={{ width: '100%' }}>
      {/* Header */}
      <Box
        sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}
      >
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800 }}>
            Communication Center
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Real-time alerts, scheduled broadcasts, multi-channel notifications, and message
            templates.
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            variant="outlined"
            startIcon={<AddIcon />}
            onClick={() => {
              resetTemplateForm();
              setOpenTemplateDialog(true);
            }}
          >
            New Template
          </Button>
          <Button
            variant="contained"
            startIcon={<SendIcon />}
            onClick={() => setOpenBroadcastDialog(true)}
            sx={{ background: 'linear-gradient(90deg, #8b5cf6 0%, #7c3aed 100%)' }}
          >
            Broadcast Alert
          </Button>
        </Box>
      </Box>

      <Tabs value={activeTab} onChange={(_, idx) => setActiveTab(idx)} sx={{ mb: 3 }}>
        <Tab
          label={
            <Badge badgeContent={unreadCount} color="error" max={99}>
              <Box sx={{ pr: 1 }}>Notification Feed</Box>
            </Badge>
          }
        />
        <Tab label="Message Templates" />
      </Tabs>

      {/* ---- Tab 0: Notification Feed ---- */}
      {activeTab === 0 && (
        <Paper className="glass-panel" sx={{ p: 3 }}>
          <Box
            sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}
          >
            <Typography
              variant="h6"
              sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}
            >
              <NotificationsActiveIcon color="primary" /> Live System Feed
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
              <FormControlLabel
                control={
                  <Switch
                    size="small"
                    checked={unreadOnly}
                    onChange={(e) => setUnreadOnly(e.target.checked)}
                  />
                }
                label="Unread only"
              />
              <Tooltip title="Mark all as read">
                <span>
                  <IconButton
                    color="primary"
                    size="small"
                    onClick={() => markAllReadMutation.mutate()}
                    disabled={unreadCount === 0}
                  >
                    <DoneAllIcon />
                  </IconButton>
                </span>
              </Tooltip>
            </Box>
          </Box>

          {notifications.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              {unreadOnly ? 'No unread notifications.' : 'No system notifications logged.'}
            </Typography>
          ) : (
            <List sx={{ p: 0 }}>
              {notifications.map((n, idx) => (
                <Box key={n._id}>
                  {idx > 0 && <Divider sx={{ opacity: 0.1, my: 0.5 }} />}
                  <ListItem
                    sx={{
                      px: 1.5,
                      borderRadius: 1,
                      bgcolor: n.status === 'UNREAD' ? 'rgba(139,92,246,0.05)' : 'transparent',
                      borderLeft:
                        n.status === 'UNREAD' ? '3px solid #8b5cf6' : '3px solid transparent',
                    }}
                    secondaryAction={
                      <Box sx={{ display: 'flex', gap: 0.5 }}>
                        {n.status === 'UNREAD' && (
                          <Tooltip title="Mark as read">
                            <IconButton size="small" onClick={() => readMutation.mutate(n._id)}>
                              <DoneAllIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                        <Tooltip title="Delete">
                          <IconButton
                            size="small"
                            color="error"
                            onClick={async () => {
                              const confirmed = await confirm({
                                title: 'Delete Notification',
                                message: `Are you sure you want to remove notification "${n.title}"?`,
                                confirmText: 'Delete',
                                severity: 'error',
                              });
                              if (confirmed) {
                                deleteMutation.mutate(n._id);
                              }
                            }}
                          >
                            <DeleteOutlineIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    }
                  >
                    <ListItemText
                      primary={
                        <Box
                          sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}
                        >
                          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                            {n.title}
                          </Typography>
                          <Chip label={n.type} color={TYPE_COLORS[n.type]} size="small" />
                          {n.targetRole && (
                            <Chip label={`→ ${n.targetRole}`} size="small" variant="outlined" />
                          )}
                          {n.channels.map((c) => (
                            <Chip key={c} label={c} size="small" sx={{ fontSize: '0.65rem' }} />
                          ))}
                          {n.scheduledAt && (
                            <Chip
                              label={`Scheduled: ${new Date(n.scheduledAt).toLocaleString()}`}
                              size="small"
                              color="info"
                              icon={<ScheduleSendIcon />}
                            />
                          )}
                        </Box>
                      }
                      secondary={
                        <Box sx={{ mt: 0.5 }}>
                          <Typography variant="body2" color="text.secondary">
                            {n.body}
                          </Typography>
                          <Typography
                            variant="caption"
                            color="text.disabled"
                            display="block"
                            sx={{ mt: 0.5 }}
                          >
                            {new Date(n.createdAt).toLocaleString()}
                          </Typography>
                        </Box>
                      }
                    />
                  </ListItem>
                </Box>
              ))}
            </List>
          )}
        </Paper>
      )}

      {/* ---- Tab 1: Message Templates ---- */}
      {activeTab === 1 && (
        <TableContainer component={Paper} className="glass-panel">
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Key</TableCell>
                <TableCell>Name</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Channels</TableCell>
                <TableCell>Title Template</TableCell>
                <TableCell>Body Template</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {templates.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} align="center">
                    No templates yet. Click "New Template" to create one.
                  </TableCell>
                </TableRow>
              ) : (
                templates.map((t) => (
                  <TableRow key={t._id}>
                    <TableCell
                      sx={{ fontWeight: 700, fontFamily: 'monospace', color: 'secondary.light' }}
                    >
                      {t.key}
                    </TableCell>
                    <TableCell>{t.name}</TableCell>
                    <TableCell>
                      <Chip label={t.type} color={TYPE_COLORS[t.type]} size="small" />
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                        {t.channels.map((c) => (
                          <Chip key={c} label={c} size="small" sx={{ fontSize: '0.65rem' }} />
                        ))}
                      </Box>
                    </TableCell>
                    <TableCell sx={{ fontSize: '0.78rem', color: 'text.secondary', maxWidth: 200 }}>
                      {t.titleTemplate}
                    </TableCell>
                    <TableCell sx={{ fontSize: '0.78rem', color: 'text.secondary', maxWidth: 240 }}>
                      <Tooltip title={t.bodyTemplate} placement="top">
                        <Typography variant="caption" sx={{ cursor: 'help' }}>
                          {t.bodyTemplate.length > 60
                            ? t.bodyTemplate.slice(0, 60) + '…'
                            : t.bodyTemplate}
                        </Typography>
                      </Tooltip>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={t.isActive ? 'Active' : 'Inactive'}
                        color={t.isActive ? 'success' : 'default'}
                        size="small"
                      />
                    </TableCell>
                    <TableCell sx={{ display: 'flex', gap: 0.5 }}>
                      <Tooltip title="Edit">
                        <IconButton
                          size="small"
                          color="primary"
                          onClick={() => openEditTemplate(t)}
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete">
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => deleteTemplateMutation.mutate(t._id)}
                        >
                          <DeleteOutlineIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* ===== DIALOGS ===== */}

      {/* Broadcast Dialog */}
      <Dialog
        open={openBroadcastDialog}
        onClose={() => setOpenBroadcastDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Broadcast System Notification</DialogTitle>
        <DialogContent>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <TextField
                select
                label="Alert Type"
                fullWidth
                value={bType}
                onChange={(e) => setBType(e.target.value as NotificationItem['type'])}
                sx={textFieldStyle}
              >
                <MenuItem value="INFO">ℹ️ Information</MenuItem>
                <MenuItem value="WARNING">⚠️ Warning</MenuItem>
                <MenuItem value="SECURITY">🛡️ Security Alert</MenuItem>
                <MenuItem value="SYSTEM">⚙️ System Maintenance</MenuItem>
                <MenuItem value="PROMO">🎁 Promotion</MenuItem>
                <MenuItem value="TASK">📋 Task</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Target Role (optional)"
                fullWidth
                value={bTargetRole}
                onChange={(e) => setBTargetRole(e.target.value)}
                sx={textFieldStyle}
                helperText="Leave blank to broadcast to all users"
                placeholder="e.g. cashier, manager, admin"
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                label="Notification Title"
                fullWidth
                value={bTitle}
                onChange={(e) => setBTitle(e.target.value)}
                sx={textFieldStyle}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                label="Message Body"
                fullWidth
                multiline
                rows={3}
                value={bBody}
                onChange={(e) => setBBody(e.target.value)}
                sx={textFieldStyle}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                select
                label="Delivery Channels"
                fullWidth
                value={bChannels.join(',')}
                onChange={(e) => setBChannels(e.target.value.split(','))}
                sx={textFieldStyle}
                SelectProps={{ multiple: false }}
              >
                <MenuItem value="IN_APP">In-App Only</MenuItem>
                <MenuItem value="IN_APP,EMAIL">In-App + Email</MenuItem>
                <MenuItem value="IN_APP,SMS">In-App + SMS</MenuItem>
                <MenuItem value="IN_APP,EMAIL,SMS">In-App + Email + SMS</MenuItem>
                <MenuItem value="IN_APP,PUSH">In-App + Push</MenuItem>
                <MenuItem value="IN_APP,EMAIL,SMS,PUSH">All Channels</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControlLabel
                control={
                  <Switch
                    checked={bUseSchedule}
                    onChange={(e) => setBUseSchedule(e.target.checked)}
                  />
                }
                label="Schedule for later"
                sx={{ mt: 2 }}
              />
            </Grid>
            {bUseSchedule && (
              <Grid item xs={12}>
                <TextField
                  type="datetime-local"
                  label="Scheduled Date & Time"
                  fullWidth
                  InputLabelProps={{ shrink: true }}
                  value={bScheduledAt}
                  onChange={(e) => setBScheduledAt(e.target.value)}
                  sx={textFieldStyle}
                />
              </Grid>
            )}
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenBroadcastDialog(false)}>Cancel</Button>
          <Button
            variant="contained"
            startIcon={bUseSchedule ? <ScheduleSendIcon /> : <SendIcon />}
            onClick={handleBroadcast}
            disabled={broadcastMutation.isPending}
          >
            {broadcastMutation.isPending ? 'Sending…' : bUseSchedule ? 'Schedule' : 'Broadcast'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Template Dialog */}
      <Dialog
        open={openTemplateDialog}
        onClose={() => setOpenTemplateDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <CodeIcon color="primary" />
            {editingTemplate ? 'Edit Template' : 'Create Notification Template'}
          </Box>
        </DialogTitle>
        <DialogContent>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
            Use{' '}
            <code
              style={{ background: 'rgba(139,92,246,0.15)', padding: '2px 6px', borderRadius: 4 }}
            >{`{{variableName}}`}</code>{' '}
            placeholders in templates. They will be interpolated at send time.
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Template Key (unique code)"
                fullWidth
                value={tKey}
                onChange={(e) => setTKey(e.target.value)}
                sx={textFieldStyle}
                disabled={!!editingTemplate}
                placeholder="e.g. ORDER_CONFIRMED"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Display Name"
                fullWidth
                value={tName}
                onChange={(e) => setTName(e.target.value)}
                sx={textFieldStyle}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                select
                label="Notification Type"
                fullWidth
                value={tType}
                onChange={(e) => setTType(e.target.value)}
                sx={textFieldStyle}
              >
                <MenuItem value="INFO">Information</MenuItem>
                <MenuItem value="WARNING">Warning</MenuItem>
                <MenuItem value="SECURITY">Security</MenuItem>
                <MenuItem value="SYSTEM">System</MenuItem>
                <MenuItem value="PROMO">Promotion</MenuItem>
                <MenuItem value="TASK">Task</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12}>
              <TextField
                label="Title Template"
                fullWidth
                value={tTitleTemplate}
                onChange={(e) => setTTitleTemplate(e.target.value)}
                sx={textFieldStyle}
                placeholder="e.g. Order {{orderNumber}} has been confirmed"
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                label="Body Template"
                fullWidth
                multiline
                rows={3}
                value={tBodyTemplate}
                onChange={(e) => setTBodyTemplate(e.target.value)}
                sx={textFieldStyle}
                placeholder="e.g. Hi {{customerName}}, your order {{orderNumber}} is ready for pickup."
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenTemplateDialog(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleSaveTemplate}
            disabled={templateMutation.isPending}
          >
            {templateMutation.isPending
              ? 'Saving…'
              : editingTemplate
                ? 'Update'
                : 'Create Template'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
