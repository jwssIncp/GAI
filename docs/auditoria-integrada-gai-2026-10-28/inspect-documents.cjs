const fs=require('node:fs/promises'),path=require('node:path'),{pathToFileURL}=require('node:url'),assert=require('node:assert/strict'),{createHash}=require('node:crypto');
const root=path.resolve(__dirname,'../..'),out=path.join(__dirname,'evidencias/documentos-render');
process.env.NODE_ENV='test';process.env.TS_NODE_PROJECT=path.join(root,'gai-backend/tsconfig.json');
require(path.join(root,'gai-backend/node_modules/ts-node/register/transpile-only'));
const {renderDocument}=require(path.join(root,'gai-backend/src/modules/documents/document.render.ts'));
const {DEFAULT_VISUAL}=require(path.join(root,'gai-backend/src/modules/documents/document.contract.ts'));
const {unzipSync,strFromU8}=require(path.join(root,'gai-backend/node_modules/fflate'));
const {JSDOM}=require(path.join(root,'gai-frontend/node_modules/jsdom'));
const {createCanvas}=require(path.join(root,'gai-backend/node_modules/@napi-rs/canvas'));
(async()=>{await fs.mkdir(out,{recursive:true});
 const pdfjs=await import(pathToFileURL(require.resolve(path.join(root,'gai-backend/node_modules/pdfjs-dist/legacy/build/pdf.mjs'))).href);
 const xmlParser=new(new JSDOM().window.DOMParser)(),results=[];
 for(const count of [1,60,180]){
  const model={title:'Auditoria sintética de documentos',subtitle:'Patrimônio São Luís',date:'28/10/2026',version:'Revisão sintética '+count,status:'SINTÉTICO para auditoria',sourceHash:'a'.repeat(64),visual:{...DEFAULT_VISUAL},blocks:[{title:'Escopo',paragraphs:['João verifica ação e patrimônio. BRL 1.234,56. Conteúdo sem envio externo.']},{title:'Inventário',table:{columns:['ID','Placa','Descrição','Valor'],rows:Array.from({length:count},(_,i)=>[String(i+1),'PAT-'+i,'Máquina de precisão '+i+(i%19===18?' · '+('Descrição longa com acentuação e observações. '.repeat(24)) :''),'BRL 1.234,56'])}}]};
  for(const format of ['pdf','docx']){
   const bytes=await renderDocument(structuredClone(model),format),filename=`sintetico-${count}.${format}`;await fs.writeFile(path.join(out,filename),bytes);
   const result={file:filename,rows:count,size:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')};
   if(format==='pdf'){
    const pdf=await pdfjs.getDocument({data:new Uint8Array(bytes),useSystemFonts:true}).promise;result.pages=pdf.numPages;let text='';const outside=[];
    for(let i=1;i<=pdf.numPages;i++){
     const p=await pdf.getPage(i),v=p.getViewport({scale:1}),content=await p.getTextContent();text+=content.items.map(x=>x.str).join(' ')+'\n';
     for(const word of content.items)if(word.str.trim()&&(word.transform[4]<20||word.transform[4]+word.width>v.width-20))outside.push({page:i,text:word.str});
     const cv=createCanvas(Math.ceil(v.width),Math.ceil(v.height));await p.render({canvasContext:cv.getContext('2d'),canvas:cv,viewport:v}).promise;await fs.writeFile(path.join(out,`sintetico-${count}-page-${i}.png`),cv.toBuffer('image/png'));
    }
    text=text.replace(/\s+/g,' ');await fs.writeFile(path.join(out,filename+'.txt'),text);assert.ok(text.includes('PAT-'+(count-1)));assert.ok(text.includes('São Luís'));result.last_row_present=true;result.outside_20pt_margin=outside;await pdf.destroy();
   }else{
    const zip=unzipSync(bytes),names=new Set(Object.keys(zip));let xmlCount=0,relationships=0;
    for(const [name,b]of Object.entries(zip))if(/\.(xml|rels)$/.test(name)){
     const doc=xmlParser.parseFromString(strFromU8(b),'application/xml');assert.equal(doc.getElementsByTagName('parsererror').length,0,name);xmlCount++;
     if(name.endsWith('.rels'))for(const rel of doc.getElementsByTagName('Relationship')){
      assert.notEqual(rel.getAttribute('TargetMode'),'External');const base=name==='_rels/.rels'?'':name.split('/_rels/')[0];const target=path.posix.normalize(path.posix.join(base,rel.getAttribute('Target')));assert.ok(names.has(target),target);relationships++;
     }
    }
    const main=strFromU8(zip['word/document.xml']);assert.ok(main.includes('Máquina de precisão '+(count-1)));assert.ok(main.includes('w:tblHeader'));assert.ok(strFromU8(zip['word/footer1.xml']).includes('NUMPAGES'));
    result.xml_parts_valid=xmlCount;result.relationships_valid=relationships;result.native_tables=true;result.last_row_present=true;result.pagination_verified_in_word=false;
   }
   results.push(result);console.log(JSON.stringify(result));
  }
 }
 await fs.writeFile(path.join(out,'inspection.json'),JSON.stringify(results,null,2));
})().catch(e=>{console.error(e);process.exitCode=1});
