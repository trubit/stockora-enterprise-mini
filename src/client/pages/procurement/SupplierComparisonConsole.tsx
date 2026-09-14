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
  Grid,
  TextField,
} from '@mui/material';
import CompareIcon from '@mui/icons-material/Compare';
import StarIcon from '@mui/icons-material/Star';
import { api } from '../../api/client.ts';
import { toast } from 'react-hot-toast';
import { useRegionalSettings } from '../../hooks/useRegionalSettings.js';

export default function SupplierComparisonConsole() {
  const { formatAmount } = useRegionalSettings();
  const [products, setProducts] = useState<any[]>([]);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [quantity, setQuantity] = useState(50);
  const [rankings, setRankings] = useState<any[]>([]);

  const fetchProducts = async () => {
    try {
      const res = await api.get('/products');
      const list = res.data?.data || res.data || [];
      setProducts(list);
      if (list.length > 0) {
        setSelectedProductId(list[0]._id);
      }
    } catch {
      toast.error('Failed to load products list.');
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const handleCompare = async () => {
    try {
      if (!selectedProductId) return;
      const res = await api.get(
        `/procurement-replenishment/supplier-ranking/${selectedProductId}?quantity=${quantity}`
      );
      setRankings(res.data || []);
      toast.success('Supplier ranking matrix calculated!');
    } catch {
      toast.error('Failed to rank suppliers for selected product.');
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
          <CompareIcon fontSize="large" /> Multi-Supplier Comparison & Selection Matrix
        </Typography>
        <Typography variant="body2" sx={{ color: '#9ca3af', mt: 0.5 }}>
          Compare vendor pricing, volume breaks, lead times, MOQ thresholds, and overall reliability
          scores
        </Typography>
      </Box>

      {/* Filter Options */}
      <Paper
        sx={{ p: 3, mb: 4, background: '#111827', border: '1px solid #1f2937', borderRadius: 3 }}
      >
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} sm={6}>
            <TextField
              select
              fullWidth
              label="Select Target Product"
              value={selectedProductId}
              onChange={(e) => setSelectedProductId(e.target.value)}
              SelectProps={{ native: true }}
              InputLabelProps={{ shrink: true, style: { color: '#9ca3af' } }}
              InputProps={{ style: { color: '#fff' } }}
            >
              <option value="" style={{ background: '#111827' }}>
                -- Select Product --
              </option>
              {products.map((p) => (
                <option key={p._id} value={p._id} style={{ background: '#111827' }}>
                  {p.name} ({p.sku})
                </option>
              ))}
            </TextField>
          </Grid>
          <Grid item xs={12} sm={3}>
            <TextField
              fullWidth
              type="number"
              label="Target Quantity"
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
              InputLabelProps={{ shrink: true, style: { color: '#9ca3af' } }}
              InputProps={{ style: { color: '#fff' } }}
            />
          </Grid>
          <Grid item xs={12} sm={3}>
            <Button
              fullWidth
              variant="contained"
              onClick={handleCompare}
              sx={{ background: '#8b5cf6', color: '#fff', py: 1.5 }}
            >
              Compare Vendors
            </Button>
          </Grid>
        </Grid>
      </Paper>

      {/* Rankings Matrix Table */}
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
                <TableCell sx={{ color: '#9ca3af', fontWeight: 600 }}>Rank</TableCell>
                <TableCell sx={{ color: '#9ca3af', fontWeight: 600 }}>Supplier Name</TableCell>
                <TableCell sx={{ color: '#9ca3af', fontWeight: 600 }}>Unit Cost Price</TableCell>
                <TableCell sx={{ color: '#9ca3af', fontWeight: 600 }}>Lead Time</TableCell>
                <TableCell sx={{ color: '#9ca3af', fontWeight: 600 }}>MOQ</TableCell>
                <TableCell sx={{ color: '#9ca3af', fontWeight: 600 }}>Vendor Score</TableCell>
                <TableCell sx={{ color: '#9ca3af', fontWeight: 600 }}>
                  Recommendation Reason
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rankings.map((r) => (
                <TableRow key={r.supplierId} sx={{ '&:hover': { background: '#1e293b' } }}>
                  <TableCell sx={{ color: r.rank === 1 ? '#34d399' : '#818cf8', fontWeight: 800 }}>
                    #{r.rank} {r.rank === 1 && '🏆'}
                  </TableCell>
                  <TableCell sx={{ color: '#f8fafc', fontWeight: 700 }}>{r.supplierName}</TableCell>
                  <TableCell sx={{ color: '#34d399', fontWeight: 700 }}>
                    {formatAmount(r.unitCost)}
                  </TableCell>
                  <TableCell sx={{ color: '#cbd5e1' }}>{r.leadTimeDays} Days</TableCell>
                  <TableCell sx={{ color: '#fbbf24', fontWeight: 700 }}>{r.moq} Units</TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <StarIcon sx={{ color: '#fbbf24', fontSize: 18 }} />
                      <Typography variant="body2" sx={{ fontWeight: 700, color: '#fbbf24' }}>
                        {r.overallScore}%
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell sx={{ color: '#9ca3af', fontSize: '0.85rem' }}>
                    {r.recommendationReason}
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
