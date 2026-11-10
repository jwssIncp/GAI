# Referências verificáveis de código

Índice usado nos seis documentos principais. Linhas do checkout auditado; não representam execução. Cada bloco mostra a linha inicial e contexto suficiente para localizar a regra; os arquivos completos estão nos links.

## E01

Prefixo, CORS e ValidationPipe: [gai-backend/src/main.ts:13](../../gai-backend/src/main.ts#L13).

```text
13:   app.setGlobalPrefix('api/v1');
14: 
15:   const corsOrigins = (process.env.CORS_ORIGINS ?? 'http://localhost:5173')
16:     .split(',')
17:     .map((origin) => origin.trim())
18:     .filter(Boolean);
19:   app.enableCors({ origin: corsOrigins, credentials: true });
20: 
21:   app.useGlobalPipes(
22:     new ValidationPipe({
23:       whitelist: true,
24:       transform: true,
25:       forbidNonWhitelisted: true,
26:     }),
```

## E02

Módulos, banco, throttler e logs: [gai-backend/src/app.module.ts:124](../../gai-backend/src/app.module.ts#L124).

```text
124:     TypeOrmModule.forRootAsync({
125:       imports: [ConfigModule],
126:       useFactory: () => ({
127:         type: 'mysql' as const,
128:         ...MYSQL_UTC_OPTIONS,
129:         host: process.env.DB_HOST ?? 'localhost',
130:         port: parseInt(process.env.DB_PORT ?? '3306', 10),
131:         username: process.env.DB_USERNAME ?? 'gai',
132:         password: process.env.DB_PASSWORD ?? 'gai',
133:         database: process.env.DB_DATABASE ?? 'gai',
134:         charset: 'utf8mb4',
135:         extra: {
136:           bigNumberStrings: false,
137:         },
```

## E03

Token opaco, touch e restrição de projeto por perfil: [gai-backend/src/modules/auth/presentation/guards/session-auth.guard.ts:73](../../gai-backend/src/modules/auth/presentation/guards/session-auth.guard.ts#L73).

```text
73:   async canActivate(context: ExecutionContext): Promise<boolean> {
74:     const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
75:     const token = this.extractToken(request);
76: 
77:     if (!token) {
78:       throw new UnauthorizedException({
79:         code: 'UNAUTHORIZED',
80:         message: 'Authentication required',
81:       });
82:     }
83: 
84:     const now = new Date();
85:     const session = await this.sessions.findActiveById(token, now);
86:     if (!session) {
```

## E04

Resposta real de login: [gai-backend/src/modules/auth/application/use-cases/login.use-case.ts:23](../../gai-backend/src/modules/auth/application/use-cases/login.use-case.ts#L23).

```text
23:   async execute(dto: LoginDto, ip: string | null): Promise<LoginResponseDto> {
24:     const { user, session } = await this.credentials.authenticate(
25:       dto.identifier,
26:       dto.password,
27:       ip,
28:     );
29:     const roles = await this.assignments.findActiveByUserId(user.id);
30:     return {
31:       access_token: session.id,
32:       expires_at: session.expiresAt.toISOString(),
33:       user: CurrentUserDto.fromUser({
34:         ...user,
35:         roleAssignments: roles.map((role) =>
36:           RoleAssignmentResponseDto.fromAssignedRole(role),
```

## E05

Credenciais, criação de sessão e expiração: [gai-backend/src/modules/auth/application/services/credential-transactions.service.ts:89](../../gai-backend/src/modules/auth/application/services/credential-transactions.service.ts#L89).

```text
89:   async authenticate(
90:     identifier: string,
91:     password: string,
92:     ipAddress: string | null,
93:   ) {
94:     const normalized = identifier.trim().toLowerCase();
95:     const outcome = await identityTransaction(this.db, async (manager) => {
96:       const users = manager.getRepository(UserEntity);
97:       const found = await users.findOneBy(
98:         normalized.includes('@')
99:           ? { email: normalized }
100:           : { login: normalized },
101:       );
102:       const user = found ? await lockUser(manager, found.id) : null;
```

## E06

Rotas de autenticação, sem refresh: [gai-backend/src/modules/auth/presentation/auth.controller.ts:52](../../gai-backend/src/modules/auth/presentation/auth.controller.ts#L52).

```text
52: export class AuthController {
53:   constructor(
54:     private readonly credentials: CredentialTransactionsService,
55:     private readonly loginUseCase: LoginUseCase,
56:     private readonly logoutUseCase: LogoutUseCase,
57:     private readonly getCurrentUserUseCase: GetCurrentUserUseCase,
58:     private readonly requestPasswordResetUseCase: RequestPasswordResetUseCase,
59:     private readonly confirmPasswordResetUseCase: ConfirmPasswordResetUseCase,
60:   ) {}
61: 
62:   @Post('activation/confirm')
63:   @HttpCode(200)
64:   @Throttle({ default: { limit: 5, ttl: 60000 } })
65:   activate(@Body() dto: PasswordResetConfirmDto, @Req() req: Request) {
```

## E07

Permissões efetivas e bypass administrativo: [gai-backend/src/modules/auth/application/services/permission-access.ts:12](../../gai-backend/src/modules/auth/application/services/permission-access.ts#L12).

```text
12: export async function hasAllPermissions(
13:   actor: PermissionActor,
14:   keys: string[],
15:   resolver: PermissionResolver,
16: ): Promise<boolean> {
17:   if (
18:     actor.systemRoles.includes(UserRole.PLATFORM_ADMIN) &&
19:     keys.some(
20:       (key) =>
21:         key.startsWith('field-agents:') ||
22:         key.startsWith('project-field-agents:'),
23:     )
24:   )
25:     return false;
```

## E08

Projetos autorizados e paginação: [gai-backend/src/modules/projects/application/use-cases/list-projects.use-case.ts:24](../../gai-backend/src/modules/projects/application/use-cases/list-projects.use-case.ts#L24).

```text
24:   async execute(
25:     query: ListProjectsQueryDto,
26:     actor: ProjectActorContext,
27:   ): Promise<ProjectListResponseDto> {
28:     const page = query.page ?? 1;
29:     const pageSize = query.page_size ?? 20;
30:     const organizationId = this.scope.resolveOrganizationFilter(
31:       actor,
32:       query.organization_id,
33:     );
34: 
35:     const { items, total, counts } = await this.repository.list({
36:       page,
37:       pageSize,
```

## E09

Permissões do perfil de campo e convite: [gai-backend/src/modules/field-agents/application/services/field-agent-management.service.ts:40](../../gai-backend/src/modules/field-agents/application/services/field-agent-management.service.ts#L40).

```text
40: const FIELD_ACCESS_PERMISSIONS = [
41:   'projects:read',
42:   'inventory-items:read',
43:   'inventory-sessions:read',
44:   'inventory-observations:create',
45: ];
46: 
47: @Injectable()
48: export class FieldAgentManagementService {
49:   constructor(
50:     private readonly db: DataSource,
51:     private readonly scope: FieldAgentScopeService,
52:     private readonly users: UserLifecycleService,
53:     @Inject(FIELD_AGENT_REPOSITORY)
```

## E10

Inventariante ativo, período e autoria operacional: [gai-backend/src/modules/field-agents/application/services/operational-eligibility.ts:78](../../gai-backend/src/modules/field-agents/application/services/operational-eligibility.ts#L78).

```text
78: export async function requireOperationalAssignment(
79:   manager: EntityManager,
80:   organizationId: number,
81:   projectId: number,
82:   agentId: number,
83:   actor?: { id: number; systemRoles: UserRole[] },
84: ): Promise<ProjectFieldAgentEntity> {
85:   const project = await manager.getRepository(ProjectEntity).findOne({
86:     where: { id: projectId, organizationId },
87:     ...(manager.connection.options.type === 'mysql'
88:       ? { lock: { mode: 'pessimistic_write' as const } }
89:       : {}),
90:   });
91:   if (
```

## E11

Rotas de itens: [gai-backend/src/modules/inventory-items/presentation/inventory-items.controller.ts:60](../../gai-backend/src/modules/inventory-items/presentation/inventory-items.controller.ts#L60).

```text
60: export class InventoryItemsController {
61:   constructor(
62:     private readonly createInventoryItem: CreateInventoryItemUseCase,
63:     private readonly listInventoryItems: ListInventoryItemsUseCase,
64:     private readonly getInventoryItem: GetInventoryItemUseCase,
65:     private readonly updateInventoryItem: UpdateInventoryItemUseCase,
66:     private readonly updateInventoryItemStatus: UpdateInventoryItemStatusUseCase,
67:   ) {}
68: 
69:   @Post('projects/:projectId/inventory-items')
70:   @HttpCode(201)
71:   @RequirePermissions('inventory-items:create')
72:   @ApiOperation({ summary: 'Criar inventory item' })
73:   @ApiParam({ name: 'projectId', type: 'integer', format: 'int64' })
```

## E12

Criação persistente de item e auditoria: [gai-backend/src/modules/inventory-items/application/use-cases/create-inventory-item.use-case.ts:39](../../gai-backend/src/modules/inventory-items/application/use-cases/create-inventory-item.use-case.ts#L39).

```text
39:   async execute(
40:     projectId: number,
41:     dto: CreateInventoryItemDto,
42:     actor: InventoryItemActorContext,
43:   ): Promise<InventoryItemResponseDto> {
44:     const project = await this.projects.findById(projectId);
45:     if (!project) {
46:       throw new NotFoundException({
47:         code: 'NOT_FOUND',
48:         message: 'Project not found',
49:       });
50:     }
51:     this.scope.assertCanAccessOrganization(actor, project.organizationId);
52:     this.scope.assertProjectAllowsMutation(project);
```

## E13

Atualização de item e status no DTO genérico: [gai-backend/src/modules/inventory-items/application/use-cases/update-inventory-item.use-case.ts:37](../../gai-backend/src/modules/inventory-items/application/use-cases/update-inventory-item.use-case.ts#L37).

```text
37:   async execute(
38:     projectId: number,
39:     id: number,
40:     dto: UpdateInventoryItemDto,
41:     actor: InventoryItemActorContext,
42:   ): Promise<InventoryItemResponseDto> {
43:     const item = await this.repository.findById(id);
44:     if (!item || item.projectId !== projectId) {
45:       throw new NotFoundException({
46:         code: 'NOT_FOUND',
47:         message: 'Inventory item not found',
48:       });
49:     }
50:     this.scope.assertCanAccessOrganization(actor, item.organizationId);
```

## E14

Domínio, desativação e campos atualizáveis: [gai-backend/src/modules/inventory-items/domain/entities/inventory-item.ts:62](../../gai-backend/src/modules/inventory-items/domain/entities/inventory-item.ts#L62).

```text
62:   updateFields(
63:     fields: Partial<
64:       Pick<
65:         InventoryItemProps,
66:         | 'externalItemId'
67:         | 'sequence'
68:         | 'oldPlate'
69:         | 'newPlate'
70:         | 'unitText'
71:         | 'addressText'
72:         | 'locationText'
73:         | 'description'
74:         | 'brand'
75:         | 'model'
```

## E15

Consultas com excluídos e save com auditoria: [gai-backend/src/modules/inventory-items/infrastructure/persistence/typeorm-inventory-item.repository.ts:29](../../gai-backend/src/modules/inventory-items/infrastructure/persistence/typeorm-inventory-item.repository.ts#L29).

```text
29:   async list(
30:     params: ListInventoryItemsParams,
31:   ): Promise<{ items: InventoryItem[]; total: number }> {
32:     const qb = this.itemRepo.createQueryBuilder('item').withDeleted();
33: 
34:     if (params.organizationId) {
35:       qb.andWhere('item.organizationId = :organizationId', {
36:         organizationId: params.organizationId,
37:       });
38:     }
39:     if (params.projectId) {
40:       qb.andWhere('item.projectId = :projectId', {
41:         projectId: params.projectId,
42:       });
```

## E16

Entidade de itens, campos e índices: [gai-backend/src/modules/inventory-items/infrastructure/persistence/inventory-item.entity.ts:17](../../gai-backend/src/modules/inventory-items/infrastructure/persistence/inventory-item.entity.ts#L17).

```text
17: @Entity('inventory_items')
18: @Index('idx_inventory_items_project_status', ['projectId', 'status'])
19: @Index('idx_inventory_items_organization_project', [
20:   'organizationId',
21:   'projectId',
22: ])
23: @Index('idx_inventory_items_old_plate', ['oldPlate'])
24: @Index('idx_inventory_items_new_plate', ['newPlate'])
25: @Index('idx_inventory_items_external_item_id', ['externalItemId'])
26: export class InventoryItemEntity {
27:   @PrimaryGeneratedColumn(PRIMARY_KEY_COLUMN)
28:   id!: number;
29: 
30:   @Column({ name: 'organization_id', ...FOREIGN_KEY_COLUMN })
```

## E17

DTO de itens: [gai-backend/src/modules/inventory-items/application/dto/inventory-item-inputs.ts:19](../../gai-backend/src/modules/inventory-items/application/dto/inventory-item-inputs.ts#L19).

```text
19: export class InventoryItemFieldsDto {
20:   @ApiPropertyOptional({ maxLength: 100, nullable: true })
21:   @IsOptional()
22:   @IsString()
23:   @MaxLength(100)
24:   external_item_id?: string | null;
25: 
26:   @ApiPropertyOptional({ maxLength: 50, nullable: true })
27:   @IsOptional()
28:   @IsString()
29:   @MaxLength(50)
30:   sequence?: string | null;
31: 
32:   @ApiPropertyOptional({ maxLength: 100, nullable: true })
```

## E18

Rotas de importação: [gai-backend/src/modules/import-sessions/presentation/import-sessions.controller.ts:64](../../gai-backend/src/modules/import-sessions/presentation/import-sessions.controller.ts#L64).

```text
64: export class ImportSessionsController {
65:   constructor(private readonly service: ImportSessionsService) {}
66: 
67:   @Post()
68:   @HttpCode(201)
69:   @RequirePermissions('import-sessions:create')
70:   @ApiOperation({ summary: 'Criar sessao de importacao' })
71:   @ApiCreatedResponse({ type: ImportSessionResponseDto })
72:   createSession(
73:     @Param('projectId', ParseIntPipe) projectId: number,
74:     @Body() dto: CreateImportSessionDto,
75:     @Req() req: AuthenticatedRequest,
76:   ) {
77:     return this.service.createSession(projectId, dto, this.toActor(req));
```

## E19

Serviço de importação: criação/recepção: [gai-backend/src/modules/import-sessions/application/services/import-sessions.service.ts:206](../../gai-backend/src/modules/import-sessions/application/services/import-sessions.service.ts#L206).

```text
206:   async receivePayload(
207:     projectId: number,
208:     sessionId: number,
209:     dto: CreateImportPayloadDto,
210:     actor: ImportSessionActorContext,
211:   ): Promise<ImportPayloadResponseDto> {
212:     const session = await this.findSession(projectId, sessionId, actor, true);
213:     this.assertSessionAcceptsPayload(session);
214:     this.assertPayloadLimits(dto);
215:     const duplicate = await this.findDuplicate(session, dto);
216:     if (duplicate) return ImportPayloadResponseDto.fromEntity(duplicate);
217: 
218:     const payload = new ImportPayloadEntity();
219:     payload.organizationId = session.organizationId;
```

## E20

DTOs de importação: [gai-backend/src/modules/import-sessions/application/dto/import-sessions-inputs.ts:263](../../gai-backend/src/modules/import-sessions/application/dto/import-sessions-inputs.ts#L263).

```text
263: export class CreateImportPayloadDto {
264:   @ApiProperty({ minimum: 1 })
265:   @Type(() => Number)
266:   @IsInt()
267:   @Min(1)
268:   payload_number!: number;
269: 
270:   @ApiProperty({ maxLength: 128 })
271:   @IsString()
272:   @MaxLength(128)
273:   idempotency_key!: string;
274: 
275:   @ApiPropertyOptional({ maxLength: 128 })
276:   @IsOptional()
```

## E21

Limites, normalização e autorização por organização: [gai-backend/src/modules/import-sessions/application/services/import-session-scope.service.ts:17](../../gai-backend/src/modules/import-sessions/application/services/import-session-scope.service.ts#L17).

```text
17:   assertCanAccessOrganization(
18:     actor: ImportSessionActorContext,
19:     organizationId: number,
20:   ): void {
21:     if (
22:       actor.systemRoles.includes(UserRole.PLATFORM_ADMIN) ||
23:       actor.organizationId === organizationId
24:     ) {
25:       return;
26:     }
27:     throw new ForbiddenException({
28:       code: 'FORBIDDEN',
29:       message: 'Insufficient permissions',
30:     });
```

## E22

Geração de pendências com escrita: [gai-backend/src/modules/inventory-pending-issues/application/services/inventory-pending-issues.service.ts:222](../../gai-backend/src/modules/inventory-pending-issues/application/services/inventory-pending-issues.service.ts#L222).

```text
222:   async generate(
223:     projectId: number,
224:     actor: InventoryPendingIssueActorContext,
225:   ): Promise<GenerateInventoryPendingIssuesResponseDto> {
226:     const project = await this.getProject(projectId, actor, true);
227:     const physical = await this.listAllInventoryItems(
228:       project.organizationId,
229:       projectId,
230:     );
231:     const accounting = await this.listAllAccountingItems(
232:       project.organizationId,
233:       projectId,
234:     );
235:     let created = 0;
```

## E23

Rotas de pendências: [gai-backend/src/modules/inventory-pending-issues/presentation/inventory-pending-issues.controller.ts:51](../../gai-backend/src/modules/inventory-pending-issues/presentation/inventory-pending-issues.controller.ts#L51).

```text
51: export class InventoryPendingIssuesController {
52:   constructor(private readonly service: InventoryPendingIssuesService) {}
53: 
54:   @Post()
55:   @HttpCode(201)
56:   @RequirePermissions('inventory-pending-issues:create')
57:   @ApiOperation({ summary: 'Criar pendencia manual' })
58:   @ApiParam({ name: 'projectId', type: 'integer', format: 'int64' })
59:   @ApiCreatedResponse({ type: InventoryPendingIssueResponseDto })
60:   async create(
61:     @Param('projectId', ParseIntPipe) projectId: number,
62:     @Body() dto: CreateInventoryPendingIssueDto,
63:     @Req() req: AuthenticatedRequest,
64:   ) {
```

## E24

DTOs de despesas e anexos: [gai-backend/src/modules/payments-expenses/application/dto/payments-expenses-inputs.ts:67](../../gai-backend/src/modules/payments-expenses/application/dto/payments-expenses-inputs.ts#L67).

```text
67: export class ExpenseInputDto {
68:   @ApiPropertyOptional({ type: 'integer', format: 'int64', nullable: true })
69:   @IsOptional()
70:   @Type(() => Number)
71:   @IsInt()
72:   @Min(1)
73:   field_agent_id?: number | null;
74:   @ApiProperty()
75:   @IsString()
76:   description!: string;
77:   @ApiPropertyOptional({ nullable: true })
78:   @IsOptional()
79:   @IsString()
80:   reason?: string | null;
```

## E25

Persistência de despesa e autoria: [gai-backend/src/modules/payments-expenses/application/services/payments-expenses.service.ts:230](../../gai-backend/src/modules/payments-expenses/application/services/payments-expenses.service.ts#L230).

```text
230:   async createExpense(
231:     projectId: number,
232:     dto: ExpenseInputDto,
233:     actor: PaymentsExpensesActorContext,
234:   ): Promise<ExpenseResponseDto> {
235:     const project = await this.getProject(projectId, actor, true);
236:     if (dto.field_agent_id)
237:       await this.assertFieldAgent(
238:         project.organizationId,
239:         projectId,
240:         dto.field_agent_id,
241:       );
242:     const now = new Date();
243:     const expense = new Expense({
```

## E26

Rotas de financeiro: [gai-backend/src/modules/payments-expenses/presentation/payments-expenses.controller.ts:61](../../gai-backend/src/modules/payments-expenses/presentation/payments-expenses.controller.ts#L61).

```text
61: export class PaymentsExpensesController {
62:   constructor(private readonly service: PaymentsExpensesService) {}
63: 
64:   @Post('payments')
65:   @HttpCode(201)
66:   @RequirePermissions('payments:create')
67:   @ApiOperation({ summary: 'Criar pagamento' })
68:   @ApiCreatedResponse({ type: PaymentResponseDto })
69:   createPayment(
70:     @Param('projectId', ParseIntPipe) projectId: number,
71:     @Body() dto: PaymentInputDto,
72:     @Req() req: AuthenticatedRequest,
73:   ) {
74:     return this.service.createPayment(projectId, dto, this.toActor(req));
```

## E27

Upload individual de imagens de item: [gai-backend/src/modules/inventory-item-images/application/use-cases/create-inventory-item-image-upload-url.use-case.ts:55](../../gai-backend/src/modules/inventory-item-images/application/use-cases/create-inventory-item-image-upload-url.use-case.ts#L55).

```text
55:   async execute(
56:     projectId: number,
57:     itemId: number,
58:     dto: CreateInventoryItemImageUploadDto,
59:     actor: InventoryItemImageActorContext,
60:   ): Promise<InventoryItemImageUploadUrlResponseDto> {
61:     const item = await this.inventoryItems.findById(itemId);
62:     if (!item) {
63:       throw new NotFoundException({
64:         code: 'NOT_FOUND',
65:         message: 'Inventory item not found',
66:       });
67:     }
68:     this.scope.assertItemBelongsToProject(item, projectId);
```

## E28

S3 real: assinatura e inspeção: [gai-backend/src/common/storage/s3-storage-adapter.service.ts:183](../../gai-backend/src/common/storage/s3-storage-adapter.service.ts#L183).

```text
183:   async createUploadUrl(input: PresignedUrlInput): Promise<PresignedUrlResult> {
184:     this.validate(input);
185:     return this.operation(async () => ({
186:       url: await getSignedUrl(
187:         this.s3(),
188:         new PutObjectCommand({
189:           Bucket: input.bucket,
190:           Key: input.path,
191:           ContentType: input.mimeType,
192:           ContentLength: input.sizeBytes,
193:           ...(input.checksum
194:             ? {
195:                 ChecksumSHA256: Buffer.from(input.checksum, 'hex').toString(
196:                   'base64',
```

## E29

Confirmação de upload e checksum: [gai-backend/src/common/storage/storage-object.policy.ts:20](../../gai-backend/src/common/storage/storage-object.policy.ts#L20).

```text
20: export function assertUploadConfirmation(
21:   input: VerifyUploadInput,
22: ): string | undefined {
23:   if (Date.now() >= input.createdAt.getTime() + input.expiresInSeconds * 1000) {
24:     throw new GoneException({
25:       code: 'STORAGE_UPLOAD_EXPIRED',
26:       message: 'Upload authorization expired; request a new upload',
27:     });
28:   }
29:   if (
30:     input.assertion?.sizeBytes != null &&
31:     input.assertion.sizeBytes !== Number(input.sizeBytes)
32:   ) {
33:     throw new ConflictException({
```

## E30

Migration de identidade e FKs compostas: [gai-backend/src/migrations/1794300000001-harden-field-agent-identity.ts:5](../../gai-backend/src/migrations/1794300000001-harden-field-agent-identity.ts#L5).

```text
5:   async up(q: QueryRunner): Promise<void> {
6:     const duplicates = (await q.query(
7:       'SELECT user_id FROM field_agents WHERE user_id IS NOT NULL AND deleted_at IS NULL GROUP BY user_id HAVING COUNT(*)>1 LIMIT 1',
8:     )) as unknown[];
9:     const inconsistent = (await q.query(
10:       `SELECT a.id FROM field_agents a JOIN users u ON u.id=a.user_id WHERE NOT(a.organization_id <=> u.organization_id) LIMIT 1`,
11:     )) as unknown[];
12:     const invalidLinks = (await q.query(
13:       `SELECT a.id FROM project_field_agents a JOIN field_agents f ON f.id=a.field_agent_id JOIN projects p ON p.id=a.project_id WHERE a.organization_id<>f.organization_id OR a.organization_id<>p.organization_id LIMIT 1`,
14:     )) as unknown[];
15:     if (duplicates.length || inconsistent.length || invalidLinks.length)
16:       throw new Error(
17:         'Field-agent preflight failed. Reconcile incompatible links with explicit authorization before migrating; no historical data was changed.',
18:       );
```

## E31

Registro de observação usa elegibilidade operacional: [gai-backend/src/modules/inventory-operations/application/inventory-operations.service.ts:439](../../gai-backend/src/modules/inventory-operations/application/inventory-operations.service.ts#L439).

```text
439:   async recordObservation(
440:     projectId: number,
441:     sessionId: number,
442:     roundId: number,
443:     dto: CreateInventoryObservationDto,
444:     actor: InventoryOperationActor,
445:   ) {
446:     assertOperationalActor(actor);
447:     const project = await this.getProject(projectId, actor, true);
448:     const item = await this.requireItem(projectId, dto.inventory_item_id);
449:     if (dto.idempotency_key) {
450:       const existing = await this.observations.findOne({
451:         where: {
452:           organizationId: project.organizationId,
```

## E32

Filtro global de erros: [gai-backend/src/common/filters/http-exception.filter.ts:15](../../gai-backend/src/common/filters/http-exception.filter.ts#L15).

```text
15:   catch(exception: unknown, host: ArgumentsHost): void {
16:     const ctx = host.switchToHttp();
17:     const response = ctx.getResponse<Response>();
18: 
19:     if (exception instanceof HttpException) {
20:       const status = exception.getStatus();
21:       const exceptionResponse = exception.getResponse();
22: 
23:       if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
24:         const body = exceptionResponse as Record<string, unknown>;
25:         response.status(status).json({
26:           code: body.code ?? this.statusToCode(status),
27:           message: body.message ?? exception.message,
28:           ...(body.details ? { details: body.details } : {}),
```

## E33

IDs BIGINT no MySQL e number no código: [gai-backend/src/common/persistence/entity-id.columns.ts:6](../../gai-backend/src/common/persistence/entity-id.columns.ts#L6).

```text
6: export const PRIMARY_KEY_COLUMN = useIntegerIds
7:   ? { type: 'integer' as const }
8:   : { type: 'bigint' as const, unsigned: true as const };
9: 
10: export const FOREIGN_KEY_COLUMN = useIntegerIds
11:   ? { type: 'integer' as const }
12:   : { type: 'bigint' as const, unsigned: true as const };
13: 
```

## E34

Respostas de importação e contadores: [gai-backend/src/modules/import-sessions/application/dto/import-sessions-response.dto.ts:14](../../gai-backend/src/modules/import-sessions/application/dto/import-sessions-response.dto.ts#L14).

```text
14: export class ImportSessionResponseDto {
15:   @ApiProperty()
16:   id!: number;
17:   @ApiProperty()
18:   organization_id!: number;
19:   @ApiProperty()
20:   project_id!: number;
21:   @ApiProperty({ enum: ImportSessionType })
22:   type!: ImportSessionType;
23:   @ApiProperty({ enum: ImportSessionSource })
24:   source!: ImportSessionSource;
25:   @ApiProperty({ enum: ImportSessionStatus })
26:   status!: ImportSessionStatus;
27:   @ApiProperty()
```

## E35

Processamento síncrono e falhas por linha: [gai-backend/src/modules/import-sessions/application/services/import-sessions.service.ts:573](../../gai-backend/src/modules/import-sessions/application/services/import-sessions.service.ts#L573).

```text
573:   private async processPayload(
574:     projectId: number,
575:     sessionId: number,
576:     payloadId: number,
577:     actor: ImportSessionActorContext,
578:   ): Promise<void> {
579:     await this.dataSource.transaction(async (manager) => {
580:       const sessionRepo = manager.getRepository(ImportSessionEntity);
581:       const payloadRepo = manager.getRepository(ImportPayloadEntity);
582:       const errorRepo = manager.getRepository(ImportPayloadErrorEntity);
583:       const auditRepo = manager.getRepository(ImportSessionAuditLogEntity);
584:       const itemRepo = manager.getRepository(InventoryItemEntity);
585:       const itemAuditRepo = manager.getRepository(InventoryItemAuditLogEntity);
586:       const session = await sessionRepo.findOneByOrFail({ id: sessionId });
```

## E36

Upsert, remoção e atribuição de imagens: [gai-backend/src/modules/import-sessions/application/services/import-sessions.service.ts:885](../../gai-backend/src/modules/import-sessions/application/services/import-sessions.service.ts#L885).

```text
885:   private async applyItem(
886:     manager: EntityManager,
887:     itemRepo: Repository<InventoryItemEntity>,
888:     auditRepo: Repository<InventoryItemAuditLogEntity>,
889:     session: ImportSessionEntity,
890:     item: ImportPayloadItemDto,
891:     actor: ImportSessionActorContext,
892:     rowNumber: number,
893:   ): Promise<'created' | 'updated' | 'deleted'> {
894:     const externalId = this.scope.cleanText(item.external_item_id) ?? null;
895:     const existing = await this.findInventoryItemByExternalId(
896:       itemRepo,
897:       session.projectId,
898:       externalId,
```

## E37

Idempotência e lookup com excluídos: [gai-backend/src/modules/import-sessions/application/services/import-sessions.service.ts:994](../../gai-backend/src/modules/import-sessions/application/services/import-sessions.service.ts#L994).

```text
994:   private async findDuplicate(
995:     session: ImportSessionEntity,
996:     dto: CreateImportPayloadDto,
997:   ): Promise<ImportPayloadEntity | null> {
998:     const byNumber = await this.repo.findPayloadByNumber(
999:       session.id,
1000:       dto.payload_number,
1001:     );
1002:     const byKey = await this.repo.findPayloadByIdempotencyKey(
1003:       session.id,
1004:       dto.idempotency_key,
1005:     );
1006:     const existing = byNumber ?? byKey;
1007:     if (!existing) return null;
```

## E38

Finalização da importação: [gai-backend/src/modules/import-sessions/application/services/import-sessions.service.ts:288](../../gai-backend/src/modules/import-sessions/application/services/import-sessions.service.ts#L288).

```text
288:   async finishSession(
289:     projectId: number,
290:     sessionId: number,
291:     actor: ImportSessionActorContext,
292:   ): Promise<ImportSessionResponseDto> {
293:     const session = await this.findSession(projectId, sessionId, actor, true);
294:     if (
295:       session.expectedPayloads &&
296:       session.receivedPayloads < session.expectedPayloads
297:     ) {
298:       throw new ConflictException({
299:         code: 'CONFLICT',
300:         message: 'Expected payloads were not fully received',
301:       });
```

## E39

Importação física valida vínculo mas não elegibilidade completa: [gai-backend/src/modules/import-sessions/application/services/import-sessions.service.ts:697](../../gai-backend/src/modules/import-sessions/application/services/import-sessions.service.ts#L697).

```text
697:   private async applyPhysicalObservation(
698:     manager: EntityManager,
699:     importSession: ImportSessionEntity,
700:     payload: ImportPayloadEntity,
701:     item: ImportPayloadItemDto,
702:     actor: ImportSessionActorContext,
703:     rowNumber: number,
704:   ): Promise<'created'> {
705:     if (item.captured_at != null && !isExplicitInstant(item.captured_at))
706:       throw new Error(
707:         'captured_at must be a valid timestamp with an explicit offset',
708:       );
709:     const config = (importSession.metadata ?? {}) as Record<string, unknown>;
710:     const inventorySessionId =
```

## E40

Unidades corporativas e vínculo por projeto: [gai-backend/src/modules/companies/presentation/companies.controller.ts:66](../../gai-backend/src/modules/companies/presentation/companies.controller.ts#L66).

```text
66: export class CompaniesController {
67:   constructor(private readonly companies: CompaniesService) {}
68: 
69:   @Post('companies')
70:   @HttpCode(201)
71:   @RequirePermissions('companies:create')
72:   @ApiOperation({ summary: 'Criar company' })
73:   @ApiCreatedResponse({ type: CompanyResponseDto })
74:   @ApiValidationErrorResponse()
75:   @ApiUnauthorizedResponse()
76:   @ApiForbiddenResponse()
77:   @ApiConflictResponse('Conflito', 'Company document already exists')
78:   createCompany(
79:     @Body() dto: CreateCompanyDto,
```

## E41

Sessões ativas, revogação e touch: [gai-backend/src/modules/auth/infrastructure/persistence/typeorm-session.repository.ts:26](../../gai-backend/src/modules/auth/infrastructure/persistence/typeorm-session.repository.ts#L26).

```text
26:   async findActiveById(id: string, now: Date): Promise<SessionRecord | null> {
27:     return this.repo.findOne({
28:       where: {
29:         id,
30:         revokedAt: IsNull(),
31:         expiresAt: MoreThan(now),
32:       },
33:     });
34:   }
35: 
36:   async revoke(sessionId: string, revokedAt: Date): Promise<void> {
37:     await this.repo.update({ id: sessionId }, { revokedAt });
38:   }
39: 
```

## E42

Consulta e rename de unidades: [gai-backend/src/modules/companies/application/services/companies.service.ts:401](../../gai-backend/src/modules/companies/application/services/companies.service.ts#L401).

```text
401:   async updateUnit(
402:     companyId: number,
403:     unitId: number,
404:     dto: UpdateCompanyUnitDto,
405:     actor: CompanyActorContext,
406:   ): Promise<CompanyUnitResponseDto> {
407:     const unit = await this.findUnitOrFail(companyId, unitId);
408:     this.scope.assertCanAccessOrganization(actor, unit.organizationId);
409:     const changes: Record<string, { before: unknown; after: unknown }> = {};
410:     if (dto.name !== undefined) {
411:       this.change(changes, unit, 'name', this.cleanRequired(dto.name, 'name'));
412:     }
413:     if (dto.code !== undefined) {
414:       this.change(changes, unit, 'code', this.clean(dto.code));
```

## E43

Restrições de identidade no repositório: [gai-backend/src/modules/field-agents/infrastructure/persistence/typeorm-field-agent.repository.ts:192](../../gai-backend/src/modules/field-agents/infrastructure/persistence/typeorm-field-agent.repository.ts#L192).

```text
192:   async saveFieldAgentWithAudit(
193:     fieldAgent: FieldAgent,
194:     audit: FieldAgentAuditEntry,
195:   ): Promise<FieldAgent> {
196:     const db = this.fieldAgentRepo.manager.connection;
197:     return identityTransaction(db, async (manager) => {
198:       // Same access/user locks as organization transfer; no cross-tenant link can
199:       // be created between its preflight and commit.
200:       await lockAccessAdministration(manager);
201:       if (fieldAgent.userId !== null) {
202:         const user = await lockUser(manager, fieldAgent.userId);
203:         const platform =
204:           user &&
205:           (await manager
```

## E44

Resposta de item: [gai-backend/src/modules/inventory-items/application/dto/inventory-item-response.dto.ts:94](../../gai-backend/src/modules/inventory-items/application/dto/inventory-item-response.dto.ts#L94).

```text
94:   static fromDomain(item: InventoryItem): InventoryItemResponseDto {
95:     const props = item.toProps();
96:     return {
97:       id: props.id,
98:       organization_id: props.organizationId,
99:       project_id: props.projectId,
100:       external_item_id: props.externalItemId,
101:       sequence: props.sequence,
102:       old_plate: props.oldPlate,
103:       new_plate: props.newPlate,
104:       unit_text: props.unitText,
105:       address_text: props.addressText,
106:       location_text: props.locationText,
107:       description: props.description,
```

## E45

Query de itens: sem delta/cursor: [gai-backend/src/modules/inventory-items/application/dto/list-inventory-items-query.dto.ts:6](../../gai-backend/src/modules/inventory-items/application/dto/list-inventory-items-query.dto.ts#L6).

```text
6: export class ListInventoryItemsQueryDto {
7:   @ApiPropertyOptional({ minimum: 1, default: 1 })
8:   @IsOptional()
9:   @Type(() => Number)
10:   @IsInt()
11:   @Min(1)
12:   page?: number = 1;
13: 
14:   @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 20 })
15:   @IsOptional()
16:   @Type(() => Number)
17:   @IsInt()
18:   @Min(1)
19:   @Max(100)
```

## E46

Schema de importações: [gai-backend/src/migrations/1740600000001-create-import-sessions.ts:6](../../gai-backend/src/migrations/1740600000001-create-import-sessions.ts#L6).

```text
6:   public async up(queryRunner: QueryRunner): Promise<void> {
7:     await queryRunner.query(`CREATE TABLE import_sessions (
8:       id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, organization_id BIGINT UNSIGNED NOT NULL, project_id BIGINT UNSIGNED NOT NULL,
9:       type VARCHAR(40) NOT NULL, source VARCHAR(30) NOT NULL, status VARCHAR(20) NOT NULL DEFAULT 'open', session_uuid VARCHAR(64) NOT NULL,
10:       expected_payloads INT UNSIGNED NULL, received_payloads INT UNSIGNED NOT NULL DEFAULT 0, processed_payloads INT UNSIGNED NOT NULL DEFAULT 0, failed_payloads INT UNSIGNED NOT NULL DEFAULT 0,
11:       total_items INT UNSIGNED NOT NULL DEFAULT 0, total_images INT UNSIGNED NOT NULL DEFAULT 0, total_created INT UNSIGNED NOT NULL DEFAULT 0, total_updated INT UNSIGNED NOT NULL DEFAULT 0,
12:       total_deleted INT UNSIGNED NOT NULL DEFAULT 0, total_failed INT UNSIGNED NOT NULL DEFAULT 0, raw_backup_path VARCHAR(500) NULL, created_by_id BIGINT UNSIGNED NULL,
13:       started_at DATETIME(3) NULL, finished_at DATETIME(3) NULL, expires_at DATETIME(3) NULL, error_message TEXT NULL, metadata JSON NULL,
14:       created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3), deleted_at DATETIME(3) NULL,
15:       PRIMARY KEY (id), UNIQUE INDEX idx_import_sessions_session_uuid (session_uuid), INDEX idx_import_sessions_org_project_status (organization_id, project_id, status), INDEX idx_import_sessions_project_created (project_id, created_at),
16:       CONSTRAINT fk_import_sessions_org FOREIGN KEY (organization_id) REFERENCES organizations(id), CONSTRAINT fk_import_sessions_project FOREIGN KEY (project_id) REFERENCES projects(id)
17:     ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
18:     await queryRunner.query(`CREATE TABLE import_payloads (
19:       id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, organization_id BIGINT UNSIGNED NOT NULL, import_session_id BIGINT UNSIGNED NOT NULL,
```

## E47

Schema de itens sem unicidade externa composta: [gai-backend/src/migrations/1740000000001-create-inventory-items.ts:6](../../gai-backend/src/migrations/1740000000001-create-inventory-items.ts#L6).

```text
6:   public async up(queryRunner: QueryRunner): Promise<void> {
7:     await queryRunner.query(`
8:       CREATE TABLE inventory_items (
9:         id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
10:         organization_id BIGINT UNSIGNED NOT NULL,
11:         project_id BIGINT UNSIGNED NOT NULL,
12:         external_item_id VARCHAR(100) NULL,
13:         sequence VARCHAR(50) NULL,
14:         old_plate VARCHAR(100) NULL,
15:         new_plate VARCHAR(100) NULL,
16:         unit_text VARCHAR(255) NULL,
17:         address_text TEXT NULL,
18:         location_text TEXT NULL,
19:         description TEXT NULL,
```

## E48

CloudFront encaminha API sem cache: [infra/terraform/cloudfront.tf:92](../../infra/terraform/cloudfront.tf#L92).

```text
92:     path_pattern             = "/api/*"
93:     target_origin_id         = "alb-api"
94:     viewer_protocol_policy   = "redirect-to-https"
95:     allowed_methods          = ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"]
96:     cached_methods           = ["GET", "HEAD"]
97:     compress                 = true
98:     cache_policy_id          = data.aws_cloudfront_cache_policy.caching_disabled.id
99:     origin_request_policy_id = data.aws_cloudfront_origin_request_policy.all_viewer_except_host.id
100:   }
101: 
102:   custom_error_response {
103:     error_code            = 403
104:     response_code         = 200
105:     response_page_path    = "/index.html"
```

## E50

Bucket privado, versionamento e criptografia: [infra/terraform/s3.tf:41](../../infra/terraform/s3.tf#L41).

```text
41: resource "aws_s3_bucket_versioning" "assets" {
42:   bucket = aws_s3_bucket.assets.id
43:   versioning_configuration {
44:     status = "Enabled"
45:   }
46: }
47: 
48: resource "aws_s3_bucket_server_side_encryption_configuration" "assets" {
49:   bucket = aws_s3_bucket.assets.id
50:   rule {
51:     apply_server_side_encryption_by_default {
52:       sse_algorithm = "AES256"
53:     }
54:   }
```

