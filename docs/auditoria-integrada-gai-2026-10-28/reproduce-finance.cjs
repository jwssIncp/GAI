const path=require('node:path'),fs=require('node:fs'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../..');
process.env.NODE_ENV='test';process.env.GAI_TEST_MYSQL_DISPOSABLE='0';process.env.TS_NODE_PROJECT=path.join(root,'gai-backend/tsconfig.json');
require(path.join(root,'gai-backend/node_modules/ts-node/register/transpile-only'));
const request=require(path.join(root,'gai-backend/node_modules/supertest'));
const {createTestApp,seedTestData,loginAsOrgAdmin}=require(path.join(root,'gai-backend/test/integration/test-app.helper.ts'));
(async()=>{const app=await createTestApp();try{
  await seedTestData(app);const token=await loginAsOrgAdmin(app),http=app.getHttpServer();
  const post=async(url,body)=>{const r=await request(http).post('/api/v1'+url).auth(token,{type:'bearer'}).send(body);assert.ok(r.status<300,JSON.stringify({url,status:r.status,body:r.body}));return r.body;};
  const project=await post('/projects',{organization_id:1,company_id:1,name:'SINTETICO Auditoria 101 pagamentos'});
  const agent=await post('/field-agents',{name:'SINTETICO Auditoria'});await post(`/projects/${project.id}/field-agents`,{field_agent_id:agent.id});
  for(let i=0;i<101;i++)await post(`/projects/${project.id}/payments`,{field_agent_id:agent.id,start_date:'2026-10-28',end_date:'2026-10-28',daily_rate:'1.00',notes:'SINTETICO '+i});
  const summary=await request(http).get(`/api/v1/projects/${project.id}/payments/summary`).auth(token,{type:'bearer'});
  assert.equal(summary.status,200);assert.equal(summary.body.total_count,101);assert.equal(summary.body.total_pending,'100.00');
  const invalidDate=await post(`/projects/${project.id}/expenses`,{description:'SINTETICO data civil inexistente',expense_date:'2026-02-30',amount:'1.00'});
  const result={environment:'SQLite :memory:, HTTP Nest real, no API mocks',case:'101 distinct payments of 1.00',expected:{total_count:101,total_pending:'101.00'},actual:summary.body,confirmed:true,invalid_civil_date:{input:'2026-02-30',actual:invalidDate,expected_status:400,actual_status:201}};
  fs.writeFileSync(path.join(__dirname,'evidencias/finance-reproduction.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}finally{await app.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
