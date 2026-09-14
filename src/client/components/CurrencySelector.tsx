import React, { useState } from 'react';
import {
  Box,
  Button,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  ListSubheader,
  Typography,
  Chip,
  Divider,
} from '@mui/material';
import PaidIcon from '@mui/icons-material/Paid';
import CheckIcon from '@mui/icons-material/Check';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import { useRegionalSettings } from '../hooks/useRegionalSettings.js';
import { SUPPORTED_CURRENCIES, getCurrencyInfo } from '../../shared/currencies.js';

interface CurrencySelectorProps {
  size?: 'small' | 'medium';
  variant?: 'contained' | 'outlined' | 'text';
}

export const CurrencySelector: React.FC<CurrencySelectorProps> = ({ size = 'small' }) => {
  const {
    baseCurrency,
    displayCurrency,
    supportedCurrencies,
    setDisplayCurrency,
    resetDisplayCurrency,
    isConverted,
  } = useRegionalSettings();

  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleSelect = (code: string) => {
    handleClose();
    setDisplayCurrency(code);
  };

  const handleReset = () => {
    handleClose();
    resetDisplayCurrency();
  };

  const currentInfo = getCurrencyInfo(displayCurrency);

  // Union of tenant configured supported currencies and all available ISO currencies
  const tenantCurrencies = Array.isArray(supportedCurrencies) ? supportedCurrencies : [];
  const allSupportedKeys = Object.keys(SUPPORTED_CURRENCIES);
  const availableCurrencyCodes = Array.from(
    new Set([...tenantCurrencies, ...allSupportedKeys])
  ).filter((code) => Boolean(SUPPORTED_CURRENCIES[code]));

  return (
    <Box>
      <Button
        id="currency-selector-btn"
        aria-controls={open ? 'currency-selector-menu' : undefined}
        aria-haspopup="true"
        aria-expanded={open ? 'true' : undefined}
        onClick={handleClick}
        size={size}
        startIcon={
          <PaidIcon
            sx={{
              color: isConverted ? 'secondary.main' : 'primary.light',
              fontSize: 18,
              display: { xs: 'none', sm: 'inline-flex' },
            }}
          />
        }
        sx={{
          color: 'text.primary',
          textTransform: 'none',
          borderRadius: 2,
          px: { xs: 1, sm: 1.5 },
          py: 0.6,
          minWidth: 'auto',
          bgcolor: isConverted ? 'rgba(236, 72, 153, 0.08)' : 'rgba(255, 255, 255, 0.04)',
          border: isConverted
            ? '1px solid rgba(236, 72, 153, 0.3)'
            : '1px solid rgba(255, 255, 255, 0.08)',
          '&:hover': {
            bgcolor: isConverted ? 'rgba(236, 72, 153, 0.15)' : 'rgba(255, 255, 255, 0.08)',
          },
        }}
      >
        <Typography
          variant="body2"
          sx={{
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: 0.6,
            fontSize: '0.82rem',
          }}
        >
          <span>{currentInfo.flag}</span>
          <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>
            {currentInfo.code}
          </Box>
          <span style={{ opacity: 0.85 }}>({currentInfo.symbol})</span>
        </Typography>
      </Button>

      <Menu
        id="currency-selector-menu"
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        MenuListProps={{
          'aria-labelledby': 'currency-selector-btn',
          role: 'menu',
        }}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
        PaperProps={{
          sx: {
            mt: 1,
            minWidth: { xs: 260, sm: 280 },
            maxWidth: 'calc(100vw - 24px)',
            maxHeight: 440,
            borderRadius: 2.5,
            bgcolor: '#111827',
            backgroundImage: 'none',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            boxShadow: '0 10px 30px rgba(0,0,0,0.6)',
            overflowY: 'auto',
          },
        }}
      >
        <ListSubheader
          disableSticky
          sx={{
            px: 2,
            py: 1,
            bgcolor: 'transparent',
            lineHeight: 'normal',
            color: 'inherit',
          }}
        >
          <Typography
            variant="caption"
            sx={{
              color: 'text.secondary',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            Display Currency
          </Typography>
          <Typography
            variant="body2"
            sx={{ color: 'text.secondary', fontSize: '0.75rem', mt: 0.3 }}
          >
            Base Operating Currency: <strong style={{ color: '#818cf8' }}>{baseCurrency}</strong>
          </Typography>
        </ListSubheader>

        <Divider sx={{ borderColor: 'rgba(255, 255, 255, 0.08)', my: 0.5 }} />

        {isConverted && (
          <MenuItem
            key="reset-to-base"
            onClick={handleReset}
            sx={{
              py: 1,
              px: 2,
              color: 'secondary.light',
              '&:hover': {
                bgcolor: 'rgba(236, 72, 153, 0.12)',
              },
            }}
          >
            <ListItemIcon>
              <RestartAltIcon sx={{ color: 'secondary.light', fontSize: 18 }} />
            </ListItemIcon>
            <ListItemText
              primary={`Reset to Base Currency (${baseCurrency})`}
              primaryTypographyProps={{ variant: 'body2', fontWeight: 600 }}
            />
          </MenuItem>
        )}

        {isConverted && (
          <Divider key="reset-divider" sx={{ borderColor: 'rgba(255, 255, 255, 0.08)', my: 0.5 }} />
        )}

        {availableCurrencyCodes.map((code) => {
          const info = getCurrencyInfo(code);
          const isSelected = code === displayCurrency;
          const isBase = code === baseCurrency;

          return (
            <MenuItem
              key={code}
              onClick={() => handleSelect(code)}
              selected={isSelected}
              sx={{
                py: 1,
                px: 2,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 1.5,
                '&.Mui-selected': {
                  bgcolor: 'rgba(99, 102, 241, 0.16)',
                },
                '&:hover': {
                  bgcolor: isSelected ? 'rgba(99, 102, 241, 0.24)' : 'rgba(255, 255, 255, 0.04)',
                },
              }}
            >
              <Box
                sx={{ display: 'flex', alignItems: 'center', gap: 1.2, minWidth: 0, flexGrow: 1 }}
              >
                <Typography sx={{ fontSize: '1.2rem', lineHeight: 1, flexShrink: 0 }}>
                  {info.flag}
                </Typography>
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="body2" noWrap sx={{ fontWeight: isSelected ? 700 : 500 }}>
                    {info.code} — {info.name}
                  </Typography>
                  <Typography
                    variant="caption"
                    sx={{ color: 'text.secondary', fontSize: '0.7rem' }}
                  >
                    Symbol: {info.symbol} • Decimals: {info.decimalDigits}
                  </Typography>
                </Box>
              </Box>

              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8, flexShrink: 0 }}>
                {isBase && (
                  <Chip
                    label="BASE"
                    size="small"
                    color="primary"
                    sx={{ height: 18, fontSize: '0.6rem', fontWeight: 700 }}
                  />
                )}
                {isSelected && <CheckIcon sx={{ color: 'primary.main', fontSize: 18 }} />}
              </Box>
            </MenuItem>
          );
        })}
      </Menu>
    </Box>
  );
};
