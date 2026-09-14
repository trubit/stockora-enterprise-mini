import React, { useState, useEffect } from 'react';
import { apiClient } from '../api/client.ts';
import { STORAGE_KEYS } from '../constants/storage.ts';
import { Box, Card, Typography, Button, CircularProgress } from '@mui/material';
import LockIcon from '@mui/icons-material/Lock';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import { useNavigate } from 'react-router-dom';

interface PlanGateProps {
  featureKey: string;
  featureTitle?: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export const PlanGate: React.FC<PlanGateProps> = ({
  featureKey,
  featureTitle = 'This Premium Feature',
  children,
  fallback,
}) => {
  const [hasAccess, setHasAccess] = useState<boolean | null>(null);
  const [currentPlan, setCurrentPlan] = useState<string>('Starter');
  const navigate = useNavigate();

  useEffect(() => {
    checkFeatureAccess();
  }, [featureKey]);

  const checkFeatureAccess = async () => {
    const token = localStorage.getItem(STORAGE_KEYS.TOKEN);
    if (!token) {
      setHasAccess(false);
      return;
    }

    try {
      const res = await apiClient.get('/billing/subscription');

      if (res.data?.success && res.data.data) {
        const sub = res.data.data;
        setCurrentPlan(sub.planSnapshot?.name || 'Starter');
        const features = sub.planSnapshot?.features || {};
        setHasAccess(Boolean(features[featureKey]));
      } else {
        setHasAccess(false); // Fail-closed if no active subscription
      }
    } catch {
      setHasAccess(false); // Fail-closed on error to protect premium features
    }
  };

  if (hasAccess === null) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 5 }}>
        <CircularProgress size={32} />
      </Box>
    );
  }

  if (hasAccess) {
    return <>{children}</>;
  }

  if (fallback) {
    return <>{fallback}</>;
  }

  return (
    <Card
      elevation={0}
      sx={{
        textAlign: 'center',
        p: 5,
        my: 4,
        borderRadius: 4,
        border: '1px solid',
        borderColor: 'divider',
        bgcolor: 'background.paper',
      }}
    >
      <Box
        sx={{
          mx: 'auto',
          mb: 2,
          width: 56,
          height: 56,
          borderRadius: '50%',
          bgcolor: 'warning.light',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'warning.dark',
        }}
      >
        <LockIcon fontSize="medium" />
      </Box>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>
        {featureTitle} is Locked
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 500, mx: 'auto', mb: 3 }}>
        Your current plan (<strong>{currentPlan}</strong>) does not include access to this feature.
        Upgrade to our Professional or Business plan to unlock advanced capabilities.
      </Typography>
      <Box>
        <Button
          variant="contained"
          color="primary"
          startIcon={<ArrowUpwardIcon />}
          onClick={() => navigate('/pricing')}
          sx={{ borderRadius: 8, px: 3, py: 1, fontWeight: 600 }}
        >
          View Upgrade Options
        </Button>
      </Box>
    </Card>
  );
};

export default PlanGate;
