import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  Grid,
  Button,
  Chip,
  CircularProgress,
  MenuItem,
  TextField,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  useTheme,
} from '@mui/material';
import CloudDownload from '@mui/icons-material/CloudDownload';
import Download from '@mui/icons-material/Download';
import Refresh from '@mui/icons-material/Refresh';
import { apiClient } from '../../api/client.ts';
import { toast } from 'react-hot-toast';
import PageHeader from '../../components/PageHeader.tsx';
import StatusChip from '../../components/StatusChip.tsx';

interface ExportJobItem {
  _id: string;
  resourceType: string;
  format: string;
  status: 'PENDING' | 'GENERATING' | 'COMPLETED' | 'FAILED' | 'EXPIRED';
  recordCount: number;
  fileSize?: number;
  downloadToken?: string;
  expiresAt: string;
  createdAt: string;
}

export const DataExportCenter: React.FC = () => {
  const [exports, setExports] = useState<ExportJobItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [resourceType, setResourceType] = useState('products');
  const [format, setFormat] = useState('CSV');
  const [requesting, setRequesting] = useState(false);

  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  useEffect(() => {
    fetchExports();
  }, []);

  const fetchExports = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get('/integrations/exports');
      if (res.data?.success) {
        setExports(res.data.data);
      }
    } catch {
      toast.error('Failed to load export history');
    } finally {
      setLoading(false);
    }
  };

  const handleRequestExport = async () => {
    try {
      setRequesting(true);
      const res = await apiClient.post('/integrations/exports/request', {
        resourceType,
        format,
      });

      if (res.data?.success) {
        toast.success('Export job queued! Generating download file...');
        fetchExports();
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || 'Failed to request export');
    } finally {
      setRequesting(false);
    }
  };

  const tableHeaderSx = {
    bgcolor: isDark ? 'rgba(30, 41, 59, 0.85)' : '#f1f5f9',
    color: isDark ? '#f8fafc' : '#0f172a',
    fontWeight: 800,
    fontSize: '0.8rem',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    py: 1.8,
    px: 2,
    borderBottom: isDark ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid #cbd5e1',
  };

  const tableCellSx = {
    color: isDark ? '#e2e8f0' : '#1e293b',
    fontWeight: 600,
    fontSize: '0.875rem',
    py: 1.6,
    px: 2,
    borderBottom: isDark ? '1px solid rgba(255, 255, 255, 0.04)' : '1px solid #f1f5f9',
  };

  return (
    <Box sx={{ p: { xs: 2, md: 4 }, maxWidth: 1440, mx: 'auto' }}>
      {/* Header */}
      <PageHeader
        title="Enterprise Data Export Center"
        subtitle="Generate sanitized CSV & JSON data files with formula injection protection and secure expiring tokens."
        category="Data Connectivity"
        action={
          <Button
            variant="outlined"
            startIcon={<Refresh />}
            onClick={fetchExports}
            sx={{ fontWeight: 700, borderRadius: '10px' }}
          >
            Refresh Ledger
          </Button>
        }
      />

      {/* Export Generation Card */}
      <Card className="glass-panel" sx={{ p: 4, borderRadius: '20px', mb: 4 }}>
        <Typography variant="h6" sx={{ fontWeight: 900, mb: 1 }}>
          Request New Dataset Export
        </Typography>
        <Typography variant="body2" sx={{ color: isDark ? '#9ca3af' : '#64748b', mb: 3 }}>
          Exports run asynchronously. Download links expire automatically after 24 hours to enforce
          tenant compliance.
        </Typography>

        <Grid container spacing={3} alignItems="center">
          <Grid item xs={12} sm={6} md={4}>
            <TextField
              select
              fullWidth
              label="Resource Entity"
              value={resourceType}
              onChange={(e) => setResourceType(e.target.value)}
            >
              <MenuItem value="products">Catalog Products & SKUs</MenuItem>
              <MenuItem value="inventory">Inventory Quantities & Valuation</MenuItem>
              <MenuItem value="customers">Customers & CRM Ledger</MenuItem>
              <MenuItem value="suppliers">Suppliers & Procurement Accounts</MenuItem>
              <MenuItem value="transactions">POS Sales & Invoices</MenuItem>
            </TextField>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <TextField
              select
              fullWidth
              label="File Format"
              value={format}
              onChange={(e) => setFormat(e.target.value)}
            >
              <MenuItem value="CSV">Sanitized CSV (Spreadsheet)</MenuItem>
              <MenuItem value="JSON">Structured JSON</MenuItem>
            </TextField>
          </Grid>

          <Grid item xs={12} md={5}>
            <Button
              fullWidth
              variant="contained"
              size="large"
              startIcon={
                requesting ? <CircularProgress size={18} color="inherit" /> : <CloudDownload />
              }
              disabled={requesting}
              onClick={handleRequestExport}
              sx={{
                py: 1.8,
                borderRadius: '12px',
                fontWeight: 800,
                background: 'linear-gradient(135deg, #8b5cf6 0%, #3b82f6 100%)',
              }}
            >
              {requesting ? 'Queuing Export...' : 'Generate & Queue Export'}
            </Button>
          </Grid>
        </Grid>
      </Card>

      {/* Export History */}
      <Card className="glass-panel" sx={{ borderRadius: '20px', overflow: 'hidden' }}>
        <Box sx={{ p: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6" sx={{ fontWeight: 900 }}>
            Recent Export Deliveries & Expiring Tokens
          </Typography>
          <Chip label={`${exports.length} Total Jobs`} size="small" sx={{ fontWeight: 700 }} />
        </Box>

        {loading ? (
          <CircularProgress size={35} sx={{ display: 'block', mx: 'auto', my: 4 }} />
        ) : exports.length === 0 ? (
          <Box sx={{ p: 4, textAlign: 'center' }}>
            <Typography variant="body2" sx={{ color: isDark ? '#9ca3af' : '#64748b' }}>
              No data exports requested yet.
            </Typography>
          </Box>
        ) : (
          <Box sx={{ overflowX: 'auto' }}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell sx={tableHeaderSx}>Dataset</TableCell>
                  <TableCell sx={tableHeaderSx}>Format</TableCell>
                  <TableCell sx={tableHeaderSx}>Records</TableCell>
                  <TableCell sx={tableHeaderSx}>File Size</TableCell>
                  <TableCell sx={tableHeaderSx}>Status</TableCell>
                  <TableCell sx={tableHeaderSx}>Expires</TableCell>
                  <TableCell sx={{ ...tableHeaderSx, textAlign: 'right' }}>Download</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {exports.map((job) => {
                  const isAvailable = job.status === 'COMPLETED' && Boolean(job.downloadToken);
                  return (
                    <TableRow key={job._id} hover>
                      <TableCell
                        sx={{ ...tableCellSx, fontWeight: 800, textTransform: 'capitalize' }}
                      >
                        {job.resourceType.replace('_', ' ')}
                      </TableCell>
                      <TableCell sx={tableCellSx}>
                        <Chip
                          label={job.format}
                          size="small"
                          sx={{ fontWeight: 800, height: 20 }}
                        />
                      </TableCell>
                      <TableCell sx={{ ...tableCellSx, fontFamily: 'monospace' }}>
                        {job.recordCount?.toLocaleString() || '0'}
                      </TableCell>
                      <TableCell
                        sx={{ ...tableCellSx, fontFamily: 'monospace', fontSize: '0.8rem' }}
                      >
                        {job.fileSize ? `${(job.fileSize / 1024).toFixed(1)} KB` : '—'}
                      </TableCell>
                      <TableCell sx={tableCellSx}>
                        <StatusChip status={job.status} label={job.status} />
                      </TableCell>
                      <TableCell
                        sx={{
                          ...tableCellSx,
                          color: isDark ? '#9ca3af' : '#64748b',
                          fontSize: '0.8rem',
                        }}
                      >
                        {new Date(job.expiresAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell sx={{ ...tableCellSx, textAlign: 'right' }}>
                        {isAvailable ? (
                          <Button
                            size="small"
                            variant="contained"
                            startIcon={<Download />}
                            href={`/api/v1/integrations/exports/download/${job.downloadToken}`}
                            target="_blank"
                            sx={{
                              borderRadius: '8px',
                              fontWeight: 700,
                              textTransform: 'none',
                              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                            }}
                          >
                            Download
                          </Button>
                        ) : (
                          <Typography
                            variant="caption"
                            sx={{ color: isDark ? '#9ca3af' : '#64748b' }}
                          >
                            {job.status === 'GENERATING' ? 'Processing...' : 'Unavailable'}
                          </Typography>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Box>
        )}
      </Card>
    </Box>
  );
};

export default DataExportCenter;
