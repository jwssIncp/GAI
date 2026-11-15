import { assertNoLooseClosedMonth } from './dre-closed-period';
import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import { EntityManager } from 'typeorm';
import * as XLSX from 'xlsx';
import type { ProjectActorContext } from '../projects/application/services/project-scope.service';
import { civilToday } from '../finance-settings/finance-settings.policy';
import { hasAllPermissions } from '../auth/application/services/permission-access';
import { DreAccount, DrePeriod } from './dre.entity';
import type { DreScopeDto } from './dre.dto';
import { conflict, invalid } from './dre.policy';
import { DreService } from './dre.service';
import {
  DreImportEntity,
  DreMonthlyValueEntity,
  DreMonthlyValueVersionEntity,
  DreRecognitionRuleEntity,
  DreReportLayoutEntity,
} from './dre-monthly.entities';
import type {
  DreCellDto,
  DreImportConfirmDto,
  DreImportPreviewDto,
  DreLayoutDto,
  DreRulesDto,
} from './dre-monthly.dto';
import {
  buildGrid,
  FLOW_KINDS,
  flowKindOf,
  fromCents,
  monthsOf,
  RULE_KINDS,
  RULE_LABELS,
  type RuleKind,
  toCents,
} from './dre-monthly.formulas';
import { DreMonthlyService, EMPTY_LAYOUT } from './dre-monthly.service';
import { planDefaultModel } from './dre-default-model';

const br = (month: string) => month.split('-').reverse().join('/');
const normalize = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

/** "1.234,56", "-1.234,56", "(1.234,56)", "1234.56" ou número → centavos; vazio = 0. */
export function parseAmount(v: unknown): bigint | null {
  if (v === null || v === undefined || v === '') return 0n;
  if (typeof v === 'number')
    return Number.isFinite(v) ? toCents(v.toFixed(2)) : null;
  if (typeof v !== 'string') return null;
  let s = v
    .trim()
    .replace(/R\$\s?/i, '')
    .replace(/\s/g, '');
  if (!s || s === '-') return 0n;
  let negative = false;
  if (/^\(.*\)$/.test(s)) {
    negative = true;
    s = s.slice(1, -1);
  }
  if (s.startsWith('-')) {
    negative = !negative;
    s = s.slice(1);
  }
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  const c = toCents(s);
  return negative ? -c : c;
}

@Injectable()
export class DreMonthlyCommandsService {
  constructor(
    private readonly dre: DreService,
    private readonly monthly: DreMonthlyService,
  ) {}

  private scope(f: { organization_id?: number }) {
    return {
      organization_id: f.organization_id,
      page: 1,
      page_size: 20,
    } as DreScopeDto;
  }

  private async posting(m: EntityManager, org: number, id: number) {
    const a = await m.findOneBy(DreAccount, { id, organizationId: org });
    if (!a || !a.data.posting || !a.data.active)
      invalid('Conta inexistente, sintética ou excluída.');
    return a;
  }

  private async closedMonth(m: EntityManager, org: number, month: string) {
    return m.exists(DrePeriod, {
      where: { organizationId: org, month, closed: true },
    });
  }

  async saveRules(
    f: DreScopeDto,
    dto: DreRulesDto,
    actor: ProjectActorContext,
  ) {
    await this.dre.require(actor, ['dre:read', 'dre:configure']);
    return this.dre.command(f, dto, actor, 'monthly-rules', async (m, org) => {
      await assertNoLooseClosedMonth(
        m,
        org,
        'Não é possível alterar as regras da DRE',
      );
      const changed: Record<string, number | null> = {};
      for (const [kind, accountId] of Object.entries(dto.rules)) {
        if (!RULE_KINDS.includes(kind as RuleKind))
          invalid(`Tipo de regra desconhecido: ${kind}.`);
        const prior = await m.findOneBy(DreRecognitionRuleEntity, {
          organizationId: org,
          kind,
        });
        if (accountId === null) {
          if (prior) await m.delete(DreRecognitionRuleEntity, { id: prior.id });
          changed[kind] = null;
          continue;
        }
        await this.posting(m, org, accountId);
        if (prior) {
          if (prior.accountId === accountId) continue;
          await m.update(
            DreRecognitionRuleEntity,
            { id: prior.id },
            {
              accountId,
              revision: prior.revision + 1,
              actorId: actor.id,
              recordedAt: new Date(),
            },
          );
        } else
          await m.save(
            m.create(DreRecognitionRuleEntity, {
              organizationId: org,
              kind,
              accountId,
              revision: 1,
              actorId: actor.id,
              recordedAt: new Date(),
            }),
          );
        changed[kind] = accountId;
      }
      return { changed };
    });
  }

