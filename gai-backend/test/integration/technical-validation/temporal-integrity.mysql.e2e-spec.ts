import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { spawnSync } from 'child_process';
import { mkdirSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import request from 'supertest';
import {
  createTestApp,
  seedTestData,
  loginAsOrgAdmin,
} from '../test-app.helper';

describe('Civil dates and UTC instants (real MySQL)', () => {
  let app: INestApplication,
    ds: DataSource,
    token: string,
    project: number,
    agent: number;
  const evidence: unknown[] = [];
  const post = (url: string, body: object) =>
    request(app.getHttpServer())
      .post('/api/v1' + url)
      .auth(token, { type: 'bearer' })
      .send(body);
  const input = (day: string) => ({
    field_agent_id: agent,
    start_date: day,
    end_date: day,
    daily_rate: '1.00',
  });
  const counts = async () =>
    ds.query(
      'SELECT (SELECT COUNT(*) FROM field_agent_payments) payments,(SELECT COUNT(*) FROM expenses) expenses,(SELECT COUNT(*) FROM payment_expense_audit_logs) audits',
    );
  beforeAll(async () => {
    if (process.env.GAI_TEST_MYSQL_WAVE1 !== '1')
      throw Error('Use explicit disposable MySQL runner');
    app = await createTestApp();
    await seedTestData(app);
    ds = app.get(DataSource);
    token = await loginAsOrgAdmin(app);
    project = (
      await post('/projects', {
        organization_id: 1,
        company_id: 1,
        name: 'SINTETICO temporal onda1',
      }).expect(201)
    ).body.id;
    agent = (
      await post('/field-agents', { name: 'SINTETICO temporal' }).expect(201)
    ).body.id;
    await post(`/projects/${project}/field-agents`, {
      field_agent_id: agent,
    }).expect(201);
  });
  afterAll(async () => {
    const dir =
      process.env.GAI_TEST_EVIDENCE_DIR ??
      resolve(process.cwd(), 'test-results/mysql');
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      resolve(dir, 'temporal-integrity.json'),
      JSON.stringify(evidence, null, 2),
    );
    await app?.close();
  });
  it.each([
    '2026-02-30',
    '2026-02-29',
    '1900-02-29',
    '2026-04-31',
    '2026-00-10',
    '2026-13-01',
    '2026-1-01',
    '2026-01-01T00:00:00Z',
    '',
    '0999-12-31',
    '10000-01-01',
  ])(
    'rejects %s by HTTP without payment, expense or audit writes',
    async (day) => {
      const before = await counts();
      await post(`/projects/${project}/payments`, input(day)).expect(400);
      await post(`/projects/${project}/expenses`, {
        expense_date: day,
        description: 'SINTETICO invalid',
        amount: '1.00',
      }).expect(400);
      expect(await counts()).toEqual(before);
    },
  );
  it.each(['1000-01-01', '2024-02-29', '9999-12-31'])(
    'keeps civil date %s as YYYY-MM-DD',
    async (day) => {
      const p = (
        await post(`/projects/${project}/payments`, input(day)).expect(201)
      ).body;
      expect(p.start_date).toBe(day);
      expect(p.end_date).toBe(day);
      const [sql] = await ds.query(
        'SELECT start_date,end_date FROM field_agent_payments WHERE id=?',
        [p.id],
      );
      expect(sql.start_date).toBe(day);
      expect(sql.end_date).toBe(day);
      evidence.push({ day, payment: p.id, sql });
    },
  );
  it('keeps approval, settlement, audit and SQL defaults in UTC with civil period filters', async () => {
    const p = (
      await post(`/projects/${project}/payments`, input('2024-02-29')).expect(
        201,
      )
    ).body;
    const start = Date.now();
    await post(`/projects/${project}/payments/${p.id}/approve`, {}).expect(200);
    const paid = (
      await post(`/projects/${project}/payments/${p.id}/mark-as-paid`, {
        payment_date: '2024-03-01',
      }).expect(200)
    ).body;
    const end = Date.now(),
      [row] = await ds.query('SELECT * FROM field_agent_payments WHERE id=?', [
        p.id,
      ]);
    const audits = await ds.query(
      'SELECT * FROM payment_expense_audit_logs WHERE payment_id=? ORDER BY id',
      [p.id],
    );
    for (const instant of [
      row.approved_at,
      row.paid_at,
      row.updated_at,
      ...audits.slice(1).map((a: any) => a.created_at),
      paid.updated_at,
    ]) {
      const time = new Date(instant).getTime();
      expect(time).toBeGreaterThanOrEqual(start - 1000);
      expect(time).toBeLessThanOrEqual(end + 1000);
    }
    expect(new Date(audits[1].changes.approved_at.after).getTime()).toBe(
      row.approved_at.getTime(),
    );
    expect(new Date(audits[2].changes.paid_at.after).getTime()).toBe(
      row.paid_at.getTime(),
    );
    expect(row.payment_date).toBe('2024-03-01');
    expect(paid.payment_date).toBe('2024-03-01');
    for (const [day, total] of [
      ['2024-03-01', 1],
      ['2024-02-29', 0],
    ] as const) {
      const list = await request(app.getHttpServer())
        .get(`/api/v1/projects/${project}/payments?payment_date=${day}`)
        .auth(token, { type: 'bearer' })
        .expect(200);
      expect(list.body.total_items).toBe(total);
    }
    evidence.push({
      label: 'HTTP UTC approval/settlement/audit',
      row,
      audits,
      response: paid,
    });
  });
  it('preserves UTC-anchored Date values in project and assignment civil columns', async () => {
    const p = (
      await post('/projects', {
        organization_id: 1,
        company_id: 1,
        name: 'SINTETICO civil project',
        start_date: '2024-02-29',
        end_date: '2024-03-01',
      }).expect(201)
    ).body;
    expect(p.start_date).toBe('2024-02-29');
    expect(p.end_date).toBe('2024-03-01');
    const link = (
      await post(`/projects/${p.id}/field-agents`, {
        field_agent_id: agent,
        start_date: '2024-02-29',
        end_date: '2024-03-01',
      }).expect(201)
    ).body;
    expect(link.start_date).toBe('2024-02-29');
    expect(link.end_date).toBe('2024-03-01');
    const [raw] = await ds.query(
      'SELECT start_date,end_date FROM projects WHERE id=?',
      [p.id],
    );
    expect(raw.start_date).toBe('2024-02-29');
    expect(raw.end_date).toBe('2024-03-01');
  });
  it('forces all pooled sessions to UTC under a non-UTC server and four Node zones', async () => {
    const [{ zone }] = await ds.query('SELECT @@global.time_zone zone');
    await ds.query(
      'CREATE TABLE wave1_temporal_probe (id INT PRIMARY KEY AUTO_INCREMENT, zone VARCHAR(80), civil DATE, instant DATETIME(3), created_at DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3))',
    );
    try {
      await ds.query("SET GLOBAL time_zone = '+09:00'");
      const root = resolve(__dirname, '../../..');
      for (const timezone of [
        'UTC',
        'America/Sao_Paulo',
        'Pacific/Kiritimati',
        'America/Los_Angeles',
      ]) {
        const child = spawnSync(
          process.execPath,
          [resolve(root, 'test/fixtures/temporal-probe.cjs')],
          {
            cwd: root,
            env: { ...process.env, TZ: timezone },
            encoding: 'utf8',
            timeout: 30000,
          },
        );
        expect({ code: child.status, error: child.stderr }).toEqual({
          code: 0,
          error: '',
        });
        const output = JSON.parse(child.stdout.trim());
        expect(output.saved.civil).toBe('2026-03-31');
        expect(output.saved.instant).toBe('2026-03-31T23:59:59.999Z');
        expect(output.raw.instant_raw).toBe('2026-03-31T23:59:59.999000Z');
        expect(
          output.sessions.flat().every((s: any) => s.zone === '+00:00'),
        ).toBe(true);
        evidence.push({ timezone, ...output });
      }
      const [period] = await ds.query(
        "SELECT COUNT(*) n FROM wave1_temporal_probe WHERE instant >= '2026-03-31 00:00:00' AND instant < '2026-04-01 00:00:00'",
      );
      expect(Number(period.n)).toBe(4);
    } finally {
      await ds.query('SET GLOBAL time_zone = ?', [zone]);
      await ds.query('DROP TABLE wave1_temporal_probe');
    }
  });
});
