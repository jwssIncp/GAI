import {
  Injectable,
  Inject,
  BadRequestException,
  ForbiddenException,
  PayloadTooLargeException,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  EntityManager,
  EntityTarget,
  In,
  ObjectLiteral,
  QueryFailedError,
} from 'typeorm';
import { ProjectEntity } from '../projects/infrastructure/persistence/project.entity';
import { CompanyEntity } from '../companies/infrastructure/persistence/company.entity';
import { ProjectUnitEntity } from '../companies/infrastructure/persistence/project-unit.entity';
import { CompanyUnitEntity } from '../companies/infrastructure/persistence/company-unit.entity';
import { InventoryItemEntity } from '../inventory-items/infrastructure/persistence/inventory-item.entity';
import { InventoryAccountingItemEntity } from '../inventory-accounting-items/infrastructure/persistence/inventory-accounting-item.entity';
import {
  InventorySessionEntity,
  InventoryObservationEntity,
  InventoryReconciliationEntity,
  InventoryConsolidationEntity,
  AssetValuationEntity,
} from '../inventory-operations/infrastructure/persistence/inventory-operation.entity';
import { ValuationBatch } from '../inventory-operations/infrastructure/persistence/valuation-batch.entity';
import {
  ReconciliationStatus,
  ConsolidationDecision,
} from '../inventory-operations/domain/inventory-operation.enums';
import {
  AssistedRun,
  AssistedDecision,
} from '../assisted-reconciliation/assisted.entity';
import { InventoryPendingIssueEntity } from '../inventory-pending-issues/infrastructure/persistence/inventory-pending-issue.entity';
import {
  PERMISSION_RESOLVER,
  type PermissionResolver,
} from '../auth/domain/ports/permission-resolver.port';
import { hasAllPermissions } from '../auth/application/services/permission-access';
import { ProjectActorContext } from '../projects/application/services/project-scope.service';
import { documentHash as hash } from './report.hash';
import { Family, SourceSelectionDto } from './report.dto';
import { Cell, ReportSources, SourceTable } from './report.entity';
// The renderer accepts 3 MiB. Reserve space for authored text/visual metadata;
// source extraction has its own bounded working set and never returns a prefix.
export const REPORT_SOURCE_PAGE_SIZE = 250;
export const REPORT_SOURCE_WORK_BYTES = 4 * 1024 * 1024;
export const REPORT_SOURCE_SNAPSHOT_BYTES = 2 * 1024 * 1024;
export const REPORT_SOURCE_TIMEOUT_MS = 15000;
export const SOURCE_PERMISSIONS: Record<Family, string[]> = {
  identity: ['projects:read', 'companies:read'],
  units: ['project-units:read', 'company-units:read'],
  inventory: ['inventory-items:read'],
  accounting: ['inventory-accounting-items:read'],
  observations: ['inventory-sessions:read'],
  reconciliation: ['reconciliations:read', 'assisted-reconciliation:read'],
  valuation: ['asset-valuations:read'],
  issues: ['inventory-pending-issues:read'],
};
export function reportInvalid(message: string): never {
  throw new BadRequestException({ code: 'TECHNICAL_REPORT_INVALID', message });
}
function civil(value: Date | string | null) {
  return value instanceof Date ? value.toISOString().slice(0, 10) : value;
}
@Injectable()
export class ReportSourcesService {
  constructor(
    @Inject(PERMISSION_RESOLVER) private readonly resolver: PermissionResolver,
  ) {}
  async require(actor: ProjectActorContext, keys: string[]) {
    if (!(await hasAllPermissions(actor, keys, this.resolver)))
      throw new ForbiddenException(
        'Permissões insuficientes para as fontes do laudo.',
      );
  }
  async capture(
    m: EntityManager,
    p: ProjectEntity,
    selection: SourceSelectionDto,
    actor: ProjectActorContext,
  ): Promise<ReportSources> {
    if (!m.queryRunner?.isTransactionActive)
      reportInvalid('Extração exige uma transação de leitura consistente.');
    const started = performance.now();
    let workBytes = 0;
    const check = () => {
      if (performance.now() - started > REPORT_SOURCE_TIMEOUT_MS)
        throw new ServiceUnavailableException({
          code: 'TECHNICAL_REPORT_SOURCE_TIMEOUT',
          message:
            'Extração excedeu 15 segundos. Nenhum snapshot parcial foi salvo. Refine as famílias selecionadas ou tente novamente.',
        });
    };
    const capacity = () => {
      if (workBytes > REPORT_SOURCE_WORK_BYTES)
        throw new PayloadTooLargeException({
          code: 'TECHNICAL_REPORT_SOURCE_LIMIT',
          message:
            'Fontes excedem 4 MiB de processamento síncrono. Nenhum snapshot parcial foi salvo. Refine as famílias ou selecione um lote de avaliação.',
        });
      check();
    };
    const families = [
        ...new Set<Family>(['identity', ...selection.families]),
      ].sort(),
      permissions = [
        ...new Set(families.flatMap((f) => SOURCE_PERMISSIONS[f])),
      ];
    await this.require(actor, permissions);
    const org = Number(p.organizationId),
      project = Number(p.id),
      tables: SourceTable[] = [],
      fields: Record<string, string | null> = {
        'project.name': p.name,
        'project.id': String(project),
        'project.status': p.status,
      },
      metrics: Record<string, string | number | null> = {},
      missing: string[] = [];
    const scoped = async <T extends ObjectLiteral>(
      entity: EntityTarget<T>,
      session = false,
      batchId?: number,
    ) => {
      const q = m
        .getRepository(entity)
        .createQueryBuilder('s')
        .where('s.organizationId=:org AND s.projectId=:project', {
          org,
          project,
        })
        .orderBy('s.id', 'ASC');
      if (session)
        q.andWhere('s.sessionId=:session', { session: selection.session_id });
      if (batchId) q.andWhere('s.batchOperationId=:batchId', { batchId });
      // All reads use the caller's REPEATABLE READ snapshot. Locking SELECTs
      // would read the latest committed state instead and mix source versions.
      let expected: number;
      if (m.connection.options.type === 'mysql') {
        // Size on the server before materializing even the first page. A fixed
        // row page alone cannot bound memory when a JSON/TEXT value is large.
        // JSON_OBJECT includes string escaping; 64 bytes/row covers driver
        // timestamp/boolean/numeric representation differences conservatively.
        const values = q.expressionMap
          .mainAlias!.metadata.columns.filter((column) => column.isSelect)
          .flatMap((column) => [
            `'${column.propertyName.replaceAll("'", "''")}'`,
            `${q.escape('s')}.${q.escape(column.databaseName)}`,
          ])
          .join(', ');
        try {
          const estimate = await q
            .clone()
            .orderBy()
            .select('COUNT(*)', 'source_count')
            .addSelect(
              `COALESCE(SUM(OCTET_LENGTH(JSON_OBJECT(${values})) + 64), 0)`,
              'source_bytes',
            )
            .maxExecutionTime(REPORT_SOURCE_TIMEOUT_MS)
            .getRawOne<{ source_count: string; source_bytes: string }>();
          expected = Number(estimate!.source_count);
          if (
            Number(estimate!.source_bytes) + workBytes >
            REPORT_SOURCE_WORK_BYTES
          ) {
            workBytes = REPORT_SOURCE_WORK_BYTES + 1;
            capacity();
          }
        } catch (error) {
          if (
            error instanceof QueryFailedError &&
            (error.driverError as { errno?: number }).errno === 3024
          )
            throw new ServiceUnavailableException({
              code: 'TECHNICAL_REPORT_SOURCE_TIMEOUT',
              message:
                'Consulta de fontes excedeu 15 segundos. Nenhum snapshot parcial foi salvo.',
            });
          throw error;
        }
      } else expected = await q.getCount();
      const rows: T[] = [];
      let cursor = '0';
      while (true) {
        check();
        const page = await q
          .clone()
          .andWhere('s.id > :cursor', { cursor })
          .take(REPORT_SOURCE_PAGE_SIZE)
          .getMany();
        if (!page.length) break;
        for (const row of page) {
          workBytes += Buffer.byteLength(JSON.stringify(row));
          capacity();
          rows.push(row);
        }
        cursor = String(page[page.length - 1].id);
        if (page.length < REPORT_SOURCE_PAGE_SIZE) break;
      }
      if (rows.length !== expected)
        reportInvalid(
          'Contagem de fonte inconsistente. Nenhum snapshot parcial foi salvo.',
        );
      return rows;
    };
    const table = (
      family: Family,
      columns: string[],
      rows: Cell[][],
      references: object[],
    ) => {
      tables.push({
        family,
        columns,
        rows,
        references: references.map((r) => ({
          id: Number((r as { id: number }).id),
          entity: r.constructor.name,
          version: hash(r),
        })),
        hash: hash({ rows, references }),
      });
    };
    const company = p.companyId
      ? await m.findOneBy(CompanyEntity, {
          id: p.companyId,
          organizationId: org,
        })
      : null;
    if (!company) missing.push('company');
    fields['company.name'] = company?.name ?? null;
    fields['company.id'] = company ? String(company.id) : null;
    fields['company.document'] = company?.document ?? null;
    const identity = {
      id: project,
      project_name: p.name,
      status: p.status,
      start_date: p.startDate,
      end_date: p.endDate,
      updated_at: p.updatedAt,
      company: company
        ? {
            id: Number(company.id),
            name: company.name,
            document: company.document,
            updated_at: company.updatedAt,
          }
        : null,
    };
    table(
      'identity',
      ['Projeto ID', 'Projeto', 'Empresa', 'Documento', 'Início', 'Fim'],
      [
        [
          project,
          p.name,
          company?.name ?? null,
          company?.document ?? null,
          p.startDate ? String(p.startDate) : null,
          p.endDate ? String(p.endDate) : null,
        ],
      ],
      company ? [identity, company] : [identity],
    );
    let session: InventorySessionEntity | null = null;
    if (
      families.includes('observations') ||
      families.includes('reconciliation')
    ) {
      if (!selection.session_id)
        reportInvalid(
          'Selecione uma sessão explícita para observações/conciliação.',
        );
      session = await m.findOneBy(InventorySessionEntity, {
        id: selection.session_id,
        projectId: project,
        organizationId: org,
      });
      if (!session) reportInvalid('Sessão não pertence ao projeto.');
    }
    let unresolved: number | null = null;
    for (const f of families) {
      if (f === 'units') {
        const links = await scoped(ProjectUnitEntity),
          rows: Cell[][] = [],
          refs: object[] = [];
        for (
          let offset = 0;
          offset < links.length;
          offset += REPORT_SOURCE_PAGE_SIZE
        ) {
          const page = links.slice(offset, offset + REPORT_SOURCE_PAGE_SIZE);
          const units = await m.find(CompanyUnitEntity, {
            where: {
              id: In(page.map((link) => link.companyUnitId)),
              organizationId: org,
              companyId: p.companyId ?? 0,
            },
            select: ['id', 'name', 'code', 'status', 'updatedAt'],
          });
          workBytes += Buffer.byteLength(JSON.stringify(units));
          capacity();
          const byId = new Map(units.map((unit) => [String(unit.id), unit]));
          for (const l of page) {
            const u = byId.get(String(l.companyUnitId));
            if (!u) {
              missing.push('unit:' + l.companyUnitId);
              continue;
            }
            rows.push([Number(l.id), Number(u.id), u.name, u.code, u.status]);
            refs.push({
              ...l,
              unit: {
                id: Number(u.id),
                name: u.name,
                code: u.code,
                status: u.status,
                updatedAt: u.updatedAt,
              },
            });
          }
        }
        table(
          f,
          ['Vínculo ID', 'Unidade ID', 'Unidade', 'Código', 'Situação'],
          rows,
          refs,
        );
        metrics['units.count'] = rows.length;
      }
      if (f === 'inventory') {
        const rs = await scoped(InventoryItemEntity);
        table(
          f,
          [
            'Item ID',
            'Placa original',
            'Placa atual',
            'Descrição',
            'Unidade informada',
            'Local',
            'Situação',
          ],
          rs.map((r) => [
            Number(r.id),
            r.oldPlate,
            r.newPlate,
            r.description,
            r.unitText,
            r.locationText,
            r.status,
          ]),
          rs,
        );
        metrics['inventory.count'] = rs.length;
      }
      if (f === 'accounting') {
        const rs = await scoped(InventoryAccountingItemEntity);
        table(
          f,
          [
            'Contábil ID',
            'Placa',
            'Descrição',
            'Conta',
            'Valor de aquisição (moeda da origem não informada)',
            'Situação',
          ],
          rs.map((r) => [
            Number(r.id),
            r.plate,
            r.description,
            r.accountingAccountDescription,
            r.acquisitionValue,
            r.status,
          ]),
          rs,
        );
        metrics['accounting.count'] = rs.length;
      }
      if (f === 'observations') {
        const rs = await scoped(InventoryObservationEntity, true);
        table(
          f,
          [
            'Observação ID',
            'Item ID',
            'Rodada ID',
            'Resultado',
            'Placa observada',
            'Local',
            'Captura',
            'Notas',
          ],
          rs.map((r) => [
            Number(r.id),
            Number(r.inventoryItemId),
            Number(r.roundId),
            r.result,
            r.observedPlate,
            r.locationText,
            new Date(r.capturedAt).toISOString(),
            r.notes,
          ]),
          [...rs, session!],
        );
        metrics['observations.count'] = rs.length;
        metrics['observations.distinct_items'] = new Set(
          rs.map((r) => String(r.inventoryItemId)),
        ).size;
      }
      if (f === 'reconciliation') {
        const all = await scoped(InventoryReconciliationEntity, true),
          run = all.reduce((latest, r) => Math.max(latest, r.runNumber), 0),
          rs = all.filter((r) => r.runNumber === run),
          cons = await scoped(InventoryConsolidationEntity, true),
          decisions = await scoped(AssistedDecision, true),
          runs = await scoped(AssistedRun, true);
        const by = new Map(cons.map((c) => [String(c.reconciliationId), c]));
        unresolved = rs.filter((r) => {
          const decision = by.get(String(r.id))?.decision;
          return r.status === ReconciliationStatus.MATCHED
            ? decision === ConsolidationDecision.REJECTED
            : decision !== ConsolidationDecision.ACCEPTED &&
                decision !== ConsolidationDecision.CORRECTED;
        }).length;
        table(
          f,
          [
            'Conciliação ID',
            'Execução',
            'Item ID',
            'Contábil ID',
            'Situação',
            'Decisão',
            'Notas da consolidação',
          ],
          rs.map((r) => [
            Number(r.id),
            r.runNumber,
            r.inventoryItemId ? Number(r.inventoryItemId) : null,
            r.accountingItemId ? Number(r.accountingItemId) : null,
            r.status,
            by.get(String(r.id))?.decision ?? null,
            by.get(String(r.id))?.notes ?? null,
          ]),
          [...all, ...cons, ...decisions, ...runs, session!],
        );
        metrics['reconciliation.count'] = rs.length;
        metrics['reconciliation.run'] = run;
        metrics['reconciliation.unresolved'] = unresolved;
        if (!rs.length) missing.push('reconciliation');
      }
      if (f === 'valuation') {
        let batch: ValuationBatch | null = null;
        if (selection.valuation_batch_id) {
          batch = await m.findOneBy(ValuationBatch, {
            id: selection.valuation_batch_id,
            organizationId: org,
            projectId: project,
          });
          if (!batch || batch.status !== 'confirmed')
            reportInvalid(
              'Lote de avaliação deve estar confirmado neste projeto.',
            );
        }
        const rs = await scoped(
          AssetValuationEntity,
          false,
          batch ? Number(batch.id) : undefined,
        );
        const latest = new Map<string, AssetValuationEntity>();
        for (const r of rs) {
          const old = latest.get(String(r.inventoryItemId));
          if (
            !old ||
            civil(r.valuationDate)! > civil(old.valuationDate)! ||
            (civil(r.valuationDate) === civil(old.valuationDate) &&
              Number(r.id) > Number(old.id))
          )
            latest.set(String(r.inventoryItemId), r);
        }
        const selected = [...latest.values()];
        table(
          f,
          [
            'Avaliação ID',
            'Item ID',
            'Data',
            'Origem/método informado',
            'Valor novo (moeda não informada)',
            'Valor usado (moeda não informada)',
            'Lote ID',
            'Notas',
          ],
          selected.map((r) => [
            Number(r.id),
            Number(r.inventoryItemId),
            civil(r.valuationDate),
            r.source,
            r.newValue,
            r.usedValue,
            r.batchOperationId ? Number(r.batchOperationId) : null,
            r.notes,
          ]),
          batch ? [...rs, batch] : rs,
        );
        metrics['valuation.count'] = selected.length;
        metrics['valuation.used_total'] = null;
        if (selected.length) missing.push('valuation.currency');
        if (!selected.length) missing.push('valuation');
        if (selected.some((r) => r.usedValue === null))
          missing.push('valuation.used_total');
      }
      if (f === 'issues') {
        const rs = await scoped(InventoryPendingIssueEntity);
        table(
          f,
          [
            'Pendência ID',
            'Tipo',
            'Título',
            'Situação',
            'Severidade',
            'Resolução',
          ],
          rs.map((r) => [
            Number(r.id),
            r.type,
            r.title,
            r.status,
            r.severity,
            r.resolutionNotes,
          ]),
          rs,
        );
        metrics['issues.open_count'] = rs.filter((r) =>
          ['open', 'in_review'].includes(r.status),
        ).length;
      }
    }
    for (const [k, v] of Object.entries(metrics))
      fields[k] = v === null ? null : String(v);
    const sourceHash = hash({
      selection: { ...selection, families },
      tables: tables.map((t) => ({ family: t.family, hash: t.hash })),
      fields,
      metrics,
      missing,
      unresolved,
    });
    const result: ReportSources = {
      selection: { ...selection, families },
      generated_at: new Date().toISOString(),
      permissions,
      tables,
      fields,
      metrics,
      missing,
      unresolved,
      hash: sourceHash,
    };
    check();
    if (
      Buffer.byteLength(JSON.stringify(result)) > REPORT_SOURCE_SNAPSHOT_BYTES
    )
      throw new PayloadTooLargeException({
        code: 'TECHNICAL_REPORT_SNAPSHOT_LIMIT',
        message:
          'Snapshot excede 2 MiB. Nenhum snapshot parcial foi salvo. Refine as famílias selecionadas.',
      });
    return result;
  }
}
