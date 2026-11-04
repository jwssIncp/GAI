# Onda 1 — Integridade e qualidade técnica

**Implementação e validação local concluídas em 29/10/2026. Não constitui liberação para produção.** A pasta conserva a data solicitada de 28/10. Nenhum commit, push, deploy, migration de produção ou alteração no banco real foi executado.

| Ocorrência | Situação nesta onda | Evidência principal |
|---|---|---|
| GAI-002 | Corrigida e validada | Calendário estrito, HTTP 400 sem escrita e testes de DTO/domínio |
| GAI-011 | UTC consistente para novas operações; histórico exige análise própria | Quatro fusos, pools UTC, meia-noite, SQL/API/auditoria e filtros |
| GAI-003 | Runners separados e aprovados localmente | Padrão, cobertura, MySQL e S3 sem falhas/skips; job CI definido, execução remota pendente |
| GAI-004 | Corrigida e validada | Genérica 409, rotas específicas 403/201, persistência e filtros |
| GAI-009 | Metadata corrigida; divergências gerais de schema não aplicadas | 33 migrations, tabela/expressão/índice e diff de leitura |
| GAI-008 | Lint global aprovado | Backend e frontend: 0 erros e 0 avisos; sem novas desativações globais |
| GAI-012 | Remediação parcial; riscos residuais documentados | 7 alertas backend e 1 frontend em --omit=dev; ferramentas também inventariadas |
| GAI-001 / GAI-010 | Correções da Onda 0 preservadas e revalidadas | 124 pares concorrentes, somas até 1.310 registros e regressão de caixa/prestação/DRE |
| GAI-005 / GAI-006 / GAI-007 | Abertas, fora desta onda | Navegação, limite documental e ECS permanecem no plano |

## Validação final

- Backend padrão: **683 testes em 113 suítes**, incluindo 430 unitários e 253 SQLite/contrato.
- MySQL 8 exclusivo 33337: **307 testes em 45 suítes**; S3 isolado 33318: **7 testes**.
- Frontend: **247 testes**; Playwright: **2 fluxos reais**, sem mock de API.
- TypeScript, builds e lint global aprovados nos dois projetos. Cobertura global: statements 77.53%, branches 61%, functions 69.9%, lines 78.02%; limiar original de 60% preservado.
- Todas as execuções finais acima têm zero falhas e zero testes ignorados. Há **812 casos backend distintos**, deduplicados entre motores; reexecuções, 124 pares concorrentes e passos HTTP não são somados como novos testes Jest.

## Preservação e limites

Baseline Git: 3 staged, 15494 unstaged e 3751 não rastreados. Os três caminhos staged permanecem iguais; nenhum comando Git de escrita foi usado. 50 arquivos da Onda 0 e as 32 migrations anteriores mantêm os hashes. Arquivos já modificados do usuário foram preservados; os node_modules originais continuam nas versões anteriores. As validações usam instalações isoladas consistentes com os novos lockfiles, descritas em runtime-final.json.

A migration 33 registra metadata de coluna gerada sem regravar dados. Existem 627 sugestões de diff preexistente, **não aplicadas**. Instantes históricos mistos, cadeia SQLite, Zod 3, ferramentas dev, scan da imagem e GAI-005/006/007 continuam pendências explícitas.

## Leitura e reprodução

- [Causas, correções, impacto e evidências](causas-e-correcoes.md)
- [Comandos, resultados e falhas intermediárias](testes.md)
- [Análise de todos os 25 pacotes dos alertas originais](dependencias.md)
- [Migrations, metadata e divergências de schema](migrations-schema.md)
- [Riscos residuais](riscos-residuais.md)
- [Arquivos alterados e hashes](arquivos.json)
- [Resultado estruturado](evidencias/final-validation.json), [preservação](evidencias/preservation-final.json), [schema](evidencias/schema-final.json), [dump sintético](evidencias/final-synthetic.sql.json)
