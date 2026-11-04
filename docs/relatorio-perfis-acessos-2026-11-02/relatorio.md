# Relatório de perfis e acessos — GAI

Consulta em 02/11/2026, 15:05:54 (America/Sao_Paulo).

Fonte: banco MySQL local configurado, localhost:3306/gai, ambiente local, e código atual do backend e frontend. A consulta usou uma transação somente de leitura. Nenhum perfil, usuário, vínculo ou permissão foi alterado. Este relatório não confirma o estado de um banco de produção nem a existência de sessões online.

## Situação encontrada

- 2 organizações ativas.
- 3 usuários, todos com status ACTIVE e sem bloqueio temporário registrado.
- 3 perfis cadastrados, todos ativos: 2 de sistema e 1 personalizado.
- 3 atribuições de perfil, todas ativas e sem revogação.
- 161 permissões em 43 grupos: 159 de escopo ORGANIZATION e 2 de escopo PLATFORM.
- O catálogo do banco coincide com as 161 chaves do seed atual; não há chaves faltantes ou excedentes.
- A tabela permissions não tem indicador de ativo/inativo. Permissão cadastrada, permissão atribuída e funcionalidade utilizável são situações diferentes.

## Tipos de perfil e alcance

| Perfil | Tipo | Alcance e comportamento | Situação no banco |
| --- | --- | --- | --- |
| PLATFORM_ADMIN | SYSTEM | Administrador global; recebe automaticamente todas as permissões cadastradas. Deve pertencer a usuário sem organização. | ID 1, ativo, 1 usuário |
| ORG_ADMIN | SYSTEM | Administrador da própria organização; recebe automaticamente todas as permissões de escopo ORGANIZATION. | ID 2, ativo, 1 usuário |
| ORG_USER | SYSTEM | Previsto nas regras e enumerações; vinculado a usuário de organização. Não recebe permissões automáticas pelo resolvedor. | Não cadastrado; sem atribuições |
| Operador | ORGANIZATION | Perfil personalizado da organização 1; recebe somente users:read. | ID 3, ativo, 1 usuário |

SYSTEM e ORGANIZATION são os dois tipos persistidos de perfil. PLATFORM e ORGANIZATION são os dois escopos de permissão. A chave ORG_USER existe no código, mas não pode ser atribuída agora pela API porque não há registro correspondente em roles; o seed bootstrap atual cria apenas os dois perfis administrativos de sistema.

Perfis personalizados podem receber nomes definidos pela organização e combinar permissões existentes. Um usuário pode possuir vários perfis compatíveis; suas permissões se somam. Não há concessão direta usuário-permissão nem regra de negação nesse modelo. Um perfil restrito não reduz os privilégios de quem também possui ORG_ADMIN.

## Usuários e permissões resolvidas

| Login | Organização | Status | Perfil | Permissões resolvidas |
| --- | --- | --- | --- | --- |
| platform.admin | Plataforma | ACTIVE | PLATFORM_ADMIN | 161 |
| org.admin | 1 | ACTIVE | ORG_ADMIN | 159 |
| test.user | 1 | ACTIVE | Operador | users:read |

O total de permissões resolvidas descreve as chaves que o sistema calcula para o usuário; não garante acesso a cada endpoint, pois algumas rotas também exigem perfil de sistema, escopo e regras de negócio. O usuário test.user possui users:read, mas o controller de usuários exige PLATFORM_ADMIN ou ORG_ADMIN. Assim, o perfil Operador atual não habilita a consulta administrativa de usuários.

| Organização | Status | Usuários | Perfis personalizados |
| --- | --- | --- | --- |
| 1 — GAI Test Organization | ACTIVE | 2 | 1 |
| 2 — SINTETICO Outra Organizacao 1793117419454 | ACTIVE | 0 | 0 |

A organização 2 está ativa, mas não possui usuários nem perfis personalizados.

## O que o administrador de organização pode conceder

1. Criar perfis personalizados da própria organização, com nome, descrição e ao menos uma permissão existente de escopo ORGANIZATION.
2. Combinar as 159 permissões organizacionais do catálogo, respeitando as exigências adicionais de cada funcionalidade.
3. Editar o conjunto de permissões, renomear, ativar e desativar esses perfis.
4. Atribuir e revogar perfis personalizados ativos para usuários da própria organização.
5. Atribuir e revogar o perfil de sistema ORG_ADMIN para outros usuários da própria organização. Isso concede administração completa da organização, inclusive gestão de usuários e perfis.
6. Atribuir ORG_USER se esse perfil de sistema vier a estar cadastrado e ativo; hoje ele não está disponível no banco consultado.
7. Criar usuários da própria organização, atualizar email e senha, ativar ou desativar usuários. A criação do usuário e a atribuição dos perfis são operações separadas.

