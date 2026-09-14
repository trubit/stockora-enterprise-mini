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
import PageHeader from '../../components/PageHeader.tsx';
import { toast } from 'react-hot-toast';

export default function CustomerSegments() {
  const [modalOpen, setModalOpen] = useState(false);
  const [segmentName, setSegmentName] = useState('');
  const [segmentCode, setSegmentCode] = useState('');
  const [description, setDescription] = useState('');
  const [ruleField, setRuleField] = useState('totalSpending');
  const [ruleOperator, setRuleOperator] = useState('GREATER_THAN');
  const [ruleValue, setRuleValue] = useState('1000');

  const {
    data: segments,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['customer-segments'],
    queryFn: async () => {
      const res = await apiClient.get('/crm/segments');
      return res.data.data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!segmentName) throw new Error('Segment name is required.');
      const res = await apiClient.post('/crm/segments', {
        name: segmentName,
        code: segmentCode || `SEG-${Date.now().toString().slice(-4)}`,
        description,
        rules: [
          {
            field: ruleField,
            operator: ruleOperator,
            value: ruleValue,
          },
        ],
        isDynamic: true,
      });
      return res.data.data;
    },
    onSuccess: () => {
      toast.success('Customer Segment created!');
      setModalOpen(false);
      setSegmentName('');
      setSegmentCode('');
      setDescription('');
      refetch();
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to create segment.');
    },
  });

  return (
    <Box sx={{ p: 3 }}>
      <PageHeader
        title="Dynamic Customer Segmentation"
        subtitle="Behavioral Rule Engine, VIP Tagging & Targeted Audience Building"
      />

      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 3 }}>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setModalOpen(true)}>
          Create Segment
        </Button>
      </Box>

      <Card>
        <CardContent>
          <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>
            Active Customer Segments
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
                    <TableCell>Segment Code / Name</TableCell>
                    <TableCell>Description</TableCell>
                    <TableCell>Rules</TableCell>
                    <TableCell align="right">Audience Size</TableCell>
                    <TableCell>Type</TableCell>
                    <TableCell>Status</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(segments || []).map((seg: any) => (
                    <TableRow key={seg._id}>
                      <TableCell>
                        <Typography variant="subtitle2">{seg.name}</Typography>
                        <Typography variant="caption" color="textSecondary">
                          {seg.code}
                        </Typography>
                      </TableCell>
                      <TableCell>{seg.description || 'N/A'}</TableCell>
                      <TableCell>
                        {(seg.rules || []).map((r: any, idx: number) => (
                          <Chip
                            key={idx}
                            label={`${r.field} ${r.operator} ${r.value}`}
                            size="small"
                            variant="outlined"
                            sx={{ mr: 0.5 }}
                          />
                        ))}
                      </TableCell>
                      <TableCell align="right">
                        <Typography fontWeight={700} color="primary.main">
                          {seg.memberCount || 0} customers
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={seg.isDynamic ? 'Dynamic' : 'Static'}
                          size="small"
                          color="info"
                        />
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={seg.isActive ? 'Active' : 'Inactive'}
                          size="small"
                          color="success"
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>

      {/* Create Segment Modal */}
      <Dialog open={modalOpen} onClose={() => setModalOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Create Customer Segment</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="Segment Name"
            value={segmentName}
            onChange={(e) => setSegmentName(e.target.value)}
            sx={{ mb: 2, mt: 1 }}
          />
          <TextField
            fullWidth
            label="Segment Code (Optional)"
            value={segmentCode}
            onChange={(e) => setSegmentCode(e.target.value)}
            sx={{ mb: 2 }}
          />
          <TextField
            fullWidth
            label="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            sx={{ mb: 2 }}
          />

          <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1 }}>
            Segmentation Condition Rule
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={4}>
              <FormControl fullWidth size="small">
                <InputLabel>Field</InputLabel>
                <Select
                  value={ruleField}
                  label="Field"
                  onChange={(e) => setRuleField(e.target.value)}
                >
                  <MenuItem value="totalSpending">Total Spending</MenuItem>
                  <MenuItem value="totalOrders">Total Orders</MenuItem>
                  <MenuItem value="avgOrderValue">Avg Order Value</MenuItem>
                  <MenuItem value="churnRiskLevel">Churn Risk Level</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={4}>
              <FormControl fullWidth size="small">
                <InputLabel>Operator</InputLabel>
                <Select
                  value={ruleOperator}
                  label="Operator"
                  onChange={(e) => setRuleOperator(e.target.value)}
                >
                  <MenuItem value="GREATER_THAN">Greater Than (&gt;)</MenuItem>
                  <MenuItem value="LESS_THAN">Less Than (&lt;)</MenuItem>
                  <MenuItem value="EQUALS">Equals (=)</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={4}>
              <TextField
                fullWidth
                size="small"
                label="Value"
                value={ruleValue}
                onChange={(e) => setRuleValue(e.target.value)}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setModalOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            disabled={createMutation.isPending}
            onClick={() => createMutation.mutate()}
          >
            Create Segment
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
