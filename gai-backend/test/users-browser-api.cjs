// Browser-only synthetic fixture server. Never connects to the development DB.
const path = require('node:path'), { createHash } = require('node:crypto');
const root = path.resolve(__dirname, '..'); process.chdir(root);
Object.assign(process.env, { NODE_ENV:'test', DB_TYPE:'sqlite', GAI_TEST_MYSQL_DISPOSABLE:'0', TS_NODE_PROJECT:path.join(root,'tsconfig.json') });
require('ts-node/register/transpile-only');
const { DataSource } = require('typeorm');
const { createTestApp, seedTestData } = require('./integration/test-app.helper.ts');
const { EnsureOrgUserRole1794100000001 } = require('../src/migrations/1794100000001-ensure-org-user-role.ts');
const { UserEntity } = require('../src/modules/auth/infrastructure/persistence/user.entity.ts');
const { PasswordResetTokenEntity } = require('../src/modules/auth/infrastructure/persistence/password-reset-token.entity.ts');
const { UserRoleAssignmentEntity } = require('../src/modules/users/infrastructure/persistence/user-role-assignment.entity.ts');
(async()=>{
 const app=await createTestApp(undefined,{includeHealthController:true}); const db=app.get(DataSource);
 if(db.options.type!=='sqlite'||db.options.database!==':memory:')throw Error('Browser fixture must be disposable SQLite.');
 await seedTestData(app);const runner=db.createQueryRunner();await new EnsureOrgUserRole1794100000001().up(runner);await runner.release();
 await db.query("DELETE FROM role_permissions WHERE role_id=3 AND permission_id<>(SELECT id FROM permissions WHERE `key`='users:read')");
 const user=await db.getRepository(UserEntity).save({fullName:'Pessoa convidada de teste',login:'activation.browser',email:'activation.browser@example.com',organizationId:1,passwordHash:'unusable-synthetic-placeholder',passwordChangedAt:new Date(),status:'PENDING_ACTIVATION'});
 await db.getRepository(UserRoleAssignmentEntity).save({userId:user.id,roleId:3,isActive:true,assignedBy:2,assignedAt:new Date()});
 await db.getRepository(PasswordResetTokenEntity).save({userId:user.id,purpose:'INVITATION',tokenHash:createHash('sha256').update('users-browser-activation-token-only').digest('hex'),expiresAt:new Date(Date.now()+3600000)});
 await app.listen(33429,'127.0.0.1');console.log('User browser fixture: synthetic SQLite :memory: only.');
 for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>app.close().then(()=>process.exit(0)));
})().catch(error=>{console.error(error.message);process.exitCode=1;});
