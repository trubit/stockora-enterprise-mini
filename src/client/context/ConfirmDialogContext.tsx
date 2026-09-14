import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button,
  Typography,
} from '@mui/material';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import HelpOutlineRoundedIcon from '@mui/icons-material/HelpOutlineRounded';

export interface ConfirmOptions {
  title?: string;
  message: string | React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  severity?: 'error' | 'warning' | 'info' | 'primary';
  confirmColor?: 'error' | 'warning' | 'info' | 'primary' | 'success';
}

interface ConfirmContextType {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
}

const ConfirmContext = createContext<ConfirmContextType | undefined>(undefined);

export const ConfirmDialogProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<ConfirmOptions>({
    title: 'Are you sure?',
    message: '',
  });

  const resolverRef = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback((opts: ConfirmOptions): Promise<boolean> => {
    setOptions(opts);
    setOpen(true);
    return new Promise((resolve) => {
      resolverRef.current = resolve;
    });
  }, []);

  const handleClose = (confirmed: boolean) => {
    setOpen(false);
    if (resolverRef.current) {
      resolverRef.current(confirmed);
      resolverRef.current = null;
    }
  };

  const getIcon = () => {
    switch (options.severity) {
      case 'error':
        return <ErrorOutlineRoundedIcon sx={{ color: '#ef4444', fontSize: 28 }} />;
      case 'warning':
        return <WarningAmberRoundedIcon sx={{ color: '#f59e0b', fontSize: 28 }} />;
      case 'info':
        return <InfoOutlinedIcon sx={{ color: '#3b82f6', fontSize: 28 }} />;
      default:
        return <HelpOutlineRoundedIcon sx={{ color: '#8b5cf6', fontSize: 28 }} />;
    }
  };

  const getConfirmButtonColor = () => {
    if (options.confirmColor) return options.confirmColor;
    if (options.severity === 'error') return 'error';
    if (options.severity === 'warning') return 'warning';
    if (options.severity === 'info') return 'info';
    return 'primary';
  };

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      <Dialog
        open={open}
        onClose={() => handleClose(false)}
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-description"
        maxWidth="xs"
        fullWidth
        PaperProps={{
          sx: {
            background:
              'linear-gradient(135deg, rgba(23, 27, 44, 0.98) 0%, rgba(11, 13, 26, 0.99) 100%)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: 3,
            p: 1,
            boxShadow: '0 20px 50px rgba(0, 0, 0, 0.6)',
          },
        }}
      >
        <DialogTitle
          component="div"
          id="confirm-dialog-title"
          sx={{ display: 'flex', alignItems: 'center', gap: 1.5, pb: 1 }}
        >
          {getIcon()}
          <Typography
            variant="h6"
            component="h2"
            sx={{ fontWeight: 800, color: '#f8fafc', fontSize: '1.1rem' }}
          >
            {options.title || 'Confirm Action'}
          </Typography>
        </DialogTitle>
        <DialogContent sx={{ pb: 2 }}>
          {typeof options.message === 'string' ? (
            <DialogContentText
              id="confirm-dialog-description"
              sx={{ color: '#9ca3af', fontSize: '0.9rem', lineHeight: 1.6 }}
            >
              {options.message}
            </DialogContentText>
          ) : (
            options.message
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, pt: 1, gap: 1 }}>
          <Button
            onClick={() => handleClose(false)}
            variant="outlined"
            size="medium"
            sx={{
              borderColor: 'rgba(255, 255, 255, 0.12)',
              color: '#9ca3af',
              textTransform: 'none',
              fontWeight: 600,
              borderRadius: 2,
              px: 2.5,
              '&:hover': {
                borderColor: 'rgba(255, 255, 255, 0.25)',
                backgroundColor: 'rgba(255, 255, 255, 0.04)',
              },
            }}
          >
            {options.cancelText || 'Cancel'}
          </Button>
          <Button
            onClick={() => handleClose(true)}
            variant="contained"
            color={getConfirmButtonColor()}
            size="medium"
            autoFocus
            sx={{
              textTransform: 'none',
              fontWeight: 700,
              borderRadius: 2,
              px: 3,
            }}
          >
            {options.confirmText || 'Confirm'}
          </Button>
        </DialogActions>
      </Dialog>
    </ConfirmContext.Provider>
  );
};

export function useConfirm() {
  const context = useContext(ConfirmContext);
  if (!context) {
    throw new Error('useConfirm must be used within a ConfirmDialogProvider');
  }
  return context.confirm;
}