  async saveLayout(
    f: DreScopeDto,
    dto: DreLayoutDto,
    actor: ProjectActorContext,
  ) {
    await this.dre.require(actor, ['dre:read', 'dre:configure']);
    return this.dre.command(f, dto, actor, 'monthly-layout', async (m, org) => {
      const prior = await m.findOneBy(DreReportLayoutEntity, {
        organizationId: org,
      });
      if ((prior?.revision ?? 0) !== dto.revision)
        conflict('Layout alterado por outra pessoa. Atualize.');
      await assertNoLooseClosedMonth(
        m,
        org,
        'Não é possível alterar o layout da DRE',
      );
      const ids = [...dto.hidden, ...dto.summary, ...dto.post_operational];
      for (const id of new Set(ids))
        if (
          !(await m.exists(DreAccount, { where: { id, organizationId: org } }))
        )
          invalid('Conta fora da organização.');
      const data = {
        hidden: [...new Set(dto.hidden)],
        summary: [...new Set(dto.summary)],
        post_operational: [...new Set(dto.post_operational)],
      };
      if (prior)
        await m
          .createQueryBuilder()
          .update(DreReportLayoutEntity)
          .set({
            revision: prior.revision + 1,
            data: () => ':data',
            actorId: actor.id,
            recordedAt: new Date(),
          })
          .where('id=:id', { id: prior.id, data: JSON.stringify(data) })
          .execute();
      else
        await m.save(
          m.create(DreReportLayoutEntity, {
            organizationId: org,
            revision: 1,
            data,
            actorId: actor.id,
            recordedAt: new Date(),
          }),
        );
      return { revision: (prior?.revision ?? 0) + 1, data };
    });
  }

  /** Grava (ou apaga) o valor lançado de uma célula, com versão e motivo. */
  private async write(
    m: EntityManager,
    org: number,
    accountId: number,
    month: string,
    amount: bigint | null,
    origin: 'manual' | 'import',
    importId: number | null,
    reason: string,
    actorId: number,
  ) {
    const prior = await m.findOneBy(DreMonthlyValueEntity, {
      organizationId: org,
      accountId,
      month,
    });
    const text = amount === null ? null : fromCents(amount);
    if (
      prior &&
      (prior.amount === null
        ? null
        : fromCents(toCents(String(prior.amount)))) === text
    )
      return null;
    if (!prior && text === null) return null;
    const now = new Date();
    let row: DreMonthlyValueEntity;
    if (prior) {
      prior.revision += 1;
      await m.update(
        DreMonthlyValueEntity,
        { id: prior.id },
        {
          amount: text,
          origin,
          importId,
          revision: prior.revision,
          actorId,
          recordedAt: now,
        },
      );
      row = prior;
    } else {
      row = await m.save(
        m.create(DreMonthlyValueEntity, {
          organizationId: org,
          accountId,
          month,
          amount: text,
          origin,
          importId,
          revision: 1,
          actorId,
          recordedAt: now,
        }),
      );
    }
    await m.save(
      m.create(DreMonthlyValueVersionEntity, {
        organizationId: org,
        valueId: Number(row.id),
        revision: row.revision,
        amount: text,
        origin,
        importId,
        reason,
        actorId,
        recordedAt: now,
      }),
    );
    return { from: prior?.amount ?? null, to: text };
  }

  async setCell(f: DreScopeDto, dto: DreCellDto, actor: ProjectActorContext) {
    await this.dre.require(actor, ['dre:read', 'dre:adjust']);
    return this.dre.command(f, dto, actor, 'monthly-cell', async (m, org) => {
      await this.posting(m, org, dto.account_id);
      if (await this.closedMonth(m, org, dto.month))
        conflict(
          `Competência ${br(dto.month)} fechada. Reabra com autorização antes de lançar.`,
        );
      const r = await this.write(
        m,
        org,
        dto.account_id,
        dto.month,
        dto.amount === null || dto.amount === undefined
          ? null
          : toCents(dto.amount),
        'manual',
        null,
        dto.reason.trim(),
        actor.id,
      );
      return { changed: r !== null, ...(r ?? {}) };
    });
  }

