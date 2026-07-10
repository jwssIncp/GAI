import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, seedTestData } from '../test-app.helper';

describe('Auth - Brute force protection (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
    await seedTestData(app);
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns generic 401 and then 423 after repeated failures', async () => {
    for (let i = 0; i < 5; i++) {
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ identifier: 'platform.admin', password: 'WrongPass1!' });

      if (i < 4) {
        expect(response.status).toBe(401);
        expect(response.body.message).toBe('Invalid credentials');
      } else {
        expect(response.status).toBe(423);
      }
    }
  });
});
