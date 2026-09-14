import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../api/client.ts';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  CircularProgress,
} from '@mui/material';
import PageHeader from '../../components/PageHeader.tsx';
import { useRegionalSettings } from '../../hooks/useRegionalSettings.js';

export default function StockOptimization() {
  const { formatAmount } = useRegionalSettings();
  const { data: optimizationData, isLoading } = useQuery({
    queryKey: ['stock-optimization'],
    queryFn: async () => {
      const res = await apiClient.get('/inventory-intelligence/optimization');
      return res.data.data;
    },
  });

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 6 }}>
        <CircularProgress />
      </Box>
    );
  }

  const { overstock, deadStock, transferRecommendations } = optimizationData || {};

  return (
    <Box sx={{ p: 3 }}>
      <PageHeader
        title="Stock Optimization & Inter-Warehouse Transfers"
        subtitle="Overstock & Dead Stock Management, FEFO Expiry Risk & Warehouse Rebalancing"
      />

      {/* Warehouse Transfer Recommendations */}
      <Card sx={{ mb: 4 }}>
        <CardContent>
          <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>
            Inter-Warehouse Stock Transfer Recommendations
          </Typography>
          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead sx={{ bgcolor: '#f8fafc' }}>
                <TableRow>
                  <TableCell>Product SKU / Name</TableCell>
                  <TableCell>Source Warehouse</TableCell>
                  <TableCell>Target Warehouse</TableCell>
                  <TableCell align="right">Transfer Quantity</TableCell>
                  <TableCell>Reason</TableCell>
                  <TableCell>Priority</TableCell>
                  <TableCell>Status</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {(transferRecommendations || []).map((t: any) => (
                  <TableRow key={t._id}>
                    <TableCell>
                      <Typography variant="subtitle2">{t.productSku}</Typography>
                      <Typography variant="caption" color="textSecondary">
                        {t.productName}
                      </Typography>
                    </TableCell>
                    <TableCell>{t.sourceWarehouseName || 'Main Warehouse'}</TableCell>
                    <TableCell>{t.targetWarehouseName || 'Branch Warehouse'}</TableCell>
                    <TableCell align="right">
                      <Typography fontWeight={700} color="primary.main">
                        {t.quantity}
                      </Typography>
                    </TableCell>
                    <TableCell>{t.reason}</TableCell>
                    <TableCell>
                      <Chip label={t.priority} size="small" color="info" />
                    </TableCell>
                    <TableCell>
                      <Chip label={t.status} size="small" color="default" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      <Grid container spacing={3}>
        {/* Overstock Items */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" fontWeight={600} color="warning.main" sx={{ mb: 2 }}>
                Overstock Items (Excess Capital)
              </Typography>
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead sx={{ bgcolor: '#fffbe6' }}>
                    <TableRow>
                      <TableCell>Product</TableCell>
                      <TableCell align="right">Stock</TableCell>
                      <TableCell align="right">Value</TableCell>
                      <TableCell>Action</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {(overstock || []).map((item: any) => (
                      <TableRow key={item.productId}>
                        <TableCell>
                          <Typography variant="subtitle2">{item.sku}</Typography>
                          <Typography variant="caption" color="textSecondary">
                            {item.name}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">{item.currentStock}</TableCell>
                        <TableCell align="right">{formatAmount(item.holdingValue)}</TableCell>
                        <TableCell>
                          <Typography variant="caption" color="textSecondary">
                            {item.recommendedAction}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </Grid>

        {/* Dead Stock Items */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" fontWeight={600} color="error.main" sx={{ mb: 2 }}>
                Dead Stock Classification (&gt;90 Days Inactive)
              </Typography>
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead sx={{ bgcolor: '#fff5f5' }}>
                    <TableRow>
                      <TableCell>Product</TableCell>
                      <TableCell align="right">Quantity</TableCell>
                      <TableCell align="right">Tied-Up Capital</TableCell>
                      <TableCell>Action</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {(deadStock || []).map((item: any) => (
                      <TableRow key={item.productId}>
                        <TableCell>
                          <Typography variant="subtitle2">{item.sku}</Typography>
                          <Typography variant="caption" color="textSecondary">
                            {item.name}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">{item.quantity}</TableCell>
                        <TableCell align="right">{formatAmount(item.capitalTiedUp)}</TableCell>
                        <TableCell>
                          <Typography variant="caption" color="textSecondary">
                            {item.recommendedAction}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
