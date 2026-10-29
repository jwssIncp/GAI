// Real HTTP + MySQL 8. Only the fixed, disposable Wave 1 database is reachable.
const assert = require('node:assert/strict'), path = require('node:path'), fs = require('node:fs');
const mysql = require(path.resolve(__dirname, './evidencias/workspace/gai-backend/node_modules/mysql2/promise'));
const evidence = path.join(__dirname, 'evidencias');
async function runtime(base = 'http://127.0.0.1:33339/api/v1') {
  const db = await mysql.createConnection({ host: '127.0.0.1', port: 33337, user: 'root', password: 'gai-validation-only', database: 'gai_validation_disposable', timezone: 'Z', dateStrings: ['DATE'] });
  const login = await fetch(base + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ identifier: 'org.admin', password: 'Admin@123456' }) });
  if (login.status !== 200) await db.end();
  assert.equal(login.status, 200); const token = (await login.json()).access_token;
  async function api(method, url, body, extra = {}, bearer = token) {
    const r = await fetch(base + url, { method, headers: { Authorization: 'Bearer ' + bearer, 'Content-Type': 'application/json', ...extra }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    return { status: r.status, body: await r.json() };
  }
  async function fixture() {
    const p = await api('POST', '/projects', { organization_id: 1, company_id: 1, name: 'SINTETICO ONDA1 ' + Date.now() }); assert.equal(p.status, 201);
    const a = await api('POST', '/field-agents', { name: 'SINTETICO ONDA1' }); assert.equal(a.status, 201);
    assert.equal((await api('POST', `/projects/${p.body.id}/field-agents`, { field_agent_id: a.body.id })).status, 201);
    return { project: p.body.id, agent: a.body.id };
  }
  function input(f, rate = '1.00') { return { field_agent_id: f.agent, start_date: '2026-10-28', end_date: '2026-10-28', daily_rate: rate }; }
  async function payment(f, rate) { const r = await api('POST', `/projects/${f.project}/payments`, input(f, rate)); assert.equal(r.status, 201, JSON.stringify(r)); return r.body; }
  const url = (f, p) => `/projects/${f.project}/payments/${p.id}`;
  async function snapshot(id) {
    const [rows] = await db.query('SELECT * FROM field_agent_payments WHERE id=?', [id]);
    const [audits] = await db.query('SELECT * FROM payment_expense_audit_logs WHERE payment_id=? ORDER BY id', [id]);
    return { row: rows[0], audits };
  }
  // A third connection holds the row. Both HTTP transactions must demonstrably
  // wait on InnoDB before release; requests are not merely launched together.
  async function race(id, calls) {
    const holder = await mysql.createConnection({ host: '127.0.0.1', port: 33337, user: 'root', password: 'gai-validation-only', database: 'gai_validation_disposable', timezone: 'Z', dateStrings: ['DATE'] });
    const pending = [], waits = [];
    try {
      await holder.beginTransaction(); await holder.query('SELECT id FROM field_agent_payments WHERE id=? FOR UPDATE', [id]);
      for (const call of calls) {
        pending.push(call());
        const deadline = Date.now() + 12000;
        let observed = 0;
        do {
          const [r] = await db.query(`SELECT COUNT(DISTINCT w.REQUESTING_ENGINE_TRANSACTION_ID) AS n FROM performance_schema.data_lock_waits w JOIN performance_schema.data_locks l ON l.ENGINE_LOCK_ID=w.REQUESTING_ENGINE_LOCK_ID AND l.ENGINE=w.ENGINE WHERE l.OBJECT_SCHEMA='gai_validation_disposable' AND l.OBJECT_NAME='field_agent_payments'`);
          observed = Number(r[0].n);
          if (observed >= pending.length) break;
          await new Promise(resolve => setTimeout(resolve, 10));
        } while (Date.now() < deadline);
        waits.push(observed); assert.ok(observed >= pending.length, 'HTTP transaction did not enter InnoDB lock wait');
      }
      await holder.commit();
      return { waits, responses: await Promise.all(pending), ...(await snapshot(id)) };
    } finally { await holder.rollback(); await holder.end(); await Promise.allSettled(pending); }
  }
  return { db, api, fixture, input, payment, url, snapshot, race };
}
async function baseline() {
  const r = await runtime(); const results = [];
  try {
    const f = await r.fixture();
    for (let i = 0; i < 15; i++) {
      const p = await r.payment(f), u = r.url(f, p);
      results.push(await r.race(p.id, [() => r.api('POST', u + '/mark-as-paid', {}), () => r.api('POST', u + '/approve', {})]));
    }
    const sf = await r.fixture(); for (let i = 0; i < 101; i++) await r.payment(sf);
    const summary = await r.api('GET', `/projects/${sf.project}/payments/summary`);
    const output = { mode: 'before', races: results, incoherent: results.filter(x => x.responses[0].status === 200 && x.row.status !== 'paid').length, summary101: summary };
    fs.writeFileSync(path.join(evidence, 'deterministic-before.json'), JSON.stringify(output, null, 2));
    console.log(JSON.stringify({ races: results.length, incoherent: output.incoherent, summary: summary.body }));
    assert.ok(output.incoherent > 0); assert.equal(summary.body.total_pending, '100.00');
  } finally { await r.db.end(); }
}
module.exports = { runtime };
if (require.main === module) baseline().catch(e => { console.error(e); process.exitCode = 1; });