Limites implementados:

- Não pode conceder PLATFORM_ADMIN nem as permissões organizations:read e organizations:write.
- Não pode gerenciar usuários ou perfis de outra organização, nem transferir um usuário entre organizações.
- Não pode criar novas chaves de permissão nem alterar perfis de sistema pelas rotas de perfis personalizados.
- Atribuições exigem perfil ativo e compatível com a organização do usuário.
- Conceder users:read/users:write ou org_roles:read/org_roles:write a um perfil personalizado não o transforma em administrador: as rotas administrativas também exigem PLATFORM_ADMIN ou ORG_ADMIN.
- Os privilégios de ORG_ADMIN acompanham automaticamente o catálogo organizacional, sem exigir vínculos explícitos na tabela role_permissions.
- As atribuições de perfil não possuem seleção de empresa, unidade ou projeto: o vínculo persistido é usuário-perfil. Os módulos ainda aplicam suas próprias regras sobre os registros acessados.

## Disponibilidade na interface e na API

A API implementa criação, edição, ativação/desativação de perfis personalizados e atribuição/revogação de perfis aos usuários. Na interface atual, a tela “Perfis e acessos” apenas lista o catálogo e os perfis; não apresenta formulários para montar perfis ou botões para atribuí-los. A tela “Usuários” cria e lista usuários, mas seu formulário não seleciona perfis. Existem métodos no cliente HTTP para essas operações, sem chamadas nas telas analisadas. Portanto, hoje a concessão completa exige usar a API ou implementar os controles correspondentes na interface.

O PLATFORM_ADMIN também não tem um seletor de organização na tela de perfis atual. A API permite indicar a organização no caminho da requisição.

## Observações relevantes

- **ORG_USER ausente:** previsto no código, sem registro no banco e sem criação no bootstrap atual.
- **Operador sem acesso útil ao cadastro de usuários:** sua única permissão é users:read, mas a rota exige perfil administrativo adicional.
- **Permissões reservadas:** assets:read e assets:write estão descritas no catálogo como reservadas para módulo futuro; o catálogo de ativos implementado usa catalog-assets:*.
- **Chaves sem uso direto localizado nos módulos:** inventory-accounting-items:create e payments:export estão cadastradas, mas não foi encontrada referência literal nos módulos atuais. O controller contábil usa inventory-accounting-items:import para importação. Não trate essas chaves isoladas como comprovação de uma ação disponível.
- **Proteção ao último administrador:** as rotinas examinadas impedem remover o último PLATFORM_ADMIN ativo; não há proteção equivalente ao último ORG_ADMIN nessas rotinas de revogação/desativação.
- **Desativação de perfil:** DELETE verifica usuários ativos vinculados e pode impedir a desativação; PATCH aceita is_active e não repete essa verificação no caso de uso de atualização.
- **Atualização de acesso:** o backend recalcula perfis e permissões nas requisições autenticadas; usuário e organização precisam estar ativos, e o vínculo precisa estar ativo, não revogado e compatível. Uma sessão válida também é necessária.

## Catálogo completo por grupo

As tabelas abaixo reproduzem as 161 permissões cadastradas. As 159 de escopo ORGANIZATION podem integrar perfis personalizados; sua utilização depende das regras de cada rota. As 2 de escopo PLATFORM ficam fora da concessão de ORG_ADMIN.

### Organizações (administração da plataforma)

Escopo: PLATFORM. Quantidade: 2.

| ID | Permissão | Ação | Descrição cadastrada |
| --- | --- | --- | --- |
| 1 | organizations:read | Consultar | Listar e consultar organizations |
| 2 | organizations:write | Criar e atualizar | Criar e atualizar organizations |

### Avaliações patrimoniais

Escopo: ORGANIZATION. Quantidade: 3.

| ID | Permissão | Ação | Descrição cadastrada |
| --- | --- | --- | --- |
| 133 | asset-valuations:batch-create | Criar em lote | Registrar avaliações patrimoniais em lote |
| 119 | asset-valuations:create | Criar | Registrar avaliacao manual |
| 120 | asset-valuations:read | Consultar | Consultar historico de avaliacoes |

