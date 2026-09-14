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
  Alert,
  Tooltip,
  MenuItem,
  useTheme,
} from '@mui/material';
import Add from '@mui/icons-material/Add';
import Delete from '@mui/icons-material/Delete';
import Autorenew from '@mui/icons-material/Autorenew';
import ContentCopy from '@mui/icons-material/ContentCopy';
import Close from '@mui/icons-material/Close';
import { apiClient } from '../../api/client.ts';
import { notify } from '../../utils/notify.ts';
import { useConfirm } from '../../context/ConfirmDialogContext.tsx';
import PageHeader from '../../components/PageHeader.tsx';
import StatusChip from '../../components/StatusChip.tsx';

interface ApiKeyItem {
  _id: string;
  name: string;
  keyId: string;
  prefix: string;
  permissions: string[];
  rateLimitPerMinute: number;
  expiresAt?: string;
  lastUsedAt?: string;
  createdAt: string;
  revokedAt?: string;
}

const AVAILABLE_SCOPES = [
  { scope: 'products:read', label: 'Read Catalog Products' },
  { scope: 'products:write', label: 'Create & Update Products' },
  { scope: 'inventory:read', label: 'Read Stock & Levels' },
  { scope: 'inventory:write', label: 'Adjust & Transfer Stock' },
  { scope: 'orders:read', label: 'Read Orders & Sales' },
  { scope: 'orders:write', label: 'Create Orders' },
  { scope: 'customers:read', label: 'Read Customers' },
  { scope: 'customers:write', label: 'Create Customers' },
  { scope: 'reports:read', label: 'Read Financial Reports' },
  { scope: 'webhooks:manage', label: 'Manage Webhooks' },
];

