import { configureBrowserCredentials } from './e2e/runtime-credentials';
import { defineConfig, devices } from "@playwright/test";
import path from 'node:path';
process.env.GAI_PROFILES_EVIDENCE_DIR = path.resolve('../docs/reformulacao-usuarios-2026-11-02/screenshots/profiles-regression');
configureBrowserCredentials();
export default defineConfig({
  testDir: "./e2e",
  testMatch: ["users.spec.ts", "profiles.spec.ts"],
  workers: 1,
  outputDir: "../.local/users-playwright",
  reporter: [
    ["list"],
    [
      "json",
      {
        outputFile: "../docs/reformulacao-usuarios-2026-11-02/playwright.json",
      },
    ],
  ],
  use: { baseURL: "http://127.0.0.1:5344", trace: "retain-on-failure" },
  webServer: [
    {
      command: "node ../gai-backend/test/users-browser-api.cjs",
      url: "http://127.0.0.1:33429/api/v1/health",
      reuseExistingServer: false,
      timeout: 180000,
    },
    {
      command:
        "node node_modules/vite/bin/vite.js --config vite.users.config.ts",
      url: "http://127.0.0.1:5344",
      reuseExistingServer: false,
      timeout: 120000,
    },
  ],
  projects: [{ name: "chromium-users", use: { ...devices["Desktop Chrome"] } }],
});
