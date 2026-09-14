import { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Chip,
  TextField,
  MenuItem,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Collapse,
  Typography,
  Pagination,
  CircularProgress,
} from '@mui/material';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import UndoIcon from '@mui/icons-material/Undo';
import SearchIcon from '@mui/icons-material/Search';
import PageHeader from '../../components/PageHeader';
import { apiClient } from '../../api/client';
import { toast } from 'react-hot-toast';
import { useRegionalSettings } from '../../hooks/useRegionalSettings.js';

function JournalRow({ entry, onReverse }: { entry: any; onReverse: (e: any) => void }) {
  const [open, setOpen] = useState(false);
  const { formatAmount, currencySymbol } = useRegionalSettings();

  return (
    <>
      <TableRow sx={{ '& > *': { borderBottom: 'unset' } }}>
        <TableCell>
          <IconButton size="small" onClick={() => setOpen(!open)}>
            {open ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
          </IconButton>
        </TableCell>
        <TableCell sx={{ fontWeight: 'bold' }}>{entry.entryNumber}</TableCell>
        <TableCell>{new Date(entry.postingDate).toLocaleDateString()}</TableCell>
        <TableCell>
          <Chip label={entry.source} size="small" variant="outlined" />
        </TableCell>
        <TableCell>{entry.description}</TableCell>
        <TableCell sx={{ fontWeight: 'bold', color: 'success.main' }}>
          {formatAmount(entry.totalDebit || 0)}
        </TableCell>
        <TableCell sx={{ fontWeight: 'bold', color: 'info.main' }}>
          {formatAmount(entry.totalCredit || 0)}
        </TableCell>
        <TableCell>
          <Chip
            label={entry.status}
            size="small"
            color={
              entry.status === 'POSTED'
                ? 'success'
                : entry.status === 'REVERSED'
                  ? 'error'
                  : 'default'
            }
          />
        </TableCell>
        <TableCell align="center">
          {entry.status === 'POSTED' && entry.source !== 'REVERSAL' && (
            <Button
              size="small"
              variant="outlined"
              color="error"
              startIcon={<UndoIcon />}
              onClick={() => onReverse(entry)}
            >
              Reverse
            </Button>
          )}
        </TableCell>
      </TableRow>
      <TableRow>
        <TableCell style={{ paddingBottom: 0, paddingTop: 0 }} colSpan={9}>
          <Collapse in={open} timeout="auto" unmountOnExit>
            <Box sx={{ margin: 2, bgcolor: '#f8fafc', p: 2, borderRadius: 1 }}>
              <Typography
                variant="subtitle2"
                gutterBottom
                component="div"
                sx={{ fontWeight: 'bold' }}
              >
                Double-Entry Account Line Breakdowns
              </Typography>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Account Code</TableCell>
                    <TableCell>Account Name</TableCell>
                    <TableCell align="right">Debit ({currencySymbol})</TableCell>
                    <TableCell align="right">Credit ({currencySymbol})</TableCell>
                    <TableCell>Memo / Department</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(entry.lines || []).map((line: any, idx: number) => (
                    <TableRow key={idx}>
                      <TableCell sx={{ fontWeight: 'bold' }}>{line.accountCode}</TableCell>
                      <TableCell>{line.accountName}</TableCell>
                      <TableCell
                        align="right"
                        sx={{ color: line.debit > 0 ? 'success.main' : 'inherit' }}
                      >
                        {line.debit > 0 ? formatAmount(line.debit) : '-'}
                      </TableCell>
                      <TableCell
                        align="right"
                        sx={{ color: line.credit > 0 ? 'info.main' : 'inherit' }}
                      >
                        {line.credit > 0 ? formatAmount(line.credit) : '-'}
                      </TableCell>
                      <TableCell>{line.memo || '-'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Box>
          </Collapse>
        </TableCell>
      </TableRow>
    </>
  );
}

export default function GeneralLedgerView() {
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [accountCodeFilter, setAccountCodeFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('ALL');

  // Reversal Dialog State
  const [selectedEntry, setSelectedEntry] = useState<any>(null);
  const [reversalReason, setReversalReason] = useState('');
  const [reversalOpen, setReversalOpen] = useState(false);
  const [isReversing, setIsReversing] = useState(false);

  const fetchJournals = async (currentPage = page) => {
    try {
      setLoading(true);
      const params: any = { page: currentPage, limit: 20 };
      if (accountCodeFilter.trim()) params.accountCode = accountCodeFilter.trim();
      if (sourceFilter !== 'ALL') params.source = sourceFilter;

      const res = await apiClient.get('/finance/journals', { params });
      const resData = res.data?.data;

      if (resData && Array.isArray(resData.entries)) {
        setEntries(resData.entries);
        setTotalPages(resData.totalPages || 1);
      } else if (Array.isArray(resData)) {
        setEntries(resData);
        setTotalPages(1);
      } else {
        setEntries([]);
        setTotalPages(1);
      }
    } catch {
      toast.error('Failed to load general ledger entries.');
      setEntries([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJournals(1);
  }, [sourceFilter]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchJournals(1);
  };

  const handleOpenReverse = (entry: any) => {
    setSelectedEntry(entry);
    setReversalReason('');
    setReversalOpen(true);
  };

  const handleConfirmReverse = async () => {
    if (!selectedEntry) return;
    if (!reversalReason.trim()) {
      toast.error('Please specify a reason for the journal reversal.');
      return;
    }

    setIsReversing(true);
    try {
      await apiClient.post(`/finance/journals/${selectedEntry._id}/reverse`, {
        reason: reversalReason.trim(),
      });
      toast.success(`Reversed journal ${selectedEntry.entryNumber} successfully!`);
      setReversalOpen(false);
      fetchJournals(page);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to reverse journal entry.');
    } finally {
      setIsReversing(false);
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <PageHeader
        title="General Ledger & Double-Entry History"
        subtitle="Searchable double-entry audit records, detailed line allocations, and authorized adjustments"
      />

      {/* Filter and Search Bar */}
      <Card sx={{ mb: 3, borderRadius: 2 }}>
        <CardContent>
          <Box
            component="form"
            onSubmit={handleSearch}
            sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}
          >
            <TextField
              size="small"
              label="Account Code"
              placeholder="e.g. 1000, 1010, 4000"
              value={accountCodeFilter}
              onChange={(e) => setAccountCodeFilter(e.target.value)}
              sx={{ minWidth: 200 }}
            />

            <TextField
              select
              size="small"
              label="Source Channel"
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value)}
              sx={{ minWidth: 200 }}
            >
              <MenuItem value="ALL">All Sources</MenuItem>
              <MenuItem value="SALE">Sale (POS / Online)</MenuItem>
              <MenuItem value="REFUND">Refund / Returns</MenuItem>
              <MenuItem value="PURCHASE">Procurement Goods Receipt</MenuItem>
              <MenuItem value="EXPENSE">Approved Expense</MenuItem>
              <MenuItem value="CUSTOMER_PAYMENT">Customer AR Payment</MenuItem>
              <MenuItem value="SUPPLIER_PAYMENT">Supplier AP Disbursement</MenuItem>
              <MenuItem value="PAYMENT_RECONCILIATION">Gateway / POS Reconciliation</MenuItem>
              <MenuItem value="INVENTORY_ADJUSTMENT">Inventory Count Adjustment</MenuItem>
              <MenuItem value="MANUAL">Manual Journal</MenuItem>
              <MenuItem value="REVERSAL">Journal Reversal</MenuItem>
            </TextField>

            <Button variant="contained" type="submit" startIcon={<SearchIcon />}>
              Filter Ledger
            </Button>
          </Box>
        </CardContent>
      </Card>

      {/* Ledger Table */}
      <Card sx={{ borderRadius: 2, boxShadow: 2 }}>
        <CardContent>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
              <CircularProgress />
            </Box>
          ) : (
            <>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell width="40px" />
                    <TableCell>Entry #</TableCell>
                    <TableCell>Posting Date</TableCell>
                    <TableCell>Source</TableCell>
                    <TableCell>Description</TableCell>
                    <TableCell>Total Debit</TableCell>
                    <TableCell>Total Credit</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell align="center">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {entries.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} align="center" sx={{ py: 3 }}>
                        No general ledger entries found matching criteria.
                      </TableCell>
                    </TableRow>
                  ) : (
                    entries.map((e) => (
                      <JournalRow key={e._id} entry={e} onReverse={handleOpenReverse} />
                    ))
                  )}
                </TableBody>
              </Table>

              {totalPages > 1 && (
                <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
                  <Pagination
                    count={totalPages}
                    page={page}
                    onChange={(_, p) => {
                      setPage(p);
                      fetchJournals(p);
                    }}
                    color="primary"
                  />
                </Box>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Reversal Confirmation Dialog */}
      <Dialog open={reversalOpen} onClose={() => setReversalOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 'bold' }}>
          Reverse Journal Entry: {selectedEntry?.entryNumber}
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            This will create an equal and opposite reversal journal entry, restoring account
            balances and recording an audit trail.
          </Typography>
          <TextField
            fullWidth
            required
            label="Reversal Reason"
            placeholder="e.g. Order cancelled, invoice corrected, duplicate post"
            value={reversalReason}
            onChange={(e) => setReversalReason(e.target.value)}
            multiline
            rows={3}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setReversalOpen(false)} disabled={isReversing}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleConfirmReverse}
            disabled={isReversing}
          >
            {isReversing ? 'Reversing...' : 'Confirm Reversal'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
