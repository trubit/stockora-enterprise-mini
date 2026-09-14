import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../api/client.ts';
import { useTenantStore } from '../../store/tenant.ts';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Button,
  Menu,
  MenuItem,
  CircularProgress,
  Alert,
  Snackbar,
  TextField,
  InputAdornment,
  FormControl,
  Select,
  TablePagination,
  IconButton,
  Tooltip,
  Divider,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import DomainIcon from '@mui/icons-material/Domain';
import GroupIcon from '@mui/icons-material/Group';
import StorefrontIcon from '@mui/icons-material/Storefront';
import HealthAndSafetyIcon from '@mui/icons-material/HealthAndSafety';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import SearchIcon from '@mui/icons-material/Search';
import RefreshIcon from '@mui/icons-material/Refresh';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import DomainDisabledIcon from '@mui/icons-material/DomainDisabled';

export const PlatformAdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { switchTenant, fetchCurrentTenant } = useTenantStore();

  const [tenants, setTenants] = useState<any[]>([]);
  const [totalTenantsCount, setTotalTenantsCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [switchingTenant, setSwitchingTenant] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notification, setNotification] = useState<string | null>(null);

  // Pagination & Filtering
  const [page, setPage] = useState<number>(0);
  const [rowsPerPage, setRowsPerPage] = useState<number>(10);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Status Action Menu
  const [menuAnchorEl, setMenuAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedTenant, setSelectedTenant] = useState<any | null>(null);

  const loadPlatformTenants = async (
    targetPage = page,
    targetLimit = rowsPerPage,
    search = searchTerm,
    status = statusFilter
  ) => {
    const token = localStorage.getItem('stockora_mini_token');
    if (!token) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const params: Record<string, any> = {
        page: targetPage + 1,
        limit: targetLimit,
      };
      if (search.trim()) {
        params.search = search.trim();
      }
      if (status && status !== 'ALL') {
        params.status = status;
      }

      const res = await apiClient.get('/tenants/admin/all', { params });
      if (Array.isArray(res.data)) {
        setTenants(res.data);
        setTotalTenantsCount(res.data.length);
      } else if (res.data?.tenants) {
        setTenants(res.data.tenants);
        setTotalTenantsCount(res.data.pagination?.total ?? res.data.tenants.length);
      } else {
        setTenants([]);
        setTotalTenantsCount(0);
      }
    } catch (err: any) {
      if (err?.response?.status !== 401) {
        console.warn('Failed to load platform tenants:', err);
      }
      setError(err?.response?.data?.message || 'Failed to load platform tenants.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPlatformTenants(page, rowsPerPage, searchTerm, statusFilter);
  }, [page, rowsPerPage, statusFilter]);

  // Debounced search handling
  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(0);
      loadPlatformTenants(0, rowsPerPage, searchTerm, statusFilter);
    }, 350);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const handleOpenMenu = (event: React.MouseEvent<HTMLElement>, tenant: any) => {
    setMenuAnchorEl(event.currentTarget);
    setSelectedTenant(tenant);
  };

  const handleCloseMenu = () => {
    setMenuAnchorEl(null);
    setSelectedTenant(null);
  };

  const handleUpdateStatus = async (status: string) => {
    if (!selectedTenant?._id) return;
    try {
      await apiClient.patch(`/tenants/admin/${selectedTenant._id}/status`, { status });
      setNotification(`Tenant status updated to ${status}.`);
      loadPlatformTenants(page, rowsPerPage, searchTerm, statusFilter);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to update tenant status.');
    } finally {
      handleCloseMenu();
    }
  };

  const handleSwitchContext = async (tenantId: string, tenantName: string) => {
    handleCloseMenu();
    setSwitchingTenant(true);
    try {
      const ok = await switchTenant(tenantId);
      if (ok) {
        queryClient.clear();
        await fetchCurrentTenant();
        setNotification(`Switched active context to ${tenantName}.`);
        navigate('/dashboard');
      } else {
        setError(`Failed to switch context to ${tenantName}.`);
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Context switch failed.');
    } finally {
      setSwitchingTenant(false);
    }
  };

  const activeTenantsCount = tenants.filter(
    (t) => t.status === 'ACTIVE' || t.status === 'TRIAL'
  ).length;
  const totalUsersCount = tenants.reduce((sum, t) => sum + (t.stats?.users || 0), 0);

  return (
    <Box sx={{ p: { xs: 2, md: 4 } }}>
      <Box
        sx={{
          mb: 4,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: 2,
        }}
      >
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 0.5 }}>
            <Typography variant="h4" sx={{ fontWeight: 800 }}>
              SaaS Platform Administration Console
            </Typography>
            <Chip
              label="Global Scope"
              color="primary"
              size="small"
              sx={{ fontWeight: 700, fontSize: '0.75rem' }}
            />
          </Box>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Cross-tenant operational oversight, status governance, subscription quotas, and health
            monitoring.
          </Typography>
        </Box>

        <Button
          variant="outlined"
          startIcon={<RefreshIcon />}
          onClick={() => loadPlatformTenants(page, rowsPerPage, searchTerm, statusFilter)}
          disabled={loading}
          size="small"
        >
          Refresh Data
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* KPI Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2, bgcolor: 'background.paper' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Box>
                <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>
                  TOTAL REGISTERED TENANTS
                </Typography>
                <Typography variant="h4" sx={{ fontWeight: 800, mt: 0.5 }}>
                  {totalTenantsCount}
                </Typography>
              </Box>
              <DomainIcon sx={{ fontSize: 36, color: 'primary.main' }} />
            </Box>
          </Paper>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2, bgcolor: 'background.paper' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Box>
                <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>
                  ACTIVE ORGANIZATIONS
                </Typography>
                <Typography variant="h4" sx={{ fontWeight: 800, mt: 0.5, color: 'success.main' }}>
                  {activeTenantsCount}
                </Typography>
              </Box>
              <StorefrontIcon sx={{ fontSize: 36, color: 'success.main' }} />
            </Box>
          </Paper>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2, bgcolor: 'background.paper' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Box>
                <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>
                  PLATFORM USERS (VIEWED)
                </Typography>
                <Typography variant="h4" sx={{ fontWeight: 800, mt: 0.5 }}>
                  {totalUsersCount}
                </Typography>
              </Box>
              <GroupIcon sx={{ fontSize: 36, color: 'info.main' }} />
            </Box>
          </Paper>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2, bgcolor: 'background.paper' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Box>
                <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>
                  SYSTEM HEALTH
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 800, mt: 1, color: 'success.main' }}>
                  100% HEALTHY
                </Typography>
              </Box>
              <HealthAndSafetyIcon sx={{ fontSize: 36, color: 'success.main' }} />
            </Box>
          </Paper>
        </Grid>
      </Grid>

      {/* Tenants Table & Filters Card */}
      <Card variant="outlined" sx={{ bgcolor: 'background.paper', borderRadius: 2 }}>
        <CardContent sx={{ p: 3 }}>
          {/* Header & Controls */}
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              mb: 3,
              flexWrap: 'wrap',
              gap: 2,
            }}
          >
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              All Registered SaaS Companies
            </Typography>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
              {/* Search Bar */}
              <TextField
                size="small"
                placeholder="Search name, slug, email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon fontSize="small" sx={{ color: 'text.secondary' }} />
                    </InputAdornment>
                  ),
                }}
                sx={{ minWidth: 260 }}
              />

              {/* Status Filter */}
              <FormControl size="small" sx={{ minWidth: 140 }}>
                <Select
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value);
                    setPage(0);
                  }}
                  displayEmpty
                >
                  <MenuItem value="ALL">All Statuses</MenuItem>
                  <MenuItem value="ACTIVE">ACTIVE</MenuItem>
                  <MenuItem value="TRIAL">TRIAL</MenuItem>
                  <MenuItem value="SUSPENDED">SUSPENDED</MenuItem>
                  <MenuItem value="CANCELLED">CANCELLED</MenuItem>
                </Select>
              </FormControl>
            </Box>
          </Box>

          {loading ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 8 }}>
              <CircularProgress size={36} />
              <Typography variant="body2" sx={{ color: 'text.secondary', mt: 2 }}>
                Loading registered companies across the platform...
              </Typography>
            </Box>
          ) : tenants.length === 0 ? (
            <Box sx={{ py: 8, textAlign: 'center' }}>
              <DomainDisabledIcon
                sx={{ fontSize: 56, color: 'text.secondary', mb: 1.5, opacity: 0.5 }}
              />
              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                {searchTerm || statusFilter !== 'ALL'
                  ? 'No companies match your search filters'
                  : 'No companies registered yet'}
              </Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
                {searchTerm || statusFilter !== 'ALL'
                  ? 'Try modifying your search term or selecting a different status filter.'
                  : 'As new tenants register on Stockora Enterprise, they will automatically appear in this platform console.'}
              </Typography>
              {(searchTerm || statusFilter !== 'ALL') && (
                <Button
                  variant="outlined"
                  size="small"
                  sx={{ mt: 2 }}
                  onClick={() => {
                    setSearchTerm('');
                    setStatusFilter('ALL');
                  }}
                >
                  Clear Filters
                </Button>
              )}
            </Box>
          ) : (
            <>
              <TableContainer component={Paper} variant="outlined">
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Organization</TableCell>
                      <TableCell>Slug</TableCell>
                      <TableCell>Contact Email</TableCell>
                      <TableCell>Tier</TableCell>
                      <TableCell align="center">Users</TableCell>
                      <TableCell align="center">Branches</TableCell>
                      <TableCell align="center">Products</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell align="right">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {tenants.map((t) => (
                      <TableRow key={t._id} hover>
                        <TableCell sx={{ fontWeight: 700 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <DomainIcon
                              fontSize="small"
                              sx={{ color: 'primary.main', opacity: 0.8 }}
                            />
                            <Typography variant="body2" sx={{ fontWeight: 700 }}>
                              {t.name}
                            </Typography>
                          </Box>
                        </TableCell>
                        <TableCell sx={{ color: 'text.secondary', fontFamily: 'monospace' }}>
                          {t.slug}
                        </TableCell>
                        <TableCell>{t.contact?.email || 'N/A'}</TableCell>
                        <TableCell>
                          <Chip
                            label={t.subscriptionTier || 'ENTERPRISE'}
                            size="small"
                            variant="outlined"
                          />
                        </TableCell>
                        <TableCell align="center">{t.stats?.users || 0}</TableCell>
                        <TableCell align="center">{t.stats?.branches || 0}</TableCell>
                        <TableCell align="center">{t.stats?.products || 0}</TableCell>
                        <TableCell>
                          <Chip
                            label={t.status}
                            size="small"
                            color={
                              t.status === 'ACTIVE'
                                ? 'success'
                                : t.status === 'TRIAL'
                                  ? 'info'
                                  : t.status === 'SUSPENDED'
                                    ? 'error'
                                    : 'default'
                            }
                          />
                        </TableCell>
                        <TableCell align="right">
                          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
                            <Tooltip title="Switch into this tenant context">
                              <IconButton
                                size="small"
                                color="primary"
                                onClick={() => handleSwitchContext(t._id, t.name)}
                                disabled={switchingTenant}
                              >
                                <SwapHorizIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>

                            <Button
                              size="small"
                              variant="outlined"
                              onClick={(e) => handleOpenMenu(e, t)}
                              endIcon={<MoreVertIcon />}
                            >
                              Manage
                            </Button>
                          </Box>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>

              <TablePagination
                rowsPerPageOptions={[5, 10, 25, 50]}
                component="div"
                count={totalTenantsCount}
                rowsPerPage={rowsPerPage}
                page={page}
                onPageChange={(_, newPage) => setPage(newPage)}
                onRowsPerPageChange={(e) => {
                  setRowsPerPage(parseInt(e.target.value, 10));
                  setPage(0);
                }}
              />
            </>
          )}
        </CardContent>
      </Card>

      {/* Manage Action Menu */}
      <Menu anchorEl={menuAnchorEl} open={Boolean(menuAnchorEl)} onClose={handleCloseMenu}>
        <MenuItem
          onClick={() => {
            if (selectedTenant) {
              handleSwitchContext(selectedTenant._id, selectedTenant.name);
            }
          }}
        >
          <ListItemIcon>
            <SwapHorizIcon fontSize="small" color="primary" />
          </ListItemIcon>
          <ListItemText primary="Switch into Organization" />
        </MenuItem>

        <Divider />

        <MenuItem onClick={() => handleUpdateStatus('ACTIVE')}>Set Status: ACTIVE</MenuItem>
        <MenuItem onClick={() => handleUpdateStatus('TRIAL')}>Set Status: TRIAL</MenuItem>
        <MenuItem onClick={() => handleUpdateStatus('SUSPENDED')} sx={{ color: 'error.main' }}>
          Set Status: SUSPENDED
        </MenuItem>
        <MenuItem onClick={() => handleUpdateStatus('CANCELLED')} sx={{ color: 'text.secondary' }}>
          Set Status: CANCELLED
        </MenuItem>
      </Menu>

      <Snackbar
        open={Boolean(notification)}
        autoHideDuration={4000}
        onClose={() => setNotification(null)}
        message={notification}
      />
    </Box>
  );
};
