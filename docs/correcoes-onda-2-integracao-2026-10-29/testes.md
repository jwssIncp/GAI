# Testes finais e evidências

## Execuções aprovadas

| Backend | Aprovados | Falhos | Skips | Segundos |
| --- | ---: | ---: | ---: | ---: |
| unit | 430 | 0 | 0 | 80.43 |
| sqlite | 253 | 0 | 0 | 403.16 |
| default | 683 | 0 | 0 | 524.01 |
| coverage | 683 | 0 | 0 | 700.78 |
| mysql | 325 | 0 | 0 | 1294.57 |
| s3 | 7 | 0 | 0 | 37.43 |
| documents-final | 46 | 0 | 0 | 94.62 |
| history-final | 28 | 0 | 0 | 59.85 |
| volume-final | 18 | 0 | 0 | 144.73 |

Frontend: 265 aprovados, zero falhas/skips. Playwright: 14 aprovados, zero falhas, skips ou flaky. Transformação declarativa de task definition: 4 testes Node aprovados. TypeScript, build e ESLint globais passaram nos dois projetos; lint com zero erros e avisos.

Os comandos separados da Onda 1 foram executados em seus motores. `default` e `coverage` repetem unit/SQLite; MySQL repete casos de integração no motor real. A união por arquivo + título + ocorrência resulta em **830 casos backend distintos**, e não na soma das linhas. Reproduções, tentativas e reexecuções não são contadas como casos novos.

Cobertura: statements 77.29%, branches 60.88%, functions 69.77%, lines 77.79%. O threshold de 60% foi mantido.

## Volume

| Itens de origem | Extraídos | Bytes do snapshot | Tempo do cenário (ms) | RSS depois (bytes) | Heap depois (bytes) |
| ---: | ---: | ---: | ---: | ---: | ---: |
| 0 | 0 | 1215 | 208.59 | 503840768 | 279700856 |
| 1 | 1 | 1390 | 205.97 | 513843200 | 289550816 |
| 999 | 999 | 183718 | 1314.82 | 536834048 | 309856352 |
| 1000 | 1000 | 186115 | 1498.05 | 536084480 | 307808632 |
| 1001 | 1001 | 186301 | 1356.48 | 535363584 | 289876152 |
| 2500 | 2500 | 465115 | 2905.68 | 538660864 | 301407232 |
| 5000 | 5000 | 931119 | 6392.67 | 561807360 | 341746096 |

O cenário inclui duas capturas e conferência SQL/persistência; memória é do processo compartilhado, não pico isolado. `mysql/report-volume.json` contém também 1.001 registros por família complementar, 2.500 avaliações históricas, limites 413, formatos e tempos de renderização. A recusa de JSON de 5 MiB ocorre antes de qualquer busca de página de inventário.

O teste concorrente altera item de página posterior e agenda inserção durante a captura; a visão inicial permanece íntegra e a seguinte detecta a mudança. Os testes nativos exigem versão aprovada preservada, validação de formatos, hash e negativas de download. A regressão financeira executa as disputas e limites das Ondas 0/1; consulte também `mysql/concurrency-after.json` e os resultados de temporalidade/exports no mesmo diretório.

## Matriz de exportação nativa

| Itens | Formato | HTTP | Bytes | Páginas PDF | ms |
| ---: | --- | ---: | ---: | ---: | ---: |
| 0 | docx | 201 | 13116 | — | 1367.21 |
| 0 | pdf | 201 | 28941 | 3 | 1513.79 |
| 1 | docx | 201 | 13137 | — | 1461.29 |
| 1 | pdf | 201 | 29117 | 3 | 1618.37 |
| 999 | docx | 201 | 31862 | — | 2278.78 |
| 999 | pdf | 201 | 235219 | 56 | 7188.49 |
| 1000 | docx | 201 | 31323 | — | 2203.00 |
| 1000 | pdf | 201 | 235426 | 56 | 5537.60 |
| 1001 | docx | 201 | 31339 | — | 2631.73 |
| 1001 | pdf | 201 | 235308 | 56 | 6272.03 |
| 2500 | docx | 201 | 58354 | — | 3593.18 |
| 2500 | pdf | 201 | 544327 | 135 | 26335.00 |
| 5000 | docx | 503 | — | — | 5809.59 |
| 5000 | pdf | 503 | — | — | 30582.39 |

