import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager, In } from 'typeorm';
import { UserEntity } from '../auth/infrastructure/persistence/user.entity';
import {
  ProjectScopeService,
  type ProjectActorContext,
} from '../projects/application/services/project-scope.service';
import type {
  FinanceSettingsOverviewResponse,
  FinanceSettingsValuesDto,
  FinanceSettingsVersionResponse,
  PublishFinanceSettingsDto,
} from './finance-settings.dto';
import { FinanceSettingsVersionEntity } from './finance-settings.entity';
import {
  assertNewVersionStart,
  civilToday,
  defaultFinanceSettingsValues,
  invalid,
  missingSettings,
  normalizeFinanceSettingsValues,
  versionInForce,
} from './finance-settings.policy';

const PLATFORM_UPLOAD_CEILING = 100 * 1024 * 1024;

@Injectable()
export class FinanceSettingsService {
  constructor(
    private readonly ds: DataSource,
    private readonly scope: ProjectScopeService,
  ) {}

  /** Teto de upload da plataforma (variável de ambiente do armazenamento). */
  platformMaxUploadBytes(): number {
    const value = Number(process.env.STORAGE_MAX_SIZE_BYTES);
    return Number.isSafeInteger(value) && value > 0
      ? Math.min(value, PLATFORM_UPLOAD_CEILING)
      : PLATFORM_UPLOAD_CEILING;
  }

  private org(actor: ProjectActorContext, requested?: number): number {
    const id = this.scope.resolveOrganizationFilter(actor, requested);
    if (id == null) invalid('Informe uma organização para esta operação.');
    return id;
  }

  private async versions(m: EntityManager, organizationId: number) {
    return m.find(FinanceSettingsVersionEntity, {
      where: { organizationId },
      order: { version: 'DESC' },
    });
  }

  private async present(
    m: EntityManager,
    rows: FinanceSettingsVersionEntity[],
  ): Promise<FinanceSettingsVersionResponse[]> {
    const actorIds = [
      ...new Set(rows.map((row) => row.actorId).filter((id) => id != null)),
    ];
    const users = actorIds.length
      ? await m.find(UserEntity, {
          where: { id: In(actorIds) },
          select: { id: true, fullName: true, login: true },
        })
      : [];
    const names = new Map(
      users.map((user) => [Number(user.id), user.fullName ?? user.login]),
    );
    return rows.map((row) => ({
      id: row.id,
      organization_id: row.organizationId,
      version: row.version,
      valid_from: row.validFrom,
      values: row.values,
      reason: row.reason,
      actor_id: row.actorId,
      actor_name: row.actorId == null ? null : (names.get(row.actorId) ?? null),
      recorded_at: row.recordedAt.toISOString(),
    }));
  }

  defaults(): FinanceSettingsValuesDto {
    return defaultFinanceSettingsValues();
  }

  async overview(
    actor: ProjectActorContext,
    requested?: number,
  ): Promise<FinanceSettingsOverviewResponse> {
    const organizationId = this.org(actor, requested);
    const today = civilToday();
    const m = this.ds.manager;
    const rows = await this.versions(m, organizationId);
    const presented = await this.present(m, rows);
    const current = versionInForce(rows, today);
    const scheduled = rows.find((row) => row.validFrom > today) ?? null;
    const byId = new Map(presented.map((row) => [row.id, row]));
    return {
      organization_id: organizationId,
      today,
      current: current ? byId.get(current.id)! : null,
      scheduled: scheduled ? byId.get(scheduled.id)! : null,
      versions: presented,
      platform_max_upload_bytes: this.platformMaxUploadBytes(),
    };
  }

  async publish(
    dto: PublishFinanceSettingsDto,
    actor: ProjectActorContext,
    requested?: number,
  ): Promise<FinanceSettingsVersionResponse> {
    const organizationId = this.org(actor, requested);
    const values = normalizeFinanceSettingsValues(
      dto.values,
      this.platformMaxUploadBytes(),
    );
    const reason = dto.reason.trim();
    if (reason.length < 5)
      invalid('Justificativa deve ter pelo menos cinco caracteres.');
    return this.ds.transaction(async (m) => {
      await this.lockOrganization(m, organizationId);
      const previous = await this.versions(m, organizationId);
      const latest = previous.reduce<string | null>(
        (max, row) =>
          max === null || row.validFrom > max ? row.validFrom : max,
        null,
      );
      assertNewVersionStart(dto.valid_from, latest, civilToday());
      const saved = await m.save(
        FinanceSettingsVersionEntity,
        m.create(FinanceSettingsVersionEntity, {
          organizationId,
          version: (previous[0]?.version ?? 0) + 1,
          validFrom: dto.valid_from,
          values,
          reason,
          actorId: actor.id,
          recordedAt: new Date(),
        }),
      );
      return (await this.present(m, [saved]))[0];
    });
  }

  /**
   * Valores vigentes na data do fato. Usado pelos outros módulos; falha se a
   * organização não tiver parâmetros (nenhum cálculo usa constante de reserva).
   */
  async valuesAt(
    organizationId: number,
    date: string = civilToday(),
    m: EntityManager = this.ds.manager,
  ): Promise<FinanceSettingsValuesDto> {
    const version = versionInForce(
      await this.versions(m, organizationId),
      date,
    );
    if (!version) missingSettings();
    return version.values;
  }

  private async lockOrganization(m: EntityManager, id: number) {
    if (this.ds.options.type !== 'mysql') return;
    const rows = await m.query<{ id: number }[]>(
      'SELECT id FROM organizations WHERE id = ? FOR UPDATE',
      [id],
    );
    if (!rows.length) invalid('Organização não encontrada.');
  }
}
