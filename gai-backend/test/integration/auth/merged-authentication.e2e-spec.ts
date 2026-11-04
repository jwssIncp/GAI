import { INestApplication } from '@nestjs/common';
import { createHash } from 'crypto';
import { DataSource } from 'typeorm';
import { createTestApp, seedTestData } from '../test-app.helper';
import { fixturePasswords } from '../../fixtures/passwords';
import { LoginUseCase } from '../../../src/modules/auth/application/use-cases/login.use-case';
import { RequestPasswordResetUseCase } from '../../../src/modules/auth/application/use-cases/request-password-reset.use-case';
import { ConfirmPasswordResetUseCase } from '../../../src/modules/auth/application/use-cases/confirm-password-reset.use-case';
import { UserEntity } from '../../../src/modules/auth/infrastructure/persistence/user.entity';
import { UserStatus } from '../../../src/modules/auth/domain/enums/user.enums';
import { OrganizationEntity } from '../../../src/modules/organizations/infrastructure/persistence/organization.entity';
import { OrganizationStatus } from '../../../src/modules/organizations/domain/enums/organization-status.enum';
import {
  EMAIL_SENDER,
  EmailSender,
} from '../../../src/modules/auth/domain/ports/email-sender.port';
import { PasswordResetTokenEntity } from '../../../src/modules/auth/infrastructure/persistence/password-reset-token.entity';
import { SessionEntity } from '../../../src/modules/auth/infrastructure/persistence/session.entity';

// Preserve develop's four authentication cases against the transactional service.
// Only delivery is mocked; authentication, persistence and rotation run for real.
describe('Authentication cases integrated from develop', () => {
  let app: INestApplication;
  let db: DataSource;
  let login: LoginUseCase;
  let user: UserEntity;

  beforeAll(async () => {
    app = await createTestApp();
    db = app.get(DataSource);
    await seedTestData(app);
    login = app.get(LoginUseCase);
    user = await db
      .getRepository(UserEntity)
      .findOneByOrFail({ login: 'org.admin' });
  });

  afterAll(async () => {
    jest.restoreAllMocks();
    await app?.close();
  });

  const authenticate = (
    identifier = 'org.admin',
    password = fixturePasswords.orgAdmin,
  ) => login.execute({ identifier, password }, '127.0.0.1');

  it('LoginUseCase handles unknown, inactive, locked and inactive org users', async () => {
    await expect(authenticate('unknown.merge.user')).rejects.toMatchObject({
      status: 401,
    });
    const users = db.getRepository(UserEntity);
    const organizations = db.getRepository(OrganizationEntity);
    try {
      await users.update(user.id, { status: UserStatus.INACTIVE });
      await expect(authenticate()).rejects.toMatchObject({ status: 401 });
      await users.update(user.id, {
        status: UserStatus.LOCKED,
        lockedUntil: new Date(Date.now() + 60_000),
      });
      await expect(authenticate()).rejects.toMatchObject({ status: 423 });
      await users.update(user.id, {
        status: UserStatus.ACTIVE,
        lockedUntil: null,
      });
      await organizations.update(user.organizationId!, {
        status: OrganizationStatus.INACTIVE,
      });
      await expect(authenticate()).rejects.toMatchObject({ status: 401 });
      expect(
        await db.getRepository(SessionEntity).countBy({ userId: user.id }),
      ).toBe(0);
    } finally {
      await users.update(user.id, {
        status: UserStatus.ACTIVE,
        lockedUntil: null,
      });
      await organizations.update(user.organizationId!, {
        status: OrganizationStatus.ACTIVE,
      });
    }
  });

  it('RequestPasswordResetUseCase sends email when user exists', async () => {
    const delivery = jest.spyOn(
      app.get<EmailSender>(EMAIL_SENDER),
      'sendPasswordResetEmail',
    );
    await app
      .get(RequestPasswordResetUseCase)
      .execute({ email: user.email }, '127.0.0.1');
    expect(delivery).toHaveBeenCalledTimes(1);
    const payload = delivery.mock.calls[0][0];
    expect(payload.to).toBe(user.email);
    const token = await db
      .getRepository(PasswordResetTokenEntity)
      .findOneByOrFail({
        tokenHash: createHash('sha256')
          .update(payload.resetToken)
          .digest('hex'),
      });
    expect(token).toMatchObject({
      userId: user.id,
      purpose: 'PASSWORD_RESET',
      usedAt: null,
    });
    expect(token.tokenHash).not.toBe(payload.resetToken);
    delivery.mockRestore();
  });

  it('LoginUseCase succeeds for organization user when org is active', async () => {
    const result = await authenticate();
    expect(result.user).toMatchObject({
      id: user.id,
      organization_id: user.organizationId,
    });
    expect(result.user.role_assignments.length).toBeGreaterThan(0);
    const session = await db
      .getRepository(SessionEntity)
      .findOneByOrFail({ id: result.access_token });
    expect(session).toMatchObject({
      userId: user.id,
      organizationId: user.organizationId,
      revokedAt: null,
    });
  });

  it('ConfirmPasswordResetUseCase updates password for valid token', async () => {
    const before = await authenticate();
    const delivery = jest.spyOn(
      app.get<EmailSender>(EMAIL_SENDER),
      'sendPasswordResetEmail',
    );
    await app
      .get(RequestPasswordResetUseCase)
      .execute({ email: user.email }, '127.0.0.1');
    const token = delivery.mock.calls[0][0].resetToken;
    const dto = { token, new_password: 'Merged reset passphrase 2026!' };
    const confirm = app.get(ConfirmPasswordResetUseCase);
    await confirm.execute(dto, '127.0.0.1');
    const rotated = await db
      .getRepository(UserEntity)
      .findOneByOrFail({ id: user.id });
    expect(rotated.authVersion).toBe(user.authVersion + 1);
    const oldSession = await db
      .getRepository(SessionEntity)
      .findOneByOrFail({ id: before.access_token });
    expect(oldSession.revokedAt).not.toBeNull();
    await expect(authenticate()).rejects.toMatchObject({ status: 401 });
    await expect(
      authenticate('org.admin', dto.new_password),
    ).resolves.toHaveProperty('access_token');
    await expect(confirm.execute(dto, '127.0.0.1')).rejects.toMatchObject({
      status: 401,
    });
    delivery.mockRestore();
  });
});
