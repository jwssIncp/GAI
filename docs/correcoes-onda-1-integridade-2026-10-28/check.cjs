const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'../..'),out=path.join(__dirname,'evidencias'),name=process.argv[2];
const checks={
 'baseline-unit':['gai-backend',['node_modules/jest/bin/jest.js','--runInBand','--testPathIgnorePatterns=test/integration','--json','--outputFile='+path.join(out,'baseline-unit.json')]],
 'baseline-backend-lint':['gai-backend',['node_modules/eslint/bin/eslint.js','{src,apps,libs,test}/**/*.ts','--format','json','--output-file',path.join(out,'baseline-backend-eslint.json')]],
 'baseline-frontend-lint':['gai-frontend',['node_modules/eslint/bin/eslint.js','.','--format','json','--output-file',path.join(out,'baseline-frontend-eslint.json')]],
};
if(!checks[name])throw Error('Unknown check');
const [dir,args]=checks[name],fd=fs.openSync(path.join(out,name+'.log'),'w'),start=Date.now();
const r=spawnSync(process.execPath,args,{cwd:path.join(root,dir),env:{...process.env,GAI_TEST_MYSQL_DISPOSABLE:'0',GAI_TEST_S3_DISPOSABLE:'0'},stdio:['ignore',fd,fd]});fs.closeSync(fd);
const result={name,exit_code:r.status,seconds:(Date.now()-start)/1000,command:args};fs.writeFileSync(path.join(out,name+'-result.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));process.exitCode=r.status||0;
