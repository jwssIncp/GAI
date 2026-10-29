# Navegação integrada — GAI-005

## Reprodução e causa confirmada

A reprodução está em `evidencias/reproduction-navigation.json`: nove testes passaram e dois falharam com as novas expectativas de preservação. O menu de `BudgetLayout` gerava links absolutos sem query; a lista de recebíveis abria o detalhe sem `project_id`. As abas de detalhe do orçamento também reconstruíam a query apenas com `tab` e `version`. Eram perdas na construção de links, não uma falha do `Outlet` ou da autorização.

Exemplos anteriores: `/app/budgets/1?project_id=25&status=approved&page=2` → preços sem contexto; `/app/finance/receivables?project_id=25` → `/app/finance/receivables/7` sem contexto. A auditoria original já caracterizava a perda em desktop e mobile. As expectativas antigas de URL sem query foram atualizadas para exigir o projeto preservado.

## Correção

`navigationContext.ts` concentra validação de ID, construção de links e parâmetros admitidos por destino. O projeto está na URL, sem nova chave de localStorage ou dependência de `location.state`. Links de listas, detalhes, seleção de versões, histórico, formulários, menus e abas transportam o contexto. Redirecionamentos dos índices de projeto/preparação preservam query e fragmento. Links de âncora continuam com a query antes de `#`.

Os layouts globais mantêm sua posição na árvore existente do React Router. `ProjectContextLink` mostra o nome e o retorno somente depois de consultar o projeto com a sessão atual; sua chave de cache inclui usuário, organização e ID. Ausência de permissão, ID malformado, resposta divergente ou erro da API não produz um breadcrumb com identidade presumida. Esse breadcrumb identifica o **projeto de origem**; parâmetros de preços continuam organizacionais.

Listas e seus detalhes preservam filtros de URL permitidos. `tab` e `version` não são reenviados como filtros HTTP financeiros. Limpar filtros mantém o contexto de navegação; editar explicitamente o campo Projeto e aplicar permite mudar/remover esse filtro. Seleção de contrato e de visualização do laudo mantém os demais parâmetros.

O dashboard organizacional inclui uma origem de retorno nos links de projetos. O dashboard operacional do leitor usa a lista existente de projetos. `return_to` aceita somente `/app/dashboard` e seus filtros conhecidos; rejeita URLs externas, caminhos relativos a protocolo, barras invertidas, fragmentos, controles e retornos aninhados. Não há redirecionamento automático baseado nesse parâmetro. Os links são intenção de navegação, nunca autorização.

## Escopo de validação real

Os resultados finais e os artefatos estão em [testes.md](testes.md). O spec `integration-navigation-real.spec.ts` cobre ORG_ADMIN e um perfil organizacional composto somente por leituras, em 1440×1000 e 390×844. Dados sintéticos são criados pelas APIs reais com vínculos explícitos de projeto, orçamento, contrato, laudo e recebível manual.

| Percurso | Verificação |
| --- | --- |
| Projeto → contrato → projeto | Seleção de registro real, refresh e origem de dashboard mantida |
| Projeto → laudo → projeto | Detalhe de laudo criado para o projeto, refresh e retorno |
| Projeto → avaliações → projeto | Painel existente de avaliação dentro de Itens; não foi inventada rota independente |
| Dashboard → projeto → dashboard | Filtro de busca na origem, índice curto, refresh e retorno explícito |
| Projeto → orçamento → projeto | Preços, lista, detalhe, histórico, voltar/avançar, refresh e retorno |
| Projeto → recebível → projeto | Registro manual realmente vinculado, histórico e refresh |
| Projeto → DRE/caixa → retorno | Layout financeiro, classificações e retorno ao projeto |
| Campo → inventário | Abas existentes do mesmo projeto |
| Preparação → laudos | Abas existentes sem criar integração automática de estados |
| Outro projeto | Link direto/refresh troca o filtro e não reutiliza os registros anteriores |

O spec anterior de navegação contínua também foi adaptado: um link global é válido quando preserva `project_id`; não se exige que todas as abas tenham pathname `/projects/:id`. A instância do layout, âncoras, histórico, links diretos, overflow e navegação mobile continuam verificados. Os outros fluxos reais de negócio foram reexecutados, sem mock de API.

## Autorizações e limites

SessionAuthGuard, PermissionsGuard e ProjectScopeService permanecem inalterados. Os testes verificam a negativa de escrita para o leitor e IDs de organização externa. O contrato existente diferencia consulta direta de projeto (403), filtro inválido de recebíveis (400) e interseção vazia de orçamentos (200 com `items=[]` e `total=0`). Nenhum desses caminhos pode devolver o nome do projeto externo.

Os viewports e perfis registrados não certificam toda combinação de modal, filtro ou perfil de plataforma. Sessão continua em sessionStorage: refresh da mesma aba é coberto; uma nova aba não é presumida autenticada.
