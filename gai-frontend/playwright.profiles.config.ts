import { configureBrowserCredentials } from './e2e/runtime-credentials';
import { defineConfig, devices } from '@playwright/test';
configureBrowserCredentials();
export default defineConfig({
  testDir: './e2e', testMatch: 'profiles.spec.ts', workers: 1,
  outputDir: '../.local/profiles-playwright',
  reporter: [['list'], ['json', { outputFile: '../docs/reformulacao-perfis-acessos-2026-11-02/playwright.json' }]],
  use: { baseURL: 'http://127.0.0.1:5342', trace: 'retain-on-failure' },
  webServer: [
    { command: 'node ../gai-backend/test/profiles-browser-api.cjs', url: 'http://127.0.0.1:33429/api/v1/health', reuseExistingServer: false, timeout: 120000 },
    { command: 'node node_modules/vite/bin/vite.js --config vite.profiles.config.ts', url: 'http://127.0.0.1:5342', reuseExistingServer: false, timeout: 120000 },
  ],
  projects: [{ name: 'chromium-profiles', use: { ...devices['Desktop Chrome'] } }],
});
