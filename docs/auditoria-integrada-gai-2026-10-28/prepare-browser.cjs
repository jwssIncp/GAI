const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../..'),dest=path.join(__dirname,'e2e');fs.mkdirSync(dest,{recursive:true});
const names=['assisted-reconciliation','budgets','contracts','documents','dre','field-coordination','receivables','reports','valuation-batches'];
for(const name of names){
 const source=path.join(root,'gai-frontend/e2e',name+'-real.spec.ts');
 let s=fs.readFileSync(source,'utf8').replaceAll('@playwright/test','../../../gai-frontend/node_modules/@playwright/test/index.mjs').replaceAll('http://localhost:5173','http://127.0.0.1:33320').replaceAll('http://localhost:3000','http://127.0.0.1:33319');
 s=s.replaceAll('../node_modules/','../../../gai-frontend/node_modules/').replaceAll('../../gai-backend/','../../../gai-backend/');
 s=s.replaceAll('company_id: 2','company_id: 1');
 s=s.replaceAll("path.resolve('../docs/implementacao-documentos-profissionais-2026-10-28/exemplos')",'path.resolve('+JSON.stringify(path.join(__dirname,'evidencias/documentos'))+')');
 fs.writeFileSync(path.join(dest,name+'.spec.ts'),s);
}
console.log('Prepared nine isolated copies; original specs are unchanged.');
