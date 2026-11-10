import { BadRequestException, Injectable } from '@nestjs/common';
import { DataSource, In } from 'typeorm';
import type { AuthenticatedUser } from '../auth/presentation/guards/session-auth.guard';
import { UserEntity } from '../auth/infrastructure/persistence/user.entity';
import { FieldAgentEntity } from '../field-agents/infrastructure/persistence/field-agent.entity';
import { InventoryItemScopeService } from '../inventory-items/application/services/inventory-item-scope.service';
import { InventoryItemStatus } from '../inventory-items/domain/enums/inventory-item-status.enum';
import { InventoryItemEntity } from '../inventory-items/infrastructure/persistence/inventory-item.entity';
import {
  MobilePlateCheckQueryDto,
  MobilePlateReportQueryDto,
} from './dto/mobile-operations.dto';
import { MobileAccessService } from './mobile-access.service';

const MAX_GAP_SPAN = 1_000_000;
const COLUMNS = [
  'item.id',
  'item.externalItemId',
  'item.syncSeq',
  'item.newPlate',
  'item.oldPlate',
  'item.oldPlate2',
  'item.unitText',
  'item.locationText',
  'item.description',
  'item.createdById',
  'item.createdAt',
];

type Technician = {
  user_id: number;
  name: string | null;
  field_agent_id: number | null;
};

/**
 * Read-only plate diagnostics for the app (legacy "Pendências" and
 * check_duplicate). Only live items of an authorized project count; plates use
 * the same normalization as the rest of the GAI (uppercase, [A-Z0-9]).
 */
@Injectable()
export class MobilePlatesService {
  constructor(
    private readonly db: DataSource,
    private readonly access: MobileAccessService,
    private readonly scope: InventoryItemScopeService,
  ) {}

