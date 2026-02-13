import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const backendUrl = process.env.VITE_API_URL || 'https://localhost:4000';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      '/graphql': {
        target: backendUrl,
        secure: false, // allow self-signed certs
      },
      '/api': {
        target: backendUrl,
        secure: false,
      },
    },
  },
});
