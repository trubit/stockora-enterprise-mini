import { useQuery } from '@tanstack/react-query';
import {
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  LinearProgress,
} from '@mui/material';
import { apiClient } from '../../api/client.ts';
import PageHeader from '../../components/PageHeader.tsx';
import { motion } from 'framer-motion';

interface StepLog {
  stepId: string;
  status: string;
  startedAt: string;
  completedAt?: string;
  error?: string;
}

interface WorkflowInstance {
  _id: string;
  triggerEvent: string;
  status: string;
  currentStepId?: string;
  createdAt: string;
  executionLogs: StepLog[];
}

export default function WorkflowHistory() {
  const { data: instances = [], isLoading: loading } = useQuery({
    queryKey: ['workflowInstances'],
    queryFn: async () => {
      try {
        const res = await apiClient.get('/workflows/instances');
        return res.data.data as WorkflowInstance[];
      } catch {
        return [];
      }
    },
  });

  const getStatusChipColor = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return 'success';
      case 'RUNNING':
        return 'info';
      case 'FAILED':
        return 'error';
      case 'CANCELLED':
        return 'warning';
      default:
        return 'default';
    }
  };

  return (
    <Box p={3}>
      <PageHeader
        title="Workflow Instance History"
        subtitle="Track live event-driven BPM runs and rule decisions"
      />

      {loading ? (
        <LinearProgress color="primary" />
      ) : (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4 }}
        >
          <TableContainer
            component={Paper}
            sx={{
              background: 'rgba(255,255,255,0.05)',
              backdropFilter: 'blur(10px)',
              color: '#fff',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '16px',
            }}
          >
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ color: '#aaa', fontWeight: 'bold' }}>Instance ID</TableCell>
                  <TableCell sx={{ color: '#aaa', fontWeight: 'bold' }}>Trigger Event</TableCell>
                  <TableCell sx={{ color: '#aaa', fontWeight: 'bold' }}>Execution Status</TableCell>
                  <TableCell sx={{ color: '#aaa', fontWeight: 'bold' }}>Current Step</TableCell>
                  <TableCell sx={{ color: '#aaa', fontWeight: 'bold' }}>Steps Run Count</TableCell>
                  <TableCell sx={{ color: '#aaa', fontWeight: 'bold' }}>Started At</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {instances.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} align="center" sx={{ color: '#fff' }}>
                      No workflow execution instances recorded yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  instances.map((inst) => (
                    <TableRow
                      key={inst._id}
                      sx={{ '&:hover': { background: 'rgba(255,255,255,0.02)' } }}
                    >
                      <TableCell sx={{ color: '#fff' }}>{inst._id}</TableCell>
                      <TableCell sx={{ color: '#fff' }}>{inst.triggerEvent}</TableCell>
                      <TableCell>
                        <Chip
                          label={inst.status}
                          color={getStatusChipColor(inst.status)}
                          size="small"
                        />
                      </TableCell>
                      <TableCell sx={{ color: '#fff' }}>
                        {inst.currentStepId || 'Finished'}
                      </TableCell>
                      <TableCell sx={{ color: '#fff' }}>{inst.executionLogs.length}</TableCell>
                      <TableCell sx={{ color: '#fff' }}>
                        {new Date(inst.createdAt).toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </motion.div>
      )}
    </Box>
  );
}
