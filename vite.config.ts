import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(() => {
  return {
    base: './',
    server: {
      port: 5173,
      host: '127.0.0.1',
      proxy: {
        '/api': 'http://localhost:3001'
      }
    },
    plugins: [react()],
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) return;

            if (
              id.includes('/react/') ||
              id.includes('/react-dom/') ||
              id.includes('/scheduler/')
            ) {
              return 'react-vendor';
            }

            if (
              id.includes('/jspdf/') ||
              id.includes('/html2canvas/')
            ) {
              return 'pdf-render';
            }

            if (id.includes('/mammoth/')) {
              return 'doc-tools';
            }

            if (
              id.includes('/jszip/') ||
              id.includes('/file-saver/')
            ) {
              return 'zip-export';
            }

            if (id.includes('/zod/')) {
              return 'validation';
            }

            return 'vendor';
          }
        }
      }
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      }
    }
  };
});
