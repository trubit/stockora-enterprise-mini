import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  CircularProgress,
} from '@mui/material';
import DescriptionIcon from '@mui/icons-material/Description';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import RefreshIcon from '@mui/icons-material/Refresh';
import { api } from '../../api/client.ts';
import { toast } from 'react-hot-toast';
import { useRegionalSettings } from '../../hooks/useRegionalSettings.js';

interface QuoteItem {
  _id: string;
  quoteNumber: string;
  customerName?: string;
  subtotal: number;
  total: number;
  status: string;
  validUntil: string;
  convertedOrderNumber?: string;
  createdAt: string;
}

export default function SalesQuoteConsole() {
  const { formatAmount } = useRegionalSettings();
  const [quotes, setQuotes] = useState<QuoteItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [convertingId, setConvertingId] = useState<string | null>(null);

  useEffect(() => {
    fetchQuotes();
  }, []);

  const fetchQuotes = async () => {
    try {
      setLoading(true);
      const res = await api.get('/sales-advanced/quotes');
      setQuotes(res.data || []);
    } catch {
      toast.error('Failed to load sales quotes.');
    } finally {
      setLoading(false);
    }
  };

  const handleConvert = async (quoteId: string) => {
    try {
      setConvertingId(quoteId);
      const res = await api.post(`/sales-advanced/quotes/${quoteId}/convert`);
      toast.success(`Quote converted to Sales Order ${res.data.orderNumber}!`);
      fetchQuotes();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to convert quote.');
    } finally {
      setConvertingId(null);
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
            <DescriptionIcon fontSize="large" /> Sales Quotation Engine
          </Typography>
          <Typography variant="body2" sx={{ color: '#9ca3af', mt: 0.5 }}>
            Quotation pipeline management, proposal acceptance & 1-click order conversion
          </Typography>
        </Box>
        <Button
          variant="outlined"
          startIcon={<RefreshIcon />}
          onClick={fetchQuotes}
          sx={{
            borderColor: '#374151',
            color: '#cbd5e1',
            borderRadius: '9999px',
            px: 3,
            '&:hover': { borderColor: '#8b5cf6', color: '#8b5cf6' },
          }}
        >
          Refresh
        </Button>
      </Box>

      {/* Main Table Paper */}
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
          Active Quotations Pipeline
        </Typography>

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 5 }}>
            <CircularProgress sx={{ color: '#8b5cf6' }} />
          </Box>
        ) : (
          <TableContainer>
            <Table>
              <TableHead sx={{ background: '#1f2937' }}>
                <TableRow>
                  <TableCell sx={{ color: '#9ca3af', fontWeight: 600 }}>Quote #</TableCell>
                  <TableCell sx={{ color: '#9ca3af', fontWeight: 600 }}>Customer</TableCell>
                  <TableCell sx={{ color: '#9ca3af', fontWeight: 600 }}>Valid Until</TableCell>
                  <TableCell sx={{ color: '#9ca3af', fontWeight: 600 }}>Total Amount</TableCell>
                  <TableCell sx={{ color: '#9ca3af', fontWeight: 600 }}>Status</TableCell>
                  <TableCell sx={{ color: '#9ca3af', fontWeight: 600 }}>Converted Order</TableCell>
                  <TableCell align="right" sx={{ color: '#9ca3af', fontWeight: 600 }}>
                    Actions
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {quotes.map((q) => (
                  <TableRow key={q._id} sx={{ '&:hover': { background: '#1e293b' } }}>
                    <TableCell sx={{ color: '#818cf8', fontWeight: 700 }}>
                      {q.quoteNumber}
                    </TableCell>
                    <TableCell sx={{ color: '#f8fafc' }}>
                      {q.customerName || 'Walk-in / Standard'}
                    </TableCell>
                    <TableCell sx={{ color: '#9ca3af' }}>
                      {q.validUntil ? new Date(q.validUntil).toLocaleDateString() : 'N/A'}
                    </TableCell>
                    <TableCell sx={{ color: '#34d399', fontWeight: 700 }}>
                      {formatAmount(q.total || 0)}
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={q.status}
                        size="small"
                        sx={{
                          fontWeight: 600,
                          background:
                            q.status === 'CONVERTED'
                              ? 'rgba(16, 185, 129, 0.2)'
                              : q.status === 'ACCEPTED'
                                ? 'rgba(56, 189, 248, 0.2)'
                                : q.status === 'EXPIRED'
                                  ? 'rgba(239, 68, 68, 0.2)'
                                  : 'rgba(245, 158, 11, 0.2)',
                          color:
                            q.status === 'CONVERTED'
                              ? '#34d399'
                              : q.status === 'ACCEPTED'
                                ? '#38bdf8'
                                : q.status === 'EXPIRED'
                                  ? '#f87171'
                                  : '#fbbf24',
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      {q.convertedOrderNumber ? (
                        <Chip
                          label={q.convertedOrderNumber}
                          size="small"
                          sx={{ background: '#374151', color: '#cbd5e1' }}
                        />
                      ) : (
                        '-'
                      )}
                    </TableCell>
                    <TableCell align="right">
                      {q.status !== 'CONVERTED' && q.status !== 'EXPIRED' && (
                        <Button
                          size="small"
                          variant="contained"
                          color="success"
                          endIcon={<ArrowForwardIcon />}
                          onClick={() => handleConvert(q._id)}
                          disabled={convertingId === q._id}
                          sx={{
                            borderRadius: '9999px',
                            fontWeight: 600,
                            textTransform: 'none',
                          }}
                        >
                          {convertingId === q._id ? 'Converting...' : 'Convert to Order'}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>
    </Box>
  );
}
