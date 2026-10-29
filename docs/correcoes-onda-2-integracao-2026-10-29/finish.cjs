const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto'), { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '../..'), out = path.join(__dirname, 'evidencias'), backend = path.join(out, 'workspace/gai-backend');
const read = file => JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const assert = (condition, message) => { if (!condition) throw Error(message); };
const baseline = read(path.join(out, 'baseline.json'));
const tests = {}, merged = new Map();
for (const [name, expected] of [['unit', 430], ['sqlite', 253], ['default', 683], ['coverage', 683], ['mysql', 325], ['s3', 7], ['documents-final', 46], ['history-final', 28], ['volume-final', 18]]) {
  const result = read(path.join(out, name + '-result.json')), data = read(path.join(out, name + '-jest.json'));
  assert(result.exit_code === 0 && data.success && data.numPassedTests === expected && data.numFailedTests === 0 && data.numPendingTests === 0, 'Incomplete/failing gate: ' + name);
  tests[name] = { passed: data.numPassedTests, failed: data.numFailedTests, skipped: data.numPendingTests, files: data.testResults.length, seconds: result.seconds };
  for (const file of data.testResults) {
    const occurrences = new Map(), relative = path.relative(backend, file.name).replaceAll('\\', '/');
    for (const test of file.assertionResults) {
      const count = occurrences.get(test.fullName) || 0; occurrences.set(test.fullName, count + 1);
      merged.set(relative + '\0' + test.fullName + '\0' + count, test.status);
    }
  }
}
assert([...merged.values()].every(status => status === 'passed'), 'Consolidated backend contains non-passing case');
const frontend = read(path.join(out, 'frontend-vitest.json'));
assert(read(path.join(out, 'frontend-result.json')).exit_code === 0 && frontend.numPassedTests === 265 && frontend.numFailedTests === 0 && frontend.numPendingTests === 0, 'Frontend not green');
for (const name of ['backend-checks', 'frontend-checks']) assert(read(path.join(out, name + '.json')).every(result => result.exit_code === 0), name + ' failed');
for (const name of ['backend', 'frontend']) assert(read(path.join(out, name + '-eslint.json')).every(file => file.errorCount === 0 && file.warningCount === 0), name + ' lint is not clean');
const browser = read(path.join(out, 'e2e/playwright.json'));
assert(read(path.join(out, 'e2e-result.json')).exit_code === 0 && browser.stats.expected === 14 && browser.stats.unexpected === 0 && browser.stats.skipped === 0 && browser.stats.flaky === 0 && !browser.errors.length, 'Browser gate is incomplete/failing');
const formats = read(path.join(out, 'volume-final/report-volume.json')).filter(row => row.format);
assert(formats.length === 2 && formats.every(row => row.status === 201), 'Current volume native artifacts did not both generate');
const matrix = read(path.join(out, 'volume-final/volume-exports.json'));
for (const count of [0, 1, 999, 1000, 1001, 2500, 5000]) for (const format of ['pdf', 'docx']) {
  const record = matrix.find(item => item.count === count && item.format === format);
  assert(record && (record.status === 201 || (count === 5000 && record.status === 503 && record.partial_artifact === false)), 'Incomplete native volume matrix: ' + count + '/' + format);
}
const inspection = read(path.join(out, 'volume-final/render-qa/inspection.json'));
assert(inspection.find(file => file.pages)?.visual_review?.result?.startsWith('No clipping'), 'Final PDF visual QA not recorded');
const contentInspection = read(path.join(out, 'volume-final/matrix-content-inspection.json'));
assert(contentInspection.length === 14 && contentInspection.every(row => row.explicit_failure_without_artifact || (row.checksum_valid && row.all_rows_in_order_no_duplicates && row.snapshot_hash_present)), 'Native matrix content QA incomplete');
const terraform = read(path.join(out, 'terraform-final-checks.json'));
assert(terraform.every(check => check.exit_code === 0), 'Terraform local final checks failed');
const hcl = read(path.join(out, 'terraform-validate.log'));
assert(hcl.valid && hcl.error_count === 0, 'Terraform validate is not valid');
assert(read(path.join(out, 'infra-transform-result.json')).exit_code === 0, 'Task transform tests failed');
const { createCoverageMap } = require(path.join(backend, 'node_modules/istanbul-lib-coverage'));
const coverage = createCoverageMap(read(path.join(backend, 'coverage/coverage-final.json'))).getCoverageSummary().toJSON();
for (const metric of ['statements', 'branches', 'functions', 'lines']) assert(coverage[metric].pct >= 60, 'Coverage threshold regressed: ' + metric);
fs.writeFileSync(path.join(out, 'coverage-summary.json'), JSON.stringify(coverage, null, 2));
const preserved = baseline.files.filter(file => /^docs\/correcoes-onda-[01]-/.test(file.path));
for (const file of preserved) assert(fs.existsSync(path.join(root, file.path)) && hash(path.join(root, file.path)) === file.sha256, 'Prior delivery modified: ' + file.path);
const migrations = fs.readdirSync(path.join(root, 'gai-backend/src/migrations')).filter(name => name.endsWith('.ts'));
assert(migrations.length === baseline.migrations.length, 'Migration count changed');
for (const file of baseline.migrations) assert(hash(path.join(root, file.path)) === file.sha256, 'Migration modified: ' + file.path);
const installed = {};
for (const part of ['gai-backend', 'gai-frontend']) {
  const initial = baseline.dependencies[part];
  assert(hash(path.join(root, part, 'package-lock.json')) === initial.lock_sha256, 'Lock changed: ' + part);
  let checked = 0;
  for (const [name, version] of Object.entries(initial.installed)) {
    const file = path.join(root, part, 'node_modules', name, 'package.json');
    const current = fs.existsSync(file) ? read(file).version : null;
    assert(current === version, 'Original installed version changed: ' + name); checked++;
  }
  installed[part] = { direct_versions_checked: checked, unchanged: true, lock_sha256: initial.lock_sha256 };
}
const manifestPath = path.join(__dirname, 'arquivos.json');
for (const file of [manifestPath, path.join(__dirname, 'README.md'), path.join(__dirname, 'testes.md'), path.join(out, 'preservation-final.json'), path.join(out, 'final-validation.json'), path.join(out, 'git-after.bin')])
  if (!fs.existsSync(file)) fs.writeFileSync(file, '{}\n');
