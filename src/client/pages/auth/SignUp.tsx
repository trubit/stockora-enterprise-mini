import { useState, useMemo } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Link,
  Chip,
  IconButton,
  InputAdornment,
  LinearProgress,
} from '@mui/material';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { apiClient } from '../../api/client.ts';
import { motion } from 'framer-motion';
import { toast } from 'react-hot-toast';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import BusinessIcon from '@mui/icons-material/Business';
import StorefrontIcon from '@mui/icons-material/Storefront';
import PersonOutlineIcon from '@mui/icons-material/PersonOutline';

const signUpSchema = z
  .object({
    username: z.string().min(3, 'Username must be at least 3 characters'),
    email: z.string().email('Please enter a valid email address'),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
      .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
      .regex(/[0-9]/, 'Password must contain at least one number')
      .regex(/[!@#$%^&*(),.?":{}|<>]/, 'Password must contain at least one special character'),
    roleName: z.string().min(1, 'Please select a role'),
    companyName: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (
      data.roleName === 'Company Owner' &&
      (!data.companyName || data.companyName.trim().length < 2)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Company Name is required for Company Owner',
        path: ['companyName'],
      });
    }
  });

type SignUpInputs = z.infer<typeof signUpSchema>;

export default function SignUp() {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors },
  } = useForm<SignUpInputs>({
    resolver: zodResolver(signUpSchema),
    defaultValues: {
      username: '',
      email: '',
      password: '',
      roleName: 'Company Owner',
      companyName: '',
    },
  });

  const roleName = useWatch({ control, name: 'roleName' });
  const password = useWatch({ control, name: 'password' }) || '';

  // Calculate live password strength
  const passwordScore = useMemo(() => {
    let score = 0;
    if (password.length >= 8) score += 20;
    if (password.length >= 12) score += 10;
    if (/[A-Z]/.test(password)) score += 20;
    if (/[a-z]/.test(password)) score += 15;
    if (/[0-9]/.test(password)) score += 15;
    if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) score += 20;
    return Math.min(score, 100);
  }, [password]);

  const strengthColor = useMemo(() => {
    if (passwordScore < 40) return '#f43f5e';
    if (passwordScore < 70) return '#fbbf24';
    if (passwordScore < 90) return '#38bdf8';
    return '#10b981';
  }, [passwordScore]);

  const strengthLabel = useMemo(() => {
    if (password.length === 0) return '';
    if (passwordScore < 40) return 'Weak';
    if (passwordScore < 70) return 'Moderate';
    if (passwordScore < 90) return 'Strong';
    return 'Maximum Security';
  }, [passwordScore, password.length]);

  const mutation = useMutation({
    mutationFn: async (credentials: SignUpInputs) => {
      const { data } = await apiClient.post<{
        success: boolean;
        message: string;
        email: string;
        requiresVerification?: boolean;
      }>('/auth/register', credentials);
      return data;
    },
    onSuccess: (data, variables) => {
      toast.success(data.message || 'Verification code sent to your email!');
      navigate('/verify-email', { state: { email: variables.email } });
    },
    onError: (err: any) => {
      const message =
        err?.response?.data?.error?.message ||
        err?.response?.data?.message ||
        (typeof err?.response?.data === 'string'
          ? err.response.data
          : 'Registration failed. Please try again.');
      toast.error(message);
    },
  });

  const onSubmit = (data: SignUpInputs) => {
    mutation.mutate({
      username: data.username.trim(),
      email: data.email.trim().toLowerCase(),
      password: data.password,
      roleName: data.roleName,
      companyName: data.companyName ? data.companyName.trim() : undefined,
    });
  };

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        bgcolor: '#040711',
        position: 'relative',
        overflow: 'hidden',
        px: 2,
        py: { xs: 4, md: 6 },
        color: '#f8fafc',
      }}
    >
      {/* Background ambient mesh gradients */}
      <Box
        sx={{
          position: 'absolute',
          top: '5%',
          left: '10%',
          width: 500,
          height: 500,
          borderRadius: '50%',
          background:
            'radial-gradient(circle, rgba(16, 185, 129, 0.12) 0%, rgba(16, 185, 129, 0) 70%)',
          filter: 'blur(80px)',
          pointerEvents: 'none',
        }}
      />
      <Box
        sx={{
          position: 'absolute',
          bottom: '5%',
          right: '10%',
          width: 500,
          height: 500,
          borderRadius: '50%',
          background:
            'radial-gradient(circle, rgba(6, 182, 212, 0.1) 0%, rgba(6, 182, 212, 0) 70%)',
          filter: 'blur(80px)',
          pointerEvents: 'none',
        }}
      />

      <motion.div
        initial={{ opacity: 0, y: 25 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, ease: 'easeOut' }}
        style={{ zIndex: 1, width: '100%', maxWidth: 540 }}
      >
        <Card
          sx={{
            width: '100%',
            bgcolor: 'rgba(9, 15, 29, 0.88)',
            backdropFilter: 'blur(24px)',
            borderRadius: 4,
            border: '1px solid rgba(16, 185, 129, 0.22)',
            boxShadow: '0 24px 64px rgba(0, 0, 0, 0.7), 0 0 36px rgba(16, 185, 129, 0.09)',
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
            {/* Header */}
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <img
                  src="/logo.png"
                  alt="Stockora Logo"
                  style={{
                    height: 42,
                    width: 42,
                    objectFit: 'contain',
                    filter: 'drop-shadow(0 0 12px rgba(16, 185, 129, 0.45))',
                  }}
                />
                <Chip
                  label="MINI ENTERPRISE"
                  size="small"
                  sx={{
                    height: 22,
                    fontSize: '0.68rem',
                    fontWeight: 700,
                    fontFamily: "'Space Grotesk', sans-serif",
                    letterSpacing: '0.08em',
                    bgcolor: 'rgba(16, 185, 129, 0.15)',
                    color: '#34d399',
                    border: '1px solid rgba(16, 185, 129, 0.35)',
                  }}
                />
              </Box>
              <Typography
                variant="h4"
                sx={{
                  fontFamily: "'Space Grotesk', sans-serif",
                  fontWeight: 700,
                  textAlign: 'center',
                  letterSpacing: '-0.025em',
                  mt: 0.5,
                  background: 'linear-gradient(135deg, #ffffff 0%, #a7f3d0 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                Create Account
              </Typography>
              <Typography variant="body2" sx={{ color: '#94a3b8', textAlign: 'center' }}>
                Join Stockora Enterprise Mini to initialize high-speed retail terminals
              </Typography>
            </Box>

            {/* Registration Form */}
            <form
              onSubmit={handleSubmit(onSubmit)}
              style={{ display: 'flex', flexDirection: 'column', gap: 20 }}
            >
              {/* Account Role Selector */}
              <Box>
                <Typography
                  sx={{
                    fontFamily: "'Space Grotesk', sans-serif",
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    color: '#cbd5e1',
                    mb: 1,
                  }}
                >
                  Account Purpose / Role
                </Typography>
                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1 }}>
                  {[
                    {
                      label: 'Owner',
                      value: 'Company Owner',
                      icon: <BusinessIcon fontSize="small" />,
                    },
                    {
                      label: 'Manager',
                      value: 'Branch Manager',
                      icon: <StorefrontIcon fontSize="small" />,
                    },
                    {
                      label: 'Cashier',
                      value: 'Employee',
                      icon: <PersonOutlineIcon fontSize="small" />,
                    },
                  ].map((role) => {
                    const isSelected = roleName === role.value;
                    return (
                      <Box
                        key={role.value}
                        onClick={() => setValue('roleName', role.value)}
                        sx={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: 0.5,
                          p: 1.2,
                          borderRadius: 2.5,
                          cursor: 'pointer',
                          border: isSelected
                            ? '1px solid #10b981'
                            : '1px solid rgba(255, 255, 255, 0.08)',
                          bgcolor: isSelected ? 'rgba(16, 185, 129, 0.14)' : 'rgba(4, 7, 17, 0.5)',
                          color: isSelected ? '#34d399' : '#94a3b8',
                          transition: 'all 0.2s ease',
                          '&:hover': {
                            borderColor: 'rgba(52, 211, 153, 0.5)',
                            bgcolor: 'rgba(16, 185, 129, 0.08)',
                          },
                        }}
                      >
                        {role.icon}
                        <Typography
                          sx={{
                            fontFamily: "'Space Grotesk', sans-serif",
                            fontSize: '0.8rem',
                            fontWeight: isSelected ? 700 : 500,
                          }}
                        >
                          {role.label}
                        </Typography>
                      </Box>
                    );
                  })}
                </Box>
              </Box>

              {/* Company Name (Conditional if Company Owner) */}
              {roleName === 'Company Owner' && (
                <TextField
                  id="companyName"
                  label="Enterprise / Company Name"
                  placeholder="e.g. Nexus Retail Store"
                  fullWidth
                  {...register('companyName')}
                  error={!!errors.companyName}
                  helperText={errors.companyName?.message}
                  InputLabelProps={{ shrink: true }}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      bgcolor: 'rgba(4, 7, 17, 0.7)',
                      borderRadius: 2.5,
                      '&:hover fieldset': { borderColor: 'rgba(16, 185, 129, 0.4)' },
                      '&.Mui-focused fieldset': { borderColor: '#10b981' },
                    },
                  }}
                />
              )}

              {/* Username */}
              <TextField
                id="username"
                label="Full Name or Username"
                autoComplete="username"
                placeholder="e.g. alexander"
                fullWidth
                {...register('username')}
                error={!!errors.username}
                helperText={errors.username?.message}
                InputLabelProps={{ shrink: true }}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    bgcolor: 'rgba(4, 7, 17, 0.7)',
                    borderRadius: 2.5,
                    '&:hover fieldset': { borderColor: 'rgba(16, 185, 129, 0.4)' },
                    '&.Mui-focused fieldset': { borderColor: '#10b981' },
                  },
                }}
              />

              {/* Email */}
              <TextField
                id="email"
                label="Email Address"
                type="email"
                autoComplete="email"
                placeholder="you@domain.com"
                fullWidth
                {...register('email')}
                error={!!errors.email}
                helperText={errors.email?.message}
                InputLabelProps={{ shrink: true }}
                inputProps={{
                  autoCapitalize: 'none',
                  autoCorrect: 'off',
                  spellCheck: 'false',
                }}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    bgcolor: 'rgba(4, 7, 17, 0.7)',
                    borderRadius: 2.5,
                    '&:hover fieldset': { borderColor: 'rgba(16, 185, 129, 0.4)' },
                    '&.Mui-focused fieldset': { borderColor: '#10b981' },
                  },
                }}
              />

              {/* Password */}
              <Box>
                <TextField
                  id="password"
                  label="Password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  placeholder="Min 8 characters with upper, lower, digit, symbol"
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
                      '&:hover fieldset': { borderColor: 'rgba(16, 185, 129, 0.4)' },
                      '&.Mui-focused fieldset': { borderColor: '#10b981' },
                    },
                  }}
                />

                {/* Password Strength Indicator */}
                {password.length > 0 && (
                  <Box sx={{ mt: 1.2, px: 0.5 }}>
                    <Box
                      sx={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        mb: 0.5,
                      }}
                    >
                      <Typography sx={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: 500 }}>
                        Security Strength
                      </Typography>
                      <Typography
                        sx={{ fontSize: '0.72rem', color: strengthColor, fontWeight: 700 }}
                      >
                        {strengthLabel}
                      </Typography>
                    </Box>
                    <LinearProgress
                      variant="determinate"
                      value={passwordScore}
                      sx={{
                        height: 4,
                        borderRadius: 2,
                        bgcolor: 'rgba(255, 255, 255, 0.08)',
                        '& .MuiLinearProgress-bar': {
                          bgcolor: strengthColor,
                          borderRadius: 2,
                        },
                      }}
                    />
                  </Box>
                )}
              </Box>

              {/* Submit Button */}
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
                {mutation.isPending ? 'Registering...' : 'Create Mini Account'}
              </Button>
            </form>

            {/* Bottom Links */}
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                gap: 1.5,
                borderTop: '1px solid rgba(255,255,255,0.06)',
                pt: 2.5,
              }}
            >
              <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 1 }}>
                <Typography variant="body2" sx={{ color: '#94a3b8' }}>
                  Already have an account?
                </Typography>
                <Link
                  onClick={() => navigate('/login')}
                  sx={{
                    cursor: 'pointer',
                    fontSize: '0.85rem',
                    color: '#34d399',
                    fontWeight: 600,
                    textDecoration: 'none',
                    transition: 'color 0.2s',
                    '&:hover': { color: '#10b981', textDecoration: 'underline' },
                  }}
                >
                  Sign In →
                </Link>
              </Box>

              <Typography variant="caption" sx={{ textAlign: 'center', mt: 0.5 }}>
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
  );
}
