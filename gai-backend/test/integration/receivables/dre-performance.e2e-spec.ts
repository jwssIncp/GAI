import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import {
  createTestApp,
  loginAsOrgAdmin,
  seedTestData,
} from '../test-app.helper';

/**
 * Medição de desempenho da DRE mensal e do fluxo (etapa 10). Só roda com
 * GAI_PERF=1 (não faz parte da suíte normal). Volume: 10 projetos, ~5 mil
 * movimentos (diárias e despesas) espalhados por 12 meses, DRE com o modelo
 * padrão. Meta: menos de 1 s por consulta (mediana de 5 execuções).
 */
const run = process.env.GAI_PERF === '1' ? describe : describe.skip;

run('DRE mensal: desempenho com volume (MySQL)', () => {
  let app: INestApplication;
  let admin: string;
  let ds: DataSource;
  const api = (method: 'get' | 'post' | 'put', path: string) =>
    request(app.getHttpServer())
      [method]('/api/v1' + path)
      .set('Authorization', 'Bearer ' + admin);

  beforeAll(async () => {
    app = await createTestApp();
    await seedTestData(app);
    ds = app.get(DataSource);
    admin = await loginAsOrgAdmin(app);
    const defaults = (
      await api(
        'get',
        '/finance-settings/defaults?valid_from=2025-11-01',
      ).expect(200)
    ).body as Record<string, unknown>;
    await api('post', '/finance-settings')
      .send({
        valid_from: '2025-11-01',
        reason: 'Parametros do teste de volume',
        values: { ...defaults, dre_regime_cutoff_month: '2025-12' },
      })
      .expect(201);
    await api('post', '/finance/dre/monthly/model')
      .send({ command_key: 'perf-model', reason: 'Modelo padrao para volume' })
      .expect(200);
    const agent = (
      await api('post', '/field-agents')
        .send({ name: 'Volume Inventariante' })
        .expect(201)
    ).body.id as number;
    for (let p = 0; p < 10; p++) {
      const project = (
        await api('post', '/projects')
          .send({ organization_id: 1, company_id: 1, name: `Volume ${p}` })
          .expect(201)
      ).body.id as number;
      await api('post', `/projects/${project}/field-agents`)
        .send({ field_agent_id: agent, role: 'collector' })
        .expect(201);
      const pay = (
        await api('post', `/projects/${project}/payments`)
          .send({
            field_agent_id: agent,
            start_date: '2026-10-01',
            end_date: '2026-10-03',
            expected_payment_date: '2026-10-20',
            daily_rate: '150.00',
          })
          .expect(201)
      ).body.id as number;
      await api('post', `/projects/${project}/payments/${pay}/approve`).expect(
        200,
      );
      await api('post', `/projects/${project}/expenses`)
        .send({
          description: 'Volume',
          field_agent_id: agent,
          amount: '87.50',
          expense_date: '2026-10-05',
          expense_type: 'non_reimbursable',
          payment_method: 'cash',
        })
        .expect(201);
    }
    // Multiplica por SQL: 249 cópias de cada (por projeto), datas em 12 meses.
    const cols = async (table: string) =>
      (
        await ds.query<Array<{ c: string }>>(
          "SELECT column_name AS c FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ? AND column_name <> 'id' ORDER BY ordinal_position",
          [table],
        )
      ).map((r) => r.c);
    const shift = (c: string, dates: string[]) =>
      dates.includes(c)
        ? `DATE_SUB(t.\`${c}\`, INTERVAL s.n * 361 DIV 250 DAY)`
        : c === 'project_sequence'
          ? 'NULL'
          : `t.\`${c}\``;
    for (const [table, dates] of [
      [
        'field_agent_payments',
        ['start_date', 'end_date', 'expected_payment_date', 'payment_date'],
      ],
      ['expenses', ['expense_date', 'invoiced_payment_date']],
    ] as const) {
      const c = await cols(table);
      await ds.query(
        `INSERT INTO \`${table}\` (${c.map((x) => `\`${x}\``).join(',')}) WITH RECURSIVE s(n) AS (SELECT 1 UNION ALL SELECT n + 1 FROM s WHERE n < 249) SELECT ${c.map((x) => shift(x, [...dates])).join(',')} FROM \`${table}\` t CROSS JOIN s WHERE t.organization_id = 1`,
      );
    }
  }, 600000);
  afterAll(async () => {
    await app?.close();
  });

  it('consultas da DRE e do fluxo abaixo de 1 s com ~5 mil movimentos', async () => {
    const board = (
      await api(
        'get',
        '/finance/cash-flow/board?year=2026&as_of=2026-11-14',
      ).expect(200)
    ).body as { items: unknown[] };
    const all =
      board.items.length +
      (
        (
          await api(
            'get',
            '/finance/cash-flow/board?year=2025&as_of=2026-11-14',
          ).expect(200)
        ).body as { items: unknown[] }
      ).items.length;
    const queries: Array<[string, string]> = [
      [
        'DRE mensal (grade 2026)',
        '/finance/dre/monthly?year=2026&as_of=2026-11-14',
      ],
      [
        'DRE mensal com comparativo 2025',
        '/finance/dre/monthly?year=2026&compare_year=2025&as_of=2026-11-14',
      ],
      [
        'Demonstrativo jan–dez/2026',
        '/finance/dre/report?start_month=2026-01&end_month=2026-12',
      ],
      [
        'Verificação do fechamento (out/2026)',
        '/finance/dre/monthly/checklist/2026-10?as_of=2026-11-14',
      ],
      [
        'Quadro do fluxo de caixa (2026)',
        '/finance/cash-flow/board?year=2026&as_of=2026-11-14',
      ],
      [
        'Indicadores do fluxo',
        '/finance/cash-flow/indicators?year=2026&as_of=2026-11-14',
      ],
    ];
    const results: Array<{
      consulta: string;
      mediana_ms: number;
      max_ms: number;
    }> = [];
    for (const [name, path] of queries) {
      const times: number[] = [];
      for (let i = 0; i < 5; i++) {
        const t0 = performance.now();
        await api('get', path).expect(200);
        times.push(performance.now() - t0);
      }
      times.sort((a, b) => a - b);
      results.push({
        consulta: name,
        mediana_ms: Math.round(times[2]),
        max_ms: Math.round(times[4]),
      });
    }
    process.stdout.write(`\nVOLUME movimentos no fluxo (2025+2026): ${all}\n`);
    process.stdout.write(`RESULTADOS ${JSON.stringify(results)}\n`);
    expect(all).toBeGreaterThan(4500);
    for (const r of results) expect(r.mediana_ms).toBeLessThan(1000);
  });
});