const git = spawnSync('git', ['status', '--porcelain=v1', '-z', '--untracked-files=all'], { cwd: root, encoding: null, maxBuffer: 64 * 1024 * 1024 });
assert(git.status === 0, 'Git status failed'); fs.writeFileSync(path.join(out, 'git-after.bin'), git.stdout);
const entries = git.stdout.toString('utf8').split('\0').filter(Boolean), staged = entries.filter(entry => entry[0] !== ' ' && entry[0] !== '?').map(entry => entry.slice(0, 2) + ' ' + entry.slice(3));
assert(JSON.stringify([...staged].sort()) === JSON.stringify([...baseline.git.staged].sort()), 'Staged paths changed');
for (const entry of staged) {
  const file = baseline.files.find(file => file.path === entry.slice(3).replaceAll('\\', '/'));
  assert(file && hash(path.join(root, file.path)) === file.sha256, 'Pre-existing staged working file modified: ' + entry);
}
const preservation = { at: new Date().toISOString(), prior_delivery_files_checked: preserved.length, all_prior_delivery_hashes_unchanged: true, migrations_checked: migrations.length, original_installs: installed, staged_paths_unchanged: staged, git_entries_before: baseline.git.entries, git_entries_after: entries.length };
fs.writeFileSync(path.join(out, 'preservation-final.json'), JSON.stringify(preservation, null, 2));
const final = { at: new Date().toISOString(), backend_distinct: merged.size, tests, frontend: { passed: frontend.numPassedTests, failed: frontend.numFailedTests, skipped: frontend.numPendingTests }, browser: browser.stats, coverage, formats, export_matrix: matrix, local_terraform_valid: true, production_released: false };
fs.writeFileSync(path.join(out, 'final-validation.json'), JSON.stringify(final, null, 2));
const write = (file, body) => fs.writeFileSync(path.join(__dirname, file), body, 'utf8');
write('README.md', `# Onda 2 — integração funcional e laudos\n\nConcluída e validada localmente em 29/10/2026. **Produção não liberada.**\n\n- **GAI-005 corrigida:** contexto de projeto em URL, retorno autorizado, filtros/versões e navegação desktop/mobile com histórico e refresh.\n- **GAI-006 corrigida:** extração em lotes, estimativa SQL de bytes, leitura consistente e falhas integrais explícitas; 5.000 itens extraídos e PDF/DOCX aprovados de 2.500 itens.\n- **GAI-007 preparada:** modo documental e capacidade em Terraform e no registro de task definitions; validação local aprovada, homologação AWS pendente.\n\nRegressões finais: **${tests.default.passed} backend padrão, ${tests.mysql.passed} MySQL, ${frontend.numPassedTests} frontend, ${tests.s3.passed} S3 local e ${browser.stats.expected} Playwright**. ${merged.size} casos backend distintos, sem somar reexecuções. Zero falhas/skips nas rodadas finais; TypeScript, builds, lint global e cobertura original aprovados.\n\nA extração de 5.000 itens foi completa; nesse volume, PDF/DOCX foram recusados explicitamente pelo renderer, sem artefato parcial.\n\nO PDF de 2.500 itens tem ${formats.find(item => item.format === 'pdf').pages} páginas. DOCX tem OOXML e conteúdo integral verificados; **paginação Word não homologada** por indisponibilidade do renderer requerido.\n\n## Relatórios\n\n- [Navegação e permissões](navegacao.md)\n- [Extração, consistência e limites](extracao-laudos.md)\n- [PDF/DOCX e inspeção](documentos.md)\n- [Infraestrutura ECS preparada](infraestrutura-ecs.md)\n- [Testes e desempenho](testes.md)\n- [Riscos restantes](riscos-residuais.md)\n- [Arquivos e hashes](arquivos.json)\n\nAs entregas anteriores (${preserved.length} arquivos conferidos), as ${migrations.length} migrations, os lockfiles e as versões diretas das instalações originais foram preservados. Testes usaram cópias isoladas das dependências e dois schemas exclusivos no container da Onda 2, em 127.0.0.1:33347.\n\nNão houve commit, push, deploy, plan/apply AWS, migration em produção ou regravação de laudos históricos. A primeira tentativa de navegador teve chamadas legadas indevidas a localhost:3000, todas rejeitadas com 401; sua correção e a proteção adicionada estão documentadas nas tentativas de teste.\n`);
const rows = Object.entries(tests).map(([name, result]) => `| ${name} | ${result.passed} | ${result.failed} | ${result.skipped} | ${result.seconds.toFixed(2)} |`).join('\n');
const nativeRows = matrix.slice().sort((a,b)=>a.count-b.count || a.format.localeCompare(b.format)).map(row => `| ${row.count} | ${row.format} | ${row.status} | ${row.bytes ?? '—'} | ${row.pages ?? '—'} | ${row.milliseconds.toFixed(2)} |`).join('\n');
const volumes = read(path.join(out, 'mysql/report-volume.json'));
const perf = volumes.filter(row => row.extracted !== undefined).map(row => `| ${row.count} | ${row.extracted} | ${row.snapshot_bytes} | ${row.milliseconds.toFixed(2)} | ${row.rss_after} | ${row.heap_after} |`).join('\n');
write('testes.md', `# Testes finais e evidências\n\n## Execuções aprovadas\n\n| Backend | Aprovados | Falhos | Skips | Segundos |\n| --- | ---: | ---: | ---: | ---: |\n${rows}\n\nFrontend: ${frontend.numPassedTests} aprovados, zero falhas/skips. Playwright: ${browser.stats.expected} aprovados, zero falhas, skips ou flaky. Transformação declarativa de task definition: 4 testes Node aprovados. TypeScript, build e ESLint globais passaram nos dois projetos; lint com zero erros e avisos.\n\nOs comandos separados da Onda 1 foram executados em seus motores. \`default\` e \`coverage\` repetem unit/SQLite; MySQL repete casos de integração no motor real. A união por arquivo + título + ocorrência resulta em **${merged.size} casos backend distintos**, e não na soma das linhas. Reproduções, tentativas e reexecuções não são contadas como casos novos.\n\nCobertura: statements ${coverage.statements.pct}%, branches ${coverage.branches.pct}%, functions ${coverage.functions.pct}%, lines ${coverage.lines.pct}%. O threshold de 60% foi mantido.\n\n## Volume\n\n| Itens de origem | Extraídos | Bytes do snapshot | Tempo do cenário (ms) | RSS depois (bytes) | Heap depois (bytes) |\n| ---: | ---: | ---: | ---: | ---: | ---: |\n${perf}\n\nO cenário inclui duas capturas e conferência SQL/persistência; memória é do processo compartilhado, não pico isolado. \`mysql/report-volume.json\` contém também 1.001 registros por família complementar, 2.500 avaliações históricas, limites 413, formatos e tempos de renderização. A recusa de JSON de 5 MiB ocorre antes de qualquer busca de página de inventário.\n\nO teste concorrente altera item de página posterior e agenda inserção durante a captura; a visão inicial permanece íntegra e a seguinte detecta a mudança. Os testes nativos exigem versão aprovada preservada, validação de formatos, hash e negativas de download. A regressão financeira executa as disputas e limites das Ondas 0/1; consulte também \`mysql/concurrency-after.json\` e os resultados de temporalidade/exports no mesmo diretório.\n\n## Matriz de exportação nativa\n\n| Itens | Formato | HTTP | Bytes | Páginas PDF | ms |\n| ---: | --- | ---: | ---: | ---: | ---: |\n${nativeRows}\n\nResultados em \`evidencias/volume-final/volume-exports.json\`. A inspeção independente dos arquivos aceitos confere checksums, ordem integral dos itens e hash de versão em \`matrix-content-inspection.json\`. Em 5.000 itens a captura e o snapshot são completos, mas DOCX retornou falha do worker e PDF atingiu o timeout: 503 explícito, sem artefato parcial. A resposta genérica do worker não permite atribuir a causa a memória ou tamanho da entrada. A tentativa inicial supunha sucesso de DOCX nesse volume e falhou; foi preservada antes de corrigir essa expectativa para o contrato operacional existente. Nenhum limite do renderer foi ampliado.\n\nA rodada MySQL de 325 casos precede a projeção de metadados do histórico; os 28 testes afetados de laudos/documentos foram repetidos após essa otimização. A matriz final ampliada repete 18 casos e as verificações globais de backend permaneceram aprovadas.\n\n## Navegador e autorização\n\n\`e2e/playwright.json\` e seus artefatos registram os 14 cenários. Quatro percursos novos combinam ORG_ADMIN/leitor e desktop/mobile. Os dez restantes incluem a navegação contínua anterior e os fluxos reais de contratos, orçamentos, recebíveis, DRE, laudos, documentos, campo, avaliações e conciliação assistida. Sem mock de API; storage em memória no harness é explícito e a integração MinIO independente executa 7 testes.\n\nLeitor não recebe permissões de escrita/exportação. Conteúdo de caixa/DRE exige as leituras de fontes correspondentes; elas são declaradas na fixture sintética. Testes negativos mantêm 401/403 e os contratos existentes de filtros/IDs de outra organização.\n\n## Isolamento e reprodução\n\n- Container exclusivo: \`gai-wave2-20261029-mysql\`, 127.0.0.1:33347, credenciais exclusivamente sintéticas.\n- Regressão destrutiva: \`gai_validation_disposable\`; navegador: \`gai_navigation_disposable\`. O segundo alvo é opção restrita ao opt-in da Onda 2 e validada antes da fixture.\n- API temporária: 127.0.0.1:33349; Vite preview: 33350. Reutilização de servidores preexistentes desabilitada. O runner recusa alvos literais localhost/127.0.0.1:3000 nos specs.\n- Dependências copiadas da instalação isolada validada na Onda 1; lockfiles idênticos. Não se executou npm ci nas instalações originais. Runtime e versões em \`runtime-final.json\`.\n\nNa raiz, \`node docs/correcoes-onda-2-integracao-2026-10-29/validate.cjs sync\` sincroniza fontes para as cópias isoladas. Os modos são unit, sqlite, default, coverage, mysql, s3, frontend, backend-checks, frontend-checks e e2e. Os modos MySQL são destrutivos **somente nos schemas sintéticos fixos**; não usar bancos persistentes. Antes de repetir, preserve os outputs, que usam nomes estáveis.\n\n## Tentativas preservadas e limites\n\nAs reproduções iniciais comprovam 400 em 1.001 itens e duas perdas de contexto. Primeira cópia de dependências precisou incluir os diretórios dist dos pacotes; uma tentativa de build foi bloqueada pela sandbox. Houve correções de sintaxe/formatação e de mocks que precisaram fornecer o projeto autorizado. A primeira tentativa concorrente aguardava uma inserção sob o lock de organização e foi corrigida para aguardar sua conclusão após a captura.\n\nPlaywright inicial teve três chamadas legadas à API 3000, rejeitadas com 401 sem criação de projetos; URLs antigas, dados de contrato, tipo de asserção e nome de precificação da fixture também foram corrigidos. As tentativas em \`attempts/\` não são aceites finais e seus skips/falhas não foram ocultados.\n\nPDF foi renderizado/inspecionado; DOCX teve CRC/XML/relacionamentos e linhas conferidos, com falha do renderer registrada separadamente. AWS, Word, carga distribuída e CI remoto não foram certificados. Nenhum plan/apply, deploy, commit ou push foi executado.\n`);
const old = new Map(baseline.files.map(file => [file.path, file]));
const product = [];
function walk(folder, visitor) {
  if (!fs.existsSync(folder)) return;
  for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
    if (entry.isSymbolicLink() || ['node_modules', '.git', '.terraform', 'workspace', 'dist', 'coverage'].includes(entry.name)) continue;
    const file = path.join(folder, entry.name);
    if (entry.isDirectory()) walk(file, visitor); else if (entry.isFile()) visitor(file);
  }
}
const inventory = file => ({ path: path.relative(root, file).replaceAll('\\', '/'), bytes: fs.statSync(file).size, sha256: hash(file) });
const addProduct = file => { const current = inventory(file), prior = old.get(current.path); if (!prior || prior.sha256 !== current.sha256) product.push({ ...current, baseline_sha256: prior?.sha256 ?? null }); };
for (const folder of ['gai-backend/src', 'gai-backend/test', 'gai-frontend/src', 'gai-frontend/e2e', 'infra', '.github']) walk(path.join(root, folder), addProduct);
for (const part of ['gai-backend', 'gai-frontend']) for (const entry of fs.readdirSync(path.join(root, part), { withFileTypes: true })) if (entry.isFile()) addProduct(path.join(root, part, entry.name));
const files = [...product]; walk(__dirname, file => { if (file !== manifestPath) files.push(inventory(file)); });
fs.writeFileSync(manifestPath, JSON.stringify({ at: final.at, changed_product_files: product.sort((a, b) => a.path.localeCompare(b.path)), preservation, self_hash_excluded: true, workspace_dependency_trees_excluded: true, files: files.sort((a, b) => a.path.localeCompare(b.path)) }, null, 2));
console.log(JSON.stringify({ completed: true, backend_distinct: merged.size, mysql: tests.mysql.passed, frontend: frontend.numPassedTests, playwright: browser.stats.expected, preserved_files: preserved.length, changed_product_files: product.length, manifest_files: files.length }));
