import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { readFileSync } from 'fs';
import { join } from 'path';
import { ErrorResponseDto } from '../../src/common/swagger/error-response.dto';
import {
  createTestApp,
  loginAsAdmin,
  seedTestData,
} from '../integration/test-app.helper';

describe('Swagger OpenAPI fidelity (contract)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
    await seedTestData(app);
    await loginAsAdmin(app);
  });

  afterAll(async () => {
    await app.close();
  });

  it('generates OpenAPI document with organization paths and schemas', () => {
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle('GAI Backend API')
        .setVersion('1.1.0')
        .addBearerAuth()
        .build(),
      { extraModels: [ErrorResponseDto] },
    );

    const orgPath =
      document.paths['/api/v1/organizations'] ??
      document.paths['/organizations'];
    expect(orgPath).toBeDefined();
    expect(document.components?.schemas?.CreateOrganizationDto).toBeDefined();
    expect(document.components?.schemas?.OrganizationResponseDto).toBeDefined();
    expect(document.components?.schemas?.ErrorResponseDto).toBeDefined();

    const authPath =
      document.paths['/api/v1/auth/login'] ?? document.paths['/auth/login'];
    expect(authPath).toBeDefined();
    expect(document.components?.schemas?.LoginDto).toBeDefined();
    expect(document.components?.schemas?.LoginResponseDto).toBeDefined();
    expect(document.components?.schemas?.CurrentUserDto).toBeDefined();
  });

  it('matches contract field names and enums', () => {
    const contract = readFileSync(
      join(
        process.cwd(),
        'specs/002-organizations-crud/contracts/organizations-api.yaml',
      ),
      'utf8',
    );

    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle('GAI Backend API')
        .setVersion('1.1.0')
        .addBearerAuth()
        .build(),
    );

    const createSchema = document.components?.schemas
      ?.CreateOrganizationDto as {
      properties?: Record<string, unknown>;
    };

    expect(createSchema?.properties).toHaveProperty('legal_name');
    expect(createSchema?.properties).toHaveProperty('cnpj');
    expect(createSchema?.properties).toHaveProperty('trade_name');

    for (const field of [
      'legal_name',
      'cnpj',
      'status',
      'created_at',
      'page_size',
    ]) {
      expect(contract).toContain(field);
    }

    const authContract = readFileSync(
      join(process.cwd(), 'specs/001-user-auth/contracts/auth-api.yaml'),
      'utf8',
    );
    for (const field of [
      'access_token',
      'expires_at',
      'organization_id',
      'identifier',
    ]) {
      expect(authContract).toContain(field);
    }

    expect(document.components?.schemas?.LoginDto).toBeDefined();
    const loginSchema = document.components?.schemas?.LoginDto as {
      properties?: Record<string, unknown>;
    };
    expect(loginSchema?.properties).toHaveProperty('identifier');
    expect(loginSchema?.properties).toHaveProperty('password');

    expect(contract).toContain('ACTIVE');
    expect(contract).toContain('INACTIVE');
  });
});
