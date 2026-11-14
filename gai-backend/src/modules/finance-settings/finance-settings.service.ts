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
  assertCutoff,
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

  /** Valores sugeridos; o corte da DRE segue o início informado. */
  defaults(validFrom?: string): FinanceSettingsValuesDto {
    return defaultFinanceSettingsValues(validFrom);
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
      earliest_fact_date: await this.earliestFactDate(m, organizationId),
      coverage_start: rows.length
        ? rows.map((row) => row.validFrom).sort()[0]
        : null,
      current: current ? byId.get(current.id)! : null,
      scheduled: scheduled ? byId.get(scheduled.id)! : null,
      versions: presented,
      platform_max_upload_bytes: this.platformMaxUploadBytes(),
    };
  }

  /**
   * Data do lançamento financeiro mais antigo da organização (contrato, diária,
   * despesa, placa ou comissão): é a sugestão de "vale a partir de" para que
   * nenhum lançamento fique sem parâmetro vigente.
   */
  async earliestFactDate(
    m: EntityManager,
    organizationId: number,
  ): Promise<string | null> {
    const dates: string[] = [];
    const civil = (v: unknown) =>
      v instanceof Date
        ? v.toISOString().slice(0, 10)
        : typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v)
          ? v.slice(0, 10)
          : null;
    for (const [table, column] of [
      ['field_agent_payments', 'start_date'],
      ['expenses', 'expense_date'],
      ['asset_tag_orders', 'ordered_on'],
      ['commissions', 'expected_payment_on'],
      ['commissions', 'paid_on'],
    ] as const) {
      const rows = await m.query<Array<{ d: unknown }>>(
        `SELECT MIN(${column}) AS d FROM ${table} WHERE organization_id = ? AND deleted_at IS NULL`,
        [organizationId],
      );
      const d = civil(rows[0]?.d);
      if (d) dates.push(d);
    }
    // Data do contrato fica no JSON: lida em memória (poucos por organização).
    const contracts = await m.query<Array<{ data: unknown }>>(
      'SELECT data FROM project_contracts WHERE organization_id = ?',
      [organizationId],
    );
    for (const row of contracts) {
      const data = (
        typeof row.data === 'string'
          ? (JSON.parse(row.data) as unknown)
          : row.data
      ) as { contracted_on?: string | null } | null;
      const d = civil(data?.contracted_on);
      if (d) dates.push(d);
    }
    return dates.sort()[0] ?? null;
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
      const closed = await m.query<Array<{ month: string }>>(
        'SELECT month FROM dre_periods WHERE organization_id = ? AND closed = ?',
        [organizationId, true],
      );
      assertNewVersionStart(
        dto.valid_from,
        previous.map((row) => row.validFrom),
        civilToday(),
        closed.map((row) => row.month),
      );
      assertCutoff(
        values.dre_regime_cutoff_month,
        dto.valid_from,
        previous.map((row) => ({
          validFrom: row.validFrom,
          cutoff: row.values.dre_regime_cutoff_month,
        })),
        closed.map((row) => row.month),
      );
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
