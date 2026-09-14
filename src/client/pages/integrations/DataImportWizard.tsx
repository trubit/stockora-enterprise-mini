import React, { useState } from 'react';
import {
  Box,
  Typography,
  Card,
  Grid,
  Button,
  Stepper,
  Step,
  StepLabel,
  MenuItem,
  TextField,
  Alert,
  useTheme,
} from '@mui/material';
import CloudUpload from '@mui/icons-material/CloudUpload';
import CheckCircle from '@mui/icons-material/CheckCircle';
import ArrowForward from '@mui/icons-material/ArrowForward';
import ArrowBack from '@mui/icons-material/ArrowBack';
import DoneAll from '@mui/icons-material/DoneAll';
import { apiClient } from '../../api/client.ts';
import { toast } from 'react-hot-toast';
import PageHeader from '../../components/PageHeader.tsx';

const STEPS = ['Upload File', 'Map Columns', 'Validate & Preview', 'Process & Ingest'];

export const DataImportWizard: React.FC = () => {
  const [activeStep, setActiveStep] = useState(0);
  const [importType, setImportType] = useState('products');
  const [file, setFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<any[]>([]);
  const [fileHeaders, setFileHeaders] = useState<string[]>([]);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [importJob, setImportJob] = useState<any>(null);

  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);

  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;

    setFile(selected);
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
        if (lines.length === 0) {
          toast.error('File is empty');
          return;
        }

        const headers = lines[0].split(',').map((h) => h.trim().replace(/^["']|["']$/g, ''));
        setFileHeaders(headers);

        const rows = lines.slice(1).map((line) => {
          const vals = line.split(',').map((v) => v.trim().replace(/^["']|["']$/g, ''));
          const rowObj: Record<string, any> = {};
          headers.forEach((h, idx) => {
            rowObj[h] = vals[idx] || '';
          });
          return rowObj;
        });

        setParsedRows(rows);

        // Auto-match mapping
        const initialMap: Record<string, string> = {};
        headers.forEach((h) => {
          const lower = h.toLowerCase();
          if (lower.includes('sku') || lower.includes('code')) initialMap[h] = 'sku';
          else if (lower.includes('name') || lower.includes('title')) initialMap[h] = 'name';
          else if (lower.includes('price')) initialMap[h] = 'price';
          else if (lower.includes('cost')) initialMap[h] = 'costPrice';
          else if (lower.includes('qty') || lower.includes('quantity')) initialMap[h] = 'quantity';
          else if (lower.includes('category')) initialMap[h] = 'category';
          else if (lower.includes('email')) initialMap[h] = 'email';
          else if (lower.includes('phone') || lower.includes('tel')) initialMap[h] = 'phone';
          else if (lower.includes('address') || lower.includes('addr')) initialMap[h] = 'address';
          else initialMap[h] = '';
        });
        setColumnMapping(initialMap);

        toast.success(`Loaded ${rows.length} rows from CSV`);
      } catch {
        toast.error('Failed to parse CSV file');
      }
    };
    reader.readAsText(selected);
  };

  const handleInitializeJob = async () => {
    if (!file || parsedRows.length === 0) {
      toast.error('Please upload a valid CSV file');
      return;
    }

    try {
      setLoading(true);
      const res = await apiClient.post('/integrations/imports/initialize', {
        type: importType,
        fileName: file.name,
        fileSize: file.size,
        format: 'CSV',
        rows: parsedRows,
      });

      if (res.data?.success) {
        setImportJob(res.data.data);
        setActiveStep(1);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || 'Failed to initialize import');
    } finally {
      setLoading(false);
    }
  };

  const handleValidateMapping = async () => {
    if (!importJob) return;
    try {
      setLoading(true);
      const res = await apiClient.post(`/integrations/imports/${importJob._id}/validate`, {
        columnMapping,
        rows: parsedRows,
      });

      if (res.data?.success) {
        setImportJob(res.data.data);
        setActiveStep(2);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || 'Validation failed');
    } finally {
      setLoading(false);
    }
  };

  const handleExecuteImport = async () => {
    if (!importJob) return;
    try {
      setProcessing(true);
      const res = await apiClient.post(`/integrations/imports/${importJob._id}/process`, {
        rows: parsedRows,
      });

      if (res.data?.success) {
        setImportJob(res.data.data);
        setActiveStep(3);
        toast.success('Data imported successfully into master catalog!');
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || 'Import processing failed');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <Box sx={{ p: { xs: 2, md: 4 }, maxWidth: 1440, mx: 'auto' }}>
      {/* Header */}
      <PageHeader
        title="Enterprise Data Import Wizard"
        subtitle="Bulk ingest and update products, inventory levels, suppliers, and customer databases with preview safety."
        category="Data Connectivity"
      />

      {/* Stepper */}
      <Card className="glass-panel" sx={{ p: 3, borderRadius: '20px', mb: 4 }}>
        <Stepper activeStep={activeStep} alternativeLabel>
          {STEPS.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>
      </Card>

      {/* Step 0: Upload */}
      {activeStep === 0 && (
        <Card className="glass-panel" sx={{ p: 4, borderRadius: '20px' }}>
          <Typography variant="h6" sx={{ fontWeight: 900, mb: 1 }}>
            Step 1: Select Target Entity & Upload Spreadsheet
          </Typography>
          <Typography variant="body2" sx={{ color: isDark ? '#9ca3af' : '#64748b', mb: 3 }}>
            Upload CSV dataset. Stockora will scan column headers and parse records without
            modifying live data.
          </Typography>

          <Grid container spacing={3} sx={{ mb: 4 }}>
            <Grid item xs={12} md={4}>
              <TextField
                select
                fullWidth
                label="Select Target Entity"
                value={importType}
                onChange={(e) => setImportType(e.target.value)}
              >
                <MenuItem value="products">Catalog Products & Pricing</MenuItem>
                <MenuItem value="opening_stock">Opening Stock & Quantities</MenuItem>
                <MenuItem value="customers">Customers & CRM Profiles</MenuItem>
                <MenuItem value="suppliers">Suppliers & Vendors</MenuItem>
              </TextField>
            </Grid>

            <Grid item xs={12} md={8}>
              <Box
                sx={{
                  border: '2px dashed #8b5cf6',
                  borderRadius: '16px',
                  p: 4,
                  textAlign: 'center',
                  bgcolor: isDark ? 'rgba(139, 92, 246, 0.04)' : '#f5f3ff',
                  cursor: 'pointer',
                }}
                component="label"
                htmlFor="csv-upload-input"
              >
                <input
                  id="csv-upload-input"
                  name="csvFile"
                  type="file"
                  accept=".csv"
                  hidden
                  onChange={handleFileUpload}
                />
                <CloudUpload sx={{ fontSize: 45, color: '#8b5cf6', mb: 1 }} />
                <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                  {file ? file.name : 'Click to select or drop CSV file'}
                </Typography>
                <Typography variant="caption" sx={{ color: isDark ? '#9ca3af' : '#64748b' }}>
                  {file
                    ? `${(file.size / 1024).toFixed(1)} KB • ${parsedRows.length} rows loaded`
                    : 'Supports standard UTF-8 CSV with headers'}
                </Typography>
              </Box>
            </Grid>
          </Grid>

          <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button
              variant="contained"
              endIcon={<ArrowForward />}
              disabled={!file || loading}
              onClick={handleInitializeJob}
              sx={{
                fontWeight: 800,
                borderRadius: '10px',
                px: 4,
                background: 'linear-gradient(135deg, #8b5cf6 0%, #3b82f6 100%)',
              }}
            >
              {loading ? 'Initializing...' : 'Proceed to Field Mapping'}
            </Button>
          </Box>
        </Card>
      )}

      {/* Step 1: Column Mapping */}
      {activeStep === 1 && (
        <Card className="glass-panel" sx={{ p: 4, borderRadius: '20px' }}>
          <Typography variant="h6" sx={{ fontWeight: 900, mb: 1 }}>
            Step 2: Map CSV Headers to Stockora Schema
          </Typography>
          <Typography variant="body2" sx={{ color: isDark ? '#9ca3af' : '#64748b', mb: 3 }}>
            Verify that each spreadsheet column matches the appropriate master record property.
          </Typography>

          <Grid container spacing={2.5} sx={{ mb: 4 }}>
            {fileHeaders.map((header) => (
              <Grid item xs={12} sm={6} md={4} key={header}>
                <Card
                  sx={{
                    p: 2,
                    borderRadius: '12px',
                    bgcolor: isDark ? 'rgba(30, 41, 59, 0.4)' : '#f8fafc',
                  }}
                >
                  <Typography
                    variant="caption"
                    sx={{ fontWeight: 800, color: '#8b5cf6', display: 'block', mb: 1 }}
                  >
                    CSV Header: "{header}"
                  </Typography>
                  <TextField
                    select
                    fullWidth
                    size="small"
                    value={
                      [
                        'sku',
                        'name',
                        'price',
                        'costPrice',
                        'quantity',
                        'category',
                        'email',
                        'phone',
                        'address',
                      ].includes(columnMapping[header])
                        ? columnMapping[header]
                        : ''
                    }
                    onChange={(e) =>
                      setColumnMapping({ ...columnMapping, [header]: e.target.value })
                    }
                  >
                    <MenuItem value="sku">SKU / Item Code</MenuItem>
                    <MenuItem value="name">Product / Company Name</MenuItem>
                    <MenuItem value="price">Selling Price</MenuItem>
                    <MenuItem value="costPrice">Cost Price</MenuItem>
                    <MenuItem value="quantity">Stock Quantity</MenuItem>
                    <MenuItem value="category">Category</MenuItem>
                    <MenuItem value="email">Email Address</MenuItem>
                    <MenuItem value="phone">Phone Number</MenuItem>
                    <MenuItem value="address">Physical Address</MenuItem>
                    <MenuItem value="">-- Ignore Column --</MenuItem>
                  </TextField>
                </Card>
              </Grid>
            ))}
          </Grid>

          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <Button startIcon={<ArrowBack />} onClick={() => setActiveStep(0)}>
              Back
            </Button>
            <Button
              variant="contained"
              endIcon={<ArrowForward />}
              disabled={loading}
              onClick={handleValidateMapping}
              sx={{
                fontWeight: 800,
                borderRadius: '10px',
                px: 4,
                background: 'linear-gradient(135deg, #8b5cf6 0%, #3b82f6 100%)',
              }}
            >
              {loading ? 'Validating...' : 'Validate & Preview'}
            </Button>
          </Box>
        </Card>
      )}

      {/* Step 2: Validate & Preview */}
      {activeStep === 2 && importJob && (
        <Card className="glass-panel" sx={{ p: 4, borderRadius: '20px' }}>
          <Typography variant="h6" sx={{ fontWeight: 900, mb: 1 }}>
            Step 3: Validation Breakdown & Safety Preview
          </Typography>
          <Typography variant="body2" sx={{ color: isDark ? '#9ca3af' : '#64748b', mb: 3 }}>
            Review rows verified for import. No live inventory records have been modified yet.
          </Typography>

          <Grid container spacing={3} sx={{ mb: 4 }}>
            <Grid item xs={12} sm={4}>
              <Card
                sx={{
                  p: 2.5,
                  borderRadius: '14px',
                  bgcolor: isDark ? 'rgba(16, 185, 129, 0.1)' : '#ecfdf5',
                  border: '1px solid #10b981',
                }}
              >
                <Typography variant="caption" sx={{ fontWeight: 800, color: '#10b981' }}>
                  VALID ROWS
                </Typography>
                <Typography variant="h4" sx={{ fontWeight: 900, color: '#10b981' }}>
                  {importJob.validRows}
                </Typography>
              </Card>
            </Grid>
            <Grid item xs={12} sm={4}>
              <Card
                sx={{
                  p: 2.5,
                  borderRadius: '14px',
                  bgcolor: isDark ? 'rgba(239, 68, 68, 0.1)' : '#fef2f2',
                  border: '1px solid #ef4444',
                }}
              >
                <Typography variant="caption" sx={{ fontWeight: 800, color: '#ef4444' }}>
                  INVALID / WARNINGS
                </Typography>
                <Typography variant="h4" sx={{ fontWeight: 900, color: '#ef4444' }}>
                  {importJob.invalidRows}
                </Typography>
              </Card>
            </Grid>
            <Grid item xs={12} sm={4}>
              <Card
                sx={{
                  p: 2.5,
                  borderRadius: '14px',
                  bgcolor: isDark ? 'rgba(139, 92, 246, 0.1)' : '#f5f3ff',
                  border: '1px solid #8b5cf6',
                }}
              >
                <Typography variant="caption" sx={{ fontWeight: 800, color: '#8b5cf6' }}>
                  TOTAL DATASET
                </Typography>
                <Typography variant="h4" sx={{ fontWeight: 900, color: '#8b5cf6' }}>
                  {importJob.totalRows}
                </Typography>
              </Card>
            </Grid>
          </Grid>

          {importJob.errors?.length > 0 && (
            <Alert severity="warning" sx={{ mb: 3 }}>
              {importJob.errors.length} validation errors detected in the dataset. Review errors
              before confirming.
            </Alert>
          )}

          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <Button startIcon={<ArrowBack />} onClick={() => setActiveStep(1)}>
              Back to Mapping
            </Button>
            <Button
              variant="contained"
              endIcon={<DoneAll />}
              disabled={processing || importJob.validRows === 0}
              onClick={handleExecuteImport}
              sx={{
                fontWeight: 800,
                borderRadius: '10px',
                px: 4,
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              }}
            >
              {processing
                ? 'Processing Ingest...'
                : `Confirm & Import ${importJob.validRows} Records`}
            </Button>
          </Box>
        </Card>
      )}

      {/* Step 3: Completed */}
      {activeStep === 3 && importJob && (
        <Card className="glass-panel" sx={{ p: 4, borderRadius: '20px', textAlign: 'center' }}>
          <CheckCircle sx={{ fontSize: 60, color: '#10b981', mb: 2 }} />
          <Typography variant="h5" sx={{ fontWeight: 900, mb: 1 }}>
            Import Process Completed Successfully!
          </Typography>
          <Typography variant="body2" sx={{ color: isDark ? '#9ca3af' : '#64748b', mb: 4 }}>
            Created <strong>{importJob.resultSummary?.createdCount || 0}</strong> new records and
            updated <strong>{importJob.resultSummary?.updatedCount || 0}</strong> existing entries.
          </Typography>

          <Button
            variant="contained"
            onClick={() => {
              setActiveStep(0);
              setFile(null);
              setParsedRows([]);
            }}
            sx={{ fontWeight: 800, borderRadius: '10px', px: 4 }}
          >
            Start Another Import
          </Button>
        </Card>
      )}
    </Box>
  );
};

export default DataImportWizard;
