import { readFileSync } from 'fs';
import { join } from 'path';
import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { createTestApp } from '../test-app.helper';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const yaml = require('js-yaml') as { load: (text: string) => unknown };

const METHODS = ['get', 'post', 'put', 'patch', 'delete'] as const;
type Paths = Record<string, Partial<Record<(typeof METHODS)[number], unknown>>>;

const operations = (paths: Paths, prefix: string) =>
  Object.entries(paths).flatMap(([path, item]) =>
    METHODS.filter((method) => item[method]).map(
      (method) => `${method.toUpperCase()} ${prefix}${path}`,
    ),
  );

/** The official mobile contract must match the real router in both directions. */
describe('Onda 4: OpenAPI contract matches implemented routes', () => {
  let app: INestApplication;
  beforeAll(async () => {
    app = await createTestApp();
  }, 300000);
  afterAll(async () => {
    if (app) await app.close();
  });

  it('documents every /mobile route and nothing that does not exist', () => {
    const contract = yaml.load(
      readFileSync(
        join(
          __dirname,
          '../../../../docs/onda-4-homologacao-mobile/openapi.yaml',
        ),
        'utf8',
      ),
    ) as { openapi: string; paths: Paths };
    expect(contract.openapi).toBe('3.1.0');
    const generated = SwaggerModule.createDocument(
      app,
      new DocumentBuilder().build(),
    ) as unknown as { paths: Paths };
    const implemented = new Set(operations(generated.paths, ''));
    const documented = operations(contract.paths, '/api/v1');
    const missing = documented.filter((op) => !implemented.has(op));
    expect(missing).toEqual([]);
    const undocumented = [...implemented].filter(
      (op) => op.includes('/api/v1/mobile/') && !documented.includes(op),
    );
    expect(undocumented).toEqual([]);
  });
});
