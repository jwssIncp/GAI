const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../..');
process.env.NODE_ENV = 'test'; process.env.GAI_TEST_MYSQL_DISPOSABLE = '1'; process.env.GAI_TEST_MYSQL_WAVE0 = '1';
process.env.TS_NODE_PROJECT = path.join(root, 'gai-backend/tsconfig.json');
require(path.join(root, 'gai-backend/node_modules/ts-node/register/transpile-only'));
const { createTestApp } = require(path.join(root, 'gai-backend/test/integration/test-app.helper.ts'));
const { runtime } = require('./probe.cjs');
(async () => {
  const app = await createTestApp(undefined, { reuseDisposableDatabase: true }); let r;
  const results = [];
  try {
    await app.listen(0, '127.0.0.1'); r = await runtime((await app.getUrl()) + '/api/v1');
    async function api(method, url, body, status = 200) { const result=await r.api(method,url,body); results.push({method,url,...result}); assert.equal(result.status,status,JSON.stringify(result)); return result.body; }
    const f=await r.fixture(), base=`/projects/${f.project}`, p=await r.payment(f,'33.33');
    await api('POST',r.url(f,p)+'/approve',{}); await api('POST',r.url(f,p)+'/mark-as-paid',{});
    const expense=await api('POST',base+'/expenses',{field_agent_id:f.agent,description:'SINTETICO regressao prestacao',expense_date:'2026-10-28',amount:'25.50'},201);
    await api('POST',base+`/expenses/${expense.id}/approve`,{});
    const installments=await api('POST',base+`/expenses/${expense.id}/installments/generate`,{count:3,first_due_date:'2026-11-30'},201);
    assert.equal(installments.length,3); assert.deepEqual(installments.map(i=>i.amount),['8.50','8.50','8.50']);
    const accountability=await api('POST',base+'/expense-accountabilities',{field_agent_id:f.agent,period_start:'2026-10-01',period_end:'2026-10-31',notes:'SINTETICO ONDA0'},201);
    await api('POST',base+`/expense-accountabilities/${accountability.id}/expenses`,{expense_id:expense.id});
    const closed=await api('POST',base+`/expense-accountabilities/${accountability.id}/close`,{});
    assert.equal(closed.status,'closed'); assert.equal(closed.total_amount,'25.50'); assert.deepEqual(closed.expense_ids,[expense.id]);
    const detail=await api('GET',base+`/expense-accountabilities/${accountability.id}`);
    assert.equal(detail.total_amount,'25.50');
    const before=await api('GET',`/finance/cash-flow?project_id=${f.project}&direction=out`);
    assert.equal(before.totals[0].actual_out,'33.33'); assert.equal(before.totals[0].expected_out,'25.50'); assert.equal(before.movements.length,4);
    await api('POST',base+`/expenses/${expense.id}/mark-as-paid`,{});
    const after=await api('GET',`/finance/cash-flow?project_id=${f.project}&direction=out`);
    assert.equal(after.totals[0].actual_out,'58.83'); assert.equal(after.totals[0].expected_out,'0.00'); assert.equal(after.movements.length,2);
    const summary=await api('GET',base+'/summary?include_financial=true'); assert.equal(summary.financial.total_payment_amount,'33.33'); assert.equal(summary.financial.total_expense_amount,'25.50'); assert.equal(summary.financial.financial_total_amount,'58.83');
    const paymentSummary=await api('GET',base+'/payments/summary'); assert.equal(paymentSummary.total_paid,'33.33'); assert.equal(paymentSummary.total_count,1);
    const overview=await api('GET','/organization-overview?company_id=1'); assert.ok(overview.total_projects>0);
    const projects=await api('GET','/organization-overview/projects?company_id=1&sort=id&direction=DESC&page_size=100');
    assert.ok((projects.items || projects.projects).some(x=>Number(x.id)===f.project));
    const [audits]=await r.db.query('SELECT * FROM expense_accountability_audit_logs WHERE accountability_id=? ORDER BY id',[accountability.id]);
    assert.ok(audits.some(a=>a.operation==='CLOSE' && Number(a.performed_by)===2));
    fs.writeFileSync(path.join(__dirname,'evidencias/related-http.json'),JSON.stringify({passed:true,project:f.project,payment:p.id,expense:expense.id,accountability:accountability.id,results,audits},null,2));
    console.log(JSON.stringify({passed:true,http_asserted:results.length,project:f.project,accountability:accountability.id}));
  } catch(error) {
    fs.writeFileSync(path.join(__dirname,'evidencias/related-http-failure.json'),JSON.stringify({message:error.message,results},null,2)); throw error;
  } finally { await r?.db.end(); await app.close(); }
})().catch(e=>{console.error(e);process.exitCode=1;});
