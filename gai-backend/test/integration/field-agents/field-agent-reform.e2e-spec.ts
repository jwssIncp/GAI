import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import request from 'supertest';
import { randomUUID } from 'crypto';
import {
  createTestApp,
  loginAsAdmin,
  loginAsOrgAdmin,
  seedTestData,
} from '../test-app.helper';
import { FieldAgentEntity } from '../../../src/modules/field-agents/infrastructure/persistence/field-agent.entity';
import { ProjectFieldAgentEntity } from '../../../src/modules/field-agents/infrastructure/persistence/project-field-agent.entity';
import { FieldAgentAuditLogEntity } from '../../../src/modules/field-agents/infrastructure/persistence/field-agent-audit-log.entity';
import { OrganizationEntity } from '../../../src/modules/organizations/infrastructure/persistence/organization.entity';
import { OrganizationStatus } from '../../../src/modules/organizations/domain/enums/organization-status.enum';
import { UserEntity } from '../../../src/modules/auth/infrastructure/persistence/user.entity';
import { SessionEntity } from '../../../src/modules/auth/infrastructure/persistence/session.entity';
import { RoleEntity } from '../../../src/modules/users/infrastructure/persistence/role.entity';
import { UserStatus } from '../../../src/modules/auth/domain/enums/user.enums';
import { EMAIL_SENDER } from '../../../src/modules/auth/domain/ports/email-sender.port';
import { MockEmailSender } from '../../../src/modules/auth/infrastructure/email/ses-email.sender';
import { HardenFieldAgentIdentity1794300000001 } from '../../../src/migrations/1794300000001-harden-field-agent-identity';
import { requireOperationalAssignment } from '../../../src/modules/field-agents/application/services/operational-eligibility';
import { lockAccessAdministration } from '../../../src/modules/users/infrastructure/persistence/access-administration-lock';