### Ativos — permissões reservadas

Escopo: ORGANIZATION. Quantidade: 2.

| ID | Permissão | Ação | Descrição cadastrada |
| --- | --- | --- | --- |
| 7 | assets:read | Consultar | Reservado — leitura de ativos (módulo futuro) |
| 8 | assets:write | Criar e atualizar | Reservado — escrita de ativos (módulo futuro) |

### Conciliação assistida

Escopo: ORGANIZATION. Quantidade: 3.

| ID | Permissão | Ação | Descrição cadastrada |
| --- | --- | --- | --- |
| 131 | assisted-reconciliation:generate | Gerar | Conciliação assistida: generate |
| 130 | assisted-reconciliation:read | Consultar | Conciliação assistida: read |
| 132 | assisted-reconciliation:review | Revisar | Conciliação assistida: review |

### Orçamentos

Escopo: ORGANIZATION. Quantidade: 5.

| ID | Permissão | Ação | Descrição cadastrada |
| --- | --- | --- | --- |
| 142 | budgets:approve | Aprovar | Orçamentos: approve |
| 141 | budgets:configure-prices | Configurar preços | Orçamentos: configure-prices |
| 140 | budgets:edit | Editar | Orçamentos: edit |
| 160 | budgets:export | Exportar | Documentos profissionais: budgets:export |
| 139 | budgets:read | Consultar | Orçamentos: read |

### Fluxo de caixa

Escopo: ORGANIZATION. Quantidade: 1.

| ID | Permissão | Ação | Descrição cadastrada |
| --- | --- | --- | --- |
| 147 | cash-flow:read | Consultar | Financeiro: read |

### Catálogo de ativos

Escopo: ORGANIZATION. Quantidade: 5.

| ID | Permissão | Ação | Descrição cadastrada |
| --- | --- | --- | --- |
| 78 | catalog-assets:create | Criar | Criar ativos do catalogo da organization |
| 81 | catalog-assets:deactivate | Desativar | Desativar ativos do catalogo da organization |
| 82 | catalog-assets:reactivate | Reativar | Reativar ativos do catalogo da organization |
| 79 | catalog-assets:read | Consultar | Listar e consultar ativos do catalogo da organization |
| 80 | catalog-assets:update | Atualizar | Atualizar ativos do catalogo da organization |

### Indicadores comerciais

Escopo: ORGANIZATION. Quantidade: 1.

| ID | Permissão | Ação | Descrição cadastrada |
| --- | --- | --- | --- |
| 138 | commercial-indicators:read | Consultar | Gestão contratual: read |

### Empresas

Escopo: ORGANIZATION. Quantidade: 5.

| ID | Permissão | Ação | Descrição cadastrada |
| --- | --- | --- | --- |
| 83 | companies:create | Criar | Criar companies da organization |
| 86 | companies:deactivate | Desativar | Desativar companies |
| 87 | companies:reactivate | Reativar | Reativar companies |
| 84 | companies:read | Consultar | Listar e consultar companies |
| 85 | companies:update | Atualizar | Atualizar companies |

### Unidades das empresas

Escopo: ORGANIZATION. Quantidade: 5.

| ID | Permissão | Ação | Descrição cadastrada |
| --- | --- | --- | --- |
| 88 | company-units:create | Criar | Criar unidades de companies |
| 91 | company-units:deactivate | Desativar | Desativar unidades de companies |
| 92 | company-units:reactivate | Reativar | Reativar unidades de companies |
| 89 | company-units:read | Consultar | Listar e consultar unidades de companies |
| 90 | company-units:update | Atualizar | Atualizar unidades de companies |

### Consolidação de evidências

Escopo: ORGANIZATION. Quantidade: 1.

| ID | Permissão | Ação | Descrição cadastrada |
| --- | --- | --- | --- |
| 118 | consolidations:create | Criar | Consolidar evidencias de conciliacao |

### Contratos

Escopo: ORGANIZATION. Quantidade: 4.

| ID | Permissão | Ação | Descrição cadastrada |
| --- | --- | --- | --- |
| 136 | contracts:amend | Aditar | Gestão contratual: amend |
| 137 | contracts:archive | Arquivar | Gestão contratual: archive |
| 135 | contracts:edit | Editar | Gestão contratual: edit |
| 134 | contracts:read | Consultar | Gestão contratual: read |

