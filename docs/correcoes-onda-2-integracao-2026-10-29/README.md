# Onda 2 — integração funcional e laudos

Concluída e validada localmente em 29/10/2026. **Produção não liberada.**

- **GAI-005 corrigida:** contexto de projeto em URL, retorno autorizado, filtros/versões e navegação desktop/mobile com histórico e refresh.
- **GAI-006 corrigida:** extração em lotes, estimativa SQL de bytes, leitura consistente e falhas integrais explícitas; 5.000 itens extraídos e PDF/DOCX aprovados de 2.500 itens.
- **GAI-007 preparada:** modo documental e capacidade em Terraform e no registro de task definitions; validação local aprovada, homologação AWS pendente.

Regressões finais: **683 backend padrão, 325 MySQL, 265 frontend, 7 S3 local e 14 Playwright**. 830 casos backend distintos, sem somar reexecuções. Zero falhas/skips nas rodadas finais; TypeScript, builds, lint global e cobertura original aprovados.

A extração de 5.000 itens foi completa; nesse volume, PDF/DOCX foram recusados explicitamente pelo renderer, sem artefato parcial.

O PDF de 2.500 itens tem 135 páginas. DOCX tem OOXML e conteúdo integral verificados; **paginação Word não homologada** por indisponibilidade do renderer requerido.

## Relatórios

- [Navegação e permissões](navegacao.md)
- [Extração, consistência e limites](extracao-laudos.md)
- [PDF/DOCX e inspeção](documentos.md)
- [Infraestrutura ECS preparada](infraestrutura-ecs.md)
- [Testes e desempenho](testes.md)
- [Riscos restantes](riscos-residuais.md)
- [Arquivos e hashes](arquivos.json)

As entregas anteriores (5994 arquivos conferidos), as 33 migrations, os lockfiles e as versões diretas das instalações originais foram preservados. Testes usaram cópias isoladas das dependências e dois schemas exclusivos no container da Onda 2, em 127.0.0.1:33347.

Não houve commit, push, deploy, plan/apply AWS, migration em produção ou regravação de laudos históricos. A primeira tentativa de navegador teve chamadas legadas indevidas a localhost:3000, todas rejeitadas com 401; sua correção e a proteção adicionada estão documentadas nas tentativas de teste.
