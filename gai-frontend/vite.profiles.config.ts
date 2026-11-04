import { defineConfig, mergeConfig } from 'vite';
import base from './vite.config';
export default mergeConfig(base, defineConfig({
  server: { host: '127.0.0.1', port: 5342, strictPort: true, proxy: { '/api': { target: 'http://127.0.0.1:33429', changeOrigin: true } } },
}));
