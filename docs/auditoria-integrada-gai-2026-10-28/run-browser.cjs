const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'../..');
const env={...process.env,GAI_E2E_LOGIN:'org.admin',GAI_E2E_PASSWORD:'Admin@123456'};
for(const flag of ['GAI_ASSISTED_REAL','GAI_BUDGETS_REAL','GAI_CONTRACTS_REAL','GAI_DOCUMENTS_REAL','GAI_DRE_REAL','GAI_FIELD_REAL','GAI_RECEIVABLES_REAL','GAI_REPORTS_REAL','GAI_VALUATIONS_REAL'])env[flag]='1';
const fd=fs.openSync(path.join(__dirname,'evidencias/playwright.log'),'w');
const r=spawnSync(process.execPath,[path.join(root,'gai-frontend/node_modules/@playwright/test/cli.js'),'test','--config',path.join(__dirname,'playwright.config.cjs')],{cwd:path.join(root,'gai-frontend'),env,stdio:['ignore',fd,fd]});fs.closeSync(fd);console.log(JSON.stringify({exit_code:r.status}));process.exitCode=r.status||0;
