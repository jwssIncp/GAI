const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'../..'),out=path.join(__dirname,'evidencias'),workspace=path.join(out,'workspace'),mode=process.argv[2];
const backend=path.join(workspace,'gai-backend'),frontend=path.join(workspace,'gai-frontend');
function run(name,cwd,args,env={}){
  fs.mkdirSync(path.join(out,name),{recursive:true});
  const fd=fs.openSync(path.join(out,name+'.log'),'w'),start=Date.now();
  const r=spawnSync(process.execPath,args,{cwd,env:{...process.env,GAI_TEST_MYSQL_WAVE2:'1',GAI_TEST_EVIDENCE_DIR:path.join(out,name),...env},stdio:['ignore',fd,fd]});fs.closeSync(fd);
  const item={name,cwd,command:['node',...args],exit_code:r.status,seconds:(Date.now()-start)/1000,error:r.error?.message};
  fs.writeFileSync(path.join(out,name+'-result.json'),JSON.stringify(item,null,2));console.log(JSON.stringify(item));return item;
}
if(mode==='sync'){
  for(const part of ['gai-backend','gai-frontend']){
    const source=path.join(root,part),target=path.join(workspace,part);
    if(fs.existsSync(path.join(source,'.prettierrc')))fs.copyFileSync(path.join(source,'.prettierrc'),path.join(target,'.prettierrc'));
    for(const name of ['src','test','scripts','third-party','vendor','public','e2e','specs'])if(fs.existsSync(path.join(source,name)))fs.cpSync(path.join(source,name),path.join(target,name),{recursive:true});
    for(const name of fs.readdirSync(source))if(fs.statSync(path.join(source,name)).isFile()&&/\.(json|ts|cjs|mjs|js|html|css)$/.test(name))fs.copyFileSync(path.join(source,name),path.join(target,name));
  }
  console.log('Current source synced to isolated locked dependency trees');
}else if(mode==='native'){
  const fd=fs.openSync(path.join(out,'sqlite-native-rebuild.log'),'w'),start=Date.now();
  const r=spawnSync('npm.cmd',['rebuild','sqlite3','--foreground-scripts'],{cwd:backend,shell:true,stdio:['ignore',fd,fd]});fs.closeSync(fd);
  fs.writeFileSync(path.join(out,'sqlite-native-rebuild.json'),JSON.stringify({exit_code:r.status,seconds:(Date.now()-start)/1000},null,2));console.log('sqlite rebuild exit',r.status);process.exitCode=r.status||0;
}else if(mode==='coverage'){
  const r=run(mode,backend,['test/run-tests.cjs','default','--coverage','--json','--outputFile='+path.join(out,'coverage-jest.json')]);process.exitCode=r.exit_code||0;
}else if(['unit','sqlite','default','mysql','s3','e2e'].includes(mode)){
  const r=run(mode,backend,['test/run-tests.cjs',mode,...process.argv.slice(3),...(mode==='e2e'?[]:['--json','--outputFile='+path.join(out,mode+'-jest.json')])]);process.exitCode=r.exit_code||0;
}else if(mode==='preflight'){
  const r=run(mode,backend,['test/run-tests.cjs','mysql','--runTestsByPath','test/integration/technical-validation/temporal-integrity.mysql.e2e-spec.ts','test/integration/technical-validation/generated-metadata.mysql.e2e-spec.ts','test/integration/technical-validation/specialized-exports.mysql.e2e-spec.ts','test/integration/payments-expenses/payment-integrity.mysql.e2e-spec.ts','--json','--outputFile='+path.join(out,'preflight-jest.json')]);process.exitCode=r.exit_code||0;
}else if(mode==='frontend'){
  const r=run(mode,frontend,['node_modules/vitest/vitest.mjs','run','--config','vitest.config.ts','--reporter=json','--outputFile='+path.join(out,'frontend-vitest.json')]);process.exitCode=r.exit_code||0;
}else if(mode==='backend-checks'||mode==='frontend-checks'){
  const checks=mode==='backend-checks'?[
    ['backend-typescript',backend,['node_modules/typescript/bin/tsc','--noEmit','--incremental','false']],
    ['backend-build',backend,['node_modules/@nestjs/cli/bin/nest.js','build']],
    ['backend-lint',backend,['node_modules/eslint/bin/eslint.js','{src,apps,libs,test}/**/*.ts','--format','json','--output-file',path.join(out,'backend-eslint.json')]],
  ]:[
    ['frontend-typescript',frontend,['node_modules/typescript/bin/tsc','-p','tsconfig.app.json','--noEmit','--incremental','false']],
    ['frontend-node-typescript',frontend,['node_modules/typescript/bin/tsc','-p','tsconfig.node.json','--noEmit','--incremental','false']],
    ['frontend-build',frontend,['node_modules/vite/bin/vite.js','build']],
    ['frontend-lint',frontend,['node_modules/eslint/bin/eslint.js','.','--format','json','--output-file',path.join(out,'frontend-eslint.json')]],
  ];const result=[];for(const c of checks)result.push(run(...c));fs.writeFileSync(path.join(out,mode+'.json'),JSON.stringify(result,null,2));process.exitCode=result.some(r=>r.exit_code!==0)?1:0;
}else throw Error('Unknown mode');
