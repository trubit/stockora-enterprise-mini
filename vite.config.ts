import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    exclude: ['**/node_modules/**', '**/dist/**', '**/.git/**', '**/dist-ssr/**', '**/e2e/**'],

    hookTimeout: 30_000,
    testTimeout: 30_000,
    teardownTimeout: 30_000,
    fileParallelism: false,
    maxWorkers: 1,
    pool: 'threads',
    env: {
      NODE_ENV: 'test',
      MONGODB_URI: 'mongodb://127.0.0.1:27017/stockora_test',
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'json', 'html'],
      reportsDirectory: './coverage',
      exclude: [
        '**/node_modules/**',
        '**/dist/**',
        '**/.git/**',
        '**/e2e/**',
        '**/scripts/**',
        '**/*.d.ts',
        '**/*.test.ts',
        '**/*.test.tsx',
      ],
    },
  },
  server: {
    port: 3050,
    strictPort: true,
    host: true,
    proxy: {
      '/api': {
        target: process.env.VITE_API_URL || 'http://127.0.0.1:8095',
        changeOrigin: true,
        secure: false,
        configure: (proxy) => {
          proxy.on('error', (_err, _req, res) => {
            try {
              if (res && typeof (res as any).writeHead === 'function' && !(res as any).headersSent) {
                (res as any).writeHead(502, { 'Content-Type': 'text/plain' }).end();
              }
            } catch {}
          });
        },
      },
      '/socket.io': {
        target: process.env.VITE_API_URL || 'http://127.0.0.1:8095',
        ws: true,
        changeOrigin: true,
        secure: false,
        configure: (proxy) => {
          proxy.on('error', (_err, _req, res) => {
            try {
              if (res && typeof (res as any).writeHead === 'function' && !(res as any).headersSent) {
                (res as any).writeHead(502, { 'Content-Type': 'text/plain' }).end();
              } else if (res && typeof (res as any).destroy === 'function') {
                (res as any).destroy();
              }
            } catch {}
          });
          proxy.on('proxyReqWs', (_proxyReq, _req, socket) => {
            socket.on('error', () => {});
          });
        },
      },
    },
  },
});
