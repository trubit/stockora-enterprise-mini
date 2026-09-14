import { useState, useMemo } from 'react';
import {
  Box,
  Typography,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Grid,
  Card,
  ToggleButton,
  ToggleButtonGroup,
  Divider,
  CircularProgress,
  InputAdornment,
  Alert,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import TuneIcon from '@mui/icons-material/Tune';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import SearchIcon from '@mui/icons-material/Search';
import HistoryIcon from '@mui/icons-material/History';
import WarehouseIcon from '@mui/icons-material/Warehouse';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../api/client.ts';
import { toast } from 'react-hot-toast';
import type { Product } from '../../../shared/types.js';
import { motion } from 'framer-motion';
import { Can } from '../../components/auth/Can.tsx';

const STANDARDIZED_REASONS = [
  'Incorrect stock entry',
  'Counting error',
  'Damaged goods',
  'Lost goods',
  'Found goods',
  'Receiving correction',
  'Data correction',
  'Warehouse correction',
  'Other',
];

interface WarehouseItem {
  _id: string;
  name: string;
  code: string;
}

interface StockAdjustmentRecord {
  _id: string;
  adjustmentNumber: string;
  tenantId?: string;
  productId: {
    _id: string;
    name: string;
    sku: string;
    category?: string;
    uom?: string;
    price?: number;
    costPrice?: number;
    quantity?: number;
  };
  warehouseId?: {
    _id: string;
    name: string;
    code: string;
  };
  variantSku?: string;
  type: string;
  reason: string;
  quantity: number;
  quantityDelta: number;
  previousQuantity?: number;
  newQuantity?: number;
  notes?: string;
  userId?: {
    _id: string;
    username: string;
    email: string;
  };
  createdAt: string;
}

export default function StockAdjustments() {
  const queryClient = useQueryClient();

  // State
  const [openModal, setOpenModal] = useState(false);
  const [openConfirm, setOpenConfirm] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterReason, setFilterReason] = useState<string>('ALL');
  const [filterWarehouse, setFilterWarehouse] = useState<string>('ALL');

  // Form State
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [selectedVariantSku, setSelectedVariantSku] = useState<string>('');
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>('');
  const [mode, setMode] = useState<'RELATIVE' | 'SET'>('RELATIVE');
  const [relativeQtyInput, setRelativeQtyInput] = useState<string>('');
  const [targetQtyInput, setTargetQtyInput] = useState<string>('');
  const [selectedReason, setSelectedReason] = useState<string>('Incorrect stock entry');
  const [notes, setNotes] = useState<string>('');

  // 1. Fetch Adjustments History
  const { data: adjustments = [], isLoading: loadingAdjustments } = useQuery<
    StockAdjustmentRecord[]
  >({
    queryKey: ['adjustments'],
    queryFn: async () => {
      const { data } = await apiClient.get<StockAdjustmentRecord[]>('/inventory/adjustments');
      return data;
    },
  });

  // 2. Fetch Products
  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ['products'],
    queryFn: async () => {
      const { data } = await apiClient.get<Product[]>('/products');
      return data;
    },
  });

  // 3. Fetch Warehouses
  const { data: warehouses = [] } = useQuery<WarehouseItem[]>({
    queryKey: ['warehouses-list'],
    queryFn: async () => {
      try {
        const { data } = await apiClient.get<WarehouseItem[]>('/inventory/warehouses');
        return Array.isArray(data) ? data : [];
      } catch {
        return [];
      }
    },
  });

  // Current selected product object
  const currentProduct = useMemo(() => {
    return products.find((p) => (p._id || (p as any).id) === selectedProductId) || null;
  }, [products, selectedProductId]);

  // Current selected variant object
  const currentVariant = useMemo(() => {
    if (!currentProduct?.variants || !selectedVariantSku) return null;
    return currentProduct.variants.find((v: any) => v.sku === selectedVariantSku) || null;
  }, [currentProduct, selectedVariantSku]);

  // Current stock calculation
  const currentStock = useMemo(() => {
    if (currentVariant) return Number(currentVariant.quantity || 0);
    if (currentProduct) return Number(currentProduct.quantity || 0);
    return 0;
  }, [currentProduct, currentVariant]);

  const uom = currentProduct?.uom || 'pcs';

  // Computed Delta & New Stock
  const { delta, newStock, isValidDelta, validationError } = useMemo(() => {
    if (!currentProduct) {
      return {
        delta: 0,
        newStock: 0,
        isValidDelta: false,
        validationError: 'Please select a product.',
      };
    }

    let calculatedDelta = 0;
    if (mode === 'RELATIVE') {
      const parsed = parseFloat(relativeQtyInput);
      if (isNaN(parsed) || !isFinite(parsed)) {
        return {
          delta: 0,
          newStock: currentStock,
          isValidDelta: false,
          validationError: 'Enter a valid adjustment amount.',
        };
      }
      calculatedDelta = parsed;
    } else {
      const parsed = parseFloat(targetQtyInput);
      if (isNaN(parsed) || !isFinite(parsed) || parsed < 0) {
        return {
          delta: 0,
          newStock: currentStock,
          isValidDelta: false,
          validationError: 'Enter a valid non-negative target quantity.',
        };
      }
      calculatedDelta = parsed - currentStock;
    }

    if (calculatedDelta === 0) {
      return {
        delta: 0,
        newStock: currentStock,
        isValidDelta: false,
        validationError: 'Adjustment delta is 0. Current stock already matches target stock.',
      };
    }

    const computedNewStock = Number((currentStock + calculatedDelta).toFixed(4));
    if (computedNewStock < 0) {
      return {
        delta: calculatedDelta,
        newStock: computedNewStock,
        isValidDelta: false,
        validationError: `Negative stock prohibited. Current: ${currentStock} ${uom}, Adjustment: ${calculatedDelta} ${uom}, Result: ${computedNewStock} ${uom}.`,
      };
    }

    return {
      delta: calculatedDelta,
      newStock: computedNewStock,
      isValidDelta: true,
      validationError: null,
    };
  }, [currentProduct, currentStock, mode, relativeQtyInput, targetQtyInput, uom]);

  // Reason note check
  const isReasonOther = selectedReason === 'Other';
  const isNotesValid = !isReasonOther || notes.trim().length >= 3;

  const canProceedToConfirm =
    Boolean(currentProduct) && isValidDelta && isNotesValid && selectedReason.trim().length > 0;

  // Mutation
  const adjustMutation = useMutation({
    mutationFn: async () => {
      const payload: Record<string, unknown> = {
        productId: selectedProductId,
        type: mode === 'SET' ? 'SET_QUANTITY' : 'RELATIVE',
        quantityDelta: delta,
        targetQuantity: mode === 'SET' ? parseFloat(targetQtyInput) : undefined,
        quantity: Math.abs(delta),
        reason: selectedReason,
        notes: notes.trim() || undefined,
        warehouseId: selectedWarehouseId || undefined,
        variantSku: selectedVariantSku || undefined,
        idempotencyKey: `ADJ-REQ-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      };
      const res = await apiClient.post('/inventory/adjust', payload);
      return res.data;
    },
    onSuccess: () => {
      const prodName = currentProduct?.name || 'Product';
      toast.success(
        `Stock adjusted successfully. ${prodName}: ${currentStock} → ${newStock} (${delta > 0 ? `+${delta}` : delta} ${uom})`
      );
      setOpenConfirm(false);
      setOpenModal(false);
      resetForm();

      // Invalidate all queries immediately so UI updates without reload
      queryClient.invalidateQueries({ queryKey: ['adjustments'] });
      queryClient.invalidateQueries({ queryKey: ['movements'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['valuation'] });
    },
    onError: (err: any) => {
      const msg =
        err.response?.data?.error?.message ||
        err.response?.data?.message ||
        'Failed to adjust stock.';
      toast.error(msg);
    },
  });

  const resetForm = () => {
    setSelectedProductId('');
    setSelectedVariantSku('');
    setSelectedWarehouseId('');
    setMode('RELATIVE');
    setRelativeQtyInput('');
    setTargetQtyInput('');
    setSelectedReason('Incorrect stock entry');
    setNotes('');
  };

  const handleOpenModal = () => {
    resetForm();
    setOpenModal(true);
  };

  // Filtered adjustments
  const filteredAdjustments = useMemo(() => {
    return adjustments.filter((adj) => {
      const prodName = adj.productId?.name || '';
      const prodSku = adj.productId?.sku || '';
      const adjNum = adj.adjustmentNumber || '';
      const userStr = adj.userId?.username || adj.userId?.email || '';

      const matchesSearch =
        !searchQuery ||
        prodName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        prodSku.toLowerCase().includes(searchQuery.toLowerCase()) ||
        adjNum.toLowerCase().includes(searchQuery.toLowerCase()) ||
        userStr.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesReason = filterReason === 'ALL' || adj.reason === filterReason;
      const matchesWarehouse =
        filterWarehouse === 'ALL' || (adj.warehouseId && adj.warehouseId._id === filterWarehouse);

      return matchesSearch && matchesReason && matchesWarehouse;
    });
  }, [adjustments, searchQuery, filterReason, filterWarehouse]);

  // Aggregate stats
  const stats = useMemo(() => {
    const totalCount = adjustments.length;
    let netDelta = 0;
    let entryErrorsCount = 0;
    let damagedCount = 0;

    for (const a of adjustments) {
      netDelta += a.quantityDelta || (a.type === 'REMOVE' ? -a.quantity : a.quantity) || 0;
      const r = (a.reason || '').toLowerCase();
      if (r.includes('entry') || r.includes('counting') || r.includes('correction')) {
        entryErrorsCount++;
      }
      if (r.includes('damaged') || r.includes('expired') || r.includes('lost')) {
        damagedCount++;
      }
    }

    return { totalCount, netDelta, entryErrorsCount, damagedCount };
  }, [adjustments]);

  return (
    <Box sx={{ p: { xs: 2, md: 4 } }}>
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        {/* Header */}
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            mb: 1,
            flexWrap: 'wrap',
            gap: 2,
          }}
        >
          <Box>
            <Typography
              variant="h4"
              sx={{
                fontWeight: 800,
                background: 'linear-gradient(90deg, #fff 0%, #a78bfa 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              Inventory Stock Correction & Adjustments
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Safely correct inventory counts, reverse mistaken stock entries, and maintain an
              authoritative, tenant-isolated stock ledger.
            </Typography>
          </Box>

          <Can permission="products:write">
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={handleOpenModal}
              sx={{
                fontWeight: 700,
                px: 3,
                py: 1.2,
                borderRadius: 2.5,
                textTransform: 'none',
                background: 'linear-gradient(90deg, #8b5cf6 0%, #6366f1 100%)',
                boxShadow: '0 4px 15px rgba(139, 92, 246, 0.3)',
                '&:hover': {
                  background: 'linear-gradient(90deg, #7c3aed 0%, #4f46e5 100%)',
                  boxShadow: '0 6px 20px rgba(139, 92, 246, 0.45)',
                },
              }}
            >
              Correct Stock / Adjust
            </Button>
          </Can>
        </Box>

        {/* Metric Summary Cards */}
        <Grid container spacing={2} sx={{ my: 2 }}>
          <Grid item xs={12} sm={6} md={3}>
            <Card
              className="glass-panel"
              sx={{ p: 2, borderRadius: 3, border: '1px solid rgba(255,255,255,0.05)' }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <HistoryIcon sx={{ color: '#8b5cf6', fontSize: 28 }} />
                <Box>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ fontWeight: 600, textTransform: 'uppercase' }}
                  >
                    Total Adjustments
                  </Typography>
                  <Typography variant="h5" sx={{ fontWeight: 800 }}>
                    {stats.totalCount}
                  </Typography>
                </Box>
              </Box>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card
              className="glass-panel"
              sx={{ p: 2, borderRadius: 3, border: '1px solid rgba(255,255,255,0.05)' }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <TuneIcon
                  sx={{ color: stats.netDelta >= 0 ? '#10b981' : '#f43f5e', fontSize: 28 }}
                />
                <Box>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ fontWeight: 600, textTransform: 'uppercase' }}
                  >
                    Net Stock Corrected
                  </Typography>
                  <Typography
                    variant="h5"
                    sx={{ fontWeight: 800, color: stats.netDelta >= 0 ? '#10b981' : '#f43f5e' }}
                  >
                    {stats.netDelta > 0 ? `+${stats.netDelta}` : stats.netDelta} units
                  </Typography>
                </Box>
              </Box>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card
              className="glass-panel"
              sx={{ p: 2, borderRadius: 3, border: '1px solid rgba(255,255,255,0.05)' }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <CheckCircleIcon sx={{ color: '#3b82f6', fontSize: 28 }} />
                <Box>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ fontWeight: 600, textTransform: 'uppercase' }}
                  >
                    Entry & Count Corrections
                  </Typography>
                  <Typography variant="h5" sx={{ fontWeight: 800 }}>
                    {stats.entryErrorsCount}
                  </Typography>
                </Box>
              </Box>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card
              className="glass-panel"
              sx={{ p: 2, borderRadius: 3, border: '1px solid rgba(255,255,255,0.05)' }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <WarningAmberIcon sx={{ color: '#f59e0b', fontSize: 28 }} />
                <Box>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ fontWeight: 600, textTransform: 'uppercase' }}
                  >
                    Damaged / Loss Write-Offs
                  </Typography>
                  <Typography variant="h5" sx={{ fontWeight: 800 }}>
                    {stats.damagedCount}
                  </Typography>
                </Box>
              </Box>
            </Card>
          </Grid>
        </Grid>

        {/* Filter Bar */}
        <Box sx={{ display: 'flex', gap: 2, my: 3, flexWrap: 'wrap' }}>
          <TextField
            placeholder="Search by Product, SKU, Adjustment #, Auditor..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            sx={{ flex: 1, minWidth: 260 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ color: 'text.secondary' }} />
                </InputAdornment>
              ),
            }}
          />

          <TextField
            select
            label="Filter Reason"
            value={filterReason}
            onChange={(e) => setFilterReason(e.target.value)}
            sx={{ minWidth: 200 }}
          >
            <MenuItem value="ALL">All Reasons</MenuItem>
            {STANDARDIZED_REASONS.map((r) => (
              <MenuItem key={r} value={r}>
                {r}
              </MenuItem>
            ))}
          </TextField>

          {warehouses.length > 0 && (
            <TextField
              select
              label="Filter Warehouse"
              value={filterWarehouse}
              onChange={(e) => setFilterWarehouse(e.target.value)}
              sx={{ minWidth: 180 }}
            >
              <MenuItem value="ALL">All Warehouses</MenuItem>
              {warehouses.map((w) => (
                <MenuItem key={w._id} value={w._id}>
                  {w.name} ({w.code})
                </MenuItem>
              ))}
            </TextField>
          )}
        </Box>

        {/* Adjustments History Table */}
        <TableContainer
          component={Paper}
          className="glass-panel"
          sx={{
            border: '1px solid rgba(255, 255, 255, 0.05)',
            background:
              'linear-gradient(135deg, rgba(30, 41, 59, 0.6) 0%, rgba(15, 23, 42, 0.75) 100%)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
            borderRadius: 3,
          }}
        >
          <Table>
            <TableHead sx={{ bgcolor: 'rgba(17, 24, 39, 0.6)' }}>
              <TableRow>
                <TableCell sx={{ fontWeight: 800 }}>Date & ID</TableCell>
                <TableCell sx={{ fontWeight: 800 }}>Product / SKU</TableCell>
                <TableCell sx={{ fontWeight: 800 }}>Warehouse</TableCell>
                <TableCell sx={{ fontWeight: 800 }} align="right">
                  Previous
                </TableCell>
                <TableCell sx={{ fontWeight: 800 }} align="center">
                  Adjustment
                </TableCell>
                <TableCell sx={{ fontWeight: 800 }} align="right">
                  Resulting
                </TableCell>
                <TableCell sx={{ fontWeight: 800 }}>Reason / Notes</TableCell>
                <TableCell sx={{ fontWeight: 800 }}>Auditor</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loadingAdjustments ? (
                <TableRow>
                  <TableCell colSpan={8} align="center" sx={{ py: 6 }}>
                    <CircularProgress size={32} />
                  </TableCell>
                </TableRow>
              ) : filteredAdjustments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} align="center" sx={{ py: 6, color: 'text.secondary' }}>
                    No stock adjustments found matching your filter criteria.
                  </TableCell>
                </TableRow>
              ) : (
                filteredAdjustments.map((adj) => {
                  const deltaVal =
                    adj.quantityDelta !== undefined
                      ? adj.quantityDelta
                      : adj.type === 'REMOVE'
                        ? -adj.quantity
                        : adj.quantity;
                  const isPositive = deltaVal > 0;
                  const uomVal = adj.productId?.uom || 'pcs';

                  return (
                    <TableRow
                      key={adj._id}
                      sx={{ '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.02)' } }}
                    >
                      <TableCell sx={{ py: 1.5 }}>
                        <Typography variant="body2" sx={{ fontWeight: 700 }}>
                          {adj.adjustmentNumber}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {new Date(adj.createdAt).toLocaleString()}
                        </Typography>
                      </TableCell>

                      <TableCell>
                        <Typography variant="body2" sx={{ fontWeight: 700 }}>
                          {adj.productId?.name || 'Unknown Product'}
                        </Typography>
                        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                          <Typography variant="caption" color="text.secondary">
                            SKU: {adj.productId?.sku || 'N/A'}
                          </Typography>
                          {adj.variantSku && (
                            <Chip
                              label={`Variant: ${adj.variantSku}`}
                              size="small"
                              sx={{ height: 18, fontSize: '0.65rem' }}
                            />
                          )}
                        </Box>
                      </TableCell>

                      <TableCell>
                        {adj.warehouseId ? (
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <WarehouseIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                            <Typography variant="body2">{adj.warehouseId.name}</Typography>
                          </Box>
                        ) : (
                          <Typography variant="caption" color="text.secondary">
                            Central Catalog
                          </Typography>
                        )}
                      </TableCell>

                      <TableCell align="right">
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {adj.previousQuantity !== undefined ? adj.previousQuantity : '—'} {uomVal}
                        </Typography>
                      </TableCell>

                      <TableCell align="center">
                        <Chip
                          label={`${isPositive ? `+${deltaVal}` : deltaVal} ${uomVal}`}
                          size="small"
                          color={isPositive ? 'success' : 'error'}
                          sx={{ fontWeight: 800, fontSize: '0.8rem', minWidth: 80 }}
                        />
                      </TableCell>

                      <TableCell align="right">
                        <Typography variant="body2" sx={{ fontWeight: 700, color: '#a78bfa' }}>
                          {adj.newQuantity !== undefined ? adj.newQuantity : '—'} {uomVal}
                        </Typography>
                      </TableCell>

                      <TableCell>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {adj.reason}
                        </Typography>
                        {adj.notes && (
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            sx={{ display: 'block', maxWidth: 220 }}
                          >
                            {adj.notes}
                          </Typography>
                        )}
                      </TableCell>

                      <TableCell>
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>
                          {adj.userId?.username || adj.userId?.email || 'System'}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>

        {/* MODAL 1: Stock Adjustment Creator */}
        <Dialog
          open={openModal}
          onClose={() => setOpenModal(false)}
          maxWidth="md"
          fullWidth
          PaperProps={{
            sx: {
              background:
                'linear-gradient(135deg, rgba(23, 27, 44, 0.98) 0%, rgba(11, 13, 26, 0.99) 100%)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(139, 92, 246, 0.25)',
              borderRadius: 4,
            },
          }}
        >
          <DialogTitle component="div" sx={{ fontWeight: 800, pb: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <TuneIcon sx={{ color: '#8b5cf6' }} />
              <Typography variant="h5" component="h2" sx={{ fontWeight: 800 }}>
                Inventory Stock Correction
              </Typography>
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              Correct accidental over-entries, adjust stock up or down, or set true physical counts.
            </Typography>
          </DialogTitle>

          <DialogContent sx={{ pt: 2 }}>
            <Grid container spacing={2.5}>
              {/* Product Selection */}
              <Grid item xs={12}>
                <TextField
                  select
                  label="Select Product to Correct"
                  fullWidth
                  value={selectedProductId}
                  onChange={(e) => {
                    setSelectedProductId(e.target.value);
                    setSelectedVariantSku('');
                  }}
                  InputLabelProps={{ shrink: true }}
                >
                  <MenuItem value="" disabled>
                    -- Choose Product --
                  </MenuItem>
                  {products.map((p) => (
                    <MenuItem key={p._id || (p as any).id} value={p._id || (p as any).id}>
                      {p.name} ({p.sku}) — Current Stock: {p.quantity} {p.uom || 'pcs'}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>

              {/* Variant Selection (Conditional) */}
              {currentProduct?.variants && currentProduct.variants.length > 0 && (
                <Grid item xs={12} sm={6}>
                  <TextField
                    select
                    label="Product Variant"
                    fullWidth
                    value={selectedVariantSku}
                    onChange={(e) => setSelectedVariantSku(e.target.value)}
                    InputLabelProps={{ shrink: true }}
                  >
                    <MenuItem value="">Parent Product (All Variants)</MenuItem>
                    {currentProduct.variants.map((v: any) => (
                      <MenuItem key={v.sku} value={v.sku}>
                        {v.name} ({v.sku}) — Variant Stock: {v.quantity}
                      </MenuItem>
                    ))}
                  </TextField>
                </Grid>
              )}

              {/* Warehouse Selection */}
              {warehouses.length > 0 && (
                <Grid item xs={12} sm={currentProduct?.variants?.length ? 6 : 12}>
                  <TextField
                    select
                    label="Warehouse / Location"
                    fullWidth
                    value={selectedWarehouseId}
                    onChange={(e) => setSelectedWarehouseId(e.target.value)}
                    InputLabelProps={{ shrink: true }}
                  >
                    <MenuItem value="">Central Inventory</MenuItem>
                    {warehouses.map((w) => (
                      <MenuItem key={w._id} value={w._id}>
                        {w.name} ({w.code})
                      </MenuItem>
                    ))}
                  </TextField>
                </Grid>
              )}

              {/* Adjustment Mode Switcher */}
              <Grid item xs={12}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
                  Adjustment Semantics Mode:
                </Typography>
                <ToggleButtonGroup
                  value={mode}
                  exclusive
                  onChange={(_e, val) => val && setMode(val)}
                  fullWidth
                  sx={{
                    bgcolor: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: 2,
                  }}
                >
                  <ToggleButton
                    value="RELATIVE"
                    sx={{ py: 1.2, fontWeight: 700, textTransform: 'none' }}
                  >
                    Mode 1: Relative Adjustment (+ / -)
                  </ToggleButton>
                  <ToggleButton
                    value="SET"
                    sx={{ py: 1.2, fontWeight: 700, textTransform: 'none' }}
                  >
                    Mode 2: Set Correct Quantity (Target)
                  </ToggleButton>
                </ToggleButtonGroup>
              </Grid>

              {/* Mode 1: Relative Quantity Input */}
              {mode === 'RELATIVE' && (
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="Adjustment Quantity (e.g. -100 or +50)"
                    type="number"
                    fullWidth
                    value={relativeQtyInput}
                    onChange={(e) => setRelativeQtyInput(e.target.value)}
                    placeholder="-100"
                    helperText={`Enter positive number to add stock, negative to reduce stock. Unit: ${uom}`}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
              )}

              {/* Mode 2: Set Correct Quantity Input */}
              {mode === 'SET' && (
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="Correct Physical Quantity (Target)"
                    type="number"
                    fullWidth
                    value={targetQtyInput}
                    onChange={(e) => setTargetQtyInput(e.target.value)}
                    placeholder="100"
                    helperText={`Enter the exact verified inventory count. System will calculate correction delta. Unit: ${uom}`}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
              )}

              {/* Reason Selection */}
              <Grid item xs={12} sm={6}>
                <TextField
                  select
                  label="Adjustment Reason"
                  fullWidth
                  value={selectedReason}
                  onChange={(e) => setSelectedReason(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                >
                  {STANDARDIZED_REASONS.map((r) => (
                    <MenuItem key={r} value={r}>
                      {r}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>

              {/* Notes */}
              <Grid item xs={12}>
                <TextField
                  label={
                    isReasonOther
                      ? 'Explanatory Note (Mandatory for "Other")'
                      : 'Additional Notes (Optional)'
                  }
                  fullWidth
                  multiline
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Correcting mistaken +200 receiving entry from PO #1004"
                  error={isReasonOther && notes.trim().length < 3}
                  helperText={
                    isReasonOther && notes.trim().length < 3
                      ? 'When reason is "Other", please enter an explanation of at least 3 characters.'
                      : ''
                  }
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>

              {/* LIVE INTERACTIVE CALCULATION CARD */}
              {currentProduct && (
                <Grid item xs={12}>
                  <Card
                    sx={{
                      p: 2.5,
                      borderRadius: 3,
                      background: isValidDelta
                        ? 'linear-gradient(135deg, rgba(139, 92, 246, 0.1) 0%, rgba(59, 130, 246, 0.1) 100%)'
                        : 'linear-gradient(135deg, rgba(239, 68, 68, 0.1) 0%, rgba(220, 38, 38, 0.05) 100%)',
                      border: isValidDelta
                        ? '1px solid rgba(139, 92, 246, 0.3)'
                        : '1px solid rgba(239, 68, 68, 0.3)',
                    }}
                  >
                    <Typography
                      variant="subtitle2"
                      sx={{ fontWeight: 800, mb: 1.5, color: '#a78bfa' }}
                    >
                      ⚡ LIVE INVENTORY CALCULATION PREVIEW:
                    </Typography>

                    <Grid container spacing={2} alignItems="center">
                      <Grid item xs={12} sm={3.5} textAlign="center">
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          sx={{ textTransform: 'uppercase', fontWeight: 600 }}
                        >
                          Current Stock
                        </Typography>
                        <Typography variant="h5" sx={{ fontWeight: 800 }}>
                          {currentStock} {uom}
                        </Typography>
                      </Grid>

                      <Grid item xs={12} sm={0.7} textAlign="center">
                        <ArrowForwardIcon
                          sx={{
                            color: 'text.secondary',
                            display: { xs: 'none', sm: 'inline-block' },
                          }}
                        />
                      </Grid>

                      <Grid item xs={12} sm={3.5} textAlign="center">
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          sx={{ textTransform: 'uppercase', fontWeight: 600 }}
                        >
                          Adjustment Delta
                        </Typography>
                        <Typography
                          variant="h5"
                          sx={{
                            fontWeight: 800,
                            color: delta > 0 ? '#10b981' : delta < 0 ? '#f43f5e' : 'text.secondary',
                          }}
                        >
                          {delta > 0 ? `+${delta}` : delta} {uom}
                        </Typography>
                      </Grid>

                      <Grid item xs={12} sm={0.7} textAlign="center">
                        <ArrowForwardIcon
                          sx={{
                            color: 'text.secondary',
                            display: { xs: 'none', sm: 'inline-block' },
                          }}
                        />
                      </Grid>

                      <Grid item xs={12} sm={3.6} textAlign="center">
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          sx={{ textTransform: 'uppercase', fontWeight: 600 }}
                        >
                          New Stock
                        </Typography>
                        <Typography
                          variant="h5"
                          sx={{
                            fontWeight: 900,
                            color: newStock >= 0 ? '#a78bfa' : '#f43f5e',
                          }}
                        >
                          {newStock} {uom}
                        </Typography>
                      </Grid>
                    </Grid>

                    {validationError && (
                      <Alert severity="warning" sx={{ mt: 2, borderRadius: 2 }}>
                        {validationError}
                      </Alert>
                    )}
                  </Card>
                </Grid>
              )}
            </Grid>
          </DialogContent>

          <DialogActions sx={{ p: 3, pt: 1 }}>
            <Button
              onClick={() => setOpenModal(false)}
              sx={{ fontWeight: 600, color: 'text.secondary' }}
            >
              Cancel
            </Button>
            <Button
              variant="contained"
              disabled={!canProceedToConfirm}
              onClick={() => setOpenConfirm(true)}
              sx={{
                fontWeight: 800,
                px: 3,
                borderRadius: 2,
                background: 'linear-gradient(90deg, #8b5cf6 0%, #6366f1 100%)',
              }}
            >
              Review & Confirm
            </Button>
          </DialogActions>
        </Dialog>

        {/* MODAL 2: Explicit Confirmation Summary Dialog */}
        <Dialog
          open={openConfirm}
          onClose={() => !adjustMutation.isPending && setOpenConfirm(false)}
          maxWidth="xs"
          fullWidth
          PaperProps={{
            sx: {
              background:
                'linear-gradient(135deg, rgba(23, 27, 44, 0.99) 0%, rgba(11, 13, 26, 1) 100%)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(139, 92, 246, 0.35)',
              borderRadius: 4,
            },
          }}
        >
          <DialogTitle component="div" sx={{ fontWeight: 800, textAlign: 'center', pt: 3 }}>
            <WarningAmberIcon sx={{ color: '#f59e0b', fontSize: 44, mb: 1 }} />
            <Typography variant="h5" component="h2" sx={{ fontWeight: 800 }}>
              Confirm Stock Adjustment
            </Typography>
          </DialogTitle>

          <DialogContent sx={{ px: 3 }}>
            <Box
              sx={{
                p: 2,
                bgcolor: 'rgba(255, 255, 255, 0.03)',
                borderRadius: 2.5,
                border: '1px solid rgba(255, 255, 255, 0.08)',
                display: 'flex',
                flexDirection: 'column',
                gap: 1.2,
              }}
            >
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="body2" color="text.secondary">
                  Product:
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 700 }}>
                  {currentProduct?.name}
                </Typography>
              </Box>

              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="body2" color="text.secondary">
                  SKU:
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {currentProduct?.sku}
                </Typography>
              </Box>

              {currentVariant && (
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2" color="text.secondary">
                    Variant:
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {currentVariant.name} ({currentVariant.sku})
                  </Typography>
                </Box>
              )}

              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="body2" color="text.secondary">
                  Warehouse:
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {warehouses.find((w) => w._id === selectedWarehouseId)?.name || 'Central Catalog'}
                </Typography>
              </Box>

              <Divider sx={{ my: 0.5 }} />

              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="body2" color="text.secondary">
                  Current Stock:
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 700 }}>
                  {currentStock} {uom}
                </Typography>
              </Box>

              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="body2" color="text.secondary">
                  Adjustment:
                </Typography>
                <Typography
                  variant="body2"
                  sx={{ fontWeight: 800, color: delta > 0 ? '#10b981' : '#f43f5e' }}
                >
                  {delta > 0 ? `+${delta}` : delta} {uom}
                </Typography>
              </Box>

              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="body2" color="text.secondary">
                  New Stock:
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 900, color: '#a78bfa' }}>
                  {newStock} {uom}
                </Typography>
              </Box>

              <Divider sx={{ my: 0.5 }} />

              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="body2" color="text.secondary">
                  Reason:
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {selectedReason}
                </Typography>
              </Box>

              {notes && (
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2" color="text.secondary">
                    Notes:
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 500, maxWidth: 180 }} noWrap>
                    {notes}
                  </Typography>
                </Box>
              )}
            </Box>

            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ display: 'block', mt: 2, textAlign: 'center' }}
            >
              This action will permanently record an auditable inventory correction ledger entry.
            </Typography>
          </DialogContent>

          <DialogActions sx={{ p: 3, pt: 1, justifyContent: 'space-between' }}>
            <Button
              onClick={() => setOpenConfirm(false)}
              disabled={adjustMutation.isPending}
              sx={{ fontWeight: 600, color: 'text.secondary' }}
            >
              Back
            </Button>
            <Button
              variant="contained"
              disabled={adjustMutation.isPending}
              onClick={() => adjustMutation.mutate()}
              sx={{
                fontWeight: 800,
                px: 3,
                borderRadius: 2,
                background: 'linear-gradient(90deg, #8b5cf6 0%, #3b82f6 100%)',
              }}
            >
              {adjustMutation.isPending ? (
                <CircularProgress size={20} color="inherit" />
              ) : (
                'Confirm & Apply'
              )}
            </Button>
          </DialogActions>
        </Dialog>
      </motion.div>
    </Box>
  );
}
