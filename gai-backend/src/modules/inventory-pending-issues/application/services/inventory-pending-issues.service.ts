import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import {
  INVENTORY_ACCOUNTING_ITEM_REPOSITORY,
  type InventoryAccountingItemRepository,
} from '../../../inventory-accounting-items/domain/ports/inventory-accounting-item.repository.port';
import {
  INVENTORY_ITEM_REPOSITORY,
  type InventoryItemRepository,
} from '../../../inventory-items/domain/ports/inventory-item.repository.port';
import {
  PROJECT_REPOSITORY,
  type ProjectRepository,
} from '../../../projects/domain/ports/project.repository.port';
import { InventoryPendingIssue } from '../../domain/entities/inventory-pending-issue';
import { InventoryPendingIssueAuditOperation } from '../../domain/enums/inventory-pending-issue-audit-operation.enum';
import { InventoryPendingIssueSeverity } from '../../domain/enums/inventory-pending-issue-severity.enum';
import { InventoryPendingIssueStatus } from '../../domain/enums/inventory-pending-issue-status.enum';
import { InventoryPendingIssueType } from '../../domain/enums/inventory-pending-issue-type.enum';
import {
  INVENTORY_PENDING_ISSUE_REPOSITORY,
  type InventoryPendingIssueRepository,
} from '../../domain/ports/inventory-pending-issue.repository.port';
import {
  CreateInventoryPendingIssueDto,
  ResolveInventoryPendingIssueDto,
  UpdateInventoryPendingIssueDto,
} from '../dto/inventory-pending-issue-inputs';
import {
  GenerateInventoryPendingIssuesResponseDto,
  InventoryPendingIssueListResponseDto,
  InventoryPendingIssueResponseDto,
} from '../dto/inventory-pending-issue-response.dto';
import { ListInventoryPendingIssuesQueryDto } from '../dto/list-inventory-pending-issues-query.dto';
import {
  InventoryPendingIssueActorContext,
  InventoryPendingIssueScopeService,
} from './inventory-pending-issue-scope.service';

@Injectable()
export class InventoryPendingIssuesService {
  constructor(
    @Inject(INVENTORY_PENDING_ISSUE_REPOSITORY)
    private readonly repository: InventoryPendingIssueRepository,
    @Inject(PROJECT_REPOSITORY)
    private readonly projects: ProjectRepository,
    @Inject(INVENTORY_ITEM_REPOSITORY)
    private readonly inventoryItems: InventoryItemRepository,
    @Inject(INVENTORY_ACCOUNTING_ITEM_REPOSITORY)
    private readonly accountingItems: InventoryAccountingItemRepository,
    private readonly scope: InventoryPendingIssueScopeService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(InventoryPendingIssuesService.name);
  }

  async create(
    projectId: number,
    dto: CreateInventoryPendingIssueDto,
    actor: InventoryPendingIssueActorContext,
  ): Promise<InventoryPendingIssueResponseDto> {
    const project = await this.getProject(projectId, actor, true);
    await this.assertLinkedItems(
      project.organizationId,
      projectId,
      dto.inventory_item_id ?? null,
      dto.accounting_item_id ?? null,
      actor,
    );
    await this.assertNoOpenDuplicate(
      project.organizationId,
      projectId,
      dto.type,
      dto.inventory_item_id ?? null,
      dto.accounting_item_id ?? null,
    );

    const now = new Date();
    const issue = new InventoryPendingIssue({
      id: 0,
      organizationId: project.organizationId,
      projectId,
      inventoryItemId: dto.inventory_item_id ?? null,
      accountingItemId: dto.accounting_item_id ?? null,
      type: dto.type,
      status: InventoryPendingIssueStatus.OPEN,
      severity: dto.severity ?? InventoryPendingIssueSeverity.MEDIUM,
      title: this.scope.cleanText(dto.title) ?? dto.title,
      description: this.scope.cleanText(dto.description) ?? null,
      oldValue: dto.old_value ?? null,
      newValue: dto.new_value ?? null,
      resolutionNotes: null,
      resolvedById: null,
      resolvedAt: null,
      ignoredById: null,
      ignoredAt: null,
      createdById: actor.id,
      updatedById: actor.id,
      metadata: dto.metadata ?? null,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    });

    const saved = await this.repository.saveWithAudit(issue, {
      inventoryPendingIssueId: 0,
      organizationId: issue.organizationId,
      projectId: issue.projectId,
      operation: InventoryPendingIssueAuditOperation.CREATE,
      performedBy: actor.id,
      changes: { status: { before: null, after: issue.status } },
    });
    return InventoryPendingIssueResponseDto.fromDomain(saved);
  }