export const ApiKeyManager: React.FC = () => {
  const theme = useTheme();
  const confirm = useConfirm();
  const [keys, setKeys] = useState<ApiKeyItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Create Key Modal
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [keyName, setKeyName] = useState('');
  const [selectedScopes, setSelectedScopes] = useState<string[]>([
    'products:read',
    'inventory:read',
    'orders:read',
  ]);
  const [expiresInDays, setExpiresInDays] = useState(90);
  const [creatingKey, setCreatingKey] = useState(false);

  // Secret Reveal Modal (Shown once upon creation)
  const [revealModalOpen, setRevealModalOpen] = useState(false);
  const [revealedSecret, setRevealedSecret] = useState('');

  const isDark = theme.palette.mode === 'dark';

  useEffect(() => {
    fetchKeys();
  }, []);

  const fetchKeys = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get('/integrations/api-keys');
      if (res.data?.success) {
        setKeys(res.data.data);
      }
    } catch (err: any) {
      if (err.response?.status === 403) {
        notify.error('API Access is disabled for your subscription tier. Upgrade required.');
      } else if (err.response?.status !== 401) {
        notify.error('Failed to load API keys');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCreateKey = async () => {
    if (!keyName.trim()) {
      notify.error('Please enter an API key name');
      return;
    }

    try {
      setCreatingKey(true);
      const res = await apiClient.post('/integrations/api-keys', {
        name: keyName,
        permissions: selectedScopes,
        expiresInDays: Number(expiresInDays),
      });

      if (res.data?.success) {
        notify.success('API key generated successfully!');
        setRevealModalOpen(true);
        setRevealedSecret(res.data.data.rawKey);
        setCreateModalOpen(false);
        fetchKeys();
      }
    } catch (err: any) {
      notify.error(err, { fallback: 'Failed to create API key' });
    } finally {
      setCreatingKey(false);
    }
  };

  const handleRevokeKey = async (keyId: string) => {
    const confirmed = await confirm({
      title: 'Revoke API Key',
      message:
        'Are you sure you want to revoke this API key immediately? Any systems or automations using this key will immediately lose access.',
      confirmText: 'Revoke Key',
      severity: 'error',
    });
    if (!confirmed) return;

    try {
      const res = await apiClient.post(`/integrations/api-keys/${keyId}/revoke`);
      if (res.data?.success) {
        notify.success('API key revoked.');
        fetchKeys();
      }
    } catch (err) {
      notify.error(err, { fallback: 'Failed to revoke API key' });
    }
  };

  const handleRotateKey = async (keyId: string) => {
    const confirmed = await confirm({
      title: 'Rotate API Key',
      message:
        'Rotating this API key will immediately invalidate the existing key and issue a new secret. Any connected external services must be updated.',
      confirmText: 'Rotate Key',
      severity: 'warning',
    });
    if (!confirmed) return;

    try {
      const res = await apiClient.post(`/integrations/api-keys/${keyId}/rotate`);
      if (res.data?.success) {
        notify.success('API key rotated!');
        setRevealedSecret(res.data.data.rawKey);
        setRevealModalOpen(true);
        fetchKeys();
      }
    } catch (err) {
      notify.error(err, { fallback: 'Failed to rotate API key' });
    }
  };

  const handleCopySecret = () => {
    navigator.clipboard.writeText(revealedSecret);
    notify.success('API key copied to clipboard!');
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
        title="Developer API Keys"
        subtitle="Manage secure, scoped authentication tokens for third-party scripts, custom ERPs, and automated workflows."
        category="Developer Platform"
        action={
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={() => {
              setKeyName('');
              setCreateModalOpen(true);
            }}
            sx={{
              fontWeight: 700,
              borderRadius: '10px',
              textTransform: 'none',
              background: 'linear-gradient(135deg, #8b5cf6 0%, #3b82f6 100%)',
            }}
          >
            Create New Key
          </Button>
        }
      />

      {/* Keys Table */}
      <Card className="glass-panel" sx={{ borderRadius: '20px', overflow: 'hidden' }}>
        <Box sx={{ p: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box>
            <Typography
              variant="h6"
              sx={{ fontWeight: 900, color: isDark ? '#f8fafc' : '#0f172a' }}
            >
              Active & Revoked Tokens
            </Typography>
            <Typography variant="caption" sx={{ color: isDark ? '#9ca3af' : '#64748b' }}>
              API secrets are hashed with SHA-256 at rest. Only prefixes are visible after
              generation.
            </Typography>
          </Box>
          <Chip label={`${keys.length} API Keys`} size="small" sx={{ fontWeight: 700 }} />
        </Box>

        {loading ? (
          <CircularProgress size={35} sx={{ display: 'block', mx: 'auto', my: 4 }} />
        ) : keys.length === 0 ? (
          <Box sx={{ p: 4, textAlign: 'center' }}>
            <Typography variant="body1" sx={{ color: isDark ? '#9ca3af' : '#64748b', mb: 2 }}>
              No API keys generated yet. Create a key to begin integrating.
            </Typography>
            <Button
              variant="outlined"
              startIcon={<Add />}
              onClick={() => setCreateModalOpen(true)}
              sx={{ fontWeight: 700, borderRadius: '10px' }}
            >
              Generate First API Key
            </Button>
          </Box>
        ) : (
          <Box sx={{ overflowX: 'auto' }}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell sx={tableHeaderSx}>Key Name</TableCell>
                  <TableCell sx={tableHeaderSx}>Prefix / Key ID</TableCell>
                  <TableCell sx={tableHeaderSx}>Scopes</TableCell>
                  <TableCell sx={tableHeaderSx}>Status</TableCell>
                  <TableCell sx={tableHeaderSx}>Last Used</TableCell>
                  <TableCell sx={tableHeaderSx}>Expires</TableCell>
                  <TableCell sx={{ ...tableHeaderSx, textAlign: 'right' }}>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {keys.map((k) => {
                  const isRevoked = Boolean(k.revokedAt);
                  return (
                    <TableRow key={k._id} hover>
                      <TableCell sx={{ ...tableCellSx, fontWeight: 800 }}>{k.name}</TableCell>
                      <TableCell sx={{ ...tableCellSx, fontFamily: 'monospace', color: '#8b5cf6' }}>
                        {k.prefix}
                      </TableCell>
                      <TableCell sx={tableCellSx}>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                          {k.permissions.map((p) => (
                            <Chip
                              key={p}
                              label={p}
                              size="small"
                              sx={{ fontSize: '0.65rem', height: 20 }}
                            />
                          ))}
                        </Box>
                      </TableCell>
                      <TableCell sx={tableCellSx}>
                        <StatusChip
                          status={isRevoked ? 'CANCELLED' : 'ACTIVE'}
                          label={isRevoked ? 'REVOKED' : 'ACTIVE'}
                        />
                      </TableCell>
                      <TableCell
                        sx={{
                          ...tableCellSx,
                          color: isDark ? '#9ca3af' : '#64748b',
                          fontSize: '0.8rem',
                        }}
                      >
                        {k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleString() : 'Never'}
                      </TableCell>
                      <TableCell
                        sx={{
                          ...tableCellSx,
                          color: isDark ? '#9ca3af' : '#64748b',
                          fontSize: '0.8rem',
                        }}
                      >
                        {k.expiresAt ? new Date(k.expiresAt).toLocaleDateString() : 'Never'}
                      </TableCell>
                      <TableCell sx={{ ...tableCellSx, textAlign: 'right' }}>
                        {!isRevoked && (
                          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 0.5 }}>
                            <Tooltip title="Rotate Key (Revoke old, mint new)">
                              <IconButton size="small" onClick={() => handleRotateKey(k.keyId)}>
                                <Autorenew fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Revoke Immediately">
                              <IconButton
                                size="small"
                                color="error"
                                onClick={() => handleRevokeKey(k.keyId)}
                              >
                                <Delete fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </Box>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Box>
        )}
      </Card>

      {/* Create Key Dialog */}
      <Dialog
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
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
          sx={{ p: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
        >
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 900 }}>
              Create Developer API Key
            </Typography>
            <Typography variant="caption" sx={{ color: isDark ? '#9ca3af' : '#64748b' }}>
              Assign granular permission scopes and expiration
            </Typography>
          </Box>
          <IconButton onClick={() => setCreateModalOpen(false)}>
            <Close />
          </IconButton>
        </DialogTitle>

        <DialogContent sx={{ p: 3 }}>
          <TextField
            fullWidth
            label="Key Identifier / App Name"
            placeholder="e.g. ERP Ingest Script / Mobile App Token"
            value={keyName}
            onChange={(e) => setKeyName(e.target.value)}
            sx={{ mb: 2.5 }}
          />

          <TextField
            select
            fullWidth
            label="Expiration Period"
            value={expiresInDays}
            onChange={(e) => setExpiresInDays(Number(e.target.value))}
            sx={{ mb: 2.5 }}
          >
            <MenuItem value={30}>30 Days</MenuItem>
            <MenuItem value={60}>60 Days</MenuItem>
            <MenuItem value={90}>90 Days</MenuItem>
            <MenuItem value={365}>1 Year</MenuItem>
            <MenuItem value={0}>No Expiration</MenuItem>
          </TextField>

          <Typography
            variant="subtitle2"
            sx={{ fontWeight: 800, mb: 1, textTransform: 'uppercase', color: '#8b5cf6' }}
          >
            Authorized Scopes
          </Typography>

          <Grid container spacing={1}>
            {AVAILABLE_SCOPES.map((item) => (
              <Grid item xs={12} sm={6} key={item.scope}>
                <FormControlLabel
                  control={
                    <Checkbox
                      size="small"
                      checked={selectedScopes.includes(item.scope)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedScopes([...selectedScopes, item.scope]);
                        } else {
                          setSelectedScopes(selectedScopes.filter((s) => s !== item.scope));
                        }
                      }}
                    />
                  }
                  label={
                    <Typography variant="caption" sx={{ fontWeight: 600 }}>
                      {item.label}
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
            onClick={handleCreateKey}
            disabled={creatingKey}
            sx={{
              fontWeight: 800,
              borderRadius: '10px',
              px: 3,
              background: 'linear-gradient(135deg, #8b5cf6 0%, #3b82f6 100%)',
            }}
          >
            {creatingKey ? 'Generating...' : 'Generate Secret Key'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Secret Reveal Dialog */}
      <Dialog
        open={revealModalOpen}
        onClose={() => setRevealModalOpen(false)}
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
            Secret API Key Generated
          </Typography>
          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)' }}>
            Please copy this key now. It will never be shown again.
          </Typography>
        </DialogTitle>

        <DialogContent sx={{ p: 3.5 }}>
          <Alert severity="warning" sx={{ mb: 2.5 }}>
            Store this key securely. If lost, you will need to rotate or generate a new token.
          </Alert>

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
            <IconButton onClick={handleCopySecret} color="primary" sx={{ ml: 1 }}>
              <ContentCopy />
            </IconButton>
          </Card>
        </DialogContent>

        <DialogActions sx={{ p: 3, pt: 0 }}>
          <Button
            variant="contained"
            onClick={() => setRevealModalOpen(false)}
            sx={{ fontWeight: 800, borderRadius: '10px', px: 3 }}
          >
            I have stored my key safely
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ApiKeyManager;
