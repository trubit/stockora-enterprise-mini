import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Grid,
  Card,
  CardContent,
} from '@mui/material';
import ShoppingBagIcon from '@mui/icons-material/ShoppingBag';
import StoreIcon from '@mui/icons-material/Store';
import LanguageIcon from '@mui/icons-material/Language';
import BusinessIcon from '@mui/icons-material/Business';
import { api } from '../../api/client.ts';
import { toast } from 'react-hot-toast';
import { useRegionalSettings } from '../../hooks/useRegionalSettings.js';

export default function OmnichannelSalesConsole() {
  const { formatAmount } = useRegionalSettings();
  const [transactions, setTransactions] = useState<any[]>([]);

  const fetchTransactions = async () => {
    try {
      const res = await api.get('/omnichannel-commerce/transactions');
      setTransactions(res.data || []);
    } catch {
      toast.error('Failed to load omnichannel transactions.');
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, []);

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
          <ShoppingBagIcon fontSize="large" /> Unified Omnichannel Commerce Orders
        </Typography>
        <Typography variant="body2" sx={{ color: '#9ca3af', mt: 0.5 }}>
          Centralized order pipeline consolidating POS, E-commerce, B2B & Wholesale sales orders
          into one fulfillment engine
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
              <Typography variant="caption" sx={{ color: '#9ca3af' }}>
                Total Orders
              </Typography>
              <Typography variant="h4" sx={{ fontWeight: 800, mt: 1, color: '#818cf8' }}>
                {transactions.length}
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
              <Typography variant="caption" sx={{ color: '#9ca3af' }}>
                POS In-Store Sales
              </Typography>
              <Typography variant="h4" sx={{ fontWeight: 800, mt: 1, color: '#34d399' }}>
                {transactions.filter((t) => t.channel === 'POS').length}
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
              <Typography variant="caption" sx={{ color: '#9ca3af' }}>
                Online & B2B Orders
              </Typography>
              <Typography variant="h4" sx={{ fontWeight: 800, mt: 1, color: '#38bdf8' }}>
                {transactions.filter((t) => t.channel === 'ONLINE' || t.channel === 'B2B').length}
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
              <Typography variant="caption" sx={{ color: '#9ca3af' }}>
                Total Gross Revenue
              </Typography>
              <Typography variant="h4" sx={{ fontWeight: 800, mt: 1, color: '#fbbf24' }}>
                {formatAmount(transactions.reduce((acc, t) => acc + (t.totalAmount || 0), 0))}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Orders Directory Table */}
      <Paper
        sx={{
          p: 3,
          background: '#111827',
          border: '1px solid #1f2937',
          borderRadius: 3,
          color: '#f8fafc',
        }}
      >
        <TableContainer>
          <Table>
            <TableHead sx={{ background: '#1f2937' }}>
              <TableRow>
                <TableCell sx={{ color: '#9ca3af', fontWeight: 600 }}>Order #</TableCell>
                <TableCell sx={{ color: '#9ca3af', fontWeight: 600 }}>Sales Channel</TableCell>
                <TableCell sx={{ color: '#9ca3af', fontWeight: 600 }}>Customer</TableCell>
                <TableCell sx={{ color: '#9ca3af', fontWeight: 600 }}>Items Count</TableCell>
                <TableCell sx={{ color: '#9ca3af', fontWeight: 600 }}>Total Amount</TableCell>
                <TableCell sx={{ color: '#9ca3af', fontWeight: 600 }}>Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {transactions.map((tx) => (
                <TableRow key={tx._id} sx={{ '&:hover': { background: '#1e293b' } }}>
                  <TableCell sx={{ color: '#818cf8', fontWeight: 700 }}>
                    {tx.transactionNumber}
                  </TableCell>
                  <TableCell>
                    <Chip
                      icon={
                        tx.channel === 'POS' ? (
                          <StoreIcon />
                        ) : tx.channel === 'ONLINE' ? (
                          <LanguageIcon />
                        ) : (
                          <BusinessIcon />
                        )
                      }
                      label={tx.channel}
                      size="small"
                      sx={{ background: '#374151', color: '#cbd5e1', fontWeight: 700 }}
                    />
                  </TableCell>
                  <TableCell sx={{ color: '#f8fafc' }}>
                    {tx.customerName || 'Walk-in Guest'}
                  </TableCell>
                  <TableCell sx={{ color: '#cbd5e1' }}>
                    {tx.items?.length || 0} Line Items
                  </TableCell>
                  <TableCell sx={{ color: '#34d399', fontWeight: 700 }}>
                    {formatAmount(tx.totalAmount || 0)}
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={tx.status}
                      size="small"
                      sx={{
                        fontWeight: 600,
                        background:
                          tx.status === 'COMPLETED' || tx.status === 'PAID'
                            ? 'rgba(16, 185, 129, 0.2)'
                            : 'rgba(56, 189, 248, 0.2)',
                        color:
                          tx.status === 'COMPLETED' || tx.status === 'PAID' ? '#34d399' : '#38bdf8',
                      }}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </Box>
  );
}
