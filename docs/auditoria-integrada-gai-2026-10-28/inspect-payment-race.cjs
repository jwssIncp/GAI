const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../..'),file=path.join(__dirname,'evidencias/payment-race.json');
const mysql=require(path.join(root,'gai-backend/node_modules/mysql2/promise'));
(async()=>{const result=JSON.parse(fs.readFileSync(file,'utf8')),db=await mysql.createConnection({host:'127.0.0.1',port:33317,user:'root',password:'gai-validation-only',database:'gai_validation_disposable',dateStrings:true});try{
 const [rows]=await db.execute('SELECT id,status,created_at,updated_at,approved_at,paid_at,payment_date FROM field_agent_payments WHERE project_id=? ORDER BY id',[result.project]);
 const [audit]=await db.execute('SELECT payment_id,operation,created_at FROM payment_expense_audit_logs WHERE project_id=? ORDER BY id',[result.project]);
 const [clock]=await db.query('SELECT @@global.time_zone AS global_timezone,@@session.time_zone AS session_timezone,NOW(3) AS mysql_now,UTC_TIMESTAMP(3) AS mysql_utc');
 const [affected]=result.cases.filter(r=>r.responses[1].status===200&&r.after.body.status!=='paid');
 const base='http://127.0.0.1:33319/api/v1',login=await fetch(base+'/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({identifier:'org.admin',password:'Admin@123456'})}),token=(await login.json()).access_token;
 let repeated=null;if(affected){const response=await fetch(`${base}/projects/${result.project}/payments/${affected.payment}/mark-as-paid`,{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:'{}'});repeated={payment:affected.payment,status:response.status,body:await response.json()};}
 result.sql_before_repeat=rows;result.audit_before_repeat=audit;result.clock={host_now:new Date().toISOString(),mysql:clock};result.repeat_paid_without_reversal=repeated;
 fs.writeFileSync(file,JSON.stringify(result,null,2));console.log(JSON.stringify({cases:result.cases.length,inconsistent:result.approved_after_successful_paid,repeat_status:repeated?.status,clock:result.clock}));
}finally{await db.end();}})().catch(e=>{console.error(e);process.exitCode=1});
