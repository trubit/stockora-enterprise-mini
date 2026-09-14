import { useState, useEffect, useRef } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Chip,
  List,
  ListItem,
  Divider,
  Grid,
} from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import PersonIcon from '@mui/icons-material/Person';
import { apiClient } from '../../api/client.ts';
import PageHeader from '../../components/PageHeader.tsx';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  createdAt?: string;
}

export default function AICopilot() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionId] = useState(() => `session-${Date.now()}`);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async (textToSend?: string) => {
    const text = textToSend || input;
    if (!text.trim()) return;

    if (!textToSend) setInput('');

    // Optimistic user update
    const userMsg: Message = { role: 'user', content: text };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    try {
      const res = await apiClient.post('/copilot/chat', { sessionId, prompt: text });
      const replyMsg: Message = { role: 'assistant', content: res.data.reply };
      setMessages((prev) => [...prev, replyMsg]);
    } catch {
      const errorMsg: Message = {
        role: 'assistant',
        content:
          'Failed to communicate with AI Copilot. Please check your network and provider keys settings.',
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  const suggestions = [
    'Which products are running low on stock?',
    'Show a summary of today sales trends',
    'What caused profit changes this month?',
  ];

  return (
    <Box p={3} display="flex" flexDirection="column" height="85vh">
      <PageHeader
        title="Stockora Enterprise AI Copilot"
        subtitle="Natural language business intelligence assistant powered by baseline RAG logic"
      />

      <Grid container spacing={3} sx={{ flexGrow: 1, minHeight: 0 }}>
        <Grid item xs={12} md={8} sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          <Card
            sx={{
              flexGrow: 1,
              display: 'flex',
              flexDirection: 'column',
              background: 'rgba(255,255,255,0.05)',
              backdropFilter: 'blur(10px)',
              color: '#fff',
              borderRadius: '16px',
              border: '1px solid rgba(255,255,255,0.1)',
              minHeight: 0,
            }}
          >
            <CardContent
              sx={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, p: 2 }}
            >
              {/* Chat Messages List */}
              <Box sx={{ flexGrow: 1, overflowY: 'auto', mb: 2, pr: 1 }}>
                {messages.length === 0 && (
                  <Box
                    display="flex"
                    flexDirection="column"
                    alignItems="center"
                    justifyContent="center"
                    height="100%"
                    py={4}
                  >
                    <SmartToyIcon color="primary" sx={{ fontSize: 50, mb: 2 }} />
                    <Typography variant="h6" align="center" color="textSecondary" sx={{ mb: 1 }}>
                      Hello! I am your AI Business Copilot.
                    </Typography>
                    <Typography variant="body2" align="center" color="textSecondary">
                      Ask me about inventory levels, sales metrics, or custom workflows
                      optimization.
                    </Typography>
                  </Box>
                )}
                <List>
                  {messages.map((msg, idx) => (
                    <ListItem
                      key={idx}
                      sx={{
                        flexDirection: 'column',
                        alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start',
                        mb: 1.5,
                      }}
                    >
                      <Box display="flex" alignItems="center" gap={1} mb={0.5}>
                        {msg.role === 'user' ? (
                          <PersonIcon fontSize="small" color="secondary" />
                        ) : (
                          <SmartToyIcon fontSize="small" color="primary" />
                        )}
                        <Typography variant="caption" sx={{ fontWeight: 'bold', color: '#aaa' }}>
                          {msg.role === 'user' ? 'You' : 'Copilot'}
                        </Typography>
                      </Box>
                      <Box
                        p={1.5}
                        sx={{
                          background:
                            msg.role === 'user'
                              ? 'linear-gradient(45deg, #9C27B0, #E91E63)'
                              : 'rgba(255,255,255,0.05)',
                          borderRadius: '12px',
                          maxWidth: '80%',
                          color: '#fff',
                        }}
                      >
                        <Typography variant="body2" sx={{ whiteSpace: 'pre-line' }}>
                          {msg.content}
                        </Typography>
                      </Box>
                    </ListItem>
                  ))}
                </List>
                <div ref={messagesEndRef} />
              </Box>

              <Divider sx={{ mb: 2, background: 'rgba(255,255,255,0.1)' }} />

              {/* Chat Input Field */}
              <Box display="flex" gap={1}>
                <TextField
                  fullWidth
                  size="small"
                  placeholder="Ask a question..."
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                  inputProps={{ style: { color: '#fff' } }}
                  disabled={loading}
                />
                <Button
                  variant="contained"
                  endIcon={<SendIcon />}
                  onClick={() => handleSend()}
                  disabled={loading}
                >
                  Send
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card
            sx={{
              background: 'rgba(255,255,255,0.05)',
              backdropFilter: 'blur(10px)',
              color: '#fff',
              borderRadius: '16px',
              border: '1px solid rgba(255,255,255,0.1)',
            }}
          >
            <CardContent>
              <Typography variant="h6" gutterBottom color="primary">
                Suggested Prompts
              </Typography>
              <Divider sx={{ mb: 2, background: 'rgba(255,255,255,0.1)' }} />
              <Box display="flex" flexDirection="column" gap={1.5}>
                {suggestions.map((sug, idx) => (
                  <Chip
                    key={idx}
                    label={sug}
                    onClick={() => handleSend(sug)}
                    disabled={loading}
                    sx={{
                      color: '#fff',
                      background: 'rgba(255,255,255,0.02)',
                      border: '1px solid rgba(255,255,255,0.05)',
                      py: 2,
                      height: 'auto',
                      '&:hover': { background: 'rgba(255,255,255,0.08)' },
                    }}
                  />
                ))}
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
