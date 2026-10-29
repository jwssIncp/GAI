import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash } from 'crypto';
import { DataSource, EntityManager } from 'typeorm';
import {
  ProjectScopeService,
  type ProjectActorContext,
} from '../projects/application/services/project-scope.service';
import { ProjectEntity } from '../projects/infrastructure/persistence/project.entity';
import { ProjectStatusTransitionPolicy } from '../projects/domain/services/project-status-transition.policy';
import { InventoryAccountingItemEntity } from '../inventory-accounting-items/infrastructure/persistence/inventory-accounting-item.entity';
import { InventoryItemEntity } from '../inventory-items/infrastructure/persistence/inventory-item.entity';
import {
  InventorySessionEntity,
  InventoryRoundEntity,
  InventoryObservationEntity,
  InventoryReconciliationEntity,
  InventoryConsolidationEntity,
} from '../inventory-operations/infrastructure/persistence/inventory-operation.entity';
import { InventoryOperationsService } from '../inventory-operations/application/inventory-operations.service';
import {
  ReconciliationStatus,
  ConsolidationDecision,
  InventorySessionStatus,
} from '../inventory-operations/domain/inventory-operation.enums';
import {
  AssistedCandidate,
  AssistedClaim,
  AssistedDecision,
  AssistedRun,
} from './assisted.entity';
import {
  AssistedPageQuery,
  DecideAssistedDto,
  GenerateAssistedDto,
} from './assisted.dto';
import {
  compareSources,
  DEFAULT_MATCH_CONFIG,
  normalizeIdentifier,
  type MatchSource,
} from './matching.policy';

const digest = (value: unknown) =>
  createHash('sha256').update(JSON.stringify(value)).digest('hex');
function conflict(message: string): never {
  throw new ConflictException({ code: 'ASSISTED_CONFLICT', message });
}
function absent(): never {
  throw new NotFoundException({
    code: 'NOT_FOUND',
    message: 'Recurso de conciliação não encontrado neste projeto/sessão',
  });
}

@Injectable()
export class AssistedService {
  constructor(
    private readonly ds: DataSource,
    private readonly scope: ProjectScopeService,
    private readonly operations: InventoryOperationsService,
  ) {}

  private async authorize(
    m: EntityManager,
    projectId: number,
    sessionId: number,
    actor: ProjectActorContext,
    mutation = false,
  ) {
    const project = await m.getRepository(ProjectEntity).findOne({
      where: { id: projectId },
      ...(mutation && m.connection.options.type === 'mysql'
        ? { lock: { mode: 'pessimistic_write' as const } }
        : {}),
    });
    if (!project) absent();
    this.scope.assertCanAccessProject(actor, project.organizationId);
    if (
      mutation &&
      !ProjectStatusTransitionPolicy.allowsOperationalMutation(project.status)
    )
      conflict('O estado do projeto bloqueia esta operação.');
    const session = await m.getRepository(InventorySessionEntity).findOne({
      where: {
        id: sessionId,
        projectId,
        organizationId: project.organizationId,
      },
    });
    if (!session) absent();
    if (mutation && session.status === InventorySessionStatus.CANCELLED)
      conflict('Sessão cancelada: revisão indisponível.');
    return project;
  }

