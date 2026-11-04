import { defineConfig, devices } from "@playwright/test";
import { configureBrowserCredentials } from "./e2e/runtime-credentials";

configureBrowserCredentials();
process.env.GAI_TEST_MYSQL_WAVE2 = "0";

export default defineConfig({
  testDir: "./e2e-credentials",
  testMatch: "password-first-access.spec.ts",
  workers: 1,
  timeout: 120000,
  expect: { timeout: 15000 },
  outputDir: "../.local/password-browser-artifacts",
  reporter: [
    ["list"],
    ["json", { outputFile: "../.local/password-browser.json" }],
  ],
  use: { baseURL: "http://127.0.0.1:33340", trace: "retain-on-failure" },
  webServer: [
    {
      command: "node ../gai-backend/test/real-api.cjs",
      url: "http://127.0.0.1:33339/api/v1/health",
      reuseExistingServer: false,
      timeout: 300000,
    },
    {
      command:
        "node node_modules/vite/bin/vite.js --config vite.real.config.ts",
      url: "http://127.0.0.1:33340",
      reuseExistingServer: false,
      timeout: 120000,
      env: { VITE_API_BASE_URL: "/api/v1" },
    },
  ],
  projects: [{ name: "chromium-mysql", use: { ...devices["Desktop Chrome"] } }],
});
