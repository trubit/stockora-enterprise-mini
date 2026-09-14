import React from 'react';
import ReactDOM from 'react-dom/client';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App.tsx';
import theme from './theme.ts';
import 'bootstrap/dist/css/bootstrap.min.css';
import './index.css';

import { ModuleRegistry, AllCommunityModule } from 'ag-grid-community';
ModuleRegistry.registerModules([AllCommunityModule]);

import { ErrorBoundary } from './components/ErrorBoundary.tsx';

// Defensive Error Shield: Suppress external browser extension / Web Vitals VM exceptions
if (typeof window !== 'undefined') {
  const shouldSuppress = (msg?: unknown, filename?: unknown): boolean => {
    const str = String(msg || '').toLowerCase();
    const src = String(filename || '').toLowerCase();
    return (
      str.includes('starttime') ||
      str.includes('reportallchanges') ||
      src.includes('<anonymous>') ||
      /^vm\d+/i.test(src)
    );
  };

  window.onerror = (msg, url, _line, _col, error) => {
    if (shouldSuppress(msg, url) || (error && shouldSuppress(error.message, url))) {
      return true;
    }
  };

  window.addEventListener(
    'error',
    (event) => {
      const errorMsg = event.message || event.error?.message || '';
      if (shouldSuppress(errorMsg, event.filename)) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    },
    true
  );

  window.addEventListener(
    'unhandledrejection',
    (event) => {
      const reasonMsg = event.reason?.message || String(event.reason || '');
      if (shouldSuppress(reasonMsg)) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    },
    true
  );
}

// Create a client for React Query cache management
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 5000,
    },
  },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider theme={theme}>
          <CssBaseline />
          <App />
        </ThemeProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  </React.StrictMode>
);
