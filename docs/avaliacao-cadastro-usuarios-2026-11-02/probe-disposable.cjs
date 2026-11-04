// Executes the real Nest controllers against SQLite :memory: using synthetic data.
// This script documents observed defects; it does not assert they are desirable.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const backend = path.resolve(__dirname, '../../gai-backend');
Object.assign(process.env, { NODE_ENV: 'test', DB_TYPE: 'sqlite', GAI_TEST_MYSQL_DISPOSABLE: '0', TS_NODE_PROJECT: path.join(backend, 'tsconfig.json') });
require(path.join(backend, 'node_modules/ts-node/register/transpile-only'));
require(path.join(backend, 'node_modules/reflect-metadata'));
const request = require(path.join(backend, 'node_modules/supertest'));
const { DataSource } = require(path.join(backend, 'node_modules/typeorm'));
const { createTestApp, seedTestData, loginAsAdmin, loginAsOrgAdmin } = require(path.join(backend, 'test/integration/test-app.helper.ts'));
const { UserEntity } = require(path.join(backend, 'src/modules/auth/infrastructure/persistence/user.entity.ts'));
const { OrganizationEntity } = require(path.join(backend, 'src/modules/organizations/infrastructure/persistence/organization.entity.ts'));
const { Password } = require(path.join(backend, 'src/modules/auth/domain/value-objects/password.ts'));
const { User: AuthUser } = require(path.join(backend, 'src/modules/auth/domain/entities/user.ts'));
async function main() {
  const app = await createTestApp();
  const results = [];
  try {
    const db = app.get(DataSource);
    assert.equal(db.options.type, 'sqlite');
    assert.equal(db.options.database, ':memory:');
    await seedTestData(app);
    const admin = await loginAsAdmin(app);
    const orgAdmin = await loginAsOrgAdmin(app);
    const api = request(app.getHttpServer());
    const create = (payload, token = admin) => api.post('/api/v1/users').set('Authorization', `Bearer ${token}`).send({ login: 'audit.user', email: 'audit@example.com', password: 'Audit@123456', organization_id: 1, ...payload });
    const login = (identifier, password) => api.post('/api/v1/auth/login').send({ identifier, password });
    const me = token => api.get('/api/v1/auth/me').set('Authorization', `Bearer ${token}`);
    const update = (id, payload) => api.patch(`/api/v1/users/${id}`).set('Authorization', `Bearer ${admin}`).send(payload);
    function record(name, data) { results.push({ name, ...data }); }

    let r = await create({ login: 'weak.audit', email: 'weak@example.com', password: 'aaaaaaaa' });
    assert.equal(r.status, 201);
    let rejectsWeak = false; try { Password.create('aaaaaaaa'); } catch { rejectsWeak = true; }
    assert.equal(rejectsWeak, true);
    record('password_policy', { createStatus: r.status, resetPolicyRejectsSamePassword: rejectsWeak });

    r = await create({ login: '   ', email: 'blank@example.com' });
    assert.equal(r.status, 201); assert.equal(r.body.login, '');
    record('whitespace_login', { status: r.status, persistedLoginLength: r.body.login.length });
    r = await create({ login: ' a ', email: 'short@example.com' });
    assert.equal(r.status, 201); assert.equal(r.body.login, 'a');
    record('short_login_after_trim', { status: r.status, persistedLoginLength: r.body.login.length });

    r = await create({ login: 'x'.repeat(101), email: 'long@example.com' });
    assert.equal(r.status, 201);
    record('oversized_login', { sqliteStatus: r.status, persistedLength: r.body.login.length, limitation: 'SQLite does not enforce VARCHAR length; MySQL behavior not exercised here.' });

    r = await create({ login: 'audit.owner', email: 'collision@example.com' });
    assert.equal(r.status, 201); const ownerId = r.body.id;
    r = await create({ login: 'collision@example.com', email: 'other@example.com', password: 'Other@123456' });
    assert.equal(r.status, 201); const collisionId = r.body.id;
    const collisionLogin = await login('collision@example.com', 'Other@123456');
    const ownerLogin = await login('collision@example.com', 'Audit@123456');
    record('login_email_collision', { createStatus: r.status, ownerId, collisionId, secondUserLoginStatus: collisionLogin.status, firstUserLoginStatus: ownerLogin.status });

    r = await create({ login: 'session.audit', email: 'session@example.com' });
    assert.equal(r.status, 201); const userId = r.body.id;
    const before = await db.getRepository(UserEntity).findOneByOrFail({ id: userId });
    const sessionLogin = await login('session.audit', 'Audit@123456');
    assert.equal(sessionLogin.status, 200);
    r = await update(userId, { password: 'NewAudit@123456' });
    assert.equal(r.status, 200);
    const after = await db.getRepository(UserEntity).findOneByOrFail({ id: userId });
    const oldSession = await me(sessionLogin.body.access_token);
    const oldPassword = await login('session.audit', 'Audit@123456');
    const newPassword = await login('session.audit', 'NewAudit@123456');
    assert.equal(oldSession.status, 200); assert.equal(oldPassword.status, 401); assert.equal(newPassword.status, 200);
    assert.equal(before.passwordChangedAt.getTime(), after.passwordChangedAt.getTime());
    record('admin_password_change', { updateStatus: r.status, previousSessionStatus: oldSession.status, previousPasswordStatus: oldPassword.status, newPasswordStatus: newPassword.status, passwordChangedAtUpdated: before.passwordChangedAt.getTime() !== after.passwordChangedAt.getTime() });

    for (const payload of [{ email: null }, { password: null }]) {
      r = await update(userId, payload); assert.equal(r.status, 500);
      record('nullable_optional_field', { field: Object.keys(payload)[0], status: r.status, code: r.body.code });
    }

    r = await create({ login: 'wrong.org.audit', email: 'wrongorg@example.com', organization_id: 999999 }, orgAdmin);
    assert.equal(r.status, 201); assert.equal(r.body.organization_id, 1);
    record('org_admin_foreign_id', { status: r.status, requestedOrganization: 999999, persistedOrganization: r.body.organization_id });

    await db.getRepository(OrganizationEntity).update(1, { status: 'INACTIVE' });
    r = await create({ login: 'inactive.org.audit', email: 'inactiveorg@example.com' });
    assert.equal(r.status, 201);
    const inactiveLogin = await login('inactive.org.audit', 'Audit@123456');
    assert.equal(inactiveLogin.status, 401);
    record('inactive_organization', { createStatus: r.status, createdUserStatus: r.body.status, loginStatus: inactiveLogin.status });

    const now = new Date();
    const locked = new AuthUser({ ...before, status: 'ACTIVE', failedLoginAttempts: 0, lockedUntil: null });
    locked.recordFailedLogin(1, 30, now);
    assert.equal(locked.isLocked(new Date(now.getTime() + 31 * 60_000)), true);
    record('lockout_expiry', { lockedAfterConfiguredExpiry: true, note: 'Domain-level check; separate from registration.' });

    const output = { engine: 'SQLite :memory:', syntheticOnly: true, cases: results.length, results };
    fs.writeFileSync(path.join(__dirname, 'disposable-probes.json'), JSON.stringify(output, null, 2) + '\n');
    console.log(JSON.stringify(output, null, 2));
  } finally { await app.close(); }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
