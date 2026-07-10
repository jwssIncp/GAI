import { INestApplication } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';
import { OrganizationStatus } from '../../../src/modules/organizations/domain/enums/organization-status.enum';
import { OrganizationEntity } from '../../../src/modules/organizations/infrastructure/persistence/organization.entity';
import { createTestApp, seedTestData } from '../test-app.helper';

describe('Auth - Organization gate (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
    await seedTestData(app);

    const orgRepo = app.get(getRepositoryToken(OrganizationEntity));
    await orgRepo.update(
      { cnpj: '11222333000181' },
      { status: OrganizationStatus.INACTIVE },
    );
  });

  afterAll(async () => {
    await app.close();
  });

  it('blocks login when organization is inactive', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ identifier: 'test.user', password: 'Test@123456' })
      .expect(401);
  });
});
