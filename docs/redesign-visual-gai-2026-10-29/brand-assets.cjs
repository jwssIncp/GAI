const fs = require('node:fs'), path = require('node:path');
const root = path.resolve(__dirname, '../..');
const target = path.join(root, 'gai-frontend/public/brand');
fs.mkdirSync(target, { recursive: true });
// An open geometric G encloses an independent asset module on a 48-unit grid.
// Lettering is drawn as paths so exported logos do not depend on installed fonts.
const symbol = '<rect width="48" height="48" rx="12" fill="#012451"/><path d="M35 9H17a8 8 0 0 0-8 8v14a8 8 0 0 0 8 8h18V23H23v7h5v2H17a1 1 0 0 1-1-1V17a1 1 0 0 1 1-1h18Z" fill="#09e67b"/><rect x="28" y="17" width="7" height="6" rx="1" fill="#00a179"/>';
const word = '<path d="M78 9H66a8 8 0 0 0-8 8v14a8 8 0 0 0 8 8h18V23H72v6h6v4H66a2 2 0 0 1-2-2V17a2 2 0 0 1 2-2h12Z"/><path fill-rule="evenodd" d="m104 9-14 30h7l3-7h14l3 7h7L110 9Zm3 9-4.5 9h9Z"/><path d="M132 9h7v30h-7Z"/>';
function svg(width, height, content) { return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="GAI — Gestão de Ativos">${content}</svg>\n`; }
fs.writeFileSync(path.join(target, 'gai-symbol.svg'), svg(48, 48, symbol));
for (const [tone, ink] of [['light', '#000d1f'], ['dark', '#f1f5f9']]) {
  const artwork = symbol + `<g fill="${ink}">${word}</g>`;
  fs.writeFileSync(path.join(target, `gai-horizontal-${tone}.svg`), svg(208, 48,
    artwork + `<path d="M153 12v24" stroke="${ink}" opacity=".18"/><text x="165" y="22" fill="${ink}" font-family="system-ui,sans-serif" font-size="9" font-weight="600">Gestão de</text><text x="165" y="34" fill="${ink}" font-family="system-ui,sans-serif" font-size="9" font-weight="600">Ativos</text>`));
  fs.writeFileSync(path.join(target, `gai-compact-${tone}.svg`), svg(148, 48, artwork));
}
async function raster() {
  const { chromium } = require(path.join(__dirname, 'evidencias/workspace/gai-frontend/node_modules/@playwright/test'));
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  for (const size of [32, 180, 192, 512]) {
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(`<style>html,body{margin:0;background:transparent}svg{width:100vw;height:100vh;display:block}</style>${svg(48,48,symbol)}`);
    await page.screenshot({ path: path.join(target, `gai-icon-${size}.png`), omitBackground: true });
  }
  await browser.close();
  console.log('Five vector variants and four raster sizes generated.');
}
raster().catch(e => { console.error(e); process.exitCode = 1; });
