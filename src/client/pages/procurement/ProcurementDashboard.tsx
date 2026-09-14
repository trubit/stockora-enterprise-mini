import { useState, useEffect } from 'react';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Button,
} from '@mui/material';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import VerifiedUserIcon from '@mui/icons-material/VerifiedUser';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import RefreshIcon from '@mui/icons-material/Refresh';
import { api } from '../../api/client.ts';
import { toast } from 'react-hot-toast';
import { useRegionalSettings } from '../../hooks/useRegionalSettings.js';

export default function ProcurementDashboard() {
  const { formatAmount } = useRegionalSettings();
  const [analytics, setAnalytics] = useState<any>(null);
  const [recentPOs, setRecentPOs] = useState<any[]>([]);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const [anaRes, poRes] = await Promise.all([
        api.get('/procurement-advanced/analytics'),
        api.get('/procurement-advanced/purchase-orders'),
      ]);
      setAnalytics(anaRes.data);
      setRecentPOs(poRes.data || []);
    } catch {
      toast.error('Failed to load procurement dashboard.');
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
            <ShoppingCartIcon fontSize="large" /> Procurement & Supply Chain Workspace
          </Typography>
          <Typography variant="body2" sx={{ color: '#9ca3af', mt: 0.5 }}>
            Unified purchasing lifecycle, supplier evaluation, receiving, quality & AP matching
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<RefreshIcon />}
          onClick={fetchDashboardData}
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
          Refresh Data
        </Button>
      </Box>

      {/* KPI Cards */}
      <Grid container spacing={2.5} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card
            sx={{
              background: '#111827',
              border: '1px solid #1f2937',
              borderRadius: 3,
              color: '#f8fafc',
            }}
          >
            <CardContent sx={{ display: 'flex', alignItems: 'center', p: 2.5 }}>
              <Box
                sx={{
                  p: 1.5,
                  borderRadius: 2,
                  background: 'rgba(99, 102, 241, 0.15)',
                  color: '#818cf8',
                  mr: 2,
                }}
              >
                <VerifiedUserIcon fontSize="large" />
              </Box>
              <Box>
                <Typography variant="caption" sx={{ color: '#9ca3af', fontWeight: 500 }}>
                  Active Suppliers
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 800, color: '#f8fafc' }}>
                  {analytics?.totalSuppliers || 0}
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card
            sx={{
              background: '#111827',
              border: '1px solid #1f2937',
              borderRadius: 3,
              color: '#f8fafc',
            }}
          >
            <CardContent sx={{ display: 'flex', alignItems: 'center', p: 2.5 }}>
              <Box
                sx={{
                  p: 1.5,
                  borderRadius: 2,
                  background: 'rgba(16, 185, 129, 0.15)',
                  color: '#34d399',
                  mr: 2,
                }}
              >
                <ShoppingCartIcon fontSize="large" />
              </Box>
              <Box>
                <Typography variant="caption" sx={{ color: '#9ca3af', fontWeight: 500 }}>
                  Open Purchase Orders
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 800, color: '#f8fafc' }}>
                  {analytics?.openPOs || 0}
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card
            sx={{
              background: '#111827',
              border: '1px solid #1f2937',
              borderRadius: 3,
              color: '#f8fafc',
            }}
          >
            <CardContent sx={{ display: 'flex', alignItems: 'center', p: 2.5 }}>
              <Box
                sx={{
                  p: 1.5,
                  borderRadius: 2,
                  background: 'rgba(245, 158, 11, 0.15)',
                  color: '#fbbf24',
                  mr: 2,
                }}
              >
                <LocalShippingIcon fontSize="large" />
              </Box>
              <Box>
                <Typography variant="caption" sx={{ color: '#9ca3af', fontWeight: 500 }}>
                  Pending Requisitions
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 800, color: '#f8fafc' }}>
                  {analytics?.pendingRequisitions || 0}
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card
            sx={{
              background: '#111827',
              border: '1px solid #1f2937',
              borderRadius: 3,
              color: '#f8fafc',
            }}
          >
            <CardContent sx={{ display: 'flex', alignItems: 'center', p: 2.5 }}>
              <Box
                sx={{
                  p: 1.5,
                  borderRadius: 2,
                  background: 'rgba(236, 72, 153, 0.15)',
                  color: '#f472b6',
                  mr: 2,
                }}
              >
                <CheckCircleIcon fontSize="large" />
              </Box>
              <Box>
                <Typography variant="caption" sx={{ color: '#9ca3af', fontWeight: 500 }}>
                  Total Spend (YTD)
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 800, color: '#f8fafc' }}>
                  {formatAmount(analytics?.totalSpend || 0)}
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* AI Reorder Advisory Banner */}
      <Card
        sx={{
          mb: 3,
          background: 'linear-gradient(135deg, #1e1b4b 0%, #0f172a 100%)',
          border: '1px solid rgba(139, 92, 246, 0.3)',
          borderRadius: 3,
          color: '#f8fafc',
          boxShadow: '0 8px 32px rgba(139, 92, 246, 0.15)',
        }}
      >
        <CardContent sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <AutoAwesomeIcon sx={{ color: '#fbbf24' }} />
            <Typography variant="h6" sx={{ fontWeight: 700, color: '#fbbf24' }}>
              AI Reorder & Procurement Advisory
            </Typography>
          </Box>
          <Grid container spacing={2}>
            {analytics?.aiProcurementAdvisory?.reorderRecommendations?.map((rec: any) => (
              <Grid item xs={12} md={4} key={rec.productId}>
                <Box
                  sx={{
                    p: 2,
                    borderRadius: 2,
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                  }}
                >
                  <Typography variant="body2" sx={{ fontWeight: 700, color: '#38bdf8' }}>
                    {rec.name} ({rec.sku})
                  </Typography>
                  <Typography
                    variant="caption"
                    sx={{ color: '#94a3b8', display: 'block', mt: 0.5 }}
                  >
                    {rec.rationale}
                  </Typography>
                  <Chip
                    label={`Reorder: ${rec.recommendedQty} units`}
                    size="small"
                    sx={{
                      mt: 1,
                      background: 'rgba(16, 185, 129, 0.2)',
                      color: '#34d399',
                      fontWeight: 700,
                    }}
                  />
                </Box>
              </Grid>
            ))}
          </Grid>
        </CardContent>
      </Card>

      {/* Recent POs Table */}
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
          Recent Purchase Orders
        </Typography>
        <TableContainer>
          <Table>
            <TableHead sx={{ background: '#1f2937' }}>
              <TableRow>
                <TableCell sx={{ color: '#9ca3af', fontWeight: 600 }}>PO #</TableCell>
                <TableCell sx={{ color: '#9ca3af', fontWeight: 600 }}>Supplier</TableCell>
                <TableCell sx={{ color: '#9ca3af', fontWeight: 600 }}>Delivery Date</TableCell>
                <TableCell sx={{ color: '#9ca3af', fontWeight: 600 }}>Total Amount</TableCell>
                <TableCell sx={{ color: '#9ca3af', fontWeight: 600 }}>Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {recentPOs.map((po) => (
                <TableRow key={po._id} sx={{ '&:hover': { background: '#1e293b' } }}>
                  <TableCell sx={{ color: '#818cf8', fontWeight: 700 }}>{po.poNumber}</TableCell>
                  <TableCell sx={{ color: '#f8fafc' }}>
                    {po.supplierName || 'Standard Supplier'}
                  </TableCell>
                  <TableCell sx={{ color: '#9ca3af' }}>
                    {po.expectedDeliveryDate
                      ? new Date(po.expectedDeliveryDate).toLocaleDateString()
                      : 'N/A'}
                  </TableCell>
                  <TableCell sx={{ color: '#34d399', fontWeight: 700 }}>
                    {formatAmount(po.totalAmount || 0)}
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={po.status}
                      size="small"
                      sx={{
                        fontWeight: 600,
                        background:
                          po.status === 'RECEIVED'
                            ? 'rgba(16, 185, 129, 0.2)'
                            : po.status === 'APPROVED'
                              ? 'rgba(56, 189, 248, 0.2)'
                              : 'rgba(245, 158, 11, 0.2)',
                        color:
                          po.status === 'RECEIVED'
                            ? '#34d399'
                            : po.status === 'APPROVED'
                              ? '#38bdf8'
                              : '#fbbf24',
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
