import { Box, Typography, Button, Container } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import TimerIcon from '@mui/icons-material/TimerOff';

export default function SessionExpired() {
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
        <TimerIcon sx={{ fontSize: 80, color: 'warning.main' }} />
        <Typography variant="h3" sx={{ fontWeight: 800 }}>
          Session Expired
        </Typography>
        <Typography variant="h6" sx={{ color: 'text.secondary' }}>
          Your user session has timed out. Please sign in again to resume.
        </Typography>
        <Button
          variant="contained"
          onClick={() => navigate('/login')}
          sx={{ px: 4, py: 1.5, fontWeight: 700 }}
        >
          Sign In
        </Button>
      </Box>
    </Container>
  );
}
