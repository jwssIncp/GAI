const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  prepareDocumentTask,
  STORAGE_MIME_TYPES,
} = require('./prepare-document-task.cjs');

const fixture = () => ({
  family: 'synthetic-backend',
  cpu: '256',
  memory: '512',
  taskRoleArn: 'synthetic-task-role',
  containerDefinitions: [
    {
      name: 'gai-backend',
      image: 'synthetic:unchanged',
      environment: [
        { name: 'NODE_ENV', value: 'production' },
        { name: 'INVENTORY_ITEM_IMAGE_STORAGE_BUCKET', value: 'gai-assets-synthetic' },
      ],
      secrets: [{ name: 'DB_PASSWORD', valueFrom: 'synthetic-ssm' }],
      healthCheck: { command: ['CMD', 'synthetic'] },
    },
  ],
});

test('prepares document mode, storage envs, floors capacity and preserves secrets/image/health', () => {
  const input = fixture();
  const original = structuredClone(input);
  const result = prepareDocumentTask(input);
  assert.deepEqual(input, original);
  assert.equal(result.cpu, '1024');
  assert.equal(result.memory, '2048');
  assert.equal(result.taskRoleArn, input.taskRoleArn);
  const env = Object.fromEntries(
    result.containerDefinitions[0].environment.map((item) => [item.name, item.value]),
  );
  assert.equal(env.DOCUMENT_STORAGE, 'database');
  assert.equal(env.STORAGE_PROVIDER, 's3');
  assert.equal(env.STORAGE_BUCKET, 'gai-assets-synthetic');
  assert.equal(env.STORAGE_ALLOWED_MIME_TYPES, STORAGE_MIME_TYPES);
  assert.equal(env.INVENTORY_ITEM_IMAGE_STORAGE_BUCKET, 'gai-assets-synthetic');
  assert.equal(env.NODE_ENV, 'production');
  for (const key of ['image', 'secrets', 'healthCheck']) {
    assert.deepEqual(result.containerDefinitions[0][key], input.containerDefinitions[0][key]);
  }
  assert.deepEqual(prepareDocumentTask(result), result);
});

test('backfills STORAGE_* when an older revision only has inventory image bucket', () => {
  const input = fixture();
  const result = prepareDocumentTask(input);
  const names = result.containerDefinitions[0].environment.map((item) => item.name);
  for (const required of [
    'STORAGE_PROVIDER',
    'STORAGE_BUCKET',
    'STORAGE_PRESIGNED_URL_TTL_SECONDS',
    'STORAGE_MAX_SIZE_BYTES',
    'STORAGE_ALLOWED_MIME_TYPES',
    'STORAGE_FORCE_PATH_STYLE',
  ]) {
    assert.equal(names.filter((name) => name === required).length, 1);
  }
});

test('preserves higher valid resources and replaces stale document/storage modes', () => {
  const input = fixture();
  input.cpu = '2048';
  input.memory = '8192';
  input.containerDefinitions[0].environment.push(
    { name: 'DOCUMENT_STORAGE', value: 'disabled' },
    { name: 'STORAGE_PROVIDER', value: 'local' },
  );
  const result = prepareDocumentTask(input);
  assert.equal(result.cpu, '2048');
  assert.equal(result.memory, '8192');
  const env = result.containerDefinitions[0].environment;
  assert.equal(env.filter((item) => item.name === 'DOCUMENT_STORAGE').length, 1);
  assert.equal(env.find((item) => item.name === 'STORAGE_PROVIDER').value, 's3');
});

test('fails explicitly for missing backend, bucket or insufficient hard container cap', () => {
  assert.throws(() => prepareDocumentTask({ containerDefinitions: [] }), /missing/);
  const withoutBucket = fixture();
  withoutBucket.containerDefinitions[0].environment = [{ name: 'NODE_ENV', value: 'production' }];
  assert.throws(() => prepareDocumentTask(withoutBucket), /Assets bucket missing/);
  const input = fixture();
  input.containerDefinitions[0].memory = 512;
  assert.throws(() => prepareDocumentTask(input), /hard memory cap/);
});

test('rejects unsupported CPU and invalid memory instead of submitting a broken task', () => {
  const input = fixture();
  input.cpu = '5000';
  assert.throws(() => prepareDocumentTask(input), /CPU/);
  input.cpu = '1024';
  input.memory = '100000';
  assert.throws(() => prepareDocumentTask(input), /memory/);
});
