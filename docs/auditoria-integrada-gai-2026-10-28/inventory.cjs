const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const root = path.resolve(__dirname, '../..'), out = path.join(__dirname, 'evidencias');
fs.mkdirSync(out, { recursive: true });
function walk(dir) { return fs.readdirSync(path.join(root, dir), {withFileTypes:true}).flatMap(e => ['node_modules','dist','.git','.terraform','coverage','test-results','playwright-report','auditoria-integrada-gai-2026-10-28'].includes(e.name) ? [] : e.isDirectory() ? walk(dir+'/'+e.name) : [dir+'/'+e.name]); }
const files = ['gai-backend','gai-frontend','docs','infra','scripts','.github'].flatMap(walk);
const texts = new Map(files.filter(f=>/\.(ts|tsx|md|cjs|json|tf|yml|yaml|ps1)$/.test(f) && !f.includes('package-lock')).map(f=>[f,fs.readFileSync(path.join(root,f),'utf8')]));
const manifest = [...texts].map(([file,s])=>({file,lines:s.split('\n').length,sha256:crypto.createHash('sha256').update(s).digest('hex')}));
const classes=[], routes=[], migrations=[], tests=[];
for(const [file,s] of texts){
  for(const m of s.matchAll(/(?:export\s+)?(?:abstract\s+)?class\s+(\w+)/g)) classes.push({file,line:s.slice(0,m.index).split('\n').length,name:m[1],kind:/controller\.ts$/.test(file)?'controller':/@Entity\(/.test(s)?'entity':/service\.ts$/.test(file)?'service':/module\.ts$/.test(file)?'module':'class'});
  if(file.endsWith('controller.ts')) {
    const prefix=s.match(/@Controller\(([^)]*)\)/)?.[1]??'';
    for(const m of s.matchAll(/@(Get|Post|Patch|Put|Delete)\(([^)]*)\)/g)) {
      const following=s.slice(m.index, m.index+1200),permission=following.match(/@RequirePermissions\(([^)]*)\)/)?.[1]??'',method=following.match(/\n\s*(?:async\s+)?(\w+)\(/)?.[1];
      routes.push({file,line:s.slice(0,m.index).split('\n').length,verb:m[1],prefix,route:m[2],permission,method});
    }
  }
  if(file.startsWith('gai-backend/src/migrations/')) migrations.push({file,up:/async up|up\(/.test(s),down:/async down|down\(/.test(s),tables:[...s.matchAll(/CREATE TABLE\s+(?:IF NOT EXISTS\s+)?[`"']?([\w]+)/gi)].map(m=>m[1]),foreign_keys:(s.match(/FOREIGN KEY/gi)||[]).length,checks:(s.match(/CHECK\s*\(/gi)||[]).length,indexes:(s.match(/(?:UNIQUE KEY|CREATE (?:UNIQUE )?INDEX|ADD (?:UNIQUE )?INDEX|\bKEY `)/gi)||[]).length});
  if(/(?:spec|test)\.[cm]?[jt]sx?$/.test(file)) tests.push({file,titles:[...s.matchAll(/\b(?:it|test)\s*(?:\.\w+)?\s*\(\s*['"`]([^'"`]+)/g)].map(m=>m[1])});
}
const deps=Object.fromEntries(['gai-backend','gai-frontend'].map(d=>[d,JSON.parse(texts.get(d+'/package.json'))]));
fs.writeFileSync(path.join(out,'inventory.json'),JSON.stringify({manifest,classes,routes,migrations,tests,deps},null,2));
fs.writeFileSync(path.join(out,'reports-read.txt'),[...texts].filter(([f])=>f.startsWith('docs/')&&f.endsWith('.md')).map(([f,s])=>`\n## ${f}\n${s}`).join('\n'));
console.log(JSON.stringify({files:files.length,texts:texts.size,classes:classes.length,routes:routes.length,migrations:migrations.length,tests:tests.length,modules:fs.readdirSync(path.join(root,'gai-backend/src/modules')),reports:[...texts.keys()].filter(f=>f.startsWith('docs/')&&f.endsWith('.md')).length}));
