import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiClient } from '../../api/client.ts';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Button,
  TextField,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  CircularProgress,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import SendIcon from '@mui/icons-material/Send';
import PageHeader from '../../components/PageHeader.tsx';
import { toast } from 'react-hot-toast';

export default function CampaignManager() {
  const [modalOpen, setModalOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [type, setType] = useState('PROMOTIONAL');
  const [channel, setChannel] = useState('EMAIL');
  const [messageTemplate, setMessageTemplate] = useState('');

  const {
    data: campaigns,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['marketing-campaigns'],
    queryFn: async () => {
      const res = await apiClient.get('/crm/campaigns');
      return res.data.data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!title || !messageTemplate) throw new Error('Title and message template are required.');
      const res = await apiClient.post('/crm/campaigns', {
        title,
        type,
        channel,
        messageTemplate,
      });
      return res.data.data;
    },
    onSuccess: () => {
      toast.success('Campaign created successfully!');
      setModalOpen(false);
      setTitle('');
      setMessageTemplate('');
      refetch();
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to create campaign.');
    },
  });

  const dispatchMutation = useMutation({
    mutationFn: async (campaignId: string) => {
      const res = await apiClient.post(`/crm/campaigns/${campaignId}/dispatch`);
      return res.data.data;
    },
    onSuccess: () => {
      toast.success('Campaign dispatched to targeted audience!');
      refetch();
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to dispatch campaign.');
    },
  });

  return (
    <Box sx={{ p: 3 }}>
      <PageHeader
        title="Marketing Automation & Campaigns"
        subtitle="Multi-Channel Outreach (Email, SMS, WhatsApp), Audience Targeting & Analytics"
      />

      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 3 }}>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setModalOpen(true)}>
          Create Campaign
        </Button>
      </Box>

      <Card>
        <CardContent>
          <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>
            Campaign Management & Performance
          </Typography>

          {isLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
              <CircularProgress />
            </Box>
          ) : (
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead sx={{ bgcolor: '#f8fafc' }}>
                  <TableRow>
                    <TableCell>Campaign Title</TableCell>
                    <TableCell>Type</TableCell>
                    <TableCell>Channel</TableCell>
                    <TableCell align="right">Audience Sent</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Date Created</TableCell>
                    <TableCell align="center">Action</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(campaigns || []).map((camp: any) => (
                    <TableRow key={camp._id}>
                      <TableCell>
                        <Typography variant="subtitle2">{camp.title}</Typography>
                      </TableCell>
                      <TableCell>{camp.type}</TableCell>
                      <TableCell>
                        <Chip label={camp.channel} size="small" variant="outlined" />
                      </TableCell>
                      <TableCell align="right">
                        <Typography fontWeight={600}>{camp.stats?.sentCount || 0}</Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={camp.status}
                          size="small"
                          color={
                            camp.status === 'COMPLETED'
                              ? 'success'
                              : camp.status === 'ACTIVE'
                                ? 'info'
                                : 'default'
                          }
                        />
                      </TableCell>
                      <TableCell>{new Date(camp.createdAt).toLocaleDateString()}</TableCell>
                      <TableCell align="center">
                        {camp.status !== 'COMPLETED' && (
                          <Button
                            size="small"
                            variant="contained"
                            color="success"
                            startIcon={<SendIcon />}
                            disabled={dispatchMutation.isPending}
                            onClick={() => dispatchMutation.mutate(camp._id)}
                          >
                            Dispatch
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>

      {/* Create Campaign Modal */}
      <Dialog open={modalOpen} onClose={() => setModalOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Create Marketing Campaign</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="Campaign Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            sx={{ mb: 2, mt: 1 }}
          />
          <Grid container spacing={2} sx={{ mb: 2 }}>
            <Grid item xs={6}>
              <FormControl fullWidth size="small">
                <InputLabel>Type</InputLabel>
                <Select value={type} label="Type" onChange={(e) => setType(e.target.value)}>
                  <MenuItem value="PROMOTIONAL">Promotional</MenuItem>
                  <MenuItem value="PRODUCT_ANNOUNCEMENT">Product Announcement</MenuItem>
                  <MenuItem value="LOYALTY">Loyalty Bonus</MenuItem>
                  <MenuItem value="RE_ENGAGEMENT">Re-engagement</MenuItem>
                  <MenuItem value="CLEARANCE">Clearance</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={6}>
              <FormControl fullWidth size="small">
                <InputLabel>Channel</InputLabel>
                <Select
                  value={channel}
                  label="Channel"
                  onChange={(e) => setChannel(e.target.value)}
                >
                  <MenuItem value="EMAIL">Email</MenuItem>
                  <MenuItem value="SMS">SMS</MenuItem>
                  <MenuItem value="WHATSAPP">WhatsApp</MenuItem>
                  <MenuItem value="PUSH">Push Notification</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>
          <TextField
            fullWidth
            multiline
            rows={4}
            label="Message Template (e.g. Hello {{name}}, enjoy 15% off today!)"
            value={messageTemplate}
            onChange={(e) => setMessageTemplate(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setModalOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            disabled={createMutation.isPending}
            onClick={() => createMutation.mutate()}
          >
            Create Campaign
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