  /** Lê e interpreta a planilha: coluna A = conta, B..M = jan..dez. */
  private async plan(
    org: number,
    year: string,
    file: { originalname: string; buffer: Buffer },
    mappingJson: string | undefined,
  ) {
    let mapping: Record<string, number> = {};
    try {
      mapping = mappingJson
        ? (JSON.parse(mappingJson) as Record<string, number>)
        : {};
    } catch {
      invalid('Mapeamento inválido.');
    }
    let matrix: unknown[][];
    try {
      // .xlsx é um ZIP (PK); texto é CSV — com ponto e vírgula (padrão
      // brasileiro) ou vírgula, conforme a primeira linha.
      const zip = file.buffer[0] === 0x50 && file.buffer[1] === 0x4b;
      const text = zip
        ? ''
        : file.buffer.toString('utf8').replace(/^\uFEFF/, '');
      const first = text.split(/\r?\n/)[0] ?? '';
      const book = zip
        ? XLSX.read(file.buffer, { type: 'buffer', raw: true })
        : XLSX.read(text, {
            type: 'string',
            raw: true,
            FS: first.split(';').length > first.split(',').length ? ';' : ',',
          });
      matrix = XLSX.utils.sheet_to_json(book.Sheets[book.SheetNames[0]], {
        header: 1,
        raw: true,
        defval: '',
      });
    } catch {
      invalid('Não foi possível ler a planilha. Envie .xlsx ou .csv.');
    }
    const c = await this.monthly.context(org, civilToday());
    if (!c)
      invalid(
        'Sem parâmetros financeiros vigentes: configure antes de importar.',
      );
    const accounts = c.ctx.accounts;
    const byCode = new Map(accounts.map((a) => [normalize(a.code), a]));
    const byName = new Map<string, typeof accounts>();
    for (const a of accounts) {
      const k = normalize(a.name);
      byName.set(k, [...(byName.get(k) ?? []), a]);
    }
    const flowFed = new Set(
      FLOW_KINDS.map((k) => c.ctx.rules[k]).filter(Boolean) as number[],
    );
    const months = monthsOf(year);
    const existing = new Map(
      [...c.ctx.entered].filter(([k]) => k.split('|')[1].startsWith(year)),
    );
    const used = new Set<number>();
    const rows: Array<Record<string, unknown>> = [];
    let apply = 0;
    let skippedClosed = 0;
    let skippedFlow = 0;
    matrix.forEach((r, i) => {
      const head = r[0];
      const label = (
        typeof head === 'string' || typeof head === 'number' ? String(head) : ''
      ).trim();
      if (!label) return;
      const cells = months.map((_, k) => parseAmount(r[k + 1]));
      // cabeçalho: primeira linha com nome de mês (texto) nas colunas B..M
      if (i === 0 && cells.some((v) => v === null)) return;
      const n = normalize(label);
      const firstToken = n.split(' ')[0];
      let account =
        (mapping[label] &&
          accounts.find((a) => a.id === Number(mapping[label]))) ||
        byCode.get(n) ||
        (byName.get(n)?.length === 1 ? byName.get(n)![0] : undefined) ||
        byCode.get(firstToken);
      let status = 'ok';
      if (!account) status = byName.get(n)?.length ? 'ambiguous' : 'unmatched';
      else if (used.has(account.id)) {
        status = 'duplicate';
        account = undefined;
      }
      if (cells.some((v) => v === null))
        status = status === 'ok' ? 'invalid_number' : status;
      if (account && status === 'ok') used.add(account.id);
      rows.push({
        line: i + 1,
        label,
        status,
        account_id: account?.id ?? null,
        account_label: account ? `${account.code} ${account.name}` : null,
        months: months.map((month, k) => {
          const amount = cells[k];
          const current = account
            ? (existing.get(`${account.id}|${month}`) ?? null)
            : null;
          const same =
            (current ?? 0n) === (amount ?? 0n) &&
            (current !== null || amount === 0n);
          const fromFlow =
            month >= c.ctx.cutoff && flowFed.has(account?.id ?? 0);
          let action = 'apply';
          if (status !== 'ok') action = 'ignored';
          else if (c.ctx.closed.has(month))
            action =
              same || (fromFlow && amount === 0n) ? 'unchanged' : 'skip_closed';
          else if (fromFlow)
            action = (amount ?? 0n) === 0n ? 'unchanged' : 'skip_flow';
          else if (same) action = 'unchanged';
          if (action === 'apply') apply++;
          if (action === 'skip_closed') skippedClosed++;
          if (action === 'skip_flow') skippedFlow++;
          return {
            month,
            amount: amount === null ? null : fromCents(amount),
            current: current === null ? null : fromCents(current),
            action,
          };
        }),
      });
    });
    const checksum = createHash('sha256')
      .update(year)
      .update(file.buffer)
      .update(JSON.stringify(mapping))
      .digest('hex');
    return {
      year,
      file_name: file.originalname,
      checksum,
      mapping,
      rows,
      totals: {
        apply,
        skipped_closed: skippedClosed,
        skipped_flow: skippedFlow,
        unmatched: rows.filter((r) => r.status !== 'ok').length,
      },
      accounts: accounts.map((a) => ({
        id: a.id,
        label: `${a.code} ${a.name}`,
      })),
    };
  }

