import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  Card,
  CardContent,
  Chip,
  Tabs,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material';
import StoreIcon from '@mui/icons-material/Store';
import StarIcon from '@mui/icons-material/Star';
import { api } from '../../api/client.ts';
import { toast } from 'react-hot-toast';

export default function SupplierProfileManager() {
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [selectedSupplier, setSelectedSupplier] = useState<any>(null);
  const [activeTab, setActiveTab] = useState(0);

  const fetchSuppliers = async () => {
    try {
      const res = await api.get('/procurement-advanced/suppliers');
      setSuppliers(res.data || []);
      if (res.data && res.data.length > 0) {
        setSelectedSupplier(res.data[0]);
      }
    } catch {
      toast.error('Failed to load supplier profile data.');
    }
  };

  useEffect(() => {
    fetchSuppliers();
  }, []);

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
          <StoreIcon fontSize="large" /> 360° Supplier Intelligence Profile & Scorecards
        </Typography>
        <Typography variant="body2" sx={{ color: '#9ca3af', mt: 0.5 }}>
          Comprehensive vendor scorecard, contracts, volume price breaks, order lead times & quality
          compliance metrics
        </Typography>
      </Box>

      {/* Supplier Selector List */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} md={4}>
          <Paper
            sx={{
              p: 2,
              background: '#111827',
              border: '1px solid #1f2937',
              borderRadius: 3,
              color: '#f8fafc',
            }}
          >
            <Typography variant="subtitle2" sx={{ color: '#9ca3af', mb: 1, fontWeight: 700 }}>
              SELECT SUPPLIER DIRECTORY
            </Typography>
            {suppliers.map((s) => (
              <Box
                key={s._id}
                onClick={() => setSelectedSupplier(s)}
                sx={{
                  p: 2,
                  mb: 1,
                  borderRadius: 2,
                  cursor: 'pointer',
                  background: selectedSupplier?._id === s._id ? '#1e293b' : 'transparent',
                  border:
                    selectedSupplier?._id === s._id ? '1px solid #8b5cf6' : '1px solid transparent',
                  '&:hover': { background: '#1e293b' },
                }}
              >
                <Box
                  sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                >
                  <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#f8fafc' }}>
                    {s.name} ({s.code})
                  </Typography>
                  <Chip
                    label={s.status}
                    size="small"
                    sx={{
                      fontWeight: 600,
                      background:
                        s.status === 'ACTIVE'
                          ? 'rgba(16, 185, 129, 0.2)'
                          : 'rgba(239, 68, 68, 0.2)',
                      color: s.status === 'ACTIVE' ? '#34d399' : '#f87171',
                    }}
                  />
                </Box>
                <Typography variant="caption" sx={{ color: '#9ca3af', display: 'block', mt: 0.5 }}>
                  {s.contactPerson} • {s.email}
                </Typography>
              </Box>
            ))}
          </Paper>
        </Grid>

        {/* Supplier Profile Detail View */}
        <Grid item xs={12} md={8}>
          {selectedSupplier ? (
            <Paper
              sx={{
                p: 3,
                background: '#111827',
                border: '1px solid #1f2937',
                borderRadius: 3,
                color: '#f8fafc',
              }}
            >
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  mb: 2,
                }}
              >
                <Box>
                  <Typography variant="h5" sx={{ fontWeight: 800, color: '#f8fafc' }}>
                    {selectedSupplier.name}
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#9ca3af' }}>
                    Code: {selectedSupplier.code} • Category:{' '}
                    {selectedSupplier.category || 'DISTRIBUTOR'} • Currency:{' '}
                    {selectedSupplier.currency || 'USD'}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <StarIcon sx={{ color: '#fbbf24' }} />
                  <Typography variant="h6" sx={{ fontWeight: 800, color: '#fbbf24' }}>
                    {selectedSupplier.rating || 5}.0 / 5.0
                  </Typography>
                </Box>
              </Box>

              {/* Scorecard KPI Cards */}
              <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid item xs={3}>
                  <Card sx={{ background: '#1f2937', color: '#f8fafc', borderRadius: 2 }}>
                    <CardContent sx={{ p: 1.5 }}>
                      <Typography variant="caption" sx={{ color: '#9ca3af' }}>
                        On-Time Delivery
                      </Typography>
                      <Typography variant="h6" sx={{ fontWeight: 800, color: '#34d399' }}>
                        {selectedSupplier.scorecard?.onTimeDeliveryRate || 96}%
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={3}>
                  <Card sx={{ background: '#1f2937', color: '#f8fafc', borderRadius: 2 }}>
                    <CardContent sx={{ p: 1.5 }}>
                      <Typography variant="caption" sx={{ color: '#9ca3af' }}>
                        Quality Rate
                      </Typography>
                      <Typography variant="h6" sx={{ fontWeight: 800, color: '#38bdf8' }}>
                        {selectedSupplier.scorecard?.qualityRate || 98}%
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={3}>
                  <Card sx={{ background: '#1f2937', color: '#f8fafc', borderRadius: 2 }}>
                    <CardContent sx={{ p: 1.5 }}>
                      <Typography variant="caption" sx={{ color: '#9ca3af' }}>
                        Lead Time
                      </Typography>
                      <Typography variant="h6" sx={{ fontWeight: 800, color: '#fbbf24' }}>
                        {selectedSupplier.leadTimeDays || 7} Days
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={3}>
                  <Card sx={{ background: '#1f2937', color: '#f8fafc', borderRadius: 2 }}>
                    <CardContent sx={{ p: 1.5 }}>
                      <Typography variant="caption" sx={{ color: '#9ca3af' }}>
                        Overall Score
                      </Typography>
                      <Typography variant="h6" sx={{ fontWeight: 800, color: '#818cf8' }}>
                        {selectedSupplier.scorecard?.overallScore || 95}%
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>

              <Tabs
                value={activeTab}
                onChange={(_, v) => setActiveTab(v)}
                sx={{ mb: 2, borderBottom: '1px solid #1f2937' }}
              >
                <Tab
                  label="Performance Scorecard"
                  sx={{ color: '#9ca3af', '&.Mui-selected': { color: '#8b5cf6' } }}
                />
                <Tab
                  label="Contracts & Agreements"
                  sx={{ color: '#9ca3af', '&.Mui-selected': { color: '#8b5cf6' } }}
                />
                <Tab
                  label="Payment & Address Terms"
                  sx={{ color: '#9ca3af', '&.Mui-selected': { color: '#8b5cf6' } }}
                />
              </Tabs>

              {activeTab === 0 && (
                <Box>
                  <Typography variant="body2" sx={{ color: '#cbd5e1', mb: 2 }}>
                    Weighted scoring evaluates vendor delivery performance (30%), product quality
                    (30%), price stability (20%), and fill rate (20%).
                  </Typography>
                </Box>
              )}

              {activeTab === 1 && (
                <Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1, color: '#8b5cf6' }}>
                    Active Master Supply Contracts
                  </Typography>
                  <TableContainer>
                    <Table size="small">
                      <TableHead sx={{ background: '#1f2937' }}>
                        <TableRow>
                          <TableCell sx={{ color: '#9ca3af' }}>Contract #</TableCell>
                          <TableCell sx={{ color: '#9ca3af' }}>Title</TableCell>
                          <TableCell sx={{ color: '#9ca3af' }}>Payment Terms</TableCell>
                          <TableCell sx={{ color: '#9ca3af' }}>Status</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        <TableRow>
                          <TableCell sx={{ color: '#818cf8', fontWeight: 700 }}>
                            CNT-2026-001
                          </TableCell>
                          <TableCell sx={{ color: '#f8fafc' }}>
                            Annual Master Supply Contract
                          </TableCell>
                          <TableCell sx={{ color: '#cbd5e1' }}>
                            {selectedSupplier.paymentTerms || 'NET 30'}
                          </TableCell>
                          <TableCell>
                            <Chip
                              label="ACTIVE"
                              size="small"
                              sx={{ background: 'rgba(16, 185, 129, 0.2)', color: '#34d399' }}
                            />
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Box>
              )}

              {activeTab === 2 && (
                <Box sx={{ color: '#cbd5e1' }}>
                  <Typography variant="body2" sx={{ mb: 1 }}>
                    <strong>Contact:</strong> {selectedSupplier.contactPerson} (
                    {selectedSupplier.phone})
                  </Typography>
                  <Typography variant="body2" sx={{ mb: 1 }}>
                    <strong>Billing Address:</strong> {selectedSupplier.address},{' '}
                    {selectedSupplier.country || 'USA'}
                  </Typography>
                  <Typography variant="body2">
                    <strong>Tax ID:</strong> {selectedSupplier.taxId || 'TAX-9921-US'}
                  </Typography>
                </Box>
              )}
            </Paper>
          ) : (
            <Paper
              sx={{
                p: 4,
                background: '#111827',
                border: '1px solid #1f2937',
                borderRadius: 3,
                textAlign: 'center',
                color: '#9ca3af',
              }}
            >
              Select a supplier from the list to view their 360° scorecard.
            </Paper>
          )}
        </Grid>
      </Grid>
    </Box>
  );
}
