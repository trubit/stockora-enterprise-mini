import { createTheme, responsiveFontSizes } from '@mui/material/styles';

/**
 * Stockora Enterprise Mini — "Pro Max" Cyber-Emerald & Titanium Onyx Theme
 *
 * Distinctive, high-contrast, executive aesthetic engineered specifically
 * for Stockora Enterprise Mini to stand apart from Stockora Enterprise Pro.
 */
const baseTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#10b981', // Vibrant Cyber-Emerald
      light: '#34d399', // Luminous Mint
      dark: '#059669', // Deep Forest Jade
      contrastText: '#040711',
    },
    secondary: {
      main: '#06b6d4', // Electric Cyan
      light: '#22d3ee', // Luminous Sky
      dark: '#0891b2', // Deep Azure Cyan
      contrastText: '#ffffff',
    },
    background: {
      default: '#040711', // Deep Space Titanium Onyx
      paper: '#090f1d', // Ultra-Crisp Dark Glass Surface
    },
    text: {
      primary: '#f8fafc', // Crisp Diamond White
      secondary: '#94a3b8', // Cool Titanium Slate
      disabled: '#475569',
    },
    divider: 'rgba(16, 185, 129, 0.12)', // Hairline Emerald Glow Divider
    error: {
      main: '#f43f5e', // Rose Neon
      light: '#fb7185',
      dark: '#e11d48',
    },
    warning: {
      main: '#f59e0b', // Amber Gold
      light: '#fbbf24',
      dark: '#d97706',
    },
    info: {
      main: '#06b6d4', // Electric Cyan
      light: '#38bdf8',
      dark: '#0284c7',
    },
    success: {
      main: '#10b981', // Neon Emerald
      light: '#34d399',
      dark: '#059669',
    },
  },
  typography: {
    fontFamily: '"Plus Jakarta Sans", "Inter", "Helvetica Neue", Arial, sans-serif',
    h1: {
      fontFamily: '"Space Grotesk", "Plus Jakarta Sans", sans-serif',
      fontWeight: 700,
      fontSize: '2.5rem',
      letterSpacing: '-0.03em',
    },
    h2: {
      fontFamily: '"Space Grotesk", "Plus Jakarta Sans", sans-serif',
      fontWeight: 700,
      fontSize: '2rem',
      letterSpacing: '-0.025em',
    },
    h3: {
      fontFamily: '"Space Grotesk", "Plus Jakarta Sans", sans-serif',
      fontWeight: 700,
      fontSize: '1.75rem',
      letterSpacing: '-0.02em',
    },
    h4: {
      fontFamily: '"Space Grotesk", "Plus Jakarta Sans", sans-serif',
      fontWeight: 600,
      fontSize: '1.5rem',
      letterSpacing: '-0.015em',
    },
    h5: {
      fontFamily: '"Space Grotesk", "Plus Jakarta Sans", sans-serif',
      fontWeight: 600,
      fontSize: '1.25rem',
      letterSpacing: '-0.01em',
    },
    h6: {
      fontFamily: '"Space Grotesk", "Plus Jakarta Sans", sans-serif',
      fontWeight: 600,
      fontSize: '1rem',
      letterSpacing: '-0.005em',
    },
    subtitle1: {
      fontFamily: '"Plus Jakarta Sans", sans-serif',
      fontSize: '1rem',
      fontWeight: 500,
      color: '#94a3b8',
    },
    body1: {
      fontFamily: '"Plus Jakarta Sans", sans-serif',
      fontSize: '0.9rem',
      lineHeight: 1.6,
    },
    body2: {
      fontFamily: '"Plus Jakarta Sans", sans-serif',
      fontSize: '0.8rem',
      lineHeight: 1.5,
    },
    button: {
      fontFamily: '"Space Grotesk", "Plus Jakarta Sans", sans-serif',
      textTransform: 'none',
      fontWeight: 600,
      letterSpacing: '0.01em',
    },
  },
  shape: {
    borderRadius: 12,
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          padding: '8px 20px',
          fontWeight: 600,
          transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
          boxShadow: 'none',
          '&:hover': {
            boxShadow: '0 6px 20px rgba(16, 185, 129, 0.28)',
            transform: 'translateY(-1px)',
          },
          '&:active': {
            transform: 'translateY(0)',
          },
        },
        containedPrimary: {
          background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
          color: '#040711',
          fontWeight: 700,
          '&:hover': {
            background: 'linear-gradient(135deg, #34d399 0%, #10b981 100%)',
            boxShadow: '0 6px 24px rgba(16, 185, 129, 0.4)',
          },
        },
        containedSecondary: {
          background: 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)',
          color: '#ffffff',
          '&:hover': {
            background: 'linear-gradient(135deg, #22d3ee 0%, #06b6d4 100%)',
            boxShadow: '0 6px 24px rgba(6, 182, 212, 0.35)',
          },
        },
        outlinedPrimary: {
          borderColor: 'rgba(16, 185, 129, 0.4)',
          color: '#34d399',
          '&:hover': {
            borderColor: '#10b981',
            backgroundColor: 'rgba(16, 185, 129, 0.08)',
            boxShadow: '0 0 16px rgba(16, 185, 129, 0.2)',
          },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          backgroundColor: '#090f1d',
          border: '1px solid rgba(16, 185, 129, 0.14)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.55), inset 0 1px 0 rgba(255, 255, 255, 0.04)',
          transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
          borderRadius: 16,
          '&:hover': {
            borderColor: 'rgba(52, 211, 153, 0.4)',
            transform: 'translateY(-2px)',
            boxShadow: '0 16px 44px rgba(0, 0, 0, 0.65), 0 0 24px rgba(16, 185, 129, 0.18)',
          },
        },
      },
    },
    MuiDialog: {
      defaultProps: {
        disableRestoreFocus: true,
      },
      styleOverrides: {
        paper: {
          background: 'linear-gradient(145deg, #0f182b 0%, #040711 100%)',
          border: '1px solid rgba(16, 185, 129, 0.24)',
          borderRadius: '16px',
          boxShadow: '0 24px 64px rgba(0, 0, 0, 0.8), 0 0 32px rgba(16, 185, 129, 0.12)',
          padding: '12px',
          margin: '16px',
          boxSizing: 'border-box',
        },
      },
    },
    MuiDialogTitle: {
      styleOverrides: {
        root: {
          paddingBottom: '8px !important',
          fontSize: '1.35rem',
          fontWeight: 800,
          background: 'linear-gradient(90deg, #34d399 0%, #22d3ee 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          letterSpacing: '0.01em',
        },
      },
    },
    MuiDialogContent: {
      styleOverrides: {
        root: {
          paddingTop: '20px !important',
          paddingBottom: '16px !important',
        },
      },
    },
    MuiDialogActions: {
      styleOverrides: {
        root: {
          padding: '16px 24px !important',
          borderTop: '1px solid rgba(16, 185, 129, 0.1) !important',
        },
      },
    },
    MuiSelect: {
      defaultProps: {
        MenuProps: {
          disablePortal: false,
          sx: {
            zIndex: '2000 !important',
          },
          PaperProps: {
            sx: {
              background: 'linear-gradient(145deg, #0f182b 0%, #040711 100%) !important',
              border: '1px solid rgba(16, 185, 129, 0.22) !important',
              boxShadow: '0 12px 40px rgba(0, 0, 0, 0.7) !important',
            },
          },
        },
      },
    },
    MuiInputLabel: {
      styleOverrides: {
        root: {
          pointerEvents: 'none !important',
          color: '#94a3b8 !important',
          '&.Mui-focused': {
            color: '#34d399 !important',
          },
          '&.MuiInputLabel-shrink': {
            backgroundColor: '#040711 !important',
            padding: '0 8px !important',
            borderRadius: '4px !important',
            pointerEvents: 'none !important',
          },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any,
      },
    },
    MuiInputBase: {
      styleOverrides: {
        root: {
          color: '#f8fafc',
        },
        input: {
          color: '#f8fafc',
        },
      },
    },
    MuiOutlinedInput: {
      defaultProps: {
        notched: true,
      },
      styleOverrides: {
        root: {
          color: '#f8fafc',
          backgroundColor: 'rgba(9, 15, 29, 0.5) !important',
          borderRadius: '10px !important',
          '& fieldset': {
            borderColor: 'rgba(16, 185, 129, 0.15) !important',
            transition: 'border-color 0.2s ease !important',
          },
          '&:hover fieldset': {
            borderColor: 'rgba(52, 211, 153, 0.45) !important',
          },
          '&.Mui-focused fieldset': {
            borderColor: '#10b981 !important',
            borderWidth: '1px !important',
          },
          '&.Mui-focused': {
            boxShadow: '0 0 18px rgba(16, 185, 129, 0.25) !important',
          },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any,
      },
    },
    MuiMenuItem: {
      styleOverrides: {
        root: {
          color: '#f8fafc',
          borderRadius: '6px',
          margin: '2px 6px',
          padding: '8px 12px',
          '&:hover': {
            backgroundColor: 'rgba(16, 185, 129, 0.1)',
          },
          '&.Mui-selected': {
            backgroundColor: 'rgba(16, 185, 129, 0.2)',
            color: '#34d399',
            fontWeight: 600,
            '&:hover': {
              backgroundColor: 'rgba(16, 185, 129, 0.28)',
            },
          },
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: 8,
          },
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          borderBottom: '1px solid rgba(255, 255, 255, 0.04) !important',
          padding: '12px 14px',
          '@media (max-width: 600px)': {
            padding: '8px 10px',
            fontSize: '0.78rem',
          },
        },
        head: {
          fontWeight: 700,
          backgroundColor: 'rgba(9, 15, 29, 0.95) !important',
          color: '#34d399 !important',
          borderBottom: '1px solid rgba(16, 185, 129, 0.25) !important',
          textTransform: 'uppercase',
          fontSize: '0.75rem',
          letterSpacing: '0.06em',
          '@media (max-width: 600px)': {
            padding: '10px 10px',
            fontSize: '0.7rem',
          },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          fontWeight: 600,
          borderRadius: 8,
        },
        colorPrimary: {
          backgroundColor: 'rgba(16, 185, 129, 0.15)',
          color: '#34d399',
          border: '1px solid rgba(16, 185, 129, 0.3)',
        },
        colorSecondary: {
          backgroundColor: 'rgba(6, 182, 212, 0.15)',
          color: '#22d3ee',
          border: '1px solid rgba(6, 182, 212, 0.3)',
        },
      },
    },
  },
});

export const theme = responsiveFontSizes(baseTheme);
export default theme;
