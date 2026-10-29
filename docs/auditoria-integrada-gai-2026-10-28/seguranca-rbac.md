# Segurança e autorização

O catálogo atual contém 161 permissões; os 312 endpoints foram inspecionados por metadados Nest. Não foi encontrada chave exigida em decorator que esteja ausente no seed. Isso não certifica sincronização do catálogo de produção; o seed e o banco do ambiente precisam coincidir. O catálogo e cada método/rota estão em rotas-permissoes.md e evidencias/rbac-runtime.json.

## Política efetiva

| Perfil | Comportamento verificado no código |
| --- | --- |
| PLATFORM_ADMIN | Pode atravessar organizações nos serviços de escopo; bypass de permissão ocorre somente após validar existência e escopo de todas as chaves. Continua sujeito a IDs pai/filho, lifecycle e conteúdo. OrganizationOverview exige especificamente ORG_ADMIN com organizationId e não é dashboard de plataforma. |
| ORG_ADMIN | Bypass somente de chaves cadastradas com escopo ORGANIZATION; limitado à organização do usuário. Não ganha permissão de plataforma e não autoriza chave inexistente. |
| ORG_USER / perfis personalizados | Exige cada permissão efetiva com escopo correto. Ter projects:read não concede finanças, documentos, aprovação ou exportação. Permissões de fontes são adicionais quando necessário. |
| Sem sessão / sessão revogada | Rotas protegidas usam SessionAuthGuard. Login e reset são públicos por contrato; logout/me requerem sessão. Desativação e revogação invalidam autorização efetiva. |

Evidências centrais: `gai-backend/src/modules/auth/application/services/permission-access.ts:12`; `gai-backend/src/modules/auth/presentation/guards/permissions.guard.ts:1`; `gai-backend/src/modules/projects/application/services/project-scope.service.ts:1`; `gai-backend/src/modules/organizations/presentation/organizations.controller.ts:56`. Testes: `gai-backend/test/integration/auth/brute-force-protection.e2e-spec.ts`; `gai-backend/test/integration/auth/login.e2e-spec.ts`; `gai-backend/test/integration/auth/organization-gate.e2e-spec.ts`; `gai-backend/test/integration/auth/password-reset.e2e-spec.ts`; `gai-backend/test/integration/auth/rbac-multi-tenancy.e2e-spec.ts`; `gai-backend/test/integration/auth/session-invalidation.e2e-spec.ts`; `gai-backend/test/unit/modules/auth/login.use-case.spec.ts`; `gai-backend/test/unit/modules/auth/password.spec.ts`; `gai-backend/test/unit/modules/auth/permission-resolver.spec.ts`; `gai-backend/test/unit/modules/auth/permissions-negative.spec.ts`; `gai-backend/test/unit/modules/auth/session-auth.guard.spec.ts`; `gai-backend/test/unit/modules/auth/permissions-negative.spec.ts`. Nenhum vazamento crítico foi confirmado nas verificações executadas; isso não substitui pentest.

## Operações e fontes

Leitura/criação/edição/aprovação/conclusão/export/download possuem chaves separadas nos novos módulos. ORG_ADMIN é administrador da própria organização, portanto não implementa segregação entre aprovador e criador. Pagamento pode ser baixado de pending ou approved por regra explícita de domínio; exigir aprovação prévia ou outro ator é decisão de negócio, não correção implícita nesta auditoria.

Resumo financeiro exige payments:read e expenses:read; overview comercial verifica contracts:read e permissões de fontes operacionais; caixa exige as fontes conforme direção; DRE protege leitura de fontes e exportação; laudos exigem permissões de cada família capturada. `gai-backend/src/modules/technical-reports/report.sources.ts:40`; `gai-backend/src/modules/receivables/cash-flow.service.ts:114`; `gai-backend/src/modules/export-jobs/domain/export-content-permissions.ts:1`.

Downloads de export jobs repetem permissões de conteúdo e expiração. Documentos repetem autorização de versão/fonte, organização e pai, inclusive memória de cálculo interna; aplicam private,no-store e nosniff. URLs S3 são capacidades temporárias: revogar a permissão impede emitir nova URL, mas uma URL já assinada continua válida até seu TTL; o objeto é vinculado à versão verificada. Não foi prometida revogação retroativa de URL S3 emitida.

## Negativas HTTP e limites

As suítes reais cobrem sessão ausente, usuário sem grants, catálogo removido, organização estrangeira, IDs pai/filho substituídos, fontes revogadas, exportações e documentos privados. Consultar testes.md para resultados por motor. Os dois testes de exportação que continuam falhando esperam 403 no endpoint genérico, mas recebem 409 porque finance_xlsx/dre_xlsx exigem endpoint especializado com filtros; não houve retorno de dados financeiros nessas respostas.

Storage real local: PUT/HEAD/GET, checksum, MIME, substituição/versionamento e expiração foram exercitados no MinIO exclusivo. Isso não comprova IAM/CORS/criptografia/AWS efetivos. Testes de storage de várias suítes HTTP usam FakeStorage, explicitamente separado da integração S3 real.

Não houve inspeção de sessões/dados reais, varredura ofensiva externa, auditoria de secrets em contas, teste de carga, nem prova de todos os estados de concorrência. Configurações .env não foram copiadas para os relatórios. Nenhum e-mail/mensagem externa foi enviado.

## Dependências

A consulta atual encontrou alertas de dependências, com alcance ainda em triagem (GAI-012). Ver [dependencias-seguranca.md](dependencias-seguranca.md). Ausência de vazamento nos testes RBAC não elimina risco dos componentes de parsing/HTTP.
