import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
      '/ws': {
        target: 'http://localhost:5000',
        ws: true,
        changeOrigin: true,
        configure: (proxy) => {
          // Suppress ECONNRESET that fires when a browser tab closes/refreshes
          // before the WebSocket handshake completes through the dev proxy.
          proxy.on('error', (err) => {
            if (err.code === 'ECONNRESET' || err.code === 'EPIPE') return;
            console.error('[vite proxy error]', err);
          });
        },
      }
    }
  }
})
