const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../..'),out=path.join(__dirname,'evidencias');
process.env.NODE_ENV='test';process.env.GAI_TEST_MYSQL_DISPOSABLE='1';process.env.TS_NODE_PROJECT=path.join(root,'gai-backend/tsconfig.json');
require(path.join(root,'gai-backend/node_modules/ts-node/register/transpile-only'));
require(path.join(root,'gai-backend/node_modules/reflect-metadata'));
const inv=require('./evidencias/inventory.json');
const {PERMISSION_SEEDS}=require(path.join(root,'gai-backend/src/scripts/seed/permissions.seed.ts'));
const {PERMISSIONS_KEY}=require(path.join(root,'gai-backend/src/modules/auth/presentation/decorators/require-permissions.decorator.ts'));
const {PATH_METADATA,METHOD_METADATA,GUARDS_METADATA}=require(path.join(root,'gai-backend/node_modules/@nestjs/common/constants'));
const {RequestMethod}=require(path.join(root,'gai-backend/node_modules/@nestjs/common'));
const routes=[];
for(const file of [...new Set(inv.classes.filter(c=>c.kind==='controller').map(c=>c.file))]){
 const exports=require(path.join(root,file));
 for(const c of Object.values(exports)){
  if(typeof c!=='function'||!c.prototype||Reflect.getMetadata(PATH_METADATA,c)===undefined)continue;
  const base=Reflect.getMetadata(PATH_METADATA,c),classGuards=Reflect.getMetadata(GUARDS_METADATA,c)||[],classPermissions=Reflect.getMetadata(PERMISSIONS_KEY,c)||[];
  for(const method of Object.getOwnPropertyNames(c.prototype)){
   const fn=c.prototype[method];if(typeof fn!=='function')continue;
   const verb=Reflect.getMetadata(METHOD_METADATA,fn);if(verb===undefined)continue;
   const route=Reflect.getMetadata(PATH_METADATA,fn),permissions=Reflect.getMetadata(PERMISSIONS_KEY,fn)??classPermissions;
   routes.push({file,controller:c.name,method,verb:RequestMethod[verb],path:'/api/v1/'+[base,route].filter(x=>x&&x!=='/').join('/'),permissions,guards:[...classGuards,...(Reflect.getMetadata(GUARDS_METADATA,fn)||[])].map(x=>x.name),unknown:permissions.filter(k=>!PERMISSION_SEEDS.some(p=>p.key===k))});
  }
 }
}
fs.writeFileSync(path.join(out,'rbac-runtime.json'),JSON.stringify({catalog:PERMISSION_SEEDS,routes},null,2));
console.log(JSON.stringify({catalog:PERMISSION_SEEDS.length,routes:routes.length,unknown:routes.filter(r=>r.unknown.length),unguarded:routes.filter(r=>!r.guards.length).map(r=>({verb:r.verb,path:r.path}))}));