Resultados em `evidencias/volume-final/volume-exports.json`. A inspeção independente dos arquivos aceitos confere checksums, ordem integral dos itens e hash de versão em `matrix-content-inspection.json`. Em 5.000 itens a captura e o snapshot são completos, mas DOCX retornou falha do worker e PDF atingiu o timeout: 503 explícito, sem artefato parcial. A resposta genérica do worker não permite atribuir a causa a memória ou tamanho da entrada. A tentativa inicial supunha sucesso de DOCX nesse volume e falhou; foi preservada antes de corrigir essa expectativa para o contrato operacional existente. Nenhum limite do renderer foi ampliado.

A rodada MySQL de 325 casos precede a projeção de metadados do histórico; os 28 testes afetados de laudos/documentos foram repetidos após essa otimização. A matriz final ampliada repete 18 casos e as verificações globais de backend permaneceram aprovadas.

## Navegador e autorização

`e2e/playwright.json` e seus artefatos registram os 14 cenários. Quatro percursos novos combinam ORG_ADMIN/leitor e desktop/mobile. Os dez restantes incluem a navegação contínua anterior e os fluxos reais de contratos, orçamentos, recebíveis, DRE, laudos, documentos, campo, avaliações e conciliação assistida. Sem mock de API; storage em memória no harness é explícito e a integração MinIO independente executa 7 testes.

Leitor não recebe permissões de escrita/exportação. Conteúdo de caixa/DRE exige as leituras de fontes correspondentes; elas são declaradas na fixture sintética. Testes negativos mantêm 401/403 e os contratos existentes de filtros/IDs de outra organização.

## Isolamento e reprodução

- Container exclusivo: `gai-wave2-20261029-mysql`, 127.0.0.1:33347, credenciais exclusivamente sintéticas.
- Regressão destrutiva: `gai_validation_disposable`; navegador: `gai_navigation_disposable`. O segundo alvo é opção restrita ao opt-in da Onda 2 e validada antes da fixture.
- API temporária: 127.0.0.1:33349; Vite preview: 33350. Reutilização de servidores preexistentes desabilitada. O runner recusa alvos literais localhost/127.0.0.1:3000 nos specs.
- Dependências copiadas da instalação isolada validada na Onda 1; lockfiles idênticos. Não se executou npm ci nas instalações originais. Runtime e versões em `runtime-final.json`.

Na raiz, `node docs/correcoes-onda-2-integracao-2026-10-29/validate.cjs sync` sincroniza fontes para as cópias isoladas. Os modos são unit, sqlite, default, coverage, mysql, s3, frontend, backend-checks, frontend-checks e e2e. Os modos MySQL são destrutivos **somente nos schemas sintéticos fixos**; não usar bancos persistentes. Antes de repetir, preserve os outputs, que usam nomes estáveis.

## Tentativas preservadas e limites

As reproduções iniciais comprovam 400 em 1.001 itens e duas perdas de contexto. Primeira cópia de dependências precisou incluir os diretórios dist dos pacotes; uma tentativa de build foi bloqueada pela sandbox. Houve correções de sintaxe/formatação e de mocks que precisaram fornecer o projeto autorizado. A primeira tentativa concorrente aguardava uma inserção sob o lock de organização e foi corrigida para aguardar sua conclusão após a captura.

Playwright inicial teve três chamadas legadas à API 3000, rejeitadas com 401 sem criação de projetos; URLs antigas, dados de contrato, tipo de asserção e nome de precificação da fixture também foram corrigidos. As tentativas em `attempts/` não são aceites finais e seus skips/falhas não foram ocultados.

PDF foi renderizado/inspecionado; DOCX teve CRC/XML/relacionamentos e linhas conferidos, com falha do renderer registrada separadamente. AWS, Word, carga distribuída e CI remoto não foram certificados. Nenhum plan/apply, deploy, commit ou push foi executado.
