# Plano de correções em ondas

<!-- ONDA-1-STATUS -->
## Atualização da Onda 1 — 29/10/2026

Implementação e validação local concluídas; **produção não liberada**. [Relatório da Onda 1](../correcoes-onda-1-integridade-2026-10-28/README.md). GAI-002/003/004/008/009 corrigidas e validadas; GAI-011 corrigida para novas operações UTC, com histórico pendente de análise; GAI-012 parcialmente remediada (7 alertas backend e 1 frontend em --omit=dev). GAI-001/010 preservadas e revalidadas; GAI-005/006/007 continuam abertas.

Padrão 683/683, MySQL 307/307, S3 7/7, frontend 247/247, navegador 2/2; zero skips nas rodadas finais. Cobertura original e lint global aprovados. Não somar reexecuções. **O texto anterior abaixo é histórico preservado**, incluindo a atualização da Onda 0 e as reproduções originais.
<!-- /ONDA-1-STATUS -->


## Atualização após a Onda 0 financeira — 28/10/2026

**GAI-010 e GAI-001: corrigidos e validados localmente.** A correção e as evidências estão em [correcoes-onda-0-financeiro-2026-10-28](../correcoes-onda-0-financeiro-2026-10-28/README.md). Na execução final houve 124 pares concorrentes (109 com barreira InnoDB; 100 de stress), sem regressão de baixa; os resumos foram validados até 1.310 registros e com decimais grandes. Leitura com lock, validação, escrita e auditoria agora compartilham a transação. O GAI-001 foi antecipado para esta onda. Não houve migration ou reparo histórico.

As reproduções originais e os resultados abaixo são o **registro histórico anterior à correção** e foram preservados. Os demais achados continuam abertos. Os dois testes independentes de exportação genérica foram reexecutados e continuam falhos; produção e aceite integrado final permanecem não liberados. Consulte o relatório da Onda 0 para contagens atuais e limites.


Plano para execução posterior; nenhuma correção de implementação foi feita nesta auditoria. As ondas distinguem bloqueios obrigatórios de evolução de escopo. Critérios devem ser verificados sobre a revisão corrigida, sem reusar relatórios antigos como prova.

## Onda 0 — integridade financeira crítica

**Obrigatória antes de aceite integrado/produção: GAI-010.** Tornar transições de pagamento serializáveis e impedir regressão de paid após baixa bem-sucedida. Dependência: preservar regra atual de baixa de pending/approved enquanto a decisão de negócio não mudar; não confundir conserto de corrida com segregação de funções. Aceite: corridas reais approve×paid/edit×paid/cancel×paid produzem sequência válida ou conflito, nunca sucesso de paid seguido de approved; repetição não cria segunda baixa sem estorno; trilha e caixa coerentes. Auditar registros suspeitos em modo somente leitura e preparar eventual remediação histórica para autorização separada.

## Onda 1 — segurança, integridade e teste confiável

**Obrigatórias: GAI-001, GAI-002, GAI-011, GAI-003 e GAI-004.** Agregar todos os pagamentos sem limite de página; validar datas estritamente; alinhar timezone de instantes; separar motores de teste; atualizar expectativas de exportações nas rotas corretas. Dependência: Onda 0 para validar totais sem estado corrompido. Aceite: 101 pagamentos somam 101.00, datas impossíveis recebem 400 sem escrita, instantes não saltam três horas, todos os casos backend rodam no motor correto, fontes/tenant/download revogado continuam negados e CI fica verde sem ocultar suites.

Revalidar todo o catálogo de 161 permissões no ambiente de homologação, incluindo chave ausente, ORG_ADMIN próprio tenant e custom roles com grants mínimos. Não há correção de vazamento crítico comprovado a aplicar indiscriminadamente; preservar os controles que passaram.

## Onda 2 — integrações funcionais

**Obrigatória se escopo de homologação inclui projetos grandes: GAI-006.** Decidir recortes/snapshots paginados e volume representativo do laudo. Aceite: projeto/histórico acima de 1.000 registros gera recorte completo autorizado ou seleção explícita suportada, sem truncamento/hash instável. Revalidar inventário→conciliação→consolidação→avaliação→laudo após mutações.

**Decisões condicionais:** vínculo orçamento/contrato, geração de recebíveis e política para aditivos negativos, moeda das saídas/avaliações, baixa individual de parcela, prestação→reembolso e alocação DRE. Aceite depende de contrato de negócio explícito; não ligar tudo automaticamente nem reclassificar fatos antigos sem plano.

## Onda 3 — experiência do usuário

**Obrigatória para requisito de navegação integrada: GAI-005.** Preservar project_id e retorno ao projeto em orçamento, parâmetros, proposta, recebível/detalhe, caixa e DRE. Aceite: desktop/mobile com refresh, deep link e histórico sem perder contexto; novo teste deve exigir comportamento correto, substituindo a caracterização do defeito atual. Revalidar permissões visuais, loading/erro, filtros e atualização de indicadores. Placeholders devem ficar claramente fora do escopo homologado ou receber evolução em outra entrega autorizada.

## Onda 4 — desempenho e dívida técnica

**Obrigatórias para pipeline verde/gestão de schema: GAI-008 e GAI-009.** Lint sem --fix, dívida corrigida, introspecção de colunas geradas funcional. Aceite: nenhuma coluna removida automaticamente pelo diff; vínculo ativo único preservado; todos os checks globais passam. Bundle principal de 1,73 MB, locks por organização, consultas N+1, extração documental, retention de blobs e duplicações de escopo pedem medição antes de refatoração. Futuro: code splitting, orçamento de performance e carga realista, sem prometer ganho não medido.

## Onda 5 — homologação de infraestrutura e produção

**Obrigatórias: GAI-007 e pendências AWS/upgrade/restore/DOCX.** Configurar modo documental explicitamente; comprovar backup, retenção e capacidade SQL; aplicar migrations e catálogo apenas em ambiente autorizado com baseline conhecido. Homologar S3 AWS com IAM mínimo, versionamento/GetObjectVersion, criptografia, CORS, PUT/HEAD/GET e expiração. Homologar e-mail, TLS/ALB/CloudFront, logs e observabilidade. Aceite: fluxo real autorizado de gerar/baixar, revogação/tenant negativos, restore de cópia histórica e rollback operacional documentado, sem cadeia down destrutiva.

A liberação depende da Onda 0 e dos bloqueios obrigatórios das ondas anteriores, aceite funcional assinado e nenhuma ocorrência crítica aberta. Esta auditoria não autoriza commit, push, deploy, migration de produção ou alteração de dados reais.

## Melhorias futuras e funcionalidades fora desta correção

Atividades/horas, jornada/retroativos, CRM inbound/outbound, cursos/inscritos/etapas, adiantamentos, reembolso específico, documentos de inventariantes, lote de pagamentos, pivot/edição de planilha livre, PPTX, fotos/legendas de laudos, importador DRE, assinatura e motor normativo. Priorizar pela matriz original e decisões de negócio; não são implementados nesta execução e não devem ser disfarçados de correção obrigatória do núcleo atual.

## Complemento obrigatório da Onda 1

GAI-012: triagem/remediação dos advisories atuais, com análise do grafo efetivamente incluído na imagem de release. Aceite exige tratar critical/high aplicáveis ou documentar tecnicamente não alcance/mitigação antes de produção, sem confundir contagem npm de pacotes/efeitos com CVEs únicos.
