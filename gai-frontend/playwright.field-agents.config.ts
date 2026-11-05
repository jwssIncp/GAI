import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e",
  testMatch: "field-agents-reform.spec.ts",
  workers: 1,
  fullyParallel: false,
  outputDir: "../.local/field-agents-browser",
  use: { baseURL: "http://127.0.0.1:5183", trace: "retain-on-failure" },
  webServer: {
    command: "npm.cmd run dev -- --port 5183 --strictPort",
    url: "http://127.0.0.1:5183",
    reuseExistingServer: false,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
