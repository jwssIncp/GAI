const { test } = require('node:test');
const assert = require('node:assert/strict');
const { requireCredential, adminPassword } = require('./runtime-credentials.cjs');

test('runtime credentials fail closed without a configured value', () => {
  const key = 'GAI_RUNTIME_CREDENTIAL_TEST';
  delete process.env[key];
  assert.throws(() => requireCredential(key), { message: `Missing runtime credential: ${key}` });
});

test('runtime credentials use the execution environment without a fallback', () => {
  const key = 'GAI_RUNTIME_CREDENTIAL_TEST';
  try {
    process.env[key] = 'Synthetic runtime fixture only!';
    assert.equal(requireCredential(key), process.env[key]);
  } finally {
    delete process.env[key];
  }
});

test('organization administration honors its separately configured credential', () => {
  const saved = { admin: process.env.SEED_ADMIN_PASSWORD, org: process.env.SEED_ORG_ADMIN_PASSWORD };
  try {
    process.env.SEED_ADMIN_PASSWORD = 'Synthetic platform fixture only!';
    process.env.SEED_ORG_ADMIN_PASSWORD = 'Synthetic organization fixture only!';
    assert.equal(adminPassword(), process.env.SEED_ORG_ADMIN_PASSWORD);
    delete process.env.SEED_ORG_ADMIN_PASSWORD;
    assert.equal(adminPassword(), process.env.SEED_ADMIN_PASSWORD);
    delete process.env.SEED_ADMIN_PASSWORD;
    assert.throws(() => adminPassword(), /Missing runtime credential: SEED_ADMIN_PASSWORD/);
  } finally {
    for (const [name, value] of [['SEED_ADMIN_PASSWORD', saved.admin], ['SEED_ORG_ADMIN_PASSWORD', saved.org]]) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
});
