import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api/client.ts';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Box,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Grid,
  Chip,
  Card,
  Tab,
  Tabs,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  MenuItem,
} from '@mui/material';
import { SUPPORTED_CURRENCIES, getCurrencyInfo } from '../../shared/currencies.js';
import AddIcon from '@mui/icons-material/Add';
import RefreshIcon from '@mui/icons-material/Refresh';
import TuneIcon from '@mui/icons-material/Tune';
import { useNavigate } from 'react-router-dom';
import { AgGridReact } from 'ag-grid-react';
import type { ColDef, ValueFormatterParams, ICellRendererParams } from 'ag-grid-community';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';
import { toast } from 'react-hot-toast';
import { socket } from '../socket.ts';
import type { Product } from '../../shared/types.js';
import PageHeader from '../components/PageHeader.tsx';
import StatCard from '../components/StatCard.tsx';
import { useTranslation } from '../hooks/useTranslation.js';
import { useRegionalSettings } from '../hooks/useRegionalSettings.js';
import { usePermission } from '../hooks/usePermission.js';
import { CurrencySelector } from '../components/CurrencySelector.tsx';

// Zod Validation Schema for Product Creation
const productSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  SKU: z.string().min(3, 'SKU must be at least 3 characters'),
  category: z.string().min(2, 'Category is required'),
  price: z.coerce.number().positive('Price must be positive'),
  wholesalePrice: z.coerce
    .number()
    .positive('Wholesale price must be positive')
    .optional()
    .or(z.literal('')),
  cost: z.coerce.number().nonnegative('Cost cannot be negative'),
  quantity: z.coerce.number().int().nonnegative('Quantity cannot be negative'),
  lowStockAlert: z.coerce.number().int().nonnegative('Alert level cannot be negative'),
  barcode: z.string().optional(),
  currency: z.string().default('NGN'),
});

type ProductFormInputs = z.infer<typeof productSchema>;

const fetchProducts = async (): Promise<Product[]> => {
  const { data } = await apiClient.get<Product[]>('/products');
  return data;
};

