import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource, EntityManager } from 'typeorm';
import { createHash } from 'crypto';
import {
  ProjectScopeService,
  type ProjectActorContext,
} from '../../projects/application/services/project-scope.service';
import { ProjectEntity } from '../../projects/infrastructure/persistence/project.entity';
import { ProjectStatusTransitionPolicy } from '../../projects/domain/services/project-status-transition.policy';
import { InventoryItemEntity } from '../../inventory-items/infrastructure/persistence/inventory-item.entity';
import { AssetValuationEntity } from '../infrastructure/persistence/inventory-operation.entity';
import {
  ValuationBatch,
  ValuationBatchRow,
  type ValuationItemSnapshot,
} from '../infrastructure/persistence/valuation-batch.entity';
import { InventoryOperationsService } from './inventory-operations.service';
import { InventoryOperationPolicy } from './inventory-operation.policy';
import { valuationBatchLimit, valuationValues } from './valuation.policy';
import {
  ConfirmValuationBatchDto,
  PreviewValuationBatchDto,
  ValuationSelectionDto,
} from './valuation-batch.dto';
import { InventoryOperationListQueryDto } from './inventory-operation.dto';
const hash = (value: unknown): string =>
  createHash('sha256').update(JSON.stringify(value)).digest('hex');
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => [k, canonical(v)]),
    );
  return value;
}
function conflict(message: string, errors: unknown[] = [], total = 0): never {
  throw new ConflictException({
    code: 'VALUATION_BATCH_CONFLICT',
    message,
    details: {
      summary: {
        total_requested: total,
        total_processed: 0,
        total_approved: 0,
        total_rejected: total,
      },
      errors,
    },
  });
}
@Injectable()
export class ValuationBatchService {
  readonly limit: number;
  constructor(
    private readonly ds: DataSource,
    config: ConfigService,
    private readonly scope: ProjectScopeService,
    private readonly operations: InventoryOperationsService,
  ) {
    this.limit = valuationBatchLimit(config.get('BATCH_VALUATION_MAX_ITEMS'));
  }
  private async project(
    m: EntityManager,
    p: number,
    actor: ProjectActorContext,
    write = false,
  ) {
    const project = await m.getRepository(ProjectEntity).findOne({
      where: { id: p },
      ...(write && m.connection.options.type === 'mysql'
        ? { lock: { mode: 'pessimistic_write' as const } }
        : {}),
    });
    if (!project) throw new NotFoundException('Project not found');
    this.scope.assertCanAccessProject(actor, project.organizationId);
    if (
      write &&
      !ProjectStatusTransitionPolicy.allowsOperationalMutation(project.status)
    )
      conflict('O estado do projeto impede avaliação.');
    return project;
  }
  private async selected(
    m: EntityManager,
    project: ProjectEntity,
    selection: ValuationSelectionDto,
    lock = false,
  ) {
    if (!selection) throw new BadRequestException('Seleção obrigatória.');
    const q = m
      .getRepository(InventoryItemEntity)
      .createQueryBuilder('item')
      .withDeleted()
      .where('item.projectId = :p AND item.organizationId = :org', {
        p: project.id,
        org: project.organizationId,
      });
    if (selection.kind === 'ids') {
      if (
        !selection.ids?.length ||
        selection.filters ||
        selection.exclude_ids?.length
      )
        throw new BadRequestException(
          'Seleção por IDs exige uma lista não vazia e não aceita filtros/exclusões.',
        );
      if (new Set(selection.ids).size !== selection.ids.length)
        throw new BadRequestException('IDs duplicados.');
      if (selection.ids.length > this.limit)
        conflict(
          `Máximo de ${this.limit} itens por lote.`,
          [],
          selection.ids.length,
        );
      q.andWhere('item.id IN (:...ids)', { ids: selection.ids });
    } else if (selection.kind === 'filters') {
      if (selection.ids?.length)
        throw new BadRequestException(
          'Seleção por filtros não aceita IDs explícitos.',
        );
      const f = selection.filters ?? {};
      if (f.status) q.andWhere('item.status = :status', { status: f.status });
      if (f.old_plate)
        q.andWhere('item.oldPlate = :old', {
          old: InventoryOperationPolicy.normalizePlate(f.old_plate),
        });
      if (f.new_plate)
        q.andWhere('item.newPlate = :new', {
          new: InventoryOperationPolicy.normalizePlate(f.new_plate),
        });
      if (f.description)
        q.andWhere('LOWER(item.description) LIKE :description', {
          description: `%${f.description.toLowerCase()}%`,
        });
      if (f.search)
        q.andWhere(
          '(LOWER(item.description) LIKE :term OR LOWER(item.oldPlate) LIKE :term OR LOWER(item.newPlate) LIKE :term OR LOWER(item.brand) LIKE :term OR LOWER(item.model) LIKE :term OR LOWER(item.serialNumber) LIKE :term)',
          { term: `%${f.search.toLowerCase()}%` },
        );
      if (selection.exclude_ids?.length) {
        const excluded = await m
          .getRepository(InventoryItemEntity)
          .createQueryBuilder('e')
          .withDeleted()
          .where(
            'e.projectId=:p AND e.organizationId=:org AND e.id IN (:...ids)',
            {
              p: project.id,
              org: project.organizationId,
              ids: selection.exclude_ids,
            },
          )
          .getCount();
        if (excluded !== selection.exclude_ids.length)
          throw new BadRequestException(
            'Exclusão contém ID inexistente ou estrangeiro.',
          );
        q.andWhere('item.id NOT IN (:...excluded)', {
          excluded: selection.exclude_ids,
        });
      }
    } else throw new BadRequestException('Tipo de seleção inválido.');
    if (lock && m.connection.options.type === 'mysql')
      q.setLock('pessimistic_read');
    const items = await q
      .orderBy('item.id', 'ASC')
      .take(this.limit + 1)
      .getMany();
    if (items.length > this.limit)
      conflict(
        `Os filtros excedem o máximo de ${this.limit} itens. Refine a seleção; nenhum lote parcial foi criado.`,
        [],
        items.length,
      );
    if (selection.kind === 'ids' && items.length !== selection.ids!.length)
      conflict(
        'Seleção contém IDs inexistentes ou de outro projeto/organização.',
        selection
          .ids!.filter((id) => !items.some((i) => i.id === id))
          .map((id) => ({
            inventory_item_id: id,
            reason: 'Item indisponível neste projeto.',
          })),
        selection.ids!.length,
      );
    if (!items.length) conflict('Seleção vazia.');
    const errors = items
      .filter((i) => i.deletedAt || ['inactive', 'removed'].includes(i.status))
      .map((i) => ({
        inventory_item_id: i.id,
        reason: 'Item inativo, removido ou excluído.',
      }));
    if (errors.length)
      conflict(
        'Há itens inválidos. O lote inteiro foi bloqueado.',
        errors,
        items.length,
      );
    return items;
  }
  private async snapshot(
    m: EntityManager,
    item: InventoryItemEntity,
  ): Promise<ValuationItemSnapshot> {
    const repo = m.getRepository(AssetValuationEntity);
    const where = {
      inventoryItemId: item.id,
      projectId: item.projectId,
      organizationId: item.organizationId,
    };
    const latest = await repo.findOne({
      where,
      order: { valuationDate: 'DESC', id: 'DESC' },
    });
    const lastInserted = await repo.findOne({ where, order: { id: 'DESC' } });
    return {
      id: item.id,
      old_plate: item.oldPlate,
      new_plate: item.newPlate,
      description: item.description,
      status: item.status,
      last_valuation: latest
        ? {
            id: latest.id,
            source: latest.source,
            valuation_date: latest.valuationDate,
            new_value: latest.newValue,
            used_value: latest.usedValue,
            responsible_by_id: latest.responsibleById,
            notes: latest.notes,
          }
        : null,
      version: hash({ item, latest, lastInsertedId: lastInserted?.id ?? null }),
    };
  }
  async selection(
    p: number,
    selection: ValuationSelectionDto,
    actor: ProjectActorContext,
  ) {
    return this.ds.transaction(async (m) => {
      const project = await this.project(m, p, actor);
      const items = await this.selected(m, project, selection);
      const snapshots: ValuationItemSnapshot[] = [];
      for (const item of items) snapshots.push(await this.snapshot(m, item));
      return {
        project: { id: project.id, name: project.name },
        limit: this.limit,
        total: items.length,
        items: snapshots,
      };
    });
  }
  async preview(
    p: number,
    dto: PreviewValuationBatchDto,
    actor: ProjectActorContext,
  ) {
    return this.ds.transaction(async (m) => {
      const project = await this.project(m, p, actor, true);
      const fingerprint = hash(canonical({ actor: actor.id, request: dto }));
      const existing = await m.getRepository(ValuationBatch).findOneBy({
        projectId: p,
        organizationId: project.organizationId,
        commandKey: dto.command_key,
      });
      if (existing) {
        if (existing.fingerprint !== fingerprint)
          conflict('Chave idempotente já utilizada por outro conteúdo/ator.');
        return this.response(m, existing);
      }
      const items = await this.selected(m, project, dto.selection, true);
      if (dto.mode === 'individual') {
        const ids = dto.values?.map((v) => v.inventory_item_id) ?? [];
        if (
          ids.length !== items.length ||
          new Set(ids).size !== ids.length ||
          ids.some((id) => !items.some((i) => i.id === id))
        )
          throw new BadRequestException(
            'Valores individualizados devem corresponder exatamente aos itens selecionados, sem duplicação.',
          );
      } else if (dto.values?.length)
        throw new BadRequestException(
          'Valores individualizados não são aceitos no modo comum.',
        );
      const rows: Array<{
        snapshot: ValuationItemSnapshot;
        proposed: ReturnType<typeof valuationValues>;
      }> = [];
      for (const item of items) {
        const values =
          dto.mode === 'individual'
            ? dto.values!.find((v) => v.inventory_item_id === item.id)
            : null;
        rows.push({
          snapshot: await this.snapshot(m, item),
          proposed: valuationValues({
            ...dto.common,
            ...(values
              ? {
                  new_value: values.new_value ?? null,
                  used_value: values.used_value ?? null,
                }
              : {}),
          }),
        });
      }
      const previewHash = hash(rows);
      const batch = await m.getRepository(ValuationBatch).save({
        organizationId: project.organizationId,
        projectId: p,
        commandKey: dto.command_key,
        fingerprint,
        previewHash,
        request: dto,
        status: 'preview',
        revision: 1,
        total: rows.length,
        createdById: actor.id,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
      });
      await m.getRepository(ValuationBatchRow).save(
        rows.map((row) => ({
          batchId: batch.id,
          organizationId: project.organizationId,
          projectId: p,
          inventoryItemId: row.snapshot.id,
          ...row,
          valuationId: null,
        })),
      );
      return this.response(m, batch);
    });
  }
  private async response(m: EntityManager, batch: ValuationBatch) {
    const rows = await m.getRepository(ValuationBatchRow).find({
      where: {
        batchId: batch.id,
        projectId: batch.projectId,
        organizationId: batch.organizationId,
      },
      order: { inventoryItemId: 'ASC' },
    });
    const project = await m
      .getRepository(ProjectEntity)
      .findOneByOrFail({ id: batch.projectId });
    return {
      ...batch,
      project: { id: project.id, name: project.name },
      items: rows.map((row) => ({
        ...row,
        status: batch.status === 'applied' ? 'approved' : 'preview',
        error: null,
      })),
      summary: {
        total_requested: batch.total,
        total_processed: batch.status === 'applied' ? batch.total : 0,
        total_approved: batch.status === 'applied' ? batch.total : 0,
        total_rejected: 0,
        errors: [],
      },
      expired: batch.expiresAt.getTime() < Date.now(),
    };
  }
  async confirm(
    p: number,
    id: number,
    dto: ConfirmValuationBatchDto,
    actor: ProjectActorContext,
  ) {
    return this.ds.transaction(async (m) => {
      const project = await this.project(m, p, actor, true);
      const batch = await m.getRepository(ValuationBatch).findOneBy({
        id,
        projectId: p,
        organizationId: project.organizationId,
      });
      if (!batch)
        throw new NotFoundException('Operação não encontrada neste projeto.');
      if (batch.createdById !== actor.id)
        throw new ForbiddenException(
          'Somente o autor da prévia pode confirmá-la.',
        );
      if (
        dto.command_key !== batch.commandKey ||
        dto.preview_hash !== batch.previewHash ||
        dto.revision !== 1
      )
        conflict('Confirmação não corresponde à prévia original.');
      if (batch.status === 'applied') return this.response(m, batch);
      if (
        batch.status !== 'preview' ||
        batch.revision !== dto.revision ||
        batch.expiresAt.getTime() < Date.now()
      )
        conflict('Prévia expirada ou já modificada. Gere outra prévia.');
      const current = await this.selected(
        m,
        project,
        batch.request.selection,
        true,
      );
      const rows = await m.getRepository(ValuationBatchRow).find({
        where: {
          batchId: id,
          projectId: p,
          organizationId: project.organizationId,
        },
        order: { inventoryItemId: 'ASC' },
      });
      if (
        current.length !== rows.length ||
        current.some((item, index) => item.id !== rows[index].inventoryItemId)
      )
        conflict(
          'Seleção dos filtros mudou desde a prévia. Gere outra prévia.',
          [],
          batch.total,
        );
      const errors: unknown[] = [];
      for (let n = 0; n < current.length; n++)
        if (
          (await this.snapshot(m, current[n])).version !==
          rows[n].snapshot.version
        )
          errors.push({
            inventory_item_id: current[n].id,
            reason: 'Cadastro ou histórico de avaliação mudou após a prévia.',
          });
      if (errors.length)
        conflict(
          'Fontes obsoletas; nada foi gravado. Gere uma nova prévia.',
          errors,
          batch.total,
        );
      for (let n = 0; n < current.length; n++) {
        const proposed = rows[n].proposed;
        let valuation: AssetValuationEntity;
        try {
          valuation = await this.operations.recordValuation(
            m,
            project,
            current[n],
            {
              source: proposed.source,
              valuation_date: proposed.valuationDate,
              new_value: proposed.newValue,
              used_value: proposed.usedValue,
              notes: proposed.notes,
            },
            actor,
            batch.id,
          );
        } catch {
          throw new HttpException(
            {
              code: 'VALUATION_BATCH_APPLY_FAILED',
              message:
                'Falha ao registrar um item. A operação inteira foi revertida.',
              details: {
                summary: {
                  total_requested: batch.total,
                  total_processed: 0,
                  total_approved: 0,
                  total_rejected: batch.total,
                },
                errors: [
                  {
                    inventory_item_id: current[n].id,
                    reason:
                      'Falha de gravação; nenhuma avaliação deste lote foi mantida. Tente novamente ou consulte o suporte.',
                  },
                ],
              },
            },
            500,
          );
        }
        await m
          .getRepository(ValuationBatchRow)
          .update(rows[n].id, { valuationId: valuation.id });
      }
      const changed = await m.getRepository(ValuationBatch).update(
        { id, revision: 1, status: 'preview' },
        {
          status: 'applied',
          revision: 2,
          confirmedById: actor.id,
          confirmedAt: new Date(),
        },
      );
      if (!changed.affected)
        conflict('Outra confirmação venceu a concorrência.');
      return this.response(
        m,
        await m.getRepository(ValuationBatch).findOneByOrFail({ id }),
      );
    });
  }
  async list(
    p: number,
    q: InventoryOperationListQueryDto,
    actor: ProjectActorContext,
  ) {
    const project = await this.project(this.ds.manager, p, actor);
    const [items, total] = await this.ds
      .getRepository(ValuationBatch)
      .findAndCount({
        where: { projectId: p, organizationId: project.organizationId },
        order: { id: 'DESC' },
        skip: (q.page - 1) * q.page_size,
        take: q.page_size,
      });
    return {
      items,
      total,
      page: q.page,
      page_size: q.page_size,
      limit: this.limit,
    };
  }
  async get(p: number, id: number, actor: ProjectActorContext) {
    const project = await this.project(this.ds.manager, p, actor);
    const batch = await this.ds
      .getRepository(ValuationBatch)
      .findOneBy({ id, projectId: p, organizationId: project.organizationId });
    if (!batch)
      throw new NotFoundException('Operação não encontrada neste projeto.');
    return this.response(this.ds.manager, batch);
  }
}
