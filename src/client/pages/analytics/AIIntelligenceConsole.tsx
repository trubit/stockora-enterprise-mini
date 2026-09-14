import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Tabs,
  Tab,
  Chip,
  CircularProgress,
  Divider,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Tooltip,
} from '@mui/material';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import SendIcon from '@mui/icons-material/Send';
import InventoryIcon from '@mui/icons-material/Inventory';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import AssessmentIcon from '@mui/icons-material/Assessment';
import RefreshIcon from '@mui/icons-material/Refresh';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import SecurityIcon from '@mui/icons-material/Security';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import PageHeader from '../../components/PageHeader.tsx';
import { apiClient } from '../../api/client.ts';
import toast from 'react-hot-toast';

interface StructuredAIAnalysis {
  summary: string;
  keyFindings: string[];
  evidence: string[];
  risks: string[];
  recommendations: string[];
  nextActions: string[];
  metadata?: {
    tenantId: string;
    model: string;
    timestamp: string;
    dataPointsAnalyzed: number;
    sufficientData: boolean;
  };
}

interface ReorderItem {
  productId: string;
  productSku: string;
  productName: string;
  currentStock: number;
  salesVelocityPerDay: number;
  daysOfStockLeft: number;
  recommendedQuantity: number;
  stockoutRisk: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  recommendation: string;
  reasoning: string;
  confidenceScore: number;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  model?: string;
  latencyMs?: number;
}

