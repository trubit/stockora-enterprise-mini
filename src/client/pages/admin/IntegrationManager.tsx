import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { apiClient } from '../../api/client.ts';
import {
  Box,
  Typography,
  Button,
  Paper,
  Grid,
  Chip,
  Card,
  CardContent,
  Switch,
  FormControlLabel,
  TextField,
  Divider,
  List,
  ListItem,
  ListItemText,
} from '@mui/material';
import SyncIcon from '@mui/icons-material/Sync';
import PaymentIcon from '@mui/icons-material/Payment';
import CloudQueueIcon from '@mui/icons-material/CloudQueue';
import { toast } from 'react-hot-toast';

const textFieldStyle = { mt: 1 };

export default function IntegrationManager() {
  const [qbConnected, setQbConnected] = useState(true);
  const [xeroConnected, setXeroConnected] = useState(false);
  const [stripeConnected, setStripeConnected] = useState(true);
  const [autoSync, setAutoSync] = useState(true);

  const [webhookLogs] = useState<string[]>(() => [
    `[${new Date(Date.now() - 3600000).toLocaleTimeString()}] stripe: webhook registered successfully`,
    `[${new Date(Date.now() - 1800000).toLocaleTimeString()}] stripe: payment_intent.succeeded received (ref: TX-390212)`,
  ]);

  const syncMutation = useMutation({
    mutationFn: async (platform: 'QUICKBOOKS' | 'XERO') => {
      const { data } = await apiClient.post('/integrations/sync', { platform });
      return data;
    },
    onSuccess: (data) => {
      toast.success(data.message || 'ERP synchronization sync successfully dispatched.');
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onError: (err: any) => {
      toast.error(err.response?.data?.error?.message || 'Sync failed.');
    },
  });

  const handleSync = (platform: 'QUICKBOOKS' | 'XERO') => {
    syncMutation.mutate(platform);
  };

  return (
    <Box sx={{ width: '100%' }}>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" sx={{ fontWeight: 800 }}>
          Integrations & ERP Connector
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Manage third-party bookkeeping connections, configure webhook endpoints, and sync sales
          ledgers.
        </Typography>
      </Box>

      <Grid container spacing={3.5}>
        <Grid item xs={12} sm={4}>
          <Card
            className="glass-panel"
            sx={{ p: 1, height: '100%', display: 'flex', flexDirection: 'column' }}
          >
            <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, flexGrow: 1 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="h6" sx={{ fontWeight: 700 }}>
                  QuickBooks Online
                </Typography>
                <Chip
                  label={qbConnected ? 'Connected' : 'Disconnected'}
                  color={qbConnected ? 'success' : 'default'}
                  size="small"
                />
              </Box>
              <Typography variant="body2" color="text.secondary">
                Publish POS transaction totals, invoices, taxes, and inventory adjustments to
                QuickBooks.
              </Typography>
              <Box sx={{ flexGrow: 1 }} />
              <Box sx={{ display: 'flex', gap: 1.5, mt: 2 }}>
                <Button
                  variant="contained"
                  size="small"
                  startIcon={<SyncIcon />}
                  onClick={() => handleSync('QUICKBOOKS')}
                  disabled={syncMutation.isPending || !qbConnected}
                  fullWidth
                  sx={{ background: 'linear-gradient(90deg, #8b5cf6 0%, #7c3aed 100%)' }}
                >
                  Sync Ledger
                </Button>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={() => setQbConnected(!qbConnected)}
                >
                  {qbConnected ? 'Disconnect' : 'Connect'}
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={4}>
          <Card
            className="glass-panel"
            sx={{ p: 1, height: '100%', display: 'flex', flexDirection: 'column' }}
          >
            <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, flexGrow: 1 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="h6" sx={{ fontWeight: 700 }}>
                  Xero Bookkeeping
                </Typography>
                <Chip
                  label={xeroConnected ? 'Connected' : 'Disconnected'}
                  color={xeroConnected ? 'success' : 'default'}
                  size="small"
                />
              </Box>
              <Typography variant="body2" color="text.secondary">
                Push standard accounting journals and balance sheet reconciliation reports
                automatically.
              </Typography>
              <Box sx={{ flexGrow: 1 }} />
              <Box sx={{ display: 'flex', gap: 1.5, mt: 2 }}>
                <Button
                  variant="contained"
                  size="small"
                  startIcon={<SyncIcon />}
                  onClick={() => handleSync('XERO')}
                  disabled={syncMutation.isPending || !xeroConnected}
                  fullWidth
                  sx={{ background: 'linear-gradient(90deg, #8b5cf6 0%, #7c3aed 100%)' }}
                >
                  Sync Ledger
                </Button>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={() => setXeroConnected(!xeroConnected)}
                >
                  {xeroConnected ? 'Disconnect' : 'Connect'}
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={4}>
          <Card
            className="glass-panel"
            sx={{ p: 1, height: '100%', display: 'flex', flexDirection: 'column' }}
          >
            <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, flexGrow: 1 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="h6" sx={{ fontWeight: 700 }}>
                  Stripe Terminal
                </Typography>
                <Chip
                  label={stripeConnected ? 'Connected' : 'Disconnected'}
                  color={stripeConnected ? 'success' : 'default'}
                  size="small"
                />
              </Box>
              <Typography variant="body2" color="text.secondary">
                Receive card payments, synchronize POS checkout cash drawer sessions, and listen to
                payment status webhooks.
              </Typography>
              <Box sx={{ flexGrow: 1 }} />
              <Box sx={{ display: 'flex', gap: 1.5, mt: 2 }}>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={() => setStripeConnected(!stripeConnected)}
                  fullWidth
                >
                  {stripeConnected ? 'Deactivate Webhooks' : 'Activate Gateway'}
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={7}>
          <Paper
            className="glass-panel"
            sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 2 }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <PaymentIcon color="primary" />
              <Typography variant="h6" sx={{ fontWeight: 700 }}>
                Gateway Webhooks Console
              </Typography>
            </Box>
            <Box>
              <Typography variant="caption" display="block" color="text.secondary">
                Stripe listener:{' '}
                <code>{`${typeof window !== 'undefined' ? window.location.origin : ''}/api/v1/integrations/stripe-webhook`}</code>
              </Typography>
              <Typography variant="caption" display="block" color="text.secondary">
                Paystack listener:{' '}
                <code>{`${typeof window !== 'undefined' ? window.location.origin : ''}/api/v1/integrations/paystack-webhook`}</code>
              </Typography>
            </Box>
            <Box
              sx={{
                bgcolor: 'rgba(0,0,0,0.15)',
                borderRadius: 2,
                p: 2,
                minHeight: '160px',
                overflowY: 'auto',
              }}
            >
              <List>
                {webhookLogs.map((log, idx) => (
                  <ListItem key={idx} sx={{ p: 0.5 }}>
                    <ListItemText
                      primary={
                        <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                          {log}
                        </Typography>
                      }
                    />
                  </ListItem>
                ))}
              </List>
            </Box>
          </Paper>
        </Grid>

        <Grid item xs={12} md={5}>
          <Paper
            className="glass-panel"
            sx={{ p: 3, height: '100%', display: 'flex', flexDirection: 'column', gap: 2.5 }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <CloudQueueIcon color="primary" />
              <Typography variant="h6" sx={{ fontWeight: 700 }}>
                Global Sync Configurations
              </Typography>
            </Box>
            <FormControlLabel
              control={
                <Switch checked={autoSync} onChange={(e) => setAutoSync(e.target.checked)} />
              }
              label="Real-time automatic sync on transaction completion"
            />
            <Divider sx={{ opacity: 0.05 }} />
            <TextField
              label="Default QuickBooks Account Code"
              fullWidth
              defaultValue="4000-SALES-REVENUE"
              sx={textFieldStyle}
            />
            <TextField
              label="Default Xero Sales Account Code"
              fullWidth
              defaultValue="400-REVENUE"
              sx={textFieldStyle}
            />
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}
