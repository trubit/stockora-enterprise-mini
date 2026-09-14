import React from 'react';
import { Box, Typography, Breadcrumbs, Link, Chip } from '@mui/material';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import { useTranslation } from '../hooks/useTranslation.js';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  category?: string;
  badgeText?: string;
  badgeColor?: 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning';
  action?: React.ReactNode;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  subtitle,
  category = 'Stockora',
  badgeText,
  badgeColor = 'primary',
  action,
}) => {
  const { t } = useTranslation();

  const displayTitle = t(title);
  const displaySubtitle = subtitle ? t(subtitle) : undefined;
  const displayCategory = t(category);
  const displayBadge = badgeText ? t(badgeText) : undefined;

  return (
    <Box
      sx={{
        mb: { xs: 2.5, sm: 4 },
        display: 'flex',
        flexDirection: { xs: 'column', sm: 'row' },
        alignItems: { xs: 'flex-start', sm: 'center' },
        justifyContent: 'space-between',
        gap: { xs: 2, sm: 2.5 },
      }}
    >
      <Box sx={{ width: { xs: '100%', sm: 'auto' }, minWidth: 0 }}>
        <Breadcrumbs
          separator={<NavigateNextIcon fontSize="small" sx={{ color: 'rgba(255,255,255,0.3)' }} />}
          aria-label="breadcrumb"
          sx={{ mb: 0.5 }}
        >
          <Link
            underline="hover"
            color="inherit"
            href="/"
            sx={{ fontSize: '0.8rem', color: '#9ca3af' }}
          >
            {displayCategory}
          </Link>
          <Typography sx={{ fontSize: '0.8rem', color: '#a78bfa', fontWeight: 600 }}>
            {displayTitle}
          </Typography>
        </Breadcrumbs>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
          <Typography
            variant="h4"
            sx={{
              fontWeight: 800,
              fontSize: { xs: '1.35rem', sm: '1.65rem', md: '2.125rem' },
              background: 'linear-gradient(135deg, #ffffff 0%, #d1d5db 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              letterSpacing: '-0.02em',
              wordBreak: 'break-word',
            }}
          >
            {displayTitle}
          </Typography>

          {displayBadge && (
            <Chip
              label={displayBadge}
              color={badgeColor}
              size="small"
              sx={{
                fontWeight: 700,
                fontSize: '0.7rem',
                borderRadius: '6px',
                height: '22px',
                px: 0.5,
              }}
            />
          )}
        </Box>

        {displaySubtitle && (
          <Typography
            variant="body2"
            sx={{
              color: '#9ca3af',
              mt: 0.5,
              maxWidth: '650px',
              fontSize: { xs: '0.78rem', sm: '0.85rem' },
            }}
          >
            {displaySubtitle}
          </Typography>
        )}
      </Box>

      {action && (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 1.5,
            width: { xs: '100%', sm: 'auto' },
            justifyContent: { xs: 'flex-start', sm: 'flex-end' },
            '& > *': {
              flexGrow: { xs: 1, sm: 0 },
            },
          }}
        >
          {action}
        </Box>
      )}
    </Box>
  );
};

export default PageHeader;