### Documentos profissionais

Escopo: ORGANIZATION. Quantidade: 1.

| ID | Permissão | Ação | Descrição cadastrada |
| --- | --- | --- | --- |
| 161 | documents:templates | Gerenciar modelos | Documentos profissionais: documents:templates |

### DRE gerencial

Escopo: ORGANIZATION. Quantidade: 6.

| ID | Permissão | Ação | Descrição cadastrada |
| --- | --- | --- | --- |
| 152 | dre:adjust | Ajustar | DRE gerencial: adjust |
| 151 | dre:classify | Classificar | DRE gerencial: classify |
| 150 | dre:configure | Configurar | DRE gerencial: configure |
| 154 | dre:export | Exportar | DRE gerencial: export |
| 153 | dre:periods | Gerenciar períodos | DRE gerencial: periods |
| 149 | dre:read | Consultar | DRE gerencial: read |

### Prestações de contas

Escopo: ORGANIZATION. Quantidade: 4.

| ID | Permissão | Ação | Descrição cadastrada |
| --- | --- | --- | --- |
| 108 | expense-accountabilities:close | Fechar | Fechar prestacoes de contas |
| 105 | expense-accountabilities:create | Criar | Abrir prestacoes de contas |
| 106 | expense-accountabilities:read | Consultar | Consultar prestacoes de contas |
| 107 | expense-accountabilities:update | Atualizar | Vincular despesas a prestacoes |

### Parcelas de despesas

Escopo: ORGANIZATION. Quantidade: 2.

| ID | Permissão | Ação | Descrição cadastrada |
| --- | --- | --- | --- |
| 109 | expense-installments:create | Criar | Gerar parcelas de despesas |
| 110 | expense-installments:read | Consultar | Consultar parcelas de despesas |

### Despesas

Escopo: ORGANIZATION. Quantidade: 9.

| ID | Permissão | Ação | Descrição cadastrada |
| --- | --- | --- | --- |
| 60 | expenses:approve | Aprovar | Aprovar despesas |
| 63 | expenses:cancel | Cancelar | Cancelar despesas |
| 57 | expenses:create | Criar | Criar despesas |
| 65 | expenses:download-attachment | Baixar comprovante | Baixar comprovantes de despesas |
| 62 | expenses:mark-as-paid | Marcar como pago | Marcar despesas como pagas |
| 58 | expenses:read | Consultar | Listar e consultar despesas |
| 61 | expenses:reject | Rejeitar | Rejeitar despesas |
| 59 | expenses:update | Atualizar | Atualizar despesas |
| 64 | expenses:upload-attachment | Enviar e confirmar comprovante | Criar e confirmar comprovantes de despesas |

### Exportações dos projetos

Escopo: ORGANIZATION. Quantidade: 5.

| ID | Permissão | Ação | Descrição cadastrada |
| --- | --- | --- | --- |
| 125 | export-jobs:cancel | Cancelar | Cancelar exportacoes de projects |
| 122 | export-jobs:create | Criar | Solicitar exportacoes de projects |
| 124 | export-jobs:download | Baixar | Baixar exportacoes de projects |
| 123 | export-jobs:read | Consultar | Listar e consultar exportacoes de projects |
| 126 | export-jobs:retry | Repetir processamento | Repetir exportacoes de projects |

### Inventariantes

Escopo: ORGANIZATION. Quantidade: 8.

| ID | Permissão | Ação | Descrição cadastrada |
| --- | --- | --- | --- |
| 102 | field-agents:block | Bloquear | Bloquear inventariantes da organization |
| 17 | field-agents:create | Criar | Criar inventariantes da organization |
| 20 | field-agents:deactivate | Desativar | Desativar inventariantes da organization |
| 104 | field-agents:delete | Excluir logicamente | Excluir inventariantes logicamente |
| 21 | field-agents:reactivate | Reativar | Reativar inventariantes da organization |
| 18 | field-agents:read | Consultar | Listar e consultar inventariantes da organization |
| 103 | field-agents:unblock | Desbloquear | Desbloquear inventariantes da organization |
| 19 | field-agents:update | Atualizar | Atualizar inventariantes da organization |

### Coordenação de campo

Escopo: ORGANIZATION. Quantidade: 3.

| ID | Permissão | Ação | Descrição cadastrada |
| --- | --- | --- | --- |
| 129 | field-coordination:coordinate | Coordenar | Coordenação de campo: coordinate |
| 128 | field-coordination:edit | Editar | Coordenação de campo: edit |
| 127 | field-coordination:read | Consultar | Coordenação de campo: read |

