import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The multiplayer server runs on :8787 (npm run server). In dev/preview the
// websocket is proxied so the client can always use same-origin "/ws".
const proxy = { '/ws': { target: 'ws://localhost:8787', ws: true } };

export default defineConfig({
  plugins: [react()],
  base: './',
  server: { host: true, proxy },
  preview: { host: true, proxy },
  build: { target: 'es2019', chunkSizeWarningLimit: 900 },
});
