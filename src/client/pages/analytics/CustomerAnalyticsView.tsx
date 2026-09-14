import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  LinearProgress,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import PeopleIcon from '@mui/icons-material/People';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import RepeatIcon from '@mui/icons-material/Repeat';
import DiamondIcon from '@mui/icons-material/Diamond';
import DownloadIcon from '@mui/icons-material/Download';
import { motion } from 'framer-motion';
import { apiClient } from '../../api/client.ts';
import PageHeader from '../../components/PageHeader.tsx';
import StatCard from '../../components/StatCard.tsx';
import toast from 'react-hot-toast';
import { useRegionalSettings } from '../../hooks/useRegionalSettings.js';

export default function CustomerAnalyticsView() {
  const { formatAmount } = useRegionalSettings();
  const [period, setPeriod] = useState('30_DAYS');
  const [isExporting, setIsExporting] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['bi-customer-analytics', period],
    queryFn: async () => {
      const res = await apiClient.get(`/analytics/customers?period=${period}`);
      return res.data;
    },
  });

  const handleExport = async () => {
    try {
      setIsExporting(true);
      const res = await apiClient.post(
        '/analytics/export',
        { domain: 'CUSTOMERS', format: 'CSV', period },
        { responseType: 'blob' }
      );
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `stockora_customer_analytics_${Date.now()}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success('Customer retention report exported successfully!');
    } catch {
      toast.error('Failed to export customer report');
    } finally {
      setIsExporting(false);
    }
  };

  if (isLoading || !data) {
    return (
      <Box sx={{ p: 4 }}>
        <LinearProgress color="primary" sx={{ borderRadius: 4, height: 6 }} />
        <Typography variant="body2" color="text.secondary" sx={{ mt: 2, textAlign: 'center' }}>
          Loading customer cohort analysis and lifetime value streams...
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 2, md: 4 } }}>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <Box
          sx={{
            display: 'flex',
            flexDirection: { xs: 'column', md: 'row' },
            justifyContent: 'space-between',
            alignItems: { md: 'center' },
            gap: 2,
            mb: 4,
          }}
        >
          <PageHeader
            title="Customer Retention & Cohort Intelligence"
            subtitle="Customer lifetime value estimates, repeat purchase rates, behavioural segmentation & multi-month cohort decay curves"
            category="Business Intelligence"
          />
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
            <FormControl size="small" sx={{ minWidth: 150 }}>
              <InputLabel sx={{ color: 'text.secondary' }}>Date Horizon</InputLabel>
              <Select
                value={period}
                label="Date Horizon"
                onChange={(e) => setPeriod(e.target.value)}
              >
                <MenuItem value="30_DAYS">Last 30 Days</MenuItem>
                <MenuItem value="90_DAYS">Last 90 Days</MenuItem>
                <MenuItem value="THIS_YEAR">This Year</MenuItem>
              </Select>
            </FormControl>

            <Button
              variant="outlined"
              startIcon={<DownloadIcon />}
              onClick={handleExport}
              disabled={isExporting}
              sx={{
                borderColor: 'rgba(139, 92, 246, 0.4)',
                color: '#a78bfa',
                '&:hover': { borderColor: '#8b5cf6', bgcolor: 'rgba(139, 92, 246, 0.08)' },
              }}
            >
              Export CSV
            </Button>
          </Box>
        </Box>

        {/* 4 Core Customer KPI Stat Cards */}
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid item xs={12} sm={6} md={3}>
            <StatCard
              title="ACTIVE ACCOUNTS"
              value={(data.activeCustomers || 0).toLocaleString()}
              subtitle={`${data.totalCustomers || 0} total registered profiles`}
              icon={<PeopleIcon />}
              color="emerald"
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <StatCard
              title="RETENTION RATE"
              value={`${data.retentionRatePct || 0}%`}
              subtitle={`${data.repeatPurchaseRatePct || 0}% repeat purchase rate`}
              icon={<RepeatIcon />}
              color="violet"
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <StatCard
              title="ESTIMATED CLV"
              value={formatAmount(data.customerLifetimeValueEst || 0)}
              subtitle="Average customer lifetime value"
              icon={<DiamondIcon />}
              color="sky"
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <StatCard
              title="NEW PROFILES"
              value={(data.newCustomers || 0).toLocaleString()}
              subtitle={`Avg ticket: ${formatAmount(data.averageSpend || 0)}`}
              icon={<PersonAddIcon />}
              color="amber"
            />
          </Grid>
        </Grid>

        {/* Behavioral Segmentation Grid */}
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid item xs={12}>
            <Card className="glass-panel" sx={{ borderRadius: '16px', p: 3 }}>
              <CardContent>
                <Typography variant="h6" sx={{ fontWeight: 800, mb: 1 }}>
                  Transparent Behavioral Customer Segments
                </Typography>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ display: 'block', mb: 3 }}
                >
                  Rule-based classification with authoritative criteria and revenue contribution
                </Typography>

                <Grid container spacing={2}>
                  {(data.customerSegments || []).map((seg: any) => {
                    const colorMap: Record<string, string> = {
                      HIGH_VALUE: '#8b5cf6',
                      RETURNING: '#10b981',
                      NEW: '#3b82f6',
                      AT_RISK: '#f59e0b',
                      INACTIVE: '#ef4444',
                    };
                    const color = colorMap[seg.segmentName] || '#8b5cf6';

                    return (
                      <Grid item xs={12} sm={6} md={2.4} key={seg.segmentName}>
                        <Box
                          sx={{
                            p: 2.5,
                            borderRadius: '12px',
                            bgcolor: 'rgba(255,255,255,0.02)',
                            border: `1px solid ${color}40`,
                            height: '100%',
                          }}
                        >
                          <Box
                            sx={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              mb: 1,
                            }}
                          >
                            <Typography variant="subtitle2" sx={{ fontWeight: 800, color }}>
                              {seg.segmentName.replace('_', ' ')}
                            </Typography>
                            <Chip
                              label={`${seg.revenueSharePct}% rev`}
                              size="small"
                              sx={{
                                bgcolor: `${color}20`,
                                color,
                                fontWeight: 700,
                                fontSize: '0.7rem',
                              }}
                            />
                          </Box>
                          <Typography variant="h5" sx={{ fontWeight: 800, mb: 1 }}>
                            {seg.count}{' '}
                            <Typography component="span" variant="caption" color="text.secondary">
                              profiles
                            </Typography>
                          </Typography>
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            sx={{ display: 'block', fontSize: '0.75rem' }}
                          >
                            {seg.criteria}
                          </Typography>
                        </Box>
                      </Grid>
                    );
                  })}
                </Grid>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Monthly Cohort Matrix */}
        <Card className="glass-panel" sx={{ borderRadius: '16px', p: 3 }}>
          <CardContent>
            <Typography variant="h6" sx={{ fontWeight: 800, mb: 1 }}>
              Monthly Customer Retention Cohort Matrix
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 3 }}>
              Retention percentage decay curve tracking repeat purchases by onboarding cohort month
            </Typography>

            <TableContainer component={Paper} sx={{ bgcolor: 'transparent', boxShadow: 'none' }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ color: 'text.secondary', fontWeight: 700 }}>
                      Cohort Month
                    </TableCell>
                    <TableCell align="center" sx={{ color: 'text.secondary', fontWeight: 700 }}>
                      Cohort Size
                    </TableCell>
                    <TableCell align="center" sx={{ color: 'text.secondary', fontWeight: 700 }}>
                      Month 0
                    </TableCell>
                    <TableCell align="center" sx={{ color: 'text.secondary', fontWeight: 700 }}>
                      Month 1
                    </TableCell>
                    <TableCell align="center" sx={{ color: 'text.secondary', fontWeight: 700 }}>
                      Month 2
                    </TableCell>
                    <TableCell align="center" sx={{ color: 'text.secondary', fontWeight: 700 }}>
                      Month 3
                    </TableCell>
                    <TableCell align="center" sx={{ color: 'text.secondary', fontWeight: 700 }}>
                      Month 4
                    </TableCell>
                    <TableCell align="center" sx={{ color: 'text.secondary', fontWeight: 700 }}>
                      Month 5
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(data.cohorts || []).map((cohort: any) => (
                    <TableRow
                      key={cohort.cohortMonth}
                      hover
                      sx={{ '&:last-child td, &:last-child th': { border: 0 } }}
                    >
                      <TableCell sx={{ fontWeight: 700 }}>{cohort.cohortMonth}</TableCell>
                      <TableCell align="center" sx={{ fontWeight: 600 }}>
                        {cohort.initialCustomerCount} users
                      </TableCell>
                      {[0, 1, 2, 3, 4, 5].map((mIdx) => {
                        const act = cohort.activityByMonth?.find((a: any) => a.monthIndex === mIdx);
                        if (!act) {
                          return (
                            <TableCell
                              key={mIdx}
                              align="center"
                              sx={{ color: 'rgba(255,255,255,0.1)' }}
                            >
                              —
                            </TableCell>
                          );
                        }
                        const rate = act.retentionRatePct;
                        const alpha = Math.max(0.15, rate / 100);

                        return (
                          <TableCell key={mIdx} align="center">
                            <Box
                              sx={{
                                py: 0.6,
                                px: 1.2,
                                borderRadius: '6px',
                                bgcolor: `rgba(139, 92, 246, ${alpha})`,
                                color: rate >= 70 ? '#ffffff' : '#d1d5db',
                                fontWeight: 700,
                                fontSize: '0.78rem',
                                display: 'inline-block',
                                minWidth: 50,
                              }}
                            >
                              {rate}%
                            </Box>
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      </motion.div>
    </Box>
  );
}
