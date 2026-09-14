import { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  TextField,
  CircularProgress,
  Link,
} from '@mui/material';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { toast } from 'react-hot-toast';
import { apiClient } from '../../api/client.ts';
import { useAuthStore } from '../../store/auth.ts';
import OtpInput from '../../components/auth/OtpInput.tsx';
import MarkEmailReadOutlinedIcon from '@mui/icons-material/MarkEmailReadOutlined';
import type { AuthResponse } from '../../../shared/types.js';

export default function VerifyEmail() {
  const navigate = useNavigate();
  const location = useLocation();
  const setSession = useAuthStore((s) => s.setSession);

  const initialEmail = (location.state as { email?: string })?.email || '';
  const [email, setEmail] = useState(initialEmail);
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);

  const handleVerify = async (codeToVerify?: string) => {
    const code = codeToVerify || otp;
    if (!email || !email.includes('@')) {
      toast.error('Please enter a valid email address.');
      return;
    }
    if (!code || code.length !== 6) {
      toast.error('Please enter the 6-digit verification code.');
      return;
    }

    setLoading(true);
    try {
      const { data } = await apiClient.post<AuthResponse>('/auth/verify-email', {
        email: email.toLowerCase().trim(),
        otp: code.trim(),
      });

      toast.success('Email verified successfully! Welcome to Stockora.');
      setSession(data.user, data.accessToken, data.refreshToken);
      navigate('/');
    } catch (err: any) {
      const errorMsg =
        err.response?.data?.error?.message ||
        err.response?.data?.message ||
        err.message ||
        'Verification failed. Please verify your code and try again.';
      toast.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (!email || !email.includes('@')) {
      toast.error('Please enter a valid email address first.');
      return;
    }

    setResending(true);
    try {
      const { data } = await apiClient.post('/auth/resend-verification-otp', {
        email: email.toLowerCase().trim(),
      });
      toast.success(data?.message || 'A new verification code has been dispatched.');
    } catch (err: any) {
      const errorMsg =
        err.response?.data?.error?.message ||
        err.response?.data?.message ||
        err.message ||
        'Failed to resend code. Please try again shortly.';
      toast.error(errorMsg);
    } finally {
      setResending(false);
    }
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
          top: '20%',
          left: '30%',
          width: 400,
          height: 400,
          borderRadius: '50%',
          background:
            'radial-gradient(circle, rgba(16, 185, 129, 0.12) 0%, rgba(16, 185, 129, 0) 70%)',
          filter: 'blur(40px)',
          zIndex: 0,
        },
        '&::after': {
          content: '""',
          position: 'absolute',
          bottom: '20%',
          right: '30%',
          width: 400,
          height: 400,
          borderRadius: '50%',
          background:
            'radial-gradient(circle, rgba(6, 182, 212, 0.08) 0%, rgba(6, 182, 212, 0) 70%)',
          filter: 'blur(40px)',
          zIndex: 0,
        },
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        style={{ zIndex: 1, width: '100%', maxWidth: 460 }}
      >
        <Card
          sx={{
            boxShadow: '0 24px 64px rgba(0, 0, 0, 0.6), 0 0 32px rgba(16, 185, 129, 0.08)',
            border: '1px solid rgba(16, 185, 129, 0.2)',
            background:
              'linear-gradient(135deg, rgba(9, 15, 29, 0.85) 0%, rgba(4, 7, 17, 0.9) 100%)',
            backdropFilter: 'blur(20px)',
            borderRadius: 4,
            overflow: 'hidden',
            position: 'relative',
            '&::before': {
              content: '""',
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: '3px',
              background: 'linear-gradient(90deg, #34d399 0%, #10b981 50%, #06b6d4 100%)',
            },
          }}
        >
          <CardContent
            sx={{
              p: { xs: 3.5, md: 5 },
              display: 'flex',
              flexDirection: 'column',
              gap: 3.5,
              alignItems: 'center',
            }}
          >
            <Box
              sx={{
                width: 56,
                height: 56,
                borderRadius: '50%',
                background: 'rgba(139, 92, 246, 0.12)',
                border: '1px solid rgba(139, 92, 246, 0.25)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#a78bfa',
              }}
            >
              <MarkEmailReadOutlinedIcon sx={{ fontSize: 28 }} />
            </Box>

            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
              <Typography
                variant="h4"
                sx={{
                  fontWeight: 900,
                  textAlign: 'center',
                  letterSpacing: '0.05em',
                  background: 'linear-gradient(90deg, #a78bfa 0%, #3b82f6 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                Verify Your Email
              </Typography>
              <Typography
                variant="body2"
                sx={{ textAlign: 'center', color: 'text.secondary', fontWeight: 500, px: 2 }}
              >
                We've sent a 6-digit verification code to{' '}
                <strong style={{ color: '#e2e8f0' }}>{email || 'your email'}</strong>
              </Typography>
            </Box>

            {!initialEmail && (
              <TextField
                label="Email Address"
                type="email"
                fullWidth
                size="small"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
                InputLabelProps={{ shrink: true }}
              />
            )}

            <OtpInput
              value={otp}
              onChange={setOtp}
              onComplete={(code) => handleVerify(code)}
              disabled={loading}
              onResend={handleResendOtp}
              isResending={resending}
              resendCooldown={60}
            />

            <Button
              variant="contained"
              onClick={() => handleVerify()}
              disabled={loading || otp.length !== 6}
              fullWidth
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
              {loading ? (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <CircularProgress size={18} color="inherit" />
                  <span>Verifying Code...</span>
                </Box>
              ) : (
                'Verify & Activate Account'
              )}
            </Button>

            <Box
              sx={{
                display: 'flex',
                justifyContent: 'center',
                borderTop: '1px solid rgba(255,255,255,0.05)',
                pt: 2.5,
                width: '100%',
              }}
            >
              <Link
                onClick={() => navigate('/login')}
                sx={{
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                  color: 'primary.light',
                  fontWeight: 600,
                  textDecoration: 'none',
                  transition: 'color 0.2s',
                  '&:hover': { color: 'primary.main' },
                }}
              >
                Back to Sign In
              </Link>
            </Box>
          </CardContent>
        </Card>
      </motion.div>
    </Box>
  );
}