describe('Field-agent reform security and lifecycle', () => {
  let app: INestApplication, db: DataSource, admin: string, platform: string;
  let projectId: number, sessionId: number, roundId: number, otherOrg: number;
  let serial = 0;
  const api = () => request(app.getHttpServer());
  const auth = () => ({ Authorization: `Bearer ${admin}` });
  const post = (path: string, body?: object) =>
    api()
      .post('/api/v1' + path)
      .set(auth())
      .send(body ?? {});
  const agent = async (extra: object = {}) =>
    (
      await post('/field-agents', {
        name: `SINTETICO Campo ${++serial}`,
        ...extra,
      }).expect(201)
    ).body as { id: number };
  const account = async () => {
    const source = await db
      .getRepository(UserEntity)
      .findOneByOrFail({ login: 'test.user' });
    const copy = db.getRepository(UserEntity).create({
      ...source,
      login: `campo${++serial}`,
      email: `campo${serial}@example.invalid`,
      organizationId: 1,
      status: UserStatus.ACTIVE,
    });
    delete (copy as Partial<UserEntity>).id;
    return db.getRepository(UserEntity).save(copy);
  };
  const observe = async (agentId: number) => {
    const item = await post(`/projects/${projectId}/inventory-items`, {
      description: `SINTETICO Item ${++serial}`,
    }).expect(201);
    return post(
      `/projects/${projectId}/inventory-sessions/${sessionId}/rounds/${roundId}/observations`,
      {
        inventory_item_id: item.body.id,
        field_agent_id: agentId,
        result: 'found',
      },
    );
  };
  beforeAll(async () => {
    app = await createTestApp();
    db = app.get(DataSource);
    await seedTestData(app);
    admin = await loginAsOrgAdmin(app);
    platform = await loginAsAdmin(app);
    const org = await db.getRepository(OrganizationEntity).save({
      legalName: 'SINTETICO Outro tenant',
      cnpj: '45723174000110',
      status: OrganizationStatus.ACTIVE,
    });
    otherOrg = org.id;
    projectId = (
      await post('/projects', {
        name: 'SINTETICO Reforma',
        organization_id: 1,
        company_id: 1,
      }).expect(201)
    ).body.id as number;
    sessionId = (
      await post(`/projects/${projectId}/inventory-sessions`, {
        name: 'SINTETICO Campanha',
      }).expect(201)
    ).body.id as number;
    roundId = (
      await post(
        `/projects/${projectId}/inventory-sessions/${sessionId}/start`,
      ).expect(200)
    ).body.round.id as number;
  }, 300000);
  afterAll(async () => {
    if (app) await app.close();
  });

  it('requires authentication, refuses platform, and refuses unprivileged accounts', async () => {
    await api().get('/api/v1/field-agents').expect(401);
    const row = await agent();
    for (const path of [
      '/field-agents',
      `/field-agents/${row.id}`,
      `/field-agents/${row.id}/history`,
      `/field-agents/${row.id}/projects`,
      '/field-agents/user-options',
      `/projects/${projectId}/field-agents`,
    ])
      await api()
        .get('/api/v1' + path)
        .set('Authorization', `Bearer ${platform}`)
        .expect(403);
    await api()
      .post('/api/v1/field-agents')
      .set('Authorization', `Bearer ${platform}`)
      .send({ name: 'SINTETICO Proibido' })
      .expect(403);
    for (const action of [
      'deactivate',
      'reactivate',
      'block',
      'unblock',
      'restore',
      'invite',
      'resend-invitation',
    ])
      await api()
        .post(`/api/v1/field-agents/${row.id}/${action}`)
        .set('Authorization', `Bearer ${platform}`)
        .send({})
        .expect(403);
    const user = await account(),
      token = randomUUID();
    await db.getRepository(SessionEntity).save({
      id: token,
      userId: user.id,
      organizationId: 1,
      expiresAt: new Date(Date.now() + 3600000),
      lastActivityAt: new Date(),
      revokedAt: null,
      authVersion: user.authVersion,
    });
    await api()
      .post('/api/v1/field-agents')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'SINTETICO Sem permissão' })
      .expect(403);
    await api()
      .patch(`/api/v1/field-agents/${row.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Alterado' })
      .expect(403);
  });
  it('rejects arbitrary organization and all cross-tenant management IDs', async () => {
    await post('/field-agents', {
      name: 'SINTETICO Tenant',
      organization_id: otherOrg,
    }).expect(400);
    const row = await db
      .getRepository(FieldAgentEntity)
      .save({ name: 'SINTETICO Outro', organizationId: otherOrg });
    await api()
      .get(`/api/v1/field-agents?organization_id=${otherOrg}`)
      .set(auth())
      .expect(403);
    await api()
      .patch(`/api/v1/field-agents/${row.id}`)
      .set(auth())
      .send({ name: 'SINTETICO Invasão' })
      .expect(403);
    await api()
      .delete(`/api/v1/field-agents/${row.id}`)
      .set(auth())
      .expect(403);
    for (const action of ['block', 'unblock', 'deactivate', 'reactivate'])
      await post(`/field-agents/${row.id}/${action}`).expect(403);
    for (const suffix of ['', '/record', '/history', '/projects'])
      await api()
        .get(`/api/v1/field-agents/${row.id}${suffix}`)
        .set(auth())
        .expect((r) => expect([403, 404]).toContain(r.status));
    await post(`/projects/${projectId}/field-agents`, {
      field_agent_id: row.id,
    }).expect(409);
    const own = await agent();
    await api()
      .patch(`/api/v1/field-agents/${own.id}`)
      .set(auth())
      .send({ organization_id: otherOrg })
      .expect(400);
  });
  it('associates only same-tenant accounts and serializes the one-to-one rule', async () => {
    const user = await account();
    const results = await Promise.all([
      post('/field-agents', {
        name: 'SINTETICO Concorrente A',
        user_id: user.id,
      }),
      post('/field-agents', {
        name: 'SINTETICO Concorrente B',
        user_id: user.id,
      }),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
    const other = await account();
    await db
      .getRepository(UserEntity)
      .update(other.id, { organizationId: otherOrg });
    await post('/field-agents', {
      name: 'SINTETICO Conta externa',
      user_id: other.id,
    }).expect(409);
    const options = await api()
      .get('/api/v1/field-agents/user-options?search=campo')
      .set(auth())
      .expect(200);
    expect(
      (options.body.items as Array<{ id: number }>).some(
        (u) => u.id === user.id || u.id === other.id,
      ),
    ).toBe(false);
  });
  it('prevents transfer of a linked account without silently disassociating it', async () => {
    const user = await account();
    const a = await agent({ user_id: user.id });
    const role = await db
      .getRepository(RoleEntity)
      .findOneByOrFail({ key: 'ORG_USER' });
    await api()
      .patch(`/api/v1/users/${user.id}`)
      .set('Authorization', `Bearer ${platform}`)
      .send({ organization_id: otherOrg, role_ids: [role.id] })
      .expect(409);
    expect(
      (await db.getRepository(FieldAgentEntity).findOneByOrFail({ id: a.id }))
        .userId,
    ).toBe(user.id);
    expect(
      (await db.getRepository(UserEntity).findOneByOrFail({ id: user.id }))
        .organizationId,
    ).toBe(1);
  });
  it('serializes concurrent binding and organization transfer without cross-tenant references', async () => {
    if (db.options.type !== 'mysql') return;
    const user = await account();
    const role = await db
      .getRepository(RoleEntity)
      .findOneByOrFail({ key: 'ORG_USER' });
    const runner = db.createQueryRunner();
    await runner.connect();
    await runner.startTransaction();
    let pending: Promise<request.Response[]> | undefined;
    try {
      await lockAccessAdministration(runner.manager);
      pending = Promise.all([
        post('/field-agents', {
          name: 'SINTETICO Transferência concorrente',
          user_id: user.id,
        }).then((r) => r),
        api()
          .patch(`/api/v1/users/${user.id}`)
          .set('Authorization', `Bearer ${platform}`)
          .send({ organization_id: otherOrg, role_ids: [role.id] })
          .then((r) => r),
      ]);
      let waiting = false;
      for (let attempt = 0; attempt < 150; attempt++) {
        const rows = await db.query(
          'SELECT COUNT(*) n FROM performance_schema.data_lock_waits',
        );
        if (Number(rows[0].n) >= 2) {
          waiting = true;
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
      expect(waiting).toBe(true);
      await runner.commitTransaction();
      const [binding, transfer] = await pending;
      expect([
        [201, 409],
        [409, 200],
      ]).toContainEqual([binding.status, transfer.status]);
      const current = await db
        .getRepository(UserEntity)
        .findOneByOrFail({ id: user.id });
      const linked = await db
        .getRepository(FieldAgentEntity)
        .findBy({ userId: user.id });
      expect(
        linked.every((row) => row.organizationId === current.organizationId),
      ).toBe(true);
    } finally {
      if (runner.isTransactionActive) await runner.rollbackTransaction();
      await runner.release();
      if (pending) await pending;
    }
  });
  it('persists explicit clearing of every optional project assignment field', async () => {
    const a = await agent();
    const link = await post(`/projects/${projectId}/field-agents`, {
      field_agent_id: a.id,
      role: 'Coleta',
      start_date: '2000-01-01',
      end_date: '2099-12-31',
      notes: 'SINTETICO Notas',
    }).expect(201);
    await api()
      .patch(`/api/v1/projects/${projectId}/field-agents/${link.body.id}`)
      .set(auth())
      .send({ role: null, start_date: null, end_date: null, notes: null })
      .expect(200);
    expect(
      await db
        .getRepository(ProjectFieldAgentEntity)
        .findOneByOrFail({ id: link.body.id as number }),
    ).toMatchObject({
      role: null,
      startDate: null,
      endDate: null,
      notes: null,
    });
  });
  it('preserves observation, financial and assignment history when blocked, inactive and deleted', async () => {
    const a = await agent();
    await post(`/projects/${projectId}/field-agents`, {
      field_agent_id: a.id,
    }).expect(201);
    expect((await observe(a.id)).status).toBe(201);
    await post(`/projects/${projectId}/payments`, {
      field_agent_id: a.id,
      state: 'SP',
      start_date: '2026-07-01',
      end_date: '2026-07-03',
      daily_rate: '100.00',
    }).expect(201);
    await post(`/projects/${projectId}/expenses`, {
      field_agent_id: a.id,
      description: 'SINTETICO Transporte',
      reason: 'Coleta',
      expense_date: '2026-07-02',
      amount: '25.50',
    }).expect(201);
    const tables = [
      'project_field_agents',
      'inventory_observations',
      'field_agent_payments',
      'expenses',
    ];
    const snapshot = async () =>
      Promise.all(
        tables.map((table) =>
          db.query(
            `SELECT * FROM ${table} WHERE field_agent_id=? ORDER BY id`,
            [a.id],
          ),
        ),
      );
    const before = await snapshot();
    const auditBefore = await db
      .getRepository(FieldAgentAuditLogEntity)
      .findBy({ fieldAgentId: a.id });
    await post(`/field-agents/${a.id}/block`).expect(200);
    expect(await snapshot()).toEqual(before);
    await post(`/field-agents/${a.id}/unblock`).expect(200);
    await post(`/field-agents/${a.id}/deactivate`).expect(200);
    expect(await snapshot()).toEqual(before);
    await api().delete(`/api/v1/field-agents/${a.id}`).set(auth()).expect(204);
    expect(await snapshot()).toEqual(before);
    for (const event of auditBefore)
      expect(
        await db
          .getRepository(FieldAgentAuditLogEntity)
          .findOneByOrFail({ id: event.id }),
      ).toEqual(event);
  });
  it('preserves invalid legacy documents when omitted and rejects new invalid writes', async () => {
    const a = await db.getRepository(FieldAgentEntity).save({
      organizationId: 1,
      name: 'SINTETICO Legado',
      document: 'LEGADO-INVALIDO',
    });
    await api()
      .patch(`/api/v1/field-agents/${a.id}`)
      .set(auth())
      .send({ name: 'SINTETICO Novo nome' })
      .expect(200);
    expect(
      (await db.getRepository(FieldAgentEntity).findOneByOrFail({ id: a.id }))
        .document,
    ).toBe('LEGADO-INVALIDO');
    await api()
      .patch(`/api/v1/field-agents/${a.id}`)
      .set(auth())
      .send({ document: 'LEGADO-INVALIDO' })
      .expect(400);
    await api()
      .patch(`/api/v1/field-agents/${a.id}`)
      .set(auth())
      .send({ document: null })
      .expect(200);
  });
  it('clears optional fields including user with explicit null and audits before/after', async () => {
    const user = await account();
    const a = await agent({
      user_id: user.id,
      email: 'clear@example.invalid',
      phone: '11999998888',
      document: '52998224725',
    });
    await api()
      .patch(`/api/v1/field-agents/${a.id}`)
      .set(auth())
      .send({ user_id: null, email: null, phone: null, document: null })
      .expect(200);
    expect(
      await db.getRepository(FieldAgentEntity).findOneByOrFail({ id: a.id }),
    ).toMatchObject({ userId: null, email: null, phone: null, document: null });
    const events = await api()
      .get(`/api/v1/field-agents/${a.id}/history`)
      .set(auth())
      .expect(200);
    expect(events.body.items[0].changes.user_id).toEqual({
      before: user.id,
      after: null,
    });
  });
  it('reserves identifiers of deleted records and restores explicitly as inactive', async () => {
    const a = await agent({ email: 'reserved@example.invalid' });
    await api().delete(`/api/v1/field-agents/${a.id}`).set(auth()).expect(204);
    await post('/field-agents', {
      name: 'SINTETICO Duplicado',
      email: 'reserved@example.invalid',
    }).expect(409);
    await post(`/field-agents/${a.id}/restore`)
      .expect(200)
      .expect((r) => expect(r.body.status).toBe('inactive'));
    expect(
      await db
        .getRepository(FieldAgentAuditLogEntity)
        .countBy({ fieldAgentId: a.id, operation: 'RESTORE' }),
    ).toBe(1);
  });
  it.each([
    'inactive',
    'blocked',
    'deleted',
    'unstarted',
    'expired',
    'inactive_link',
    'finished_link',
  ])(
    'prevents new observations for %s and keeps the association',
    async (state) => {
      const a = await agent();
      const assigned = await post(`/projects/${projectId}/field-agents`, {
        field_agent_id: a.id,
      }).expect(201);
      const linkId = assigned.body.id as number;
      if (state === 'inactive')
        await post(`/field-agents/${a.id}/deactivate`).expect(200);
      if (state === 'blocked')
        await post(`/field-agents/${a.id}/block`).expect(200);
      if (state === 'deleted')
        await api()
          .delete(`/api/v1/field-agents/${a.id}`)
          .set(auth())
          .expect(204);
      if (state === 'unstarted')
        await db
          .getRepository(ProjectFieldAgentEntity)
          .update(linkId, { startDate: new Date('2099-01-01T00:00:00Z') });
      if (state === 'expired')
        await db
          .getRepository(ProjectFieldAgentEntity)
          .update(linkId, { endDate: new Date('2000-01-01T00:00:00Z') });
      if (state === 'inactive_link')
        await api()
          .patch(`/api/v1/projects/${projectId}/field-agents/${linkId}`)
          .set(auth())
          .send({ status: 'inactive' })
          .expect(200);
      if (state === 'finished_link')
        await post(
          `/projects/${projectId}/field-agents/${linkId}/remove`,
        ).expect(200);
      expect((await observe(a.id)).status).toBe(409);
      expect(
        await db.getRepository(ProjectFieldAgentEntity).countBy({ id: linkId }),
      ).toBe(1);
    },
  );
  it('accepts an eligible agent without an account and never reactivates finished links', async () => {
    const a = await agent();
    const link = await post(`/projects/${projectId}/field-agents`, {
      field_agent_id: a.id,
    }).expect(201);
    expect((await observe(a.id)).status).toBe(201);
    await post(
      `/projects/${projectId}/field-agents/${link.body.id}/remove`,
    ).expect(200);
    await post(`/field-agents/${a.id}/deactivate`).expect(200);
    await post(`/field-agents/${a.id}/reactivate`).expect(200);
    expect(
      (
        await db
          .getRepository(ProjectFieldAgentEntity)
          .findOneByOrFail({ id: link.body.id as number })
      ).status,
    ).toBe('finished');
    expect((await observe(a.id)).status).toBe(409);
  });
  it('locks an agent against concurrent deactivation and checks its committed state', async () => {
    if (db.options.type !== 'mysql') return;
    const a = await agent();
    await post(`/projects/${projectId}/field-agents`, {
      field_agent_id: a.id,
    }).expect(201);
    const runner = db.createQueryRunner();
    await runner.connect();
    await runner.startTransaction();
    try {
      await runner.manager
        .getRepository(FieldAgentEntity)
        .findOne({ where: { id: a.id }, lock: { mode: 'pessimistic_write' } });
      const operation = db
        .transaction((manager) =>
          requireOperationalAssignment(manager, 1, projectId, a.id),
        )
        .then(
          () => 'allowed',
          () => 'rejected',
        );
      let waiting = false;
      for (let attempt = 0; attempt < 100; attempt++) {
        const rows = await db.query(
          'SELECT COUNT(*) n FROM performance_schema.data_lock_waits',
        );
        if (Number(rows[0].n) > 0) {
          waiting = true;
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
      expect(waiting).toBe(true);
      await runner.manager
        .getRepository(FieldAgentEntity)
        .update(a.id, { status: 'blocked' as FieldAgentEntity['status'] });
      await runner.commitTransaction();
      expect(await operation).toBe('rejected');
    } finally {
      if (runner.isTransactionActive) await runner.rollbackTransaction();
      await runner.release();
    }
  });
  it('creates invitation access atomically, reports delivery truthfully, and reuses activation', async () => {
    const a = await agent();
    const sender = app.get<MockEmailSender>(EMAIL_SENDER);
    await post(`/field-agents/${a.id}/invite`, {
      login: 'invited.campo',
      email: 'invited.campo@example.invalid',
    })
      .expect(201)
      .expect((r) => expect(r.body.invitation_delivery).toBe('DEVELOPMENT'));
    await post(`/field-agents/${a.id}/invite`, {
      login: 'invited.duplicate',
      email: 'invited.campo@example.invalid',
    }).expect(409);
    const invitation = sender.invitations.find(
      (value) => value.to === 'invited.campo@example.invalid',
    )!;
    const token = new URL(invitation.activationUrl).hash.slice(
      '#token='.length,
    );
    await api()
      .post('/api/v1/auth/activation/confirm')
      .send({
        token: decodeURIComponent(token),
        new_password: 'SINTETICO senha de campo 2026!',
      })
      .expect(200);
    const login = await api()
      .post('/api/v1/auth/login')
      .send({
        identifier: 'invited.campo',
        password: 'SINTETICO senha de campo 2026!',
      })
      .expect(200);
    const access = login.body.access_token as string;
    await api()
      .get('/api/v1/projects')
      .set('Authorization', `Bearer ${access}`)
      .expect(200)
      .expect((r) => expect(r.body.total_items).toBe(0));
    await api()
      .get(`/api/v1/projects/${projectId}`)
      .set('Authorization', `Bearer ${access}`)
      .expect(403);
    await post(`/projects/${projectId}/field-agents`, {
      field_agent_id: a.id,
    }).expect(201);
    await api()
      .get(`/api/v1/projects/${projectId}`)
      .set('Authorization', `Bearer ${access}`)
      .expect(200);
    await api()
      .get(`/api/v1/projects/${projectId}/payments`)
      .set('Authorization', `Bearer ${access}`)
      .expect(403);
    await post(`/field-agents/${a.id}/block`).expect(200);
    await api()
      .get(`/api/v1/projects/${projectId}`)
      .set('Authorization', `Bearer ${access}`)
      .expect(403);
    await api()
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${access}`)
      .expect(200);
  });
  it('records invitation failure without duplicate users and allows resend', async () => {
    const a = await agent();
    const sender = app.get<MockEmailSender>(EMAIL_SENDER);
    const spy = jest
      .spyOn(sender, 'sendInvitationEmail')
      .mockRejectedValueOnce(new Error('SINTETICO indisponível'));
    try {
      await post(`/field-agents/${a.id}/invite`, {
        login: 'failed.invite',
        email: 'failed.invite@example.invalid',
      })
        .expect(201)
        .expect((r) => expect(r.body.invitation_delivery).toBe('FAILED'));
    } finally {
      spy.mockRestore();
    }
    await post(`/field-agents/${a.id}/resend-invitation`)
      .expect(200)
      .expect((r) => expect(r.body.invitation_delivery).toBe('DEVELOPMENT'));
    expect(
      await db.getRepository(UserEntity).countBy({ login: 'failed.invite' }),
    ).toBe(1);
    expect(app.get(ConfigService).get('auth.useMockEmail')).toBe(true);
  });
  it('validates the real MySQL generated uniqueness and migration idempotence', async () => {
    if (db.options.type !== 'mysql') return;
    const user = await account();
    await agent({ user_id: user.id });
    await expect(
      db.query(
        "INSERT INTO field_agents (organization_id,user_id,name) VALUES (1,?,'SINTETICO SQL duplicado')",
        [user.id],
      ),
    ).rejects.toMatchObject({ driverError: { code: 'ER_DUP_ENTRY' } });
    const unlinked = await account();
    await expect(
      db.query(
        "INSERT INTO field_agents (organization_id,user_id,name) VALUES (?,?,'SINTETICO Escopo inválido')",
        [otherOrg, unlinked.id],
      ),
    ).rejects.toMatchObject({
      driverError: { code: 'ER_NO_REFERENCED_ROW_2' },
    });
    const target = await agent();
    await expect(
      db.query(
        'INSERT INTO project_field_agents (organization_id,project_id,field_agent_id) VALUES (?,?,?)',
        [otherOrg, projectId, target.id],
      ),
    ).rejects.toMatchObject({
      driverError: { code: 'ER_NO_REFERENCED_ROW_2' },
    });
    const runner = db.createQueryRunner();
    await runner.connect();
    try {
      await new HardenFieldAgentIdentity1794300000001().up(runner);
    } finally {
      await runner.release();
    }
  });
  it('reverses and reapplies the new migration without changing historical rows', async () => {
    if (db.options.type !== 'mysql') return;
    const before = await db.query(
      'SELECT id,organization_id,user_id,name,email,phone,document,status,metadata,created_at,updated_at,deleted_at FROM field_agents ORDER BY id',
    );
    const runner = db.createQueryRunner();
    await runner.connect();
    try {
      const migration = new HardenFieldAgentIdentity1794300000001();
      await migration.down(runner);
      await migration.up(runner);
      await migration.up(runner);
    } finally {
      await runner.release();
    }
    expect(
      await db.query(
        'SELECT id,organization_id,user_id,name,email,phone,document,status,metadata,created_at,updated_at,deleted_at FROM field_agents ORDER BY id',
      ),
    ).toEqual(before);
  });
});
