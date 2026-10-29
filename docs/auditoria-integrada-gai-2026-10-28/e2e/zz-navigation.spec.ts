import {test,expect} from '../../../gai-frontend/node_modules/@playwright/test/index.mjs';

for(const viewport of [{width:1440,height:1000},{width:390,height:844}])test(`real project navigation and refresh ${viewport.width}px`,async({page},info)=>{
 test.setTimeout(240000);await page.setViewportSize(viewport);
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/login');await page.getByLabel('Login ou email').fill('org.admin');await page.getByLabel('Senha',{exact:true}).fill(process.env.GAI_E2E_PASSWORD!);await page.getByRole('button',{name:/entrar/i}).click();await page.waitForURL('**/app/dashboard');
 const token=await page.evaluate(()=>JSON.parse(sessionStorage.getItem('gai.session.v1')!).accessToken);
 const r=await page.request.post('/api/v1/projects',{headers:{Authorization:'Bearer '+token},data:{organization_id:1,company_id:1,name:'SINTETICO navegação auditoria '+viewport.width+' '+Date.now()}});expect(r.status(),await r.text()).toBe(201);const {id}=await r.json();
 const root=`/app/projects/${id}/`,steps:object[]=[];
 for(const suffix of ['summary','dashboard','contracts','preparation/kickoff','preparation/client-checklist','field-coordination','inventory-items','inventory/sessions','accounting-items','pending-issues','finance','finance/accountabilities','import-sessions','export-jobs','technical-reports']){
  await page.goto(root+suffix);await expect(page.getByRole('navigation',{name:'Abas do projeto'})).toBeVisible();await page.waitForLoadState('networkidle');
  await expect(page.locator('[data-project-id]')).toHaveAttribute('data-project-id',String(id));expect(page.url()).toContain(root+suffix);
  steps.push({suffix,url:page.url(),width:await page.evaluate(()=>({viewport:innerWidth,document:document.documentElement.scrollWidth}))});
 }
 await page.goto(root+'preparation/kickoff');await page.reload();await expect(page.getByRole('navigation',{name:'Abas do projeto'})).toBeVisible();
 await page.getByRole('navigation',{name:'Abas do projeto'}).getByRole('link',{name:'Itens',exact:true}).click();await expect(page).toHaveURL(new RegExp(root+'inventory-items$'));await page.goBack();await expect(page).toHaveURL(new RegExp(root+'preparation/kickoff$'));await page.goForward();await expect(page).toHaveURL(new RegExp(root+'inventory-items$'));
 await page.screenshot({path:info.outputPath(`navigation-${viewport.width}.png`),fullPage:true});
 // Characterize the context-loss defect; this assertion is evidence of current
 // behavior, not a passing acceptance check for the desired navigation rule.
 await page.getByRole('navigation',{name:'Abas do projeto'}).getByRole('link',{name:'Orçamentos',exact:true}).click();expect(new URL(page.url()).searchParams.get('project_id')).toBe(String(id));
 await page.getByRole('navigation',{name:'Navegação de orçamentos'}).getByRole('link',{name:'Orçamentos',exact:true}).click();expect(new URL(page.url()).searchParams.get('project_id')).toBeNull();
 const lostContext={project:id,after:page.url(),confirmed:true};
 await info.attach('navigation-evidence',{body:JSON.stringify({viewport,steps,lostContext,errors},null,2),contentType:'application/json'});expect(errors).toEqual([]);
});