### Exportação financeira

Escopo: ORGANIZATION. Quantidade: 1.

| ID | Permissão | Ação | Descrição cadastrada |
| --- | --- | --- | --- |
| 148 | finance:export | Exportar | Financeiro: export |

### Erros de importação

Escopo: ORGANIZATION. Quantidade: 1.

| ID | Permissão | Ação | Descrição cadastrada |
| --- | --- | --- | --- |
| 74 | import-errors:read | Consultar | Consultar erros de importacao |

### Arquivos de importação

Escopo: ORGANIZATION. Quantidade: 3.

| ID | Permissão | Ação | Descrição cadastrada |
| --- | --- | --- | --- |
| 75 | import-files:create | Criar | Criar e confirmar arquivos de importacao |
| 77 | import-files:download | Baixar | Baixar arquivos de importacao |
| 76 | import-files:read | Consultar | Listar arquivos de importacao |

### Dados recebidos para importação

Escopo: ORGANIZATION. Quantidade: 3.

| ID | Permissão | Ação | Descrição cadastrada |
| --- | --- | --- | --- |
| 71 | import-payloads:create | Criar | Receber payloads de importacao |
| 72 | import-payloads:read | Consultar | Listar e consultar payloads de importacao |
| 73 | import-payloads:reprocess | Reprocessar | Reprocessar payloads com falha |

### Sessões de importação

Escopo: ORGANIZATION. Quantidade: 5.

| ID | Permissão | Ação | Descrição cadastrada |
| --- | --- | --- | --- |
| 69 | import-sessions:cancel | Cancelar | Cancelar sessoes de importacao |
| 66 | import-sessions:create | Criar | Criar sessoes de importacao |
| 68 | import-sessions:finish | Finalizar | Finalizar sessoes de importacao |
| 67 | import-sessions:read | Consultar | Listar e consultar sessoes de importacao |
| 70 | import-sessions:retry | Repetir processamento | Reprocessar sessoes com falha |

### Base contábil

Escopo: ORGANIZATION. Quantidade: 7.

| ID | Permissão | Ação | Descrição cadastrada |
| --- | --- | --- | --- |
| 36 | inventory-accounting-items:create | Criar | Criar itens da base contabil da organization |
| 39 | inventory-accounting-items:deactivate | Desativar | Desativar itens da base contabil da organization |
| 42 | inventory-accounting-items:export-errors | Consultar relatório de erros | Consultar relatorios de erro da importacao contabil |
| 41 | inventory-accounting-items:import | Importar | Importar planilhas da base contabil da organization |
| 40 | inventory-accounting-items:reactivate | Reativar | Reativar itens da base contabil da organization |
| 37 | inventory-accounting-items:read | Consultar | Listar e consultar itens da base contabil da organization |
| 38 | inventory-accounting-items:update | Atualizar | Atualizar itens da base contabil da organization |

### Imagens dos itens

Escopo: ORGANIZATION. Quantidade: 5.

| ID | Permissão | Ação | Descrição cadastrada |
| --- | --- | --- | --- |
| 31 | inventory-item-images:create | Criar | Criar URLs de upload de imagens dos itens inventariados |
| 35 | inventory-item-images:download | Baixar | Gerar URLs de download de imagens dos itens inventariados |
| 32 | inventory-item-images:read | Consultar | Listar e consultar imagens dos itens inventariados |
| 34 | inventory-item-images:remove | Remover vínculo ou registro | Remover logicamente imagens dos itens inventariados |
| 33 | inventory-item-images:update | Atualizar | Confirmar upload de imagens dos itens inventariados |

### Itens inventariados

Escopo: ORGANIZATION. Quantidade: 5.

| ID | Permissão | Ação | Descrição cadastrada |
| --- | --- | --- | --- |
| 26 | inventory-items:create | Criar | Criar itens inventariados da organization |
| 29 | inventory-items:deactivate | Desativar | Desativar itens inventariados da organization |
| 30 | inventory-items:reactivate | Reativar | Reativar itens inventariados da organization |
| 27 | inventory-items:read | Consultar | Listar e consultar itens inventariados da organization |
| 28 | inventory-items:update | Atualizar | Atualizar itens inventariados da organization |

### Observações de campo

Escopo: ORGANIZATION. Quantidade: 1.

