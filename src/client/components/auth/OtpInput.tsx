import {
  useState,
  useRef,
  useEffect,
  type ClipboardEvent,
  type KeyboardEvent,
  type ChangeEvent,
} from 'react';
import { Box, Typography, Button, CircularProgress } from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';

interface OtpInputProps {
  length?: number;
  value: string;
  onChange: (otp: string) => void;
  onComplete?: (otp: string) => void;
  disabled?: boolean;
  onResend?: () => Promise<void> | void;
  resendCooldown?: number; // In seconds, default 60
  isResending?: boolean;
}

export default function OtpInput({
  length = 6,
  value,
  onChange,
  onComplete,
  disabled = false,
  onResend,
  resendCooldown = 60,
  isResending = false,
}: OtpInputProps) {
  const inputsRef = useRef<(HTMLInputElement | null)[]>([]);
  const [cooldown, setCooldown] = useState<number>(resendCooldown);
  // Guard: ensures onComplete fires exactly once per completed OTP entry.
  // Resets when the value drops below full length (user edits/clears).
  const completedRef = useRef(false);

  // Setup countdown timer
  useEffect(() => {
    if (cooldown <= 0) return;
    const interval = setInterval(() => {
      setCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [cooldown]);

  // Reset the completed guard when the OTP is no longer full (user is editing)
  useEffect(() => {
    if (value.length < length) {
      completedRef.current = false;
    }
  }, [value, length]);

  const digits = value.split('').concat(Array(length).fill('')).slice(0, length);

  const focusInput = (index: number) => {
    if (inputsRef.current[index]) {
      inputsRef.current[index]?.focus();
      inputsRef.current[index]?.select();
    }
  };

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>, index: number) => {
    const rawVal = e.target.value.replace(/\D/g, '');
    if (!rawVal) return;

    const char = rawVal.slice(-1); // Take the last entered character
    const newDigits = [...digits];
    newDigits[index] = char;
    const nextVal = newDigits.join('').slice(0, length);
    onChange(nextVal);

    if (index < length - 1) {
      focusInput(index + 1);
    }

    if (nextVal.length === length && onComplete && !completedRef.current) {
      completedRef.current = true;
      onComplete(nextVal);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>, index: number) => {
    if (e.key === 'Backspace') {
      e.preventDefault();
      const newDigits = [...digits];
      if (newDigits[index]) {
        newDigits[index] = '';
        onChange(newDigits.join(''));
      } else if (index > 0) {
        newDigits[index - 1] = '';
        onChange(newDigits.join(''));
        focusInput(index - 1);
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      e.preventDefault();
      focusInput(index - 1);
    } else if (e.key === 'ArrowRight' && index < length - 1) {
      e.preventDefault();
      focusInput(index + 1);
    }
  };

  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, length);
    if (!pastedData) return;

    onChange(pastedData);
    const nextIndex = Math.min(pastedData.length, length - 1);
    focusInput(nextIndex);

    if (pastedData.length === length && onComplete && !completedRef.current) {
      completedRef.current = true;
      onComplete(pastedData);
    }
  };

  const handleResendClick = async () => {
    if (cooldown > 0 || isResending || !onResend) return;
    await onResend();
    setCooldown(resendCooldown);
  };

  return (
    <Box
      sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', gap: 3 }}
    >
      {/* 6 Digit Input Group */}
      <Box
        sx={{
          display: 'flex',
          gap: { xs: 1, sm: 1.5 },
          justifyContent: 'center',
          alignItems: 'center',
          width: '100%',
        }}
      >
        {Array.from({ length }).map((_, index) => (
          <input
            key={index}
            ref={(el) => {
              inputsRef.current[index] = el;
            }}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={1}
            autoComplete={index === 0 ? 'one-time-code' : 'off'}
            value={digits[index] || ''}
            disabled={disabled}
            onChange={(e) => handleInputChange(e, index)}
            onKeyDown={(e) => handleKeyDown(e, index)}
            onPaste={handlePaste}
            aria-label={`Digit ${index + 1} of verification code`}
            style={{
              width: '46px',
              height: '56px',
              textAlign: 'center',
              fontSize: '24px',
              fontWeight: 700,
              fontFamily: 'monospace',
              color: '#f8fafc',
              background: 'rgba(30, 41, 59, 0.7)',
              border: digits[index] ? '2px solid #8b5cf6' : '1px solid rgba(139, 92, 246, 0.25)',
              borderRadius: '12px',
              outline: 'none',
              transition: 'all 0.2s ease',
              boxShadow: digits[index] ? '0 0 15px rgba(139, 92, 246, 0.3)' : 'none',
            }}
          />
        ))}
      </Box>

      {/* Resend Cooldown Section */}
      {onResend && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.85rem' }}>
            Didn't receive a code?
          </Typography>
          <Button
            size="small"
            onClick={handleResendClick}
            disabled={cooldown > 0 || isResending || disabled}
            startIcon={
              isResending ? (
                <CircularProgress size={14} color="inherit" />
              ) : (
                <RefreshIcon sx={{ fontSize: 16 }} />
              )
            }
            sx={{
              textTransform: 'none',
              fontWeight: 700,
              fontSize: '0.85rem',
              color: cooldown > 0 ? 'text.disabled' : '#a78bfa',
              '&:hover': {
                backgroundColor: 'rgba(139, 92, 246, 0.1)',
                color: '#c4b5fd',
              },
            }}
          >
            {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend Code'}
          </Button>
        </Box>
      )}
    </Box>
  );
}
