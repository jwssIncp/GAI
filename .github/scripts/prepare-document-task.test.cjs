const { test } = require('node:test');
const assert = require('node:assert/strict');
const { prepareDocumentTask } = require('./prepare-document-task.cjs');
const fixture = () => ({ family: 'synthetic-backend', cpu: '256', memory: '512', taskRoleArn: 'synthetic-task-role', containerDefinitions: [{ name: 'gai-backend', image: 'synthetic:unchanged', environment: [{ name: 'NODE_ENV', value: 'production' }, { name: 'STORAGE_PROVIDER', value: 's3' }], secrets: [{ name: 'DB_PASSWORD', valueFrom: 'synthetic-ssm' }], healthCheck: { command: ['CMD', 'synthetic'] } }] });
test('prepares document mode, floors capacity and preserves secrets, IAM, storage, image and healthcheck', () => {
  const input = fixture(), original = structuredClone(input), result = prepareDocumentTask(input);
  assert.deepEqual(input, original); assert.equal(result.cpu, '1024'); assert.equal(result.memory, '2048');
  assert.equal(result.taskRoleArn, input.taskRoleArn);
  const env = result.containerDefinitions[0].environment;
  assert.deepEqual(env, [...input.containerDefinitions[0].environment, { name: 'DOCUMENT_STORAGE', value: 'database' }]);
  for (const key of ['image', 'secrets', 'healthCheck']) assert.deepEqual(result.containerDefinitions[0][key], input.containerDefinitions[0][key]);
  assert.deepEqual(prepareDocumentTask(result), result);
});
test('preserves higher valid resources and replaces one stale document mode', () => {
  const input = fixture(); input.cpu = '2048'; input.memory = '8192'; input.containerDefinitions[0].environment.push({ name: 'DOCUMENT_STORAGE', value: 'disabled' });
  const result = prepareDocumentTask(input); assert.equal(result.cpu, '2048'); assert.equal(result.memory, '8192');
  assert.equal(result.containerDefinitions[0].environment.filter(x => x.name === 'DOCUMENT_STORAGE').length, 1);
});
test('fails explicitly for missing backend or insufficient hard container cap', () => {
  assert.throws(() => prepareDocumentTask({ containerDefinitions: [] }), /missing/);
  const input = fixture(); input.containerDefinitions[0].memory = 512;
  assert.throws(() => prepareDocumentTask(input), /hard memory cap/);
});
test('rejects unsupported CPU and invalid memory instead of submitting a broken task', () => {
  const input = fixture(); input.cpu = '5000'; assert.throws(() => prepareDocumentTask(input), /CPU/);
  input.cpu = '1024'; input.memory = '100000'; assert.throws(() => prepareDocumentTask(input), /memory/);
});