| ID | Permissão | Ação | Descrição cadastrada |
| --- | --- | --- | --- |
| 115 | inventory-observations:create | Criar | Registrar observacoes de campo |

### Pendências patrimoniais

Escopo: ORGANIZATION. Quantidade: 7.

| ID | Permissão | Ação | Descrição cadastrada |
| --- | --- | --- | --- |
| 48 | inventory-pending-issues:cancel | Cancelar | Cancelar pendencias patrimoniais da organization |
| 43 | inventory-pending-issues:create | Criar | Criar pendencias patrimoniais da organization |
| 49 | inventory-pending-issues:generate | Gerar | Gerar pendencias patrimoniais automaticamente |
| 47 | inventory-pending-issues:ignore | Ignorar | Ignorar pendencias patrimoniais da organization |
| 44 | inventory-pending-issues:read | Consultar | Listar e consultar pendencias patrimoniais da organization |
| 46 | inventory-pending-issues:resolve | Resolver | Resolver pendencias patrimoniais da organization |
| 45 | inventory-pending-issues:update | Atualizar | Atualizar pendencias patrimoniais da organization |

### Rodadas e reinventário

Escopo: ORGANIZATION. Quantidade: 1.

| ID | Permissão | Ação | Descrição cadastrada |
| --- | --- | --- | --- |
| 114 | inventory-rounds:reinventory | Solicitar reinventário | Solicitar reinventario preservando historico |

### Sessões de inventário

Escopo: ORGANIZATION. Quantidade: 3.

| ID | Permissão | Ação | Descrição cadastrada |
| --- | --- | --- | --- |
| 111 | inventory-sessions:create | Criar | Criar sessoes de inventario |
| 112 | inventory-sessions:read | Consultar | Consultar sessoes e historico de inventario |
| 113 | inventory-sessions:update | Atualizar | Iniciar e finalizar sessoes e rodadas |

### Perfis personalizados

Escopo: ORGANIZATION. Quantidade: 2.

| ID | Permissão | Ação | Descrição cadastrada |
| --- | --- | --- | --- |
| 5 | org_roles:read | Consultar | Listar papéis customizados da organization |
| 6 | org_roles:write | Criar e atualizar | Gerenciar papéis customizados da organization |

### Pagamentos a inventariantes

Escopo: ORGANIZATION. Quantidade: 7.

| ID | Permissão | Ação | Descrição cadastrada |
| --- | --- | --- | --- |
| 53 | payments:approve | Aprovar | Aprovar pagamentos |
| 55 | payments:cancel | Cancelar | Cancelar pagamentos |
| 50 | payments:create | Criar | Criar pagamentos de inventariantes |
| 56 | payments:export | Exportar | Exportar pagamentos |
| 54 | payments:mark-as-paid | Marcar como pago | Marcar pagamentos como pagos |
| 51 | payments:read | Consultar | Listar e consultar pagamentos |
| 52 | payments:update | Atualizar | Atualizar pagamentos |

### Histórico de placas

Escopo: ORGANIZATION. Quantidade: 1.

| ID | Permissão | Ação | Descrição cadastrada |
| --- | --- | --- | --- |
| 121 | plate-history:read | Consultar | Consultar historico e fontes de placas |

### Inventariantes dos projetos

Escopo: ORGANIZATION. Quantidade: 4.

| ID | Permissão | Ação | Descrição cadastrada |
| --- | --- | --- | --- |
| 22 | project-field-agents:assign | Vincular | Vincular inventariantes a projects |
| 23 | project-field-agents:read | Consultar | Listar inventariantes de projects |
| 25 | project-field-agents:remove | Remover vínculo ou registro | Remover logicamente inventariantes de projects |
| 24 | project-field-agents:update | Atualizar | Atualizar vinculos de inventariantes em projects |

### Preparação dos projetos

Escopo: ORGANIZATION. Quantidade: 3.

| ID | Permissão | Ação | Descrição cadastrada |
| --- | --- | --- | --- |
| 98 | project-preparation:approve | Aprovar | Aprovar e reabrir preparação de projetos |
| 97 | project-preparation:edit | Editar | Gerenciar modelos e respostas de preparação |
| 96 | project-preparation:read | Consultar | Consultar preparação, modelos e comunicação |

### Unidades dos projetos

Escopo: ORGANIZATION. Quantidade: 3.

