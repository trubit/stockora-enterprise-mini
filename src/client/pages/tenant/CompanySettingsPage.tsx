import React, { useState, useEffect } from 'react';
import { apiClient } from '../../api/client.ts';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Tabs,
  Tab,
  TextField,
  Grid,
  Button,
  Switch,
  Alert,
  Snackbar,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  LinearProgress,
  MenuItem,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import ReplayIcon from '@mui/icons-material/Replay';
import BusinessIcon from '@mui/icons-material/Business';
import PaletteIcon from '@mui/icons-material/Palette';
import PublicIcon from '@mui/icons-material/Public';
import ToggleOnIcon from '@mui/icons-material/ToggleOn';
import GroupAddIcon from '@mui/icons-material/GroupAdd';
import SpeedIcon from '@mui/icons-material/Speed';
import { useTenantStore } from '../../store/tenant.js';
import { RegionalSettingsConsole } from './RegionalSettingsConsole.tsx';
import { Can } from '../../components/auth/Can.tsx';

export const CompanySettingsPage: React.FC = () => {
  const { activeTenant, fetchCurrentTenant, updateBranding } = useTenantStore();
  const [tabIndex, setTabIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Form State
  const [profileForm, setProfileForm] = useState({
    name: '',
    legalName: '',
    email: '',
    phone: '',
    website: '',
    addressLine1: '',
    businessType: 'Retail',
    industry: '',
  });

  const [brandingForm, setBrandingForm] = useState({
    primaryColor: '#6366f1',
    secondaryColor: '#4f46e5',
    accentColor: '#10b981',
    logoUrl: '',
    receiptHeader: '',
    receiptFooter: '',
    invoiceFooter: '',
    posBannerUrl: '',
  });

  const [features, setFeatures] = useState<Record<string, boolean>>({
    pos: true,
    loyalty: true,
    crm: true,
    aiAssistant: true,
    advancedAnalytics: true,
    wholesale: true,
    creditSales: true,
    multiBranch: true,
    procurement: true,
    warehousing: true,
  });

  // Invitations
  const [invitations, setInvitations] = useState<any[]>([]);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('Employee');

  useEffect(() => {
    loadSettings();
    loadInvitations();
  }, [activeTenant?._id]);

  const loadSettings = async () => {
    if (!activeTenant) {
      await fetchCurrentTenant();
    }
    if (activeTenant) {
      setProfileForm({
        name: activeTenant.name || '',
        legalName: activeTenant.legalName || '',
        email: activeTenant.contact?.email || '',
        phone: activeTenant.contact?.phone || '',
        website: activeTenant.contact?.website || '',
        addressLine1: activeTenant.contact?.addressLine1 || '',
        businessType: activeTenant.businessType || 'Retail',
        industry: activeTenant.industry || '',
      });

      setBrandingForm({
        primaryColor: activeTenant.branding?.primaryColor || '#6366f1',
        secondaryColor: activeTenant.branding?.secondaryColor || '#4f46e5',
        accentColor: activeTenant.branding?.accentColor || '#10b981',
        logoUrl: activeTenant.branding?.logoUrl || activeTenant.logoUrl || '',
        receiptHeader: activeTenant.branding?.receiptHeader || '',
        receiptFooter: activeTenant.branding?.receiptFooter || '',
        invoiceFooter: activeTenant.branding?.invoiceFooter || '',
        posBannerUrl: activeTenant.branding?.posBannerUrl || '',
      });

      if (activeTenant.features) {
        if (activeTenant.features instanceof Map) {
          setFeatures(Object.fromEntries(activeTenant.features));
        } else if (typeof activeTenant.features === 'object') {
          setFeatures({ ...features, ...activeTenant.features });
        }
      }
    }
  };

  const loadInvitations = async () => {
    try {
      const res = await apiClient.get('/tenants/invitations');
      setInvitations(res.data || []);
    } catch (err: any) {
      if (err?.response?.status !== 401) {
        console.warn('Failed to load invitations:', err);
      }
    }
  };

  const handleSaveProfile = async () => {
    setLoading(true);
    setError(null);
    try {
      await apiClient.put('/tenants/current/profile', {
        name: profileForm.name,
        legalName: profileForm.legalName,
        businessType: profileForm.businessType,
        industry: profileForm.industry,
        contact: {
          email: profileForm.email,
          phone: profileForm.phone,
          website: profileForm.website,
          addressLine1: profileForm.addressLine1,
        },
      });
      await fetchCurrentTenant();
      setNotification('Company profile updated successfully.');
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to update profile.');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveBranding = async () => {
    setLoading(true);
    setError(null);
    try {
      await apiClient.put('/tenants/current/branding', brandingForm);
      updateBranding(brandingForm);
      await fetchCurrentTenant();
      setNotification('Branding & themes updated successfully.');
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to update branding.');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleFeature = async (featureKey: string, checked: boolean) => {
    const updatedFeatures = { ...features, [featureKey]: checked };
    setFeatures(updatedFeatures);
    try {
      await apiClient.put('/tenants/current/features', { features: updatedFeatures });
      setNotification(`Feature [${featureKey}] ${checked ? 'enabled' : 'disabled'}.`);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to update feature flag.');
    }
  };

  const handleSendInvite = async () => {
    const cleanEmail = inviteEmail.trim().toLowerCase();
    if (!cleanEmail) {
      setError('Please enter an employee email address.');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      setError('Please enter a valid email address.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await apiClient.post('/tenants/invitations', {
        email: cleanEmail,
        roleName: inviteRole || 'Employee',
      });
      setInviteEmail('');
      setNotification(`Invitation successfully sent to ${cleanEmail}.`);
      loadInvitations();
    } catch (err: any) {
      const errorMsg =
        err?.response?.data?.error?.message ||
        err?.response?.data?.message ||
        'Failed to send invitation.';
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleResendInvite = async (id: string) => {
    setError(null);
    try {
      await apiClient.post(`/tenants/invitations/${id}/resend`);
      setNotification('Invitation resent with a fresh link.');
      loadInvitations();
    } catch (err: any) {
      const errorMsg =
        err?.response?.data?.error?.message ||
        err?.response?.data?.message ||
        'Failed to resend invitation.';
      setError(errorMsg);
    }
  };

  const handleRevokeInvite = async (id: string) => {
    setError(null);
    try {
      await apiClient.delete(`/tenants/invitations/${id}`);
      setNotification('Invitation revoked.');
      loadInvitations();
    } catch (err: any) {
      const errorMsg =
        err?.response?.data?.error?.message ||
        err?.response?.data?.message ||
        'Failed to revoke invitation.';
      setError(errorMsg);
    }
  };

  return (
    <Box sx={{ p: { xs: 2, md: 4 } }}>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 800 }}>
          Company & SaaS Settings
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
          Manage your organization profile, multi-tenant branding, fiscal parameters, feature flags,
          and team access.
        </Typography>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Card variant="outlined" sx={{ bgcolor: 'background.paper', borderRadius: 2 }}>
        <Tabs
          value={tabIndex}
          onChange={(_e, val) => setTabIndex(val)}
          variant="scrollable"
          scrollButtons="auto"
          allowScrollButtonsMobile
          sx={{ borderBottom: 1, borderColor: 'divider', px: { xs: 1, sm: 2 } }}
        >
          <Tab icon={<BusinessIcon />} iconPosition="start" label="General Profile" />
          <Tab icon={<PaletteIcon />} iconPosition="start" label="Branding & Themes" />
          <Tab icon={<PublicIcon />} iconPosition="start" label="Localization & Tax" />
          <Tab icon={<ToggleOnIcon />} iconPosition="start" label="Feature Flags" />
          <Tab icon={<GroupAddIcon />} iconPosition="start" label="Team Invitations" />
          <Tab icon={<SpeedIcon />} iconPosition="start" label="Limits & Tier" />
        </Tabs>

        <CardContent sx={{ p: { xs: 1.5, sm: 3 } }}>
          {/* Tab 0: General Profile */}
          {tabIndex === 0 && (
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
                Organization Profile
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Trading Name"
                    value={profileForm.name}
                    onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Legal Entity Name"
                    value={profileForm.legalName}
                    onChange={(e) => setProfileForm({ ...profileForm, legalName: e.target.value })}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Business Email"
                    value={profileForm.email}
                    onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Phone Number"
                    value={profileForm.phone}
                    onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Website"
                    value={profileForm.website}
                    onChange={(e) => setProfileForm({ ...profileForm, website: e.target.value })}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Business Operation Model"
                    value={profileForm.businessType}
                    onChange={(e) =>
                      setProfileForm({ ...profileForm, businessType: e.target.value })
                    }
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Headquarters Address"
                    value={profileForm.addressLine1}
                    onChange={(e) =>
                      setProfileForm({ ...profileForm, addressLine1: e.target.value })
                    }
                  />
                </Grid>
              </Grid>
              <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
                <Can permission="companies:write">
                  <Button variant="contained" onClick={handleSaveProfile} disabled={loading}>
                    {loading ? 'Saving...' : 'Save Profile'}
                  </Button>
                </Can>
              </Box>
            </Box>
          )}

          {/* Tab 1: Branding */}
          {tabIndex === 1 && (
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
                Custom Branding & Document Layouts
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={4}>
                  <TextField
                    fullWidth
                    label="Primary Brand Color"
                    value={brandingForm.primaryColor}
                    onChange={(e) =>
                      setBrandingForm({ ...brandingForm, primaryColor: e.target.value })
                    }
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField
                    fullWidth
                    label="Secondary Color"
                    value={brandingForm.secondaryColor}
                    onChange={(e) =>
                      setBrandingForm({ ...brandingForm, secondaryColor: e.target.value })
                    }
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField
                    fullWidth
                    label="Accent Color"
                    value={brandingForm.accentColor}
                    onChange={(e) =>
                      setBrandingForm({ ...brandingForm, accentColor: e.target.value })
                    }
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Company Logo URL"
                    value={brandingForm.logoUrl}
                    onChange={(e) => setBrandingForm({ ...brandingForm, logoUrl: e.target.value })}
                    placeholder="https://example.com/logo.png"
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="POS Customer Facing Banner URL"
                    value={brandingForm.posBannerUrl}
                    onChange={(e) =>
                      setBrandingForm({ ...brandingForm, posBannerUrl: e.target.value })
                    }
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    multiline
                    rows={2}
                    label="Receipt Header Notice"
                    value={brandingForm.receiptHeader}
                    onChange={(e) =>
                      setBrandingForm({ ...brandingForm, receiptHeader: e.target.value })
                    }
                    placeholder="Thank you for shopping with us!"
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    multiline
                    rows={2}
                    label="Receipt Footer / Return Policy"
                    value={brandingForm.receiptFooter}
                    onChange={(e) =>
                      setBrandingForm({ ...brandingForm, receiptFooter: e.target.value })
                    }
                    placeholder="Goods returned within 7 days with valid receipt."
                  />
                </Grid>
              </Grid>
              <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
                <Can permission="companies:write">
                  <Button variant="contained" onClick={handleSaveBranding} disabled={loading}>
                    {loading ? 'Saving...' : 'Save Branding'}
                  </Button>
                </Can>
              </Box>
            </Box>
          )}

          {/* Tab 2: Localization & Regional Console */}
          {tabIndex === 2 && (
            <Box>
              <RegionalSettingsConsole />
            </Box>
          )}

          {/* Tab 3: Feature Flags */}
          {tabIndex === 3 && (
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
                Tenant Feature Flag Controls
              </Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3 }}>
                Enable or disable operational modules dynamically for your organization.
              </Typography>
              <Grid container spacing={2}>
                {Object.entries(features).map(([key, enabled]) => (
                  <Grid item xs={12} sm={6} key={key}>
                    <Paper
                      variant="outlined"
                      sx={{
                        p: 2,
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <Box>
                        <Typography
                          variant="subtitle2"
                          sx={{ fontWeight: 700, textTransform: 'capitalize' }}
                        >
                          {key.replace(/([A-Z])/g, ' $1')} Module
                        </Typography>
                        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                          {enabled ? 'Active and accessible' : 'Disabled for this tenant'}
                        </Typography>
                      </Box>
                      <Switch
                        checked={enabled}
                        onChange={(e) => handleToggleFeature(key, e.target.checked)}
                        color="primary"
                      />
                    </Paper>
                  </Grid>
                ))}
              </Grid>
            </Box>
          )}

          {/* Tab 4: Team Invitations */}
          {tabIndex === 4 && (
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
                Invite Employees & Manage Team Access
              </Typography>
              <Can permission="users:write">
                <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
                  <Grid container spacing={2} alignItems="center">
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        size="small"
                        label="Employee Email Address"
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                        placeholder="teammate@company.com"
                      />
                    </Grid>
                    <Grid item xs={12} sm={4}>
                      <TextField
                        fullWidth
                        select
                        size="small"
                        label="Assign Role"
                        value={inviteRole}
                        onChange={(e) => setInviteRole(e.target.value)}
                      >
                        <MenuItem value="Company Owner">Company Owner (Co-Owner)</MenuItem>
                        <MenuItem value="Branch Manager">Branch Manager</MenuItem>
                        <MenuItem value="Inventory Manager">Inventory Manager</MenuItem>
                        <MenuItem value="Accountant">Accountant</MenuItem>
                        <MenuItem value="Sales Manager">Sales Manager</MenuItem>
                        <MenuItem value="Cashier">Cashier</MenuItem>
                        <MenuItem value="Employee">Staff Employee</MenuItem>
                      </TextField>
                    </Grid>
                    <Grid item xs={12} sm={2}>
                      <Button
                        fullWidth
                        variant="contained"
                        onClick={handleSendInvite}
                        disabled={loading || !inviteEmail.trim()}
                      >
                        Send Invite
                      </Button>
                    </Grid>
                  </Grid>
                </Paper>
              </Can>

              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
                Pending & Active Invitations
              </Typography>
              <TableContainer
                component={Paper}
                variant="outlined"
                sx={{ overflowX: 'auto', width: '100%' }}
              >
                <Table size="small" sx={{ minWidth: 600 }}>
                  <TableHead>
                    <TableRow>
                      <TableCell>Email</TableCell>
                      <TableCell>Role</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Expires</TableCell>
                      <TableCell align="right">Action</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {invitations.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={5}
                          align="center"
                          sx={{ py: 3, color: 'text.secondary' }}
                        >
                          No team invitations found.
                        </TableCell>
                      </TableRow>
                    ) : (
                      invitations.map((inv) => (
                        <TableRow key={inv._id}>
                          <TableCell sx={{ fontWeight: 600 }}>{inv.email}</TableCell>
                          <TableCell>{inv.roleName}</TableCell>
                          <TableCell>
                            <Chip
                              label={inv.status}
                              size="small"
                              color={
                                inv.status === 'ACCEPTED'
                                  ? 'success'
                                  : inv.status === 'PENDING'
                                    ? 'warning'
                                    : 'default'
                              }
                            />
                          </TableCell>
                          <TableCell>{new Date(inv.expiresAt).toLocaleDateString()}</TableCell>
                          <TableCell align="right">
                            {inv.status === 'PENDING' && (
                              <Can permission="users:write">
                                <Box sx={{ display: 'inline-flex', gap: 0.5 }}>
                                  <IconButton
                                    size="small"
                                    color="primary"
                                    title="Resend Invitation Link"
                                    onClick={() => handleResendInvite(inv._id)}
                                  >
                                    <ReplayIcon fontSize="small" />
                                  </IconButton>
                                  <IconButton
                                    size="small"
                                    color="error"
                                    title="Revoke Invitation"
                                    onClick={() => handleRevokeInvite(inv._id)}
                                  >
                                    <DeleteIcon fontSize="small" />
                                  </IconButton>
                                </Box>
                              </Can>
                            )}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          )}

          {/* Tab 5: Limits & Tier */}
          {tabIndex === 5 && (
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
                SaaS Subscription Tier & Resource Quotas
              </Typography>
              <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 2 }}>
                <Chip
                  label={activeTenant?.subscriptionTier || 'ENTERPRISE PLAN'}
                  color="primary"
                  sx={{ fontWeight: 800, fontSize: '0.85rem' }}
                />
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  Tenant Status: <strong>{activeTenant?.status || 'ACTIVE'}</strong>
                </Typography>
              </Box>

              <Grid container spacing={3}>
                <Grid item xs={12} sm={6}>
                  <Paper variant="outlined" sx={{ p: 2 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                      Maximum Users
                    </Typography>
                    <Typography variant="h5" sx={{ my: 1, fontWeight: 800 }}>
                      {activeTenant?.limits?.maxUsers || 50}
                    </Typography>
                    <LinearProgress
                      variant="determinate"
                      value={15}
                      sx={{ height: 6, borderRadius: 3 }}
                    />
                  </Paper>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Paper variant="outlined" sx={{ p: 2 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                      Maximum Branches
                    </Typography>
                    <Typography variant="h5" sx={{ my: 1, fontWeight: 800 }}>
                      {activeTenant?.limits?.maxBranches || 10}
                    </Typography>
                    <LinearProgress
                      variant="determinate"
                      value={20}
                      color="success"
                      sx={{ height: 6, borderRadius: 3 }}
                    />
                  </Paper>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Paper variant="outlined" sx={{ p: 2 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                      Maximum POS Terminals
                    </Typography>
                    <Typography variant="h5" sx={{ my: 1, fontWeight: 800 }}>
                      {activeTenant?.limits?.maxPOSTerminals || 20}
                    </Typography>
                    <LinearProgress
                      variant="determinate"
                      value={10}
                      color="secondary"
                      sx={{ height: 6, borderRadius: 3 }}
                    />
                  </Paper>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Paper variant="outlined" sx={{ p: 2 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                      Maximum Products Catalog
                    </Typography>
                    <Typography variant="h5" sx={{ my: 1, fontWeight: 800 }}>
                      {(activeTenant?.limits?.maxProducts || 10000).toLocaleString()}
                    </Typography>
                    <LinearProgress
                      variant="determinate"
                      value={5}
                      color="info"
                      sx={{ height: 6, borderRadius: 3 }}
                    />
                  </Paper>
                </Grid>
              </Grid>
            </Box>
          )}
        </CardContent>
      </Card>

      <Snackbar
        open={Boolean(notification)}
        autoHideDuration={4000}
        onClose={() => setNotification(null)}
        message={notification}
      />
    </Box>
  );
};
