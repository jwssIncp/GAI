const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto'), assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../..'), out = path.join(__dirname, 'evidencias'), audit = path.join(root, 'docs/auditoria-integrada-gai-2026-10-28');
const read = n => JSON.parse(fs.readFileSync(path.join(out, n), 'utf8').replace(/^\uFEFF/, ''));
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const regression = read('regression-jest.json'), integrity = read('integrity-jest.json'), unit = read('unit-jest.json'), frontend = read('frontend-vitest.json');
assert.equal(integrity.numFailedTests, 0); assert.equal(integrity.numPassedTests, 12);
assert.equal(unit.numFailedTests, 0); assert.equal(frontend.numFailedTests, 0);
const checks = read('backend-checks.json'); assert.equal(checks.length, 3); assert.ok(checks.every(c => c.exit_code === 0));
const finalChecks = read('final-checks.json'); assert.equal(finalChecks.length, 2); assert.ok(finalChecks.every(c => c.exit_code === 0));
const related = read('related-http.json'); assert.equal(related.passed, true); assert.equal(related.results.length, 16);
const finalFile = integrity.testResults[0].name;
const combinedFiles = regression.testResults.filter(r => r.name !== finalFile).concat(integrity.testResults);
const cases = combinedFiles.flatMap(f => f.assertionResults.map(t => ({ file: path.relative(root, f.name), name: t.fullName, status: t.status })));
const counts = rows => ({ passed: rows.filter(t => t.status === 'passed').length, failed: rows.filter(t => t.status === 'failed').length, skipped: rows.filter(t => t.status === 'pending' || t.status === 'skipped' || t.status === 'todo').length, total: rows.length });
const combined = counts(cases), failures = cases.filter(t => t.status === 'failed');
assert.equal(combined.failed, 2); assert.ok(failures.every(t => t.file.endsWith('security-storage.e2e-spec.ts')));
const concurrent = read('concurrency-after.json'), races = concurrent.filter(r => Array.isArray(r.responses));
const locked = races.filter(r => Array.isArray(r.waits));
assert.equal(locked.length, 109); assert.equal(races.length, 124);
const incoherent = races.filter(r => r.responses.some(s => s.status === 200 && s.body.status === 'paid') && r.row.status !== 'paid');
assert.equal(incoherent.length, 0);
const summary = { generated_at: new Date().toISOString(), integrity: { passed: integrity.numPassedTests, failed: integrity.numFailedTests }, concurrency: { acceptance_races: races.length, with_innodb_barrier: locked.length, replay_original: races.length-locked.length, stress: 100, incoherent: incoherent.length }, unit: { passed: unit.numPassedTests, failed: unit.numFailedTests }, frontend: { passed: frontend.numPassedTests, failed: frontend.numFailedTests }, full_integration_command: { passed: regression.numPassedTests, failed: regression.numFailedTests, skipped: regression.numPendingTests, total: regression.numTotalTests }, integration_combined_without_duplicate: combined, failures, backend_checks: checks };
summary.related_http = { passed: related.passed, asserted_calls: related.results.length, project: related.project, accountability: related.accountability };
summary.final_checks = finalChecks;
fs.writeFileSync(path.join(out, 'acceptance.json'), JSON.stringify(summary, null, 2));
fs.writeFileSync(path.join(out, 'integration-consolidated.json'), JSON.stringify({ ...combined, rule: 'Full integration, replacing only the corrected integrity suite with its final complete rerun', cases }, null, 2));
const original = JSON.parse(fs.readFileSync(path.join(audit, 'evidencias/inventory.json'), 'utf8'));
const changed = [], missing = [];
for (const f of original.manifest) { const file=path.join(root,f.file); if(!fs.existsSync(file)) missing.push(f.file); else if(hash(file)!==f.sha256) changed.push({ file:f.file, before:f.sha256, after:hash(file) }); }
assert.equal(changed.length,6); assert.equal(missing.length,0);
const preserved = ['payment-race.json','finance-reproduction.json'].map(n=>({ file:'docs/auditoria-integrada-gai-2026-10-28/evidencias/'+n, sha256:hash(path.join(audit,'evidencias',n)) }));
fs.writeFileSync(path.join(out,'source-preservation.json'),JSON.stringify({ checked_files:original.manifest.length, changed, missing, original_reproductions:preserved },null,2));
const table = `| Verificação | Aprovados | Falhos | Ignorados |\n| --- | ---: | ---: | ---: |\n| Unidade backend (test/unit) | ${unit.numPassedTests} | 0 | 0 |\n| HTTP/MySQL Onda 0, execução final | 12 | 0 | 0 |\n| Integração MySQL, comando completo | ${regression.numPassedTests} | ${regression.numFailedTests} | ${regression.numPendingTests} |\n| Integração consolidada, sem duplicar a suíte reexecutada | ${combined.passed} | 2 | ${combined.skipped} |\n| Frontend completo | ${frontend.numPassedTests} | 0 | 0 |`;
fs.writeFileSync(path.join(__dirname,'README.md'),`# GAI — Onda 0 financeira — 28/10/2026\n\n**GAI-010 e GAI-001 corrigidos e validados localmente em MySQL 8 descartável.** A aprovação, edição, baixa e cancelamento usam leitura com lock e auditoria na mesma transação; o resumo usa SUM/COUNT decimal sem paginação. Não houve migration, remediação histórica, commit, push ou deploy.\n\nAntes da correção, a barreira MySQL reproduziu 15/15 regressões de baixa e 101 pagamentos somaram 100.00. Na execução final, **124 pares concorrentes, incluindo 109 com barreira InnoDB e 100 de stress, terminaram sem incoerência**. Os 15 pares restantes repetem o cenário HTTP livre original. O resumo foi conferido com 0/1/100/101/1.205/1.310 registros, todos os estados, escopos distintos e somas acima da precisão de centavos de Number.\n\n${table}\n\nTypeScript backend, build Nest isolado e lint dos oito arquivos TypeScript alterados: aprovados. A integração completa ainda registra as duas expectativas independentes conhecidas de exportação genérica; o histórico do comando e da correção de fixtures está em [testes.md](testes.md). Não se declara que esse comando ficou verde.\n\nA entrega cobre os critérios da Onda 0 no ambiente isolado. **O sistema continua sem liberação automática para produção ou aceite final da homologação integrada.** Demais bloqueios e limites estão em [riscos-e-proxima-onda.md](riscos-e-proxima-onda.md).\n\n- [Causas, transações e agregação](causas-e-correcao.md)\n- [Invariantes e máquina de estados](invariantes.md)\n- [Arquivos e impactos nas APIs/módulos](arquivos-e-impactos.md)\n- [Testes, comandos, corridas e limitações](testes.md)\n- [Aceite em JSON](evidencias/acceptance.json)\n- [Logs das corridas, linhas SQL e auditorias](evidencias/concurrency-after.json)\n- [Preservação das fontes anteriores](evidencias/source-preservation.json)\n\nAmbiente exclusivo: container gai-wave0-20261028-mysql, MySQL 8, 127.0.0.1:33327/gai_validation_disposable. O banco local 3306 e o banco de evidências anterior 33317 não receberam testes ou migrations desta onda.\n`);
fs.appendFileSync(path.join(__dirname, 'README.md'), '\nPrestação de contas, parcelas, overview organizacional e caixa também foram conferidos por HTTP real, em dois smokes sem reset do schema. Veja [os critérios de aceite](aceite.md) e [a evidência adicional](evidencias/related-http.json).\n');
const notice = `## Atualização após a Onda 0 financeira — 28/10/2026\n\n**GAI-010 e GAI-001: corrigidos e validados localmente.** A correção e as evidências estão em [correcoes-onda-0-financeiro-2026-10-28](../correcoes-onda-0-financeiro-2026-10-28/README.md). Na execução final houve 124 pares concorrentes (109 com barreira InnoDB; 100 de stress), sem regressão de baixa; os resumos foram validados até 1.310 registros e com decimais grandes. Leitura com lock, validação, escrita e auditoria agora compartilham a transação. O GAI-001 foi antecipado para esta onda. Não houve migration ou reparo histórico.\n\nAs reproduções originais e os resultados abaixo são o **registro histórico anterior à correção** e foram preservados. Os demais achados continuam abertos. Os dois testes independentes de exportação genérica foram reexecutados e continuam falhos; produção e aceite integrado final permanecem não liberados. Consulte o relatório da Onda 0 para contagens atuais e limites.\n\n`;
for(const name of ['README.md','problemas-priorizados.md','plano-correcoes.md','auditoria-financeira.md','testes.md','integracoes.md','banco-migrations.md']) {
 const file=path.join(audit,name), backup=path.join(out,'antes','auditoria-'+name);
 if(!fs.existsSync(backup)) fs.copyFileSync(file,backup);
 const content=fs.readFileSync(backup,'utf8'), pos=content.indexOf('\n');
 fs.writeFileSync(file, content.slice(0,pos+1)+'\n'+notice+content.slice(pos+1));
}
const issueFile=path.join(audit,'evidencias/issues.json'), issueBackup=path.join(out,'antes','issues.json');
if(!fs.existsSync(issueBackup))fs.copyFileSync(issueFile,issueBackup);
const issues=JSON.parse(fs.readFileSync(issueBackup,'utf8'));
for(const issue of issues)if(['GAI-001','GAI-010'].includes(issue.id)) {
 issue.status='CORRIGIDO_E_VALIDADO_LOCALMENTE';
 issue.resolution={ date:'2026-10-28', wave:0, report:'docs/correcoes-onda-0-financeiro-2026-10-28/README.md', evidence:'docs/correcoes-onda-0-financeiro-2026-10-28/evidencias/acceptance.json', historical_reproduction_preserved:true, production_released:false };
}
fs.writeFileSync(issueFile,JSON.stringify(issues,null,2)+'\n');
console.log(JSON.stringify(summary));
