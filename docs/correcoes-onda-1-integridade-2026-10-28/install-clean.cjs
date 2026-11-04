const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
const part=process.argv[2];if(!['backend','frontend'].includes(part))throw Error('Invalid tree');
const out=path.join(__dirname,'evidencias'),cwd=path.resolve(out,'workspace','gai-'+part);
if(!cwd.startsWith(path.resolve(out,'workspace')+path.sep))throw Error('Unsafe validation tree');
const fd=fs.openSync(path.join(out,part+'-clean-install-final.log'),'w'),start=Date.now();
const r=spawnSync('npm.cmd',['ci','--offline','--ignore-scripts','--no-audit','--no-fund'],{cwd,shell:true,stdio:['ignore',fd,fd]});fs.closeSync(fd);
const result={part,cwd,command:'npm ci --offline --ignore-scripts --no-audit --no-fund',exit_code:r.status,seconds:(Date.now()-start)/1000};fs.writeFileSync(path.join(out,part+'-clean-install.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));process.exitCode=r.status||0;