  async check(
    actor: AuthenticatedUser,
    projectId: number,
    query: MobilePlateCheckQueryDto,
  ) {
    await this.access.assertProject(actor, projectId, false);
    const plate = this.scope.normalizePlate(query.plate);
    if (!plate)
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Informe uma placa com letras ou números.',
      });
    const kind = query.kind ?? 'any';
    const qb = this.live(projectId);
    if (kind === 'new') qb.andWhere('item.newPlate = :plate', { plate });
    else if (kind === 'old')
      qb.andWhere('(item.oldPlate = :plate OR item.oldPlate2 = :plate)', {
        plate,
      });
    else
      qb.andWhere(
        '(item.newPlate = :plate OR item.oldPlate = :plate OR item.oldPlate2 = :plate)',
        { plate },
      );
    if (query.exclude_external_id)
      qb.andWhere(
        '(item.externalItemId IS NULL OR item.externalItemId <> :exclude)',
        {
          exclude: query.exclude_external_id,
        },
      );
    const rows = await qb.orderBy('item.id', 'ASC').take(20).getMany();
    const technicians = await this.technicians(actor.organizationId, rows);
    return {
      plate,
      kind,
      exists: rows.length > 0,
      matches: rows.map((row) => ({
        ...this.view(row, technicians),
        matched_fields: [
          row.newPlate === plate ? 'new_plate' : null,
          row.oldPlate === plate ? 'old_plate' : null,
          row.oldPlate2 === plate ? 'old_plate_2' : null,
        ].filter(Boolean),
      })),
    };
  }

  async report(
    actor: AuthenticatedUser,
    projectId: number,
    query: MobilePlateReportQueryDto,
  ) {
    await this.access.assertProject(actor, projectId, false);
    const rows = await this.live(projectId).orderBy('item.id', 'ASC').getMany();
    const byNew = new Map<string, InventoryItemEntity[]>();
    const byOld = new Map<string, InventoryItemEntity[]>();
    const numbers = new Set<number>();
    let nonNumeric = 0;
    for (const row of rows) {
      if (row.newPlate) {
        byNew.set(row.newPlate, [...(byNew.get(row.newPlate) ?? []), row]);
        if (/^\d{1,15}$/.test(row.newPlate)) numbers.add(Number(row.newPlate));
        else nonNumeric += 1;
      }
      for (const old of new Set(
        [row.oldPlate, row.oldPlate2].filter(Boolean) as string[],
      ))
        byOld.set(old, [...(byOld.get(old) ?? []), row]);
    }
    const sorted = [...numbers].sort((a, b) => a - b);
    const from = query.from ?? sorted[0] ?? null;
    const to = query.to ?? sorted[sorted.length - 1] ?? null;
    if (from !== null && to !== null && (to < from || to - from > MAX_GAP_SPAN))
      throw new BadRequestException({
        code: 'PLATE_RANGE_INVALID',
        message: `Faixa inválida (máximo ${MAX_GAP_SPAN} placas).`,
      });
    const missing =
      from === null || to === null
        ? { ranges: [], count: 0 }
        : this.gaps(numbers, from, to);
    const duplicated = (map: Map<string, InventoryItemEntity[]>) =>
      [...map.entries()]
        .filter(([, items]) => items.length > 1)
        .sort(([a], [b]) => a.localeCompare(b, 'en', { numeric: true }));
    const dupNew = duplicated(byNew);
    const dupOld = duplicated(byOld);
    const technicians = await this.technicians(
      actor.organizationId,
      [...dupNew, ...dupOld].flatMap(([, items]) => items),
    );
    return {
      project_id: projectId,
      generated_at: new Date().toISOString(),
      totals: {
        items: rows.length,
        with_new_plate: [...byNew.values()].reduce(
          (sum, items) => sum + items.length,
          0,
        ),
        numeric_new_plates: numbers.size,
        non_numeric_new_plates: nonNumeric,
      },
      missing_new_plates: {
        from,
        to,
        count: missing.count,
        ranges: missing.ranges,
      },
      duplicated_new_plates: dupNew.map(([plate, items]) => ({
        plate,
        items: items.map((item) => this.view(item, technicians)),
      })),
      duplicated_old_plates: dupOld.map(([plate, items]) => ({
        plate,
        items: items.map((item) => this.view(item, technicians)),
      })),
    };
  }

  /** Missing numbers in [from, to] as compact ranges ("5", "11-27"). */
  private gaps(present: Set<number>, from: number, to: number) {
    const ranges: string[] = [];
    let count = 0;
    let start: number | null = null;
    for (let n = from; n <= to + 1; n++) {
      const missing = n <= to && !present.has(n);
      if (missing) {
        count += 1;
        if (start === null) start = n;
      } else if (start !== null) {
        ranges.push(start === n - 1 ? String(start) : `${start}-${n - 1}`);
        start = null;
      }
    }
    return { ranges, count };
  }

  private live(projectId: number) {
    return this.db
      .getRepository(InventoryItemEntity)
      .createQueryBuilder('item')
      .select(COLUMNS)
      .where('item.projectId = :projectId', { projectId })
      .andWhere('item.deletedAt IS NULL')
      .andWhere('item.status NOT IN (:...gone)', {
        gone: [InventoryItemStatus.INACTIVE, InventoryItemStatus.REMOVED],
      });
  }

  private async technicians(
    organizationId: number | null,
    rows: InventoryItemEntity[],
  ) {
    const ids = [
      ...new Set(
        rows.map((r) => r.createdById).filter((id): id is number => !!id),
      ),
    ];
    const map = new Map<number, Technician>();
    if (!ids.length || !organizationId) return map;
    const users = await this.db.getRepository(UserEntity).find({
      where: { id: In(ids), organizationId },
      select: ['id', 'fullName'],
    });
    const agents = await this.db.getRepository(FieldAgentEntity).find({
      where: { userId: In(ids), organizationId },
      withDeleted: true,
      select: ['id', 'userId', 'name'],
    });
    for (const user of users) {
      const agent = agents.find((a) => Number(a.userId) === Number(user.id));
      map.set(Number(user.id), {
        user_id: Number(user.id),
        name: agent?.name ?? user.fullName ?? null,
        field_agent_id: agent ? Number(agent.id) : null,
      });
    }
    return map;
  }

  private view(
    item: InventoryItemEntity,
    technicians: Map<number, Technician>,
  ) {
    return {
      id: Number(item.id),
      external_item_id: item.externalItemId,
      version: item.syncSeq,
      new_plate: item.newPlate,
      old_plate: item.oldPlate,
      old_plate_2: item.oldPlate2,
      unit_text: item.unitText,
      location_text: item.locationText,
      description: item.description,
      technician: item.createdById
        ? (technicians.get(Number(item.createdById)) ?? null)
        : null,
      created_at: item.createdAt?.toISOString() ?? null,
    };
  }
}