export default function Inventory() {
  const { t } = useTranslation();
  const { formatAmount, baseCurrency, activeCurrency } = useRegionalSettings();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  const [inventoryFormCurrency, setInventoryFormCurrency] = useState<string>(baseCurrency || 'NGN');

  const canWriteProducts = usePermission('products:write');

  const { data: products = [], refetch } = useQuery({
    queryKey: ['products'],
    queryFn: fetchProducts,
  });

  const {
    data: valuation = { weightedAverage: 0, fifo: 0, lifo: 0, totalItemsCount: 0 },
    refetch: refetchValuation,
  } = useQuery({
    queryKey: ['valuation'],
    queryFn: async () => {
      const { data } = await apiClient.get('/inventory/valuation');
      return data;
    },
  });

  const { data: movements = [], refetch: refetchMovements } = useQuery({
    queryKey: ['movements'],
    queryFn: async () => {
      const { data } = await apiClient.get('/inventory/movements');
      return data;
    },
  });

  // Real-time synchronization directly to cache
  useEffect(() => {
    socket.on('product:stock-updated', (data: { productId: string; quantity: number }) => {
      queryClient.setQueryData<Product[]>(['products'], (old) => {
        if (!old) return old;
        return old.map((p) => (p.id === data.productId ? { ...p, quantity: data.quantity } : p));
      });
    });

    socket.on('product:created', (newProduct: Product) => {
      queryClient.setQueryData<Product[]>(['products'], (old) => {
        if (!old) return [newProduct];
        return [...old, newProduct];
      });
    });

    return () => {
      socket.off('product:stock-updated');
      socket.off('product:created');
    };
  }, [queryClient]);

  // Mutation for creating product
  const createProductMutation = useMutation({
    mutationFn: async (newProduct: ProductFormInputs) => {
      const payload = {
        ...newProduct,
        price: Number(newProduct.price),
        retailPrice: Number(newProduct.price),
        sellingPrice: Number(newProduct.price),
        wholesalePrice:
          newProduct.wholesalePrice && Number(newProduct.wholesalePrice) > 0
            ? Number(newProduct.wholesalePrice)
            : undefined,
        cost: Number(newProduct.cost),
        costPrice: Number(newProduct.cost),
        currency: newProduct.currency || inventoryFormCurrency || baseCurrency || 'NGN',
      };
      const { data } = await apiClient.post<Product>('/products', payload);
      return data;
    },
    onSuccess: () => {
      toast.success('Product added successfully!');
      setOpen(false);
      reset();
      queryClient.invalidateQueries({ queryKey: ['products'] });
      refetchValuation();
      refetchMovements();
    },
    onError: (err: unknown) => {
      const apiErr = err as Error;
      toast.error(`Failed to add product: ${apiErr.message || 'Error occurred'}`);
    },
  });

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    formState: { errors },
  } = useForm<ProductFormInputs>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: '',
      SKU: '',
      category: '',
      price: 0,
      wholesalePrice: '',
      cost: 0,
      quantity: 0,
      lowStockAlert: 5,
      barcode: '',
      currency: baseCurrency || 'NGN',
    },
  });

  const onSubmit = (data: ProductFormInputs) => {
    createProductMutation.mutate(data);
  };

  const handleSyncAll = () => {
    refetch();
    refetchValuation();
    refetchMovements();
    toast.success('Synced valuation & stock counts.');
  };

  // AG Grid Column Definitions
  const columnDefs: ColDef<Product>[] = [
    { field: 'sku', headerName: t('SKU'), sortable: true, filter: true, width: 150 },
    {
      field: 'name',
      headerName: t('Product Name'),
      sortable: true,
      filter: true,
      flex: 1,
      minWidth: 200,
    },
    {
      field: 'currency',
      headerName: 'Origin',
      sortable: true,
      filter: true,
      width: 100,
      cellRenderer: (params: ICellRendererParams<Product>) => {
        const curr = params.value || baseCurrency || 'NGN';
        return (
          <Box sx={{ display: 'flex', alignItems: 'center', height: '100%' }}>
            <Chip
              label={curr}
              size="small"
              variant="outlined"
              sx={{
                fontWeight: 800,
                fontSize: '0.68rem',
                borderColor: 'primary.main',
                color: 'primary.light',
              }}
            />
          </Box>
        );
      },
    },
    { field: 'category', headerName: t('Category'), sortable: true, filter: true, width: 140 },
    {
      field: 'cost',
      headerName: t('Cost Price'),
      sortable: true,
      width: 120,
      valueFormatter: (params: ValueFormatterParams<Product>) =>
        params.value != null
          ? formatAmount(Number(params.value), {
              fromCurrency: params.data?.currency || baseCurrency,
              currency: activeCurrency,
            })
          : '',
    },
    {
      field: 'price',
      headerName: t('Retail Price'),
      sortable: true,
      width: 120,
      valueFormatter: (params: ValueFormatterParams<Product>) =>
        params.value != null
          ? formatAmount(Number(params.value), {
              fromCurrency: params.data?.currency || baseCurrency,
              currency: activeCurrency,
            })
          : '',
    },
    {
      field: 'wholesalePrice',
      headerName: t('Wholesale Price'),
      sortable: true,
      width: 130,
      valueFormatter: (params: ValueFormatterParams<Product>) =>
        params.value != null
          ? formatAmount(Number(params.value), {
              fromCurrency: params.data?.currency || baseCurrency,
              currency: activeCurrency,
            })
          : '-',
    },
    {
      field: 'quantity',
      headerName: t('Stock Qty'),
      sortable: true,
      width: 120,
      cellRenderer: (params: ICellRendererParams<Product>) => {
        const qty = params.value;
        const lowLimit = params.data?.lowStockAlert || 5;
        const isLow = qty <= lowLimit;
        return (
          <Box sx={{ display: 'flex', alignItems: 'center', height: '100%' }}>
            <Chip
              label={qty}
              size="small"
              color={isLow ? 'error' : 'success'}
              sx={{ fontWeight: 700 }}
            />
          </Box>
        );
      },
    },
    { field: 'barcode', headerName: t('Barcode'), sortable: true, filter: true, width: 140 },
    {
      field: 'createdAt',
      headerName: 'Date Added',
      sortable: true,
      filter: 'agDateColumnFilter',
      width: 130,
      valueFormatter: (params: ValueFormatterParams<Product>) =>
        params.value ? new Date(params.value).toLocaleDateString() : '',
    },
  ];

  return (
    <Box sx={{ flexGrow: 1 }}>
      <PageHeader
        title="Inventory Catalog & Stock Ledger"
        subtitle="Manage product listings, SKU barcodes, warehouse valuation assets, and warning thresholds."
        category="Catalog"
        badgeText={`${products.length} PRODUCTS`}
        badgeColor="primary"
        action={
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
            <CurrencySelector size="small" />
            <Button
              variant="outlined"
              color="primary"
              startIcon={<RefreshIcon />}
              onClick={handleSyncAll}
              sx={{ fontWeight: 700, borderRadius: '8px' }}
            >
              Sync
            </Button>
            {canWriteProducts && (
              <Button
                variant="outlined"
                color="secondary"
                startIcon={<TuneIcon />}
                onClick={() => navigate('/adjustments')}
                sx={{
                  fontWeight: 700,
                  borderRadius: '8px',
                  border: '1px solid rgba(167, 139, 250, 0.5)',
                  color: '#a78bfa',
                  '&:hover': {
                    border: '1px solid #a78bfa',
                    bgcolor: 'rgba(167, 139, 250, 0.08)',
                  },
                }}
              >
                Adjust Stock
              </Button>
            )}
            {canWriteProducts && (
              <Button
                variant="contained"
                color="primary"
                startIcon={<AddIcon />}
                onClick={() => setOpen(true)}
                sx={{
                  fontWeight: 700,
                  borderRadius: '8px',
                  background: 'linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)',
                  boxShadow: '0 4px 14px rgba(139, 92, 246, 0.3)',
                }}
              >
                {t('Add New Product')}
              </Button>
            )}
          </Box>
        }
      />

      {/* Real-Time Valuation Metrics Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="WEIGHTED AVG ASSETS"
            value={formatAmount(Number(valuation.weightedAverage || 0))}
            subtitle="Real-time asset valuation"
            icon={<RefreshIcon sx={{ fontSize: 22 }} />}
            color="violet"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="FIFO ASSET VALUE"
            value={formatAmount(Number(valuation.fifo || 0))}
            subtitle="First-In First-Out cost base"
            icon={<RefreshIcon sx={{ fontSize: 22 }} />}
            color="emerald"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="LIFO ASSET VALUE"
            value={formatAmount(Number(valuation.lifo || 0))}
            subtitle="Last-In First-Out cost base"
            icon={<RefreshIcon sx={{ fontSize: 22 }} />}
            color="amber"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="TOTAL ACTIVE STOCK"
            value={`${Number(valuation.totalItemsCount || 0).toLocaleString()} units`}
            subtitle="Total items in stock"
            icon={<RefreshIcon sx={{ fontSize: 22 }} />}
            color="sky"
          />
        </Grid>
      </Grid>

      <Tabs
        value={activeTab}
        onChange={(_e, v) => setActiveTab(v)}
        variant="scrollable"
        scrollButtons="auto"
        allowScrollButtonsMobile
        sx={{ mb: 3, borderBottom: '1px solid rgba(255,255,255,0.08)' }}
      >
        <Tab label={t('Live Inventory Catalog')} sx={{ textTransform: 'none', fontWeight: 700 }} />
        <Tab
          label={t('Stock Movements Audit Log')}
          sx={{ textTransform: 'none', fontWeight: 700 }}
        />
      </Tabs>

      {activeTab === 0 && (
        <Card
          className="glass-panel"
          sx={{ height: 'calc(100vh - 360px)', width: '100%', minHeight: 400 }}
        >
          <Box
            className="ag-theme-alpine-dark"
            sx={{
              height: '100%',
              width: '100%',
              '--ag-background-color': 'transparent',
              '--ag-header-background-color': '#1f2937',
            }}
          >
            <AgGridReact
              key={`inventory-grid-${activeCurrency}`}
              theme="legacy"
              rowData={products}
              columnDefs={columnDefs}
              pagination={true}
              paginationPageSize={15}
              paginationPageSizeSelector={[10, 15, 25, 50]}
              loadingCellRenderer={undefined}
              domLayout="normal"
            />
          </Box>
        </Card>
      )}

      {activeTab === 1 && (
        <TableContainer
          component={Paper}
          className="glass-panel"
          sx={{
            border: '1px solid rgba(255, 255, 255, 0.05)',
            background:
              'linear-gradient(135deg, rgba(30, 41, 59, 0.6) 0%, rgba(15, 23, 42, 0.75) 100%)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
            borderRadius: 3,
            maxHeight: 'calc(100vh - 360px)',
            overflowX: 'auto',
          }}
        >
          <Table stickyHeader sx={{ minWidth: 700 }}>
            <TableHead>
              <TableRow>
                <TableCell
                  sx={{
                    fontWeight: 800,
                    bgcolor: '#111827',
                    color: 'text.primary',
                    borderBottom: '1px solid rgba(255,255,255,0.05)',
                  }}
                >
                  Product
                </TableCell>
                <TableCell
                  sx={{
                    fontWeight: 800,
                    bgcolor: '#111827',
                    color: 'text.primary',
                    borderBottom: '1px solid rgba(255,255,255,0.05)',
                  }}
                >
                  SKU
                </TableCell>
                <TableCell
                  sx={{
                    fontWeight: 800,
                    bgcolor: '#111827',
                    color: 'text.primary',
                    borderBottom: '1px solid rgba(255,255,255,0.05)',
                  }}
                >
                  Type
                </TableCell>
                <TableCell
                  sx={{
                    fontWeight: 800,
                    bgcolor: '#111827',
                    color: 'text.primary',
                    borderBottom: '1px solid rgba(255,255,255,0.05)',
                  }}
                >
                  Qty Changed
                </TableCell>
                <TableCell
                  sx={{
                    fontWeight: 800,
                    bgcolor: '#111827',
                    color: 'text.primary',
                    borderBottom: '1px solid rgba(255,255,255,0.05)',
                  }}
                >
                  Unit Cost
                </TableCell>
                <TableCell
                  sx={{
                    fontWeight: 800,
                    bgcolor: '#111827',
                    color: 'text.primary',
                    borderBottom: '1px solid rgba(255,255,255,0.05)',
                  }}
                >
                  Audit Notes
                </TableCell>
                <TableCell
                  sx={{
                    fontWeight: 800,
                    bgcolor: '#111827',
                    color: 'text.primary',
                    borderBottom: '1px solid rgba(255,255,255,0.05)',
                  }}
                >
                  Operator
                </TableCell>
                <TableCell
                  sx={{
                    fontWeight: 800,
                    bgcolor: '#111827',
                    color: 'text.primary',
                    borderBottom: '1px solid rgba(255,255,255,0.05)',
                  }}
                >
                  Timestamp
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {movements.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    align="center"
                    sx={{ py: 6, color: 'text.secondary', border: 'none' }}
                  >
                    No stock movements recorded.
                  </TableCell>
                </TableRow>
              ) : (
                movements.map(
                  (mov: {
                    _id: string;
                    productId?: { name: string; sku: string };
                    type: string;
                    quantity: number;
                    costPrice: number;
                    notes?: string;
                    userId?: { username: string };
                    createdAt: string;
                  }) => (
                    <TableRow
                      key={mov._id}
                      sx={{ '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.01)' } }}
                    >
                      <TableCell
                        sx={{
                          borderBottom: '1px solid rgba(255,255,255,0.03)',
                          py: 1.5,
                          fontWeight: 700,
                        }}
                      >
                        {mov.productId?.name || 'Deleted Product'}
                      </TableCell>
                      <TableCell sx={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                        <Chip
                          label={mov.productId?.sku || 'N/A'}
                          size="small"
                          variant="outlined"
                          sx={{ fontWeight: 700, color: 'primary.light' }}
                        />
                      </TableCell>
                      <TableCell sx={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                        <Chip
                          label={mov.type}
                          size="small"
                          color={
                            mov.type === 'SALE'
                              ? 'primary'
                              : mov.type === 'ADJUSTMENT'
                                ? 'warning'
                                : 'success'
                          }
                          sx={{ fontWeight: 700 }}
                        />
                      </TableCell>
                      <TableCell
                        sx={{
                          borderBottom: '1px solid rgba(255,255,255,0.03)',
                          fontWeight: 800,
                          color: mov.quantity < 0 ? 'error.light' : 'success.light',
                        }}
                      >
                        {mov.quantity > 0 ? `+${mov.quantity}` : mov.quantity}
                      </TableCell>
                      <TableCell
                        sx={{ borderBottom: '1px solid rgba(255,255,255,0.03)', fontWeight: 600 }}
                      >
                        {formatAmount(Number(mov.costPrice || 0))}
                      </TableCell>
                      <TableCell
                        sx={{
                          borderBottom: '1px solid rgba(255,255,255,0.03)',
                          color: 'text.secondary',
                        }}
                      >
                        {mov.notes || '-'}
                      </TableCell>
                      <TableCell sx={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                        {mov.userId?.username || 'System'}
                      </TableCell>
                      <TableCell sx={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                        {new Date(mov.createdAt).toLocaleString()}
                      </TableCell>
                    </TableRow>
                  )
                )
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Add Product Modal Form */}
      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 800 }}>{t('Add New Product')}</DialogTitle>
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogContent dividers>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label={t('Product Name')}
                  {...register('name')}
                  error={!!errors.name}
                  helperText={errors.name?.message}
                  size="small"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label={t('SKU')}
                  {...register('SKU')}
                  error={!!errors.SKU}
                  helperText={errors.SKU?.message}
                  size="small"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label={t('Category')}
                  {...register('category')}
                  error={!!errors.category}
                  helperText={errors.category?.message}
                  size="small"
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  select
                  fullWidth
                  label="Product Pricing Currency (Authoritative Source)"
                  size="small"
                  value={inventoryFormCurrency}
                  onChange={(e) => {
                    const newCurr = e.target.value.toUpperCase();
                    setInventoryFormCurrency(newCurr);
                    setValue('currency', newCurr);
                  }}
                  helperText="User-selected source currency for fixed prices. Never automatically rewritten."
                >
                  {Object.keys(SUPPORTED_CURRENCIES).map((code) => {
                    const info = getCurrencyInfo(code);
                    return (
                      <MenuItem key={code} value={code}>
                        {info.flag} {info.code} — {info.name} ({info.symbol})
                      </MenuItem>
                    );
                  })}
                </TextField>
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label={`${t('Retail Price')} (${getCurrencyInfo(inventoryFormCurrency).symbol} ${inventoryFormCurrency})`}
                  type="number"
                  inputProps={{ step: '0.01' }}
                  {...register('price')}
                  error={!!errors.price}
                  helperText={errors.price?.message}
                  size="small"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label={`${t('Wholesale Price')} (${getCurrencyInfo(inventoryFormCurrency).symbol} ${inventoryFormCurrency})`}
                  type="number"
                  inputProps={{ step: '0.01' }}
                  {...register('wholesalePrice')}
                  error={!!errors.wholesalePrice}
                  helperText={errors.wholesalePrice?.message || 'Special bulk rate'}
                  size="small"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label={`${t('Cost Price')} (${getCurrencyInfo(inventoryFormCurrency).symbol} ${inventoryFormCurrency})`}
                  type="number"
                  inputProps={{ step: '0.01' }}
                  {...register('cost')}
                  error={!!errors.cost}
                  helperText={errors.cost?.message}
                  size="small"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label={t('Stock Qty')}
                  type="number"
                  {...register('quantity')}
                  error={!!errors.quantity}
                  helperText={errors.quantity?.message}
                  size="small"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label={t('Alert Threshold')}
                  type="number"
                  {...register('lowStockAlert')}
                  error={!!errors.lowStockAlert}
                  helperText={errors.lowStockAlert?.message}
                  size="small"
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label={t('Barcode')}
                  {...register('barcode')}
                  placeholder="e.g. 40012011"
                  size="small"
                />
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpen(false)}>{t('common.cancel')}</Button>
            <Button
              type="submit"
              variant="contained"
              color="primary"
              disabled={createProductMutation.isPending}
            >
              {createProductMutation.isPending ? t('common.saving') : t('Save Product')}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </Box>
  );
}
