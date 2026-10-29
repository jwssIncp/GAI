# Interatividade e cobertura

Existem 955 declarações estáticas de controles na varredura atual. Uma declaração em map pode produzir várias instâncias; contagem estática não é quantidade de botões executados. [inventario-controles.json](evidencias/inventario-controles.json) guarda arquivo/linha, tag, label, atributos, conexão e sinais de permissão, feedback, pendência, atualização e teclado. Os sinais são heurísticos de código, não certificações.

## Correções comprovadas

| Ação | Correção | Evidência |
| --- | --- | --- |
| Abrir/fechar navegação mobile | Foco contido, Escape e retorno ao acionador | responsive modules |
| Recolher/expandir sidebar | Funcional, persistente e nomeada | responsive modules desktop |
| Alternar tema | Claro/escuro/sistema, persistência e sincronização | useTheme.test.tsx e theme persistence |
| Perfil | Consulta real de login, email, organização e perfis | theme persistence |
| Recuperar/redefinir senha | Falhas da API visíveis, retry e bloqueio enquanto envia | PasswordPages.test.tsx e invalid reset token |
| Buscar/paginar listas | Estado na URL, refresh e histórico | useListState.test.tsx; CRUD real de projeto |
| Preparação e vista financeira | Contexto e aba na URL | preparation context |
| Tabelas e filtros | Labels, foco e rolagem; valores e operações preservados | matriz responsiva e CRUD real |

## Cobertura executada por família

Playwright de redesign: login ORG_ADMIN, busca, criação e validação de projeto, paginação real de 21 registros, ordenação no dashboard, cancelamento de confirmação sem alterar o registro, CSV real, modais/drawers, menu, perfil, logout, erro real de token, temas e histórico. O conjunto das Ondas anteriores cobre leitor, CRUDs e ações críticas de contratos, orçamentos, recebíveis, DRE, laudos/documentos, campo, avaliações e conciliação; consulte os títulos exatos em testes.md.

## Ações explicitamente não verificadas individualmente

Não foram executadas todas as combinações de permissão, estado, edição, exclusão, arquivamento, reabertura, upload, falha de rede e concorrência de cada instância de controle. A lista completa, por arquivo/linha/label, está em [acoes-nao-verificadas.json](evidencias/acoes-nao-verificadas.json). Ela inclui controles cobertos apenas por renderização/screenshot ou por famílias de fluxo, sem comprovação individual. [cobertura-controles.json](evidencias/cobertura-controles.json) distingue os poucos casos com vínculo direto e conservador à execução.

Não foram afrouxadas permissões ou removidas confirmações financeiras/patrimoniais. Handlers vazios e falsos sucessos não foram adicionados. Operações não implementadas continuam com indisponibilidade explícita; perfil deixou de ser placeholder.
