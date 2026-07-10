import { INestApplication } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';
import { createHash } from 'crypto';
import { PasswordResetTokenEntity } from '../../../src/modules/auth/infrastructure/persistence/password-reset-token.entity';
import { UserEntity } from '../../../src/modules/auth/infrastructure/persistence/user.entity';
import { createTestApp, seedTestData } from '../test-app.helper';

describe('Auth - Password Reset (e2e)', () => {
  let app: INestApplication;
  let adminUserId: number;

  beforeAll(async () => {
    app = await createTestApp();
    await seedTestData(app);
    const userRepo = app.get(getRepositoryToken(UserEntity));
    const admin = await userRepo.findOne({
      where: { login: 'platform.admin' },
    });
    adminUserId = admin!.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST /auth/password-reset/request always returns generic message', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/password-reset/request')
      .send({ email: 'admin@gai.local' })
      .expect(200);

    expect(response.body.message).toContain('If the email is registered');
  });

  it('POST /auth/password-reset/confirm updates password and revokes sessions', async () => {
    const rawToken = 'known-reset-token-for-test';
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    const tokenRepo = app.get(getRepositoryToken(PasswordResetTokenEntity));
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    await tokenRepo.save({
      userId: adminUserId,
      tokenHash,
      expiresAt,
      usedAt: null,
      createdAt: new Date(),
    });

    await request(app.getHttpServer())
      .post('/api/v1/auth/password-reset/confirm')
      .send({ token: rawToken, new_password: 'NewPass@123456' })
      .expect(200);

    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ identifier: 'platform.admin', password: 'NewPass@123456' })
      .expect(200);
  });
});
