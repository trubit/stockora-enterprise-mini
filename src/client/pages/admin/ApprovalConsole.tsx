import { useQuery } from '@tanstack/react-query';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Button,
  Chip,
  LinearProgress,
  Divider,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import { toast } from 'react-hot-toast';
import { apiClient } from '../../api/client.ts';
import PageHeader from '../../components/PageHeader.tsx';
import { motion } from 'framer-motion';

interface TaskItem {
  _id: string;
  title: string;
  description?: string;
  priority: string;
  status: string;
  assignedRole?: string;
  dueDate?: string;
  createdAt: string;
}

export default function ApprovalConsole() {
  const {
    data: tasks = [],
    isLoading: loading,
    refetch: fetchTasks,
  } = useQuery({
    queryKey: ['workflowTasks'],
    queryFn: async () => {
      const res = await apiClient.get('/workflows/tasks');
      return res.data.data as TaskItem[];
    },
  });

  const handleAction = async (taskId: string, action: 'APPROVE' | 'REJECT') => {
    try {
      await apiClient.post('/workflows/tasks/approve', { taskId, action });
      toast.success(`Approval response ${action} submitted successfully!`);
      fetchTasks();
    } catch {
      toast.error('Failed to process approval action.');
    }
  };

  const getPriorityColor = (prio: string) => {
    switch (prio) {
      case 'CRITICAL':
        return 'error';
      case 'HIGH':
        return 'warning';
      case 'MEDIUM':
        return 'info';
      default:
        return 'default';
    }
  };

  return (
    <Box p={3}>
      <PageHeader
        title="Company Approvals Center"
        subtitle="Sign off on outstanding tasks and automated decision chains"
      />

      {loading ? (
        <LinearProgress color="primary" />
      ) : (
        <Grid container spacing={3}>
          {tasks.length === 0 ? (
            <Grid item xs={12}>
              <Card
                sx={{
                  background: 'rgba(255,255,255,0.05)',
                  backdropFilter: 'blur(10px)',
                  color: '#fff',
                  borderRadius: '16px',
                  border: '1px solid rgba(255,255,255,0.1)',
                }}
              >
                <CardContent sx={{ py: 6 }}>
                  <Typography align="center" variant="h6" color="textSecondary">
                    All clear! You have no pending workflow approval requests.
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          ) : (
            tasks.map((task) => (
              <Grid item xs={12} md={6} key={task._id}>
                <motion.div
                  initial={{ scale: 0.95, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.3 }}
                >
                  <Card
                    sx={{
                      background: 'rgba(255,255,255,0.05)',
                      backdropFilter: 'blur(10px)',
                      color: '#fff',
                      borderRadius: '16px',
                      border: '1px solid rgba(255,255,255,0.1)',
                    }}
                  >
                    <CardContent>
                      <Box
                        display="flex"
                        justifyContent="space-between"
                        alignItems="flex-start"
                        mb={1}
                      >
                        <Typography variant="h6" color="primary">
                          {task.title}
                        </Typography>
                        <Chip
                          label={task.priority}
                          color={getPriorityColor(task.priority)}
                          size="small"
                        />
                      </Box>
                      <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
                        {task.description || 'No detailed instructions provided.'}
                      </Typography>

                      <Divider sx={{ my: 1, background: 'rgba(255,255,255,0.1)' }} />

                      <Box display="flex" justifyContent="space-between" alignItems="center" mt={2}>
                        <Typography variant="caption" color="textSecondary">
                          Due Date:{' '}
                          {task.dueDate ? new Date(task.dueDate).toLocaleDateString() : 'N/A'}
                        </Typography>
                        <Box display="flex" gap={1}>
                          <Button
                            variant="contained"
                            color="success"
                            size="small"
                            startIcon={<CheckCircleIcon />}
                            onClick={() => handleAction(task._id, 'APPROVE')}
                          >
                            Approve
                          </Button>
                          <Button
                            variant="outlined"
                            color="error"
                            size="small"
                            startIcon={<CancelIcon />}
                            onClick={() => handleAction(task._id, 'REJECT')}
                          >
                            Reject
                          </Button>
                        </Box>
                      </Box>
                    </CardContent>
                  </Card>
                </motion.div>
              </Grid>
            ))
          )}
        </Grid>
      )}
    </Box>
  );
}