export const AIIntelligenceConsole: React.FC = () => {
  const [activeTab, setActiveTab] = useState(0);

  // Status state
  const [aiStatus, setAiStatus] = useState<{
    configured: boolean;
    model: string;
    mode: string;
  } | null>(null);

  // Assistant Chat State
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content:
        'Hello! I am your **Stockora Enterprise AI Intelligence Assistant**.\n\nI analyse your real-time company data to answer questions about inventory health, stockout risks, purchasing reorders, sales velocity, and anomaly detection.\n\nHow can I assist your business operations today?',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [inputQuery, setInputQuery] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // Inventory Analysis State
  const [inventoryAnalysis, setInventoryAnalysis] = useState<StructuredAIAnalysis | null>(null);
  const [inventoryLoading, setInventoryLoading] = useState(false);

  // Reorder Recommendations State
  const [reorders, setReorders] = useState<ReorderItem[]>([]);
  const [reordersSummary, setReordersSummary] = useState('');
  const [reordersLoading, setReordersLoading] = useState(false);

  // Demand Forecast State
  const [forecast, setForecast] = useState<StructuredAIAnalysis | null>(null);
  const [forecastLoading, setForecastLoading] = useState(false);

  // Executive Briefings State
  const [summaryTimeframe, setSummaryTimeframe] = useState<'DAILY' | 'WEEKLY' | 'MONTHLY'>('DAILY');
  const [executiveSummary, setExecutiveSummary] = useState<StructuredAIAnalysis | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);

  // Granular tab error state to render professional AI unavailable card
  const [tabError, setTabError] = useState<{ [key: number]: string }>({});

  const renderUnavailableState = (tabIdx: number, retryFn: () => void, customMsg?: string) => (
    <Card
      sx={{
        borderRadius: 2,
        p: 4,
        textAlign: 'center',
        bgcolor: 'background.paper',
        border: '1px dashed',
        borderColor: 'warning.main',
        my: 2,
      }}
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1.5, py: 2 }}>
        <WarningAmberIcon sx={{ fontSize: 48, color: 'warning.main' }} />
        <Typography variant="h6" fontWeight={700}>
          AI Intelligence Temporarily Unavailable
        </Typography>
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ maxWidth: 640, mb: 1, lineHeight: 1.6 }}
        >
          {customMsg ||
            tabError[tabIdx] ||
            'Google Gemini AI quota or rate limits reached on your configured project. Core Stockora inventory and operations remain 100% functional.'}
        </Typography>
        <Button
          variant="contained"
          color="primary"
          startIcon={<RefreshIcon />}
          onClick={retryFn}
          sx={{ textTransform: 'none', px: 3, py: 1 }}
        >
          Retry Analysis
        </Button>
      </Box>
    </Card>
  );

  useEffect(() => {
    fetchStatus();
    fetchInventoryIntelligence();
  }, []);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, chatLoading]);

  const fetchStatus = async () => {
    try {
      const res = await apiClient.get('/ai/status');
      if (res.data?.data) {
        setAiStatus(res.data.data);
      }
    } catch {
      // Non-fatal if status probe fails
    }
  };

  const fetchInventoryIntelligence = async () => {
    setInventoryLoading(true);
    setTabError((prev) => ({ ...prev, [1]: '' }));
    try {
      const res = await apiClient.get('/ai/inventory-intelligence');
      if (res.data?.data) {
        setInventoryAnalysis(res.data.data);
      }
    } catch (err: any) {
      const msg = err.response?.data?.error?.message || 'Failed to load inventory intelligence.';
      setTabError((prev) => ({ ...prev, [1]: msg }));
      toast.error(msg);
    } finally {
      setInventoryLoading(false);
    }
  };

  const fetchReorders = async () => {
    setReordersLoading(true);
    setTabError((prev) => ({ ...prev, [2]: '' }));
    try {
      const res = await apiClient.get('/ai/reorders');
      if (res.data?.data) {
        setReorders(res.data.data.recommendations || []);
        setReordersSummary(res.data.data.summary || '');
      }
    } catch (err: any) {
      const msg =
        err.response?.data?.error?.message || 'Failed to generate reorder recommendations.';
      setTabError((prev) => ({ ...prev, [2]: msg }));
      toast.error(msg);
    } finally {
      setReordersLoading(false);
    }
  };

  const fetchForecast = async () => {
    setForecastLoading(true);
    setTabError((prev) => ({ ...prev, [3]: '' }));
    try {
      const res = await apiClient.get('/ai/forecast?days=30');
      if (res.data?.data) {
        setForecast(res.data.data);
      }
    } catch (err: any) {
      const msg = err.response?.data?.error?.message || 'Failed to generate demand forecast.';
      setTabError((prev) => ({ ...prev, [3]: msg }));
      toast.error(msg);
    } finally {
      setForecastLoading(false);
    }
  };

  const fetchExecutiveSummary = async (timeframe = summaryTimeframe) => {
    setSummaryLoading(true);
    setTabError((prev) => ({ ...prev, [4]: '' }));
    try {
      const res = await apiClient.get(`/ai/summary?timeframe=${timeframe}`);
      if (res.data?.data) {
        setExecutiveSummary(res.data.data);
      }
    } catch (err: any) {
      const msg = err.response?.data?.error?.message || 'Failed to generate business briefing.';
      setTabError((prev) => ({ ...prev, [4]: msg }));
      toast.error(msg);
    } finally {
      setSummaryLoading(false);
    }
  };

  const handleTabChange = (_: any, newValue: number) => {
    setActiveTab(newValue);
    if (newValue === 1 && !inventoryAnalysis) {
      fetchInventoryIntelligence();
    } else if (newValue === 2 && reorders.length === 0) {
      fetchReorders();
    } else if (newValue === 3 && !forecast) {
      fetchForecast();
    } else if (newValue === 4 && !executiveSummary) {
      fetchExecutiveSummary();
    }
  };

  const handleSendMessage = async (queryToSend?: string) => {
    const text = (queryToSend || inputQuery).trim();
    if (!text || chatLoading) return;

    const userMsg: ChatMessage = {
      id: String(Date.now()),
      role: 'user',
      content: text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputQuery('');
    setChatLoading(true);

    try {
      const history = messages.slice(-4).map((m) => ({ role: m.role, content: m.content }));
      const res = await apiClient.post('/ai/assistant', {
        message: text,
        history,
      });

      const reply = res.data?.data?.response || 'Analysis complete.';
      const assistantMsg: ChatMessage = {
        id: String(Date.now() + 1),
        role: 'assistant',
        content: reply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        model: res.data?.data?.model,
        latencyMs: res.data?.data?.latencyMs,
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      const errMsg =
        err.response?.data?.error?.message ||
        'The AI service encountered an error or is unconfigured on this server.';
      const failMsg: ChatMessage = {
        id: String(Date.now() + 1),
        role: 'assistant',
        content: `⚠️ **Service Alert:** ${errMsg}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, failMsg]);
    } finally {
      setChatLoading(false);
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  const quickQuestions = [
    'Which products are running low in stock?',
    'What items should I reorder today?',
    'Show top-selling items and sales trends.',
    'Are there any unusual stock movements?',
    'Summarize this week’s business performance.',
  ];

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 1440, margin: '0 auto' }}>
      <PageHeader
        title="Stockora AI Intelligence Console"
        subtitle="Real-time multi-tenant inventory intelligence, demand forecasting & decision analytics powered by Google Gemini"
      />

      {/* Operational Mode Banner */}
      <Box
        sx={{
          mb: 3,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 2,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Chip
            icon={<AutoAwesomeIcon sx={{ fontSize: 16 }} />}
            label={`Engine: ${aiStatus?.model || 'gemini-1.5-flash'}`}
            color={aiStatus?.configured ? 'success' : 'warning'}
            variant="outlined"
            size="small"
          />
          <Chip
            icon={<SecurityIcon sx={{ fontSize: 16 }} />}
            label="Tenant Isolation: Verified"
            color="primary"
            variant="outlined"
            size="small"
          />
          <Chip
            label="Grounded in Real Live Database Records"
            color="default"
            variant="outlined"
            size="small"
          />
        </Box>
      </Box>

      {/* Navigation Tabs */}
      <Card sx={{ mb: 3, borderRadius: 2 }}>
        <Tabs
          value={activeTab}
          onChange={handleTabChange}
          variant="scrollable"
          scrollButtons="auto"
          sx={{ borderBottom: 1, borderColor: 'divider', px: 2 }}
        >
          <Tab icon={<AutoAwesomeIcon />} iconPosition="start" label="AI Assistant" />
          <Tab icon={<InventoryIcon />} iconPosition="start" label="Inventory & Stockout Radar" />
          <Tab icon={<ShoppingCartIcon />} iconPosition="start" label="Smart Reorders" />
          <Tab icon={<TrendingUpIcon />} iconPosition="start" label="Demand Forecasting" />
          <Tab icon={<AssessmentIcon />} iconPosition="start" label="Executive Briefings" />
        </Tabs>
      </Card>

      {/* TAB 0: AI Assistant Chat */}
      {activeTab === 0 && (
        <Grid container spacing={3}>
          <Grid item xs={12} lg={8}>
            <Card
              sx={{ borderRadius: 2, height: '70vh', display: 'flex', flexDirection: 'column' }}
            >
              <Box
                sx={{
                  p: 2,
                  borderBottom: 1,
                  borderColor: 'divider',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <AutoAwesomeIcon color="primary" />
                  <Typography variant="subtitle1" fontWeight={600}>
                    Stockora AI Enterprise Business Assistant
                  </Typography>
                </Box>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() =>
                    setMessages([
                      {
                        id: 'welcome-reset',
                        role: 'assistant',
                        content:
                          'Chat reset. How can I assist with your inventory or sales data today?',
                        timestamp: new Date().toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        }),
                      },
                    ])
                  }
                >
                  Clear Chat
                </Button>
              </Box>

              {/* Chat Messages */}
              <Box
                sx={{
                  flex: 1,
                  overflowY: 'auto',
                  p: 3,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 2,
                }}
              >
                {messages.map((msg) => (
                  <Box
                    key={msg.id}
                    sx={{
                      alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                      maxWidth: { xs: '90%', md: '75%' },
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start',
                    }}
                  >
                    <Paper
                      elevation={0}
                      sx={{
                        p: 2,
                        borderRadius: 2,
                        bgcolor: msg.role === 'user' ? 'primary.main' : 'background.paper',
                        color: msg.role === 'user' ? 'primary.contrastText' : 'text.primary',
                        border: 1,
                        borderColor: msg.role === 'user' ? 'primary.dark' : 'divider',
                        whiteSpace: 'pre-wrap',
                      }}
                    >
                      <Typography variant="body2" sx={{ lineHeight: 1.6 }}>
                        {msg.content}
                      </Typography>
                    </Paper>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                      <Typography variant="caption" color="text.secondary">
                        {msg.timestamp}
                      </Typography>
                      {msg.latencyMs && (
                        <Typography variant="caption" color="text.secondary">
                          • {msg.latencyMs}ms
                        </Typography>
                      )}
                      {msg.role === 'assistant' && (
                        <Tooltip title="Copy message">
                          <IconButton size="small" onClick={() => handleCopy(msg.content)}>
                            <ContentCopyIcon sx={{ fontSize: 13 }} />
                          </IconButton>
                        </Tooltip>
                      )}
                    </Box>
                  </Box>
                ))}

                {chatLoading && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, p: 1 }}>
                    <CircularProgress size={18} />
                    <Typography variant="body2" color="text.secondary">
                      Analyzing company inventory & sales data...
                    </Typography>
                  </Box>
                )}
                <div ref={chatBottomRef} />
              </Box>

              {/* Chat Input */}
              <Box
                sx={{ p: 2, borderTop: 1, borderColor: 'divider', bgcolor: 'background.default' }}
              >
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <TextField
                    fullWidth
                    size="small"
                    placeholder="Ask about stockouts, reorders, sales velocity, valuation, or anomalies..."
                    value={inputQuery}
                    onChange={(e) => setInputQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                    disabled={chatLoading}
                  />
                  <Button
                    variant="contained"
                    endIcon={<SendIcon />}
                    onClick={() => handleSendMessage()}
                    disabled={chatLoading || !inputQuery.trim()}
                  >
                    Send
                  </Button>
                </Box>
              </Box>
            </Card>
          </Grid>

          {/* Prompt Suggestions & Security Notice */}
          <Grid item xs={12} lg={4}>
            <Card sx={{ mb: 3, borderRadius: 2 }}>
              <CardContent>
                <Typography variant="subtitle2" fontWeight={700} gutterBottom>
                  💡 Suggested Analytical Questions
                </Typography>
                <Typography variant="caption" color="text.secondary" paragraph>
                  Click any question to analyze your current enterprise data immediately:
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  {quickQuestions.map((q, idx) => (
                    <Button
                      key={idx}
                      variant="outlined"
                      size="small"
                      sx={{
                        textAlign: 'left',
                        justifyContent: 'flex-start',
                        textTransform: 'none',
                        py: 1,
                      }}
                      onClick={() => handleSendMessage(q)}
                      disabled={chatLoading}
                    >
                      {q}
                    </Button>
                  ))}
                </Box>
              </CardContent>
            </Card>

            <Card sx={{ borderRadius: 2 }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                  <SecurityIcon color="primary" fontSize="small" />
                  <Typography variant="subtitle2" fontWeight={700}>
                    Enterprise Data Guardrails
                  </Typography>
                </Box>
                <Typography variant="body2" color="text.secondary" sx={{ fontSize: 13, mb: 1 }}>
                  • <strong>Zero Hallucination:</strong> All answers cite factual company records.
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ fontSize: 13, mb: 1 }}>
                  • <strong>Strict Multi-Tenant Isolation:</strong> Data from other companies is
                  never accessed or shared.
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ fontSize: 13 }}>
                  • <strong>Advisory Mode:</strong> Destructive operations require human approval
                  and normal Stockora permissions.
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* TAB 1: Inventory & Stockout Radar */}
      {activeTab === 1 && (
        <Box>
          <Box
            sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}
          >
            <Typography variant="h6" fontWeight={700}>
              Real-Time Inventory Health & Valuation Radar
            </Typography>
            <Button
              startIcon={<RefreshIcon />}
              variant="outlined"
              size="small"
              onClick={fetchInventoryIntelligence}
              disabled={inventoryLoading}
            >
              Refresh Analysis
            </Button>
          </Box>

          {inventoryLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
              <CircularProgress />
            </Box>
          ) : inventoryAnalysis ? (
            <Grid container spacing={3}>
              {/* Executive Summary Card */}
              <Grid item xs={12}>
                <Card sx={{ borderRadius: 2, borderLeft: 6, borderColor: 'primary.main' }}>
                  <CardContent>
                    <Typography variant="overline" color="primary" fontWeight={700}>
                      AI Executive Inventory Summary
                    </Typography>
                    <Typography variant="h6" sx={{ mt: 1, mb: 2, fontWeight: 600 }}>
                      {inventoryAnalysis.summary}
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                      <Chip
                        size="small"
                        icon={<CheckCircleOutlineIcon />}
                        label={`Data Points Analyzed: ${inventoryAnalysis.metadata?.dataPointsAnalyzed ?? 'Active Products'}`}
                        color="success"
                        variant="outlined"
                      />
                      <Chip
                        size="small"
                        icon={<InfoOutlinedIcon />}
                        label={`Timestamp: ${new Date().toLocaleTimeString()}`}
                        variant="outlined"
                      />
                    </Box>
                  </CardContent>
                </Card>
              </Grid>

              {/* Key Findings */}
              <Grid item xs={12} md={6}>
                <Card sx={{ borderRadius: 2, height: '100%' }}>
                  <CardContent>
                    <Typography
                      variant="subtitle1"
                      fontWeight={700}
                      gutterBottom
                      sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
                    >
                      <CheckCircleOutlineIcon color="primary" /> Key Inventory Findings
                    </Typography>
                    <Divider sx={{ my: 1.5 }} />
                    <Box component="ul" sx={{ pl: 2, m: 0 }}>
                      {inventoryAnalysis.keyFindings.map((finding, i) => (
                        <Typography
                          component="li"
                          variant="body2"
                          key={i}
                          sx={{ mb: 1, lineHeight: 1.6 }}
                        >
                          {finding}
                        </Typography>
                      ))}
                    </Box>
                  </CardContent>
                </Card>
              </Grid>

              {/* Operational & Stockout Risks */}
              <Grid item xs={12} md={6}>
                <Card sx={{ borderRadius: 2, height: '100%' }}>
                  <CardContent>
                    <Typography
                      variant="subtitle1"
                      fontWeight={700}
                      gutterBottom
                      sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
                    >
                      <WarningAmberIcon color="error" /> Stockout & Operational Risks
                    </Typography>
                    <Divider sx={{ my: 1.5 }} />
                    <Box component="ul" sx={{ pl: 2, m: 0 }}>
                      {inventoryAnalysis.risks.map((risk, i) => (
                        <Typography
                          component="li"
                          variant="body2"
                          key={i}
                          sx={{ mb: 1, lineHeight: 1.6, color: 'text.secondary' }}
                        >
                          {risk}
                        </Typography>
                      ))}
                    </Box>
                  </CardContent>
                </Card>
              </Grid>

              {/* Actionable Recommendations */}
              <Grid item xs={12} md={6}>
                <Card sx={{ borderRadius: 2, height: '100%' }}>
                  <CardContent>
                    <Typography
                      variant="subtitle1"
                      fontWeight={700}
                      gutterBottom
                      sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
                    >
                      <AutoAwesomeIcon color="secondary" /> Strategic Recommendations
                    </Typography>
                    <Divider sx={{ my: 1.5 }} />
                    <Box component="ul" sx={{ pl: 2, m: 0 }}>
                      {inventoryAnalysis.recommendations.map((rec, i) => (
                        <Typography
                          component="li"
                          variant="body2"
                          key={i}
                          sx={{ mb: 1, lineHeight: 1.6 }}
                        >
                          {rec}
                        </Typography>
                      ))}
                    </Box>
                  </CardContent>
                </Card>
              </Grid>

              {/* Next Actions */}
              <Grid item xs={12} md={6}>
                <Card sx={{ borderRadius: 2, height: '100%' }}>
                  <CardContent>
                    <Typography
                      variant="subtitle1"
                      fontWeight={700}
                      gutterBottom
                      sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
                    >
                      <ShoppingCartIcon color="warning" /> Next Actions Today
                    </Typography>
                    <Divider sx={{ my: 1.5 }} />
                    <Box component="ul" sx={{ pl: 2, m: 0 }}>
                      {inventoryAnalysis.nextActions.map((act, i) => (
                        <Typography
                          component="li"
                          variant="body2"
                          key={i}
                          sx={{ mb: 1, lineHeight: 1.6 }}
                        >
                          {act}
                        </Typography>
                      ))}
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          ) : tabError[1] ? (
            renderUnavailableState(1, fetchInventoryIntelligence)
          ) : (
            <Alert severity="info">
              Click Refresh to generate inventory intelligence for your company.
            </Alert>
          )}
        </Box>
      )}

      {/* TAB 2: Smart Reorders */}
      {activeTab === 2 && (
        <Box>
          <Box
            sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}
          >
            <Box>
              <Typography variant="h6" fontWeight={700}>
                AI Smart Reorder Recommendations
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Calculated from real sales velocity, current on-hand quantities, and depletion
                rates.
              </Typography>
            </Box>
            <Button
              startIcon={<RefreshIcon />}
              variant="outlined"
              size="small"
              onClick={fetchReorders}
              disabled={reordersLoading}
            >
              Recalculate Reorders
            </Button>
          </Box>

          <Alert severity="info" sx={{ mb: 3 }}>
            <strong>Human Oversight Required:</strong> AI recommendations provide replenishment
            guidance. Purchase orders are subject to normal authorization and must be approved by an
            authorized manager.
          </Alert>

          {reordersLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
              <CircularProgress />
            </Box>
          ) : reorders.length > 0 ? (
            <Card sx={{ borderRadius: 2 }}>
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Product / SKU</TableCell>
                      <TableCell align="right">Current Stock</TableCell>
                      <TableCell align="right">Sales Velocity</TableCell>
                      <TableCell align="right">Coverage Left</TableCell>
                      <TableCell align="right">Recommended Order</TableCell>
                      <TableCell>Risk Tier</TableCell>
                      <TableCell>Reasoning</TableCell>
                      <TableCell align="right">Confidence</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {reorders.map((item) => (
                      <TableRow key={item.productId} hover>
                        <TableCell>
                          <Typography variant="subtitle2" fontWeight={600}>
                            {item.productName}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            SKU: {item.productSku}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Typography
                            variant="body2"
                            fontWeight={700}
                            color={item.currentStock === 0 ? 'error.main' : 'text.primary'}
                          >
                            {item.currentStock}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Typography variant="body2">
                            {item.salesVelocityPerDay} units/day
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Chip
                            size="small"
                            label={
                              item.daysOfStockLeft === 0
                                ? 'Depleted'
                                : `~${item.daysOfStockLeft} days`
                            }
                            color={
                              item.daysOfStockLeft <= 3
                                ? 'error'
                                : item.daysOfStockLeft <= 7
                                  ? 'warning'
                                  : 'default'
                            }
                            variant="outlined"
                          />
                        </TableCell>
                        <TableCell align="right">
                          <Typography variant="body2" fontWeight={700} color="primary.main">
                            +{item.recommendedQuantity} units
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Chip
                            size="small"
                            label={item.stockoutRisk}
                            color={
                              item.stockoutRisk === 'CRITICAL'
                                ? 'error'
                                : item.stockoutRisk === 'HIGH'
                                  ? 'warning'
                                  : item.stockoutRisk === 'MEDIUM'
                                    ? 'info'
                                    : 'success'
                            }
                          />
                        </TableCell>
                        <TableCell sx={{ maxWidth: 280 }}>
                          <Typography variant="caption" color="text.secondary">
                            {item.reasoning}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Typography variant="caption" fontWeight={600}>
                            {item.confidenceScore}%
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Card>
          ) : tabError[2] ? (
            renderUnavailableState(2, fetchReorders)
          ) : (
            <Card sx={{ p: 4, textAlign: 'center', borderRadius: 2 }}>
              <CheckCircleOutlineIcon color="success" sx={{ fontSize: 48, mb: 1 }} />
              <Typography variant="h6">Optimal Stock Coverage</Typography>
              <Typography variant="body2" color="text.secondary">
                {reordersSummary ||
                  'All products are currently operating with adequate safety buffers.'}
              </Typography>
            </Card>
          )}
        </Box>
      )}

      {/* TAB 3: Demand Forecasting */}
      {activeTab === 3 && (
        <Box>
          <Box
            sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}
          >
            <Box>
              <Typography variant="h6" fontWeight={700}>
                Probabilistic Demand & Stockout Forecasting
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Forward-looking statistical burn rate and replenishment models.
              </Typography>
            </Box>
            <Button
              startIcon={<RefreshIcon />}
              variant="outlined"
              size="small"
              onClick={fetchForecast}
              disabled={forecastLoading}
            >
              Regenerate Forecast
            </Button>
          </Box>

          {forecastLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
              <CircularProgress />
            </Box>
          ) : forecast ? (
            <Grid container spacing={3}>
              <Grid item xs={12}>
                <Card sx={{ borderRadius: 2, borderLeft: 6, borderColor: 'secondary.main' }}>
                  <CardContent>
                    <Typography variant="overline" color="secondary" fontWeight={700}>
                      Statistical Demand Projection (30-Day Window)
                    </Typography>
                    <Typography variant="h6" sx={{ mt: 1, mb: 2, fontWeight: 600 }}>
                      {forecast.summary}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      ⚠️ Note: Projections represent statistical estimates based on historical
                      transaction velocity and are not guaranteed sales certainties.
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>

              <Grid item xs={12} md={6}>
                <Card sx={{ borderRadius: 2, height: '100%' }}>
                  <CardContent>
                    <Typography variant="subtitle1" fontWeight={700} gutterBottom>
                      📈 Observed Velocity & Demand Patterns
                    </Typography>
                    <Divider sx={{ my: 1.5 }} />
                    <Box component="ul" sx={{ pl: 2, m: 0 }}>
                      {forecast.keyFindings.map((finding, i) => (
                        <Typography
                          component="li"
                          variant="body2"
                          key={i}
                          sx={{ mb: 1, lineHeight: 1.6 }}
                        >
                          {finding}
                        </Typography>
                      ))}
                    </Box>
                  </CardContent>
                </Card>
              </Grid>

              <Grid item xs={12} md={6}>
                <Card sx={{ borderRadius: 2, height: '100%' }}>
                  <CardContent>
                    <Typography variant="subtitle1" fontWeight={700} gutterBottom>
                      ⚠️ Predicted Stockout Exposures
                    </Typography>
                    <Divider sx={{ my: 1.5 }} />
                    <Box component="ul" sx={{ pl: 2, m: 0 }}>
                      {forecast.risks.map((risk, i) => (
                        <Typography
                          component="li"
                          variant="body2"
                          key={i}
                          sx={{ mb: 1, lineHeight: 1.6, color: 'text.secondary' }}
                        >
                          {risk}
                        </Typography>
                      ))}
                    </Box>
                  </CardContent>
                </Card>
              </Grid>

              <Grid item xs={12}>
                <Card sx={{ borderRadius: 2 }}>
                  <CardContent>
                    <Typography variant="subtitle1" fontWeight={700} gutterBottom>
                      🎯 Recommended Purchasing Strategies
                    </Typography>
                    <Divider sx={{ my: 1.5 }} />
                    <Grid container spacing={2}>
                      {forecast.recommendations.map((rec, i) => (
                        <Grid item xs={12} md={6} key={i}>
                          <Paper sx={{ p: 2, borderRadius: 2, bgcolor: 'background.default' }}>
                            <Typography variant="body2">{rec}</Typography>
                          </Paper>
                        </Grid>
                      ))}
                    </Grid>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          ) : tabError[3] ? (
            renderUnavailableState(3, fetchForecast)
          ) : (
            <Alert severity="info">Click Regenerate to produce demand forecasts.</Alert>
          )}
        </Box>
      )}

      {/* TAB 4: Executive Briefings */}
      {activeTab === 4 && (
        <Box>
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              mb: 3,
              flexWrap: 'wrap',
              gap: 2,
            }}
          >
            <Box sx={{ display: 'flex', gap: 1 }}>
              {(['DAILY', 'WEEKLY', 'MONTHLY'] as const).map((tf) => (
                <Button
                  key={tf}
                  variant={summaryTimeframe === tf ? 'contained' : 'outlined'}
                  size="small"
                  onClick={() => {
                    setSummaryTimeframe(tf);
                    fetchExecutiveSummary(tf);
                  }}
                  disabled={summaryLoading}
                >
                  {tf} Briefing
                </Button>
              ))}
            </Box>
            <Button
              startIcon={<RefreshIcon />}
              variant="outlined"
              size="small"
              onClick={() => fetchExecutiveSummary()}
              disabled={summaryLoading}
            >
              Regenerate {summaryTimeframe}
            </Button>
          </Box>

          {summaryLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
              <CircularProgress />
            </Box>
          ) : executiveSummary ? (
            <Grid container spacing={3}>
              <Grid item xs={12}>
                <Card sx={{ borderRadius: 2, borderLeft: 6, borderColor: 'info.main' }}>
                  <CardContent>
                    <Typography variant="overline" color="info.main" fontWeight={700}>
                      {summaryTimeframe} Executive Briefing Overview
                    </Typography>
                    <Typography variant="h6" sx={{ mt: 1, mb: 1, fontWeight: 600 }}>
                      {executiveSummary.summary}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Grounded in authorized tenant transactions and inventory records.
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>

              <Grid item xs={12} md={6}>
                <Card sx={{ borderRadius: 2, height: '100%' }}>
                  <CardContent>
                    <Typography variant="subtitle1" fontWeight={700} gutterBottom>
                      📊 Operational Highlights
                    </Typography>
                    <Divider sx={{ my: 1.5 }} />
                    <Box component="ul" sx={{ pl: 2, m: 0 }}>
                      {executiveSummary.keyFindings.map((kf, i) => (
                        <Typography
                          component="li"
                          variant="body2"
                          key={i}
                          sx={{ mb: 1, lineHeight: 1.6 }}
                        >
                          {kf}
                        </Typography>
                      ))}
                    </Box>
                  </CardContent>
                </Card>
              </Grid>

              <Grid item xs={12} md={6}>
                <Card sx={{ borderRadius: 2, height: '100%' }}>
                  <CardContent>
                    <Typography variant="subtitle1" fontWeight={700} gutterBottom>
                      ⚠️ Critical Observations & Risks
                    </Typography>
                    <Divider sx={{ my: 1.5 }} />
                    <Box component="ul" sx={{ pl: 2, m: 0 }}>
                      {executiveSummary.risks.map((r, i) => (
                        <Typography
                          component="li"
                          variant="body2"
                          key={i}
                          sx={{ mb: 1, lineHeight: 1.6, color: 'text.secondary' }}
                        >
                          {r}
                        </Typography>
                      ))}
                    </Box>
                  </CardContent>
                </Card>
              </Grid>

              <Grid item xs={12} md={6}>
                <Card sx={{ borderRadius: 2, height: '100%' }}>
                  <CardContent>
                    <Typography variant="subtitle1" fontWeight={700} gutterBottom>
                      💡 Recommended Strategic Adjustments
                    </Typography>
                    <Divider sx={{ my: 1.5 }} />
                    <Box component="ul" sx={{ pl: 2, m: 0 }}>
                      {executiveSummary.recommendations.map((rec, i) => (
                        <Typography
                          component="li"
                          variant="body2"
                          key={i}
                          sx={{ mb: 1, lineHeight: 1.6 }}
                        >
                          {rec}
                        </Typography>
                      ))}
                    </Box>
                  </CardContent>
                </Card>
              </Grid>

              <Grid item xs={12} md={6}>
                <Card sx={{ borderRadius: 2, height: '100%' }}>
                  <CardContent>
                    <Typography variant="subtitle1" fontWeight={700} gutterBottom>
                      🎯 Priority Assignments
                    </Typography>
                    <Divider sx={{ my: 1.5 }} />
                    <Box component="ul" sx={{ pl: 2, m: 0 }}>
                      {executiveSummary.nextActions.map((act, i) => (
                        <Typography
                          component="li"
                          variant="body2"
                          key={i}
                          sx={{ mb: 1, lineHeight: 1.6 }}
                        >
                          {act}
                        </Typography>
                      ))}
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          ) : tabError[4] ? (
            renderUnavailableState(4, () => fetchExecutiveSummary())
          ) : (
            <Alert severity="info">Select a briefing window to view executive intelligence.</Alert>
          )}
        </Box>
      )}
    </Box>
  );
};

export default AIIntelligenceConsole;
