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
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq, req) => {
            const params = new URLSearchParams(req.url.split('?')[1] || '');
            const endpoint = params.get('endpoint');
            const validmark = req.headers['validmark'];

            // 去掉 endpoint 参数，其余参数保留
            params.delete('endpoint');
            const query = params.toString();
            proxyReq.path = `/${endpoint}${query ? '?' + query : ''}`;

            if (validmark) proxyReq.setHeader('validmark', validmark);
            proxyReq.setHeader('User-Agent', 'EFund/6.5.5 (iPhone; iOS 15.5; Scale/3.00)');
          });
        },
      },
    },
  },
});
