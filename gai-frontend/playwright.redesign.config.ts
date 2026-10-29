import { defineConfig, devices } from '@playwright/test';
import path from 'node:path';

const output = process.env.GAI_TEST_EVIDENCE_DIR ?? path.resolve('test-results/redesign');
Object.assign(process.env, { GAI_TEST_MYSQL_WAVE2: '1' });
export default defineConfig({
  testDir: './e2e', testMatch: 'redesign-real.spec.ts', workers: 1, fullyParallel: false,
  timeout: 120000, outputDir: path.join(output, 'artifacts'),
  reporter: [['list'], ['json', { outputFile: path.join(output, 'playwright.json') }]],
  use: { baseURL: 'http://127.0.0.1:33350', trace: 'retain-on-failure' },
  webServer: [
    { command: 'node ../gai-backend/test/real-api.cjs', url: 'http://127.0.0.1:33349/api/v1/health', reuseExistingServer: false, timeout: 300000 },
    { command: 'node node_modules/vite/bin/vite.js preview --config vite.real.config.ts', url: 'http://127.0.0.1:33350', reuseExistingServer: false, timeout: 120000, env: { VITE_API_BASE_URL: '/api/v1' } },
  ],
  projects: [{ name: 'chromium-redesign', use: { ...devices['Desktop Chrome'] } }],
});
