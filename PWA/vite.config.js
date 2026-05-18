import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/api/eastmoney': {
        target: 'https://fundmobapi.eastmoney.com',
        changeOrigin: true,
        secure: false,
        headers: {
          'User-Agent': 'EFund/6.5.5 (iPhone; iOS 15.5; Scale/3.00)',
        },
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq, req) => {
            const validmark = req.headers['validmark'];
            if (validmark) {
              proxyReq.setHeader('validmark', validmark);
            }
          });
        },
        rewrite: (path) => path.replace(/^\/api\/eastmoney/, ''),
      },
    },
  },
});
