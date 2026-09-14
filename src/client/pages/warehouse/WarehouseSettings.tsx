import { useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  Grid,
  TextField,
  FormControlLabel,
  Switch,
} from '@mui/material';
import SettingsIcon from '@mui/icons-material/Settings';
import SaveIcon from '@mui/icons-material/Save';
import { toast } from 'react-hot-toast';

export default function WarehouseSettings() {
  const [settings, setSettings] = useState({
    overReceivingTolerancePercent: 5,
    defaultPickingStrategy: 'SINGLE',
    fefoEnabled: true,
    fifoEnabled: true,
    blindCountEnabled: true,
    autoPutawayEnabled: true,
    maxCapacityThresholdPercent: 90,
  });

  const handleSaveSettings = () => {
    toast.success('Warehouse governance settings saved successfully!');
  };

  return (
    <Box sx={{ p: { xs: 0, sm: 1 }, background: 'transparent', color: '#f8fafc' }}>
      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', sm: 'row' },
          justifyContent: 'space-between',
          alignItems: { xs: 'flex-start', sm: 'center' },
          gap: 2,
          mb: 3,
        }}
      >
        <Box>
          <Typography
            variant="h4"
            sx={{
              fontWeight: 800,
              color: '#8b5cf6',
              display: 'flex',
              alignItems: 'center',
              gap: 1.5,
              fontSize: { xs: '1.4rem', sm: '1.8rem', md: '2.125rem' },
            }}
          >
            <SettingsIcon fontSize="large" /> Warehouse Governance & System Settings
          </Typography>
          <Typography variant="body2" sx={{ color: '#9ca3af', mt: 0.5 }}>
            Configure capacity thresholds, picking strategies (FEFO/FIFO), over-receiving tolerance
            & barcode rules
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<SaveIcon />}
          onClick={handleSaveSettings}
          sx={{
            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
            color: '#ffffff',
            fontWeight: 600,
            borderRadius: '9999px',
            px: 3,
            width: { xs: '100%', sm: 'auto' },
            '&:hover': {
              background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
            },
          }}
        >
          Save Configuration
        </Button>
      </Box>

      <Paper
        sx={{
          p: { xs: 1.5, sm: 3 },
          background: '#111827',
          border: '1px solid #1f2937',
          borderRadius: 3,
          color: '#f8fafc',
        }}
      >
        <Grid container spacing={3}>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              type="number"
              label="Over-Receiving Max Tolerance (%)"
              value={settings.overReceivingTolerancePercent}
              onChange={(e) =>
                setSettings({ ...settings, overReceivingTolerancePercent: Number(e.target.value) })
              }
              InputLabelProps={{ shrink: true, style: { color: '#9ca3af' } }}
              InputProps={{ style: { color: '#fff' } }}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              type="number"
              label="Max Warehouse Capacity Threshold (%)"
              value={settings.maxCapacityThresholdPercent}
              onChange={(e) =>
                setSettings({ ...settings, maxCapacityThresholdPercent: Number(e.target.value) })
              }
              InputLabelProps={{ shrink: true, style: { color: '#9ca3af' } }}
              InputProps={{ style: { color: '#fff' } }}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              select
              fullWidth
              label="Default Picking Strategy"
              value={settings.defaultPickingStrategy}
              onChange={(e) => setSettings({ ...settings, defaultPickingStrategy: e.target.value })}
              SelectProps={{ native: true }}
              InputLabelProps={{ shrink: true, style: { color: '#9ca3af' } }}
              InputProps={{ style: { color: '#fff' } }}
            >
              <option value="SINGLE" style={{ background: '#111827' }}>
                SINGLE ORDER PICKING
              </option>
              <option value="BATCH" style={{ background: '#111827' }}>
                BATCH PICKING
              </option>
              <option value="WAVE" style={{ background: '#111827' }}>
                WAVE PICKING
              </option>
              <option value="ZONE" style={{ background: '#111827' }}>
                ZONE PICKING
              </option>
            </TextField>
          </Grid>
          <Grid item xs={12}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mt: 1 }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={settings.fefoEnabled}
                    onChange={(e) => setSettings({ ...settings, fefoEnabled: e.target.checked })}
                    color="secondary"
                  />
                }
                label={
                  <Typography sx={{ color: '#f8fafc', fontWeight: 600 }}>
                    Enable FEFO (First Expired, First Out) Strategy for Batch/Lot Items
                  </Typography>
                }
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={settings.fifoEnabled}
                    onChange={(e) => setSettings({ ...settings, fifoEnabled: e.target.checked })}
                    color="secondary"
                  />
                }
                label={
                  <Typography sx={{ color: '#f8fafc', fontWeight: 600 }}>
                    Enable FIFO (First In, First Out) Strategy for Standard Inventory
                  </Typography>
                }
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={settings.blindCountEnabled}
                    onChange={(e) =>
                      setSettings({ ...settings, blindCountEnabled: e.target.checked })
                    }
                    color="secondary"
                  />
                }
                label={
                  <Typography sx={{ color: '#f8fafc', fontWeight: 600 }}>
                    Enable Blind Stock Counting (Hides System Qty from Counters)
                  </Typography>
                }
              />
            </Box>
          </Grid>
        </Grid>
      </Paper>
    </Box>
  );
}
