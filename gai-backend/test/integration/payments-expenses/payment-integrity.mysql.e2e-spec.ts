import { INestApplication } from '@nestjs/common';
import { createConnection, Connection } from 'mysql2/promise';
import { mkdirSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import {
  createTestApp,
  seedTestData,
  loginAsOrgAdmin,
  loginAsAdmin,
  loginAsOrgUser,
} from '../test-app.helper';

// This suite is destructive only on the dedicated Wave 0 loopback container.
const mysqlSuite =
  process.env.GAI_TEST_MYSQL_DISPOSABLE === '1' &&
  (process.env.GAI_TEST_MYSQL_WAVE0 === '1' ||
    process.env.GAI_TEST_MYSQL_WAVE1 === '1')
    ? describe
    : describe.skip;
mysqlSuite('Payment integrity: real HTTP, two Nest instances, MySQL 8', () => {
  let app: INestApplication, second: INestApplication, db: Connection;
  let token: string, platform: string, user: string;
  let bases: string[];
  const evidence: any[] = [];
  const dbOptions = {
    host: '127.0.0.1',
    port:
      process.env.GAI_TEST_MYSQL_WAVE2 === '1'
        ? 33347
        : process.env.GAI_TEST_MYSQL_WAVE1 === '1'
          ? 33337
          : 33327,
    user: 'root',
    password: 'gai-validation-only',
    database: 'gai_validation_disposable',
    timezone: 'Z',
    dateStrings: ['DATE' as const],
  };
  const call = async (
    method: string,
    path: string,
    body?: object,
    instance = 0,
    bearer = token,
    headers = {},
  ) => {
    const r = await fetch(bases[instance] + '/api/v1' + path, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + bearer,
        ...headers,
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    return { status: r.status, body: await r.json() };
  };
  const input = (agent: number, rate = '1.00') => ({
    field_agent_id: agent,
    start_date: '2026-10-28',
    end_date: '2026-10-28',
    daily_rate: rate,
  });
  const paymentUrl = (f: any, p: any) =>
    `/projects/${f.project}/payments/${p.id}`;
  async function fixture(org = 1, company: number | null = 1, bearer = token) {
    const p = await call(
      'POST',
      '/projects',
      {
        organization_id: org,
        company_id: company,
        name: 'SINTETICO Wave0 ' + Date.now(),
      },
      0,
      bearer,
    );
    expect(p.status).toBe(201);
    if (org !== 1) {
      // The field-agent API deliberately uses the actor's tenant.
      const [agent] = await db.query<any>(
        "INSERT INTO field_agents (organization_id,name,status,created_at,updated_at) VALUES (?,'SINTETICO Foreign','active',NOW(3),NOW(3))",
        [org],
      );
      await db.query(
        "INSERT INTO project_field_agents (organization_id,project_id,field_agent_id,status,created_at,updated_at) VALUES (?,?,?,'active',NOW(3),NOW(3))",
        [org, p.body.id, agent.insertId],
      );
      return {
        project: p.body.id as number,
        agent: agent.insertId as number,
        org,
        bearer,
      };
    }
    const a = await call(
      'POST',
      '/field-agents',
      { name: 'SINTETICO Wave0' },
      0,
      bearer,
    );
    expect(a.status).toBe(201);
    expect(
      (
        await call(
          'POST',
          `/projects/${p.body.id}/field-agents`,
          { field_agent_id: a.body.id },
          0,
          bearer,
        )
      ).status,
    ).toBe(201);
    return {
      project: p.body.id as number,
      agent: a.body.id as number,
      org,
      bearer,
    };
  }
  async function payment(f: any, rate = '1.00') {
    const p = await call(
      'POST',
      `/projects/${f.project}/payments`,
      input(f.agent, rate),
      0,
      f.bearer,
    );
    expect(p.status).toBe(201);
    return p.body;
  }
  async function snapshot(id: number) {
    const [rows] = await db.query<any[]>(
      'SELECT * FROM field_agent_payments WHERE id=?',
      [id],
    );
    const [audits] = await db.query<any[]>(
      'SELECT * FROM payment_expense_audit_logs WHERE payment_id=? ORDER BY id',
      [id],
    );
    return { row: rows[0], audits };
  }
  async function race(
    id: number,
    calls: (() => Promise<any>)[],
    label: string,
  ) {
    const holder = await createConnection(dbOptions),
      pending: Promise<any>[] = [],
      waits: number[] = [];
    try {
      await holder.beginTransaction();
      await holder.query(
        'SELECT id FROM field_agent_payments WHERE id=? FOR UPDATE',
        [id],
      );
      for (const c of calls) {
        pending.push(c());
        const deadline = Date.now() + 10000;
        let observed = 0;
        do {
          const [rows] = await db.query<any[]>(
            `SELECT COUNT(DISTINCT w.REQUESTING_ENGINE_TRANSACTION_ID) AS n FROM performance_schema.data_lock_waits w JOIN performance_schema.data_locks l ON l.ENGINE_LOCK_ID=w.REQUESTING_ENGINE_LOCK_ID AND l.ENGINE=w.ENGINE WHERE l.OBJECT_SCHEMA='gai_validation_disposable' AND l.OBJECT_NAME='field_agent_payments'`,
          );
          observed = Number(rows[0].n);
          if (observed >= pending.length) break;
          await new Promise((r) => setTimeout(r, 10));
        } while (Date.now() < deadline);
        waits.push(observed);
        expect(observed).toBeGreaterThanOrEqual(pending.length);
      }
      const [lockSample] = await db.query<any[]>(
        "SELECT OBJECT_NAME,INDEX_NAME,LOCK_MODE,LOCK_STATUS,LOCK_DATA FROM performance_schema.data_locks WHERE OBJECT_SCHEMA='gai_validation_disposable' AND OBJECT_NAME IN ('projects','field_agent_payments')",
      );
      await holder.commit();
      const result = {
        label,
        waits,
        lockSample,
        responses: await Promise.all(pending),
        ...(await snapshot(id)),
      };
      evidence.push(result);
      return result;
    } finally {
      await holder.rollback();
      await holder.end();
      await Promise.allSettled(pending);
    }
  }
  function assertPaid(r: any) {
    expect(r.row.status).toBe('paid');
    expect(r.row.paid_at).not.toBeNull();
    expect(Number(r.row.paid_by_id)).toBe(2);
    const settlements = r.audits.filter(
      (a: any) => a.operation === 'MARK_PAYMENT_AS_PAID',
    );
    expect(settlements).toHaveLength(1);
    const event = settlements[0];
    expect(Number(event.payment_id)).toBe(Number(r.row.id));
    expect(Number(event.organization_id)).toBe(Number(r.row.organization_id));
    expect(Number(event.project_id)).toBe(Number(r.row.project_id));
    expect(Number(event.performed_by)).toBe(2);
    expect(new Date(event.changes.paid_at.after).getTime()).toBe(
      new Date(r.row.paid_at).getTime(),
    );
    expect(event.changes.final_amount.after).toBe(r.row.final_amount);
    expect(event.changes.status.after).toBe('paid');
    expect(event.created_at).toBeTruthy();
    expect(r.audits.at(-1).changes.status.after).toBe('paid');
  }
  beforeAll(async () => {
    app = await createTestApp();
    await seedTestData(app);
    token = await loginAsOrgAdmin(app);
    platform = await loginAsAdmin(app);
    user = await loginAsOrgUser(app);
    second = await createTestApp(undefined, { reuseDisposableDatabase: true });
    await app.listen(0, '127.0.0.1');
    await second.listen(0, '127.0.0.1');
    bases = [await app.getUrl(), await second.getUrl()];
    db = await createConnection(dbOptions);
  });
  afterAll(async () => {
    if (process.env.GAI_TEST_EVIDENCE_DIR) {
      mkdirSync(process.env.GAI_TEST_EVIDENCE_DIR, { recursive: true });
    }
    writeFileSync(
      resolve(
        process.env.GAI_TEST_EVIDENCE_DIR ??
          resolve(
            __dirname,
            process.env.GAI_TEST_MYSQL_WAVE1 === '1'
              ? '../../../../docs/correcoes-onda-1-integridade-2026-10-28/evidencias'
              : '../../../../docs/correcoes-onda-0-financeiro-2026-10-28/evidencias',
          ),
        'concurrency-after.json',
      ),
      JSON.stringify(evidence, null, 2),
    );
    await db?.end();
    await second?.close();
    await app?.close();
  });
  it.each(['paid-first', 'approve-first'])(
    'serializes approval and payment in two instances/pools: %s',
    async (order) => {
      const f = await fixture(),
        p = await payment(f),
        u = paymentUrl(f, p);
      const paid = () => call('POST', u + '/mark-as-paid', {}, 0),
        approve = () => call('POST', u + '/approve', {}, 1);
      const r = await race(
        p.id,
        order === 'paid-first' ? [paid, approve] : [approve, paid],
        order,
      );
      expect(r.responses.map((x) => x.status)).toEqual(
        order === 'paid-first' ? [200, 409] : [200, 200],
      );
      assertPaid(r);
      expect(
        r.audits.filter((a) => a.operation === 'APPROVE_PAYMENT'),
      ).toHaveLength(order === 'paid-first' ? 0 : 1);
    },
  );
  it.each(['mark-as-paid', 'approve'])(
    'allows only one concurrent %s and one matching event',
    async (action) => {
      const f = await fixture(),
        p = await payment(f),
        u = paymentUrl(f, p);
      const r = await race(
        p.id,
        [
          () => call('POST', u + '/' + action, {}, 0),
          () => call('POST', u + '/' + action, {}, 1),
        ],
        action + '-twice',
      );
      expect(r.responses.map((x) => x.status)).toEqual([200, 409]);
      expect(r.audits).toHaveLength(2);
      if (action === 'mark-as-paid') assertPaid(r);
      else expect(r.row.status).toBe('approved');
    },
  );
  it('protects edits and cancellation with the same lock, in both serial orders', async () => {
    const f = await fixture();
    for (const action of ['update', 'cancel'])
      for (const paidFirst of [true, false]) {
        const p = await payment(f),
          u = paymentUrl(f, p);
        const paid = () => call('POST', u + '/mark-as-paid', {}, 0);
        const mutation = () =>
          action === 'update'
            ? call('PATCH', u, input(f.agent, '2.35'), 1)
            : call('POST', u + '/cancel', {}, 1);
        const r = await race(
          p.id,
          paidFirst ? [paid, mutation] : [mutation, paid],
          `${action}-${paidFirst}`,
        );
        expect(r.responses.map((x) => x.status)).toEqual(
          paidFirst || action === 'cancel' ? [200, 409] : [200, 200],
        );
        if (!paidFirst && action === 'cancel') {
          expect(r.row.status).toBe('cancelled');
          expect(r.row.paid_at).toBeNull();
        } else {
          assertPaid(r);
          expect(r.row.final_amount).toBe(paidFirst ? '1.00' : '2.35');
        }
        if (!paidFirst && action === 'update') {
          expect(r.audits[1].changes.final_amount).toEqual({
            before: '1.00',
            after: '2.35',
          });
        }
      }
  });
  it('repeated requests with identical/different headers never record a second settlement', async () => {
    const f = await fixture(),
      p = await payment(f),
      u = paymentUrl(f, p);
    const key = { 'Idempotency-Key': 'synthetic-same-request' };
    const r = await race(
      p.id,
      [
        () => call('POST', u + '/mark-as-paid', {}, 0, token, key),
        () => call('POST', u + '/mark-as-paid', {}, 1, token, key),
      ],
      'same-header',
    );
    expect(r.responses.map((x) => x.status)).toEqual([200, 409]);
    assertPaid(r);
    const before = await snapshot(p.id);
    expect(
      (await call('POST', u + '/mark-as-paid', {}, 0, token, key)).status,
    ).toBe(409);
    expect(
      (
        await call('POST', u + '/mark-as-paid', {}, 1, token, {
          'Idempotency-Key': 'different',
        })
      ).status,
    ).toBe(409);
    expect(await snapshot(p.id)).toEqual(before);
    // Payments have no idempotency-key/reversal API. Headers do not create one.
    expect((await call('POST', u + '/reverse', {})).status).toBe(404);
    expect((await call('POST', u + '/cancel', {})).status).toBe(409);
    expect(await snapshot(p.id)).toEqual(before);
  });
  it('rolls payment back when the real SQL audit insert fails, then retries exactly once', async () => {
    const f = await fixture(),
      p = await payment(f),
      u = paymentUrl(f, p),
      before = await snapshot(p.id);
    await db.query(
      `CREATE TRIGGER wave0_fail_audit BEFORE INSERT ON payment_expense_audit_logs FOR EACH ROW BEGIN IF NEW.payment_id = ${Number(p.id)} AND NEW.operation = 'MARK_PAYMENT_AS_PAID' THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Synthetic audit failure'; END IF; END`,
    );
    try {
      expect((await call('POST', u + '/mark-as-paid', {})).status).toBe(500);
      expect(await snapshot(p.id)).toEqual(before);
    } finally {
      await db.query('DROP TRIGGER wave0_fail_audit');
    }
    expect((await call('POST', u + '/mark-as-paid', {})).status).toBe(200);
    assertPaid(await snapshot(p.id));
    expect((await call('POST', u + '/mark-as-paid', {})).status).toBe(409);
    assertPaid(await snapshot(p.id));
    evidence.push({
      label: 'SQL audit rollback and retry',
      before,
      after: await snapshot(p.id),
    });
  });
  it('blocks new mutations on a synthetic historically inconsistent settlement without rewriting it', async () => {
    const f = await fixture(),
      p = await payment(f),
      u = paymentUrl(f, p);
    await db.query(
      "UPDATE field_agent_payments SET paid_at='2026-10-28 12:00:00.000',paid_by_id=2,status='approved' WHERE id=?",
      [p.id],
    );
    const before = await snapshot(p.id);
    for (const action of ['approve', 'mark-as-paid', 'cancel'])
      expect((await call('POST', u + '/' + action, {})).status).toBe(409);
    expect((await call('PATCH', u, input(f.agent))).status).toBe(409);
    expect((await call('GET', u)).status).toBe(200);
    expect(await snapshot(p.id)).toEqual(before);
  });
  it('does not serialize unrelated payment rows, projects or organizations, and enforces scope/RBAC', async () => {
    const f = await fixture(),
      other = await fixture();
    const org = await call(
      'POST',
      '/organizations',
      { legal_name: 'SINTETICO Wave0 Org2', cnpj: '11444777000161' },
      0,
      platform,
    );
    expect(org.status).toBe(201);
    const company = await call(
      'POST',
      '/companies',
      {
        organization_id: org.body.id,
        name: 'SINTETICO Wave0 Company2',
        corporate_name: 'SINTETICO Wave0 LTDA',
        document: '11444777000161',
      },
      0,
      platform,
    );
    expect(company.status).toBe(201);
    const foreign = await fixture(org.body.id, company.body.id, platform);
    const p = await payment(f),
      independent = await payment(f),
      p2 = await payment(other),
      foreignP = await payment(foreign);
    const holder = await createConnection(dbOptions);
    try {
      await holder.beginTransaction();
      await holder.query(
        'SELECT id FROM field_agent_payments WHERE id=? FOR UPDATE',
        [p.id],
      );
      const responses = await Promise.race([
        Promise.all(
          [
            [f, independent],
            [other, p2],
            [foreign, foreignP],
          ].map(([fix, pay]) =>
            call(
              'POST',
              paymentUrl(fix, pay) + '/mark-as-paid',
              {},
              1,
              fix.bearer,
            ),
          ),
        ),
        new Promise<never>((_, reject) => {
          const timer = setTimeout(
            () =>
              reject(
                new Error('Unrelated payment blocked by another row lock'),
              ),
            5000,
          );
          timer.unref();
        }),
      ]);
      expect(responses.map((r) => r.status)).toEqual([200, 200, 200]);
    } finally {
      await holder.rollback();
      await holder.end();
    }
    expect(
      (await call('GET', `/projects/${foreign.project}/payments/summary`))
        .status,
    ).toBe(403);
    expect(
      (await call('POST', paymentUrl(foreign, foreignP) + '/approve', {}))
        .status,
    ).toBe(403);
    expect(
      (
        await call(
          'POST',
          `/projects/${other.project}/payments/${p.id}/approve`,
          {},
        )
      ).status,
    ).toBe(404);
    // Remove approval only from this disposable operator, preserving read.
    await db.query(
      "DELETE rp FROM role_permissions rp JOIN roles r ON r.id=rp.role_id JOIN permissions p ON p.id=rp.permission_id WHERE r.name='Operador' AND p.`key`='payments:approve'",
    );
    expect(
      (await call('GET', paymentUrl(f, p), undefined, 0, user)).status,
    ).toBe(200);
    expect(
      (await call('POST', paymentUrl(f, p) + '/approve', {}, 0, user)).status,
    ).toBe(403);
    const scoped = await call('GET', `/projects/${f.project}/payments/summary`);
    const foreignSummary = await call(
      'GET',
      `/projects/${foreign.project}/payments/summary`,
      undefined,
      0,
      platform,
    );
    expect(scoped.body).toEqual({
      total_pending: '1.00',
      total_approved: '0.00',
      total_paid: '1.00',
      total_cancelled: '0.00',
      total_count: 2,
    });
    expect(foreignSummary.body).toEqual({
      total_pending: '0.00',
      total_approved: '0.00',
      total_paid: '1.00',
      total_cancelled: '0.00',
      total_count: 1,
    });
    evidence.push({
      label: 'independent rows and tenants',
      scoped,
      foreign: foreignSummary,
    });
  });
  it('summarizes 101 and 1205 eligible rows exactly, all statuses, tenant/project scope, without cache lag', async () => {
    const f = await fixture();
    const summaryUrl = `/projects/${f.project}/payments/summary`;
    expect((await call('GET', summaryUrl)).body).toEqual({
      total_pending: '0.00',
      total_approved: '0.00',
      total_paid: '0.00',
      total_cancelled: '0.00',
      total_count: 0,
    });
    for (let i = 0; i < 101; i++) {
      await payment(f);
      if (i === 0 || i === 99) {
        const boundary = await call('GET', summaryUrl);
        expect(boundary.body.total_count).toBe(i + 1);
        expect(boundary.body.total_pending).toBe(`${i + 1}.00`);
      }
    }
    expect(
      (await call('GET', `/projects/${f.project}/payments/summary`)).body,
    ).toEqual({
      total_pending: '101.00',
      total_approved: '0.00',
      total_paid: '0.00',
      total_cancelled: '0.00',
      total_count: 101,
    });
    const template = await payment(f, '0.01');
    // Bulk fixture setup does not exercise mutations; each row is synthetic.
    const [columns] = await db.query<any[]>(
      'SHOW COLUMNS FROM field_agent_payments',
    );
    const names = columns
      .map((c) => c.Field as string)
      .filter((n) => n !== 'id');
    const quoted = names.map((n) => '`' + n + '`').join(',');
    for (let i = 0; i < 1100; i++)
      await db.query(
        `INSERT INTO field_agent_payments (${quoted}) SELECT ${quoted} FROM field_agent_payments WHERE id=?`,
        [template.id],
      );
    const large = await payment(f, '9999999999999.99');
    expect(
      (await call('POST', paymentUrl(f, large) + '/approve', {})).status,
    ).toBe(200);
    const paid = await payment(f, '0.20'),
      cancelled = await payment(f, '0.30');
    expect(
      (await call('POST', paymentUrl(f, paid) + '/mark-as-paid', {})).status,
    ).toBe(200);
    expect(
      (await call('POST', paymentUrl(f, cancelled) + '/cancel', {})).status,
    ).toBe(200);
    const expected = {
      total_pending: '112.01',
      total_approved: '9999999999999.99',
      total_paid: '0.20',
      total_cancelled: '0.30',
      total_count: 1205,
    };
    const summary = await call(
      'GET',
      `/projects/${f.project}/payments/summary`,
    );
    expect(summary.status).toBe(200);
    expect(summary.body).toEqual(expected);
    // Exact DECIMAL sum beyond Number's reliable cent precision (105 more rows).
    for (let i = 0; i < 105; i++)
      await db.query(
        `INSERT INTO field_agent_payments (${quoted}) SELECT ${quoted} FROM field_agent_payments WHERE id=?`,
        [large.id],
      );
    const extended = await call(
      'GET',
      `/projects/${f.project}/payments/summary`,
    );
    expect(extended.body.total_approved).toBe('1059999999999998.94');
    expect(extended.body.total_count).toBe(1310);
    const [sql] = await db.query<any[]>(
      'SELECT status, SUM(final_amount) amount, COUNT(*) n FROM field_agent_payments WHERE organization_id=1 AND project_id=? GROUP BY status',
      [f.project],
    );
    evidence.push({
      label: 'summary-101-1205-1310',
      expected1205: expected,
      summary1310: extended,
      sql,
    });
    expect(
      (await call('POST', paymentUrl(f, template) + '/mark-as-paid', {}))
        .status,
    ).toBe(200);
    const refreshed = await call(
      'GET',
      `/projects/${f.project}/payments/summary`,
    );
    expect(refreshed.body.total_pending).toBe('112.00');
    expect(refreshed.body.total_paid).toBe('0.21');
  });
  it('replays the original 15 Promise.all HTTP approve/payment races with no lost settlement', async () => {
    const f = await fixture();
    for (let i = 0; i < 15; i++) {
      const p = await payment(f),
        u = paymentUrl(f, p);
      const responses = await Promise.all([
        call('POST', u + '/approve', {}),
        call('POST', u + '/mark-as-paid', {}, 1),
      ]);
      const r = {
        label: `original-after-${i}`,
        responses,
        ...(await snapshot(p.id)),
      };
      evidence.push(r);
      expect(responses[1].status).toBe(200);
      expect([200, 409]).toContain(responses[0].status);
      assertPaid(r);
    }
  });
  it('stress: 100 deterministic approve/payment races across two instances, zero incoherent outcomes', async () => {
    const f = await fixture();
    let inconsistent = 0;
    for (let i = 0; i < 100; i++) {
      const p = await payment(f),
        u = paymentUrl(f, p),
        paidFirst = i % 2 === 0;
      const calls = [
        () => call('POST', u + '/mark-as-paid', {}, i % 2),
        () => call('POST', u + '/approve', {}, 1 - (i % 2)),
      ];
      const r = await race(
        p.id,
        paidFirst ? calls : calls.reverse(),
        'stress-' + i,
      );
      if (r.row.status !== 'paid') inconsistent++;
      expect(r.responses.map((x) => x.status)).toEqual(
        paidFirst ? [200, 409] : [200, 200],
      );
      assertPaid(r);
    }
    expect(inconsistent).toBe(0);
    const summary = await call(
      'GET',
      `/projects/${f.project}/payments/summary`,
    );
    expect(summary.body).toEqual({
      total_pending: '0.00',
      total_approved: '0.00',
      total_paid: '100.00',
      total_cancelled: '0.00',
      total_count: 100,
    });
    const projectSummary = await call(
      'GET',
      `/projects/${f.project}/summary?include_financial=true`,
    );
    expect(projectSummary.status).toBe(200);
    expect(projectSummary.body.financial.paid_payments).toBe(100);
    expect(projectSummary.body.financial.total_payment_amount).toBe('100.00');
    const dashboard = await call(
      'GET',
      `/projects/${f.project}/dashboard?include_financial=true`,
    );
    expect(dashboard.status).toBe(200);
    const cash = await call(
      'GET',
      `/finance/cash-flow?project_id=${f.project}&direction=out&view=all`,
    );
    expect(cash.status).toBe(200);
    expect(cash.body.movements).toHaveLength(100);
    expect(
      cash.body.movements.every(
        (m: any) =>
          m.source === 'field_agent_payment' &&
          m.view === 'actual' &&
          m.amount === '1.00',
      ),
    ).toBe(true);
    expect(new Set(cash.body.movements.map((m: any) => m.source_id)).size).toBe(
      100,
    );
    expect(cash.body.totals[0]).toMatchObject({
      currency: 'UNSPECIFIED',
      expected_out: '0.00',
      actual_out: '100.00',
    });
    evidence.push({
      label: 'stress-consumers',
      summary,
      projectSummary,
      dashboard,
      cash,
    });
    evidence.push({
      label: 'stress-total',
      races: 100,
      incoherent: inconsistent,
    });
  });
});
