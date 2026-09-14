import React, { useState } from 'react';
import { Box, Button, Menu, MenuItem, ListItemIcon, ListItemText, Typography } from '@mui/material';
import LanguageIcon from '@mui/icons-material/Language';
import CheckIcon from '@mui/icons-material/Check';
import { useTranslation } from '../hooks/useTranslation.js';
import type { LanguageCode } from '../i18n/i18n.js';

export const LanguageSelector: React.FC = () => {
  const { language, setLanguage, supportedLanguages } = useTranslation();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleSelect = (code: LanguageCode) => {
    setAnchorEl(null);
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    setLanguage(code);
  };

  const currentLang = supportedLanguages.find((l) => l.code === language) || supportedLanguages[0];

  return (
    <Box>
      <Button
        id="language-selector-btn"
        aria-controls={open ? 'language-selector-menu' : undefined}
        aria-haspopup="true"
        aria-expanded={open ? 'true' : undefined}
        onClick={handleClick}
        size="small"
        startIcon={
          <LanguageIcon
            sx={{
              color: 'primary.light',
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
          bgcolor: 'rgba(255, 255, 255, 0.04)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          '&:hover': {
            bgcolor: 'rgba(255, 255, 255, 0.08)',
          },
        }}
      >
        <Typography
          variant="body2"
          sx={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 0.6 }}
        >
          <span>{currentLang.flag}</span>
          <span>{currentLang.code.toUpperCase()}</span>
        </Typography>
      </Button>

      <Menu
        id="language-selector-menu"
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        disableRestoreFocus
        MenuListProps={{
          'aria-labelledby': 'language-selector-btn',
          autoFocusItem: false,
        }}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
        PaperProps={{
          sx: {
            mt: 1,
            minWidth: 180,
            borderRadius: 2.5,
            bgcolor: '#111827',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
          },
        }}
      >
        {supportedLanguages.map((lang) => {
          const isSelected = lang.code === language;
          return (
            <MenuItem
              key={lang.code}
              onClick={() => handleSelect(lang.code)}
              selected={isSelected}
              sx={{
                py: 1,
                px: 2,
                '&:hover': { bgcolor: 'rgba(99, 102, 241, 0.12)' },
                '&.Mui-selected': { bgcolor: 'rgba(99, 102, 241, 0.2)' },
              }}
            >
              <ListItemIcon sx={{ minWidth: 28, fontSize: '1.2rem' }}>{lang.flag}</ListItemIcon>
              <ListItemText
                primary={lang.nativeName}
                secondary={lang.name !== lang.nativeName ? lang.name : undefined}
                primaryTypographyProps={{
                  fontSize: '0.875rem',
                  fontWeight: isSelected ? 700 : 500,
                  color: isSelected ? 'primary.light' : 'text.primary',
                }}
                secondaryTypographyProps={{ fontSize: '0.75rem', color: 'text.secondary' }}
              />
              {isSelected && <CheckIcon sx={{ fontSize: 16, color: 'primary.light', ml: 1 }} />}
            </MenuItem>
          );
        })}
      </Menu>
    </Box>
  );
};
