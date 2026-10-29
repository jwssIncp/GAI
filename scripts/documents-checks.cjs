const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'), mode=process.argv[2],out=[];
const local=path.join(root,'.local');fs.mkdirSync(local,{recursive:true});
function run(name,dir,args,env={}){const fd=fs.openSync(path.join(local,'documents-'+name+'.log'),'w'),start=Date.now();const r=spawnSync(process.execPath,args,{cwd:path.join(root,dir),env:{...process.env,...env},stdio:['ignore',fd,fd]});fs.closeSync(fd);const item={name,exit_code:r.status,seconds:(Date.now()-start)/1000};out.push(item);console.log(JSON.stringify(item));}
if(mode==='backend'){
run('typescript-backend','gai-backend',['node_modules/typescript/bin/tsc','--noEmit','--pretty','false']);
run('build-backend','gai-backend',['node_modules/@nestjs/cli/bin/nest.js','build']);
run('lint-backend','gai-backend',['node_modules/eslint/bin/eslint.js','src/modules/documents','src/modules/technical-reports/report.service.ts','src/modules/technical-reports/report.entity.ts','src/modules/technical-reports/technical-reports.module.ts','src/modules/budgets/budget.service.ts','src/modules/budgets/budget.entity.ts','src/modules/budgets/budgets.module.ts','src/migrations/1793900000002-create-professional-documents.ts','src/app.module.ts','src/scripts/seed/permissions.seed.ts','test/integration/test-app.helper.ts','test/integration/documents','test/unit/modules/documents']);
}else if(mode==='frontend'){
run('typescript-frontend','gai-frontend',['node_modules/typescript/bin/tsc','-b','--pretty','false']);
run('build-frontend','gai-frontend',['node_modules/vite/bin/vite.js','build']);
run('lint-frontend','gai-frontend',['node_modules/eslint/bin/eslint.js','src/features/documents','src/features/technical-reports/ReportDetailPage.tsx','src/features/technical-reports/ReportTemplatesPage.tsx','src/features/budgets/BudgetDetailPage.tsx','e2e/documents-real.spec.ts']);
run('tests-frontend','gai-frontend',['node_modules/vitest/vitest.mjs','run','src/features/documents','src/features/technical-reports','src/features/budgets']);
}else if(mode==='tests')run('tests-backend','gai-backend',['node_modules/jest/bin/jest.js','--runInBand','--runTestsByPath','test/unit/modules/documents/document.render.spec.ts','test/unit/modules/documents/document.worker.spec.ts','test/integration/documents/documents.e2e-spec.ts','test/unit/modules/technical-reports/report.policy.spec.ts','test/integration/technical-reports/reports.e2e-spec.ts','test/unit/modules/budgets/budget.policy.spec.ts','test/integration/budgets/budgets.e2e-spec.ts','test/unit/modules/auth/permissions-negative.spec.ts','test/unit/modules/auth/permission-resolver.spec.ts'],{GAI_TEST_MYSQL_DISPOSABLE:'1'});
else throw Error('Unknown mode');
fs.writeFileSync(path.join(local,'documents-checks-'+mode+'.json'),JSON.stringify(out,null,2));process.exitCode=out.some(i=>i.exit_code!==0)?1:0;
