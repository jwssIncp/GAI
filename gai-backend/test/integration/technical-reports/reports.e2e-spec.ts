import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import request from 'supertest';
import * as XLSX from 'xlsx';
import {
  createTestApp,
  seedTestData,
  loginAsOrgAdmin,
  loginAsOrgUser,
  loginAsAdmin,
} from '../test-app.helper';
import { templateFixture } from '../../unit/modules/technical-reports/report.fixtures';
import { documentHash } from '../../../src/modules/technical-reports/report.hash';
import { REPORT_ENGINE } from '../../../src/modules/technical-reports/report.policy';
import {
  ReportTemplateVersion,
  TechnicalReportVersion,
} from '../../../src/modules/technical-reports/report.entity';
import { InventoryItemEntity } from '../../../src/modules/inventory-items/infrastructure/persistence/inventory-item.entity';
import {
  AssetValuationEntity,
  InventoryConsolidationEntity,
} from '../../../src/modules/inventory-operations/infrastructure/persistence/inventory-operation.entity';
import { PermissionEntity } from '../../../src/modules/users/infrastructure/persistence/permission.entity';
import { RoleEntity } from '../../../src/modules/users/infrastructure/persistence/role.entity';
import { RolePermissionEntity } from '../../../src/modules/users/infrastructure/persistence/role-permission.entity';
describe('Technical reports real HTTP and disposable MySQL', () => {
  let app: INestApplication,
    ds: DataSource,
    admin: string,
    user: string,
    platform: string,
    p: number,
    item: number,
    t: any,
    r: any,
    profile: any,
    approved: any,
    seq = 0;
  const key = () => `synthetic-report-command-${++seq}`;
  const command = () => ({
    command_key: key(),
    reason: 'SINTETICO teste documental auditavel',
  });
  const api = (
    method: 'get' | 'post' | 'put' | 'patch',
    path: string,
    body: object = {},
    token = admin,
  ) =>
    request(app.getHttpServer())
      [method]('/api/v1' + path)
      .set('Authorization', 'Bearer ' + token)
      .send(body);
  const base = () => `/projects/${p}/technical-reports`;
  const get = (s: string, token = admin) => api('get', base() + s, {}, token),
    post = (s: string, d: object, token = admin) =>
      api('post', base() + s, d, token);
  const editBody = (row = r, over: object = {}) => ({
    ...command(),
    revision: row.revision,
    title: row.data.title,
    sections: row.data.sections.map((s: any) => ({
      key: s.key,
      text:
        s.key === 'objetivo'
          ? 'SINTETICO objetivo e limitacoes do trabalho'
          : s.text,
    })),
    fields: row.data.fields.map((f: any) => ({ key: f.key, value: f.value })),
    responsible_ids: [profile.id],
    technical_notes: 'SINTETICO conferencias documentais',
    conclusion: 'SINTETICO conclusao sem afirmacao normativa',
    ...over,
  });
  beforeAll(async () => {
    app = await createTestApp();
    await seedTestData(app);
    ds = app.get(DataSource);
    admin = await loginAsOrgAdmin(app);
    user = await loginAsOrgUser(app);
    platform = await loginAsAdmin(app);
    p = (
      await api('post', '/projects', {
        organization_id: 1,
        company_id: 1,
        name: 'SINTETICO Projeto laudos',
      }).expect(201)
    ).body.id;
    item = (
      await api('post', `/projects/${p}/inventory-items`, {
        old_plate: 'SYN-LAUDO-1',
        description: 'SINTETICO equipamento original',
      }).expect(201)
    ).body.id;
  });
  afterAll(async () => {
    await app?.close();
  });
  it('requires authentication and document permissions beyond projects read', async () => {
    await request(app.getHttpServer())
      .get('/api/v1' + base())
      .expect(401);
    await get('', user).expect(403);
    await get('/templates', user).expect(403);
  });
  it('creates versioned templates idempotently and publishes immutable content', async () => {
    const dto = { ...command(), data: templateFixture() };
    t = (await post('/templates', dto).expect(201)).body;
    expect((await post('/templates', dto).expect(201)).body.id).toBe(t.id);
    t = (
      await post('/templates/' + t.id + '/publish', {
        ...command(),
        revision: t.revision,
      }).expect(201)
    ).body;
    expect(t.publishedVersionId).toBeTruthy();
    const v = await ds
      .getRepository(ReportTemplateVersion)
      .findOneByOrFail({ id: t.publishedVersionId });
    expect(v.operation).toBe('publish');
  });
  it('rejects malformed nested models and active markup', async () => {
    await post('/templates', { ...command() }).expect(400);
    const data = templateFixture();
    data.sections[0].text = '<img src=x onerror=alert(1)>';
    await post('/templates', { ...command(), data }).expect(400);
  });
  it('registers only active authorized users in the organization without inventing credentials', async () => {
    profile = (
      await post('/responsibles', {
        ...command(),
        user_id: 2,
        display_name: 'SINTETICO Responsavel',
        function: 'Elaborador documental',
        professional_registration: '',
        registration_evidence: '',
      }).expect(201)
    ).body;
    expect(profile.data.professional_registration).toBe('');
    await post('/responsibles', {
      ...command(),
      user_id: 99999,
      display_name: 'SINTETICO Invalido',
      function: 'Elaborador',
      professional_registration: '',
      registration_evidence: '',
    }).expect(400);
  });
  it('creates a project snapshot with dynamic identity and physical rows', async () => {
    r = (
      await post('', {
        ...command(),
        template_version_id: t.publishedVersionId,
        title: 'SINTETICO Laudo patrimonial',
        selection: { families: ['identity', 'inventory'] },
      }).expect(201)
    ).body;
    expect(r.data.fields[0]).toMatchObject({
      origin: 'system',
      value: 'SINTETICO Projeto laudos',
    });
    expect(r.data.sources.metrics['inventory.count']).toBe(1);
    expect(
      r.data.sources.tables.find((x: any) => x.family === 'inventory').rows[0],
    ).toContain('SINTETICO equipamento original');
  });
  it('preserves the model snapshot after a new template draft and publication', async () => {
    const old = r.data.template.hash,
      data = templateFixture();
    data.name = 'SINTETICO Modelo alterado';
    data.sections[1].title = 'Escopo novo';
    t = (
      await api('put', base() + '/templates/' + t.id, {
        ...command(),
        revision: t.revision,
        data,
      }).expect(200)
    ).body;
    t = (
      await post('/templates/' + t.id + '/publish', {
        ...command(),
        revision: t.revision,
      }).expect(201)
    ).body;
    expect((await get('/' + r.id).expect(200)).body.data.template.hash).toBe(
      old,
    );
  });
  it('returns structured blockers and prevents approval with missing content', async () => {
    const v = (await get('/' + r.id + '/validation').expect(200)).body;
    expect(v.valid).toBe(false);
    expect(v.issues.map((x: any) => x.code)).toEqual(
      expect.arrayContaining(['SECTION_REQUIRED', 'RESPONSIBLE_REQUIRED']),
    );
    await post('/' + r.id + '/transitions', {
      ...command(),
      revision: r.revision,
      action: 'review',
    }).expect(409);
  });
  it('saves complete drafts with provenance and rejects stale concurrent revisions', async () => {
    const body = editBody();
    r = (await api('put', base() + '/' + r.id, body).expect(200)).body;
    await api('put', base() + '/' + r.id, { ...body, ...command() }).expect(
      409,
    );
    expect((await get('/' + r.id + '/validation').expect(200)).body.valid).toBe(
      true,
    );
    expect(r.data.sections[1].origin).toBe('manual');
  });
  it('prepares and approves immutable revisions; approved content is not editable', async () => {
    r = (
      await post('/' + r.id + '/transitions', {
        ...command(),
        revision: r.revision,
        action: 'review',
      }).expect(201)
    ).body;
    r = (
      await post('/' + r.id + '/transitions', {
        ...command(),
        revision: r.revision,
        action: 'approve',
      }).expect(201)
    ).body;
    approved = (
      await get(`/${r.id}/versions/${r.approvedVersionId}`).expect(200)
    ).body;
    expect(approved.status).toBe('approved');
    expect(approved.hash).toBe(
      documentHash({
        engine: REPORT_ENGINE,
        data: approved.data,
        validation: approved.validation,
      }),
    );
    expect(approved.actorId).toBe(2);
    await api('put', base() + '/' + r.id, editBody()).expect(409);
  });
  it('detects source changes without rewriting the approved snapshot', async () => {
    await ds
      .getRepository(InventoryItemEntity)
      .update(item, { description: 'SINTETICO equipamento atualizado' });
    const v = (await get('/' + r.id + '/validation').expect(200)).body;
    expect(v.issues.some((x: any) => x.code === 'STALE_SOURCES')).toBe(true);
    const old = (
      await get(`/${r.id}/versions/${r.approvedVersionId}`).expect(200)
    ).body;
    expect(old.hash).toBe(approved.hash);
    expect(
      old.data.sources.tables.find((x: any) => x.family === 'inventory')
        .rows[0],
    ).toContain('SINTETICO equipamento original');
  });
  it('reopens with reason, explicitly refreshes sources and preserves old approval', async () => {
    await post('/' + r.id + '/transitions', {
      ...command(),
      reason: '',
      revision: r.revision,
      action: 'reopen',
    }).expect(400);
    r = (
      await post('/' + r.id + '/transitions', {
        ...command(),
        revision: r.revision,
        action: 'reopen',
      }).expect(201)
    ).body;
    r = (
      await post('/' + r.id + '/refresh-sources', {
        ...command(),
        revision: r.revision,
        selection: r.data.sources.selection,
      }).expect(201)
    ).body;
    expect(r.approvedVersionId).toBe(approved.id);
    expect(
      r.data.sources.tables.find((x: any) => x.family === 'inventory').rows[0],
    ).toContain('SINTETICO equipamento atualizado');
    expect(
      (await get(`/${r.id}/versions/${approved.id}`).expect(200)).body.hash,
    ).toBe(approved.hash);
  });
  it('serializes competing edits with one winner and one revision conflict', async () => {
    const body = editBody();
    const rs = await Promise.all([
      api('put', base() + '/' + r.id, body),
      api('put', base() + '/' + r.id, { ...body, ...command() }),
    ]);
    expect(rs.map((x) => x.status).sort()).toEqual([200, 409]);
    r = (await get('/' + r.id).expect(200)).body;
  });
  it('exports the exact approved structured snapshot, not a fake PDF or DOCX', async () => {
    const f = (await get(`/${r.id}/versions/${approved.id}/export`).expect(200))
      .body;
    expect(f.format).toBe('gai-technical-report-snapshot-v1');
    expect(f.version.hash).toBe(approved.hash);
    expect(f.pdf_docx_contract.available).toBe(true);
    expect(f.pdf_docx_contract.formats).toEqual(['pdf', 'docx']);
    const draft = r.versions.find((v: any) => v.status === 'draft');
    await get(`/${r.id}/versions/${draft.id}/export`).expect(409);
  });
  it('revalidates catalog/source permissions on historical reads and downloads', async () => {
    const replay = {
      ...command(),
      template_version_id: t.publishedVersionId,
      title: 'SINTETICO Reenvio autorizado',
      selection: { families: ['identity', 'inventory'] },
    };
    await post('', replay).expect(201);
    const permission = await ds
      .getRepository(PermissionEntity)
      .findOneByOrFail({ key: 'inventory-items:read' });
    await ds
      .getRepository(PermissionEntity)
      .update(permission.id, { key: 'inventory-items:read.disabled' });
    try {
      await get(`/${r.id}/versions/${approved.id}`).expect(403);
      await get(`/${r.id}/versions/${approved.id}/export`).expect(403);
      await post('', replay).expect(403);
    } finally {
      await ds
        .getRepository(PermissionEntity)
        .update(permission.id, { key: permission.key });
    }
  });
  it('validates foreign parent IDs and actual organization isolation', async () => {
    const other = (
      await api('post', '/projects', {
        organization_id: 1,
        company_id: 1,
        name: 'SINTETICO Outro projeto laudos',
      }).expect(201)
    ).body.id;
    await api('get', `/projects/${other}/technical-reports/${r.id}`).expect(
      404,
    );
    await post('', {
      ...command(),
      template_version_id: 999999,
      title: 'SINTETICO Invalido',
      selection: { families: ['identity'] },
    }).expect(400);
    const org = (
      await api(
        'post',
        '/organizations',
        {
          legal_name: 'SINTETICO Organizacao externa laudos',
          trade_name: 'Laudos externa',
          cnpj: '11444777000161',
        },
        platform,
      ).expect(201)
    ).body.id;
    const company = (
      await api(
        'post',
        '/companies',
        { organization_id: org, name: 'SINTETICO Cliente externo' },
        platform,
      ).expect(201)
    ).body.id;
    const project = (
      await api(
        'post',
        '/projects',
        {
          organization_id: org,
          company_id: company,
          name: 'SINTETICO Projeto externo',
        },
        platform,
      ).expect(201)
    ).body.id;
    await api('get', `/projects/${project}/technical-reports`).expect(403);
    await api(
      'post',
      `/projects/${project}/technical-reports`,
      {
        ...command(),
        template_version_id: t.publishedVersionId,
        title: 'SINTETICO Modelo externo',
        selection: { families: ['identity'] },
      },
      platform,
    ).expect(400);
  });
  it('captures valuation rows without treating unknown currency as a trustworthy monetary total', async () => {
    await api('post', `/projects/${p}/inventory-items/${item}/valuations`, {
      source: 'SINTETICO fonte documental',
      valuation_date: '2026-01-01',
      used_value: '100.01',
    }).expect(201);
    const c = (
      await post('', {
        ...command(),
        template_version_id: t.publishedVersionId,
        title: 'SINTETICO Quadro de avaliacao',
        selection: {
          families: ['identity', 'valuation', 'accounting', 'issues'],
        },
      }).expect(201)
    ).body;
    expect(c.data.sources.metrics['valuation.count']).toBe(1);
    expect(c.data.sources.metrics['valuation.used_total']).toBeNull();
    expect(c.data.sources.missing).toContain('valuation.currency');
    expect(await ds.getRepository(AssetValuationEntity).count()).toBe(1);
  });
  it('captures actual accounting import, observations, reconciliation and consolidation without changing their history', async () => {
    const prefix = `/projects/${p}`,
      agent = (
        await api('post', '/field-agents', {
          name: 'SINTETICO vistoriador laudos',
        }).expect(201)
      ).body.id;
    await api('post', prefix + '/field-agents', {
      field_agent_id: agent,
    }).expect(201);
    const session = (
      await api('post', prefix + '/inventory-sessions', {
        name: 'SINTETICO Sessao documental',
      }).expect(201)
    ).body.id;
    const round = (
      await api('post', prefix + `/inventory-sessions/${session}/start`).expect(
        200,
      )
    ).body.round.id;
    await api(
      'post',
      prefix + `/inventory-sessions/${session}/rounds/${round}/observations`,
      {
        inventory_item_id: item,
        field_agent_id: agent,
        result: 'found',
        observed_plate: 'SYN-LAUDO-1',
      },
    ).expect(201);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet([
        { placa: 'SYN-LAUDO-1', descricao_01: 'SINTETICO base contabil' },
      ]),
      'Base',
    );
    await request(app.getHttpServer())
      .post('/api/v1' + prefix + '/accounting-imports')
      .set('Authorization', 'Bearer ' + admin)
      .attach(
        'file',
        XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer,
        'sintetico.xlsx',
      )
      .expect(201);
    const reconciled = (
      await api(
        'post',
        prefix + `/inventory-sessions/${session}/reconciliations`,
      ).expect(201)
    ).body;
    const rec = reconciled.records[0];
    await api(
      'post',
      prefix +
        `/inventory-sessions/${session}/reconciliations/${rec.id}/consolidate`,
      { decision: 'accepted', notes: 'SINTETICO decisao preservada' },
    ).expect(201);
    const c = (
      await post('', {
        ...command(),
        template_version_id: t.publishedVersionId,
        title: 'SINTETICO Fontes tecnicas reais',
        selection: {
          families: [
            'identity',
            'inventory',
            'accounting',
            'observations',
            'reconciliation',
          ],
          session_id: session,
        },
      }).expect(201)
    ).body;
    expect(c.data.sources.metrics).toMatchObject({
      'accounting.count': 1,
      'observations.count': 1,
      'reconciliation.count': 1,
      'reconciliation.unresolved': 0,
    });
    expect(
      c.data.sources.tables.find((s: any) => s.family === 'reconciliation')
        .rows[0],
    ).toContain('accepted');
    const after = (
      await api(
        'get',
        prefix + `/inventory-sessions/${session}/reconciliations`,
      ).expect(200)
    ).body;
    expect(after.items[0].id).toBe(rec.id);
    expect(
      (
        await ds
          .getRepository(InventoryConsolidationEntity)
          .findOneByOrFail({ reconciliationId: rec.id })
      ).notes,
    ).toBe('SINTETICO decisao preservada');
    await post('', {
      ...command(),
      template_version_id: t.publishedVersionId,
      title: 'SINTETICO Sessao externa',
      selection: { families: ['observations'], session_id: 999999 },
    }).expect(400);
  });
  it('keeps every revision in SQL and archives only the document header state', async () => {
    const count = await ds
      .getRepository(TechnicalReportVersion)
      .count({ where: { reportId: r.id } });
    expect(count).toBeGreaterThanOrEqual(7);
    r = (
      await post('/' + r.id + '/transitions', {
        ...command(),
        revision: r.revision,
        action: 'archive',
      }).expect(201)
    ).body;
    expect(r.status).toBe('archived');
    await api('put', base() + '/' + r.id, editBody()).expect(409);
    expect(
      (await get(`/${r.id}/versions/${approved.id}`).expect(200)).body.hash,
    ).toBe(approved.hash);
  });
  it('custom read permission permits the list but never grants editing, approval or export', async () => {
    const role = await ds
        .getRepository(RoleEntity)
        .findOneByOrFail({ name: 'Operador' }),
      permission = await ds
        .getRepository(PermissionEntity)
        .findOneByOrFail({ key: 'technical-reports:read' });
    await ds
      .getRepository(RolePermissionEntity)
      .save({ roleId: role.id, permissionId: permission.id });
    try {
      const reader = await loginAsOrgUser(app);
      await get('', reader).expect(200);
      await api('put', base() + '/' + r.id, editBody(), reader).expect(403);
      await post(
        '/' + r.id + '/transitions',
        { ...command(), revision: r.revision, action: 'review' },
        reader,
      ).expect(403);
      await get(`/${r.id}/versions/${approved.id}/export`, reader).expect(403);
    } finally {
      await ds
        .getRepository(RolePermissionEntity)
        .delete({ roleId: role.id, permissionId: permission.id });
    }
  });
  it('archives templates without changing published snapshots or allowing new documents from them', async () => {
    t = (
      await post('/templates/' + t.id + '/archive', {
        ...command(),
        revision: t.revision,
      }).expect(201)
    ).body;
    expect(t.archived).toBe(true);
    await post('', {
      ...command(),
      template_version_id: t.publishedVersionId,
      title: 'SINTETICO Modelo arquivado',
      selection: { families: ['identity'] },
    }).expect(400);
    expect(
      (await get(`/${r.id}/versions/${approved.id}`).expect(200)).body.hash,
    ).toBe(approved.hash);
  });
});
