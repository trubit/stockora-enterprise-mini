import React from 'react';
import { Box, Typography, Button } from '@mui/material';
import InboxIcon from '@mui/icons-material/Inbox';

interface EmptyStateProps {
  title?: string;
  description?: string;
  icon?: React.ReactNode;
  actionLabel?: string;
  onAction?: () => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title = 'No Data Available',
  description = 'There are currently no records matching your request.',
  icon = <InboxIcon sx={{ fontSize: 48, color: '#8b5cf6' }} />,
  actionLabel,
  onAction,
}) => {
  return (
    <Box
      sx={{
        p: 6,
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: '16px',
        backgroundColor: 'rgba(15, 23, 42, 0.4)',
        border: '1px stroke rgba(255, 255, 255, 0.05)',
      }}
    >
      <Box
        sx={{
          p: 2,
          borderRadius: '50%',
          backgroundColor: 'rgba(139, 92, 246, 0.1)',
          mb: 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {icon}
      </Box>

      <Typography variant="h6" sx={{ fontWeight: 700, color: '#f8fafc', mb: 1 }}>
        {title}
      </Typography>

      <Typography
        variant="body2"
        sx={{ color: '#9ca3af', maxWidth: '400px', mb: actionLabel ? 3 : 0 }}
      >
        {description}
      </Typography>

      {actionLabel && onAction && (
        <Button
          variant="contained"
          color="primary"
          onClick={onAction}
          sx={{
            fontWeight: 700,
            textTransform: 'none',
            borderRadius: '10px',
            px: 3,
            py: 1,
            boxShadow: '0 4px 14px rgba(139, 92, 246, 0.3)',
          }}
        >
          {actionLabel}
        </Button>
      )}
    </Box>
  );
};

export default EmptyState;