  async list(
    projectId: number,
    query: ListInventoryPendingIssuesQueryDto,
    actor: InventoryPendingIssueActorContext,
  ): Promise<InventoryPendingIssueListResponseDto> {
    const project = await this.getProject(projectId, actor, false);
    const page = query.page ?? 1;
    const pageSize = query.page_size ?? 20;
    const { items, total } = await this.repository.list({
      page,
      pageSize,
      organizationId: project.organizationId,
      projectId,
      type: query.type,
      status: query.status,
      severity: query.severity,
      inventoryItemId: query.inventory_item_id,
      accountingItemId: query.accounting_item_id,
      plate: this.scope.normalizePlate(query.plate) ?? undefined,
      search: query.search,
    });
    return {
      items: items.map((item) =>
        InventoryPendingIssueResponseDto.fromDomain(item),
      ),
      page,
      page_size: pageSize,
      total_items: total,
      total_pages: total === 0 ? 0 : Math.ceil(total / pageSize),
    };
  }

  async get(
    projectId: number,
    id: number,
    actor: InventoryPendingIssueActorContext,
  ): Promise<InventoryPendingIssueResponseDto> {
    const issue = await this.findIssue(projectId, id, actor);
    return InventoryPendingIssueResponseDto.fromDomain(issue);
  }

  async update(
    projectId: number,
    id: number,
    dto: UpdateInventoryPendingIssueDto,
    actor: InventoryPendingIssueActorContext,
  ): Promise<InventoryPendingIssueResponseDto> {
    const issue = await this.findIssue(projectId, id, actor);
    await this.getProject(projectId, actor, true);
    const changes = issue.updateFields({
      type: dto.type,
      status: dto.status,
      severity: dto.severity,
      title: this.scope.cleanText(dto.title) ?? undefined,
      description: this.scope.cleanText(dto.description),
      oldValue: dto.old_value,
      newValue: dto.new_value,
      metadata: dto.metadata,
      updatedById: actor.id,
    });
    if (Object.keys(changes).length === 0) {
      return InventoryPendingIssueResponseDto.fromDomain(issue);
    }
    const saved = await this.repository.saveWithAudit(issue, {
      inventoryPendingIssueId: issue.id,
      organizationId: issue.organizationId,
      projectId: issue.projectId,
      operation: InventoryPendingIssueAuditOperation.UPDATE,
      performedBy: actor.id,
      changes,
    });
    return InventoryPendingIssueResponseDto.fromDomain(saved);
  }

  async resolve(
    projectId: number,
    id: number,
    dto: ResolveInventoryPendingIssueDto,
    actor: InventoryPendingIssueActorContext,
  ): Promise<InventoryPendingIssueResponseDto> {
    return this.transition(projectId, id, 'resolve', dto, actor);
  }

  async ignore(
    projectId: number,
    id: number,
    dto: ResolveInventoryPendingIssueDto,
    actor: InventoryPendingIssueActorContext,
  ): Promise<InventoryPendingIssueResponseDto> {
    return this.transition(projectId, id, 'ignore', dto, actor);
  }

  async cancel(
    projectId: number,
    id: number,
    actor: InventoryPendingIssueActorContext,
  ): Promise<InventoryPendingIssueResponseDto> {
    return this.transition(projectId, id, 'cancel', {}, actor);
  }

