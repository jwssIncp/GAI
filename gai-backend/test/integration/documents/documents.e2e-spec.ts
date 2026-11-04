import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import request from 'supertest';
import { createHash, randomUUID } from 'node:crypto';
import { PDFDocument } from 'pdf-lib';
import { unzipSync, strFromU8 } from 'fflate';
import {
  createTestApp,
  seedTestData,
  loginAsOrgAdmin,
  loginAsOrgUser,
  loginAsAdmin,
} from '../test-app.helper';
import { templateFixture } from '../../unit/modules/technical-reports/report.fixtures';
import {
  testBudget,
  testPricing,
} from '../../unit/modules/budgets/budget.fixtures';
import {
  DocumentArtifact,
  DocumentAudit,
} from '../../../src/modules/documents/document.entity';
import { TechnicalReportVersion } from '../../../src/modules/technical-reports/report.entity';
import { DEFAULT_VISUAL } from '../../../src/modules/documents/document.contract';
import { PermissionEntity } from '../../../src/modules/users/infrastructure/persistence/permission.entity';
describe('Professional documents, real HTTP and private files', () => {
  let app: INestApplication,
    ds: DataSource,
    token: string,
    user: string,
    project: number,
    report: any,
    version: any,
    budget: any,
    pdf: any,
    docx: any;
  const cmd = () => ({
    command_key: randomUUID(),
    reason: 'SINTETICO validação documental',
  });
  const api = (
    method: 'get' | 'post' | 'put',
    path: string,
    data: object = {},
    auth = token,
  ) =>
    request(app.getHttpServer())
      [method]('/api/v1' + path)
      .set('Authorization', 'Bearer ' + auth)
      .send(data);
  const base = () => `/projects/${project}/technical-reports`;
  const documents = () =>
    `${base()}/${report.id}/versions/${version.id}/documents`;
  const visual = () => {
    const { version: _version, ...dto } = DEFAULT_VISUAL;
    return {
      ...dto,
      organization_name: 'SINTETICO Organização A',
      primary_color: '#204560',
    };
  };
  beforeAll(async () => {
    app = await createTestApp();
    await seedTestData(app);
    ds = app.get(DataSource);
    token = await loginAsOrgAdmin(app);
    user = await loginAsOrgUser(app);
    project = (
      await api('post', '/projects', {
        organization_id: 1,
        company_id: 1,
        name: 'SINTETICO Documentos nativos',
      }).expect(201)
    ).body.id;
    await api('post', '/organizations/1/document-templates', visual()).expect(
      201,
    );
    const data = templateFixture();
    data.rules.responsible_required = false;
    data.sections[1].text =
      'Conclusão técnica de João · São Luís · R$ 1.234,56';
    let template = (
      await api('post', base() + '/templates', { ...cmd(), data }).expect(201)
    ).body;
    template = (
      await api('post', `${base()}/templates/${template.id}/publish`, {
        ...cmd(),
        revision: template.revision,
      }).expect(201)
    ).body;
    report = (
      await api('post', base(), {
        ...cmd(),
        title: 'SINTETICO Laudo aprovado',
        template_version_id: template.publishedVersionId,
        selection: { families: ['identity'] },
      }).expect(201)
    ).body;
    report = (
      await api('post', `${base()}/${report.id}/transitions`, {
        ...cmd(),
        revision: report.revision,
        action: 'review',
      }).expect(201)
    ).body;
    report = (
      await api('post', `${base()}/${report.id}/transitions`, {
        ...cmd(),
        revision: report.revision,
        action: 'approve',
      }).expect(201)
    ).body;
    version = await ds.manager.findOneByOrFail(TechnicalReportVersion, {
      id: report.approvedVersionId,
    });
    const pricing = (
      await api('post', '/budgets/pricing', testPricing()).expect(201)
    ).body;
    budget = (
      await api(
        'post',
        '/budgets',
        testBudget({ pricing_id: pricing.id, project_id: project }),
      ).expect(201)
    ).body;
  });
  afterAll(async () => {
    await app?.close();
  });
  it('requires authentication, export permission, organization and exact parent version', async () => {
    await request(app.getHttpServer())
      .post('/api/v1' + documents())
      .send({ format: 'pdf' })
      .expect(401);
    await api('post', documents(), { format: 'pdf' }, user).expect(403);
    await api(
      'post',
      documents().replace(
        `/technical-reports/${report.id}/`,
        '/technical-reports/999999/',
      ),
      { format: 'pdf' },
    ).expect(404);
    await api(
      'post',
      documents().replace(`/versions/${version.id}/`, '/versions/999999/'),
      { format: 'pdf' },
    ).expect(404);
    await api(
      'post',
      documents().replace(`/projects/${project}/`, '/projects/999999/'),
      { format: 'pdf' },
    ).expect(404);
    await api('get', '/organizations/2/document-templates').expect(403);
  });
  it('rejects unsupported formats, work-in-progress versions and arbitrary template content', async () => {
    await api('post', documents(), { format: 'html' }).expect(400);
    const draft = await ds.manager.findOneOrFail(TechnicalReportVersion, {
      where: { reportId: report.id, status: 'draft' },
    });
    await api(
      'post',
      documents().replace(`/versions/${version.id}/`, `/versions/${draft.id}/`),
      { format: 'pdf' },
    ).expect(409);
    await api('post', '/organizations/1/document-templates', {
      ...visual(),
      header: '<script>alert(1)</script>',
    }).expect(400);
    await api('post', '/organizations/1/document-templates', {
      ...visual(),
      logo_png: 'https://internal.example/logo.png',
    }).expect(400);
  });
  it('denies cross-organization paths and versions from another real project', async () => {
    const platform = await loginAsAdmin(app);
    const org = (
      await api(
        'post',
        '/organizations',
        {
          legal_name: 'SINTETICO Organização externa',
          trade_name: 'Externa',
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
    const foreign = (
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
    await api(
      'post',
      documents().replace(`/projects/${project}/`, `/projects/${foreign}/`),
      { format: 'pdf' },
    ).expect(403);
    const other = (
      await api('post', '/projects', {
        organization_id: 1,
        company_id: 1,
        name: 'SINTETICO Outro projeto',
      }).expect(201)
    ).body.id;
    await api(
      'post',
      documents().replace(`/projects/${project}/`, `/projects/${other}/`),
      { format: 'pdf' },
    ).expect(404);
  });
  it('generates real PDF and DOCX, reuses concurrent requests and audits each requester', async () => {
    const results = await Promise.all([
      api('post', documents(), { format: 'pdf' }).expect(201),
      api('post', documents(), { format: 'pdf' }).expect(201),
    ]);
    pdf = results[0].body;
    expect(results[1].body.id).toBe(pdf.id);
    docx = (await api('post', documents(), { format: 'docx' }).expect(201))
      .body;
    expect(pdf.visual_version).toBe(version.data.visual_template.version);
    expect(await ds.manager.count(DocumentArtifact)).toBe(2);
    expect(
      await ds.manager.count(DocumentAudit, {
        where: { operation: 'generated' },
      }),
    ).toBe(3);
  });
  it('downloads only through authenticated version-bound endpoints with exact file integrity', async () => {
    const f = await api('get', documents() + '/' + pdf.id).expect(200);
    expect(f.headers['cache-control']).toBe('private, no-store');
    expect(f.headers['content-type']).toContain('application/pdf');
    expect(f.body.subarray(0, 5).toString()).toBe('%PDF-');
    expect(createHash('sha256').update(f.body).digest('hex')).toBe(
      pdf.checksum,
    );
    expect((await PDFDocument.load(f.body)).getPageCount()).toBeGreaterThan(1);
    const word = await api('get', documents() + '/' + docx.id)
      .buffer(true)
      .parse((res, cb) => {
        const chunks: Buffer[] = [];
        res.on('data', (c) => chunks.push(Buffer.from(c)));
        res.on('end', () => cb(null, Buffer.concat(chunks)));
      })
      .expect(200);
    expect(strFromU8(unzipSync(word.body)['word/document.xml'])).toContain(
      'Conclusão técnica de João',
    );
    await api('get', documents() + '/' + pdf.id, {}, user).expect(403);
    await api('get', documents() + '/999999').expect(404);
  });
  it('keeps approved content and visual identity unchanged after publication and reopening', async () => {
    const before = JSON.stringify(version.data);
    await api('post', '/organizations/1/document-templates', {
      ...visual(),
      organization_name: 'SINTETICO Novo modelo',
    }).expect(201);
    const regenerated = (
      await api('post', documents(), { format: 'pdf' }).expect(201)
    ).body;
    expect(regenerated.id).toBe(pdf.id);
    expect(regenerated.checksum).toBe(pdf.checksum);
    report = (
      await api('post', `${base()}/${report.id}/transitions`, {
        ...cmd(),
        revision: report.revision,
        action: 'reopen',
      }).expect(201)
    ).body;
    expect(
      (await api('post', documents(), { format: 'docx' }).expect(201)).body.id,
    ).toBe(docx.id);
    expect(
      JSON.stringify(
        (
          await ds.manager.findOneByOrFail(TechnicalReportVersion, {
            id: version.id,
          })
        ).data,
      ),
    ).toBe(before);
  });
  it('uses the selected commercial version, labels drafts and excludes internal calculation by default', async () => {
    const endpoint = `/budgets/${budget.id}/versions/${budget.headVersionId}/proposal-documents`;
    const meta = (await api('post', endpoint, { format: 'docx' }).expect(201))
      .body;
    expect(meta.status).toContain('NÃO APROVADO');
    const artifact = await ds.manager
      .getRepository(DocumentArtifact)
      .createQueryBuilder('a')
      .addSelect('a.bytes')
      .where('a.id=:id', { id: meta.id })
      .getOneOrFail();
    const text = strFromU8(unzipSync(artifact.bytes)['word/document.xml']);
    expect(text).toContain('Escopo exclusivamente sintético');
    expect(text).not.toContain('Memória de cálculo interna');
    expect(text).not.toContain('Comissão:');
    const memory = (
      await api('post', endpoint, {
        format: 'docx',
        include_memory: true,
      }).expect(201)
    ).body;
    expect(memory.id).not.toBe(meta.id);
    expect(memory.include_memory).toBe(true);
    await api(
      'post',
      endpoint.replace(
        `/versions/${budget.headVersionId}/`,
        '/versions/999999/',
      ),
      { format: 'pdf' },
    ).expect(404);
  });
  it('detects corrupted private files and denies revoked source permission at download', async () => {
    await ds.manager.update(
      DocumentArtifact,
      { id: pdf.id },
      { bytes: Buffer.from('corrupted') },
    );
    await api('get', documents() + '/' + pdf.id).expect(409);
    const permission = await ds.manager.findOneByOrFail(PermissionEntity, {
      key: 'companies:read',
    });
    await ds.manager.update(
      PermissionEntity,
      { id: permission.id },
      { key: 'companies:revoked-test' },
    );
    try {
      await api('get', documents() + '/' + docx.id).expect(403);
    } finally {
      await ds.manager.update(
        PermissionEntity,
        { id: permission.id },
        { key: 'companies:read' },
      );
    }
  });
});
