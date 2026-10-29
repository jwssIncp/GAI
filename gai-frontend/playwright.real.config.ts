import { defineConfig, devices } from '@playwright/test';
import path from 'node:path';
const wave2 = process.env.GAI_TEST_MYSQL_WAVE2 === '1';
const uiPort = wave2 ? 33350 : 33340, apiPort = wave2 ? 33349 : 33339;
Object.assign(process.env,{GAI_RECEIVABLES_REAL:'1',GAI_DRE_REAL:'1',GAI_E2E_LOGIN:'org.admin',GAI_E2E_PASSWORD:'Admin@123456',GAI_E2E_BASE_URL:'http://127.0.0.1:' + uiPort});
if (wave2) Object.assign(process.env, { GAI_NAV_REAL:'1',GAI_BUDGETS_REAL:'1',GAI_CONTRACTS_REAL:'1',GAI_REPORTS_REAL:'1',GAI_DOCUMENTS_REAL:'1',GAI_VALUATIONS_REAL:'1',GAI_FIELD_REAL:'1',GAI_ASSISTED_REAL:'1' });
const output = process.env.GAI_TEST_EVIDENCE_DIR ?? path.resolve('test-results/real');
export default defineConfig({
  testDir: './e2e', testMatch: wave2 ? ['receivables-real.spec.ts','dre-real.spec.ts','budgets-real.spec.ts','contracts-real.spec.ts','reports-real.spec.ts','documents-real.spec.ts','valuation-batches-real.spec.ts','field-coordination-real.spec.ts','assisted-reconciliation-real.spec.ts','integration-navigation-real.spec.ts','project-navigation-real.spec.ts'] : ['receivables-real.spec.ts','dre-real.spec.ts'], fullyParallel: false, workers: 1,
  outputDir: path.join(output,'playwright-artifacts'),
  reporter: [['list'],['json',{outputFile:path.join(output,'playwright.json')}]],
  use: {baseURL:'http://127.0.0.1:' + uiPort,trace:'retain-on-failure'},
  webServer: [
    {command:'node ../gai-backend/test/real-api.cjs',url:'http://127.0.0.1:' + apiPort + '/api/v1/health',reuseExistingServer:false,timeout:300000},
    {command:'node node_modules/vite/bin/vite.js preview --config vite.real.config.ts',url:'http://127.0.0.1:' + uiPort,reuseExistingServer:false,timeout:120000,env:{VITE_API_BASE_URL:'/api/v1'}},
  ],
  projects:[{name:'chromium-real',use:{...devices['Desktop Chrome']}}],
});
