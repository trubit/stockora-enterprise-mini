import React, { useState } from 'react';
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
  IconButton,
  Tooltip,
  Tab,
  Tabs,
  InputAdornment,
  Divider,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import Inventory2Icon from '@mui/icons-material/Inventory2';
import FlashOnIcon from '@mui/icons-material/FlashOn';
import SearchIcon from '@mui/icons-material/Search';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { apiClient } from '../../api/client.ts';
import { toast } from 'react-hot-toast';
import { notify } from '../../utils/notify.ts';
import { useConfirm } from '../../context/ConfirmDialogContext.tsx';
import type { Product } from '../../../shared/types.js';
import { motion } from 'framer-motion';
import { usePermission } from '../../hooks/usePermission.js';
import { useRegionalSettings } from '../../hooks/useRegionalSettings.js';
import { CurrencySelector } from '../../components/CurrencySelector.tsx';
import { SUPPORTED_CURRENCIES, getCurrencyInfo } from '../../../shared/currencies.js';

const textFieldStyle = {};

export default function ProductCatalog() {
  const confirm = useConfirm();
  const { formatAmount, convertAmount, activeCurrency, baseCurrency, currencySymbol } =
    useRegionalSettings();
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [imageUrl, setImageUrl] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [formCurrency, setFormCurrency] = useState<string>(baseCurrency || 'NGN');

  // Quick Restock State
  const [restockDialogOpen, setRestockDialogOpen] = useState(false);
  const [restockProduct, setRestockProduct] = useState<Product | null>(null);
  const [restockQuantity, setRestockQuantity] = useState<number>(10);
  const [restockCostPrice, setRestockCostPrice] = useState<number>(0);
  const [restockReason, setRestockReason] = useState<string>('Supplier Delivery / Restock');

  const canWriteProducts = usePermission('products:write');

  const { data: products = [], refetch } = useQuery({
    queryKey: ['products'],
    queryFn: async () => {
      const { data } = await apiClient.get<Product[]>('/products');
      return data;
    },
  });

  const { register, handleSubmit, reset, setValue } = useForm<Product>({
    defaultValues: {
      name: '',
      sku: '',
      barcode: '',
      category: '',
      subcategory: '',
      brand: '',
      uom: 'pcs',
      costPrice: 0,
      sellingPrice: 0,
      wholesalePrice: 0,
      retailPrice: 0,
      quantity: 0,
      lowStockAlert: 10,
      status: 'ACTIVE',
      isActive: true,
      notes: '',
      width: 0,
      height: 0,
      depth: 0,
      weight: 0,
    },
  });

  const createMutation = useMutation({
    mutationFn: async (newProduct: Product) => {
      return await apiClient.post('/products', newProduct);
    },
    onSuccess: () => {
      notify.success('Product registered successfully!');
      setOpen(false);
      reset();
      setImageUrl('');
      refetch();
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (updatedProduct: Product) => {
      return await apiClient.put(
        `/products/${editingProduct?._id || editingProduct?.id}`,
        updatedProduct
      );
    },
    onSuccess: () => {
      notify.success('Product updated successfully!');
      setOpen(false);
      setEditingProduct(null);
      reset();
      setImageUrl('');
      refetch();
    },
  });

  const restockMutation = useMutation({
    mutationFn: async ({
      productId,
      quantity,
      costPrice,
      reason,
    }: {
      productId: string;
      quantity: number;
      costPrice: number;
      reason: string;
    }) => {
      return await apiClient.post(`/products/${productId}/stock`, {
        quantity,
        costPrice,
        reason,
      });
    },
    onSuccess: () => {
      notify.success('Stock added successfully!');
      setRestockDialogOpen(false);
      refetch();
    },
    onError: (err: any) => {
      notify.error(err, { fallback: 'Failed to restock product.' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiClient.delete(`/products/${id}`);
    },
    onSuccess: () => {
      notify.success('Product deactivated successfully.');
      refetch();
    },
  });

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    const formData = new FormData();
    formData.append('file', file);

    try {
      const { data } = await apiClient.post<{ url: string }>('/upload/image', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setImageUrl(data.url);
      setValue('imageUrl', data.url);
      toast.success('Product image uploaded successfully!');
    } catch {
      toast.error('Failed to upload image.');
    }
  };

  const handleAutoGenerateSku = () => {
    const random = Math.floor(1000 + Math.random() * 9000);
    const sku = `SKU-PROD-${random}`;
    setValue('sku', sku);
    toast.success('SKU generated successfully!');
  };

  const handleOpenCreate = () => {
    setEditingProduct(null);
    setImageUrl('');
    const initialCurr = baseCurrency || 'NGN';
    setFormCurrency(initialCurr);
    reset({
      name: '',
      sku: '',
      barcode: '',
      category: '',
      subcategory: '',
      brand: '',
      uom: 'pcs',
      costPrice: 0,
      sellingPrice: 0,
      wholesalePrice: 0,
      retailPrice: 0,
      quantity: 10,
      lowStockAlert: 5,
      status: 'ACTIVE',
      isActive: true,
      notes: '',
      width: 0,
      height: 0,
      depth: 0,
      weight: 0,
      currency: initialCurr,
    });
    setOpen(true);
  };

  const handleOpenEdit = (product: Product) => {
    setEditingProduct(product);
    setImageUrl(product.imageUrl || '');
    const editCurr = product.currency || baseCurrency || 'NGN';
    setFormCurrency(editCurr);
    reset({
      ...product,
      costPrice: Number(product.costPrice ?? product.cost ?? 0),
      sellingPrice: Number(product.sellingPrice ?? product.price ?? 0),
      wholesalePrice: Number(product.wholesalePrice ?? 0),
      retailPrice: Number(product.retailPrice ?? 0),
      quantity: product.quantity ?? (product as any).stock ?? 0,
      lowStockAlert: product.lowStockAlert ?? 10,
      currency: editCurr,
    });
    setOpen(true);
  };

  const handleOpenRestock = (product: Product) => {
    setRestockProduct(product);
    setRestockQuantity(10);
    const rawCost = Number(product.costPrice || product.cost || 0);
    setRestockCostPrice(Number(convertAmount(rawCost, baseCurrency, activeCurrency).toFixed(2)));
    setRestockReason('Supplier Delivery / Restock');
    setRestockDialogOpen(true);
  };

  const handleExecuteRestock = (e: React.FormEvent) => {
    e.preventDefault();
    if (!restockProduct) return;
    const id = restockProduct._id || restockProduct.id;
    if (!id) return;

    if (restockQuantity <= 0) {
      notify.error('Restock quantity must be greater than 0.');
      return;
    }

    // Convert costPrice back to base currency
    const baseCostPrice = convertAmount(
      Number(restockCostPrice || 0),
      activeCurrency,
      baseCurrency
    );

    restockMutation.mutate({
      productId: id,
      quantity: Number(restockQuantity),
      costPrice: baseCostPrice,
      reason: restockReason || 'Supplier Delivery / Restock',
    });
  };

  const onSubmit = (data: Product) => {
    const rawCost = Number(data.costPrice || 0);
    const rawRetail = Number(
      data.retailPrice !== undefined &&
        data.retailPrice !== null &&
        data.retailPrice !== ('' as any)
        ? data.retailPrice
        : data.sellingPrice || 0
    );
    const rawWholesale = Number(data.wholesalePrice || 0);
    const rawSelling = Number(data.sellingPrice || rawRetail);

    const payload = {
      ...data,
      costPrice: rawCost,
      cost: rawCost,
      sellingPrice: rawSelling,
      price: rawRetail || rawSelling,
      retailPrice: rawRetail,
      wholesalePrice: rawWholesale,
      quantity: Number(data.quantity || 0),
      lowStockAlert: Number(data.lowStockAlert || 10),
      width: Number(data.width || 0),
      height: Number(data.height || 0),
      depth: Number(data.depth || 0),
      weight: Number(data.weight || 0),
      imageUrl,
      currency: formCurrency || data.currency || baseCurrency || 'NGN',
    };
    if (editingProduct) {
      updateMutation.mutate(payload);
    } else {
      createMutation.mutate(payload);
    }
  };

  const filteredProducts = products.filter(
    (p) =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <Box sx={{ p: { xs: 2, md: 4 } }}>
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <Box
          sx={{
            display: 'flex',
            flexDirection: { xs: 'column', sm: 'row' },
            justifyContent: 'space-between',
            alignItems: { xs: 'flex-start', sm: 'center' },
            gap: 2,
            mb: 1,
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
              Product Catalog & Stock Management
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              Add, modify, attribute, track inventory levels, and restock catalog items for all
              branches.
            </Typography>
          </Box>

          <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', flexWrap: 'wrap' }}>
            <CurrencySelector size="small" />
            {canWriteProducts && (
              <>
                <Button
                  variant="outlined"
                  startIcon={<FlashOnIcon />}
                  onClick={() => {
                    if (products.length > 0) {
                      handleOpenRestock(products[0]);
                    } else {
                      notify.error('Please create a product first before restocking.');
                    }
                  }}
                  sx={{
                    fontWeight: 700,
                    px: 2.5,
                    py: 1,
                    borderRadius: 2.5,
                    textTransform: 'none',
                    borderColor: 'rgba(16, 185, 129, 0.5)',
                    color: '#10b981',
                    backgroundColor: 'rgba(16, 185, 129, 0.08)',
                    '&:hover': {
                      borderColor: '#10b981',
                      backgroundColor: 'rgba(16, 185, 129, 0.16)',
                    },
                  }}
                >
                  Quick Restock
                </Button>

                <Button
                  variant="contained"
                  startIcon={<AddIcon />}
                  onClick={handleOpenCreate}
                  sx={{
                    fontWeight: 700,
                    px: 3,
                    py: 1,
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
                  Add Product
                </Button>
              </>
            )}
          </Box>
        </Box>

        <Box sx={{ mb: 3, mt: 3 }}>
          <TextField
            label="Search Products by Name, SKU, or Category..."
            fullWidth
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ color: 'text.secondary' }} />
                </InputAdornment>
              ),
            }}
            sx={textFieldStyle}
          />
        </Box>

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
            <TableHead sx={{ bgcolor: 'rgba(17, 24, 39, 0.5)' }}>
              <TableRow>
                <TableCell
                  sx={{ fontWeight: 800, borderBottom: '1px solid rgba(255,255,255,0.05)' }}
                >
                  Product Details
                </TableCell>
                <TableCell
                  sx={{ fontWeight: 800, borderBottom: '1px solid rgba(255,255,255,0.05)' }}
                >
                  SKU
                </TableCell>
                <TableCell
                  sx={{ fontWeight: 800, borderBottom: '1px solid rgba(255,255,255,0.05)' }}
                >
                  Category
                </TableCell>
                <TableCell
                  sx={{ fontWeight: 800, borderBottom: '1px solid rgba(255,255,255,0.05)' }}
                >
                  Cost / Sale Price
                </TableCell>
                <TableCell
                  sx={{ fontWeight: 800, borderBottom: '1px solid rgba(255,255,255,0.05)' }}
                >
                  Current Stock Level
                </TableCell>
                <TableCell
                  sx={{ fontWeight: 800, borderBottom: '1px solid rgba(255,255,255,0.05)' }}
                >
                  Status
                </TableCell>
                <TableCell
                  sx={{
                    fontWeight: 800,
                    borderBottom: '1px solid rgba(255,255,255,0.05)',
                    textAlign: 'right',
                  }}
                >
                  Actions
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredProducts.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    align="center"
                    sx={{ py: 6, color: 'text.secondary', border: 'none' }}
                  >
                    No products found matching your search. Click <strong>+ Add Product</strong> to
                    register an item.
                  </TableCell>
                </TableRow>
              ) : (
                filteredProducts.map((p) => {
                  const qty = Number(p.quantity ?? (p as any).stock ?? 0);
                  const alertLevel = Number(p.lowStockAlert ?? 10);
                  const isOutOfStock = qty <= 0 || p.status === 'OUT_OF_STOCK';
                  const isLowStock = !isOutOfStock && qty <= alertLevel;

                  return (
                    <TableRow
                      key={p._id || p.id}
                      sx={{ '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.02)' } }}
                    >
                      <TableCell sx={{ borderBottom: '1px solid rgba(255,255,255,0.03)', py: 2 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                          {p.imageUrl ? (
                            <img
                              src={p.imageUrl}
                              alt={p.name}
                              style={{
                                width: 44,
                                height: 44,
                                borderRadius: 6,
                                objectFit: 'cover',
                                border: '1px solid rgba(255,255,255,0.1)',
                              }}
                            />
                          ) : (
                            <Box
                              sx={{
                                width: 44,
                                height: 44,
                                borderRadius: 6,
                                bgcolor: 'rgba(255,255,255,0.05)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                border: '1px solid rgba(255,255,255,0.08)',
                                fontWeight: 700,
                              }}
                            >
                              {p.name.slice(0, 1).toUpperCase()}
                            </Box>
                          )}
                          <Box>
                            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                              {p.name}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {p.brand || 'No Brand'} • {p.uom || 'pcs'}
                            </Typography>
                          </Box>
                        </Box>
                      </TableCell>
                      <TableCell sx={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                        <Chip
                          label={p.sku}
                          size="small"
                          variant="outlined"
                          sx={{ fontWeight: 700, color: 'primary.light' }}
                        />
                      </TableCell>
                      <TableCell
                        sx={{ borderBottom: '1px solid rgba(255,255,255,0.03)', fontWeight: 500 }}
                      >
                        {p.category}
                      </TableCell>
                      <TableCell sx={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography
                              variant="body2"
                              sx={{ fontWeight: 800, color: 'text.primary' }}
                            >
                              {formatAmount(p.sellingPrice ?? p.price ?? 0, {
                                fromCurrency: p.currency || baseCurrency,
                                currency: activeCurrency,
                              })}
                            </Typography>
                            <Chip
                              label={p.currency || baseCurrency}
                              size="small"
                              variant="outlined"
                              sx={{
                                height: '18px',
                                fontSize: '0.62rem',
                                fontWeight: 800,
                                borderColor: 'rgba(99, 102, 241, 0.4)',
                                color: '#a5b4fc',
                              }}
                            />
                          </Box>
                          <Typography variant="caption" color="text.secondary">
                            Retail:{' '}
                            <strong>
                              {formatAmount(p.retailPrice ?? p.sellingPrice ?? 0, {
                                fromCurrency: p.currency || baseCurrency,
                                currency: activeCurrency,
                              })}
                            </strong>{' '}
                            • Wholesale:{' '}
                            <strong>
                              {p.wholesalePrice != null && Number(p.wholesalePrice) > 0
                                ? formatAmount(p.wholesalePrice, {
                                    fromCurrency: p.currency || baseCurrency,
                                    currency: activeCurrency,
                                  })
                                : '—'}
                            </strong>
                          </Typography>
                          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.45)' }}>
                            Cost:{' '}
                            {formatAmount(p.costPrice ?? p.cost ?? 0, {
                              fromCurrency: p.currency || baseCurrency,
                              currency: activeCurrency,
                            })}
                          </Typography>
                        </Box>
                      </TableCell>

                      {/* Stock Level Column */}
                      <TableCell sx={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          {isOutOfStock ? (
                            <Chip
                              icon={<ErrorOutlineIcon fontSize="small" />}
                              label="0 Out of Stock"
                              size="small"
                              color="error"
                              sx={{ fontWeight: 700 }}
                            />
                          ) : isLowStock ? (
                            <Chip
                              icon={<WarningAmberIcon fontSize="small" />}
                              label={`${qty} Low Stock`}
                              size="small"
                              color="warning"
                              sx={{ fontWeight: 700 }}
                            />
                          ) : (
                            <Chip
                              icon={<CheckCircleOutlineIcon fontSize="small" />}
                              label={`${qty} in Stock`}
                              size="small"
                              color="success"
                              sx={{ fontWeight: 700 }}
                            />
                          )}
                        </Box>
                      </TableCell>

                      <TableCell sx={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                        <Chip
                          label={p.status}
                          size="small"
                          color={
                            p.status === 'ACTIVE'
                              ? 'success'
                              : p.status === 'OUT_OF_STOCK'
                                ? 'error'
                                : 'default'
                          }
                          sx={{ fontWeight: 700 }}
                        />
                      </TableCell>
                      <TableCell
                        sx={{
                          borderBottom: '1px solid rgba(255,255,255,0.03)',
                          textAlign: 'right',
                        }}
                      >
                        {canWriteProducts && (
                          <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 1 }}>
                            <Button
                              variant="outlined"
                              size="small"
                              startIcon={<FlashOnIcon fontSize="small" />}
                              onClick={() => handleOpenRestock(p)}
                              sx={{
                                textTransform: 'none',
                                fontWeight: 700,
                                fontSize: '0.75rem',
                                py: 0.4,
                                px: 1.2,
                                borderRadius: '6px',
                                borderColor: isOutOfStock ? 'error.main' : 'primary.main',
                                color: isOutOfStock ? 'error.light' : 'primary.light',
                                backgroundColor: isOutOfStock
                                  ? 'rgba(239, 68, 68, 0.08)'
                                  : 'rgba(99, 102, 241, 0.08)',
                                '&:hover': {
                                  backgroundColor: isOutOfStock
                                    ? 'rgba(239, 68, 68, 0.16)'
                                    : 'rgba(99, 102, 241, 0.16)',
                                },
                              }}
                            >
                              Add Stock
                            </Button>

                            <Tooltip title="Edit Product">
                              <IconButton
                                onClick={() => handleOpenEdit(p)}
                                sx={{ color: 'primary.light' }}
                                size="small"
                              >
                                <EditIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>

                            <Tooltip title="Deactivate Product">
                              <IconButton
                                onClick={async () => {
                                  const pid = p._id || p.id;
                                  if (!pid) return;
                                  const confirmed = await confirm({
                                    title: 'Deactivate Product',
                                    message: `Are you sure you want to deactivate "${p.name}" (${p.sku})? It will be removed from active sale registers and POS search.`,
                                    confirmText: 'Deactivate',
                                    severity: 'error',
                                  });
                                  if (confirmed) {
                                    deleteMutation.mutate(pid);
                                  }
                                }}
                                sx={{ color: 'error.light' }}
                                size="small"
                              >
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </Box>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>

        {/* Quick Add Stock / Restock Dialog */}
        <Dialog
          open={restockDialogOpen}
          onClose={() => setRestockDialogOpen(false)}
          maxWidth="sm"
          fullWidth
          PaperProps={{
            sx: {
              background:
                'linear-gradient(135deg, rgba(23, 27, 44, 0.98) 0%, rgba(11, 13, 26, 0.99) 100%)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              borderRadius: 4,
            },
          }}
        >
          <form onSubmit={handleExecuteRestock}>
            <DialogTitle
              sx={{
                fontWeight: 800,
                background: 'linear-gradient(90deg, #10b981 0%, #34d399 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                display: 'flex',
                alignItems: 'center',
                gap: 1.5,
              }}
            >
              <Inventory2Icon sx={{ color: '#10b981' }} />
              Add Stock / Restock Product
            </DialogTitle>
            <DialogContent sx={{ pt: 2 }}>
              {restockProduct && (
                <Box
                  sx={{
                    mb: 3,
                    p: 2,
                    borderRadius: 2,
                    bgcolor: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.08)',
                  }}
                >
                  <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#fff' }}>
                    {restockProduct.name}
                  </Typography>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ display: 'block', mt: 0.3 }}
                  >
                    SKU: <strong>{restockProduct.sku}</strong> • Category:{' '}
                    <strong>{restockProduct.category}</strong>
                  </Typography>
                  <Divider sx={{ my: 1.5, borderColor: 'rgba(255,255,255,0.06)' }} />
                  <Box
                    sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                  >
                    <Typography variant="body2" color="text.secondary">
                      Current Stock Quantity:
                    </Typography>
                    <Chip
                      label={`${Number(restockProduct.quantity ?? 0)} ${restockProduct.uom || 'units'}`}
                      size="small"
                      color={Number(restockProduct.quantity ?? 0) <= 0 ? 'error' : 'default'}
                      sx={{ fontWeight: 700 }}
                    />
                  </Box>
                </Box>
              )}

              <Grid container spacing={2.5}>
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="Stock Quantity to Add"
                    type="number"
                    fullWidth
                    required
                    value={restockQuantity}
                    onChange={(e) => setRestockQuantity(Math.max(1, Number(e.target.value)))}
                    inputProps={{ min: 1 }}
                    helperText="Number of new units received"
                    InputLabelProps={{ shrink: true }}
                    sx={textFieldStyle}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    label={`Unit Cost Price (${currencySymbol} ${activeCurrency})`}
                    type="number"
                    fullWidth
                    value={restockCostPrice}
                    onChange={(e) => setRestockCostPrice(Number(e.target.value))}
                    helperText={`Input in ${activeCurrency} (will convert to ${baseCurrency} base)`}
                    InputLabelProps={{ shrink: true }}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">{currencySymbol}</InputAdornment>
                      ),
                    }}
                    sx={textFieldStyle}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    label="Restock Reason / Reference"
                    fullWidth
                    value={restockReason}
                    onChange={(e) => setRestockReason(e.target.value)}
                    placeholder="e.g., Supplier PO #4092, Local Market Delivery"
                    InputLabelProps={{ shrink: true }}
                    sx={textFieldStyle}
                  />
                </Grid>
              </Grid>
            </DialogContent>
            <DialogActions sx={{ p: 3, gap: 1.5 }}>
              <Button
                onClick={() => setRestockDialogOpen(false)}
                sx={{ color: 'text.secondary', textTransform: 'none', fontWeight: 600 }}
              >
                Cancel
              </Button>
              <Button
                variant="contained"
                type="submit"
                disabled={restockMutation.isPending}
                sx={{
                  px: 4,
                  py: 1.2,
                  fontWeight: 700,
                  background: 'linear-gradient(90deg, #10b981 0%, #059669 100%)',
                }}
              >
                {restockMutation.isPending ? 'Updating...' : 'Confirm Stock Addition'}
              </Button>
            </DialogActions>
          </form>
        </Dialog>

        {/* Create / Edit Product Modal */}
        <Dialog
          open={open}
          onClose={() => setOpen(false)}
          maxWidth="md"
          fullWidth
          PaperProps={{
            sx: {
              background:
                'linear-gradient(135deg, rgba(23, 27, 44, 0.98) 0%, rgba(11, 13, 26, 0.99) 100%)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(139, 92, 246, 0.2)',
              borderRadius: 4,
            },
          }}
        >
          <form onSubmit={handleSubmit(onSubmit)}>
            <DialogTitle
              sx={{
                fontWeight: 800,
                background: 'linear-gradient(90deg, #fff 0%, #a78bfa 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              {editingProduct ? 'Modify Catalog Product' : 'Register New Catalog Product'}
            </DialogTitle>
            <DialogContent sx={{ pt: 2 }}>
              <Tabs
                value={activeTab}
                onChange={(_e, v) => setActiveTab(v)}
                sx={{ mb: 3, borderBottom: '1px solid rgba(255,255,255,0.08)' }}
              >
                <Tab label="Identity & Pricing" sx={{ textTransform: 'none', fontWeight: 700 }} />
                <Tab label="Stock & Inventory" sx={{ textTransform: 'none', fontWeight: 700 }} />
                <Tab label="Media & Attributes" sx={{ textTransform: 'none', fontWeight: 700 }} />
                <Tab label="Logistics & Notes" sx={{ textTransform: 'none', fontWeight: 700 }} />
              </Tabs>

              {/* Tab 0: Identity & Pricing */}
              {activeTab === 0 && (
                <Grid container spacing={3}>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      label="Product Name"
                      fullWidth
                      {...register('name', { required: true })}
                      sx={textFieldStyle}
                      InputLabelProps={{ shrink: true }}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <TextField
                        label="Product SKU"
                        fullWidth
                        {...register('sku')}
                        sx={textFieldStyle}
                        InputLabelProps={{ shrink: true }}
                      />
                      <Button
                        variant="outlined"
                        onClick={handleAutoGenerateSku}
                        sx={{
                          textTransform: 'none',
                          px: 2,
                          borderColor: 'rgba(139, 92, 246, 0.4)',
                          color: 'primary.light',
                        }}
                      >
                        Generate
                      </Button>
                    </Box>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      label="Barcode (EAN/UPC)"
                      fullWidth
                      {...register('barcode')}
                      sx={textFieldStyle}
                      InputLabelProps={{ shrink: true }}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      label="Category"
                      fullWidth
                      {...register('category', { required: true })}
                      sx={textFieldStyle}
                      InputLabelProps={{ shrink: true }}
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <TextField
                      select
                      label="Product Price Currency (Authoritative Source Currency)"
                      fullWidth
                      value={formCurrency}
                      onChange={(e) => {
                        const newCurr = e.target.value.toUpperCase();
                        setFormCurrency(newCurr);
                        setValue('currency', newCurr);
                      }}
                      helperText="The user-selected currency is the permanent source currency for all entered prices."
                      sx={textFieldStyle}
                    >
                      {Object.keys(SUPPORTED_CURRENCIES).map((code) => {
                        const info = getCurrencyInfo(code);
                        return (
                          <MenuItem key={code} value={code}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <span>{info.flag}</span>
                              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                {info.code} — {info.name} ({info.symbol})
                              </Typography>
                            </Box>
                          </MenuItem>
                        );
                      })}
                    </TextField>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      label={`Retail Price (${getCurrencyInfo(formCurrency).symbol} ${formCurrency})`}
                      type="number"
                      fullWidth
                      {...register('retailPrice')}
                      sx={textFieldStyle}
                      InputLabelProps={{ shrink: true }}
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            {getCurrencyInfo(formCurrency).symbol}
                          </InputAdornment>
                        ),
                      }}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      label={`Selling Price (${getCurrencyInfo(formCurrency).symbol} ${formCurrency})`}
                      type="number"
                      fullWidth
                      {...register('sellingPrice', { required: true })}
                      sx={textFieldStyle}
                      InputLabelProps={{ shrink: true }}
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            {getCurrencyInfo(formCurrency).symbol}
                          </InputAdornment>
                        ),
                      }}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      label={`Wholesale Price (${getCurrencyInfo(formCurrency).symbol} ${formCurrency})`}
                      type="number"
                      fullWidth
                      {...register('wholesalePrice')}
                      sx={textFieldStyle}
                      InputLabelProps={{ shrink: true }}
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            {getCurrencyInfo(formCurrency).symbol}
                          </InputAdornment>
                        ),
                      }}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      label={`Cost Price (${getCurrencyInfo(formCurrency).symbol} ${formCurrency})`}
                      type="number"
                      fullWidth
                      {...register('costPrice', { required: true })}
                      sx={textFieldStyle}
                      InputLabelProps={{ shrink: true }}
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            {getCurrencyInfo(formCurrency).symbol}
                          </InputAdornment>
                        ),
                      }}
                    />
                  </Grid>
                </Grid>
              )}

              {/* Tab 1: Stock & Inventory */}
              {activeTab === 1 && (
                <Grid container spacing={3}>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      label="Initial / Current Stock Quantity"
                      type="number"
                      fullWidth
                      {...register('quantity')}
                      helperText="Available quantity in inventory"
                      sx={textFieldStyle}
                      InputLabelProps={{ shrink: true }}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      label="Low Stock Alert Threshold"
                      type="number"
                      fullWidth
                      {...register('lowStockAlert')}
                      helperText="Trigger alert when stock drops to or below this level"
                      sx={textFieldStyle}
                      InputLabelProps={{ shrink: true }}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      label="Unit of Measure (UOM)"
                      fullWidth
                      placeholder="e.g., pcs, kg, box, bottle"
                      {...register('uom')}
                      sx={textFieldStyle}
                      InputLabelProps={{ shrink: true }}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      select
                      label="Product Catalog Status"
                      fullWidth
                      defaultValue="ACTIVE"
                      {...register('status')}
                      sx={textFieldStyle}
                      InputLabelProps={{ shrink: true }}
                    >
                      <MenuItem value="ACTIVE">Active</MenuItem>
                      <MenuItem value="INACTIVE">Inactive</MenuItem>
                      <MenuItem value="DRAFT">Draft</MenuItem>
                      <MenuItem value="OUT_OF_STOCK">Out of Stock</MenuItem>
                    </TextField>
                  </Grid>
                </Grid>
              )}

              {/* Tab 2: Media & Attributes */}
              {activeTab === 2 && (
                <Grid container spacing={3}>
                  <Grid item xs={12} sm={6}>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <Typography variant="subtitle2" color="text.secondary">
                        Product Thumbnail Image
                      </Typography>
                      <Button
                        variant="outlined"
                        component="label"
                        htmlFor="product-image-upload"
                        startIcon={<CloudUploadIcon />}
                        sx={{
                          textTransform: 'none',
                          py: 1.5,
                          borderColor: 'rgba(255,255,255,0.08)',
                        }}
                      >
                        Upload Image File
                        <input
                          id="product-image-upload"
                          name="productImage"
                          type="file"
                          hidden
                          accept="image/*"
                          onChange={handleImageUpload}
                        />
                      </Button>
                      {imageUrl && (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                          <img
                            src={imageUrl}
                            alt="Thumbnail"
                            style={{ width: 80, height: 80, borderRadius: 8, objectFit: 'cover' }}
                          />
                          <Typography variant="caption" color="text.secondary">
                            Optimized image linked successfully.
                          </Typography>
                        </Box>
                      )}
                    </Box>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      label="Brand Name"
                      fullWidth
                      {...register('brand')}
                      sx={textFieldStyle}
                      InputLabelProps={{ shrink: true }}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      label="Subcategory"
                      fullWidth
                      {...register('subcategory')}
                      sx={textFieldStyle}
                      InputLabelProps={{ shrink: true }}
                    />
                  </Grid>
                </Grid>
              )}

              {/* Tab 3: Logistics & Notes */}
              {activeTab === 3 && (
                <Grid container spacing={3}>
                  <Grid item xs={12} sm={3}>
                    <TextField
                      label="Width (cm)"
                      type="number"
                      fullWidth
                      {...register('width')}
                      sx={textFieldStyle}
                      InputLabelProps={{ shrink: true }}
                    />
                  </Grid>
                  <Grid item xs={12} sm={3}>
                    <TextField
                      label="Height (cm)"
                      type="number"
                      fullWidth
                      {...register('height')}
                      sx={textFieldStyle}
                      InputLabelProps={{ shrink: true }}
                    />
                  </Grid>
                  <Grid item xs={12} sm={3}>
                    <TextField
                      label="Depth (cm)"
                      type="number"
                      fullWidth
                      {...register('depth')}
                      sx={textFieldStyle}
                      InputLabelProps={{ shrink: true }}
                    />
                  </Grid>
                  <Grid item xs={12} sm={3}>
                    <TextField
                      label="Weight (kg)"
                      type="number"
                      fullWidth
                      {...register('weight')}
                      sx={textFieldStyle}
                      InputLabelProps={{ shrink: true }}
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <TextField
                      label="Product Notes"
                      multiline
                      rows={3}
                      fullWidth
                      {...register('notes')}
                      sx={textFieldStyle}
                      InputLabelProps={{ shrink: true }}
                    />
                  </Grid>
                </Grid>
              )}
            </DialogContent>
            <DialogActions sx={{ p: 3, gap: 1.5 }}>
              <Button
                onClick={() => setOpen(false)}
                sx={{ color: 'text.secondary', textTransform: 'none', fontWeight: 600 }}
              >
                Cancel
              </Button>
              <Button
                variant="contained"
                type="submit"
                sx={{
                  px: 4,
                  py: 1.2,
                  fontWeight: 700,
                  background: 'linear-gradient(90deg, #8b5cf6 0%, #6366f1 100%)',
                }}
              >
                {editingProduct ? 'Update Product' : 'Register Product'}
              </Button>
            </DialogActions>
          </form>
        </Dialog>
      </motion.div>
    </Box>
  );
}
