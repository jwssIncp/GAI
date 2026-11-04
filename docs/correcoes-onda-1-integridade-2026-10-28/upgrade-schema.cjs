const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');const root=path.resolve(__dirname,'../..');
process.env.NODE_ENV='test';process.env.DB_TYPE='mysql';process.env.GAI_TEST_MYSQL_DISPOSABLE='1';process.env.GAI_TEST_MYSQL_WAVE1='1';process.env.TS_NODE_PROJECT=path.join(root,'gai-backend/tsconfig.json');
require(path.join(root,'gai-backend/node_modules/ts-node/register/transpile-only'));
const {DataSource}=require(path.join(root,'gai-backend/node_modules/typeorm'));
const {createTestApp}=require(path.join(root,'gai-backend/test/integration/test-app.helper.ts'));
(async()=>{const app=await createTestApp(undefined,{reuseDisposableDatabase:true});try{const ds=app.get(DataSource);
const snapshot=async()=>{const rows={};for(const table of ['field_agent_payments','expenses','payment_expense_audit_logs'])rows[table]=await ds.query('SELECT * FROM '+table+' ORDER BY id');return rows;};
const before=await snapshot(),hash=v=>crypto.createHash('sha256').update(JSON.stringify(v)).digest('hex');
const applied=await ds.runMigrations();assert.deepEqual(applied.map(m=>m.name),['RegisterGeneratedColumnMetadata1794000000001']);
const qr=ds.createQueryRunner();try{const tables=await qr.getTables();const t=tables.find(t=>t.name==='project_field_agents');const generated=t.columns.find(c=>c.name==='active_assignment_key');assert.ok(generated.asExpression.includes('CONCAT'));assert.equal(generated.generatedType,'STORED');assert.ok(t.indices.some(i=>i.name==='uq_project_field_agents_active_key'&&i.isUnique));
const diff=await ds.driver.createSchemaBuilder().log();const queries=diff.upQueries.map(q=>q.query);assert.equal(queries.filter(q=>q.includes('active_assignment_key')&&/\b(DROP|CHANGE|MODIFY)\b/i.test(q)).length,0);
const after=await snapshot();assert.equal(hash(before),hash(after));const result={target:'127.0.0.1:33337',applied:applied.map(m=>m.name),pending:await ds.showMigrations(),tables:tables.length,generated,index:t.indices.find(i=>i.name==='uq_project_field_agents_active_key'),financial_hash_before:hash(before),financial_hash_after:hash(after),unapplied_schema_queries:queries};fs.writeFileSync(path.join(__dirname,'evidencias/schema-upgrade.json'),JSON.stringify(result,null,2));console.log(JSON.stringify({applied:result.applied,tables:result.tables,pending:result.pending,financial_unchanged:true,unapplied_queries:queries.length}));}finally{await qr.release();}
}finally{await app.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
