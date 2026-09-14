import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../api/client.ts';
import { STORAGE_KEYS } from '../../constants/storage.ts';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Stepper,
  Step,
  StepLabel,
  Button,
  TextField,
  Grid,
  MenuItem,
  Alert,
  CircularProgress,
  Paper,
} from '@mui/material';
import BusinessIcon from '@mui/icons-material/Business';
import StoreIcon from '@mui/icons-material/Store';
import InventoryIcon from '@mui/icons-material/Inventory';
import PointOfSaleIcon from '@mui/icons-material/PointOfSale';
import GroupAddIcon from '@mui/icons-material/GroupAdd';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import { useTenantStore } from '../../store/tenant.js';

const steps = [
  'Company Profile',
  'Business Model',
  'Localization',
  'Primary Branch',
  'Warehouse Setup',
  'POS Terminal',
  'Team Invitation',
  'Launch Setup',
];

export const TenantOnboardingWizard: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { activeTenant, setActiveTenant, fetchCurrentTenant } = useTenantStore();

  const [activeStep, setActiveStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    name: activeTenant?.name || '',
    legalName: activeTenant?.legalName || activeTenant?.name || '',
    email: activeTenant?.contact?.email || '',
    phone: activeTenant?.contact?.phone || '',
    website: activeTenant?.contact?.website || '',
    businessType: activeTenant?.businessType || 'Retail',
    industry: activeTenant?.industry || 'Consumer Goods',
    currency: activeTenant?.fiscalConfig?.currency || 'USD',
    currencySymbol: activeTenant?.fiscalConfig?.currencySymbol || '$',
    timezone: activeTenant?.fiscalConfig?.timezone || 'UTC',
    branchName: 'Main Branch',
    branchCode: 'MAIN',
    branchAddress: '',
    warehouseName: 'Main Warehouse',
    warehouseCode: 'MAIN-WH',
    posTerminalName: 'Checkout Terminal 1',
    posTerminalCode: 'POS-001',
    inviteEmail: '',
    inviteRole: 'Cashier',
  });

  useEffect(() => {
    if (activeTenant) {
      setFormData((prev) => ({
        ...prev,
        name: prev.name || activeTenant.name || '',
        legalName: prev.legalName || activeTenant.legalName || activeTenant.name || '',
        email: prev.email || activeTenant.contact?.email || '',
        phone: prev.phone || activeTenant.contact?.phone || '',
        currency: prev.currency || activeTenant.fiscalConfig?.currency || 'USD',
        currencySymbol: prev.currencySymbol || activeTenant.fiscalConfig?.currencySymbol || '$',
        timezone: prev.timezone || activeTenant.fiscalConfig?.timezone || 'UTC',
      }));
    }
  }, [activeTenant]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleNext = () => {
    setError(null);
    if (activeStep === 0 && (!formData.name.trim() || !formData.email.trim())) {
      setError('Company Name and Primary Contact Email are required.');
      return;
    }
    if (activeStep === 3 && (!formData.branchName.trim() || !formData.branchCode.trim())) {
      setError('Branch Name and Branch Code are required.');
      return;
    }
    setActiveStep((prev) => prev + 1);
  };

  const handleBack = () => {
    setError(null);
    setActiveStep((prev) => prev - 1);
  };

  const handleCompleteOnboarding = async () => {
    setLoading(true);
    setError(null);

    try {
      const payload = {
        name: formData.name,
        legalName: formData.legalName || formData.name,
        businessType: formData.businessType,
        industry: formData.industry,
        email: formData.email,
        phone: formData.phone,
        address: formData.branchAddress,
        currency: formData.currency,
        currencySymbol: formData.currencySymbol,
        timezone: formData.timezone,
        branchName: formData.branchName,
        branchCode: formData.branchCode,
      };

      const res = await apiClient.post('/tenants/onboard', payload);

      const { tenant, token: newToken } = res.data;
      if (newToken) {
        localStorage.setItem(STORAGE_KEYS.TOKEN, newToken);
      }
      if (tenant) {
        setActiveTenant(tenant);
      }

      // Optional team invitation
      if (formData.inviteEmail.trim()) {
        try {
          await apiClient.post('/tenants/invitations', {
            email: formData.inviteEmail.trim().toLowerCase(),
            roleName: formData.inviteRole || 'Employee',
          });
        } catch (invErr) {
          console.warn('Failed to send optional invite during wizard:', invErr);
        }
      }

      await fetchCurrentTenant();
      await queryClient.invalidateQueries();
      navigate('/');
    } catch (err: any) {
      console.error('Onboarding submission failed:', err);
      setError(
        err?.response?.data?.message || 'Failed to complete company setup. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ maxWidth: 900, mx: 'auto', p: { xs: 2, md: 4 }, py: 6 }}>
      <Paper
        elevation={0}
        sx={{
          p: 4,
          borderRadius: 3,
          bgcolor: 'background.paper',
          border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '0 16px 40px rgba(0,0,0,0.3)',
        }}
      >
        <Box sx={{ textAlign: 'center', mb: 4 }}>
          <BusinessIcon sx={{ fontSize: 44, color: 'primary.main', mb: 1 }} />
          <Typography variant="h4" sx={{ fontWeight: 800 }}>
            Company Onboarding Wizard
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
            Set up your dedicated multi-tenant enterprise organization in just a few steps.
          </Typography>
        </Box>

        <Stepper
          activeStep={activeStep}
          alternativeLabel
          sx={{ mb: 4, display: { xs: 'none', sm: 'flex' } }}
        >
          {steps.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>

        {error && (
          <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        <Card
          variant="outlined"
          sx={{ bgcolor: 'rgba(255,255,255,0.02)', borderColor: 'rgba(255,255,255,0.08)', mb: 4 }}
        >
          <CardContent sx={{ p: 3 }}>
            {/* Step 1: Company Profile */}
            {activeStep === 0 && (
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
                  Step 1: General Company Information
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Company Trading Name *"
                      name="name"
                      value={formData.name}
                      onChange={handleChange}
                      placeholder="e.g. Global Retail Solutions"
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Legal Entity Name"
                      name="legalName"
                      value={formData.legalName}
                      onChange={handleChange}
                      placeholder="e.g. Truson Foods Limited"
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Primary Contact Email *"
                      name="email"
                      type="email"
                      value={formData.email}
                      onChange={handleChange}
                      placeholder="contact@company.com"
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Company Phone Number"
                      name="phone"
                      value={formData.phone}
                      onChange={handleChange}
                      placeholder="+1 (555) 019-2834"
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="Official Website URL"
                      name="website"
                      value={formData.website}
                      onChange={handleChange}
                      placeholder="https://www.company.com"
                    />
                  </Grid>
                </Grid>
              </Box>
            )}

            {/* Step 2: Business Model */}
            {activeStep === 1 && (
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
                  Step 2: Business Model & Industry
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      select
                      label="Business Operation Model"
                      name="businessType"
                      value={formData.businessType}
                      onChange={handleChange}
                    >
                      <MenuItem value="Retail">Retail Store / Chain</MenuItem>
                      <MenuItem value="Wholesale">Wholesale & Distribution</MenuItem>
                      <MenuItem value="Manufacturing">Manufacturing & Assembly</MenuItem>
                      <MenuItem value="Supermarket">Supermarket / Grocery</MenuItem>
                      <MenuItem value="Pharmacy">Pharmacy & Healthcare</MenuItem>
                      <MenuItem value="Food & Beverage">Food & Beverage / Restaurant</MenuItem>
                      <MenuItem value="Services">Services & Consulting</MenuItem>
                    </TextField>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Industry Sector"
                      name="industry"
                      value={formData.industry}
                      onChange={handleChange}
                      placeholder="e.g. Electronics, Fashion, FMCG"
                    />
                  </Grid>
                </Grid>
              </Box>
            )}

            {/* Step 3: Localization */}
            {activeStep === 2 && (
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
                  Step 3: Currency, Symbol & Timezone
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={4}>
                    <TextField
                      fullWidth
                      label="Operating Currency"
                      name="currency"
                      value={formData.currency}
                      onChange={handleChange}
                      placeholder="USD, EUR, GBP, NGN, KES"
                    />
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <TextField
                      fullWidth
                      label="Currency Symbol"
                      name="currencySymbol"
                      value={formData.currencySymbol}
                      onChange={handleChange}
                      placeholder="$, €, £, ₦"
                    />
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <TextField
                      fullWidth
                      select
                      label="Business Timezone"
                      name="timezone"
                      value={formData.timezone}
                      onChange={handleChange}
                    >
                      <MenuItem value="UTC">UTC (Coordinated Universal Time)</MenuItem>
                      <MenuItem value="America/New_York">Eastern Time (US/New York)</MenuItem>
                      <MenuItem value="America/Los_Angeles">Pacific Time (US/Los Angeles)</MenuItem>
                      <MenuItem value="Europe/London">London (GMT/BST)</MenuItem>
                      <MenuItem value="Africa/Lagos">West Africa (Lagos / UTC+1)</MenuItem>
                      <MenuItem value="Asia/Dubai">Gulf Standard (Dubai / UTC+4)</MenuItem>
                      <MenuItem value="Asia/Tokyo">Japan Standard (Tokyo / UTC+9)</MenuItem>
                    </TextField>
                  </Grid>
                </Grid>
              </Box>
            )}

            {/* Step 4: Primary Branch */}
            {activeStep === 3 && (
              <Box>
                <Typography
                  variant="h6"
                  sx={{ fontWeight: 700, mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}
                >
                  <StoreIcon color="primary" /> Step 4: First Physical Branch / Store
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Branch Name *"
                      name="branchName"
                      value={formData.branchName}
                      onChange={handleChange}
                      placeholder="e.g. Lagos Flagship Store"
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Unique Branch Code *"
                      name="branchCode"
                      value={formData.branchCode}
                      onChange={handleChange}
                      placeholder="e.g. LAG-01"
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="Branch Physical Address"
                      name="branchAddress"
                      value={formData.branchAddress}
                      onChange={handleChange}
                      placeholder="12 Commercial Avenue, Victoria Island"
                    />
                  </Grid>
                </Grid>
              </Box>
            )}

            {/* Step 5: Warehouse Setup */}
            {activeStep === 4 && (
              <Box>
                <Typography
                  variant="h6"
                  sx={{ fontWeight: 700, mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}
                >
                  <InventoryIcon color="primary" /> Step 5: Primary Warehouse / Stock Location
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Warehouse Name"
                      name="warehouseName"
                      value={formData.warehouseName}
                      onChange={handleChange}
                      placeholder="Main Distribution Center"
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Warehouse Code"
                      name="warehouseCode"
                      value={formData.warehouseCode}
                      onChange={handleChange}
                      placeholder="MAIN-WH"
                    />
                  </Grid>
                </Grid>
              </Box>
            )}

            {/* Step 6: POS Terminal */}
            {activeStep === 5 && (
              <Box>
                <Typography
                  variant="h6"
                  sx={{ fontWeight: 700, mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}
                >
                  <PointOfSaleIcon color="primary" /> Step 6: Point of Sale Terminal Registration
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="POS Terminal Name"
                      name="posTerminalName"
                      value={formData.posTerminalName}
                      onChange={handleChange}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Terminal ID / Code"
                      name="posTerminalCode"
                      value={formData.posTerminalCode}
                      onChange={handleChange}
                    />
                  </Grid>
                </Grid>
              </Box>
            )}

            {/* Step 7: Team Invitation */}
            {activeStep === 6 && (
              <Box>
                <Typography
                  variant="h6"
                  sx={{ fontWeight: 700, mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}
                >
                  <GroupAddIcon color="primary" /> Step 7: Invite First Team Member (Optional)
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={8}>
                    <TextField
                      fullWidth
                      label="Colleague Email"
                      name="inviteEmail"
                      value={formData.inviteEmail}
                      onChange={handleChange}
                      placeholder="cashier@company.com"
                    />
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <TextField
                      fullWidth
                      select
                      label="Assigned Role"
                      name="inviteRole"
                      value={formData.inviteRole}
                      onChange={handleChange}
                    >
                      <MenuItem value="Company Owner">Company Owner (Co-Owner)</MenuItem>
                      <MenuItem value="Branch Manager">Branch Manager</MenuItem>
                      <MenuItem value="Inventory Manager">Inventory Manager</MenuItem>
                      <MenuItem value="Accountant">Accountant</MenuItem>
                      <MenuItem value="Cashier">Cashier</MenuItem>
                    </TextField>
                  </Grid>
                </Grid>
              </Box>
            )}

            {/* Step 8: Review & Launch */}
            {activeStep === 7 && (
              <Box sx={{ textAlign: 'center', py: 2 }}>
                <CheckCircleOutlineIcon sx={{ fontSize: 54, color: 'success.main', mb: 2 }} />
                <Typography variant="h5" sx={{ fontWeight: 800, mb: 1 }}>
                  Ready to Launch {formData.name || 'Your Company'}!
                </Typography>
                <Typography
                  variant="body2"
                  sx={{ color: 'text.secondary', maxWidth: 600, mx: 'auto', mb: 3 }}
                >
                  Your enterprise multi-tenant organization will be provisioned with dedicated
                  inventory, branch hierarchies, point of sale terminals, and AI analytics.
                </Typography>

                <Paper
                  variant="outlined"
                  sx={{ p: 2, bgcolor: 'rgba(0,0,0,0.2)', textAlign: 'left', mb: 3 }}
                >
                  <Grid container spacing={2}>
                    <Grid item xs={6} sm={3}>
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        Company
                      </Typography>
                      <Typography variant="body2" sx={{ fontWeight: 700 }}>
                        {formData.name}
                      </Typography>
                    </Grid>
                    <Grid item xs={6} sm={3}>
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        Currency
                      </Typography>
                      <Typography variant="body2" sx={{ fontWeight: 700 }}>
                        {formData.currency} ({formData.currencySymbol})
                      </Typography>
                    </Grid>
                    <Grid item xs={6} sm={3}>
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        First Branch
                      </Typography>
                      <Typography variant="body2" sx={{ fontWeight: 700 }}>
                        {formData.branchName}
                      </Typography>
                    </Grid>
                    <Grid item xs={6} sm={3}>
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        Timezone
                      </Typography>
                      <Typography variant="body2" sx={{ fontWeight: 700 }}>
                        {formData.timezone}
                      </Typography>
                    </Grid>
                  </Grid>
                </Paper>
              </Box>
            )}
          </CardContent>
        </Card>

        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Button disabled={activeStep === 0 || loading} onClick={handleBack} variant="outlined">
            Back
          </Button>

          {activeStep < steps.length - 1 ? (
            <Button onClick={handleNext} variant="contained">
              Continue
            </Button>
          ) : (
            <Button
              onClick={handleCompleteOnboarding}
              variant="contained"
              color="success"
              disabled={loading}
              startIcon={loading && <CircularProgress size={18} color="inherit" />}
            >
              {loading ? 'Provisioning Tenant...' : 'Launch Company Dashboard'}
            </Button>
          )}
        </Box>
      </Paper>
    </Box>
  );
};
