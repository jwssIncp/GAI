import { configureBrowserCredentials } from './e2e/runtime-credentials';
import { defineConfig, devices } from "@playwright/test";
import path from "node:path";

const evidence = path.resolve(
  "../docs/reformulacao-cadastro-projetos-2026-11-03",
);
Object.assign(process.env, {
  GAI_TEST_MYSQL_WAVE2: "1",
  GAI_TEST_EVIDENCE_DIR: path.join(evidence, "checks/browser"),
});
configureBrowserCredentials();
export default defineConfig({
  testDir: "./e2e",
  testMatch: ["project-registration-real.spec.ts"],
  workers: 1,
  timeout: 90000,
  outputDir: path.join(evidence, "checks/browser/artifacts"),
  reporter: [
    ["list"],
    [
      "json",
      { outputFile: path.join(evidence, "checks/browser/playwright.json") },
    ],
  ],
  use: {
    baseURL: "http://127.0.0.1:33350",
    trace: "retain-on-failure",
  },
  webServer: [
    {
      command: "node ../gai-backend/test/real-api.cjs",
      url: "http://127.0.0.1:33349/api/v1/health",
      reuseExistingServer: false,
      timeout: 300000,
    },
    {
      command:
        "node node_modules/vite/bin/vite.js preview --config vite.real.config.ts",
      url: "http://127.0.0.1:33350",
      reuseExistingServer: false,
      timeout: 120000,
      env: { GAI_TEST_MYSQL_WAVE2: "1", VITE_API_BASE_URL: "/api/v1" },
    },
  ],
  projects: [
    { name: "chromium-projects-real", use: { ...devices["Desktop Chrome"] } },
  ],
});
