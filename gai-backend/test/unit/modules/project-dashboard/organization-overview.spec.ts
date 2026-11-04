import { DataSource, EntitySchema, Repository } from 'typeorm';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { OrganizationOverviewService } from '../../../../src/modules/project-dashboard/application/services/organization-overview.service';
import { OrganizationOverviewQueryDto } from '../../../../src/modules/project-dashboard/application/dto/organization-overview-query.dto';
import {
  OrganizationOverviewController,
  safeSpreadsheetText,
} from '../../../../src/modules/project-dashboard/presentation/organization-overview.controller';
import { ProjectScopeService } from '../../../../src/modules/projects/application/services/project-scope.service';
import { ProjectEntity } from '../../../../src/modules/projects/infrastructure/persistence/project.entity';
import { UserRole } from '../../../../src/modules/auth/domain/enums/user.enums';
import * as XLSX from 'xlsx';

describe('Organization overview isolation and exports', () => {
  let db: DataSource;
  let service: OrganizationOverviewService;
  const actor = { id: 1, organizationId: 1, systemRoles: [UserRole.ORG_ADMIN] };
  beforeAll(async () => {
    db = await new DataSource({
      type: 'sqlite',
      database: ':memory:',
      synchronize: true,
      entities: [
        new EntitySchema({
          name: 'OverviewProject',
          tableName: 'projects',
          columns: {
            id: { type: Number, primary: true },
            organizationId: { type: Number, name: 'organization_id' },
            name: { type: String },
            status: { type: String },
            companyId: { type: Number, name: 'company_id', nullable: true },
            createdAt: { type: Date, name: 'created_at' },
            deletedAt: {
              type: Date,
              name: 'deleted_at',
              nullable: true,
              deleteDate: true,
            },
          },
        }),
      ],
    }).initialize();
    const repository = db.getRepository('OverviewProject');
    await repository.insert([
      {
        id: 1,
        organizationId: 1,
        companyId: 10,
        name: 'Projeto próprio',
        status: 'active',
        createdAt: new Date('2026-01-05T12:00:00Z'),
      },
      {
        id: 2,
        organizationId: 2,
        name: 'Segredo de outra organização',
        status: 'active',
        createdAt: new Date('2026-01-06T12:00:00Z'),
      },
      {
        id: 3,
        organizationId: 1,
        name: 'Excluído',
        status: 'active',
        createdAt: new Date(),
        deletedAt: new Date(),
      },
      {
        id: 4,
        organizationId: 1,
        name: '=HYPERLINK("malicioso")',
        status: 'finished',
        createdAt: new Date('2026-02-05T12:00:00Z'),
      },
    ]);
    await db.query(
      'CREATE TABLE companies (id INTEGER PRIMARY KEY, organization_id INTEGER, name TEXT, deleted_at DATETIME)',
    );
    await db.query(
      "INSERT INTO companies VALUES (10,1,'Empresa local',NULL),(20,2,'Empresa sigilosa',NULL)",
    );
    await db.query(
      'CREATE TABLE company_units (id INTEGER PRIMARY KEY, organization_id INTEGER, state TEXT, deleted_at DATETIME)',
    );
    await db.query(
      "INSERT INTO company_units VALUES (1,1,'SP',NULL),(2,1,'SP',NULL),(3,2,'RJ',NULL),(4,1,'MG','2026-01-01')",
    );
    await db.query(
      'CREATE TABLE project_units (id INTEGER PRIMARY KEY, project_id INTEGER, company_unit_id INTEGER, organization_id INTEGER, deleted_at DATETIME)',
    );
    await db.query(
      'INSERT INTO project_units VALUES (1,1,1,1,NULL),(2,1,2,1,NULL),(3,1,3,1,NULL),(4,2,1,2,NULL),(5,1,4,1,NULL)',
    );
    service = new OrganizationOverviewService(
      repository as unknown as Repository<ProjectEntity>,
      new ProjectScopeService(),
    );
  });
  afterAll(async () => {
    await db?.destroy();
  });

  it('cross-filters UF and company without duplicates or cross-organization unit links', async () => {
    expect(
      (await service.exportRows({ state: 'SP', company_id: 10 }, actor)).map(
        (r) => r.ID,
      ),
    ).toEqual([1]);
    expect(await service.exportRows({ state: 'RJ' }, actor)).toEqual([]);
    expect(await service.exportRows({ state: 'MG' }, actor)).toEqual([]);
    expect(await service.exportRows({ company_id: 20 }, actor)).toEqual([]);
    expect(
      await service.exportRows(
        { state: 'SP' },
        { ...actor, organizationId: 2 },
      ),
    ).toEqual([]);
  });
  it('paginates and sorts projects in SQL and scopes company names/addresses', async () => {
    const first = await service.projectPage(
      { page_size: 1, sort: 'id', direction: 'ASC' },
      actor,
    );
    expect(first.total).toBe(2);
    expect(first.items[0].id).toBe(1);
    expect(first.items[0].company).toBe('Empresa local');
    expect(first.items[0].addresses).toBe(2);
    expect(first.items[0].states).toBe('SP');
    const second = await service.projectPage(
      { page: 2, page_size: 1, sort: 'id', direction: 'ASC' },
      actor,
    );
    expect(second.items.map((p) => p.id)).toEqual([4]);
    expect(
      (await service.projectPage({ page: 999, page_size: 1 }, actor)).page,
    ).toBe(2);
    for (const sort of ['company', 'addresses', 'states']) {
      expect(
        (
          await service.projectPage({ sort, direction: 'ASC' }, actor)
        ).items.map((row) => row.id),
      ).toEqual([4, 1]);
    }
  });
  it('groups companies with a real unlinked bucket, search and pagination', async () => {
    const groups = await service.companyPage({}, actor);
    expect(groups.total).toBe(2);
    expect(groups.items.reduce((sum, row) => sum + row.total, 0)).toBe(2);
    expect(groups.items.map((row) => row.name)).not.toContain(
      'Empresa sigilosa',
    );
    expect(
      (await service.companyPage({ company_search: 'local' }, actor)).items,
    ).toEqual([{ id: 10, name: 'Empresa local', total: 1 }]);
    expect(
      (await service.companyPage({ page_size: 1 }, actor)).items,
    ).toHaveLength(1);
  });

  it('scopes actual SQL to the authenticated organization and excludes deleted projects', async () => {
    const rows = await service.exportRows({}, actor);
    expect(rows.map((r) => r.ID)).toEqual([1, 4]);
    const other = await service.exportRows({}, { ...actor, organizationId: 2 });
    expect(other.map((r) => r.ID)).toEqual([2]);
  });
  it('ignores injected organization identifiers and combines name/status/date filters', async () => {
    const filters = {
      organization_id: 2,
      search: 'Projeto',
      status: 'active',
      date_from: '2026-01-01',
      date_to: '2026-01-31',
    } as OrganizationOverviewQueryDto;
    expect((await service.exportRows(filters, actor)).map((r) => r.ID)).toEqual(
      [1],
    );
    expect(await service.exportRows({ search: '%' }, actor)).toEqual([]);
    expect(await service.exportRows({ search: 'Segredo' }, actor)).toEqual([]);
  });
  it('rejects other roles, missing organization and reversed date ranges', async () => {
    for (const systemRoles of [
      [UserRole.ORG_USER],
      [UserRole.PLATFORM_ADMIN],
      [],
    ]) {
      await expect(
        service.exportRows({}, { ...actor, systemRoles }),
      ).rejects.toThrow('Organization administrator required');
    }
    await expect(
      service.exportRows({}, { ...actor, organizationId: null }),
    ).rejects.toThrow();
    await expect(
      service.exportRows(
        { date_from: '2026-02-01', date_to: '2026-01-01' },
        actor,
      ),
    ).rejects.toThrow();
  });
  it('validates impossible dates, invalid statuses and date/month/year ranges', async () => {
    for (const input of [
      { month: 13 },
      { year: 1899 },
      { status: 'invalid' },
      { date_from: '2026-02-30' },
      { date_to: '2026-01-01T00:00:00Z' },
      { state: 'XX' },
      { company_id: -1 },
      { page: 0 },
      { page_size: 101 },
      { sort: 'name; DROP TABLE projects' },
      { direction: 'invalid' },
    ]) {
      expect(
        (await validate(plainToInstance(OrganizationOverviewQueryDto, input)))
          .length,
      ).toBeGreaterThan(0);
    }
  });
  it('exports readable CSV and XLSX with the same scope and neutralized formulas', async () => {
    const controller = new OrganizationOverviewController(service);
    const response = {
      setHeader: jest.fn(),
      type: jest.fn().mockReturnThis(),
      send: jest.fn(),
    };
    const request = { user: actor };
    await controller.csv({}, request as never, response as never);
    const csv = response.send.mock.calls[0][0] as string;
    expect(csv.startsWith('\uFEFF')).toBe(true);
    expect(csv).toContain('Projeto próprio');
    expect(csv).not.toContain('Segredo');
    expect(csv).not.toContain('Excluído');
    expect(csv).toContain("'=HYPERLINK");
    response.send.mockClear();
    await controller.excel({}, request as never, response as never);
    const book = XLSX.read(response.send.mock.calls[0][0], { type: 'buffer' });
    const sheet = book.Sheets.Projetos;
    expect(XLSX.utils.sheet_to_json(sheet)).toHaveLength(2);
    expect(sheet.A2.t).toBe('n');
    expect(sheet.B3.f).toBeUndefined();
    expect(sheet.B3.v).toMatch(/^'=/);
  });
  it.each(['=1+1', '+1', '-1', '@SUM(A1)', ' \t=1', '\n=1'])(
    'neutralizes %p',
    (input) => {
      expect(safeSpreadsheetText(input)).toBe("'" + input);
    },
  );
});
