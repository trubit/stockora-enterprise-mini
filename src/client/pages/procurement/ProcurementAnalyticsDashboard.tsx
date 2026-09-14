import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  Paper,
  Button,
  TextField,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material';
import AIIcon from '@mui/icons-material/AutoAwesome';
import TrendingIcon from '@mui/icons-material/TrendingUp';
import CompareIcon from '@mui/icons-material/CompareArrows';
import { api } from '../../api/client.ts';
import { toast } from 'react-hot-toast';
import { useRegionalSettings } from '../../hooks/useRegionalSettings.js';

export default function ProcurementAnalyticsDashboard() {
  const { formatAmount } = useRegionalSettings();
  const [analytics, setAnalytics] = useState<any>(null);
  const [prompt, setPrompt] = useState('');
  const [copilotReply, setCopilotReply] = useState('');

  const fetchAnalytics = async () => {
    try {
      const res = await api.get('/procurement-advanced/analytics');
      setAnalytics(res.data);
    } catch {
      toast.error('Failed to load procurement analytics.');
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const handleAskCopilot = async () => {
    if (!prompt.trim()) return;
    try {
      const res = await api.post('/copilot/chat', { message: prompt });
      setCopilotReply(
        res.data?.reply || res.data?.answer || res.data?.message || 'Advisory analysis complete.'
      );
    } catch (err: any) {
      setCopilotReply(
        'AI Procurement Intelligence is currently unavailable or unconfigured. Please ensure GEMINI_API_KEY is configured.'
      );
      toast.error('AI Advisory request failed.');
    }
  };

  return (
    <Box sx={{ p: 3, background: '#0b0f19', minHeight: '100vh', color: '#f8fafc' }}>
      <Typography
        variant="h4"
        sx={{
          fontWeight: 800,
          color: '#8b5cf6',
          mb: 1,
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
        }}
      >
        <TrendingIcon fontSize="large" /> Procurement Analytics & Spend Intelligence
      </Typography>
      <Typography variant="body2" sx={{ color: '#9ca3af', mb: 3 }}>
        Supplier spend breakdown, PO cycle times, quality rejection rates, and AI reorder
        recommendations
      </Typography>

      <Grid container spacing={3} sx={{ mb: 3 }}>
        {/* Spend by Supplier Table */}
        <Grid item xs={12} md={7}>
          <Paper
            sx={{
              p: 3,
              background: '#111827',
              border: '1px solid #1f2937',
              borderRadius: 3,
              color: '#f8fafc',
            }}
          >
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 2, color: '#f8fafc' }}>
              Supplier Spend & Performance Metrics
            </Typography>
            <TableContainer>
              <Table size="small">
                <TableHead sx={{ background: '#1f2937' }}>
                  <TableRow>
                    <TableCell sx={{ color: '#9ca3af', fontWeight: 600 }}>Supplier</TableCell>
                    <TableCell sx={{ color: '#9ca3af', fontWeight: 600 }}>Category</TableCell>
                    <TableCell sx={{ color: '#9ca3af', fontWeight: 600 }}>POs</TableCell>
                    <TableCell sx={{ color: '#9ca3af', fontWeight: 600 }}>Total Spend</TableCell>
                    <TableCell sx={{ color: '#9ca3af', fontWeight: 600 }}>Score</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {analytics?.spendBySupplier?.map((s: any) => (
                    <TableRow key={s.supplierId} sx={{ '&:hover': { background: '#1e293b' } }}>
                      <TableCell sx={{ color: '#f8fafc', fontWeight: 600 }}>
                        {s.supplierName}
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={s.category}
                          size="small"
                          sx={{ background: '#374151', color: '#cbd5e1' }}
                        />
                      </TableCell>
                      <TableCell sx={{ color: '#9ca3af' }}>{s.poCount}</TableCell>
                      <TableCell sx={{ color: '#34d399', fontWeight: 700 }}>
                        {formatAmount(s.totalSpend || 0)}
                      </TableCell>
                      <TableCell sx={{ color: '#fbbf24', fontWeight: 700 }}>
                        {s.overallScore}%
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Grid>

        {/* AI Reorder Intelligence */}
        <Grid item xs={12} md={5}>
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
              <CompareIcon sx={{ color: '#fbbf24' }} />
              <Typography variant="h6" sx={{ fontWeight: 700, color: '#f8fafc' }}>
                AI Stockout Risk & Reorder Advisory
              </Typography>
            </Box>
            {analytics?.aiProcurementAdvisory?.reorderRecommendations?.map((r: any) => (
              <Box
                key={r.productId}
                sx={{
                  p: 2,
                  mb: 1.5,
                  borderRadius: 2,
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                }}
              >
                <Typography variant="body2" sx={{ fontWeight: 700, color: '#38bdf8' }}>
                  {r.name} ({r.sku})
                </Typography>
                <Typography variant="caption" sx={{ color: '#94a3b8', display: 'block', mt: 0.5 }}>
                  Current Stock: {r.currentStock} units
                </Typography>
                <Chip
                  label={`Reorder: ${r.recommendedQty} units`}
                  size="small"
                  sx={{
                    mt: 1,
                    background: 'rgba(16, 185, 129, 0.2)',
                    color: '#34d399',
                    fontWeight: 700,
                  }}
                />
              </Box>
            ))}
          </Paper>
        </Grid>
      </Grid>

      {/* AI Procurement Copilot */}
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
          <AIIcon sx={{ color: '#fbbf24' }} />
          <Typography variant="h6" sx={{ fontWeight: 700, color: '#fbbf24' }}>
            Executive AI Procurement Copilot
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
          <TextField
            fullWidth
            placeholder="Ask Copilot: 'Which suppliers are performing poorly?' or 'What products need urgent reorder?'..."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            InputLabelProps={{ style: { color: '#9ca3af' } }}
            InputProps={{ style: { color: '#fff' } }}
          />
          <Button
            variant="contained"
            onClick={handleAskCopilot}
            sx={{ background: '#8b5cf6', color: '#fff', px: 3 }}
          >
            Ask Copilot
          </Button>
        </Box>
        {copilotReply && (
          <Card
            sx={{
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: 2,
            }}
          >
            <CardContent>
              <Typography variant="body2" sx={{ color: '#f8fafc', lineHeight: 1.6 }}>
                {copilotReply}
              </Typography>
            </CardContent>
          </Card>
        )}
      </Paper>
    </Box>
  );
}
