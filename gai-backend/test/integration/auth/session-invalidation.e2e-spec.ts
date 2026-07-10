import { INestApplication } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';
import { IsNull, MoreThan, Repository } from 'typeorm';
import { UserStatus } from '../../../src/modules/auth/domain/enums/user.enums';
import { SessionEntity } from '../../../src/modules/auth/infrastructure/persistence/session.entity';
import { UserEntity } from '../../../src/modules/auth/infrastructure/persistence/user.entity';
import { Argon2PasswordHasher } from '../../../src/modules/auth/infrastructure/security/argon2-password-hasher';
import { OrganizationStatus } from '../../../src/modules/organizations/domain/enums/organization-status.enum';
import { OrganizationEntity } from '../../../src/modules/organizations/infrastructure/persistence/organization.entity';
import {
  createTestApp,
  loginAsAdmin,
  loginAsOrgUser,
  seedTestData,
} from '../test-app.helper';

describe('Auth - Session invalidation on status changes (e2e)', () => {
  let app: INestApplication;
  let platformToken: string;
  let primaryOrganization: OrganizationEntity;
  let secondaryOrganization: OrganizationEntity;
  let userRepo: Repository<UserEntity>;
  let organizationRepo: Repository<OrganizationEntity>;
  let sessionRepo: Repository<SessionEntity>;

  async function login(identifier: string, password: string): Promise<string> {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ identifier, password })
      .expect(200);

    return (response.body as { access_token: string }).access_token;
  }

  beforeAll(async () => {
    app = await createTestApp();
    await seedTestData(app);

    userRepo = app.get<Repository<UserEntity>>(getRepositoryToken(UserEntity));
    organizationRepo = app.get<Repository<OrganizationEntity>>(
      getRepositoryToken(OrganizationEntity),
    );
    sessionRepo = app.get<Repository<SessionEntity>>(
      getRepositoryToken(SessionEntity),
    );

    primaryOrganization = await organizationRepo.findOneByOrFail({
      cnpj: '11222333000181',
    });

    const now = new Date();
    secondaryOrganization = await organizationRepo.save(
      organizationRepo.create({
        legalName: 'Secondary Session Organization',
        tradeName: 'Secondary Session Org',
        cnpj: '55666777000188',
        contactEmail: 'secondary@gai.local',
        contactPhone: null,
        status: OrganizationStatus.ACTIVE,
        createdAt: now,
        updatedAt: now,
      }),
    );

    const hasher = new Argon2PasswordHasher();
    await userRepo.save(
      userRepo.create({
        organizationId: secondaryOrganization.id,
        login: 'secondary.session.user',
        email: 'secondary.session@gai.local',
        passwordHash: await hasher.hash('Secondary@123456'),
        status: UserStatus.ACTIVE,
        failedLoginAttempts: 0,
        lockedUntil: null,
        passwordChangedAt: now,
        createdAt: now,
        updatedAt: now,
      }),
    );

    platformToken = await loginAsAdmin(app);
  });

  afterAll(async () => {
    await app.close();
  });

  it('revokes every user session and requires login after reactivation', async () => {
    const user = await userRepo.findOneByOrFail({ login: 'test.user' });
    const firstToken = await loginAsOrgUser(app);
    const secondToken = await loginAsOrgUser(app);

    await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${firstToken}`)
      .expect(200);

    await request(app.getHttpServer())
      .post(`/api/v1/users/${user.id}/deactivate`)
      .set('Authorization', `Bearer ${platformToken}`)
      .expect(200);

    for (const token of [firstToken, secondToken]) {
      await request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(401);

      const session = await sessionRepo.findOneByOrFail({ id: token });
      expect(session.revokedAt).toBeInstanceOf(Date);
    }

    await request(app.getHttpServer())
      .post(`/api/v1/users/${user.id}/activate`)
      .set('Authorization', `Bearer ${platformToken}`)
      .expect(200);

    for (const token of [firstToken, secondToken]) {
      await request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(401);
    }

    const newToken = await loginAsOrgUser(app);
    await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${newToken}`)
      .expect(200);
  });

  it('revokes only sessions from the deactivated organization', async () => {
    const primaryToken = await login('org.admin', 'Admin@123456');
    const secondaryToken = await login(
      'secondary.session.user',
      'Secondary@123456',
    );

    for (const token of [primaryToken, secondaryToken]) {
      await request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
    }

    await request(app.getHttpServer())
      .post(`/api/v1/organizations/${primaryOrganization.id}/deactivate`)
      .set('Authorization', `Bearer ${platformToken}`)
      .expect(200);

    await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${primaryToken}`)
      .expect(401);

    await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${secondaryToken}`)
      .expect(200);

    const primaryActiveSessions = await sessionRepo.count({
      where: {
        organizationId: primaryOrganization.id,
        revokedAt: IsNull(),
        expiresAt: MoreThan(new Date()),
      },
    });
    const secondaryActiveSessions = await sessionRepo.count({
      where: {
        organizationId: secondaryOrganization.id,
        revokedAt: IsNull(),
        expiresAt: MoreThan(new Date()),
      },
    });
    expect(primaryActiveSessions).toBe(0);
    expect(secondaryActiveSessions).toBeGreaterThan(0);

    await request(app.getHttpServer())
      .post(`/api/v1/organizations/${primaryOrganization.id}/activate`)
      .set('Authorization', `Bearer ${platformToken}`)
      .expect(200);

    await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${primaryToken}`)
      .expect(401);

    const newPrimaryToken = await login('org.admin', 'Admin@123456');
    await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${newPrimaryToken}`)
      .expect(200);
  });
});
