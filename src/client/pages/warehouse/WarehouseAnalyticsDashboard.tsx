import { useState, useEffect } from 'react';
import { Box, Typography, Paper, Grid, Card, CardContent, Button, TextField } from '@mui/material';
import AnalyticsIcon from '@mui/icons-material/Analytics';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import SendIcon from '@mui/icons-material/Send';
import { api } from '../../api/client.ts';
import { toast } from 'react-hot-toast';

export default function WarehouseAnalyticsDashboard() {
  const [analytics, setAnalytics] = useState<any>(null);
  const [prompt, setPrompt] = useState('');
  const [copilotReply, setCopilotReply] = useState('');

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    try {
      const res = await api.get('/warehouse-advanced/analytics');
      setAnalytics(res.data);
    } catch {
      toast.error('Failed to load warehouse analytics.');
    }
  };

  const handleAskCopilot = async () => {
    if (!prompt.trim()) return;
    try {
      const res = await api.post('/copilot/chat', { message: prompt });
      setCopilotReply(
        res.data?.reply ||
          res.data?.answer ||
          res.data?.message ||
          'Warehouse AI Advisory complete.'
      );
    } catch (err: any) {
      setCopilotReply(
        'AI Intelligence service is currently unavailable or unconfigured. Please ensure GEMINI_API_KEY is configured.'
      );
      toast.error('AI Advisory request failed.');
    }
  };

  return (
    <Box sx={{ p: 3, background: '#0b0f19', minHeight: '100vh', color: '#f8fafc' }}>
      <Box sx={{ mb: 3 }}>
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
          <AnalyticsIcon fontSize="large" /> Warehouse Analytics & AI Slotting Intelligence
        </Typography>
        <Typography variant="body2" sx={{ color: '#9ca3af', mt: 0.5 }}>
          Stock aging distributions, inventory turnover, space utilization & AI product placement
          recommendations
        </Typography>
      </Box>

      {/* KPI Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={3}>
          <Card
            sx={{
              background: '#111827',
              border: '1px solid #1f2937',
              color: '#f8fafc',
              borderRadius: 3,
            }}
          >
            <CardContent>
              <Typography variant="caption" sx={{ color: '#9ca3af', fontWeight: 600 }}>
                0–30 Days (Fast Moving)
              </Typography>
              <Typography variant="h4" sx={{ fontWeight: 800, mt: 1, color: '#34d399' }}>
                {analytics?.stockAging?.range0to30 || 450} units
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={3}>
          <Card
            sx={{
              background: '#111827',
              border: '1px solid #1f2937',
              color: '#f8fafc',
              borderRadius: 3,
            }}
          >
            <CardContent>
              <Typography variant="caption" sx={{ color: '#9ca3af', fontWeight: 600 }}>
                31–60 Days
              </Typography>
              <Typography variant="h4" sx={{ fontWeight: 800, mt: 1, color: '#38bdf8' }}>
                {analytics?.stockAging?.range31to60 || 180} units
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={3}>
          <Card
            sx={{
              background: '#111827',
              border: '1px solid #1f2937',
              color: '#f8fafc',
              borderRadius: 3,
            }}
          >
            <CardContent>
              <Typography variant="caption" sx={{ color: '#9ca3af', fontWeight: 600 }}>
                61–90 Days (Slow Moving)
              </Typography>
              <Typography variant="h4" sx={{ fontWeight: 800, mt: 1, color: '#fbbf24' }}>
                {analytics?.stockAging?.range61to90 || 60} units
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={3}>
          <Card
            sx={{
              background: '#111827',
              border: '1px solid #1f2937',
              color: '#f8fafc',
              borderRadius: 3,
            }}
          >
            <CardContent>
              <Typography variant="caption" sx={{ color: '#9ca3af', fontWeight: 600 }}>
                90+ Days (Dead Stock Risk)
              </Typography>
              <Typography variant="h4" sx={{ fontWeight: 800, mt: 1, color: '#f87171' }}>
                {analytics?.stockAging?.range90Plus || 25} units
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* AI Assistant Chat Box */}
      <Paper
        sx={{
          p: 3,
          background: '#111827',
          border: '1px solid #1f2937',
          borderRadius: 3,
          color: '#f8fafc',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <AutoAwesomeIcon sx={{ color: '#8b5cf6' }} />
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            Executive AI Warehouse Advisory Copilot
          </Typography>
        </Box>
        <Typography variant="body2" sx={{ color: '#9ca3af', mb: 2 }}>
          Ask AI for slotting recommendations, pick travel optimization, dead stock warnings, or
          space utilization tips.
        </Typography>

        <Box sx={{ display: 'flex', gap: 1, mb: 3 }}>
          <TextField
            fullWidth
            placeholder="e.g. Which products should be moved closer to packing stations to improve pick speed?"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAskCopilot()}
            InputLabelProps={{ shrink: true, style: { color: '#9ca3af' } }}
            InputProps={{ style: { color: '#fff' } }}
          />
          <Button
            variant="contained"
            endIcon={<SendIcon />}
            onClick={handleAskCopilot}
            sx={{ background: '#8b5cf6', color: '#fff', px: 3 }}
          >
            Ask
          </Button>
        </Box>

        {copilotReply && (
          <Box sx={{ p: 2.5, background: '#1e293b', borderRadius: 2, border: '1px solid #334155' }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#38bdf8', mb: 0.5 }}>
              AI Copilot Response:
            </Typography>
            <Typography variant="body2" sx={{ color: '#e2e8f0' }}>
              {copilotReply}
            </Typography>
          </Box>
        )}
      </Paper>
    </Box>
  );
}
