// Read-only comparison, exclusively against the disposable Wave 1 database.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const backend=path.join(__dirname,'evidencias/workspace/gai-backend');
Object.assign(process.env,{NODE_ENV:'test',DB_TYPE:'mysql',GAI_TEST_MYSQL_DISPOSABLE:'1',GAI_TEST_MYSQL_WAVE1:'1',TS_NODE_PROJECT:path.join(backend,'tsconfig.json')});
require(path.join(backend,'node_modules/ts-node/register/transpile-only'));
const {DataSource}=require(path.join(backend,'node_modules/typeorm'));
const {createTestApp}=require(path.join(backend,'test/integration/test-app.helper.ts'));
(async()=>{const app=await createTestApp(undefined,{reuseDisposableDatabase:true});try {
  const ds=app.get(DataSource),q=ds.createQueryRunner(),hash=v=>crypto.createHash('sha256').update(JSON.stringify(v)).digest('hex');
  const snapshot=async()=>{const r={};for(const t of ['field_agent_payments','expenses','payment_expense_audit_logs','project_field_agents'])r[t]=await ds.query('SELECT * FROM '+t+' ORDER BY id');return hash(r)};
  const before=await snapshot();try {
    const rows=await ds.query('SELECT TABLE_NAME name FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() ORDER BY TABLE_NAME');
    const tables=await q.getTables(rows.map(r=>r.name));
    const assignments=tables.find(t=>t.name==='project_field_agents'),generated=assignments.columns.find(c=>c.name==='active_assignment_key');
    assert.equal(generated.generatedType,'STORED');assert.ok(assignments.indices.some(i=>i.name==='uq_project_field_agents_active_key'&&i.isUnique));
    const metadata=await ds.query("SELECT * FROM typeorm_metadata WHERE type='GENERATED_COLUMN' AND `schema`=DATABASE() AND `table`='project_field_agents' AND name='active_assignment_key'");assert.equal(metadata.length,1);
    const migrations=await ds.query('SELECT * FROM migrations ORDER BY id');assert.equal(migrations.length,33);assert.equal(await ds.showMigrations(),false);
    const diff=await ds.driver.createSchemaBuilder().log(),queries=diff.upQueries.map(x=>x.query);
    assert.equal(queries.filter(s=>/active_assignment_key|uq_project_field_agents_active_key/.test(s)&&/\b(DROP|CHANGE|MODIFY)\b/i.test(s)).length,0);
    const physicalColumn=await ds.query("SELECT GENERATION_EXPRESSION expression,EXTRA extra FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='project_field_agents' AND COLUMN_NAME='active_assignment_key'");
    assert.match(physicalColumn[0].expression,/concat/i);assert.match(physicalColumn[0].extra,/STORED/i);
    const createTable=await ds.query('SHOW CREATE TABLE project_field_agents');
    const after=await snapshot();assert.equal(before,after);
    const result={target:'127.0.0.1:33337/gai_validation_disposable',application_table_count:tables.length,entities:ds.entityMetadatas.length,migrations,pending:false,generated,metadata,physical_generated_column:physicalColumn,physical_create_table:createTable,index:assignments.indices.find(i=>i.name==='uq_project_field_agents_active_key'),date_columns:ds.entityMetadatas.flatMap(m=>m.columns.filter(c=>c.type==='date').map(c=>({table:m.tableName,column:c.databaseName,transformer:!!c.transformer}))),financial_hash_before:before,financial_hash_after:after,unapplied_schema_queries:queries};
    assert.ok(result.date_columns.every(c=>c.transformer));
    fs.writeFileSync(path.join(__dirname,'evidencias/schema-final.json'),JSON.stringify(result,null,2));console.log(JSON.stringify({tables:tables.length,migrations:migrations.length,date_columns:result.date_columns.length,unapplied_queries:queries.length,financial_unchanged:before===after}));
  }finally{await q.release()}
}finally{await app.close()}})().catch(e=>{console.error(e);process.exitCode=1});
