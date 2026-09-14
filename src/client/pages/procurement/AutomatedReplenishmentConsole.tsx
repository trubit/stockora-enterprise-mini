import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
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
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import CompareArrowsIcon from '@mui/icons-material/CompareArrows';
import { api } from '../../api/client.ts';
import { toast } from 'react-hot-toast';

export default function AutomatedReplenishmentConsole() {
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [selectedProductId, setSelectedProductId] = useState('');

  const fetchData = async () => {
    try {
      const [recRes, prodRes] = await Promise.all([
        api.get('/procurement-replenishment/recommendations'),
        api.get('/products'),
      ]);
      setRecommendations(recRes.data || []);
      setProducts(prodRes.data?.data || prodRes.data || []);
    } catch {
      toast.error('Failed to load replenishment recommendations.');
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleRunReplenishment = async () => {
    try {
      if (!selectedProductId && products.length > 0) {
        setSelectedProductId(products[0]._id);
      }
      const prodId = selectedProductId || products[0]?._id;
      if (!prodId) {
        toast.error('No products available for calculation.');
        return;
      }

      await api.post('/procurement-replenishment/calculate-recommendation', {
        productId: prodId,
      });
      toast.success('Replenishment calculation completed successfully!');
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to calculate replenishment.');
    }
  };

  const handleConvert = async (id: string) => {
    try {
      await api.post(`/procurement-replenishment/recommendations/${id}/convert-pr`);
      toast.success('Replenishment recommendation converted to Purchase Request!');
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to convert recommendation.');
    }
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
            <AutoAwesomeIcon fontSize="large" /> Automated Replenishment & Stockout Intelligence
          </Typography>
          <Typography variant="body2" sx={{ color: '#9ca3af', mt: 0.5 }}>
            Demand forecasting, reorder points (ROP), safety stock, MOQ/pack-size rounding &
            multi-warehouse transfer vs purchase advice
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AutoAwesomeIcon />}
          onClick={handleRunReplenishment}
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
          Run Replenishment Engine
        </Button>
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
                Active Recommendations
              </Typography>
              <Typography variant="h4" sx={{ fontWeight: 800, mt: 1, color: '#818cf8' }}>
                {recommendations.length}
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
                Critical Stockout Risk
              </Typography>
              <Typography variant="h4" sx={{ fontWeight: 800, mt: 1, color: '#f87171' }}>
                {
                  recommendations.filter(
                    (r) => r.riskLevel === 'CRITICAL' || r.riskLevel === 'HIGH'
                  ).length
                }
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
                Inter-Warehouse Transfers
              </Typography>
              <Typography variant="h4" sx={{ fontWeight: 800, mt: 1, color: '#38bdf8' }}>
                {recommendations.filter((r) => r.transferFromWarehouseId).length}
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
                Estimated Cost
              </Typography>
              <Typography variant="h4" sx={{ fontWeight: 800, mt: 1, color: '#34d399' }}>
                $
                {recommendations
                  .reduce((acc, r) => acc + (r.estimatedCost || 0), 0)
                  .toLocaleString()}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

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
                <TableCell sx={{ color: '#9ca3af', fontWeight: 600 }}>Product</TableCell>
                <TableCell sx={{ color: '#9ca3af', fontWeight: 600 }}>Current / ROP</TableCell>
                <TableCell sx={{ color: '#9ca3af', fontWeight: 600 }}>Rec Qty (MOQ)</TableCell>
                <TableCell sx={{ color: '#9ca3af', fontWeight: 600 }}>Risk Level</TableCell>
                <TableCell sx={{ color: '#9ca3af', fontWeight: 600 }}>Advice Strategy</TableCell>
                <TableCell sx={{ color: '#9ca3af', fontWeight: 600 }}>Status</TableCell>
                <TableCell align="right" sx={{ color: '#9ca3af', fontWeight: 600 }}>
                  Actions
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {recommendations.map((rec) => (
                <TableRow key={rec._id} sx={{ '&:hover': { background: '#1e293b' } }}>
                  <TableCell sx={{ color: '#f8fafc', fontWeight: 700 }}>
                    {rec.productName || rec.productId?.name || 'Product'} ({rec.productSku || 'SKU'}
                    )
                  </TableCell>
                  <TableCell sx={{ color: '#cbd5e1' }}>
                    {rec.currentStock} /{' '}
                    <span style={{ color: '#fbbf24', fontWeight: 700 }}>
                      {rec.reorderPoint} ROP
                    </span>
                  </TableCell>
                  <TableCell sx={{ color: '#34d399', fontWeight: 700 }}>
                    {rec.recommendedQuantity} units (MOQ {rec.moq || 1})
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={rec.riskLevel || 'MEDIUM'}
                      size="small"
                      sx={{
                        fontWeight: 700,
                        background:
                          rec.riskLevel === 'CRITICAL' || rec.riskLevel === 'HIGH'
                            ? 'rgba(239, 68, 68, 0.2)'
                            : 'rgba(245, 158, 11, 0.2)',
                        color:
                          rec.riskLevel === 'CRITICAL' || rec.riskLevel === 'HIGH'
                            ? '#f87171'
                            : '#fbbf24',
                      }}
                    />
                  </TableCell>
                  <TableCell sx={{ color: '#9ca3af', fontSize: '0.85rem' }}>
                    {rec.transferFromWarehouseId ? (
                      <Chip
                        icon={<CompareArrowsIcon />}
                        label="Transfer from WH-Hub-B"
                        size="small"
                        sx={{ background: 'rgba(56, 189, 248, 0.2)', color: '#38bdf8' }}
                      />
                    ) : (
                      `Purchase from ${rec.supplierName || 'Primary Supplier'}`
                    )}
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={rec.status}
                      size="small"
                      sx={{
                        fontWeight: 600,
                        background:
                          rec.status === 'CONVERTED'
                            ? 'rgba(16, 185, 129, 0.2)'
                            : 'rgba(139, 92, 246, 0.2)',
                        color: rec.status === 'CONVERTED' ? '#34d399' : '#c4b5fd',
                      }}
                    />
                  </TableCell>
                  <TableCell align="right">
                    {rec.status !== 'CONVERTED' && (
                      <Button
                        size="small"
                        variant="contained"
                        startIcon={<ShoppingCartIcon />}
                        onClick={() => handleConvert(rec._id)}
                        sx={{ background: '#8b5cf6', color: '#fff' }}
                      >
                        Convert to PR
                      </Button>
                    )}
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
