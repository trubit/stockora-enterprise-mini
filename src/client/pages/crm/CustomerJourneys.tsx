import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../api/client.ts';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Chip,
  Button,
  Grid,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  CircularProgress,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import EmailIcon from '@mui/icons-material/Email';
import CardGiftcardIcon from '@mui/icons-material/CardGiftcard';
import AltRouteIcon from '@mui/icons-material/AltRoute';
import PageHeader from '../../components/PageHeader.tsx';
import { toast } from 'react-hot-toast';

export default function CustomerJourneys() {
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [triggerType, setTriggerType] = useState('CUSTOMER_CREATED');
  const [actionType, setActionType] = useState('SEND_EMAIL');
  const [message, setMessage] = useState(
    'Welcome to our store, {{name}}! Here is your 10% coupon: {{coupon}}'
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    data: journeys,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['crm-journeys'],
    queryFn: async () => {
      const res = await apiClient.get('/crm/journeys');
      return res.data.data || [];
    },
  });

  const handleCreateJourney = async () => {
    if (!name.trim()) {
      toast.error('Journey name is required.');
      return;
    }

    setIsSubmitting(true);
    try {
      await apiClient.post('/crm/journeys', {
        name,
        description,
        triggerType,
        steps: [
          { stepId: 'step-1', type: 'TRIGGER' },
          {
            stepId: 'step-2',
            type: 'ACTION',
            actionType,
            actionConfig: { message },
          },
        ],
      });
      toast.success('Customer Journey Created Successfully!');
      setCreateModalOpen(false);
      setName('');
      refetch();
    } catch {
      toast.error('Failed to create customer journey.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <PageHeader
        title="Automated Customer Journeys & Workflows"
        subtitle="Configure event-triggered lifecycle automations (Welcome, Re-Engagement, VIP Upgrades)"
        action={
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setCreateModalOpen(true)}
          >
            Create Journey
          </Button>
        }
      />

      <Grid container spacing={3}>
        {(journeys || []).length === 0 ? (
          <Grid item xs={12}>
            <Card sx={{ borderRadius: 2, p: 4, textAlign: 'center' }}>
              <Typography variant="h6" color="text.secondary">
                No automated customer journeys configured yet.
              </Typography>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => setCreateModalOpen(true)}
                sx={{ mt: 2 }}
              >
                Build Your First Journey
              </Button>
            </Card>
          </Grid>
        ) : (
          journeys.map((j: any) => (
            <Grid item xs={12} md={6} key={j._id}>
              <Card sx={{ borderRadius: 2, boxShadow: 2, height: '100%' }}>
                <CardContent>
                  <Box
                    sx={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      mb: 1,
                    }}
                  >
                    <Typography variant="h6" fontWeight={600}>
                      {j.name}
                    </Typography>
                    <Chip
                      label={j.isActive ? 'ACTIVE' : 'PAUSED'}
                      color={j.isActive ? 'success' : 'default'}
                      size="small"
                    />
                  </Box>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    {j.description || 'Automated lifecycle workflow.'}
                  </Typography>

                  <Box sx={{ p: 2, bgcolor: '#f8fafc', borderRadius: 2, mb: 2 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1 }}>
                      Trigger Event:{' '}
                      <Chip label={j.triggerType} size="small" variant="outlined" color="primary" />
                    </Typography>

                    <List dense>
                      {(j.steps || []).map((s: any, idx: number) => (
                        <ListItem key={idx} sx={{ px: 0 }}>
                          <ListItemIcon sx={{ minWidth: 36 }}>
                            {s.type === 'TRIGGER' ? (
                              <PlayArrowIcon color="primary" fontSize="small" />
                            ) : s.actionType === 'SEND_EMAIL' ? (
                              <EmailIcon color="info" fontSize="small" />
                            ) : s.actionType === 'ISSUE_LOYALTY_POINTS' ? (
                              <CardGiftcardIcon color="warning" fontSize="small" />
                            ) : (
                              <AltRouteIcon color="secondary" fontSize="small" />
                            )}
                          </ListItemIcon>
                          <ListItemText
                            primary={`Step ${idx + 1}: ${s.type} ${s.actionType ? `(${s.actionType})` : ''}`}
                            secondary={
                              s.actionConfig?.message ? `"${s.actionConfig.message}"` : undefined
                            }
                          />
                        </ListItem>
                      ))}
                    </List>
                  </Box>

                  <Box
                    sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                  >
                    <Typography variant="caption" color="text.secondary">
                      Enrolled: <strong>{j.enrollmentCount || 0}</strong> | Completed:{' '}
                      <strong>{j.completionCount || 0}</strong>
                    </Typography>
                    <Button size="small" variant="outlined">
                      Configure
                    </Button>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))
        )}
      </Grid>

      {/* Create Journey Modal */}
      <Dialog
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 'bold' }}>Create Automated Customer Journey</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          <TextField
            label="Journey Name"
            placeholder="e.g. VIP Customer Onboarding Workflow"
            value={name}
            onChange={(e) => setName(e.target.value)}
            fullWidth
          />

          <TextField
            label="Description"
            placeholder="Brief purpose of this automated flow"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            fullWidth
          />

          <TextField
            select
            label="Trigger Event"
            value={triggerType}
            onChange={(e) => setTriggerType(e.target.value)}
            fullWidth
          >
            <MenuItem value="CUSTOMER_CREATED">New Customer Created</MenuItem>
            <MenuItem value="FIRST_PURCHASE">First Order Completed</MenuItem>
            <MenuItem value="LOYALTY_TIER_UPGRADED">Loyalty Tier Upgraded</MenuItem>
            <MenuItem value="CHURN_RISK_HIGH">Churn Risk Elevated to High</MenuItem>
            <MenuItem value="INACTIVE_30_DAYS">Inactive for 30 Days</MenuItem>
          </TextField>

          <TextField
            select
            label="Action Step"
            value={actionType}
            onChange={(e) => setActionType(e.target.value)}
            fullWidth
          >
            <MenuItem value="SEND_EMAIL">Send Email Notification</MenuItem>
            <MenuItem value="SEND_SMS">Send SMS Alert</MenuItem>
            <MenuItem value="ISSUE_LOYALTY_POINTS">Award Bonus Loyalty Points</MenuItem>
            <MenuItem value="ADD_TAG">Assign Customer Tag</MenuItem>
          </TextField>

          <TextField
            label="Message Template"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            multiline
            rows={3}
            fullWidth
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateModalOpen(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button variant="contained" onClick={handleCreateJourney} disabled={isSubmitting}>
            {isSubmitting ? 'Creating...' : 'Activate Journey'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
