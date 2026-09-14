import { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Link,
  IconButton,
  InputAdornment,
  Chip,
} from '@mui/material';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../api/client.ts';
import { useAuthStore } from '../../store/auth.ts';
import { useTenantStore } from '../../store/tenant.ts';
import { motion } from 'framer-motion';
import { toast } from 'react-hot-toast';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import BoltIcon from '@mui/icons-material/Bolt';
import SecurityIcon from '@mui/icons-material/Security';
import SyncAltIcon from '@mui/icons-material/SyncAlt';
import type { AuthResponse } from '../../../shared/types.js';

const signInSchema = z.object({
  email: z
    .string({ required_error: 'Email address is required' })
    .transform((val) => val.trim().toLowerCase())
    .pipe(z.string().email('Please enter a valid email address')),
  password: z.string({ required_error: 'Password is required' }).min(1, 'Password is required'),
});

type SignInInputs = z.infer<typeof signInSchema>;

export default function SignIn() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const setSession = useAuthStore((s) => s.setSession);
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignInInputs>({
    resolver: zodResolver(signInSchema),
  });

  const mutation = useMutation({
    mutationFn: async (credentials: SignInInputs) => {
      const { data } = await apiClient.post<AuthResponse>('/auth/login', {
        email: credentials.email.trim().toLowerCase(),
        password: credentials.password,
      });
      return data;
    },
    onSuccess: async (data) => {
      setSession(data.user, data.accessToken, data.refreshToken);

      // Synchronize active tenant and invalidate queries for immediate UI hydration
      await Promise.allSettled([
        useTenantStore.getState().fetchCurrentTenant(),
        useTenantStore.getState().fetchUserTenants(),
        queryClient.invalidateQueries({ queryKey: ['tenants'] }),
        queryClient.invalidateQueries({ queryKey: ['current-tenant'] }),
        queryClient.invalidateQueries({ queryKey: ['user-tenants'] }),
        queryClient.invalidateQueries({ queryKey: ['auth'] }),
      ]);

      toast.success(`Welcome back, ${data.user.username}!`);
      navigate('/');
    },
    onError: (err: any) => {
      const message =
        err?.response?.data?.error?.message ||
        err?.response?.data?.message ||
        (typeof err?.response?.data === 'string'
          ? err.response.data
          : 'Sign in failed. Please check your credentials.');
      toast.error(message);
    },
  });

  const onSubmit = (data: SignInInputs) => {
    mutation.mutate(data);
  };

  return (
    <Box
      sx={{
        display: 'flex',
        minHeight: '100vh',
        bgcolor: '#040711',
        position: 'relative',
        overflow: 'hidden',
        color: '#f8fafc',
      }}
    >
      {/* Background ambient mesh gradients */}
      <Box
        sx={{
          position: 'absolute',
          top: '-10%',
          left: '-5%',
          width: '50vw',
          height: '50vw',
          maxWidth: 650,
          maxHeight: 650,
          borderRadius: '50%',
          background:
            'radial-gradient(circle, rgba(16, 185, 129, 0.12) 0%, rgba(16, 185, 129, 0) 70%)',
          filter: 'blur(70px)',
          pointerEvents: 'none',
        }}
      />
      <Box
        sx={{
          position: 'absolute',
          bottom: '-10%',
          right: '-5%',
          width: '50vw',
          height: '50vw',
          maxWidth: 650,
          maxHeight: 650,
          borderRadius: '50%',
          background:
            'radial-gradient(circle, rgba(6, 182, 212, 0.09) 0%, rgba(6, 182, 212, 0) 70%)',
          filter: 'blur(70px)',
          pointerEvents: 'none',
        }}
      />

      {/* Main Container: Split screen on md+ */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: '1.05fr 1fr' },
          width: '100%',
          maxWidth: 1380,
          margin: 'auto',
          minHeight: '100vh',
          zIndex: 1,
          px: { xs: 2.5, sm: 4, md: 6 },
          py: { xs: 4, md: 6 },
          alignItems: 'center',
          gap: { xs: 4, md: 8 },
        }}
      >
        {/* Left Side: Brand Showcase & Telemetry Preview */}
        <Box
          sx={{
            display: { xs: 'none', md: 'flex' },
            flexDirection: 'column',
            gap: 4,
            pr: { md: 4 },
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <img
              src="/logo.png"
              alt="Stockora Logo"
              style={{
                height: 48,
                width: 48,
                objectFit: 'contain',
                filter: 'drop-shadow(0 0 16px rgba(16, 185, 129, 0.45))',
              }}
            />
            <Box>
              <Typography
                variant="h5"
                sx={{
                  fontFamily: "'Space Grotesk', sans-serif",
                  fontWeight: 700,
                  letterSpacing: '0.04em',
                  background: 'linear-gradient(135deg, #ffffff 0%, #cbd5e1 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                STOCKORA
              </Typography>
              <Chip
                label="ENTERPRISE MINI"
                size="small"
                sx={{
                  height: 18,
                  fontSize: '0.65rem',
                  fontWeight: 700,
                  fontFamily: "'Space Grotesk', sans-serif",
                  letterSpacing: '0.08em',
                  bgcolor: 'rgba(16, 185, 129, 0.15)',
                  color: '#34d399',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                  mt: 0.3,
                }}
              />
            </Box>
          </Box>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            <Typography
              variant="h3"
              sx={{
                fontFamily: "'Space Grotesk', sans-serif",
                fontWeight: 700,
                lineHeight: 1.18,
                letterSpacing: '-0.025em',
              }}
            >
              Real-time POS intelligence engineered for{' '}
              <span
                style={{
                  background: 'linear-gradient(135deg, #34d399 0%, #06b6d4 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                modern enterprise retail.
              </span>
            </Typography>
            <Typography
              variant="body1"
              sx={{ color: '#94a3b8', fontSize: '1rem', maxWidth: 520, lineHeight: 1.6 }}
            >
              Stockora Enterprise Mini provides isolated high-speed branch terminals, offline-first
              mesh sync, and autonomous multi-tenant stock auditing.
            </Typography>
          </Box>

          {/* Feature Highlights Bento Cards */}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 2,
                p: 2,
                borderRadius: 3,
                bgcolor: 'rgba(9, 15, 29, 0.65)',
                border: '1px solid rgba(16, 185, 129, 0.15)',
                backdropFilter: 'blur(12px)',
              }}
            >
              <Box
                sx={{
                  p: 1.2,
                  borderRadius: 2,
                  bgcolor: 'rgba(16, 185, 129, 0.12)',
                  color: '#34d399',
                  display: 'flex',
                }}
              >
                <BoltIcon />
              </Box>
              <Box>
                <Typography sx={{ fontWeight: 600, fontSize: '0.95rem', color: '#f8fafc' }}>
                  Ultra-Fast Local POS Engine
                </Typography>
                <Typography sx={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                  Sub-5ms checkout execution with offline IndexedDB transaction buffering.
                </Typography>
              </Box>
            </Box>

            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 2,
                p: 2,
                borderRadius: 3,
                bgcolor: 'rgba(9, 15, 29, 0.65)',
                border: '1px solid rgba(6, 182, 212, 0.15)',
                backdropFilter: 'blur(12px)',
              }}
            >
              <Box
                sx={{
                  p: 1.2,
                  borderRadius: 2,
                  bgcolor: 'rgba(6, 182, 212, 0.12)',
                  color: '#22d3ee',
                  display: 'flex',
                }}
              >
                <SyncAltIcon />
              </Box>
              <Box>
                <Typography sx={{ fontWeight: 600, fontSize: '0.95rem', color: '#f8fafc' }}>
                  Complete Infrastructure Isolation
                </Typography>
                <Typography sx={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                  Dedicated database space and independent Redis caches for zero cross-talk.
                </Typography>
              </Box>
            </Box>

            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 2,
                p: 2,
                borderRadius: 3,
                bgcolor: 'rgba(9, 15, 29, 0.65)',
                border: '1px solid rgba(16, 185, 129, 0.15)',
                backdropFilter: 'blur(12px)',
              }}
            >
              <Box
                sx={{
                  p: 1.2,
                  borderRadius: 2,
                  bgcolor: 'rgba(16, 185, 129, 0.12)',
                  color: '#34d399',
                  display: 'flex',
                }}
              >
                <SecurityIcon />
              </Box>
              <Box>
                <Typography sx={{ fontWeight: 600, fontSize: '0.95rem', color: '#f8fafc' }}>
                  Scoped Cryptographic Sessions
                </Typography>
                <Typography sx={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                  HMAC-SHA256 tokens strictly bound to the Mini enterprise runtime environment.
                </Typography>
              </Box>
            </Box>
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mt: 1 }}>
            <Box
              sx={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                bgcolor: '#10b981',
                boxShadow: '0 0 10px #10b981',
              }}
            />
            <Typography sx={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 500 }}>
              ALL SERVICES NOMINAL · SYSTEM PORT 3050 / 8095
            </Typography>
          </Box>
        </Box>

        {/* Right Side: High-Contrast Executive Sign In Terminal */}
        <Box sx={{ display: 'flex', justifyContent: 'center' }}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            style={{ width: '100%', maxWidth: 460 }}
          >
            <Card
              sx={{
                width: '100%',
                bgcolor: 'rgba(9, 15, 29, 0.85)',
                backdropFilter: 'blur(24px)',
                borderRadius: 4,
                border: '1px solid rgba(16, 185, 129, 0.2)',
                boxShadow: '0 24px 64px rgba(0, 0, 0, 0.65), 0 0 32px rgba(16, 185, 129, 0.08)',
                overflow: 'hidden',
                position: 'relative',
              }}
            >
              {/* Top accent cyber line */}
              <Box
                sx={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  height: '3px',
                  background: 'linear-gradient(90deg, #34d399 0%, #10b981 50%, #06b6d4 100%)',
                }}
              />

              <CardContent
                sx={{ p: { xs: 3.5, sm: 4.5 }, display: 'flex', flexDirection: 'column', gap: 3 }}
              >
                {/* Mobile Header */}
                <Box
                  sx={{
                    display: { xs: 'flex', md: 'none' },
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 1.5,
                    mb: 1,
                  }}
                >
                  <img src="/logo.png" alt="Logo" style={{ height: 38, width: 38 }} />
                  <Typography
                    variant="h6"
                    sx={{
                      fontFamily: "'Space Grotesk', sans-serif",
                      fontWeight: 700,
                      color: '#f8fafc',
                    }}
                  >
                    STOCKORA MINI
                  </Typography>
                </Box>

                <Box>
                  <Typography
                    variant="h5"
                    sx={{
                      fontFamily: "'Space Grotesk', sans-serif",
                      fontWeight: 700,
                      color: '#f8fafc',
                      letterSpacing: '-0.02em',
                    }}
                  >
                    Terminal Access
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#94a3b8', mt: 0.5 }}>
                    Enter credentials to access your store's operations console.
                  </Typography>
                </Box>

                <form
                  onSubmit={handleSubmit(onSubmit)}
                  style={{ display: 'flex', flexDirection: 'column', gap: 20 }}
                >
                  <TextField
                    id="email"
                    label="Email Address"
                    type="email"
                    autoComplete="email"
                    fullWidth
                    {...register('email')}
                    error={!!errors.email}
                    helperText={errors.email?.message}
                    inputProps={{
                      autoCapitalize: 'none',
                      autoCorrect: 'off',
                      spellCheck: 'false',
                    }}
                    InputLabelProps={{ shrink: true }}
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        bgcolor: 'rgba(4, 7, 17, 0.7)',
                        borderRadius: 2.5,
                        '&:hover fieldset': {
                          borderColor: 'rgba(16, 185, 129, 0.4)',
                        },
                        '&.Mui-focused fieldset': {
                          borderColor: '#10b981',
                        },
                      },
                    }}
                  />

                  <TextField
                    id="password"
                    label="Password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    fullWidth
                    {...register('password')}
                    error={!!errors.password}
                    helperText={errors.password?.message}
                    InputLabelProps={{ shrink: true }}
                    InputProps={{
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton
                            aria-label="toggle password visibility"
                            onClick={() => setShowPassword(!showPassword)}
                            edge="end"
                            sx={{ color: '#64748b', '&:hover': { color: '#34d399' } }}
                          >
                            {showPassword ? <VisibilityOffIcon /> : <VisibilityIcon />}
                          </IconButton>
                        </InputAdornment>
                      ),
                    }}
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        bgcolor: 'rgba(4, 7, 17, 0.7)',
                        borderRadius: 2.5,
                        '&:hover fieldset': {
                          borderColor: 'rgba(16, 185, 129, 0.4)',
                        },
                        '&.Mui-focused fieldset': {
                          borderColor: '#10b981',
                        },
                      },
                    }}
                  />

                  <Button
                    variant="contained"
                    type="submit"
                    fullWidth
                    disabled={mutation.isPending}
                    sx={{
                      py: 1.5,
                      borderRadius: 2.5,
                      fontFamily: "'Space Grotesk', sans-serif",
                      fontWeight: 700,
                      fontSize: '0.95rem',
                      letterSpacing: '0.02em',
                      background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                      color: '#040711',
                      boxShadow: '0 4px 20px rgba(16, 185, 129, 0.35)',
                      transition: 'all 0.25s ease',
                      '&:hover': {
                        background: 'linear-gradient(135deg, #34d399 0%, #10b981 100%)',
                        boxShadow: '0 6px 28px rgba(16, 185, 129, 0.5)',
                        transform: 'translateY(-1px)',
                      },
                    }}
                  >
                    {mutation.isPending ? 'Authenticating...' : 'Sign In to Mini'}
                  </Button>
                </form>

                <Box
                  sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 1.5,
                    borderTop: '1px solid rgba(255,255,255,0.06)',
                    pt: 2.5,
                  }}
                >
                  <Box
                    sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                  >
                    <Link
                      onClick={() => navigate('/forgot-password')}
                      sx={{
                        cursor: 'pointer',
                        fontSize: '0.82rem',
                        color: '#94a3b8',
                        textDecoration: 'none',
                        transition: 'color 0.2s',
                        '&:hover': { color: '#34d399' },
                      }}
                    >
                      Forgot Password?
                    </Link>
                    <Link
                      onClick={() => navigate('/signup')}
                      sx={{
                        cursor: 'pointer',
                        fontSize: '0.82rem',
                        color: '#34d399',
                        fontWeight: 600,
                        textDecoration: 'none',
                        transition: 'color 0.2s',
                        '&:hover': { color: '#10b981', textDecoration: 'underline' },
                      }}
                    >
                      Create Account →
                    </Link>
                  </Box>

                  <Typography variant="caption" sx={{ textAlign: 'center', mt: 1 }}>
                    <Link
                      onClick={() => navigate('/landing')}
                      sx={{
                        cursor: 'pointer',
                        color: '#64748b',
                        textDecoration: 'none',
                        '&:hover': { color: '#94a3b8' },
                      }}
                    >
                      ← Back to Overview
                    </Link>
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </motion.div>
        </Box>
      </Box>
    </Box>
  );
}
