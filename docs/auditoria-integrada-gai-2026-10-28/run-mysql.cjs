const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'../..'),out=path.join(__dirname,'evidencias');
const mode=process.argv[2];
process.env.NODE_ENV='test';process.env.GAI_TEST_MYSQL_DISPOSABLE='1';
process.env.TS_NODE_PROJECT=path.join(root,'gai-backend/tsconfig.json');
if(mode==='tests'){
  const fd=fs.openSync(path.join(out,'mysql-tests.log'),'w'),start=new Date();
  const args=['node_modules/jest/bin/jest.js','--runInBand','--testTimeout=300000','--testPathPatterns=test/integration','--json','--outputFile='+path.join(out,'mysql-jest.json')];
  const r=spawnSync(process.execPath,args,{cwd:path.join(root,'gai-backend'),env:{...process.env,GAI_TEST_S3_DISPOSABLE:'0'},stdio:['ignore',fd,fd]});fs.closeSync(fd);
  const result={start:start.toISOString(),seconds:(Date.now()-start)/1000,exit_code:r.status,command:['node',...args],target:'127.0.0.1:33317/gai_validation_disposable'};
  fs.writeFileSync(path.join(out,'mysql-checks.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));process.exitCode=r.status||0;
}else if(mode==='server'){
  require(path.join(root,'gai-backend/node_modules/ts-node/register/transpile-only'));
  const {createTestApp,seedTestData}=require(path.join(root,'gai-backend/test/integration/test-app.helper.ts'));
  (async()=>{const app=await createTestApp();await seedTestData(app);const express=app.getHttpAdapter().getInstance();const server=require('node:http').createServer((req,res)=>{if(req.url==='/api/v1/health'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify({status:'ok',scope:'audit-harness'}));}else express(req,res);});await new Promise(resolve=>server.listen(33319,'127.0.0.1',resolve));console.log('AUDIT_SERVER_READY http://127.0.0.1:33319/api/v1 PID='+process.pid);process.on('SIGINT',async()=>{server.close();await app.close();process.exit(0)});})().catch(e=>{console.error(e);process.exitCode=1});
}else throw Error('Unknown mode');
