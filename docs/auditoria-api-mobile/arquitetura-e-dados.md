# Arquitetura, ambiente e dados

Auditoria de 09/11/2026, exclusivamente por leitura e verificações em memória. O [catálogo](catalogo-rotas.md) contém **333 operações em 39 controllers**, incluindo módulos adjacentes; o [mapa de entidades](mapa-entidades.md) cobre **101 entities**. A revisão funcional manual acompanha as 20 operações do Investor. Não foi executado bootstrap Nest, pois carregaria serviços e poderia produzir escrita.

## Backend e arquitetura real

NestJS 11 sobre Express, TypeScript, TypeORM 0.3 e mysql2; class-validator/class-transformer, Swagger, Pino, argon2 e AWS SDK S3/SES constam em `gai-backend/package.json`. Organização modular com camadas application/domain/infrastructure/presentation nos módulos originais; módulos recentes também usam controller/service/dto/entity no mesmo diretório. Existem use cases e ports de repository, além de serviços que usam Repository/DataSource diretamente. Não é uma API Laravel nem uma API JWT implementada com Passport. [E01](referencias-codigo.md#e01), [E02](referencias-codigo.md#e02), [E04](referencias-codigo.md#e04).

Prefixo `/api/v1`; Swagger em `/api/docs`. Não há negociação de versão via header identificada. CORS configurável por `CORS_ORIGINS` com credenciais; padrão local localhost:5173. ValidationPipe global: whitelist, transform e forbidNonWhitelisted. Isso rejeita nomes legados desconhecidos, mas não limita os valores arbitrários de campos `metadata` autorizados pelo DTO. [E01](referencias-codigo.md#e01).

Auth não é guard global: cada controller privado declara SessionAuthGuard e normalmente PermissionsGuard. O único guard global é throttling (100 requisições/60s); auth tem limites menores. Públicos encontrados: GET health; POST auth/login, activation/confirm, password-reset/request e password-reset/confirm. Swagger também é registrado publicamente no bootstrap; checar exposição implantada. As demais rotas estão identificadas individualmente no catálogo. Pino redige campos sensíveis, há correlation ID e filtro global de erros. Não foi testado o comportamento de proxy/IP/rate limit em múltiplas réplicas. [E02](referencias-codigo.md#e02), [E06](referencias-codigo.md#e06), [E32](referencias-codigo.md#e32).

## Autenticação, autorização e inventariantes

Login usa argon2 e cria UUID aleatório como ID/token de sessão persistida. A resposta chama esse valor de `access_token`, mas ele **não é JWT** e não possui `exp` decodificável. Cada request consulta sessão ativa, expiração, revogação, versão de credenciais, usuário e organização; depois executa touch que prorroga a sessão ativa (TTL padrão 8h). Não há refresh token, rota refresh ou recuperação de uma sessão já expirada. Sessões revogadas/expiradas não são aceitas. [E03](referencias-codigo.md#e03), [E04](referencias-codigo.md#e04), [E05](referencias-codigo.md#e05), [E41](referencias-codigo.md#e41).

O touch é escrita: por isso nenhum GET privado foi executado nesta auditoria. A expiração devolvida no login é a daquele instante; o cliente não recebe uma nova `expires_at` em cada touch. Armazenamento seguro da sessão no Android não pode ser validado pelo HTML nem pelo React.

RBAC: users → user_role_assignments → roles → role_permissions → permissions, com permissões efetivas e escopo. PLATFORM_ADMIN tem bypass só para permissões existentes no catálogo e é explicitamente impedido de gerir field-agents/project-field-agents. ORG_ADMIN tem bypass para permissões de escopo ORGANIZATION; serviços ainda precisam validar tenant e propriedade. Nome do perfil sozinho não é garantia de autorização. [E07](referencias-codigo.md#e07).

field_agents é cadastro operacional com `user_id` opcional. É possível preservar inventariante sem login; convite cria identidade e perfil de campo. Existe associação única para usuário em cadastro não excluído, verificação de organização e impedimento de vínculo com conta PLATFORM_ADMIN. A migration mais recente adiciona unicidade condicional e FKs compostas; sua aplicação no banco não foi confirmada. project_field_agents representa vínculo, status e período de atuação. [E09](referencias-codigo.md#e09), [E30](referencias-codigo.md#e30), [E43](referencias-codigo.md#e43).

O perfil convidado recebe somente `projects:read`, `inventory-items:read`, `inventory-sessions:read` e `inventory-observations:create`. Não recebe criação/edição de cadastro mestre, importações, despesas, imagens de cadastro ou leitura de pendências. Upload de evidência de observação usa inventory-observations:create e pode ser acessível, mas é diferente de foto do cadastro mestre. [E09](referencias-codigo.md#e09), [E31](referencias-codigo.md#e31).

O guard limita projetos apenas quando reconhece roleKey prefixado `FIELD_AGENT_ORG_` e não há papel administrativo. Nesse caso consulta agente ativo, vínculo ativo/vigente e projetos não excluídos, e limita URLs /projects/:id. ListProjects repassa allowedProjectIds ao repositório. Perfis personalizados vinculados a agente podem escapar dessa seleção: ver SEC-01. A validação forte de operações nativas de observação usa requireOperationalAssignment com bloqueios transacionais, status do agente, período e autoria; importações físicas e despesas não reutilizam integralmente essa regra. [E03](referencias-codigo.md#e03), [E08](referencias-codigo.md#e08), [E10](referencias-codigo.md#e10), [E39](referencias-codigo.md#e39).

## Persistência e relações

| Fluxo | Tabelas principais | Relação e restrições comprovadas pelo código |
|---|---|---|
| Identidade/sessão | users, sessions, password_reset_tokens, auth_audit_logs | Sessões revogáveis e authVersion; organização da conta validada no servidor |
| RBAC | roles, permissions, role_permissions, user_role_assignments; logs de usuários/roles | Catálogo e grants ativos; bypass condicionado ao escopo |
| Organizações/projetos | organizations, projects, project_audit_logs | Projeto carrega organization_id; serviços comparam com contexto do ator |
| Inventariantes | field_agents, project_field_agents, field_agent_audit_logs | user_id opcional; soft delete; identidade/organização e períodos |
| Unidades | companies, company_units, project_units e audit logs | Unidade corporativa vinculada ao projeto; texto unit_text dos itens é independente |
| Cadastro patrimonial | inventory_items, inventory_item_audit_logs | BIGINT interno; external_item_id varchar(100); FK simples para projeto/organização; sem UNIQUE(project_id,external_item_id) identificado |
| Imagens | inventory_item_images, inventory_item_image_audit_logs | Registro por item com pending_upload/uploaded; bucket/path/checksum/size |
| Evidência física | inventory_sessions, inventory_rounds, inventory_observations, inventory_plate_history, inventory_observation_evidences, inventory_operation_audit_logs | Histórico de observações/placas separado do cadastro mestre; nomes exatos e colunas no mapa de entidades |
| Base contábil | inventory_accounting_items, accounting_import_batches e audit logs | Base contábil e conciliação distintas do cadastro físico |
| Pendências | inventory_pending_issues, inventory_pending_issue_audit_logs | GET lista; geração cria registros e auditoria |
| Financeiro mobile | expenses, expense_attachments, payment_expense_audit_logs | created_by_id da sessão; valor decimal string; anexos separados |
| Pagamentos | field_agent_payments e logs | Pagamentos a agente, diferentes de nota fiscal da despesa |
| Importações | import_sessions, import_payloads, import_payload_errors, import_files, import_session_audit_logs | UUID único da sessão; unique(session,payload_number) e unique(session,idempotency_key) |
| Exportações/documentos | export_jobs, export_job_audit_logs; entities de documentos e relatórios | Fluxos de geração/exportação, não substituem delta mobile nem restauração de ZIP |

Os nomes desta síntese devem ser conferidos no [mapa integral](mapa-entidades.md) e no JSON de schema: este último é a fonte literal para classes e tabelas. Não foram selecionados registros pessoais. As migrations só foram lidas. [E16](referencias-codigo.md#e16), [E46](referencias-codigo.md#e46), [E47](referencias-codigo.md#e47).

IDs internos usam BIGINT UNSIGNED no MySQL, mas number em TS/DTOs e conversões Number em serializers; configuração mysql2 inclui bigNumberStrings:false. O exemplo legado `1730736000123456` é seguro como Number; **nem todo ID de 16 dígitos é seguro**. O limite é 9007199254740991. Preservar ID mobile em external_item_id como string e testar fronteiras; BIGINT na coluna, sozinho, não evita arredondamento no JSON/JS. [E02](referencias-codigo.md#e02), [E33](referencias-codigo.md#e33), [E34](referencias-codigo.md#e34).

Itens têm old_plate/new_plate (texto, normalização alfanumérica), mas nenhuma coluna ou DTO específico para placa_antiga_2. Metadata é armazenamento genérico possível, não contrato funcional comprovado para esse campo. Campos extras de projeto/itens precisam de convenção e validação; não se pode assumir que extra_fields do HTML já é suportado. As exclusões mantêm linha, status e deleted_at; repositório de itens usa withDeleted em leitura. Import upsert não limpa deletedAt ao alterar status, permitindo estado inconsistente; mobile precisa interpretar exclusão explicitamente. [E14](referencias-codigo.md#e14), [E15](referencias-codigo.md#e15), [E36](referencias-codigo.md#e36).

## Armazenamento e processamento

Adapter S3 real assina PUT/GET; exige configuração explícita, allowlist de bucket/MIME/tamanho/TTL e chaves organizations/{id}. Confirmação faz HEAD e GET, compara tamanho/MIME/hash, verifica assinatura básica do conteúdo e exige versionamento; download fixa a versão inspecionada e usa attachment. Isso é controle implementado, não confirmação de objetos enviados nesta auditoria. Não há demonstração de antivírus ou inspeção completa de ZIP/JSON/XLSX; octet-stream é aceito quando configurado. [E27](referencias-codigo.md#e27), [E28](referencias-codigo.md#e28), [E29](referencias-codigo.md#e29).

Imagens de cadastro: padrão de 3 imagens por item e 10 MiB por imagem, dependentes do ambiente e do limite geral S3. O HTML permite image_1…image_n; portanto a quantidade é incompatibilidade a negociar, além do multipart. Imagens anexadas ao payload de importação são apenas copiadas para metadata.import_images; não há materialização em inventory_item_images ou verificação da propriedade do caminho nesse trajeto. [E27](referencias-codigo.md#e27), [E36](referencias-codigo.md#e36).

Importações processam sincronamente dentro da chamada de receivePayload e de transação de processPayload, com captura de erro por linha, sem savepoint por linha observado. Não foi encontrada fila durável/worker para esse caminho. Chaves de idempotência existem, mas checksum é declarado pelo cliente e não compara conteúdo canônico; lookup de external_item_id não tem unicidade correspondente. Contadores são atualizados sem bloqueio explícito da sessão; finish não espera comprovadamente todos os payloads em voo; retrySession examina só a primeira página de 100 e seleciona FAILED, enquanto erros por linha terminam PROCESSED. Não se deve prometer retomada completa. [E19](referencias-codigo.md#e19), [E35](referencias-codigo.md#e35), [E37](referencias-codigo.md#e37), [E38](referencias-codigo.md#e38).

Backup raw_backup é upload arquivado com rawBackupPath; não foi encontrado parser/restaurador do backup Android. Importações tabulares, conciliação assistida, exportações e documentos já existem, com rotas no catálogo; não comprovam restauração móvel.

## AWS e URL base

Pelo Terraform, CloudFront encaminha `/api/*` ao ALB com cache desabilitado; backend é ECS, dados RDS e objetos S3. O output `app_url` é https://{domain_name} ou https://{cloudfront_domain_name}; a base prevista é esse origin seguido de `/api/v1`. Arquivos de homolog/produção versionados têm domain_name vazio. Não foi localizado hostname público concreto verificável nesses arquivos. **URL AWS implantada: NÃO VERIFICADA**. Não tratar localhost ou a URL do legado como produção do GAI. [E48](referencias-codigo.md#e48), [E49](referencias-codigo.md#e49).

Terraform declara buckets privados, AES256, versionamento; CORS de assets usa "*" se não houver domínio customizado. A posse da URL assinada continua necessária; CORS não é autorização. IAM, estado Terraform, DNS, certificado, versão implantada, migrations, TTLs e limites reais não foram consultados na AWS. [E50](referencias-codigo.md#e50).

## MySQL e limites da verificação

A conexão configurada em gai-backend/.env apontava para loopback; tentativa via mysql2 retornou ECONNREFUSED. Não foi iniciado servidor/container nem alterada configuração. Nenhuma consulta de schema chegou a executar; [mysql-leitura.json](mysql-leitura.json) registra a limitação sem credenciais.

Em uma verificação futura somente de leitura, usar sessão/transação READ ONLY e SELECT em information_schema.TABLES, COLUMNS, KEY_COLUMN_USAGE e STATISTICS para validar o mapa declarado, migration aplicada e índices. Contagens de inconsistência devem ser agregadas e sem dados pessoais. Não executar migration:show por bootstrap que carregue hooks desconhecidos, testes de integração que criem schema ou login/GET privado neste ambiente sem autorização de escrita.

Os seis testes registrados em [verificacoes-memoria.json](verificacoes-memoria.json) usam DTOs, guard e serviço reais com dependências de persistência substituídas por objetos em memória. Não são testes HTTP, MySQL, AWS, concorrência ou do app.

