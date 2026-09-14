import React from 'react';
import { Card, CardContent, Box, Typography, Chip } from '@mui/material';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import { useTranslation } from '../hooks/useTranslation.js';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  trend?: string;
  trendUp?: boolean;
  color?: 'violet' | 'emerald' | 'sky' | 'amber' | 'rose';
}

const colorMap = {
  violet: {
    border: 'linear-gradient(90deg, #c084fc 0%, #8b5cf6 100%)',
    bg: 'rgba(139, 92, 246, 0.1)',
    text: '#c084fc',
  },
  emerald: {
    border: 'linear-gradient(90deg, #34d399 0%, #10b981 100%)',
    bg: 'rgba(16, 185, 129, 0.1)',
    text: '#34d399',
  },
  sky: {
    border: 'linear-gradient(90deg, #38bdf8 0%, #0284c7 100%)',
    bg: 'rgba(56, 189, 248, 0.1)',
    text: '#38bdf8',
  },
  amber: {
    border: 'linear-gradient(90deg, #fbbf24 0%, #d97706 100%)',
    bg: 'rgba(245, 158, 11, 0.1)',
    text: '#fbbf24',
  },
  rose: {
    border: 'linear-gradient(90deg, #f87171 0%, #e11d48 100%)',
    bg: 'rgba(244, 63, 94, 0.1)',
    text: '#f87171',
  },
};

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtitle,
  icon,
  trend,
  trendUp = true,
  color = 'violet',
}) => {
  const { t } = useTranslation();
  const palette = colorMap[color];
  const displayTitle = t(title);
  const displaySubtitle = subtitle ? t(subtitle) : undefined;

  return (
    <Card
      className="glass-panel"
      sx={{
        position: 'relative',
        overflow: 'hidden',
        height: '100%',
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '3px',
          background: palette.border,
        },
      }}
    >
      <CardContent sx={{ p: 3, '&:last-child': { pb: 3 } }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Typography
            variant="body2"
            sx={{ color: '#9ca3af', fontWeight: 600, letterSpacing: '0.02em' }}
          >
            {displayTitle}
          </Typography>

          <Box
            sx={{
              p: 1.2,
              borderRadius: '12px',
              backgroundColor: palette.bg,
              color: palette.text,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {icon}
          </Box>
        </Box>

        <Typography
          variant="h4"
          sx={{ fontWeight: 800, color: '#f8fafc', mb: 1, letterSpacing: '-0.02em' }}
        >
          {value}
        </Typography>

        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 1,
          }}
        >
          {displaySubtitle && (
            <Typography variant="caption" sx={{ color: '#6b7280' }}>
              {displaySubtitle}
            </Typography>
          )}

          {trend && (
            <Chip
              icon={
                trendUp ? (
                  <TrendingUpIcon style={{ fontSize: 14 }} />
                ) : (
                  <TrendingDownIcon style={{ fontSize: 14 }} />
                )
              }
              label={trend}
              size="small"
              sx={{
                height: '22px',
                fontSize: '0.72rem',
                fontWeight: 700,
                backgroundColor: trendUp ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                color: trendUp ? '#34d399' : '#f87171',
                border: `1px solid ${trendUp ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`,
                '& .MuiChip-icon': {
                  color: trendUp ? '#34d399' : '#f87171',
                },
              }}
            />
          )}
        </Box>
      </CardContent>
    </Card>
  );
};

export default StatCard;
