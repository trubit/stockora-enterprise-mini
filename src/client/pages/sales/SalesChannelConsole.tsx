import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  Button,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import StorefrontIcon from '@mui/icons-material/Storefront';
import { api } from '../../api/client.ts';
import { toast } from 'react-hot-toast';

interface ChannelItem {
  _id: string;
  code: string;
  name: string;
  type: string;
  currency: string;
  fulfillmentStrategy: string;
  isActive: boolean;
}

export default function SalesChannelConsole() {
  const [channels, setChannels] = useState<ChannelItem[]>([]);
  const [showModal, setShowModal] = useState(false);

  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [type, setType] = useState('POS');
  const [currency] = useState('USD');
  const [fulfillmentStrategy, setFulfillmentStrategy] = useState('DEFAULT_WAREHOUSE');

  useEffect(() => {
    fetchChannels();
  }, []);

  const fetchChannels = async () => {
    try {
      const res = await api.get('/sales-advanced/channels');
      setChannels(res.data || []);
    } catch {
      toast.error('Failed to load sales channels.');
    }
  };

  const handleCreateChannel = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/sales-advanced/channels', {
        code,
        name,
        type,
        currency,
        fulfillmentStrategy,
      });
      toast.success(`Sales channel "${name}" created!`);
      setShowModal(false);
      setCode('');
      setName('');
      fetchChannels();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to create channel.');
    }
  };

  return (
    <Box sx={{ p: 3, background: '#0b0f19', minHeight: '100vh', color: '#f8fafc' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography
            variant="h4"
            sx={{
              fontWeight: 800,
              color: '#8b5cf6',
              display: 'flex',
              alignItems: 'center',
              gap: 1.5,
            }}
          >
            <StorefrontIcon fontSize="large" /> Omnichannel Sales Channels
          </Typography>
          <Typography variant="body2" sx={{ color: '#9ca3af', mt: 0.5 }}>
            Unified sales channel orchestration & warehouse fulfillment routing strategies
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setShowModal(true)}
          sx={{
            background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
            color: '#ffffff',
            fontWeight: 600,
            borderRadius: '9999px',
            px: 3,
            '&:hover': {
              background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
            },
          }}
        >
          Add Channel
        </Button>
      </Box>

      {/* Grid of Channel Cards */}
      <Grid container spacing={3}>
        {channels.map((c) => (
          <Grid item xs={12} sm={6} md={4} key={c._id}>
            <Card
              sx={{
                background: '#111827',
                border: '1px solid #1f2937',
                borderRadius: 3,
                color: '#f8fafc',
                height: '100%',
                transition: 'all 0.3s ease',
                '&:hover': {
                  borderColor: '#8b5cf6',
                  transform: 'translateY(-2px)',
                },
              }}
            >
              <CardContent sx={{ p: 3 }}>
                <Box
                  sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    mb: 2,
                  }}
                >
                  <Box>
                    <Chip
                      label={c.type}
                      size="small"
                      sx={{
                        background: 'rgba(56, 189, 248, 0.2)',
                        color: '#38bdf8',
                        fontWeight: 600,
                        mb: 1,
                      }}
                    />
                    <Typography variant="h6" sx={{ fontWeight: 700, color: '#f8fafc' }}>
                      {c.name}
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#9ca3af' }}>
                      Code: {c.code}
                    </Typography>
                  </Box>
                  <Chip label="ACTIVE" size="small" color="success" sx={{ fontWeight: 700 }} />
                </Box>
                <Box sx={{ pt: 2, borderTop: '1px solid #1f2937' }}>
                  <Typography variant="body2" sx={{ color: '#9ca3af', mb: 0.5 }}>
                    Routing Strategy:{' '}
                    <strong style={{ color: '#f8fafc' }}>{c.fulfillmentStrategy}</strong>
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#9ca3af' }}>
                    Currency: <strong style={{ color: '#f8fafc' }}>{c.currency}</strong>
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Dialog Modal */}
      <Dialog
        open={showModal}
        onClose={() => setShowModal(false)}
        fullWidth
        maxWidth="xs"
        PaperProps={{
          sx: {
            background: '#111827',
            color: '#f8fafc',
            border: '1px solid #1f2937',
            borderRadius: 3,
            width: '100%',
            maxWidth: 440,
            m: { xs: 1.5, sm: 2 },
          },
        }}
      >
        <DialogTitle sx={{ fontWeight: 700, borderBottom: '1px solid #1f2937' }}>
          New Sales Channel
        </DialogTitle>
        <form onSubmit={handleCreateChannel}>
          <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 3 }}>
            <TextField
              fullWidth
              size="small"
              label="Channel Code"
              placeholder="e.g. SHOPIFY-US"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              required
              sx={{
                background: '#1f2937',
                borderRadius: 1,
                input: { color: '#f8fafc' },
                label: { color: '#9ca3af' },
              }}
            />
            <TextField
              fullWidth
              size="small"
              label="Channel Name"
              placeholder="e.g. Shopify Global Webstore"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              sx={{
                background: '#1f2937',
                borderRadius: 1,
                input: { color: '#f8fafc' },
                label: { color: '#9ca3af' },
              }}
            />
            <FormControl fullWidth size="small" sx={{ background: '#1f2937', borderRadius: 1 }}>
              <InputLabel sx={{ color: '#9ca3af' }}>Channel Type</InputLabel>
              <Select
                value={type}
                label="Channel Type"
                onChange={(e) => setType(e.target.value)}
                sx={{ color: '#f8fafc' }}
              >
                <MenuItem value="POS">POS</MenuItem>
                <MenuItem value="ONLINE">ONLINE</MenuItem>
                <MenuItem value="B2B">B2B</MenuItem>
                <MenuItem value="WHOLESALE">WHOLESALE</MenuItem>
                <MenuItem value="SALES_REP">SALES_REP</MenuItem>
                <MenuItem value="MARKETPLACE">MARKETPLACE</MenuItem>
              </Select>
            </FormControl>
            <FormControl fullWidth size="small" sx={{ background: '#1f2937', borderRadius: 1 }}>
              <InputLabel sx={{ color: '#9ca3af' }}>Fulfillment Strategy</InputLabel>
              <Select
                value={fulfillmentStrategy}
                label="Fulfillment Strategy"
                onChange={(e) => setFulfillmentStrategy(e.target.value)}
                sx={{ color: '#f8fafc' }}
              >
                <MenuItem value="DEFAULT_WAREHOUSE">Default Warehouse</MenuItem>
                <MenuItem value="NEAREST">Nearest Location</MenuItem>
                <MenuItem value="SPLIT_AVAILABLE">Split Across Warehouses</MenuItem>
                <MenuItem value="MANUAL">Manual Routing</MenuItem>
              </Select>
            </FormControl>
          </DialogContent>
          <DialogActions sx={{ p: 2.5, borderTop: '1px solid #1f2937' }}>
            <Button onClick={() => setShowModal(false)} sx={{ color: '#9ca3af' }}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="contained"
              sx={{ background: '#6366f1', borderRadius: '9999px' }}
            >
              Save Channel
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </Box>
  );
}
