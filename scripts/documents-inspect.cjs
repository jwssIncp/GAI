// Inspect actual downloaded files; no application data or credentials are logged.
const fs = require('node:fs/promises'), path = require('node:path'), {pathToFileURL} = require('node:url'), {createHash} = require('node:crypto');
const root=path.resolve(__dirname,'..'), examples=path.join(root,'docs/implementacao-documentos-profissionais-2026-10-28/exemplos'), output=path.join(root,'.local/documents-qa');
(async()=>{
  await fs.mkdir(output,{recursive:true});
  const pdfjs=await import(pathToFileURL(require.resolve('../gai-backend/node_modules/pdfjs-dist/legacy/build/pdf.mjs')).href);
  const {createCanvas}=require('../gai-backend/node_modules/@napi-rs/canvas');
  const {chromium}=require('../gai-frontend/node_modules/@playwright/test');
  const browser=await chromium.launch({headless:true}), result=[];
  try {
    for(const file of await fs.readdir(examples)){
      if(!/\.(pdf|docx)$/.test(file))continue;
      const bytes=await fs.readFile(path.join(examples,file)),item={file,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')};
      if(file.endsWith('.pdf')){
        const pdf=await pdfjs.getDocument({data:new Uint8Array(bytes),useSystemFonts:true,standardFontDataUrl:pathToFileURL(path.join(root,'gai-backend/node_modules/pdfjs-dist/standard_fonts/')).href}).promise;
        item.pages=pdf.numPages;item.page_numbers=[];let text='';
        for(let i=1;i<=pdf.numPages;i++){
          const page=await pdf.getPage(i),content=await page.getTextContent(),parts=content.items.map(i=>i.str).join(' ').replace(/\s+/g,' ');text+='\n'+parts;
          const pageWidth=page.getViewport({scale:1}).width;
          for(const word of content.items)if(word.str.trim()&&(word.transform[4]<43||word.transform[4]+word.width>pageWidth-43))throw Error(`${file}: text exceeds horizontal margins on page ${i}`);
          if(!parts.includes(`${i} / ${pdf.numPages}`))throw Error(`${file}: missing page number ${i}`);
          item.page_numbers.push(`${i} / ${pdf.numPages}`);
          const viewport=page.getViewport({scale:1.25}),canvas=createCanvas(Math.ceil(viewport.width),Math.ceil(viewport.height));
          await page.render({canvasContext:canvas.getContext('2d'),canvas,viewport}).promise;
          await fs.writeFile(path.join(output,file.replace('.pdf','')+`-page-${String(i).padStart(2,'0')}.png`),canvas.toBuffer('image/png'));
        }
        if(!text.includes('São Luís'))throw Error(file+': accent/content missing');
        if(file.startsWith('laudo-')&&!text.includes('Máquina de precisão 59'))throw Error(file+': missing last snapshot row');
        if(file.startsWith('proposta-')&&text.includes('Comissão:'))throw Error(file+': internal pricing leaked');
        if(file.startsWith('orcamento-')&&!text.includes('NÃO APROVADO'))throw Error(file+': draft label missing');
        await fs.writeFile(path.join(output,file+'.txt'),text);await pdf.destroy();
      }else{
        const page=await browser.newPage({viewport:{width:1000,height:1200}});
        await page.setContent('<html><body style="margin:0"><main id="doc"></main></body></html>');
        await page.addScriptTag({path:require.resolve('../gai-frontend/node_modules/jszip/dist/jszip.min.js')});
        await page.addScriptTag({path:require.resolve('../gai-frontend/node_modules/docx-preview/dist/docx-preview.min.js')});
        const parsed=await page.evaluate(async data=>{
          const b=Uint8Array.from(atob(data),x=>x.charCodeAt(0));await window.docx.renderAsync(b,document.querySelector('#doc'),undefined,{breakPages:true,ignoreLastRenderedPageBreak:false});
          return {text:document.querySelector('#doc').innerText,sections:document.querySelectorAll('section.docx').length};
        },bytes.toString('base64'));
        if(!parsed.text.includes('São Luís'))throw Error(file+': DOCX content missing');
        item.browser_sections=parsed.sections;
        const sections=page.locator('section.docx');for(let i=0;i<await sections.count();i++)await sections.nth(i).screenshot({path:path.join(output,file.replace('.docx','')+`-docx-section-${i+1}.png`)});
        await page.close();
      }
      result.push(item);console.log(JSON.stringify(item));
    }
  }finally{await browser.close();}
  await fs.writeFile(path.join(examples,'../arquivos-validacao.json'),JSON.stringify(result,null,2));
})().catch(error=>{console.error(error);process.exitCode=1});
