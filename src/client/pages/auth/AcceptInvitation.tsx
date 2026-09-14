import React, { useEffect, useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  CircularProgress,
  Chip,
  Alert,
  IconButton,
  InputAdornment,
} from '@mui/material';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { toast } from 'react-hot-toast';
import BusinessIcon from '@mui/icons-material/Business';
import BadgeIcon from '@mui/icons-material/Badge';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import { useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../api/client.ts';
import { useAuthStore } from '../../store/auth.ts';
import { useTenantStore } from '../../store/tenant.ts';

interface InvitationDetails {
  email: string;
  roleName: string;
  companyName: string;
  companySlug: string;
  branchName?: string;
  expiresAt: string;
}

export default function AcceptInvitation() {
  const { token: routeToken } = useParams<{ token?: string }>();
  const [searchParams] = useSearchParams();
  const token = routeToken || searchParams.get('token') || '';
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const user = useAuthStore((s) => s.user);
  const setSession = useAuthStore((s) => s.setSession);
  const clearSession = useAuthStore((s) => s.clearSession);

  const setActiveTenant = useTenantStore((s) => s.setActiveTenant);
  const fetchCurrentTenant = useTenantStore((s) => s.fetchCurrentTenant);
  const fetchUserTenants = useTenantStore((s) => s.fetchUserTenants);

  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<
    'VALID' | 'EXPIRED' | 'ALREADY_USED' | 'REVOKED' | 'INVALID' | 'ERROR'
  >('VALID');
  const [statusMessage, setStatusMessage] = useState('');
  const [invitation, setInvitation] = useState<InvitationDetails | null>(null);

  // Form states for new employee account registration
  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token) {
      setStatus('INVALID');
      setStatusMessage('No invitation token was provided.');
      setLoading(false);
      return;
    }

    const validateToken = async () => {
      setLoading(true);
      try {
        const res = await apiClient.get(`/tenants/invitations/validate/${token}`);
        if (res.data.status === 'VALID' && res.data.invitation) {
          setStatus('VALID');
          setInvitation(res.data.invitation);
        } else {
          setStatus(res.data.status || 'INVALID');
          setStatusMessage(res.data.message || 'This invitation link is invalid or expired.');
        }
      } catch (err: any) {
        setStatus('INVALID');
        setStatusMessage(err?.response?.data?.message || 'Failed to validate invitation token.');
      } finally {
        setLoading(false);
      }
    };

    validateToken();
  }, [token]);

  // Handler for existing logged-in user with matching email
  const handleAcceptLoggedIn = async () => {
    if (!token) return;
    setSubmitting(true);
    try {
      const res = await apiClient.post('/tenants/invitations/accept', { token });

      // Update session with updated user/tenant token
      if (res.data?.token) {
        const updatedUser = res.data.user || user;
        if (updatedUser) {
          setSession(updatedUser, res.data.token);
        }
      }

      // Update active tenant store
      if (res.data?.tenant) {
        setActiveTenant(res.data.tenant);
      }

      // Synchronize client state and invalidate relevant React Query caches
      await Promise.allSettled([
        fetchCurrentTenant(),
        fetchUserTenants(),
        queryClient.invalidateQueries({ queryKey: ['tenants'] }),
        queryClient.invalidateQueries({ queryKey: ['current-tenant'] }),
        queryClient.invalidateQueries({ queryKey: ['user-tenants'] }),
        queryClient.invalidateQueries({ queryKey: ['invitations'] }),
        queryClient.invalidateQueries({ queryKey: ['auth'] }),
        queryClient.invalidateQueries({ queryKey: ['employees'] }),
        queryClient.invalidateQueries({ queryKey: ['users'] }),
      ]);

      toast.success(`You have joined ${invitation?.companyName || 'the workspace'}!`);
      navigate('/');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to accept invitation.');
    } finally {
      setSubmitting(false);
    }
  };

  // Handler for new employee onboarding registration
  const handleRegisterAndAccept = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      toast.error('Please enter a username and password.');
      return;
    }
    if (password.length < 8) {
      toast.error('Password must be at least 8 characters.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await apiClient.post('/tenants/invitations/accept-and-register', {
        token,
        username: username.trim(),
        password,
        fullName: fullName.trim() || username.trim(),
        phone: phone.trim() || undefined,
      });

      if (res.data?.token && res.data?.user) {
        setSession(res.data.user, res.data.token);

        if (res.data?.tenant) {
          setActiveTenant(res.data.tenant);
        }

        // Synchronize client state and invalidate relevant React Query caches
        await Promise.allSettled([
          fetchCurrentTenant(),
          fetchUserTenants(),
          queryClient.invalidateQueries({ queryKey: ['tenants'] }),
          queryClient.invalidateQueries({ queryKey: ['current-tenant'] }),
          queryClient.invalidateQueries({ queryKey: ['user-tenants'] }),
          queryClient.invalidateQueries({ queryKey: ['invitations'] }),
          queryClient.invalidateQueries({ queryKey: ['auth'] }),
          queryClient.invalidateQueries({ queryKey: ['employees'] }),
          queryClient.invalidateQueries({ queryKey: ['users'] }),
        ]);

        toast.success(`Welcome to ${invitation?.companyName || 'Stockora Enterprise'}!`);
        navigate('/');
      } else {
        toast.success('Account created successfully! Please sign in.');
        navigate('/login');
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to complete registration.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSwitchAccount = () => {
    clearSession();
    toast.success('Signed out. Please complete your employee onboarding.');
  };

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        bgcolor: '#030712',
        position: 'relative',
        overflow: 'hidden',
        px: 2,
        py: 4,
        '&::before': {
          content: '""',
          position: 'absolute',
          top: '15%',
          left: '25%',
          width: 450,
          height: 450,
          borderRadius: '50%',
          background:
            'radial-gradient(circle, rgba(99, 102, 241, 0.15) 0%, rgba(99, 102, 241, 0) 70%)',
          filter: 'blur(50px)',
          zIndex: 0,
        },
        '&::after': {
          content: '""',
          position: 'absolute',
          bottom: '15%',
          right: '25%',
          width: 450,
          height: 450,
          borderRadius: '50%',
          background:
            'radial-gradient(circle, rgba(16, 185, 129, 0.1) 0%, rgba(16, 185, 129, 0) 70%)',
          filter: 'blur(50px)',
          zIndex: 0,
        },
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: 25 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        style={{ zIndex: 1, width: '100%', maxWidth: 480 }}
      >
        <Card
          sx={{
            background: 'rgba(15, 23, 42, 0.85)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: 3,
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
            overflow: 'hidden',
          }}
        >
          <Box
            sx={{
              height: 4,
              background: 'linear-gradient(90deg, #6366f1 0%, #10b981 50%, #3b82f6 100%)',
            }}
          />

          <CardContent sx={{ p: { xs: 3, sm: 4 } }}>
            {/* Loading State */}
            {loading && (
              <Box sx={{ textAlign: 'center', py: 6 }}>
                <CircularProgress size={44} sx={{ color: '#6366f1', mb: 2 }} />
                <Typography variant="h6" sx={{ color: '#f8fafc', fontWeight: 700 }}>
                  Validating Invitation Link
                </Typography>
                <Typography variant="body2" sx={{ color: '#94a3b8', mt: 1 }}>
                  Securing workspace credentials...
                </Typography>
              </Box>
            )}

            {/* Error / Non-Valid States */}
            {!loading && status !== 'VALID' && (
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <Box
                  sx={{
                    width: 64,
                    height: 64,
                    borderRadius: '50%',
                    bgcolor: 'rgba(239, 68, 68, 0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    mx: 'auto',
                    mb: 2,
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                  }}
                >
                  <ErrorOutlineIcon sx={{ fontSize: 36, color: '#ef4444' }} />
                </Box>

                <Typography variant="h5" sx={{ color: '#f8fafc', fontWeight: 800, mb: 1 }}>
                  {status === 'EXPIRED' && 'Invitation Expired'}
                  {status === 'ALREADY_USED' && 'Invitation Already Used'}
                  {status === 'REVOKED' && 'Invitation Revoked'}
                  {(status === 'INVALID' || status === 'ERROR') && 'Invalid Invitation Link'}
                </Typography>

                <Typography variant="body2" sx={{ color: '#94a3b8', mb: 4, px: 2 }}>
                  {statusMessage ||
                    (status === 'EXPIRED'
                      ? 'This invitation link has expired. Please request a new invitation from your company administrator.'
                      : status === 'ALREADY_USED'
                        ? 'This invitation has already been accepted and cannot be reused.'
                        : status === 'REVOKED'
                          ? 'This invitation was revoked by the workspace administrator.'
                          : 'This invitation link is invalid or incomplete.')}
                </Typography>

                <Button
                  variant="contained"
                  fullWidth
                  onClick={() => navigate('/login')}
                  sx={{
                    bgcolor: '#6366f1',
                    '&:hover': { bgcolor: '#4f46e5' },
                    py: 1.5,
                    fontWeight: 700,
                    textTransform: 'none',
                    borderRadius: 2,
                  }}
                >
                  Return to Sign In
                </Button>
              </Box>
            )}

            {/* Valid Invitation State */}
            {!loading && status === 'VALID' && invitation && (
              <Box>
                {/* Header & Company Details */}
                <Box sx={{ textAlign: 'center', mb: 3 }}>
                  <Box
                    sx={{
                      width: 56,
                      height: 56,
                      borderRadius: '50%',
                      bgcolor: 'rgba(99, 102, 241, 0.15)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      mx: 'auto',
                      mb: 2,
                      border: '1px solid rgba(99, 102, 241, 0.3)',
                    }}
                  >
                    <BusinessIcon sx={{ fontSize: 30, color: '#818cf8' }} />
                  </Box>

                  <Typography variant="h5" sx={{ color: '#f8fafc', fontWeight: 800, mb: 0.5 }}>
                    You're Invited!
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#94a3b8' }}>
                    Join <strong>{invitation.companyName}</strong> on Stockora Enterprise
                  </Typography>
                </Box>

                {/* Role and Target Info Card */}
                <Box
                  sx={{
                    bgcolor: 'rgba(30, 41, 59, 0.6)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: 2,
                    p: 2,
                    mb: 3,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 1.5,
                  }}
                >
                  <Box
                    sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                  >
                    <Typography
                      variant="caption"
                      sx={{ color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5 }}
                    >
                      Assigned Role
                    </Typography>
                    <Chip
                      icon={<BadgeIcon sx={{ fontSize: '16px !important' }} />}
                      label={invitation.roleName}
                      size="small"
                      color="primary"
                      sx={{ fontWeight: 700 }}
                    />
                  </Box>

                  <Box
                    sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                  >
                    <Typography
                      variant="caption"
                      sx={{ color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5 }}
                    >
                      Invited Email
                    </Typography>
                    <Typography variant="body2" sx={{ color: '#f8fafc', fontWeight: 600 }}>
                      {invitation.email}
                    </Typography>
                  </Box>

                  {invitation.branchName && (
                    <Box
                      sx={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <Typography
                        variant="caption"
                        sx={{ color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5 }}
                      >
                        Branch
                      </Typography>
                      <Typography variant="body2" sx={{ color: '#cbd5e1' }}>
                        {invitation.branchName}
                      </Typography>
                    </Box>
                  )}
                </Box>

                {/* Scenario 1: User is logged in with matching email */}
                {user &&
                user.email.toLowerCase().trim() === invitation.email.toLowerCase().trim() ? (
                  <Box sx={{ textAlign: 'center' }}>
                    <Alert
                      severity="success"
                      sx={{
                        mb: 3,
                        textAlign: 'left',
                        bgcolor: 'rgba(16, 185, 129, 0.1)',
                        color: '#34d399',
                      }}
                    >
                      You are signed in as <strong>{user.email}</strong>. Click below to accept the
                      invitation and join {invitation.companyName}.
                    </Alert>

                    <Button
                      variant="contained"
                      fullWidth
                      disabled={submitting}
                      onClick={handleAcceptLoggedIn}
                      sx={{
                        background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                        py: 1.5,
                        fontWeight: 700,
                        fontSize: '1rem',
                        textTransform: 'none',
                        borderRadius: 2,
                        boxShadow: '0 4px 14px rgba(99, 102, 241, 0.4)',
                        mb: 2,
                      }}
                    >
                      {submitting ? (
                        <CircularProgress size={24} sx={{ color: '#fff' }} />
                      ) : (
                        'Accept & Join Workspace'
                      )}
                    </Button>
                  </Box>
                ) : user ? (
                  /* Scenario 2: User is logged in with a different email */
                  <Box>
                    <Alert
                      severity="warning"
                      sx={{ mb: 3, bgcolor: 'rgba(245, 158, 11, 0.1)', color: '#fbbf24' }}
                    >
                      You are currently signed in as <strong>{user.email}</strong>, but this
                      invitation was sent to <strong>{invitation.email}</strong>.
                    </Alert>

                    <Button
                      variant="outlined"
                      fullWidth
                      onClick={handleSwitchAccount}
                      sx={{
                        borderColor: '#6366f1',
                        color: '#818cf8',
                        py: 1.2,
                        textTransform: 'none',
                        fontWeight: 700,
                        borderRadius: 2,
                        mb: 2,
                      }}
                    >
                      Switch Account / Sign Out
                    </Button>
                  </Box>
                ) : (
                  /* Scenario 3: User is not logged in -> Setup new employee account */
                  <form onSubmit={handleRegisterAndAccept}>
                    <Typography
                      variant="subtitle2"
                      sx={{ color: '#f8fafc', fontWeight: 700, mb: 2 }}
                    >
                      Create your employee account
                    </Typography>

                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <TextField
                        fullWidth
                        label="Email Address"
                        value={invitation.email}
                        disabled
                        size="small"
                        helperText="Invitation is securely bound to this email."
                        sx={{
                          '& .MuiInputBase-input.Mui-disabled': {
                            WebkitTextFillColor: '#94a3b8',
                          },
                        }}
                      />

                      <TextField
                        fullWidth
                        label="Username"
                        size="small"
                        required
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="e.g. john_doe"
                      />

                      <TextField
                        fullWidth
                        label="Full Name (Optional)"
                        size="small"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="e.g. John Doe"
                      />

                      <TextField
                        fullWidth
                        label="Password"
                        size="small"
                        required
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Min. 8 characters"
                        InputProps={{
                          endAdornment: (
                            <InputAdornment position="end">
                              <IconButton
                                size="small"
                                onClick={() => setShowPassword(!showPassword)}
                                edge="end"
                              >
                                {showPassword ? (
                                  <VisibilityOff fontSize="small" />
                                ) : (
                                  <Visibility fontSize="small" />
                                )}
                              </IconButton>
                            </InputAdornment>
                          ),
                        }}
                      />

                      <TextField
                        fullWidth
                        label="Phone Number (Optional)"
                        size="small"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="+1 (555) 000-0000"
                      />

                      <Button
                        type="submit"
                        variant="contained"
                        fullWidth
                        disabled={submitting}
                        sx={{
                          background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                          py: 1.5,
                          fontWeight: 700,
                          fontSize: '0.95rem',
                          textTransform: 'none',
                          borderRadius: 2,
                          boxShadow: '0 4px 14px rgba(99, 102, 241, 0.4)',
                          mt: 1,
                        }}
                      >
                        {submitting ? (
                          <CircularProgress size={24} sx={{ color: '#fff' }} />
                        ) : (
                          'Complete Account Setup & Join'
                        )}
                      </Button>
                    </Box>
                  </form>
                )}
              </Box>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </Box>
  );
}