  async generate(
    projectId: number,
    actor: InventoryPendingIssueActorContext,
  ): Promise<GenerateInventoryPendingIssuesResponseDto> {
    const project = await this.getProject(projectId, actor, true);
    const physical = await this.listAllInventoryItems(
      project.organizationId,
      projectId,
    );
    const accounting = await this.listAllAccountingItems(
      project.organizationId,
      projectId,
    );
    let created = 0;
    let skipped = 0;

    const accountingByPlate = new Map(
      accounting
        .map((item) => [item.toProps().plate, item] as const)
        .filter(([plate]) => plate),
    );
    const physicalPlateSet = new Set<string>();
    for (const item of physical) {
      const props = item.toProps();
      const plate = props.newPlate ?? props.oldPlate;
      if (plate) physicalPlateSet.add(plate);
      if (!plate) {
        created += await this.createGeneratedIssue(
          project.organizationId,
          projectId,
          actor.id,
          InventoryPendingIssueType.MISSING_PLATE,
          item.id,
          null,
          'Item fisico sem placa',
          { plate: null },
          null,
        );
        continue;
      }
      const match = accountingByPlate.get(plate);
      if (!match) {
        created += await this.createGeneratedIssue(
          project.organizationId,
          projectId,
          actor.id,
          InventoryPendingIssueType.PHYSICAL_ITEM_WITHOUT_ACCOUNTING_MATCH,
          item.id,
          null,
          'Item fisico sem correspondencia contabil',
          { plate },
          null,
        );
        continue;
      }
      const accountProps = match.toProps();
      if (this.differs(props.description, accountProps.description)) {
        created += await this.createGeneratedIssue(
          project.organizationId,
          projectId,
          actor.id,
          InventoryPendingIssueType.DESCRIPTION_DIVERGENCE,
          item.id,
          match.id,
          'Divergencia de descricao',
          { inventory: props.description },
          { accounting: accountProps.description },
        );
      }
      if (this.differs(props.locationText, accountProps.location)) {
        created += await this.createGeneratedIssue(
          project.organizationId,
          projectId,
          actor.id,
          InventoryPendingIssueType.LOCATION_DIVERGENCE,
          item.id,
          match.id,
          'Divergencia de localizacao',
          { inventory: props.locationText },
          { accounting: accountProps.location },
        );
      }
    }

    for (const account of accounting) {
      const props = account.toProps();
      if (props.plate && physicalPlateSet.has(props.plate)) continue;
      const result = await this.createGeneratedIssue(
        project.organizationId,
        projectId,
        actor.id,
        InventoryPendingIssueType.ACCOUNTING_ITEM_NOT_FOUND,
        null,
        account.id,
        'Bem contabil nao encontrado no inventario fisico',
        { plate: props.plate },
        null,
      );
      created += result;
      skipped += result === 0 ? 1 : 0;
    }

    this.logger.info({
      operation: 'GENERATE_INVENTORY_PENDING_ISSUES',
      projectId,
      organizationId: project.organizationId,
      created,
      skipped,
      result: 'SUCCESS',
    });
    return { created, skipped };
  }

  private async transition(
    projectId: number,
    id: number,
    action: 'resolve' | 'ignore' | 'cancel',
    dto: Partial<ResolveInventoryPendingIssueDto>,
    actor: InventoryPendingIssueActorContext,
  ): Promise<InventoryPendingIssueResponseDto> {
    const issue = await this.findIssue(projectId, id, actor);
    await this.getProject(projectId, actor, true);
    let changes: Record<string, { before: unknown; after: unknown }>;
    try {
      if (action === 'resolve')
        changes = issue.resolve(
          actor.id,
          this.scope.cleanText(dto.resolution_notes) ?? null,
          new Date(),
        );
      else if (action === 'ignore')
        changes = issue.ignore(
          actor.id,
          this.scope.cleanText(dto.resolution_notes) ?? null,
          new Date(),
        );
      else changes = issue.cancel(actor.id);
    } catch (error) {
      throw new ConflictException({
        code: 'CONFLICT',
        message:
          error instanceof Error
            ? error.message
            : 'Issue status blocks this operation',
      });
    }
    const saved = await this.repository.saveWithAudit(issue, {
      inventoryPendingIssueId: issue.id,
      organizationId: issue.organizationId,
      projectId: issue.projectId,
      operation:
        action === 'resolve'
          ? InventoryPendingIssueAuditOperation.RESOLVE
          : action === 'ignore'
            ? InventoryPendingIssueAuditOperation.IGNORE
            : InventoryPendingIssueAuditOperation.CANCEL,
      performedBy: actor.id,
      changes,
    });
    return InventoryPendingIssueResponseDto.fromDomain(saved);
  }

