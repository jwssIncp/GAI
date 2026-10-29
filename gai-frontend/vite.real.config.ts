import { mergeConfig } from 'vite';
import base from './vite.config';
const isolatedServer = {
  host: '127.0.0.1',
  port: process.env.GAI_TEST_MYSQL_WAVE2 === '1' ? 33350 : 33340,
  strictPort: true,
  proxy: { '/api': { target: process.env.GAI_TEST_MYSQL_WAVE2 === '1' ? 'http://127.0.0.1:33349' : 'http://127.0.0.1:33339', changeOrigin: true } },
};
export default mergeConfig(base, {
  server: isolatedServer,
  preview: isolatedServer,
});
