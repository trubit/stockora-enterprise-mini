import React from 'react';
import { Chip } from '@mui/material';

export type StatusType =
  | 'ACTIVE'
  | 'INACTIVE'
  | 'COMPLETED'
  | 'PENDING'
  | 'CANCELLED'
  | 'LOW_STOCK'
  | 'OUT_OF_STOCK'
  | 'IN_STOCK'
  | 'SUCCESS'
  | 'FAILED'
  | string;

interface StatusChipProps {
  status: StatusType;
  label?: string;
  size?: 'small' | 'medium';
}

const statusConfig: Record<string, { bg: string; color: string; border: string; dot: string }> = {
  ACTIVE: {
    bg: 'rgba(16, 185, 129, 0.12)',
    color: '#34d399',
    border: 'rgba(16, 185, 129, 0.25)',
    dot: '#10b981',
  },
  IN_STOCK: {
    bg: 'rgba(16, 185, 129, 0.12)',
    color: '#34d399',
    border: 'rgba(16, 185, 129, 0.25)',
    dot: '#10b981',
  },
  SUCCESS: {
    bg: 'rgba(16, 185, 129, 0.12)',
    color: '#34d399',
    border: 'rgba(16, 185, 129, 0.25)',
    dot: '#10b981',
  },
  COMPLETED: {
    bg: 'rgba(16, 185, 129, 0.12)',
    color: '#34d399',
    border: 'rgba(16, 185, 129, 0.25)',
    dot: '#10b981',
  },

  PENDING: {
    bg: 'rgba(245, 158, 11, 0.12)',
    color: '#fbbf24',
    border: 'rgba(245, 158, 11, 0.25)',
    dot: '#f59e0b',
  },
  LOW_STOCK: {
    bg: 'rgba(245, 158, 11, 0.12)',
    color: '#fbbf24',
    border: 'rgba(245, 158, 11, 0.25)',
    dot: '#f59e0b',
  },

  INACTIVE: {
    bg: 'rgba(107, 114, 128, 0.15)',
    color: '#9ca3af',
    border: 'rgba(107, 114, 128, 0.25)',
    dot: '#6b7280',
  },
  CANCELLED: {
    bg: 'rgba(239, 68, 68, 0.12)',
    color: '#f87171',
    border: 'rgba(239, 68, 68, 0.25)',
    dot: '#ef4444',
  },
  OUT_OF_STOCK: {
    bg: 'rgba(239, 68, 68, 0.12)',
    color: '#f87171',
    border: 'rgba(239, 68, 68, 0.25)',
    dot: '#ef4444',
  },
  FAILED: {
    bg: 'rgba(239, 68, 68, 0.12)',
    color: '#f87171',
    border: 'rgba(239, 68, 68, 0.25)',
    dot: '#ef4444',
  },
};

export const StatusChip: React.FC<StatusChipProps> = ({ status, label, size = 'small' }) => {
  const normalized = (status || '').toUpperCase();
  const config = statusConfig[normalized] || {
    bg: 'rgba(139, 92, 246, 0.12)',
    color: '#c084fc',
    border: 'rgba(139, 92, 246, 0.25)',
    dot: '#8b5cf6',
  };

  const displayText = label || normalized.replace(/_/g, ' ');

  return (
    <Chip
      size={size}
      label={displayText}
      icon={
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            backgroundColor: config.dot,
            boxShadow: `0 0 8px ${config.dot}`,
            marginLeft: 6,
          }}
        />
      }
      sx={{
        fontWeight: 700,
        fontSize: size === 'small' ? '0.7rem' : '0.8rem',
        backgroundColor: config.bg,
        color: config.color,
        border: `1px solid ${config.border}`,
        borderRadius: '6px',
        textTransform: 'capitalize',
        px: 0.5,
      }}
    />
  );
};

export default StatusChip;
