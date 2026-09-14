import { useState, useRef } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Link,
  CircularProgress,
} from '@mui/material';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-hot-toast';
import { apiClient } from '../../api/client.ts';
import OtpInput from '../../components/auth/OtpInput.tsx';
import { normalizeErrorMessage } from '../../utils/notify.ts';
import LockResetOutlinedIcon from '@mui/icons-material/LockResetOutlined';
import KeyOutlinedIcon from '@mui/icons-material/KeyOutlined';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';

const emailSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
});

const passwordSchema = z
  .object({
    newPassword: z
      .string({ required_error: 'New password is required' })
      .min(8, 'Password must be at least 8 characters')
      .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
      .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
      .regex(/[0-9]/, 'Password must contain at least one number')
      .regex(/[!@#$%^&*(),.?":{}|<>]/, 'Password must contain at least one special character'),
    confirmPassword: z
      .string({ required_error: 'Confirm password is required' })
      .min(1, 'Confirm password is required'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Passwords must match',
    path: ['confirmPassword'],
  });

type EmailInput = z.infer<typeof emailSchema>;
type PasswordInput = z.infer<typeof passwordSchema>;

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [step, setStep] = useState<'EMAIL' | 'OTP' | 'PASSWORD'>('EMAIL');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);

  const {
    register: registerEmail,
    handleSubmit: handleEmailSubmit,
    formState: { errors: emailErrors },
  } = useForm<EmailInput>({
    resolver: zodResolver(emailSchema),
  });

  const {
    register: registerPassword,
    handleSubmit: handlePasswordSubmit,
    formState: { errors: passwordErrors },
  } = useForm<PasswordInput>({
    resolver: zodResolver(passwordSchema),
  });

  // Step 1: Request Password Reset OTP
  const onEmailSubmit = async (data: EmailInput) => {
    setLoading(true);
    try {
      const normalizedEmail = data.email.toLowerCase().trim();
      setEmail(normalizedEmail);
      await apiClient.post('/auth/forgot-password', { email: normalizedEmail });
      toast.success('If an account exists, a 6-digit reset code has been sent.');
      setStep('OTP');
    } catch (err: any) {
      toast.error(normalizeErrorMessage(err, 'Failed to request reset code.'));
    } finally {
      setLoading(false);
    }
  };

  // Ref-based guard: prevents concurrent OTP verification calls.
  // Without this, onComplete (auto-fires on digit 6) and the manual button click
  // can both call verifyOtp simultaneously. The second call hits the already-consumed
  // OTP record and gets a 401, causing confusing error messages.
  const isSubmittingRef = useRef(false);

  // Step 2: Verify 6-digit OTP
  const onVerifyOtp = async (codeToVerify?: string) => {
    const code = codeToVerify || otp;
    if (!code || code.length !== 6) {
      toast.error('Please enter the 6-digit verification code.');
      return;
    }

    // Guard against double-submission (onComplete + button click race)
    if (isSubmittingRef.current || loading) return;
    isSubmittingRef.current = true;

    setLoading(true);
    try {
      const { data } = await apiClient.post<{ success: boolean; resetToken: string }>(
        '/auth/verify-reset-otp',
        {
          email,
          otp: code,
        }
      );
      setResetToken(data.resetToken);
      toast.success('Code verified! Please choose your new password.');
      setStep('PASSWORD');
    } catch (err: any) {
      // Surface the actual backend error message so the user knows what happened.
      // Possible messages: "Incorrect verification code. N attempt(s) remaining.",
      // "The verification code has expired. Please request a new one.",
      // "Maximum verification attempts exceeded. Please request a new code.",
      // "Verification already processed or expired. Please request a new code."
      const message =
        err?.response?.data?.error?.message ||
        err?.response?.data?.message ||
        'Verification failed. Please check your code and try again.';
      toast.error(message);
    } finally {
      setLoading(false);
      isSubmittingRef.current = false;
    }
  };

  const handleResendOtp = async () => {
    setResending(true);
    try {
      await apiClient.post('/auth/forgot-password', { email });
      toast.success('A new reset code has been sent to your email.');
    } catch (err: any) {
      toast.error(normalizeErrorMessage(err, 'Failed to resend code.'));
    } finally {
      setResending(false);
    }
  };

  // Step 3: Submit New Password
  const onPasswordSubmit = async (data: PasswordInput) => {
    setLoading(true);
    try {
      await apiClient.post('/auth/reset-password', {
        resetToken,
        newPassword: data.newPassword,
      });
      toast.success('Password reset successfully! You may now sign in.');
      navigate('/login');
    } catch (err: any) {
      toast.error(normalizeErrorMessage(err, 'Failed to reset password. Please try again.'));
    } finally {
      setLoading(false);
    }
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
        py: 4,
        '&::before': {
          content: '""',
          position: 'absolute',
          top: '20%',
          left: '30%',
          width: 450,
          height: 450,
          borderRadius: '50%',
          background:
            'radial-gradient(circle, rgba(16, 185, 129, 0.12) 0%, rgba(16, 185, 129, 0) 70%)',
          filter: 'blur(45px)',
          zIndex: 0,
        },
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        style={{ zIndex: 1, width: '100%', maxWidth: 440 }}
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
            sx={{ p: { xs: 3.5, md: 5 }, display: 'flex', flexDirection: 'column', gap: 3 }}
          >
            {/* Header Icon */}
            <Box
              sx={{
                width: 56,
                height: 56,
                borderRadius: '50%',
                background: 'rgba(16, 185, 129, 0.12)',
                border: '1px solid rgba(16, 185, 129, 0.25)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#34d399',
                mx: 'auto',
              }}
            >
              {step === 'EMAIL' && <LockResetOutlinedIcon sx={{ fontSize: 28 }} />}
              {step === 'OTP' && <KeyOutlinedIcon sx={{ fontSize: 28 }} />}
              {step === 'PASSWORD' && <CheckCircleOutlineIcon sx={{ fontSize: 28 }} />}
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
                {step === 'EMAIL' && 'Forgot Password'}
                {step === 'OTP' && 'Enter Reset Code'}
                {step === 'PASSWORD' && 'Set New Password'}
              </Typography>
              <Typography
                variant="body2"
                sx={{ textAlign: 'center', color: 'text.secondary', fontWeight: 500 }}
              >
                {step === 'EMAIL' &&
                  'Enter your registered email address to receive a secure reset code'}
                {step === 'OTP' && `We sent a 6-digit code to ${email}`}
                {step === 'PASSWORD' && 'Choose a secure new password for your Stockora workspace'}
              </Typography>
            </Box>

            <AnimatePresence mode="wait">
              {/* STEP 1: Request OTP */}
              {step === 'EMAIL' && (
                <motion.form
                  key="step-email"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  onSubmit={handleEmailSubmit(onEmailSubmit)}
                  style={{ display: 'flex', flexDirection: 'column', gap: 20 }}
                >
                  <TextField
                    label="Email Address"
                    type="email"
                    fullWidth
                    {...registerEmail('email')}
                    error={!!emailErrors.email}
                    helperText={emailErrors.email?.message}
                    InputLabelProps={{ shrink: true }}
                    placeholder="name@company.com"
                  />

                  <Button
                    variant="contained"
                    type="submit"
                    fullWidth
                    disabled={loading}
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
                    {loading ? <CircularProgress size={20} color="inherit" /> : 'Send Reset Code'}
                  </Button>
                </motion.form>
              )}

              {/* STEP 2: Verify OTP */}
              {step === 'OTP' && (
                <motion.div
                  key="step-otp"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 24,
                    alignItems: 'center',
                  }}
                >
                  <OtpInput
                    value={otp}
                    onChange={setOtp}
                    onComplete={(code) => onVerifyOtp(code)}
                    disabled={loading}
                    onResend={handleResendOtp}
                    isResending={resending}
                    resendCooldown={60}
                  />

                  <Button
                    variant="contained"
                    onClick={() => onVerifyOtp()}
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
                    {loading ? <CircularProgress size={20} color="inherit" /> : 'Verify Reset Code'}
                  </Button>
                </motion.div>
              )}

              {/* STEP 3: Enter New Password */}
              {step === 'PASSWORD' && (
                <motion.form
                  key="step-password"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  onSubmit={handlePasswordSubmit(onPasswordSubmit)}
                  style={{ display: 'flex', flexDirection: 'column', gap: 20 }}
                >
                  <TextField
                    label="New Password"
                    type="password"
                    fullWidth
                    {...registerPassword('newPassword')}
                    error={!!passwordErrors.newPassword}
                    helperText={passwordErrors.newPassword?.message}
                    InputLabelProps={{ shrink: true }}
                  />

                  <TextField
                    label="Confirm New Password"
                    type="password"
                    fullWidth
                    {...registerPassword('confirmPassword')}
                    error={!!passwordErrors.confirmPassword}
                    helperText={passwordErrors.confirmPassword?.message}
                    InputLabelProps={{ shrink: true }}
                  />

                  <Button
                    variant="contained"
                    type="submit"
                    fullWidth
                    disabled={loading}
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
                    {loading ? <CircularProgress size={20} color="inherit" /> : 'Update Password'}
                  </Button>
                </motion.form>
              )}
            </AnimatePresence>

            <Box
              sx={{
                display: 'flex',
                justifyContent: 'center',
                borderTop: '1px solid rgba(255,255,255,0.05)',
                pt: 2.5,
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
