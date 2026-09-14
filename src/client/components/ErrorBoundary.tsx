import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Box, Typography, Button, Container } from '@mui/material';
import { appNavigate } from '../utils/navigation.ts';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public override state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught React component boundary exception:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    appNavigate('/', { replace: true });
  };

  public override render() {
    if (this.state.hasError) {
      const errorMsg =
        typeof this.state.error?.message === 'string'
          ? this.state.error.message
          : 'An unexpected layout error occurred.';

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
              gap: 2,
            }}
          >
            <Typography variant="h3" sx={{ fontWeight: 800, color: 'error.main' }}>
              Oops!
            </Typography>
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              Something went wrong in the application shell.
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
              {errorMsg}
            </Typography>
            <Button
              variant="contained"
              color="primary"
              onClick={this.handleReset}
              sx={{ px: 4, py: 1.5, textTransform: 'none', fontWeight: 700 }}
            >
              Return to Dashboard
            </Button>
          </Box>
        </Container>
      );
    }

    return this.props.children;
  }
}