| ID | Permissão | Ação | Descrição cadastrada |
| --- | --- | --- | --- |
| 93 | project-units:assign | Vincular | Vincular unidades a projects |
| 94 | project-units:read | Consultar | Listar unidades de projects |
| 95 | project-units:remove | Remover vínculo ou registro | Remover unidades de projects |

### Projetos

Escopo: ORGANIZATION. Quantidade: 11.

| ID | Permissão | Ação | Descrição cadastrada |
| --- | --- | --- | --- |
| 99 | projects:activate | Ativar | Ativar projects da organization |
| 16 | projects:archive | Arquivar | Arquivar projects da organization |
| 15 | projects:cancel | Cancelar | Cancelar projects da organization |
| 9 | projects:create | Criar | Criar projects da organization |
| 12 | projects:deactivate | Desativar | Desativar projects da organization |
| 14 | projects:finish | Finalizar | Finalizar projects da organization |
| 100 | projects:pause | Pausar | Pausar projects da organization |
| 13 | projects:reactivate | Reativar | Reativar projects da organization |
| 10 | projects:read | Consultar | Listar e consultar projects da organization |
| 101 | projects:resume | Retomar | Retomar projects da organization |
| 11 | projects:update | Atualizar | Atualizar projects da organization |

### Contas a receber

Escopo: ORGANIZATION. Quantidade: 4.

| ID | Permissão | Ação | Descrição cadastrada |
| --- | --- | --- | --- |
| 144 | receivables:edit | Editar | Financeiro: edit |
| 143 | receivables:read | Consultar | Financeiro: read |
| 145 | receivables:receive | Registrar recebimento | Financeiro: receive |
| 146 | receivables:reverse | Estornar | Financeiro: reverse |

### Conciliação físico-contábil

Escopo: ORGANIZATION. Quantidade: 2.

| ID | Permissão | Ação | Descrição cadastrada |
| --- | --- | --- | --- |
| 116 | reconciliations:create | Criar | Executar conciliacao fisico-contabil |
| 117 | reconciliations:read | Consultar | Consultar conciliacoes |

### Laudos técnicos

Escopo: ORGANIZATION. Quantidade: 5.

| ID | Permissão | Ação | Descrição cadastrada |
| --- | --- | --- | --- |
| 158 | technical-reports:approve | Aprovar | Laudos técnicos: approve |
| 156 | technical-reports:edit | Editar | Laudos técnicos: edit |
| 159 | technical-reports:export | Exportar | Laudos técnicos: export |
| 155 | technical-reports:read | Consultar | Laudos técnicos: read |
| 157 | technical-reports:templates | Gerenciar modelos | Laudos técnicos: templates |

### Usuários

Escopo: ORGANIZATION. Quantidade: 2.

| ID | Permissão | Ação | Descrição cadastrada |
| --- | --- | --- | --- |
| 3 | users:read | Consultar | Listar e consultar usuários da organization |
| 4 | users:write | Criar e atualizar | Criar e atualizar usuários da organization |

## Rastreabilidade

- [Snapshot da consulta](./snapshot.json): organizações, perfis, catálogo, vínculos e usuários sem email, senha ou hash de senha.
- [Script de inspeção somente de leitura](./inspect-access.cjs).
- [Gerador deste relatório](./build-report.cjs).
- [Enumerações de perfis de sistema](../../gai-backend/src/modules/auth/domain/enums/user.enums.ts).
- [Regras de concessão e isolamento por organização](../../gai-backend/src/modules/users/application/services/user-scope.service.ts).
- [Cálculo de permissões efetivas](../../gai-backend/src/modules/auth/infrastructure/persistence/typeorm-permission-resolver.ts).
- [Rotas de gestão de usuários](../../gai-backend/src/modules/users/presentation/users.controller.ts).
- [Rotas de gestão de perfis](../../gai-backend/src/modules/users/presentation/org-roles.controller.ts).
- [Seed do catálogo](../../gai-backend/src/scripts/seed/permissions.seed.ts).
- [Bootstrap de perfis e usuários](../../gai-backend/src/scripts/seed/bootstrap.ts).
- [Tela de perfis](../../gai-frontend/src/features/roles/RolesPage.tsx).
- [Tela de usuários](../../gai-frontend/src/features/users/UsersPage.tsx).

Método: SELECT em transação consistente somente de leitura, confronto do catálogo com o seed carregado e inspeção estática das regras de autorização e telas. Não foram realizados logins nem testes de alteração de acessos.
