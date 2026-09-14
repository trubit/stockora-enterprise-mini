import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../api/client.ts';
import {
  Box,
  Typography,
  Tabs,
  Tab,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  Grid,
  Chip,
  IconButton,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import AddIcon from '@mui/icons-material/Add';
import GavelIcon from '@mui/icons-material/Gavel';
import { toast } from 'react-hot-toast';
import { useRegionalSettings } from '../../hooks/useRegionalSettings.js';

interface ReturnItem {
  productId: string;
  productName: string;
  sku: string;
  quantity: number;
  price: number;
  reason: string;
  condition: 'SELLABLE' | 'DAMAGED';
  action: 'REFUND' | 'EXCHANGE';
}

interface SalesReturn {
  _id: string;
  returnNumber: string;
  transactionNumber: string;
  items: ReturnItem[];
  exchangeItems: {
    productId: string;
    productName: string;
    sku: string;
    quantity: number;
    price: number;
  }[];
  refundType: 'FULL' | 'PARTIAL';
  refundAmount: number;
  exchangePriceDifference: number;
  refundMethod: 'CASH' | 'CARD' | 'STORE_CREDIT' | 'WALLET';
  walletRefundRef?: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'COMPLETED';
  notes?: string;
  ipAddress?: string;
  createdBy?: { username: string; email: string };
  approvedBy?: { username: string; email: string };
  approvedAt?: string;
  createdAt: string;
}

interface WarrantyClaim {
  claimNumber: string;
  claimDate: string;
  status: string;
  issueDescription: string;
  actionTaken: string;
}

interface Warranty {
  _id: string;
  warrantyNumber: string;
  productId: string;
  productName: string;
  serialNumber: string;
  customerName: string;
  customerEmail: string;
  registeredAt: string;
  expiresAt: string;
  claims: WarrantyClaim[];
}

interface ClientProduct {
  _id: string;
  id?: string;
  name: string;
  sku: string;
  price: number;
}

const textFieldStyle = {};

export default function ReturnsLogistics() {
  const { formatAmount, currencySymbol } = useRegionalSettings();
  const [activeTab, setActiveTab] = useState(0);
  const [openRmaDialog, setOpenRmaDialog] = useState(false);
  const [openWarrantyDialog, setOpenWarrantyDialog] = useState(false);
  const [openClaimDialog, setOpenClaimDialog] = useState(false);

  const [selectedWarranty, setSelectedWarranty] = useState<Warranty | null>(null);

  // Form states for returns
  const [originalTx, setOriginalTx] = useState('');
  const [refundMethod, setRefundMethod] = useState<'CASH' | 'CARD' | 'STORE_CREDIT' | 'WALLET'>(
    'CASH'
  );
  const [refundType, setRefundType] = useState<'FULL' | 'PARTIAL'>('FULL');
  const [partialRefundAmount, setPartialRefundAmount] = useState(0);
  const [rmaNotes, setRmaNotes] = useState('');

  // Return items states
  const [retProductId, setRetProductId] = useState('');
  const [retQty, setRetQty] = useState(1);
  const [retPrice, setRetPrice] = useState(0);
  const [retReason, setRetReason] = useState('Size mismatch');
  const [retCondition, setRetCondition] = useState<'SELLABLE' | 'DAMAGED'>('SELLABLE');
  const [retAction, setRetAction] = useState<'REFUND' | 'EXCHANGE'>('REFUND');
  const [addedItems, setAddedItems] = useState<ReturnItem[]>([]);

  // Form states for warranty
  const [warProductId, setWarProductId] = useState('');
  const [warSerial, setWarSerial] = useState('');
  const [warCustName, setWarCustName] = useState('');
  const [warCustEmail, setWarCustEmail] = useState('');
  const [warDuration, setWarDuration] = useState(12);

  // Form states for claims
  const [claimIssue, setClaimIssue] = useState('');
  const [claimAction, setClaimAction] = useState<'REPAIR' | 'REPLACEMENT' | 'REFUND' | 'REJECTED'>(
    'REPLACEMENT'
  );

  const queryClient = useQueryClient();

  const { data: returnsList = [] } = useQuery<SalesReturn[]>({
    queryKey: ['sales-returns'],
    queryFn: async () => {
      const { data } = await apiClient.get('/returns');
      return data;
    },
  });

  const { data: warrantiesList = [] } = useQuery<Warranty[]>({
    queryKey: ['warranties'],
    queryFn: async () => {
      const { data } = await apiClient.get('/returns/warranties');
      return data;
    },
  });

  const { data: products = [] } = useQuery<ClientProduct[]>({
    queryKey: ['products'],
    queryFn: async () => {
      const { data } = await apiClient.get('/products');
      return data;
    },
  });

  const returnMutation = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const { data } = await apiClient.post('/returns', payload);
      return data;
    },
    onSuccess: () => {
      toast.success('Sales Return RMA created successfully.');
      queryClient.invalidateQueries({ queryKey: ['sales-returns'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      setOpenRmaDialog(false);
      setAddedItems([]);
      setOriginalTx('');
      setRmaNotes('');
    },
    onError: (err: unknown) => {
      const error = err as { response?: { data?: { error?: { message?: string } } } };
      toast.error(error.response?.data?.error?.message || 'Failed to submit RMA.');
    },
  });

  const approveMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { data } = await apiClient.patch(`/returns/${id}/approve`, { status });
      return data;
    },
    onSuccess: () => {
      toast.success('RMA status updated.');
      queryClient.invalidateQueries({ queryKey: ['sales-returns'] });
    },
  });

  const warrantyMutation = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const { data } = await apiClient.post('/returns/warranties', payload);
      return data;
    },
    onSuccess: () => {
      toast.success('Product warranty registered.');
      queryClient.invalidateQueries({ queryKey: ['warranties'] });
      setOpenWarrantyDialog(false);
      setWarSerial('');
      setWarCustName('');
      setWarCustEmail('');
    },
  });

  const claimMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: Record<string, unknown> }) => {
      const { data } = await apiClient.post(`/returns/warranties/${id}/claims`, payload);
      return data;
    },
    onSuccess: () => {
      toast.success('Warranty claim logged and resolved successfully.');
      queryClient.invalidateQueries({ queryKey: ['warranties'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      setOpenClaimDialog(false);
      setClaimIssue('');
    },
  });

  const handleAddItem = () => {
    const matched = products.find((p) => p.id === retProductId || p._id === retProductId);
    if (!matched) return;
    setAddedItems((prev) => [
      ...prev,
      {
        productId: retProductId,
        productName: matched.name,
        sku: matched.sku,
        quantity: Number(retQty),
        price: Number(retPrice),
        reason: retReason,
        condition: retCondition,
        action: retAction,
      },
    ]);
  };

  const handleCreateRma = () => {
    if (addedItems.length === 0) {
      toast.error('Add at least one return item.');
      return;
    }
    returnMutation.mutate({
      transactionNumber: originalTx,
      items: addedItems,
      exchangeItems: [],
      refundMethod,
      refundType,
      partialRefundAmount: refundType === 'PARTIAL' ? partialRefundAmount : undefined,
      notes: rmaNotes,
    });
  };

  const handleRegisterWarranty = () => {
    warrantyMutation.mutate({
      productId: warProductId,
      serialNumber: warSerial,
      customerName: warCustName,
      customerEmail: warCustEmail,
      durationMonths: warDuration,
    });
  };

  const handleFileClaim = () => {
    if (!selectedWarranty) return;
    claimMutation.mutate({
      id: selectedWarranty._id,
      payload: {
        issueDescription: claimIssue,
        actionTaken: claimAction,
        resolutionNotes: 'Processed via customer logistics portal',
      },
    });
  };

  return (
    <Box sx={{ width: '100%' }}>
      <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800 }}>
            Returns & Warranty Logistics
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Process sales return RMAs, handle item conditions, and manage product warranties.
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setOpenRmaDialog(true)}
            sx={{ background: 'linear-gradient(90deg, #8b5cf6 0%, #7c3aed 100%)' }}
          >
            New Return RMA
          </Button>
          <Button
            variant="outlined"
            startIcon={<GavelIcon />}
            onClick={() => setOpenWarrantyDialog(true)}
          >
            Register Warranty
          </Button>
        </Box>
      </Box>

      <Tabs value={activeTab} onChange={(_, idx) => setActiveTab(idx)} sx={{ mb: 3 }}>
        <Tab label="Return RMAs Log" />
        <Tab label="Warranty Registrations" />
      </Tabs>

      {activeTab === 0 && (
        <TableContainer component={Paper} className="glass-panel">
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>RMA Number</TableCell>
                <TableCell>Original Transaction</TableCell>
                <TableCell>Refund Total</TableCell>
                <TableCell>Refund Method</TableCell>
                <TableCell>Refund Type</TableCell>
                <TableCell>Exch. Price Diff</TableCell>
                <TableCell>Submitted By</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {returnsList.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center">
                    No return RMA records found.
                  </TableCell>
                </TableRow>
              ) : (
                returnsList.map((ret) => (
                  <TableRow key={ret._id}>
                    <TableCell sx={{ fontWeight: 700 }}>{ret.returnNumber}</TableCell>
                    <TableCell>{ret.transactionNumber}</TableCell>
                    <TableCell sx={{ fontWeight: 700, color: 'success.light' }}>
                      {formatAmount(ret.refundAmount)}
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={ret.refundMethod}
                        size="small"
                        color={
                          ret.refundMethod === 'WALLET'
                            ? 'secondary'
                            : ret.refundMethod === 'CARD'
                              ? 'info'
                              : 'default'
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={ret.refundType || 'FULL'}
                        size="small"
                        variant="outlined"
                        color={ret.refundType === 'PARTIAL' ? 'warning' : 'default'}
                      />
                    </TableCell>
                    <TableCell
                      sx={{
                        color: ret.exchangePriceDifference > 0 ? 'error.light' : 'success.light',
                      }}
                    >
                      {ret.exchangePriceDifference !== 0
                        ? (ret.exchangePriceDifference > 0 ? '+' : '') +
                          '$' +
                          ret.exchangePriceDifference.toFixed(2)
                        : '—'}
                    </TableCell>
                    <TableCell sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>
                      {ret.createdBy?.username || 'Unknown'}
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={ret.status}
                        color={
                          ret.status === 'COMPLETED' || ret.status === 'APPROVED'
                            ? 'success'
                            : ret.status === 'REJECTED'
                              ? 'error'
                              : 'warning'
                        }
                        size="small"
                      />
                    </TableCell>
                    <TableCell sx={{ display: 'flex', gap: 1 }}>
                      {ret.status === 'PENDING' && (
                        <>
                          <IconButton
                            color="success"
                            size="small"
                            title="Approve RMA"
                            onClick={() =>
                              approveMutation.mutate({ id: ret._id, status: 'APPROVED' })
                            }
                          >
                            <CheckCircleIcon />
                          </IconButton>
                          <IconButton
                            color="error"
                            size="small"
                            title="Reject RMA"
                            onClick={() =>
                              approveMutation.mutate({ id: ret._id, status: 'REJECTED' })
                            }
                          >
                            <GavelIcon />
                          </IconButton>
                        </>
                      )}
                      {ret.status === 'APPROVED' && (
                        <IconButton
                          color="primary"
                          size="small"
                          title="Mark Complete"
                          onClick={() =>
                            approveMutation.mutate({ id: ret._id, status: 'COMPLETED' })
                          }
                        >
                          <CheckCircleIcon />
                        </IconButton>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {activeTab === 1 && (
        <TableContainer component={Paper} className="glass-panel">
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Warranty Number</TableCell>
                <TableCell>Product Name</TableCell>
                <TableCell>Serial Number</TableCell>
                <TableCell>Customer</TableCell>
                <TableCell>Expiration</TableCell>
                <TableCell>Active Claims</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {warrantiesList.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} align="center">
                    No active product warranties registered.
                  </TableCell>
                </TableRow>
              ) : (
                warrantiesList.map((war) => (
                  <TableRow key={war._id}>
                    <TableCell sx={{ fontWeight: 700 }}>{war.warrantyNumber}</TableCell>
                    <TableCell>{war.productName}</TableCell>
                    <TableCell>{war.serialNumber}</TableCell>
                    <TableCell>{war.customerName}</TableCell>
                    <TableCell>
                      {new Date(war.expiresAt) < new Date() ? (
                        <Chip label="EXPIRED" color="error" size="small" />
                      ) : (
                        <Chip
                          label={new Date(war.expiresAt).toLocaleDateString()}
                          color="success"
                          size="small"
                        />
                      )}
                    </TableCell>
                    <TableCell>
                      {war.claims.length} {war.claims.length === 1 ? 'claim' : 'claims'} filed
                    </TableCell>
                    <TableCell>
                      <Button
                        size="small"
                        variant="contained"
                        onClick={() => {
                          setSelectedWarranty(war);
                          setOpenClaimDialog(true);
                        }}
                      >
                        File Claim
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* dialog for return RMA */}
      <Dialog open={openRmaDialog} onClose={() => setOpenRmaDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>File New Return / Exchange RMA</DialogTitle>
        <DialogContent>
          <Grid container spacing={2.5}>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Original Transaction Number"
                fullWidth
                value={originalTx}
                onChange={(e) => setOriginalTx(e.target.value)}
                sx={textFieldStyle}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                select
                label="Refund Method"
                fullWidth
                value={refundMethod}
                onChange={(e) =>
                  setRefundMethod(e.target.value as 'CASH' | 'CARD' | 'STORE_CREDIT' | 'WALLET')
                }
                sx={textFieldStyle}
              >
                <MenuItem value="CASH">Cash Payment</MenuItem>
                <MenuItem value="CARD">Debit/Credit Card</MenuItem>
                <MenuItem value="STORE_CREDIT">Store Credit Voucher</MenuItem>
                <MenuItem value="WALLET">Wallet Refund (Digital)</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                select
                label="Refund Type"
                fullWidth
                value={refundType}
                onChange={(e) => setRefundType(e.target.value as 'FULL' | 'PARTIAL')}
                sx={textFieldStyle}
              >
                <MenuItem value="FULL">Full Refund</MenuItem>
                <MenuItem value="PARTIAL">Partial Refund</MenuItem>
              </TextField>
            </Grid>
            {refundType === 'PARTIAL' && (
              <Grid item xs={12} sm={6}>
                <TextField
                  label={`Partial Refund Amount (${currencySymbol})`}
                  type="number"
                  fullWidth
                  value={partialRefundAmount}
                  onChange={(e) => setPartialRefundAmount(Number(e.target.value))}
                  sx={textFieldStyle}
                  inputProps={{ min: 0 }}
                />
              </Grid>
            )}

            <Grid item xs={12}>
              <Typography variant="subtitle2" color="primary.light" sx={{ mb: 1, fontWeight: 700 }}>
                Add Return Items
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={4}>
                  <TextField
                    select
                    label="Select Product"
                    fullWidth
                    value={retProductId}
                    onChange={(e) => setRetProductId(e.target.value)}
                    sx={textFieldStyle}
                  >
                    {products.map((p) => (
                      <MenuItem key={p._id || p.id} value={p._id || p.id}>
                        {p.name} ({p.sku})
                      </MenuItem>
                    ))}
                  </TextField>
                </Grid>
                <Grid item xs={6} sm={2}>
                  <TextField
                    type="number"
                    label="Qty"
                    fullWidth
                    value={retQty}
                    onChange={(e) => setRetQty(Number(e.target.value))}
                    sx={textFieldStyle}
                  />
                </Grid>
                <Grid item xs={6} sm={2}>
                  <TextField
                    type="number"
                    label={`Price (${currencySymbol})`}
                    fullWidth
                    value={retPrice}
                    onChange={(e) => setRetPrice(Number(e.target.value))}
                    sx={textFieldStyle}
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField
                    select
                    label="Condition"
                    fullWidth
                    value={retCondition}
                    onChange={(e) => setRetCondition(e.target.value as 'SELLABLE' | 'DAMAGED')}
                    sx={textFieldStyle}
                  >
                    <MenuItem value="SELLABLE">Sellable / Returning to Shelves</MenuItem>
                    <MenuItem value="DAMAGED">Damaged / Staging to Writeoff</MenuItem>
                  </TextField>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="Return Reason"
                    fullWidth
                    value={retReason}
                    onChange={(e) => setRetReason(e.target.value)}
                    sx={textFieldStyle}
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField
                    select
                    label="Resolution Action"
                    fullWidth
                    value={retAction}
                    onChange={(e) => setRetAction(e.target.value as 'REFUND' | 'EXCHANGE')}
                    sx={textFieldStyle}
                  >
                    <MenuItem value="REFUND">Refund Amount</MenuItem>
                    <MenuItem value="EXCHANGE">Exchange Product</MenuItem>
                  </TextField>
                </Grid>
                <Grid item xs={12} sm={2} sx={{ display: 'flex', alignItems: 'center' }}>
                  <Button variant="outlined" onClick={handleAddItem} fullWidth>
                    Add
                  </Button>
                </Grid>
              </Grid>
            </Grid>

            {addedItems.length > 0 && (
              <Grid item xs={12}>
                <Typography variant="caption" sx={{ fontWeight: 700, mb: 1, display: 'block' }}>
                  ITEMS TO PROCESS:
                </Typography>
                {addedItems.map((it, idx) => (
                  <Box
                    key={idx}
                    sx={{
                      p: 1,
                      border: '1px solid rgba(255,255,255,0.05)',
                      mb: 1,
                      borderRadius: 1,
                    }}
                  >
                    <Typography variant="body2">
                      {it.productName} ({it.sku}) x{it.quantity} @ {formatAmount(it.price)} - [
                      {it.condition} / {it.action}]
                    </Typography>
                  </Box>
                ))}
              </Grid>
            )}

            <Grid item xs={12}>
              <TextField
                label="RMA Notes"
                fullWidth
                multiline
                rows={2}
                value={rmaNotes}
                onChange={(e) => setRmaNotes(e.target.value)}
                sx={textFieldStyle}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenRmaDialog(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleCreateRma} disabled={returnMutation.isPending}>
            Submit RMA
          </Button>
        </DialogActions>
      </Dialog>

      {/* dialog for warranty register */}
      <Dialog open={openWarrantyDialog} onClose={() => setOpenWarrantyDialog(false)}>
        <DialogTitle>Register Product Warranty</DialogTitle>
        <DialogContent>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <TextField
                select
                label="Product"
                fullWidth
                value={warProductId}
                onChange={(e) => setWarProductId(e.target.value)}
                sx={textFieldStyle}
              >
                {products.map((p) => (
                  <MenuItem key={p._id || p.id} value={p._id || p.id}>
                    {p.name}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12}>
              <TextField
                label="Serial Number (S/N)"
                fullWidth
                value={warSerial}
                onChange={(e) => setWarSerial(e.target.value)}
                sx={textFieldStyle}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                label="Customer Name"
                fullWidth
                value={warCustName}
                onChange={(e) => setWarCustName(e.target.value)}
                sx={textFieldStyle}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                label="Customer Email"
                fullWidth
                value={warCustEmail}
                onChange={(e) => setWarCustEmail(e.target.value)}
                sx={textFieldStyle}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                type="number"
                label="Duration (Months)"
                fullWidth
                value={warDuration}
                onChange={(e) => setWarDuration(Number(e.target.value))}
                sx={textFieldStyle}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenWarrantyDialog(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleRegisterWarranty}>
            Register
          </Button>
        </DialogActions>
      </Dialog>

      {/* dialog for warranty claims */}
      <Dialog open={openClaimDialog} onClose={() => setOpenClaimDialog(false)}>
        <DialogTitle>File Warranty Service Claim</DialogTitle>
        <DialogContent>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <Typography variant="body2" sx={{ fontWeight: 700 }}>
                Warranty: {selectedWarranty?.warrantyNumber} ({selectedWarranty?.productName})
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Customer: {selectedWarranty?.customerName} • S/N: {selectedWarranty?.serialNumber}
              </Typography>
            </Grid>
            <Grid item xs={12}>
              <TextField
                label="Service Issue Description"
                fullWidth
                multiline
                rows={3}
                value={claimIssue}
                onChange={(e) => setClaimIssue(e.target.value)}
                sx={textFieldStyle}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                select
                label="Resolution Action"
                fullWidth
                value={claimAction}
                onChange={(e) =>
                  setClaimAction(e.target.value as 'REPAIR' | 'REPLACEMENT' | 'REFUND' | 'REJECTED')
                }
                sx={textFieldStyle}
              >
                <MenuItem value="REPAIR">Complete Technical Repair</MenuItem>
                <MenuItem value="REPLACEMENT">Item Replacement (Deducts Stock)</MenuItem>
                <MenuItem value="REFUND">Issue Partial Refund</MenuItem>
                <MenuItem value="REJECTED">Reject Service Claim</MenuItem>
              </TextField>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenClaimDialog(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleFileClaim}>
            Log Claim
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
