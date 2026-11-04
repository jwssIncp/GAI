// Verifies existing synthetic development credentials offline before authenticating.
// Never changes a password, account status, organization or grant; never exports tokens/hashes.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const backend=path.resolve(__dirname,'../../gai-backend');
const env=require(path.join(backend,'node_modules/dotenv')).parse(fs.readFileSync(path.join(backend,'.env')));
const mysql=require(path.join(backend,'node_modules/mysql2/promise'));
const argon2=require(path.join(backend,'node_modules/argon2'));
async function main(){
 if(env.NODE_ENV!=='local'||!['localhost','127.0.0.1','::1'].includes(env.DB_HOST))throw Error('Only the explicit local environment is permitted.');
 const db=await mysql.createConnection({host:env.DB_HOST,port:Number(env.DB_PORT||3306),user:env.DB_USERNAME,password:env.DB_PASSWORD,database:env.DB_DATABASE});
 try{
  const projection='id,login,email,password_hash,status,organization_id';
  const [before]=await db.query(`SELECT ${projection} FROM users ORDER BY id`);assert.equal(before.length,3);
  const { requireCredential } = require('../../scripts/runtime-credentials.cjs');
  const candidates={'platform.admin':requireCredential('SEED_ADMIN_PASSWORD'),'org.admin':requireCredential(process.env.SEED_ORG_ADMIN_PASSWORD?'SEED_ORG_ADMIN_PASSWORD':'SEED_ADMIN_PASSWORD'),'test.user':requireCredential('SEED_TEST_USER_PASSWORD')};
  const results=[];
  const base=`http://127.0.0.1:${Number(env.PORT||3000)}/api/v1`;
  for(const user of before){
   const password=candidates[user.login];
   const verified=Boolean(password)&&await argon2.verify(user.password_hash,password);
   if(!verified)throw Error('Configured synthetic credentials do not match; refusing a failed login attempt.');
   const login=await fetch(base+'/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({identifier:user.login,password}),signal:AbortSignal.timeout(10000)});assert.equal(login.status,200);
   const session=await login.json();
   const headers={Authorization:`Bearer ${session.access_token}`};
   const me=await fetch(base+'/auth/me',{headers,signal:AbortSignal.timeout(10000)});assert.equal(me.status,200);const profile=await me.json();assert.equal(profile.must_change_password,false);
   const access=await fetch(base+'/users',{headers,signal:AbortSignal.timeout(10000)});assert.equal(access.status,user.login==='test.user'?403:200);
   const logout=await fetch(base+'/auth/logout',{method:'POST',headers,signal:AbortSignal.timeout(10000)});assert.equal(logout.status,204);
   results.push({id:user.id,login:user.login,offlineCredentialMatch:true,loginStatus:login.status,currentUserStatus:me.status,administrativeUsersStatus:access.status,logoutStatus:logout.status,organizationId:profile.organization_id,roles:profile.role_assignments.map(role=>role.role_key||role.role_name),permissionCount:profile.permissions.length});
  }
  const [after]=await db.query(`SELECT ${projection} FROM users ORDER BY id`);assert.deepEqual(after,before);
  const [organizations]=await db.query("SELECT o.id,COUNT(DISTINCT CASE WHEN r.`key`='ORG_ADMIN' AND u.status='ACTIVE' AND a.is_active=1 AND a.revoked_at IS NULL THEN u.id END) administrators FROM organizations o LEFT JOIN users u ON u.organization_id=o.id LEFT JOIN user_role_assignments a ON a.user_id=u.id LEFT JOIN roles r ON r.id=a.role_id GROUP BY o.id ORDER BY o.id");
  const output={verifiedAt:new Date().toISOString(),target:base,credentialsAndIdentityUnchanged:true,existingUsers:3,results,organizations};
  fs.writeFileSync(path.join(__dirname,'checks/local-users.json'),JSON.stringify(output,null,2)+'\n');console.log(JSON.stringify(output));
 }finally{await db.end();}
}
main().catch(error=>{console.error(error.code||error.message);process.exitCode=1;});
