// Wait for the current MySQL lane to finish before touching its disposable DB.
const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
const out=path.join(__dirname,'evidencias'),minimum=Number(process.argv[2]||0),deadline=Date.now()+30*60*1000;
const resultFile=path.join(out,'mysql-result.json'),logFile=path.join(out,'mysql.log');
const results=[];
function run(name,args){const fd=fs.openSync(path.join(out,'post-'+name+'.log'),'w'),start=Date.now();const r=spawnSync(process.execPath,args,{cwd:path.resolve(__dirname,'../..'),stdio:['ignore',fd,fd]});fs.closeSync(fd);results.push({name,command:['node',...args],exit_code:r.status,seconds:(Date.now()-start)/1000});console.log(JSON.stringify(results.at(-1)));if(r.status!==0)throw Error(name+' failed; inspect post-'+name+'.log')}
(async()=>{
  while(true){
    const lanes=minimum?['mysql','unit','sqlite','default','coverage','s3']:['mysql'];
    let ready=true;
    for(const lane of lanes){const result=path.join(out,lane+'-result.json'),log=path.join(out,lane+'.log');if(!fs.existsSync(result)||fs.statSync(result).mtimeMs<minimum||fs.statSync(result).mtimeMs<fs.statSync(log).mtimeMs){ready=false;continue}if(JSON.parse(fs.readFileSync(result)).exit_code!==0)throw Error(lane+' lane failed; post-checks not started')}
    if(ready&&(!minimum||fs.statSync(path.join(out,'backend-checks.json')).mtimeMs>=minimum))break;
    if(Date.now()>deadline)throw Error('MySQL lane still running; no post-check was started');
    await new Promise(resolve=>setTimeout(resolve,10000));
  }
  run('related-http',[path.join(__dirname,'smoke-related.cjs')]);
  run('schema-final',[path.join(__dirname,'inspect-schema.cjs')]);
  run('snapshot-final',[path.join(__dirname,'save-database.cjs'),'final']);
  run('runtime-final',[path.join(__dirname,'capture-runtime.cjs')]);
  fs.writeFileSync(path.join(out,'post-checks.json'),JSON.stringify(results,null,2));
  const r=spawnSync(process.execPath,[path.join(__dirname,'finish.cjs')],{cwd:path.resolve(__dirname,'../..'),env:{...process.env,GIT_OPTIONAL_LOCKS:'0'},stdio:'inherit'});process.exitCode=r.status??1;
})().catch(error=>{fs.writeFileSync(path.join(out,'post-checks.json'),JSON.stringify({error:error.message,results},null,2));console.error(error.message);process.exitCode=1});
