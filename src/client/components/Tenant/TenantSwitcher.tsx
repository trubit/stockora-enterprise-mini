import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import {
  Box,
  Button,
  Menu,
  MenuItem,
  Typography,
  Chip,
  Avatar,
  Divider,
  ListItemIcon,
  ListItemText,
  CircularProgress,
} from '@mui/material';
import BusinessIcon from '@mui/icons-material/Business';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import SettingsIcon from '@mui/icons-material/Settings';
import DomainIcon from '@mui/icons-material/Domain';
import { useTenantStore } from '../../store/tenant.js';
import { useAuthStore } from '../../store/auth.ts';
import { isPlatformSuperAdmin } from '../../../shared/permissions.js';

export const TenantSwitcher: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [switching, setSwitching] = useState(false);

  const user = useAuthStore((s) => s.user);
  const isPlatformAdmin = isPlatformSuperAdmin(user);

  const { activeTenant, userTenants, fetchCurrentTenant, fetchUserTenants, switchTenant } =
    useTenantStore();

  useEffect(() => {
    fetchCurrentTenant();
    fetchUserTenants();
  }, []);

  const isMenuOpen = Boolean(anchorEl);

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    if (switching) return;
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleSelectTenant = async (tenantId: string) => {
    if (activeTenant && (activeTenant._id === tenantId || activeTenant.id === tenantId)) {
      handleClose();
      return;
    }

    // Close menu first so focus smoothly transitions back to the trigger button
    handleClose();
    setSwitching(true);

    try {
      const success = await switchTenant(tenantId);
      if (success) {
        // Complete query cache isolation: clear all cached queries so old tenant data is purged
        queryClient.clear();
        await fetchCurrentTenant();
        // Refresh router navigation to reload current page under new tenant context
        navigate(0);
      }
    } catch (err) {
      console.error('Failed to switch company:', err);
    } finally {
      setSwitching(false);
    }
  };

  const hasCompany = Boolean(activeTenant);
  const currentCompanyName = activeTenant?.name || 'No Company Yet';
  const currentCompanySlug = activeTenant?.slug || 'Create your company to get started';
  const currentStatus = activeTenant?.status || 'PENDING';

  return (
    <Box sx={{ display: 'inline-flex', alignItems: 'center' }}>
      <Button
        ref={buttonRef}
        id="tenant-switcher-button"
        aria-haspopup="true"
        aria-expanded={isMenuOpen}
        aria-controls={isMenuOpen ? 'tenant-switcher-menu' : undefined}
        aria-busy={switching}
        onClick={handleClick}
        variant="outlined"
        size="small"
        sx={{
          textTransform: 'none',
          borderColor: 'rgba(255, 255, 255, 0.18)',
          backgroundColor: 'rgba(255, 255, 255, 0.06)',
          color: 'inherit',
          borderRadius: '8px',
          px: 1.5,
          py: 0.6,
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          pointerEvents: switching ? 'none' : 'auto',
          opacity: switching ? 0.8 : 1,
          '&:hover': {
            backgroundColor: 'rgba(255, 255, 255, 0.12)',
            borderColor: 'primary.main',
          },
        }}
      >
        <Avatar
          src={activeTenant?.branding?.logoUrl || activeTenant?.logoUrl}
          sx={{
            width: 24,
            height: 24,
            bgcolor: activeTenant?.branding?.primaryColor || 'primary.main',
            fontSize: '0.75rem',
            fontWeight: 700,
          }}
        >
          {hasCompany ? currentCompanyName.charAt(0).toUpperCase() : '+'}
        </Avatar>

        <Box sx={{ textAlign: 'left', display: { xs: 'none', sm: 'block' } }}>
          <Typography
            variant="body2"
            sx={{ fontWeight: 600, lineHeight: 1.1, fontSize: '0.82rem' }}
          >
            {currentCompanyName}
          </Typography>
          <Typography
            variant="caption"
            sx={{ color: 'text.secondary', fontSize: '0.7rem', display: 'block' }}
          >
            {currentCompanySlug}
          </Typography>
        </Box>

        {switching ? (
          <CircularProgress size={16} color="inherit" />
        ) : (
          <SwapHorizIcon sx={{ fontSize: 18, color: 'text.secondary', ml: 0.5 }} />
        )}
      </Button>

      <Menu
        id="tenant-switcher-menu"
        anchorEl={anchorEl}
        open={isMenuOpen}
        onClose={handleClose}
        MenuListProps={{
          'aria-labelledby': 'tenant-switcher-button',
        }}
        slotProps={{
          paper: {
            sx: {
              minWidth: { xs: 260, sm: 280 },
              maxWidth: 'calc(100vw - 24px)',
              borderRadius: '12px',
              bgcolor: '#1a1f2c',
              border: '1px solid rgba(255,255,255,0.1)',
              boxShadow: '0 12px 32px rgba(0,0,0,0.5)',
              p: 0.5,
            },
          },
        }}
      >
        {hasCompany ? (
          <Box sx={{ px: 2, py: 1.5 }}>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                mb: 0.5,
              }}
            >
              <Typography
                variant="caption"
                sx={{ color: 'text.secondary', textTransform: 'uppercase', fontWeight: 700 }}
              >
                Active Company
              </Typography>
              {isPlatformAdmin && (
                <Chip
                  label="Super Admin"
                  size="small"
                  color="primary"
                  sx={{ height: 18, fontSize: '0.62rem', fontWeight: 700 }}
                />
              )}
            </Box>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                mt: 0.5,
                gap: 1,
              }}
            >
              <Typography
                variant="subtitle2"
                sx={{
                  fontWeight: 700,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {currentCompanyName}
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0 }}>
                {activeTenant?.onboardingCompleted === false && (
                  <Chip
                    label="Setup Required"
                    size="small"
                    color="warning"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleClose();
                      navigate('/onboarding');
                    }}
                    sx={{ height: 20, fontSize: '0.65rem', fontWeight: 700, cursor: 'pointer' }}
                  />
                )}
                <Chip
                  label={currentStatus}
                  size="small"
                  color={currentStatus === 'ACTIVE' ? 'success' : 'warning'}
                  sx={{ height: 20, fontSize: '0.65rem', fontWeight: 600 }}
                />
              </Box>
            </Box>
          </Box>
        ) : (
          <Box sx={{ px: 2, py: 1.5, textAlign: 'center' }}>
            <BusinessIcon sx={{ fontSize: 28, color: 'text.secondary', mb: 0.5 }} />
            <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
              No company yet
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
              Create your company to get started.
            </Typography>
          </Box>
        )}

        <Divider sx={{ my: 0.5, borderColor: 'rgba(255,255,255,0.08)' }} />

        {userTenants && (userTenants.length > 1 || (isPlatformAdmin && userTenants.length > 0))
          ? [
              <Typography
                key="header-switch-org"
                variant="caption"
                sx={{ px: 2, py: 0.5, color: 'text.secondary', display: 'block', fontWeight: 600 }}
              >
                Switch Organization
              </Typography>,
              ...userTenants.map((ut) => {
                const isSelected = Boolean(
                  activeTenant &&
                  (activeTenant._id === ut.tenantId || activeTenant.id === ut.tenantId)
                );
                return (
                  <MenuItem
                    key={ut.tenantId}
                    onClick={() => handleSelectTenant(ut.tenantId)}
                    selected={isSelected}
                    sx={{
                      borderRadius: '6px',
                      my: 0.2,
                      display: 'flex',
                      justifyContent: 'space-between',
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2 }}>
                      <BusinessIcon
                        sx={{ fontSize: 20, color: isSelected ? 'primary.main' : 'text.secondary' }}
                      />
                      <Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                          <Typography variant="body2" sx={{ fontWeight: isSelected ? 700 : 500 }}>
                            {ut.tenantName || ut.tenantSlug || 'Company'}
                          </Typography>
                          {ut.status && ut.status !== 'ACTIVE' && (
                            <Chip
                              label={ut.status}
                              size="small"
                              color={ut.status === 'SUSPENDED' ? 'error' : 'warning'}
                              sx={{ height: 16, fontSize: '0.6rem', fontWeight: 600 }}
                            />
                          )}
                        </Box>
                        <Typography
                          variant="caption"
                          sx={{ color: 'text.secondary', fontSize: '0.7rem' }}
                        >
                          Role: {ut.roleName}
                        </Typography>
                      </Box>
                    </Box>
                    {isSelected && <CheckCircleIcon sx={{ fontSize: 16, color: 'primary.main' }} />}
                  </MenuItem>
                );
              }),
              <Divider
                key="divider-switch-org"
                sx={{ my: 0.5, borderColor: 'rgba(255,255,255,0.08)' }}
              />,
            ]
          : null}

        {isPlatformAdmin && (
          <MenuItem
            onClick={() => {
              handleClose();
              navigate('/admin/platform');
            }}
            sx={{ borderRadius: '6px' }}
          >
            <ListItemIcon>
              <DomainIcon sx={{ fontSize: 18, color: 'primary.main' }} />
            </ListItemIcon>
            <ListItemText
              primary="Platform Admin Console"
              primaryTypographyProps={{ variant: 'body2', color: 'primary.main', fontWeight: 600 }}
            />
          </MenuItem>
        )}

        <MenuItem
          onClick={() => {
            handleClose();
            navigate('/company/settings');
          }}
          sx={{ borderRadius: '6px' }}
        >
          <ListItemIcon>
            <SettingsIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
          </ListItemIcon>
          <ListItemText primary="Company Settings" primaryTypographyProps={{ variant: 'body2' }} />
        </MenuItem>

        <MenuItem
          onClick={() => {
            handleClose();
            navigate('/onboarding');
          }}
          sx={{ borderRadius: '6px' }}
        >
          <ListItemIcon>
            <AddCircleOutlineIcon sx={{ fontSize: 18, color: 'primary.main' }} />
          </ListItemIcon>
          <ListItemText
            primary="Register New Company"
            primaryTypographyProps={{ variant: 'body2', color: 'primary.main', fontWeight: 600 }}
          />
        </MenuItem>
      </Menu>
    </Box>
  );
};