  async importPreview(
    dto: DreImportPreviewDto,
    file: { originalname: string; buffer: Buffer } | undefined,
    actor: ProjectActorContext,
  ) {
    await this.dre.require(actor, ['dre:read', 'dre:import']);
    if (!file) invalid('Envie a planilha.');
    return this.plan(
      this.dre.org(actor, dto.organization_id),
      dto.year,
      file,
      dto.mapping,
    );
  }

  async importConfirm(
    dto: DreImportConfirmDto,
    file: { originalname: string; buffer: Buffer } | undefined,
    actor: ProjectActorContext,
  ) {
    await this.dre.require(actor, ['dre:read', 'dre:import']);
    if (!file) invalid('Envie a planilha.');
    if (dto.reason.trim().length < 5)
      invalid('Informe o motivo da importação.');
    const org = this.dre.org(actor, dto.organization_id);
    const plan = await this.plan(org, dto.year, file, dto.mapping);
    if (plan.checksum !== dto.checksum)
      conflict(
        'A planilha ou o mapeamento mudou desde a pré-visualização. Pré-visualize de novo.',
      );
    return this.dre.command(
      this.scope(dto),
      { command_key: dto.command_key, reason: dto.reason },
      actor,
      'monthly-import:' + dto.year,
      async (m, org2) => {
        const imp = await m.save(
          m.create(DreImportEntity, {
            organizationId: org2,
            year: dto.year,
            fileName: file.originalname.slice(0, 255),
            checksum: plan.checksum,
            data: { mapping: plan.mapping, totals: plan.totals },
            reason: dto.reason.trim(),
            actorId: actor.id,
            recordedAt: new Date(),
          }),
        );
        let written = 0;
        for (const r of plan.rows as Array<{
          account_id: number | null;
          months: Array<{
            month: string;
            amount: string | null;
            action: string;
          }>;
        }>)
          for (const cell of r.months) {
            if (cell.action !== 'apply' || r.account_id === null) continue;
            // revalida dentro da transação: mês pode ter sido fechado
            if (await this.closedMonth(m, org2, cell.month)) continue;
            const w = await this.write(
              m,
              org2,
              r.account_id,
              cell.month,
              toCents(cell.amount ?? '0.00'),
              'import',
              Number(imp.id),
              `Importação ${file.originalname}: ${dto.reason.trim()}`,
              actor.id,
            );
            if (w) written++;
          }
        return { import_id: Number(imp.id), written, totals: plan.totals };
      },
    );
  }
}

/** Leitura da tela da DRE mensal: grade, comparativo e configuração. */
@Injectable()
export class DreMonthlyViewService {
  constructor(
    private readonly dre: DreService,
    private readonly monthly: DreMonthlyService,
  ) {}

