const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
const out=path.join(__dirname,'evidencias');
for(const part of ['gai-backend','gai-frontend']) {
  const cwd=path.join(out,'workspace',part);
  for(const [name,args] of [['audit-after',['audit','--omit=dev','--package-lock-only','--json']],['audit-full-after',['audit','--package-lock-only','--json']],['installed-after',['ls','--all','--json']]]) {
    const result=spawnSync('npm.cmd',args,{cwd,shell:true,encoding:'utf8',maxBuffer:32*1024*1024});
    fs.writeFileSync(path.join(out,part+'-'+name+'.json'),result.stdout||'');
    fs.writeFileSync(path.join(out,part+'-'+name+'.stderr'),result.stderr||'');
    console.log(JSON.stringify({part,name,exit_code:result.status,error:result.error?.message}));
  }
}
