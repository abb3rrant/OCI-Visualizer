import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import basicSsl from '@vitejs/plugin-basic-ssl';
import { existsSync, readFileSync } from 'fs';
import path from 'path';

const backendUrl = process.env.VITE_API_URL || 'https://localhost:4000';

// Use the server's self-signed certs if available, otherwise let basicSsl generate its own
const certsDir = path.resolve(__dirname, '../certs');
const certFile = path.join(certsDir, 'server.crt');
const keyFile = path.join(certsDir, 'server.key');
const hasSharedCerts = existsSync(certFile) && existsSync(keyFile);

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // Only use basicSsl plugin when we don't have shared certs
    ...(!hasSharedCerts ? [basicSsl()] : []),
  ],
  build: {
    sourcemap: 'hidden',
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          urql: ['urql', 'graphql'],
          reactflow: ['@xyflow/react'],
          recharts: ['recharts'],
        },
      },
    },
  },
  esbuild: {
    pure: ['console.log', 'console.debug'],
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    https: hasSharedCerts
      ? { cert: readFileSync(certFile, 'utf-8'), key: readFileSync(keyFile, 'utf-8') }
      : undefined, // basicSsl plugin handles it
    proxy: {
      '/graphql': {
        target: backendUrl,
        secure: false,
      },
      '/api': {
        target: backendUrl,
        secure: false,
        changeOrigin: true,
        timeout: 600000,
        proxyTimeout: 600000,
      },
    },
  },
});
