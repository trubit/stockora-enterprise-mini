import { useQuery } from '@tanstack/react-query';
import { Box, Card, CardContent, Typography, Grid, LinearProgress, Button } from '@mui/material';
import { apiClient } from '../../api/client.ts';
import PageHeader from '../../components/PageHeader.tsx';
import FileOpenIcon from '@mui/icons-material/FileOpen';
import { motion } from 'framer-motion';

interface SavedConfig {
  _id: string;
  name: string;
  configuration: {
    fields: string[];
    chartType: string;
  };
  createdAt: string;
}

export default function SavedReports() {
  const { data: saved = [], isLoading } = useQuery<SavedConfig[]>({
    queryKey: ['saved-reports'],
    queryFn: async () => {
      const { data } = await apiClient.get<SavedConfig[]>('/reports/saved');
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
          title="Saved Configurations"
          subtitle="Deploy your pre-defined custom report visual parameters instantly"
          category="Analytics"
        />

        {saved.length === 0 ? (
          <Box
            sx={{
              py: 10,
              textAlign: 'center',
              border: '1px dashed rgba(255,255,255,0.06)',
              borderRadius: '12px',
            }}
          >
            <Typography color="text.secondary">
              No saved report views found. Use the visual builder to create one.
            </Typography>
          </Box>
        ) : (
          <Grid container spacing={3}>
            {saved.map((rep) => (
              <Grid item xs={12} sm={6} md={4} key={rep._id}>
                <Card className="glass-panel" sx={{ borderRadius: '12px', height: '100%' }}>
                  <CardContent sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                      <FileOpenIcon sx={{ color: 'primary.light' }} />
                      <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                        {rep.name}
                      </Typography>
                    </Box>
                    <Typography variant="caption" color="text.secondary">
                      Created: {new Date(rep.createdAt).toLocaleDateString()}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Chart Preference: {rep.configuration.chartType?.toUpperCase() || 'NONE'}
                    </Typography>
                    <Button
                      variant="outlined"
                      size="small"
                      sx={{ mt: 'auto', alignSelf: 'flex-start' }}
                    >
                      Load Config
                    </Button>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        )}
      </motion.div>
    </Box>
  );
}
