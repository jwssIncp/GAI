const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const backend = path.join(root, 'gai-backend');
const env = require(path.join(backend, 'node_modules/dotenv')).parse(fs.readFileSync(path.join(backend, '.env')));
const mysql = require(path.join(backend, 'node_modules/mysql2/promise'));

async function main() {
  if (env.NODE_ENV !== 'local' || !['localhost', '127.0.0.1', '::1'].includes(env.DB_HOST)) throw new Error('Inspeção limitada ao banco local configurado.');
  const db = await mysql.createConnection({ host: env.DB_HOST, port: Number(env.DB_PORT || 3306), user: env.DB_USERNAME, password: env.DB_PASSWORD, database: env.DB_DATABASE, connectTimeout: 5000 });
  try {
    await db.query('START TRANSACTION WITH CONSISTENT SNAPSHOT, READ ONLY');
    const result = { inspectedAt: new Date().toISOString(), environment: env.NODE_ENV, database: env.DB_DATABASE, host: env.DB_HOST };
    const queries = {
      organizations: 'SELECT id, legal_name, trade_name, status FROM organizations ORDER BY id',
      roles: 'SELECT id, `key`, type, organization_id, name, description, is_active FROM roles ORDER BY id',
      permissions: 'SELECT id, `key`, resource, action, scope, description FROM permissions ORDER BY scope, resource, action',
      rolePermissions: 'SELECT role_id, permission_id FROM role_permissions ORDER BY role_id, permission_id',
      users: 'SELECT id, organization_id, login, status, locked_until FROM users ORDER BY id',
      assignments: 'SELECT id, user_id, role_id, is_active, assigned_at, revoked_at FROM user_role_assignments ORDER BY id',
    };
    for (const [key, query] of Object.entries(queries)) [result[key]] = await db.query(query);
    await db.rollback();
    const organizationById = new Map(result.organizations.map(o => [Number(o.id), o]));
    const roleById = new Map(result.roles.map(r => [Number(r.id), r]));
    const permissionById = new Map(result.permissions.map(p => [Number(p.id), p]));
    function compatible(role, user) {
      if (role.type === 'ORGANIZATION') return role.organization_id !== null && user.organization_id !== null && Number(role.organization_id) === Number(user.organization_id);
      if (role.type !== 'SYSTEM' || role.organization_id !== null) return false;
      return role.key === 'PLATFORM_ADMIN' ? user.organization_id === null : ['ORG_ADMIN', 'ORG_USER'].includes(role.key) && user.organization_id !== null;
    }
    result.effectiveUsers = result.users.map(user => {
      const organization = user.organization_id === null ? null : organizationById.get(Number(user.organization_id));
      const eligible = result.assignments.filter(a => Number(a.user_id) === Number(user.id) && a.is_active && !a.revoked_at).map(a => roleById.get(Number(a.role_id))).filter(r => r && r.is_active && compatible(r, user));
      let permissions = [];
      if (user.status === 'ACTIVE' && (user.organization_id === null || organization?.status === 'ACTIVE')) {
        if (eligible.some(r => r.key === 'PLATFORM_ADMIN')) permissions = result.permissions;
        else if (eligible.some(r => r.key === 'ORG_ADMIN')) permissions = result.permissions.filter(p => p.scope === 'ORGANIZATION');
        else {
          const ids = new Set(eligible.map(r => Number(r.id)));
          const permissionIds = new Set(result.rolePermissions.filter(rp => ids.has(Number(rp.role_id))).map(rp => Number(rp.permission_id)));
          permissions = [...permissionIds].map(id => permissionById.get(id)).filter(p => p && p.scope === (user.organization_id === null ? 'PLATFORM' : 'ORGANIZATION'));
        }
      }
      return { id: user.id, login: user.login, organizationId: user.organization_id, status: user.status, eligibleRoleIds: eligible.map(r => r.id), permissionKeys: permissions.map(p => p.key).sort(), lockedUntil: user.locked_until };
    });
    fs.writeFileSync(path.join(__dirname, 'snapshot.json'), JSON.stringify(result, null, 2) + '\n');
    console.log(JSON.stringify({ environment: result.environment, database: result.database, organizations: result.organizations, roles: result.roles.map(r => ({ ...r, activeAssignments: result.assignments.filter(a => Number(a.role_id) === Number(r.id) && a.is_active && !a.revoked_at).length, effectiveUsers: result.effectiveUsers.filter(u => u.permissionKeys.length && u.eligibleRoleIds.some(id => Number(id) === Number(r.id))).length, explicitPermissions: result.rolePermissions.filter(p => Number(p.role_id) === Number(r.id)).length })), permissionCount: result.permissions.length, permissionScopes: result.permissions.reduce((a,p) => (a[p.scope] = (a[p.scope] || 0) + 1, a), {}), users: result.users.length, usersByStatus: result.users.reduce((a,u) => (a[u.status] = (a[u.status] || 0) + 1, a), {}), usersWithEffectivePermissions: result.effectiveUsers.filter(u => u.permissionKeys.length).length, assignments: result.assignments.length, activeAssignments: result.assignments.filter(a => a.is_active && !a.revoked_at).length, permissionGroups: Object.entries(result.permissions.reduce((a,p) => ((a[p.resource] ||= []).push(p.action), a), {})), effectiveUsers: result.effectiveUsers.map(({permissionKeys,...u}) => ({...u, permissionCount:permissionKeys.length})) }, null, 2));
  } finally { await db.end(); }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
