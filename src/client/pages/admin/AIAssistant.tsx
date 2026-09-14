import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../api/client.ts';
import {
  Box,
  Typography,
  Tabs,
  Tab,
  Button,
  TextField,
  Paper,
  Grid,
  Chip,
  Avatar,
  Divider,
  List,
  ListItem,
  ListItemText,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import SendIcon from '@mui/icons-material/Send';
import AnalyticsIcon from '@mui/icons-material/Analytics';
import CostIcon from '@mui/icons-material/MonetizationOn';
import SpeedIcon from '@mui/icons-material/Speed';
import { toast } from 'react-hot-toast';
import { useRegionalSettings } from '../../hooks/useRegionalSettings.js';

interface Message {
  sender: 'USER' | 'ASSISTANT';
  text: string;
  timestamp: string;
}

interface AIUsageSummary {
  providerName: string;
  totalRequests: number;
  totalPromptTokens: number;
  totalCompletionTokens: number;
  totalEstimatedCost: number;
}

interface ForecastingReport {
  totalSalesRevenue: number;
  totalInventoryValue: number;
  fastMovingItems: Array<{
    productId: string;
    name: string;
    quantitySold: number;
    revenue: number;
  }>;
  slowMovingItems: Array<{
    productId: string;
    name: string;
    currentQuantity: number;
    ageInDays: number;
  }>;
  reorderProposals: Array<{
    productId: string;
    name: string;
    currentStock: number;
    limit: number;
    proposedQty: number;
    reason: string;
  }>;
  seasonalTrends: Array<{ period: string; salesCount: number; totalAmount: number }>;
  profitabilityInsights: {
    grossProfit: number;
    marginPercentage: number;
  };
}

const textFieldStyle = { mt: 1 };

export default function AIAssistant() {
  const { formatAmount } = useRegionalSettings();
  const [activeTab, setActiveTab] = useState(0);
  const [prompt, setPrompt] = useState('');
  const [chatHistory, setChatHistory] = useState<Message[]>([
    {
      sender: 'ASSISTANT',
      text: 'Hello! I am your Stockora AI assistant. How can I help you analyze inventory levels, draft replenishment proposals, or optimize store operations today?',
      timestamp: new Date().toLocaleTimeString(),
    },
  ]);

  const queryClient = useQueryClient();

  // Fetch telemetry usage
  const {
    data: usage = {
      providerName: 'Enterprise AI',
      totalRequests: 0,
      totalPromptTokens: 0,
      totalCompletionTokens: 0,
      totalEstimatedCost: 0,
    },
  } = useQuery<AIUsageSummary>({
    queryKey: ['ai-metrics'],
    queryFn: async () => (await apiClient.get('/ai/metrics')).data,
  });

  // Fetch forecasting
  const {
    data: forecast = {
      report: {
        totalSalesRevenue: 0,
        totalInventoryValue: 0,
        fastMovingItems: [],
        slowMovingItems: [],
        reorderProposals: [],
        seasonalTrends: [],
        profitabilityInsights: { grossProfit: 0, marginPercentage: 0 },
      },
      aiForecast: '',
    },
  } = useQuery<{ report: ForecastingReport; aiForecast: string }>({
    queryKey: ['ai-forecasting'],
    queryFn: async () => (await apiClient.get('/ai/forecasting')).data,
  });

  // Chat mutation
  const assistantMutation = useMutation({
    mutationFn: async (inputPrompt: string) => {
      const { data } = await apiClient.post('/ai/assistant', { prompt: inputPrompt });
      return data;
    },
    onSuccess: (data) => {
      setChatHistory((prev) => [
        ...prev,
        {
          sender: 'ASSISTANT',
          text: data.reply,
          timestamp: new Date().toLocaleTimeString(),
        },
      ]);
      queryClient.invalidateQueries({ queryKey: ['ai-metrics'] });
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onError: (err: any) => {
      toast.error(err.response?.data?.error?.message || 'AI assistant request failed.');
    },
  });

  const handleSendPrompt = () => {
    if (!prompt.trim()) return;
    const userPrompt = prompt;
    setChatHistory((prev) => [
      ...prev,
      {
        sender: 'USER',
        text: userPrompt,
        timestamp: new Date().toLocaleTimeString(),
      },
    ]);
    setPrompt('');
    assistantMutation.mutate(userPrompt);
  };

  const handleSuggestedPrompt = (suggestedText: string) => {
    setChatHistory((prev) => [
      ...prev,
      {
        sender: 'USER',
        text: suggestedText,
        timestamp: new Date().toLocaleTimeString(),
      },
    ]);
    assistantMutation.mutate(suggestedText);
  };

  return (
    <Box sx={{ width: '100%' }}>
      <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800 }}>
            AI Intelligence & Forecasting
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Query business analytics, review system generated restock forecasts, and view API costs.
          </Typography>
        </Box>
        <Chip
          icon={<AutoAwesomeIcon sx={{ color: '#fff !important' }} />}
          label={`Engine: ${usage.providerName}`}
          sx={{
            background: 'linear-gradient(90deg, #8b5cf6 0%, #7c3aed 100%)',
            color: '#fff',
            fontWeight: 700,
            px: 1.5,
          }}
        />
      </Box>

      {/* Observability metrics */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={3}>
          <Paper
            className="glass-panel"
            sx={{ p: 2.5, display: 'flex', alignItems: 'center', gap: 2 }}
          >
            <Avatar sx={{ bgcolor: 'rgba(139, 92, 246, 0.1)', color: '#8b5cf6' }}>
              <SpeedIcon />
            </Avatar>
            <Box>
              <Typography variant="caption" color="text.secondary">
                Total AI Queries
              </Typography>
              <Typography variant="h5" sx={{ fontWeight: 800 }}>
                {usage.totalRequests}
              </Typography>
            </Box>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={3}>
          <Paper
            className="glass-panel"
            sx={{ p: 2.5, display: 'flex', alignItems: 'center', gap: 2 }}
          >
            <Avatar sx={{ bgcolor: 'rgba(236, 72, 153, 0.1)', color: '#ec4899' }}>
              <AnalyticsIcon />
            </Avatar>
            <Box>
              <Typography variant="caption" color="text.secondary">
                Prompt Tokens
              </Typography>
              <Typography variant="h5" sx={{ fontWeight: 800 }}>
                {usage.totalPromptTokens.toLocaleString()}
              </Typography>
            </Box>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={3}>
          <Paper
            className="glass-panel"
            sx={{ p: 2.5, display: 'flex', alignItems: 'center', gap: 2 }}
          >
            <Avatar sx={{ bgcolor: 'rgba(16, 185, 129, 0.1)', color: '#10b981' }}>
              <AnalyticsIcon />
            </Avatar>
            <Box>
              <Typography variant="caption" color="text.secondary">
                Completion Tokens
              </Typography>
              <Typography variant="h5" sx={{ fontWeight: 800 }}>
                {usage.totalCompletionTokens.toLocaleString()}
              </Typography>
            </Box>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={3}>
          <Paper
            className="glass-panel"
            sx={{ p: 2.5, display: 'flex', alignItems: 'center', gap: 2 }}
          >
            <Avatar sx={{ bgcolor: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b' }}>
              <CostIcon />
            </Avatar>
            <Box>
              <Typography variant="caption" color="text.secondary">
                Accumulated API Cost
              </Typography>
              <Typography variant="h5" sx={{ fontWeight: 800, color: 'secondary.light' }}>
                {formatAmount(usage.totalEstimatedCost)}
              </Typography>
            </Box>
          </Paper>
        </Grid>
      </Grid>

      <Tabs value={activeTab} onChange={(_, idx) => setActiveTab(idx)} sx={{ mb: 3 }}>
        <Tab label="Interactive Assistant" />
        <Tab label="AI Strategies & Forecasts" />
        <Tab label="Inventory proposals" />
      </Tabs>

      {/* Tab 0: Interactive Assistant */}
      {activeTab === 0 && (
        <Grid container spacing={3}>
          <Grid item xs={12} md={8}>
            <Paper
              className="glass-panel"
              sx={{ p: 3, height: '500px', display: 'flex', flexDirection: 'column' }}
            >
              <Box
                sx={{
                  flexGrow: 1,
                  overflowY: 'auto',
                  mb: 2,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 2,
                  pr: 1,
                }}
              >
                {chatHistory.map((msg, idx) => (
                  <Box
                    key={idx}
                    sx={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: msg.sender === 'USER' ? 'flex-end' : 'flex-start',
                    }}
                  >
                    <Box
                      sx={{
                        p: 2,
                        borderRadius: 2,
                        maxWidth: '85%',
                        bgcolor:
                          msg.sender === 'USER'
                            ? 'rgba(139, 92, 246, 0.15)'
                            : 'rgba(255,255,255,0.03)',
                        border:
                          msg.sender === 'USER'
                            ? '1px solid rgba(139, 92, 246, 0.3)'
                            : '1px solid rgba(255,255,255,0.05)',
                      }}
                    >
                      <Typography variant="body2" sx={{ whiteSpace: 'pre-line', lineHeight: 1.5 }}>
                        {msg.text}
                      </Typography>
                    </Box>
                    <Typography variant="caption" color="text.disabled" sx={{ mt: 0.5, mx: 1 }}>
                      {msg.sender === 'USER' ? 'You' : 'Assistant'} • {msg.timestamp}
                    </Typography>
                  </Box>
                ))}
                {assistantMutation.isPending && (
                  <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', ml: 1 }}>
                    <Chip label="Thinking..." variant="outlined" size="small" />
                  </Box>
                )}
              </Box>
              <Divider sx={{ opacity: 0.1, mb: 2 }} />
              <Box sx={{ display: 'flex', gap: 1.5 }}>
                <TextField
                  placeholder="Ask Assistant (e.g. Generate reorder suggestions)..."
                  fullWidth
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendPrompt()}
                  sx={textFieldStyle}
                />
                <Button
                  variant="contained"
                  onClick={handleSendPrompt}
                  disabled={assistantMutation.isPending}
                  sx={{
                    background: 'linear-gradient(90deg, #8b5cf6 0%, #7c3aed 100%)',
                    height: '56px',
                    mt: 1,
                  }}
                >
                  <SendIcon />
                </Button>
              </Box>
            </Paper>
          </Grid>
          <Grid item xs={12} md={4}>
            <Paper className="glass-panel" sx={{ p: 3, height: '100%' }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 750, mb: 2 }}>
                Quick Inquiries Suggestions
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={() => handleSuggestedPrompt('Generate low stock reorder proposals.')}
                  sx={{ justifyContent: 'flex-start', textAlign: 'left' }}
                >
                  🔍 Scan & reorder proposals
                </Button>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={() =>
                    handleSuggestedPrompt('Analyze inventory turnover and fast moving items.')
                  }
                  sx={{ justifyContent: 'flex-start', textAlign: 'left' }}
                >
                  📈 Turnover analysis
                </Button>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={() =>
                    handleSuggestedPrompt('Summarize margin optimizations and profit limits.')
                  }
                  sx={{ justifyContent: 'flex-start', textAlign: 'left' }}
                >
                  💰 Margin optimizations
                </Button>
              </Box>
            </Paper>
          </Grid>
        </Grid>
      )}

      {/* Tab 1: AI Strategies & Forecasts */}
      {activeTab === 1 && (
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Paper className="glass-panel" sx={{ p: 3, height: '100%' }}>
              <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
                Executive Intelligence Report
              </Typography>
              <Typography
                variant="body2"
                sx={{ whiteSpace: 'pre-line', lineHeight: 1.6, color: 'text.secondary' }}
              >
                {forecast.aiForecast || 'Executive forecasts compiling from analytical logs...'}
              </Typography>
            </Paper>
          </Grid>
          <Grid item xs={12} md={6}>
            <Grid container spacing={3}>
              <Grid item xs={12}>
                <Paper className="glass-panel" sx={{ p: 3 }}>
                  <Typography variant="h6" sx={{ fontWeight: 700, mb: 1.5 }}>
                    Turnover Performance
                  </Typography>
                  <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 700 }}>
                    Fast Moving Items
                  </Typography>
                  <List>
                    {forecast.report.fastMovingItems.map((f, idx) => (
                      <ListItem key={idx} sx={{ p: 0.5 }}>
                        <ListItemText
                          primary={f.name}
                          secondary={`Sold: ${f.quantitySold} units • Total Revenue: ${formatAmount(f.revenue)}`}
                        />
                      </ListItem>
                    ))}
                  </List>
                  <Divider sx={{ my: 1.5, opacity: 0.05 }} />
                  <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 700 }}>
                    Slow Moving / Aging Stock
                  </Typography>
                  <List>
                    {forecast.report.slowMovingItems.map((s, idx) => (
                      <ListItem key={idx} sx={{ p: 0.5 }}>
                        <ListItemText
                          primary={s.name}
                          secondary={`Stock: ${s.currentQuantity} • Unchanged: ${s.ageInDays} days`}
                        />
                      </ListItem>
                    ))}
                  </List>
                </Paper>
              </Grid>
            </Grid>
          </Grid>
        </Grid>
      )}

      {/* Tab 2: Inventory Proposals */}
      {activeTab === 2 && (
        <TableContainer component={Paper} className="glass-panel">
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Product Name</TableCell>
                <TableCell>Current Stock</TableCell>
                <TableCell>Threshold Limit</TableCell>
                <TableCell>Proposed Reorder Qty</TableCell>
                <TableCell>Replenishment Reason</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {forecast.report.reorderProposals.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} align="center">
                    All inventory catalog assets fully stocked above thresholds.
                  </TableCell>
                </TableRow>
              ) : (
                forecast.report.reorderProposals.map((p, idx) => (
                  <TableRow key={idx}>
                    <TableCell sx={{ fontWeight: 700 }}>{p.name}</TableCell>
                    <TableCell>{p.currentStock} units</TableCell>
                    <TableCell>{p.limit} units</TableCell>
                    <TableCell sx={{ fontWeight: 750, color: 'secondary.light' }}>
                      {p.proposedQty} units
                    </TableCell>
                    <TableCell>
                      <Chip label={p.reason} color="error" size="small" variant="outlined" />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
}
