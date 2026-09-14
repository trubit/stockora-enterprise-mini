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
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import MapIcon from '@mui/icons-material/Map';
import { api } from '../../api/client.ts';
import { toast } from 'react-hot-toast';

interface TerritoryItem {
  _id: string;
  code: string;
  name: string;
  region: string;
  description?: string;
  isActive: boolean;
}

export default function SalesRepsTerritories() {
  const [territories, setTerritories] = useState<TerritoryItem[]>([]);
  const [showModal, setShowModal] = useState(false);

  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [region, setRegion] = useState('');

  useEffect(() => {
    fetchTerritories();
  }, []);

  const fetchTerritories = async () => {
    try {
      const res = await api.get('/sales-advanced/territories');
      setTerritories(res.data || []);
    } catch {
      toast.error('Failed to load sales territories.');
    }
  };

  const handleCreateTerritory = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/sales-advanced/territories', {
        code,
        name,
        region,
      });
      toast.success(`Territory "${name}" created!`);
      setShowModal(false);
      setCode('');
      setName('');
      setRegion('');
      fetchTerritories();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to create territory.');
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
            <MapIcon fontSize="large" /> Sales Reps & Territories
          </Typography>
          <Typography variant="body2" sx={{ color: '#9ca3af', mt: 0.5 }}>
            Geographic territory mapping, customer rep assignments & quota management
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
          Add Territory
        </Button>
      </Box>

      {/* Grid of Territory Cards */}
      <Grid container spacing={3}>
        {territories.map((t) => (
          <Grid item xs={12} sm={6} md={4} key={t._id}>
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
                      label={t.region}
                      size="small"
                      sx={{
                        background: 'rgba(245, 158, 11, 0.2)',
                        color: '#fbbf24',
                        fontWeight: 600,
                        mb: 1,
                      }}
                    />
                    <Typography variant="h6" sx={{ fontWeight: 700, color: '#f8fafc' }}>
                      {t.name}
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#9ca3af' }}>
                      Code: {t.code}
                    </Typography>
                  </Box>
                  <Chip label="ACTIVE" size="small" color="success" sx={{ fontWeight: 700 }} />
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
          New Territory
        </DialogTitle>
        <form onSubmit={handleCreateTerritory}>
          <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 3 }}>
            <TextField
              fullWidth
              size="small"
              label="Territory Code"
              placeholder="e.g. TER-WEST"
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
              label="Territory Name"
              placeholder="e.g. Western Region Commercial"
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
            <TextField
              fullWidth
              size="small"
              label="Region"
              placeholder="e.g. North America / EMEA"
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              required
              sx={{
                background: '#1f2937',
                borderRadius: 1,
                input: { color: '#f8fafc' },
                label: { color: '#9ca3af' },
              }}
            />
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
              Save Territory
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </Box>
  );
}
