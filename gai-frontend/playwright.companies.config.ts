import { configureBrowserCredentials } from './e2e/runtime-credentials';
import { defineConfig, devices } from '@playwright/test';

configureBrowserCredentials();
export default defineConfig({
  testDir: './e2e', testMatch: 'companies.spec.ts', workers: 1,
  outputDir: '../.local/companies-playwright',
  reporter: [['list'], ['json', { outputFile: '../docs/modernizacao-empresas-2026-11-02/playwright.json' }]],
  use: { baseURL: 'http://127.0.0.1:5341', trace: 'retain-on-failure' },
  webServer: [
    { command: 'node ../gai-backend/test/companies-browser-api.cjs', url: 'http://127.0.0.1:33419/api/v1/health', reuseExistingServer: false, timeout: 120000 },
    { command: 'node node_modules/vite/bin/vite.js --config vite.companies.config.ts', url: 'http://127.0.0.1:5341', reuseExistingServer: false, timeout: 120000 },
  ],
  projects: [{ name: 'chromium-companies', use: { ...devices['Desktop Chrome'] } }],
});
