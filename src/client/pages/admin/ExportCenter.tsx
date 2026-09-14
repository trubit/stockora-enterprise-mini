import { useQuery } from '@tanstack/react-query';
import {
  Box,
  LinearProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Button,
} from '@mui/material';
import { apiClient } from '../../api/client.ts';
import PageHeader from '../../components/PageHeader.tsx';
import DownloadIcon from '@mui/icons-material/Download';
import { motion } from 'framer-motion';

interface ExportLog {
  _id: string;
  reportName: string;
  category: string;
  format: string;
  status: string;
  createdAt: string;
  downloadUrl?: string;
}

export default function ExportCenter() {
  const { data: logs = [], isLoading } = useQuery<ExportLog[]>({
    queryKey: ['export-history'],
    queryFn: async () => {
      const { data } = await apiClient.get<ExportLog[]>('/reports/exports');
      return data;
    },
  });

  if (isLoading) {
    return <LinearProgress color="primary" />;
  }

  return (
    <Box sx={{ p: { xs: 2, md: 4 } }}>
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <PageHeader
          title="Export Asset Center"
          subtitle="Audit ledger download logs, generated spreadsheets, and secure download tokens"
          category="Analytics"
        />

        <TableContainer component={Paper} className="glass-panel" sx={{ borderRadius: '12px' }}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Report Name</TableCell>
                <TableCell>Category</TableCell>
                <TableCell>Format</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Timestamp</TableCell>
                <TableCell align="right">Action</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {logs.map((log) => (
                <TableRow key={log._id}>
                  <TableCell sx={{ fontWeight: 700 }}>{log.reportName}</TableCell>
                  <TableCell>{log.category}</TableCell>
                  <TableCell>{log.format}</TableCell>
                  <TableCell>
                    <Chip
                      label={log.status}
                      color={log.status === 'SUCCESS' ? 'success' : 'warning'}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>{new Date(log.createdAt).toLocaleString()}</TableCell>
                  <TableCell align="right">
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={<DownloadIcon />}
                      disabled={!log.downloadUrl}
                      href={log.downloadUrl}
                    >
                      Download
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {logs.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                    No historical download logs recorded.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </motion.div>
    </Box>
  );
}
