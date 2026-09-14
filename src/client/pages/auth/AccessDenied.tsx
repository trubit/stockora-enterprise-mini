import { Box, Typography, Button, Container } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import SecurityIcon from '@mui/icons-material/Security';

export default function AccessDenied() {
  const navigate = useNavigate();

  return (
    <Container maxWidth="sm">
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '80vh',
          textAlign: 'center',
          gap: 3,
        }}
      >
        <SecurityIcon sx={{ fontSize: 80, color: 'error.main' }} />
        <Typography variant="h3" sx={{ fontWeight: 800 }}>
          Access Denied
        </Typography>
        <Typography variant="h6" sx={{ color: 'text.secondary' }}>
          You do not have the required permissions to view this system page.
        </Typography>
        <Button
          variant="contained"
          onClick={() => navigate('/')}
          sx={{ px: 4, py: 1.5, fontWeight: 700 }}
        >
          Back to Dashboard
        </Button>
      </Box>
    </Container>
  );
}