  private latest(m: EntityManager, p: number, s: number, org: number) {
    return m
      .getRepository(InventoryObservationEntity)
      .createQueryBuilder('o')
      .where(
        'o.projectId = :p AND o.sessionId = :s AND o.organizationId = :org',
        { p, s, org },
      )
      .andWhere(
        'NOT EXISTS (SELECT 1 FROM inventory_observations newer WHERE newer.project_id = o.project_id AND newer.session_id = o.session_id AND newer.inventory_item_id = o.inventory_item_id AND (newer.captured_at > o.captured_at OR (newer.captured_at = o.captured_at AND newer.id > o.id)))',
      );
  }
  // Keyset pages keep memory bounded. Under review, shared next-key locks also prevent source phantoms on MySQL REPEATABLE READ.
  private async visitAccounting(
    m: EntityManager,
    p: number,
    org: number,
    visit: (row: InventoryAccountingItemEntity) => void | Promise<void>,
    lock: boolean,
  ) {
    let cursor = 0;
    for (;;) {
      const q = m
        .getRepository(InventoryAccountingItemEntity)
        .createQueryBuilder('a')
        .withDeleted()
        .where(
          'a.projectId = :p AND a.organizationId = :org AND a.id > :cursor',
          { p, org, cursor },
        )
        .orderBy('a.id')
        .take(250);
      if (lock && m.connection.options.type === 'mysql')
        q.setLock('pessimistic_read');
      const rows = await q.getMany();
      if (!rows.length) break;
      for (const row of rows) await visit(row);
      cursor = rows.at(-1)!.id;
    }
  }
  private async sourceHash(
    m: EntityManager,
    p: number,
    s: number,
    org: number,
    lock = false,
  ) {
    const hash = createHash('sha256');
    // Hash complete typed sources, including deleted rows, new observations, rounds and session lifecycle.
    for (const target of [
      InventorySessionEntity,
      InventoryRoundEntity,
      InventoryObservationEntity,
      InventoryItemEntity,
    ] as const) {
      let cursor = 0;
      for (;;) {
        const q = m
          .getRepository(target)
          .createQueryBuilder('source')
          .withDeleted()
          .where(
            'source.projectId = :p AND source.organizationId = :org AND source.id > :cursor',
            { p, org, cursor },
          );
        if (target === InventorySessionEntity)
          q.andWhere('source.id = :s', { s });
        else if (target !== InventoryItemEntity)
          q.andWhere('source.sessionId = :s', { s });
        if (lock && m.connection.options.type === 'mysql')
          q.setLock('pessimistic_read');
        const rows = await q.orderBy('source.id').take(250).getMany();
        if (!rows.length) break;
        for (const row of rows) hash.update(JSON.stringify(row));
        cursor = rows.at(-1)!.id;
      }
    }
    await this.visitAccounting(
      m,
      p,
      org,
      (row) => {
        hash.update(JSON.stringify(row));
      },
      lock,
    );
    return hash.digest('hex');
  }
  private accounting(row: InventoryAccountingItemEntity): MatchSource {
    return {
      id: row.id,
      plate: row.newInventoryPlate ?? row.plate,
      serial: row.serialNumber,
      description: row.description,
      location: row.location,
      unit: null,
      version: digest(row),
    };
  }
  async generate(
    p: number,
    s: number,
    dto: GenerateAssistedDto,
    actor: ProjectActorContext,
  ) {
    return this.ds.transaction(
      this.ds.options.type === 'mysql' ? 'REPEATABLE READ' : 'SERIALIZABLE',
      async (m) => {
        const project = await this.authorize(m, p, s, actor, true);
        const org = project.organizationId;
        const config = dto.config ?? DEFAULT_MATCH_CONFIG;
        if (config.localTextThreshold > config.textThreshold)
          conflict(
            'O limiar com localização deve ser menor ou igual ao limiar textual.',
          );
        const sourceHash = await this.sourceHash(m, p, s, org);
        const observations = await this.latest(m, p, s, org)
          .andWhere('o.inventoryItemId > :after', { after: dto.after_item_id })
          .orderBy('o.inventoryItemId')
          .take(21)
          .getMany();
        const hasMore = observations.length > 20;
        observations.splice(20);
        if (!observations.length)
          conflict('Não há observações após este cursor.');
        const physical: MatchSource[] = [];
        for (const o of observations) {
          const item = await m.getRepository(InventoryItemEntity).findOne({
            where: {
              id: o.inventoryItemId,
              projectId: p,
              organizationId: org,
            },
          });
          const round = await m.getRepository(InventoryRoundEntity).findOne({
            where: {
              id: o.roundId,
              projectId: p,
              sessionId: s,
              organizationId: org,
            },
          });
          if (!item || !round)
            conflict('Observação sem item/rodada vigente no escopo.');
          physical.push({
            id: item.id,
            plate: o.observedPlate,
            serial: o.observedSerialNumber,
            description: item.description,
            location: o.locationText,
            unit: o.unitText,
            version: digest({ item, observation: o, round }),
            observationId: o.id,
            roundId: o.roundId,
            result: o.result,
          });
        }
        const countsP = new Map<string, number>(),
          countsA = new Map<string, number>();
        const keys = (row: MatchSource) =>
          (['plate', 'serial'] as const)
            .map((k) => {
              const v = normalizeIdentifier(row[k]);
              return v ? k + ':' + v : '';
            })
            .filter(Boolean);
        const tracked = new Set(physical.flatMap(keys));
        let cursor = 0;
        for (;;) {
          const rows = await this.latest(m, p, s, org)
            .andWhere('o.id > :cursor', { cursor })
            .orderBy('o.id')
            .take(250)
            .getMany();
          if (!rows.length) break;
          for (const row of rows)
            for (const key of keys({
              plate: row.observedPlate,
              serial: row.observedSerialNumber,
            } as MatchSource))
              if (tracked.has(key))
                countsP.set(key, (countsP.get(key) ?? 0) + 1);
          cursor = rows.at(-1)!.id;
        }
        const pairs: Array<{
          physical: MatchSource;
          accounting: MatchSource;
          evidence: NonNullable<ReturnType<typeof compareSources>>;
        }> = [];
        let scanned = 0;
        await this.visitAccounting(
          m,
          p,
          org,
          (row) => {
            if (row.deletedAt) return;
            if (++scanned > 20000)
              conflict(
                'Limite síncrono de 20.000 registros contábeis excedido. Nenhuma sugestão parcial foi gravada.',
              );
            const a = this.accounting(row);
            for (const f of physical) {
              const evidence = compareSources(f, a, config);
              if (evidence)
                pairs.push({ physical: f, accounting: a, evidence });
            }
            if (pairs.length > 2000)
              conflict(
                'Mais de 2.000 candidatos neste lote: refine as fontes ou os critérios. Nada foi truncado ou gravado.',
              );
          },
          false,
        );
        // Also detect duplicate identifiers carried by text-only candidates, even
        // when the corresponding identifier was absent on the physical source.
        const candidateKeys = new Set(
          pairs.flatMap((pair) => keys(pair.accounting)),
        );
        await this.visitAccounting(
          m,
          p,
          org,
          (row) => {
            if (row.deletedAt) return;
            for (const key of keys(this.accounting(row)))
              if (candidateKeys.has(key))
                countsA.set(key, (countsA.get(key) ?? 0) + 1);
          },
          false,
        );
        const run = await m.getRepository(AssistedRun).save({
          organizationId: org,
          projectId: p,
          sessionId: s,
          config,
          sourceHash,
          afterItemId: dto.after_item_id,
          nextItemId: hasMore ? observations.at(-1)!.inventoryItemId : null,
          createdById: actor.id,
          summary: {},
        });
        const physicalCounts = new Map<number, number>(),
          accountingCounts = new Map<number, number>();
        for (const pair of pairs) {
          physicalCounts.set(
            pair.physical.id,
            (physicalCounts.get(pair.physical.id) ?? 0) + 1,
          );
          accountingCounts.set(
            pair.accounting.id,
            (accountingCounts.get(pair.accounting.id) ?? 0) + 1,
          );
        }
        const summary = {
          physical: physical.length,
          candidates: pairs.length,
          probable: 0,
          ambiguous: 0,
          descriptionAlerts: 0,
          withoutCandidates: 0,
        };
        for (const f of physical) {
          const matches = pairs.filter((pair) => pair.physical.id === f.id);
          for (const pair of matches) {
            const warnings: string[] = [];
            for (const key of keys(f))
              if ((countsP.get(key) ?? 0) > 1)
                warnings.push('Duplicidade física de ' + key.split(':')[0]);
            for (const key of keys(pair.accounting))
              if ((countsA.get(key) ?? 0) > 1)
                warnings.push('Duplicidade contábil de ' + key.split(':')[0]);
            if ((physicalCounts.get(f.id) ?? 0) > 1)
              warnings.push('Vários candidatos para este item físico.');
            if ((accountingCounts.get(pair.accounting.id) ?? 0) > 1)
              warnings.push('Candidato contábil compartilhado neste lote.');
            if (warnings.length) summary.ambiguous++;
            else summary.probable++;
            if (pair.evidence.alerts.some((a) => a.startsWith('Descrição')))
              summary.descriptionAlerts++;
            await m.getRepository(AssistedCandidate).save({
              organizationId: org,
              projectId: p,
              sessionId: s,
              runId: run.id,
              inventoryItemId: f.id,
              accountingItemId: pair.accounting.id,
              physical: f,
              accounting: pair.accounting,
              evidence: pair.evidence,
              warnings,
              status: 'pending',
              revision: 1,
            });
          }
          if (!matches.length) {
            summary.withoutCandidates++;
            await m.getRepository(AssistedCandidate).save({
              organizationId: org,
              projectId: p,
              sessionId: s,
              runId: run.id,
              inventoryItemId: f.id,
              accountingItemId: null,
              physical: f,
              accounting: null,
              evidence: null,
              warnings: [
                'Sem candidato: confira dados incompletos, série, placa e descrição.',
              ],
              status: 'pending',
              revision: 1,
            });
          }
        }
        run.summary = summary;
        return m.getRepository(AssistedRun).save(run);
      },
    );
  }
  async runs(
    p: number,
    s: number,
    q: AssistedPageQuery,
    actor: ProjectActorContext,
  ) {
    await this.authorize(this.ds.manager, p, s, actor);
    const [items, total] = await this.ds
      .getRepository(AssistedRun)
      .findAndCount({
        where: { projectId: p, sessionId: s },
        order: { id: 'DESC' },
        skip: (q.page - 1) * q.page_size,
        take: q.page_size,
      });
    return { items, total, page: q.page, page_size: q.page_size };
  }
  async candidates(
    p: number,
    s: number,
    runId: number,
    q: AssistedPageQuery,
    actor: ProjectActorContext,
  ) {
    return this.ds.transaction(
      this.ds.options.type === 'mysql' ? 'REPEATABLE READ' : 'SERIALIZABLE',
      async (m) => {
        const project = await this.authorize(m, p, s, actor);
        const run = await m.getRepository(AssistedRun).findOne({
          where: {
            id: runId,
            projectId: p,
            sessionId: s,
            organizationId: project.organizationId,
          },
        });
        if (!run) absent();
        const currentHash = await this.sourceHash(
          m,
          p,
          s,
          project.organizationId,
        );
        const [items, total] = await m
          .getRepository(AssistedCandidate)
          .findAndCount({
            where: {
              runId,
              projectId: p,
              sessionId: s,
              ...(q.status ? { status: q.status } : {}),
            },
            order: { id: 'ASC' },
            skip: (q.page - 1) * q.page_size,
            take: q.page_size,
          });
        return {
          run,
          stale: currentHash !== run.sourceHash,
          items,
          total,
          page: q.page,
          page_size: q.page_size,
        };
      },
    );
  }
  async history(
    p: number,
    s: number,
    id: number,
    q: AssistedPageQuery,
    actor: ProjectActorContext,
  ) {
    await this.authorize(this.ds.manager, p, s, actor);
    if (
      !(await this.ds
        .getRepository(AssistedCandidate)
        .existsBy({ id, projectId: p, sessionId: s }))
    )
      absent();
    const [items, total] = await this.ds
      .getRepository(AssistedDecision)
      .findAndCount({
        where: { projectId: p, sessionId: s, candidateId: id },
        order: { id: 'DESC' },
        skip: (q.page - 1) * q.page_size,
        take: q.page_size,
      });
    return { items, total };
  }
  async decide(
    p: number,
    s: number,
    id: number,
    dto: DecideAssistedDto,
    actor: ProjectActorContext,
  ) {
    return this.ds.transaction(
      this.ds.options.type === 'mysql' ? 'REPEATABLE READ' : 'SERIALIZABLE',
      async (m) => {
        const project = await this.authorize(m, p, s, actor, true);
        const org = project.organizationId;
        const fingerprint = digest({
          p,
          s,
          id,
          revision: dto.revision,
          sourceHash: dto.source_hash,
          action: dto.action,
          reason: dto.reason.trim(),
          commandKey: dto.command_key,
          actor: actor.id,
        });
        const old = await m.getRepository(AssistedDecision).findOne({
          where: {
            organizationId: org,
            projectId: p,
            commandKey: dto.command_key,
          },
        });
        if (old) {
          if (old.fingerprint !== fingerprint)
            conflict('Chave de idempotência utilizada por outro comando.');
          return old.result;
        }
        const candidate = await m.getRepository(AssistedCandidate).findOne({
          where: { id, projectId: p, sessionId: s, organizationId: org },
        });
        if (!candidate) absent();
        const run = await m.getRepository(AssistedRun).findOneByOrFail({
          id: candidate.runId,
          projectId: p,
          sessionId: s,
          organizationId: org,
        });
        if (
          candidate.status !== 'pending' ||
          candidate.revision !== dto.revision
        )
          conflict('Sugestão já revisada ou versão desatualizada.');
        if (
          dto.source_hash !== run.sourceHash ||
          (await this.sourceHash(m, p, s, org, true)) !== run.sourceHash
        )
          conflict(
            'Fontes obsoletas. Gere uma nova execução antes de decidir.',
          );
        if (dto.reason.trim().length < 5)
          conflict(
            'Informe uma justificativa com pelo menos cinco caracteres.',
          );
        let reconciliationId: number | null = null;
        if (dto.action === 'approved') {
          if (
            !candidate.accountingItemId ||
            !candidate.accounting ||
            !candidate.evidence
          )
            conflict('Não há candidato contábil para aprovação.');
          if (
            candidate.physical.result === 'not_found' ||
            candidate.physical.result === 'duplicated' ||
            candidate.warnings.some((w) => w.startsWith('Duplicidade'))
          )
            conflict(
              'Duplicidades ou observação não localizada exigem correção/reinventário e nova execução.',
            );
          const claims = m.getRepository(AssistedClaim);
          if (
            await claims.exists({
              where: [
                { projectId: p, inventoryItemId: candidate.inventoryItemId },
                { projectId: p, accountingItemId: candidate.accountingItemId },
              ],
            })
          )
            conflict(
              'Item físico ou contábil já reservado por decisão aprovada.',
            );
          const consolidated = await m
            .getRepository(InventoryConsolidationEntity)
            .createQueryBuilder('c')
            .innerJoin(
              InventoryReconciliationEntity,
              'r',
              'r.id = c.reconciliationId',
            )
            .where(
              'c.projectId = :p AND (r.inventoryItemId = :item OR r.accountingItemId = :accounting)',
              {
                p,
                item: candidate.inventoryItemId,
                accounting: candidate.accountingItemId,
              },
            )
            .getCount();
          if (consolidated)
            conflict(
              'Uma das fontes já possui decisão consolidada. O histórico existente não pode ser substituído.',
            );
          await m.getRepository(InventorySessionEntity).findOne({
            where: { id: s, projectId: p },
            ...(m.connection.options.type === 'mysql'
              ? { lock: { mode: 'pessimistic_write' as const } }
              : {}),
          });
          const max = await m
            .getRepository(InventoryReconciliationEntity)
            .createQueryBuilder('r')
            .select('MAX(r.runNumber)', 'max')
            .where('r.sessionId = :s', { s })
            .getRawOne<{ max: number | null }>();
          const row = await m
            .getRepository(InventoryReconciliationEntity)
            .save({
              organizationId: org,
              projectId: p,
              sessionId: s,
              runNumber: Number(max?.max ?? 0) + 1,
              inventoryItemId: candidate.inventoryItemId,
              observationId: candidate.physical.observationId,
              accountingItemId: candidate.accountingItemId,
              status:
                candidate.evidence.rule === 'exact_plate'
                  ? ReconciliationStatus.MATCHED
                  : ReconciliationStatus.PLATE_DIVERGENCE,
              physicalPlate: normalizeIdentifier(candidate.physical.plate),
              accountingPlate: normalizeIdentifier(candidate.accounting.plate),
              evidence: {
                assisted_candidate_id: id,
                assisted_run_id: run.id,
                config: run.config,
                source_hash: run.sourceHash,
                physical: candidate.physical,
                accounting: candidate.accounting,
                comparison: candidate.evidence,
                warnings: candidate.warnings,
              },
              createdById: actor.id,
            });
          await claims.save({
            organizationId: org,
            projectId: p,
            sessionId: s,
            candidateId: id,
            inventoryItemId: candidate.inventoryItemId,
            accountingItemId: candidate.accountingItemId,
          });
          await this.operations.recordConsolidation(
            m,
            project,
            row,
            {
              decision: ConsolidationDecision.ACCEPTED,
              notes: dto.reason.trim(),
            },
            actor,
          );
          reconciliationId = row.id;
        }
        const result = {
          id,
          status: dto.action,
          revision: candidate.revision + 1,
          reconciliationId,
        };
        const updated = await m
          .getRepository(AssistedCandidate)
          .update(
            { id, revision: dto.revision, status: 'pending' },
            { status: dto.action, revision: result.revision },
          );
        if (!updated.affected) conflict('Conflito de revisão.');
        await m.getRepository(AssistedDecision).save({
          organizationId: org,
          projectId: p,
          sessionId: s,
          candidateId: id,
          commandKey: dto.command_key,
          fingerprint,
          action: dto.action,
          reason: dto.reason.trim(),
          actorId: actor.id,
          revision: result.revision,
          sourceHash: run.sourceHash,
          reconciliationId,
          result,
        });
        return result;
      },
    );
  }
}
