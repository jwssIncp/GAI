# Reformulação do cadastro e gerenciamento de usuários

Implementação local iniciada em **02/11/2026**, preservando a referência do [diagnóstico original](../avaliacao-cadastro-usuarios-2026-11-02/README.md). Evidências registram o horário real em UTC. Classificação: **APTO COM RESSALVAS**, para homologação local e do ambiente de destino; entrega real de e-mail ainda precisa ser homologada.

## Diagnóstico e correções

O cadastro anterior criava somente uma conta de autenticação, sem nome e sem concessão inicial de perfil. A redefinição administrativa deixava sessões válidas e a data de troca desatualizada. Também foram confirmados identificadores ambíguos, validação anterior ao trim, políticas divergentes de senha, erros com `null`, cadastro em organização inativa e bloqueio temporário que não expirava corretamente.

| Problema | Comportamento implementado |
| --- | --- |
| Sessões e tokens anteriores à troca de senha | Rotação transacional, atualização da data, incremento da versão e revogação |
| Colisão de login com e-mail | Login sem `@`, e-mail separado, normalização, UNIQUE e CHECKs no MySQL |
| Login vazio ou inválido | Validação do valor normalizado com limites e sintaxe explícitos |
| Políticas divergentes de senha | Política central de 15–128 caracteres nos fluxos de novas credenciais |
| `null` indevido causando erro interno | DTOs distinguem ausência, limpeza permitida e valor inválido |
| Organização inativa | Cadastro e concessões recusados; autenticação e ativação reavaliam elegibilidade |
| Bloqueio temporário permanente | Prazo e contador tratados sob trava; bloqueio administrativo separado |
| Cadastro sem identificação/perfil | Nome obrigatório para novos usuários, telefone/cargo opcionais e perfis iniciais na mesma transação |

## Interface e funcionalidades

O botão de cadastro abre `/app/users/new`. A edição usa `/app/users/:id/edit`, com formulário compartilhado, carregamento, mensagens de erro, preservação de entradas e confirmação ao sair sem salvar. O drawer deixou o fluxo principal.

A listagem tem busca por nome/login/e-mail, filtros de organização/perfil/status, ordenação, paginação e menu de ações. São exibidos nomes de organizações, perfis e último acesso. Detalhes, redefinição de senha, bloqueio, desbloqueio, ativação, desativação e reenvio de convite possuem ações funcionais e controle administrativo.

O cadastro permite convite seguro ou senha temporária com troca obrigatória e prazo padrão de 24 horas. No ambiente atual, com e-mail simulado, a interface utiliza a alternativa de senha temporária. O convite possui página pública, token com hash, prazo, consumo único e reenvio. Falha de envio mantém a conta pendente.

Temas, layout e componentes do GAI foram reutilizados. As telas foram exercitadas em Chromium nas larguras de desktop, tablet e celular, nos temas claro e escuro. Veja [interface e capturas](./interface.md).

## Banco e preservação

A migration aditiva `ReformUserLifecycle1794100000002` foi validada em MySQL descartável e aplicada no banco **local** pelo runner oficial, com comparação dos dados anteriores. Acrescenta identificação pessoal nullable, último login, controle de senha temporária, versão de autenticação, novos estados e propósito de token. Não cria CPF nem vincula obrigatoriamente contas a funcionários.

Foram preservados os valores anteriores das três contas, duas organizações, quatro perfis, 161 permissões e vínculos existentes. Nomes pessoais desconhecidos continuam nulos; edições de outros campos não exigem inventá-los. A organização 2 permanece sem administrador, conforme cenário local anterior.

| Conta local | Login real | Gestão de usuários | Situação preservada |
| --- | --- | --- | --- |
| `platform.admin` | HTTP 200 | HTTP 200 | Plataforma, `PLATFORM_ADMIN`, 161 permissões |
| `org.admin` | HTTP 200 | HTTP 200 | Organização 1, `ORG_ADMIN`, 159 permissões |
| `test.user` | HTTP 200 | HTTP 403 | Organização 1, Operador, 1 permissão |

As senhas anteriores foram verificadas antes das tentativas reais de autenticação e não foram substituídas. Consulta da sessão e logout também foram validados. Esses logins atualizam naturalmente último acesso, sessões e auditoria; a preservação não significa ausência dessas gravações operacionais.

Evidências: [migration local](./checks/local-migration.json), [reexecução sem mudanças](./checks/local-migration-idempotent.json), [migration descartável](./checks/migration-disposable.json) e [validação das contas](./checks/local-users.json). Não foram executados seeds, reset do banco, commit, push, deploy ou operações em produção.

## Validação e impactos

Os resultados completos, comandos e contagens estão em [testes.md](./testes.md). A validação inclui backend unitário, integração ampla SQLite, MySQL real com concorrência, frontend, navegação real, compilação e lint dos arquivos envolvidos.

Resultados finais: **442** unitários, **308** integrações/contratos SQLite, **50** MySQL, **319** frontend e **20** navegador aprovados. Quatro cenários exclusivos de MySQL foram ignorados no SQLite e executados no motor correto. Compilação e lint passaram. A execução paralela anterior do frontend teve um timeout em avaliação patrimonial; a repetição isolada passou integralmente, sem alterar o teste.

O contrato de criação agora exige nome, perfis e modo de ativação. Clientes antigos precisam ser ajustados. Senha sai do PATCH geral e passa a ação própria; novas senhas seguem a política central. Credenciais legadas continuam válidas. O DDL é aditivo e a reversão destrutiva é bloqueada; eventual reversão requer migration revisada.

## Ressalvas e próximos passos de homologação

- Validar entrega de convite/recuperação com remetente, credenciais SES e URL do frontend do ambiente autorizado. O fluxo foi testado com caixa simulada; a entrega externa não foi exercitada.
- Validar o ambiente de destino e seus dados legados antes de aplicar a migration; a preflight interrompe identificadores incompatíveis sem renomeá-los.
- Firefox, Safari e leitores de tela não foram certificados nesta execução.
- Bloqueio por base de senhas comprometidas e MFA não foram adicionados como infraestrutura nova. A política de comprimento não representa conformidade integral com o NIST.

Não há falha crítica conhecida nos cenários validados. A classificação com ressalvas corresponde aos limites acima e não autoriza publicação em produção.

## Documentação técnica

- [Arquitetura, endpoints, campos e decisões](./arquitetura.md)
- [Autenticação, sessões, RBAC e riscos residuais](./seguranca.md)
- [Testes, quantidades e limitações](./testes.md)
- [Interface e evidências visuais](./interface.md)
- [Arquivos TypeScript envolvidos](./files.json)
