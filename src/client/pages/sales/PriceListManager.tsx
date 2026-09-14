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
import SellIcon from '@mui/icons-material/Sell';
import { api } from '../../api/client.ts';
import { toast } from 'react-hot-toast';

interface PriceListHeader {
  _id: string;
  code: string;
  name: string;
  type: string;
  currency: string;
  isDefault: boolean;
  isActive: boolean;
}

export default function PriceListManager() {
  const [priceLists, setPriceLists] = useState<PriceListHeader[]>([]);
  const [showModal, setShowModal] = useState(false);

  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [type, setType] = useState('RETAIL');
  const [currency] = useState('USD');

  useEffect(() => {
    fetchPriceLists();
  }, []);

  const fetchPriceLists = async () => {
    try {
      const res = await api.get('/sales-advanced/price-lists');
      setPriceLists(res.data || []);
    } catch {
      toast.error('Failed to load price lists.');
    }
  };

  const handleCreatePriceList = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/sales-advanced/price-lists', {
        code,
        name,
        type,
        currency,
      });
      toast.success(`Price list "${name}" created successfully!`);
      setShowModal(false);
      setCode('');
      setName('');
      fetchPriceLists();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to create price list.');
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
            <SellIcon fontSize="large" /> Tiered Price List Management
          </Typography>
          <Typography variant="body2" sx={{ color: '#9ca3af', mt: 0.5 }}>
            Customer-group, channel, and volume quantity price breaks orchestration
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
          Create Price List
        </Button>
      </Box>

      {/* Grid of Price List Cards */}
      <Grid container spacing={3}>
        {priceLists.map((list) => (
          <Grid item xs={12} sm={6} md={4} key={list._id}>
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
                      label={list.type}
                      size="small"
                      sx={{
                        background: 'rgba(99, 102, 241, 0.2)',
                        color: '#818cf8',
                        fontWeight: 600,
                        mb: 1,
                      }}
                    />
                    <Typography variant="h6" sx={{ fontWeight: 700, color: '#f8fafc' }}>
                      {list.name}
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#9ca3af' }}>
                      Code: {list.code}
                    </Typography>
                  </Box>
                  {list.isDefault && (
                    <Chip label="DEFAULT" size="small" color="success" sx={{ fontWeight: 700 }} />
                  )}
                </Box>
                <Box
                  sx={{
                    pt: 2,
                    borderTop: '1px solid #1f2937',
                    display: 'flex',
                    justifyContent: 'space-between',
                  }}
                >
                  <Typography variant="body2" sx={{ color: '#9ca3af' }}>
                    Currency: <strong style={{ color: '#f8fafc' }}>{list.currency}</strong>
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#34d399', fontWeight: 600 }}>
                    Active
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
          New Price List
        </DialogTitle>
        <form onSubmit={handleCreatePriceList}>
          <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 3 }}>
            <TextField
              fullWidth
              size="small"
              label="List Code"
              placeholder="e.g. WHOLESALE-2026"
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
              label="List Name"
              placeholder="e.g. VIP Wholesale Distributors"
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
              <InputLabel sx={{ color: '#9ca3af' }}>Type</InputLabel>
              <Select
                value={type}
                label="Type"
                onChange={(e) => setType(e.target.value)}
                sx={{ color: '#f8fafc' }}
              >
                <MenuItem value="RETAIL">RETAIL</MenuItem>
                <MenuItem value="WHOLESALE">WHOLESALE</MenuItem>
                <MenuItem value="DISTRIBUTOR">DISTRIBUTOR</MenuItem>
                <MenuItem value="B2B">B2B</MenuItem>
                <MenuItem value="VIP">VIP</MenuItem>
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
              Save Price List
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </Box>
  );
}