  async view(
    q: {
      organization_id?: number;
      year: string;
      compare_year?: string;
      as_of?: string;
    },
    actor: ProjectActorContext,
  ) {
    await this.dre.require(actor, ['dre:read']);
    const org = this.dre.org(actor, q.organization_id);
    const today = q.as_of ?? civilToday();
    // Um único contexto (o fluxo é calculado uma vez) para o ano e o comparativo.
    const c = await this.monthly.context(org, today);
    if (!c) return { configured: false as const, as_of: today };
    const grid = this.monthly.gridFrom(c, q.year);
    const compare = q.compare_year
      ? this.monthly.gridFrom(c, q.compare_year)
      : null;
    return {
      configured: true as const,
      as_of: today,
      grid,
      compare: compare
        ? {
            year: compare.year,
            lines: compare.lines.map((l) => ({
              key: l.key,
              total: l.total,
              values: l.values,
            })),
            accounts: compare.accounts.map((a) => ({
              id: a.id,
              total: a.total,
              values: a.cells.map((x) => x.value),
            })),
          }
        : null,
      config: {
        rules: c.ctx.rules,
        rule_labels: RULE_LABELS,
        flow_kinds: FLOW_KINDS,
        layout: c.layout,
        accounts: c.allAccounts
          .filter((a) => a.data.posting && a.data.active)
          .map((a) => ({
            id: a.id,
            label: `${a.code} ${a.data.name}`,
            name: a.data.name,
            group: a.data.group,
            revision: a.revision,
          })),
        excluded_accounts: c.allAccounts
          .filter((a) => !a.data.active)
          .map((a) => ({
            id: a.id,
            code: a.code,
            name: a.data.name,
            revision: a.revision,
          })),
      },
    };
  }

  /** Verificação do fechamento de um mês (bloqueios e avisos). */
  async checklist(
    month: string,
    q: { organization_id?: number; as_of?: string },
    actor: ProjectActorContext,
  ) {
    await this.dre.require(actor, ['dre:read']);
    const org = this.dre.org(actor, q.organization_id);
    return (
      (await this.monthly.checklist(org, month, q.as_of ?? civilToday())) ?? {
        month,
        legacy: true,
        message:
          'Cálculo legado: publique os parâmetros financeiros para ativar a DRE automática.',
      }
    );
  }

  /** Classificações de origens do fluxo a partir do corte, a revisar. */
  async review(q: { organization_id?: number }, actor: ProjectActorContext) {
    await this.dre.require(actor, ['dre:read']);
    const org = this.dre.org(actor, q.organization_id);
    const c = await this.monthly.context(org, civilToday());
    return c ? this.monthly.reviewEntries(c) : [];
  }

  /** Detalhamento de uma célula: composição, histórico e movimentos do fluxo. */
  async detail(
    q: {
      organization_id?: number;
      account_id: number;
      month: string;
      as_of?: string;
    },
    actor: ProjectActorContext,
  ) {
    await this.dre.require(actor, ['dre:read']);
    const org = this.dre.org(actor, q.organization_id);
    const today = q.as_of ?? civilToday();
    const c = await this.monthly.context(org, today);
    if (!c) invalid('Sem parâmetros financeiros vigentes.');
    const account = c.ctx.accounts.find((a) => a.id === q.account_id);
    if (!account) invalid('Conta inexistente ou excluída.');
    const grid = buildGrid(c.ctx, q.month.slice(0, 4));
    const cell = grid.accounts
      .find((a) => a.id === account.id)!
      .cells.find((x) => x.month === q.month)!;
    const value = await this.dre.ds.manager.findOneBy(DreMonthlyValueEntity, {
      organizationId: org,
      accountId: account.id,
      month: q.month,
    });
    const versions = value
      ? await this.dre.ds.manager.find(DreMonthlyValueVersionEntity, {
          where: { organizationId: org, valueId: value.id },
          order: { revision: 'DESC' },
        })
      : [];
    const kinds = FLOW_KINDS.filter((k) => c.ctx.rules[k] === account.id);
    const canFlow = await hasAllPermissions(
      actor,
      ['cash-flow:read'],
      this.dre.resolverPort(),
    );
    const movements =
      kinds.length && canFlow && q.month >= c.ctx.cutoff && !cell.closed
        ? (await this.monthly.flowItems(org, today)).filter((i) => {
            const k = flowKindOf(i);
            return k && kinds.includes(k.kind) && i.date.startsWith(q.month);
          })
        : [];
    return {
      account: { id: account.id, code: account.code, name: account.name },
      month: q.month,
      cell,
      versions: versions.map((v) => ({
        revision: v.revision,
        amount: v.amount,
        origin: v.origin,
        reason: v.reason,
        actor_id: v.actorId,
        recorded_at: v.recordedAt,
      })),
      movements: movements.map((i) => ({
        date: i.date,
        description: i.description,
        project_name: i.project_name,
        status: i.status,
        gross: i.gross,
        sign: flowKindOf(i)!.sign === 1n ? 1 : -1,
      })),
      movements_hidden: kinds.length > 0 && !canFlow,
    };
  }
}

