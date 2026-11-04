# GAI — Onda 0 financeira — 28/10/2026

**GAI-010 e GAI-001 corrigidos e validados localmente em MySQL 8 descartável.** A aprovação, edição, baixa e cancelamento usam leitura com lock e auditoria na mesma transação; o resumo usa SUM/COUNT decimal sem paginação. Não houve migration, remediação histórica, commit, push ou deploy.

Antes da correção, a barreira MySQL reproduziu 15/15 regressões de baixa e 101 pagamentos somaram 100.00. Na execução final, **124 pares concorrentes, incluindo 109 com barreira InnoDB e 100 de stress, terminaram sem incoerência**. Os 15 pares restantes repetem o cenário HTTP livre original. O resumo foi conferido com 0/1/100/101/1.205/1.310 registros, todos os estados, escopos distintos e somas acima da precisão de centavos de Number.

| Verificação | Aprovados | Falhos | Ignorados |
| --- | ---: | ---: | ---: |
| Unidade backend (test/unit) | 376 | 0 | 0 |
| HTTP/MySQL Onda 0, execução final | 12 | 0 | 0 |
| Integração MySQL, comando completo | 283 | 3 | 7 |
| Integração consolidada, sem duplicar a suíte reexecutada | 284 | 2 | 7 |
| Frontend completo | 247 | 0 | 0 |

TypeScript backend, build Nest isolado e lint dos oito arquivos TypeScript alterados: aprovados. A integração completa ainda registra as duas expectativas independentes conhecidas de exportação genérica; o histórico do comando e da correção de fixtures está em [testes.md](testes.md). Não se declara que esse comando ficou verde.

A entrega cobre os critérios da Onda 0 no ambiente isolado. **O sistema continua sem liberação automática para produção ou aceite final da homologação integrada.** Demais bloqueios e limites estão em [riscos-e-proxima-onda.md](riscos-e-proxima-onda.md).

- [Causas, transações e agregação](causas-e-correcao.md)
- [Invariantes e máquina de estados](invariantes.md)
- [Arquivos e impactos nas APIs/módulos](arquivos-e-impactos.md)
- [Testes, comandos, corridas e limitações](testes.md)
- [Aceite em JSON](evidencias/acceptance.json)
- [Logs das corridas, linhas SQL e auditorias](evidencias/concurrency-after.json)
- [Preservação das fontes anteriores](evidencias/source-preservation.json)

Ambiente exclusivo: container gai-wave0-20261028-mysql, MySQL 8, 127.0.0.1:33327/gai_validation_disposable. O banco local 3306 e o banco de evidências anterior 33317 não receberam testes ou migrations desta onda.

Prestação de contas, parcelas, overview organizacional e caixa também foram conferidos por HTTP real, em dois smokes sem reset do schema. Veja [os critérios de aceite](aceite.md) e [a evidência adicional](evidencias/related-http.json).