  private async createGeneratedIssue(
    organizationId: number,
    projectId: number,
    actorId: number,
    type: InventoryPendingIssueType,
    inventoryItemId: number | null,
    accountingItemId: number | null,
    title: string,
    oldValue: Record<string, unknown> | null,
    newValue: Record<string, unknown> | null,
  ): Promise<number> {
    const duplicate = await this.repository.findOpenDuplicate({
      organizationId,
      projectId,
      type,
      inventoryItemId,
      accountingItemId,
    });
    if (duplicate) return 0;
    const now = new Date();
    const issue = new InventoryPendingIssue({
      id: 0,
      organizationId,
      projectId,
      inventoryItemId,
      accountingItemId,
      type,
      status: InventoryPendingIssueStatus.OPEN,
      severity:
        type === InventoryPendingIssueType.MISSING_PLATE
          ? InventoryPendingIssueSeverity.HIGH
          : InventoryPendingIssueSeverity.MEDIUM,
      title,
      description: null,
      oldValue,
      newValue,
      resolutionNotes: null,
      resolvedById: null,
      resolvedAt: null,
      ignoredById: null,
      ignoredAt: null,
      createdById: actorId,
      updatedById: actorId,
      metadata: { generated: true },
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    });
    await this.repository.saveWithAudit(issue, {
      inventoryPendingIssueId: 0,
      organizationId,
      projectId,
      operation: InventoryPendingIssueAuditOperation.GENERATE,
      performedBy: actorId,
      changes: {
        status: { before: null, after: InventoryPendingIssueStatus.OPEN },
      },
    });
    return 1;
  }

  private async getProject(
    projectId: number,
    actor: InventoryPendingIssueActorContext,
    mutation: boolean,
  ) {
    const project = await this.projects.findById(projectId);
    if (!project)
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Project not found',
      });
    this.scope.assertCanAccessOrganization(actor, project.organizationId);
    if (mutation) this.scope.assertProjectAllowsMutation(project);
    return project;
  }

  private async findIssue(
    projectId: number,
    id: number,
    actor: InventoryPendingIssueActorContext,
  ): Promise<InventoryPendingIssue> {
    const issue = await this.repository.findById(id);
    if (!issue || issue.projectId !== projectId)
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Inventory pending issue not found',
      });
    this.scope.assertCanAccessOrganization(actor, issue.organizationId);
    return issue;
  }

  private async assertLinkedItems(
    organizationId: number,
    projectId: number,
    inventoryItemId: number | null,
    accountingItemId: number | null,
    actor: InventoryPendingIssueActorContext,
  ): Promise<void> {
    if (inventoryItemId) {
      const item = await this.inventoryItems.findById(inventoryItemId);
      if (
        !item ||
        item.projectId !== projectId ||
        item.organizationId !== organizationId
      )
        throw new BadRequestException({
          code: 'VALIDATION_ERROR',
          message: 'Invalid inventory_item_id',
        });
      this.scope.assertCanAccessOrganization(actor, item.organizationId);
    }
    if (accountingItemId) {
      const item = await this.accountingItems.findById(accountingItemId);
      if (
        !item ||
        item.projectId !== projectId ||
        item.organizationId !== organizationId
      )
        throw new BadRequestException({
          code: 'VALIDATION_ERROR',
          message: 'Invalid accounting_item_id',
        });
      this.scope.assertCanAccessOrganization(actor, item.organizationId);
    }
  }

  private async assertNoOpenDuplicate(
    organizationId: number,
    projectId: number,
    type: InventoryPendingIssueType,
    inventoryItemId: number | null,
    accountingItemId: number | null,
  ): Promise<void> {
    const duplicate = await this.repository.findOpenDuplicate({
      organizationId,
      projectId,
      type,
      inventoryItemId,
      accountingItemId,
    });
    if (duplicate)
      throw new ConflictException({
        code: 'CONFLICT',
        message: 'Open pending issue already exists for this target',
      });
  }

  private async listAllInventoryItems(
    organizationId: number,
    projectId: number,
  ) {
    const all = [];
    for (let page = 1; ; page += 1) {
      const result = await this.inventoryItems.list({
        page,
        pageSize: 100,
        organizationId,
        projectId,
      });
      all.push(...result.items);
      if (all.length >= result.total) return all;
    }
  }

  private async listAllAccountingItems(
    organizationId: number,
    projectId: number,
  ) {
    const all = [];
    for (let page = 1; ; page += 1) {
      const result = await this.accountingItems.list({
        page,
        pageSize: 100,
        organizationId,
        projectId,
      });
      all.push(...result.items);
      if (all.length >= result.total) return all;
    }
  }

  private differs(left: string | null, right: string | null): boolean {
    if (!left || !right) return false;
    return left.trim().toLowerCase() !== right.trim().toLowerCase();
  }
}
