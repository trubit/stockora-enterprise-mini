import { useState } from 'react';
import { Box, Typography, Paper, Button, Grid, TextField } from '@mui/material';
import SettingsIcon from '@mui/icons-material/Settings';
import SaveIcon from '@mui/icons-material/Save';
import { toast } from 'react-hot-toast';

export default function ProcurementSettings() {
  const [settings, setSettings] = useState({
    overReceivingTolerancePercent: 5,
    priceMatchingVariancePercent: 1,
    quantityMatchingVariancePercent: 0,
    managerApprovalThreshold: 5000,
    executiveApprovalThreshold: 25000,
    deliveryWeight: 30,
    qualityWeight: 40,
    fillWeight: 30,
  });

  const handleSaveSettings = () => {
    toast.success('Procurement & Approval Threshold settings saved!');
  };

  return (
    <Box sx={{ p: 3, background: '#0b0f19', minHeight: '100vh', color: '#f8fafc' }}>
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
            <SettingsIcon fontSize="large" /> Procurement Engine Settings & Governance
          </Typography>
          <Typography variant="body2" sx={{ color: '#9ca3af', mt: 0.5 }}>
            Configure approval thresholds, 3-way matching variances, over-receiving tolerances, and
            supplier scorecard weights
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<SaveIcon />}
          onClick={handleSaveSettings}
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
          Save Configuration
        </Button>
      </Box>

      <Grid container spacing={3}>
        {/* Receiving & Matching Tolerances */}
        <Grid item xs={12} md={6}>
          <Paper
            sx={{
              p: 3,
              background: '#111827',
              border: '1px solid #1f2937',
              borderRadius: 3,
              color: '#f8fafc',
              height: '100%',
            }}
          >
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 2, color: '#f8fafc' }}>
              Receiving & 3-Way Match Tolerances
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  type="number"
                  label="Over-Receiving Max Tolerance (%)"
                  value={settings.overReceivingTolerancePercent}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      overReceivingTolerancePercent: Number(e.target.value),
                    })
                  }
                  InputLabelProps={{ style: { color: '#9ca3af' } }}
                  InputProps={{ style: { color: '#fff' } }}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  type="number"
                  label="Invoice Price Variance Max Tolerance (%)"
                  value={settings.priceMatchingVariancePercent}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      priceMatchingVariancePercent: Number(e.target.value),
                    })
                  }
                  InputLabelProps={{ style: { color: '#9ca3af' } }}
                  InputProps={{ style: { color: '#fff' } }}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  type="number"
                  label="Quantity Variance Max Tolerance (%)"
                  value={settings.quantityMatchingVariancePercent}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      quantityMatchingVariancePercent: Number(e.target.value),
                    })
                  }
                  InputLabelProps={{ style: { color: '#9ca3af' } }}
                  InputProps={{ style: { color: '#fff' } }}
                />
              </Grid>
            </Grid>
          </Paper>
        </Grid>

        {/* Approval Thresholds */}
        <Grid item xs={12} md={6}>
          <Paper
            sx={{
              p: 3,
              background: '#111827',
              border: '1px solid #1f2937',
              borderRadius: 3,
              color: '#f8fafc',
              height: '100%',
            }}
          >
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 2, color: '#f8fafc' }}>
              Requisition & PO Approval Thresholds
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  type="number"
                  label="Branch Manager Approval Limit ($)"
                  value={settings.managerApprovalThreshold}
                  onChange={(e) =>
                    setSettings({ ...settings, managerApprovalThreshold: Number(e.target.value) })
                  }
                  InputLabelProps={{ style: { color: '#9ca3af' } }}
                  InputProps={{ style: { color: '#fff' } }}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  type="number"
                  label="Executive / Finance Approval Limit ($)"
                  value={settings.executiveApprovalThreshold}
                  onChange={(e) =>
                    setSettings({ ...settings, executiveApprovalThreshold: Number(e.target.value) })
                  }
                  InputLabelProps={{ style: { color: '#9ca3af' } }}
                  InputProps={{ style: { color: '#fff' } }}
                />
              </Grid>
            </Grid>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}
