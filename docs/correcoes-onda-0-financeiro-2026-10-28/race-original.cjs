const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
(async()=>{const base='http://127.0.0.1:33329/api/v1';
 const login=await fetch(base+'/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({identifier:'org.admin',password:'Admin@123456'})});assert.equal(login.status,200);const token=(await login.json()).access_token;
 async function api(method,url,data){const r=await fetch(base+url,{method,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},...(data?{body:JSON.stringify(data)}:{})});return {status:r.status,body:await r.json()};}
 const p=await api('POST','/projects',{organization_id:1,company_id:1,name:'SINTETICO concorrÃªncia pagamentos '+Date.now()});assert.equal(p.status,201);
 const a=await api('POST','/field-agents',{name:'SINTETICO concorrÃªncia '+Date.now()});assert.equal(a.status,201);assert.equal((await api('POST',`/projects/${p.body.id}/field-agents`,{field_agent_id:a.body.id})).status,201);
 const results=[];
 for(let i=0;i<15;i++){
  const created=await api('POST',`/projects/${p.body.id}/payments`,{field_agent_id:a.body.id,start_date:'2026-10-28',end_date:'2026-10-28',daily_rate:'1.00',notes:'SINTETICO corrida '+i});assert.equal(created.status,201);
  const url=`/projects/${p.body.id}/payments/${created.body.id}`;
  const calls=await Promise.all([api('POST',url+'/approve',{}),api('POST',url+'/mark-as-paid',{})]);
  const after=await api('GET',url);results.push({payment:created.body.id,responses:calls,after});
 }
 const result={target:'Nest HTTP real + MySQL descartÃ¡vel 33327',project:p.body.id,cases:results,approved_after_successful_paid:results.filter(r=>r.responses[1].status===200&&r.after.body.status!=='paid').length};
 fs.writeFileSync(path.join(__dirname,'evidencias/payment-race-before.json'),JSON.stringify(result,null,2));console.log(JSON.stringify({cases:results.length,approved_after_successful_paid:result.approved_after_successful_paid}));
})().catch(e=>{console.error(e);process.exitCode=1});

