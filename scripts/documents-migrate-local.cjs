// Apply only this additive migration, after checking the local destination.
const fs=require('node:fs'),path=require('node:path'),backend=path.resolve(__dirname,'../gai-backend');
const env=require(path.join(backend,'node_modules/dotenv')).parse(fs.readFileSync(path.join(backend,'.env')));
if(env.NODE_ENV!=='local'||!['localhost','127.0.0.1','::1'].includes(env.DB_HOST)||Number(env.DB_PORT||3306)!==3306||env.DB_DATABASE!=='gai') throw Error('Expected NODE_ENV=local and loopback:3306/gai. No database was accessed.');
Object.assign(process.env,env);process.env.TS_NODE_PROJECT=path.join(backend,'tsconfig.json');
require(path.join(backend,'node_modules/ts-node/register/transpile-only'));
const ds=require(path.join(backend,'data-source.ts')).default;
(async()=>{
  await ds.initialize();
  try {
    const applied=new Set((await ds.query('SELECT name FROM migrations')).map(r=>r.name));
    const pending=ds.migrations.filter(m=>!applied.has(m.name||m.constructor.name));
    if(!pending.length){console.log('Local schema already current.');return;}
    if(pending.length!==1||(pending[0].name||pending[0].constructor.name)!=='CreateProfessionalDocuments1793900000002')throw Error('Unexpected pending migrations. Review the local schema first.');
    const [target]=await ds.query('SELECT DATABASE() AS db, VERSION() AS version');
    console.log(JSON.stringify({environment:env.NODE_ENV,host:env.DB_HOST,port:3306,database:target.db,mysql:target.version,pending:'CreateProfessionalDocuments1793900000002'}));
    const done=await ds.runMigrations({transaction:'each'});
    console.log(JSON.stringify({applied:done.map(m=>m.name)}));
  }finally{await ds.destroy();}
})().catch(error=>{console.error(error.message);process.exitCode=1});