/** Modelo padrão de DRE: pré-visualização e aplicação explícita (etapa 10). */
@Injectable()
export class DreDefaultModelService {
  constructor(private readonly dre: DreService) {}

  private async current(m: EntityManager, org: number) {
    const accounts = await m.find(DreAccount, {
      where: { organizationId: org },
    });
    const rules = await m.find(DreRecognitionRuleEntity, {
      where: { organizationId: org },
    });
    const layout = await m.findOneBy(DreReportLayoutEntity, {
      organizationId: org,
    });
    return {
      accounts,
      rules: Object.fromEntries(
        rules.map((r) => [r.kind, r.accountId]),
      ) as Partial<Record<RuleKind, number>>,
      layout,
      plan: planDefaultModel(
        accounts.map((a) => ({
          id: a.id,
          code: a.code,
          name: a.data.name,
          group: a.data.group,
          posting: a.data.posting,
          active: a.data.active,
        })),
        Object.fromEntries(rules.map((r) => [r.kind, r.accountId])),
        layout?.data.post_operational ?? [],
      ),
    };
  }

  async preview(f: { organization_id?: number }, actor: ProjectActorContext) {
    await this.dre.require(actor, ['dre:read', 'dre:configure']);
    const org = this.dre.org(actor, f.organization_id);
    return (await this.current(this.dre.ds.manager, org)).plan;
  }

  async apply(
    f: DreScopeDto,
    dto: { command_key: string; reason: string },
    actor: ProjectActorContext,
  ) {
    await this.dre.require(actor, ['dre:read', 'dre:configure']);
    return this.dre.command(
      f,
      dto,
      actor,
      'monthly-default-model',
      async (m, org) => {
        await assertNoLooseClosedMonth(
          m,
          org,
          'Não é possível aplicar o modelo padrão',
        );
        const { plan, layout } = await this.current(m, org);
        const reason = `${dto.reason.trim()} (modelo ${plan.version})`;
        const ids = new Map<string, number>();
        for (const x of plan.accounts)
          if (x.account_id) ids.set(x.code, x.account_id);
        let created = 0;
        for (const x of plan.accounts) {
          if (x.action !== 'create') continue;
          const acc = await this.dre.insertAccount(
            m,
            org,
            {
              code: x.code,
              name: x.name,
              group: x.group,
              posting: !x.synthetic,
              ...(x.parent ? { parent_id: ids.get(x.parent) } : {}),
            },
            actor,
            reason,
          );
          ids.set(x.code, acc.id);
          created++;
        }
        let mapped = 0;
        for (const r of plan.rules) {
          if (r.action !== 'map') continue;
          await m.save(
            m.create(DreRecognitionRuleEntity, {
              organizationId: org,
              kind: r.kind,
              accountId: ids.get(r.code)!,
              revision: 1,
              actorId: actor.id,
              recordedAt: new Date(),
            }),
          );
          mapped++;
        }
        const marks = plan.post_operational
          .filter((p) => p.action === 'mark')
          .map((p) => ids.get(p.code)!);
        if (marks.length) {
          const data = {
            ...EMPTY_LAYOUT,
            ...(layout?.data ?? {}),
            post_operational: [
              ...new Set([...(layout?.data.post_operational ?? []), ...marks]),
            ],
          };
          if (layout)
            await m
              .createQueryBuilder()
              .update(DreReportLayoutEntity)
              .set({
                revision: layout.revision + 1,
                data: () => ':data',
                actorId: actor.id,
                recordedAt: new Date(),
              })
              .where('id=:id', { id: layout.id, data: JSON.stringify(data) })
              .execute();
          else
            await m.save(
              m.create(DreReportLayoutEntity, {
                organizationId: org,
                revision: 1,
                data,
                actorId: actor.id,
                recordedAt: new Date(),
              }),
            );
        }
        return {
          version: plan.version,
          created,
          mapped,
          post_operational_marked: marks.length,
          conflicts: plan.totals.conflict,
        };
      },
    );
  }
}
