const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const hash=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const out=path.join(__dirname,'evidencias'),root=path.resolve(__dirname,'../..');
const result={captured_at:new Date().toISOString(),node:process.version,platform:process.platform,arch:process.arch,host_timezone:Intl.DateTimeFormat().resolvedOptions().timeZone,isolated_installs:true,projects:{}};
for(const part of ['gai-backend','gai-frontend']) {
  const base=path.join(out,'workspace',part),lock=JSON.parse(fs.readFileSync(path.join(base,'package-lock.json')));
  if(hash(path.join(base,'package-lock.json'))!==hash(path.join(root,part,'package-lock.json')))throw Error('Isolated lock differs: '+part);
  const versions={};
  for(const name of ['@nestjs/common','@nestjs/core','@nestjs/platform-express','express','body-parser','multer','proxy-addr','qs','mysql2','typeorm','xlsx','sqlite3','argon2','axios','react-router','react-router-dom','zod','vite','vitest']) {
    const p=path.join(base,'node_modules',name,'package.json');if(fs.existsSync(p))versions[name]=JSON.parse(fs.readFileSync(p)).version;
  }
  result.projects[part]={lock_sha256:hash(path.join(base,'package-lock.json')),versions,lock_package_count:Object.keys(lock.packages).length};
  if(part==='gai-backend')for(const name of ['sqlite3','argon2','mysql2','typeorm','xlsx'])require(path.join(base,'node_modules',name));
}
const tar=path.join(root,'gai-backend/vendor/xlsx-0.20.3.tgz');result.sheetjs={bytes:fs.statSync(tar).size,sha256:hash(tar)};
fs.writeFileSync(path.join(out,'runtime-final.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
