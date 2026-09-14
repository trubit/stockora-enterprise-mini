import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Box,
  Card,
  CardContent,
  TextField,
  Button,
  MenuItem,
  Grid,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  LinearProgress,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import { apiClient } from '../../api/client.ts';
import PageHeader from '../../components/PageHeader.tsx';
import { motion } from 'framer-motion';

interface AuditLogItem {
  _id: string;
  action: string;
  targetModel: string;
  targetId: string;
  userId?: {
    name: string;
    email: string;
    role: string;
  };
  ipAddress?: string;
  createdAt: string;
}

export default function AuditExplorer() {
  const [targetModel, setTargetModel] = useState('');
  const [action, setAction] = useState('');

  const {
    data: logs = [],
    isLoading: loading,
    refetch: fetchLogs,
  } = useQuery({
    queryKey: ['auditLogs', targetModel, action],
    queryFn: async () => {
      try {
        const params: Record<string, string> = {};
        if (targetModel) params.targetModel = targetModel;
        if (action) params.action = action;

        const res = await apiClient.get('/observability/audit', { params });
        return res.data.data as AuditLogItem[];
      } catch {
        return [];
      }
    },
  });

  return (
    <Box p={3}>
      <PageHeader
        title="Platform Audit Trail Explorer"
        subtitle="Immutable history logs tracking critical operational and configuration events"
      />

      <Card
        sx={{
          background: 'rgba(255,255,255,0.05)',
          backdropFilter: 'blur(10px)',
          color: '#fff',
          borderRadius: '16px',
          border: '1px solid rgba(255,255,255,0.1)',
          mb: 3,
        }}
      >
        <CardContent>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={4}>
              <TextField
                select
                fullWidth
                size="small"
                label="Target Model"
                value={targetModel}
                onChange={(e) => setTargetModel(e.target.value)}
                SelectProps={{ style: { color: '#fff' } }}
              >
                <MenuItem value="">All Models</MenuItem>
                <MenuItem value="User">User</MenuItem>
                <MenuItem value="Company">Company</MenuItem>
                <MenuItem value="Product">Product</MenuItem>
                <MenuItem value="Transaction">Transaction</MenuItem>
                <MenuItem value="WorkflowDefinition">WorkflowDefinition</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                select
                fullWidth
                size="small"
                label="Action Logged"
                value={action}
                onChange={(e) => setAction(e.target.value)}
                SelectProps={{ style: { color: '#fff' } }}
              >
                <MenuItem value="">All Actions</MenuItem>
                <MenuItem value="CREATE">CREATE</MenuItem>
                <MenuItem value="UPDATE">UPDATE</MenuItem>
                <MenuItem value="DELETE">DELETE</MenuItem>
                <MenuItem value="LOGIN">LOGIN</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} md={4}>
              <Button
                variant="contained"
                fullWidth
                startIcon={<SearchIcon />}
                onClick={() => fetchLogs()}
                sx={{
                  background: 'linear-gradient(45deg, #9C27B0 30%, #E91E63 90%)',
                  color: 'white',
                }}
              >
                Filter Audit Logs
              </Button>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

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
                  <TableCell sx={{ color: '#aaa', fontWeight: 'bold' }}>Timestamp</TableCell>
                  <TableCell sx={{ color: '#aaa', fontWeight: 'bold' }}>Action</TableCell>
                  <TableCell sx={{ color: '#aaa', fontWeight: 'bold' }}>Model</TableCell>
                  <TableCell sx={{ color: '#aaa', fontWeight: 'bold' }}>Target ID</TableCell>
                  <TableCell sx={{ color: '#aaa', fontWeight: 'bold' }}>User Email</TableCell>
                  <TableCell sx={{ color: '#aaa', fontWeight: 'bold' }}>Client IP</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {logs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} align="center" sx={{ color: '#fff' }}>
                      No audit history matching your filters.
                    </TableCell>
                  </TableRow>
                ) : (
                  logs.map((log) => (
                    <TableRow
                      key={log._id}
                      sx={{ '&:hover': { background: 'rgba(255,255,255,0.02)' } }}
                    >
                      <TableCell sx={{ color: '#fff' }}>
                        {new Date(log.createdAt).toLocaleString()}
                      </TableCell>
                      <TableCell sx={{ color: '#fff' }}>
                        <strong>{log.action}</strong>
                      </TableCell>
                      <TableCell sx={{ color: '#fff' }}>{log.targetModel}</TableCell>
                      <TableCell sx={{ color: '#fff' }}>{log.targetId}</TableCell>
                      <TableCell sx={{ color: '#fff' }}>{log.userId?.email || 'System'}</TableCell>
                      <TableCell sx={{ color: '#fff' }}>{log.ipAddress || 'Internal'}</TableCell>
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
