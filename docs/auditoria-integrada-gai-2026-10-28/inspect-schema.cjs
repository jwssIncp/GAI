const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../..'),out=path.join(__dirname,'evidencias');
process.env.NODE_ENV='test';process.env.GAI_TEST_MYSQL_DISPOSABLE='1';process.env.TS_NODE_PROJECT=path.join(root,'gai-backend/tsconfig.json');
require(path.join(root,'gai-backend/node_modules/ts-node/register/transpile-only'));require(path.join(root,'gai-backend/node_modules/reflect-metadata'));
const {DataSource}=require(path.join(root,'gai-backend/node_modules/typeorm'));
const ds=new DataSource({type:'mysql',host:'127.0.0.1',port:33317,username:'root',password:'gai-validation-only',database:'gai_validation_disposable',charset:'utf8mb4',extra:{bigNumberStrings:false},entities:[path.join(root,'gai-backend/src/**/*.entity.ts')],migrations:[path.join(root,'gai-backend/src/migrations/*.ts')],synchronize:false,migrationsRun:false});
(async()=>{await ds.initialize();try{
 const qr=ds.createQueryRunner();let introspection_error=null,tables;
 try{tables=await qr.getTables();}catch(error){introspection_error={message:error.message,code:error.code};
  const cols=await ds.query('SELECT TABLE_NAME,COLUMN_NAME,DATA_TYPE,COLUMN_TYPE,IS_NULLABLE,COLUMN_DEFAULT,CHARACTER_MAXIMUM_LENGTH,NUMERIC_PRECISION,NUMERIC_SCALE,DATETIME_PRECISION,COLUMN_KEY,EXTRA,GENERATION_EXPRESSION FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() ORDER BY TABLE_NAME,ORDINAL_POSITION');
  const idx=await ds.query('SELECT TABLE_NAME,INDEX_NAME,NON_UNIQUE,SEQ_IN_INDEX,COLUMN_NAME FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() ORDER BY TABLE_NAME,INDEX_NAME,SEQ_IN_INDEX');
  const keys=await ds.query('SELECT TABLE_NAME,CONSTRAINT_NAME,COLUMN_NAME,REFERENCED_TABLE_NAME,REFERENCED_COLUMN_NAME FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA=DATABASE() ORDER BY TABLE_NAME,CONSTRAINT_NAME,ORDINAL_POSITION');
  const constraints=await ds.query('SELECT TABLE_NAME,CONSTRAINT_NAME,CONSTRAINT_TYPE FROM information_schema.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA=DATABASE()');
  tables=[...new Set(cols.map(c=>c.TABLE_NAME))].map(name=>({name,columns:cols.filter(c=>c.TABLE_NAME===name).map(c=>({name:c.COLUMN_NAME,type:c.DATA_TYPE,length:c.CHARACTER_MAXIMUM_LENGTH,precision:c.NUMERIC_PRECISION??c.DATETIME_PRECISION,scale:c.NUMERIC_SCALE,isNullable:c.IS_NULLABLE==='YES',isPrimary:c.COLUMN_KEY==='PRI',default:c.COLUMN_DEFAULT,generated:c.GENERATION_EXPRESSION})),indices:idx.filter(c=>c.TABLE_NAME===name),foreignKeys:keys.filter(c=>c.TABLE_NAME===name&&c.REFERENCED_TABLE_NAME),uniques:constraints.filter(c=>c.TABLE_NAME===name&&c.CONSTRAINT_TYPE==='UNIQUE'),checks:constraints.filter(c=>c.TABLE_NAME===name&&c.CONSTRAINT_TYPE==='CHECK')}));
 }
 const missing=[],differences=[];
 for(const entity of ds.entityMetadatas){const table=tables.find(t=>t.name===entity.tableName);if(!table){missing.push({table:entity.tableName});continue;}
  for(const c of entity.columns){const db=table.columns.find(x=>x.name===c.databaseName);if(!db){missing.push({table:entity.tableName,column:c.databaseName});continue;}
   if(c.isNullable!==db.isNullable)differences.push({table:table.name,column:c.databaseName,property:'nullable',entity:c.isNullable,database:db.isNullable});
   if(c.precision!=null&&Number(c.precision)!==Number(db.precision))differences.push({table:table.name,column:c.databaseName,property:'precision',entity:c.precision,database:db.precision});
   if(c.scale!=null&&Number(c.scale)!==Number(db.scale))differences.push({table:table.name,column:c.databaseName,property:'scale',entity:c.scale,database:db.scale});
  }
 }
 const migrations=await ds.query('SELECT id,timestamp,name FROM migrations ORDER BY id');
 let proposed_schema_queries=[],schema_log_error=null;
 try{proposed_schema_queries=(await ds.driver.createSchemaBuilder().log()).upQueries.map(q=>q.query);}catch(error){schema_log_error={message:error.message,code:error.code};}
 const catalog=tables.map(t=>({table:t.name,columns:t.columns.map(c=>({name:c.name,type:c.type,length:c.length,precision:c.precision,scale:c.scale,nullable:c.isNullable,primary:c.isPrimary,default:c.default})),indices:t.indices,foreignKeys:t.foreignKeys,uniques:t.uniques,checks:t.checks}));
 const result={target:'127.0.0.1:33317/gai_validation_disposable',read_only:true,entity_tables:ds.entityMetadatas.length,database_tables:tables.length,missing,differences,migrations,pending_migrations:await ds.showMigrations(),introspection_error,schema_log_error,proposed_schema_queries,catalog};
 fs.writeFileSync(path.join(out,'schema.json'),JSON.stringify(result,null,2));console.log(JSON.stringify({entity_tables:result.entity_tables,database_tables:result.database_tables,missing,differences,migrations:migrations.length,pending_migrations:result.pending_migrations,proposed_schema_queries:result.proposed_schema_queries.length}));await qr.release();
}finally{await ds.destroy();}})().catch(e=>{console.error(e);process.exitCode=1});
