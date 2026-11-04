import type { TechnicalReportVersion } from '../technical-reports/report.entity';
import type { BudgetVersionEntity } from '../budgets/budget.entity';
import {
  DEFAULT_VISUAL,
  DocumentBlock,
  ProfessionalDocument,
} from './document.contract';
export const documentDate = (value: string | Date) => {
  const s = value instanceof Date ? value.toISOString() : value;
  return s.slice(0, 10).split('-').reverse().join('/');
};
// Format exact decimal strings without floating-point rounding of large prices.
export function documentMoney(value: string, currency: string) {
  const [whole, fraction = '00'] = value.split('.');
  return `${currency} ${whole.replace(/\B(?=(\d{3})+(?!\d))/g, '.')},${fraction.padEnd(2, '0')}`;
}
const families: Record<string, string> = {
  identity: 'Identificação',
  units: 'Unidades',
  inventory: 'Inventário patrimonial',
  accounting: 'Base contábil',
  observations: 'Observações',
  reconciliation: 'Conciliações',
  valuation: 'Avaliações',
  issues: 'Pendências',
};
export function reportDocument(
  v: TechnicalReportVersion,
): ProfessionalDocument {
  const d = v.data;
  const materialize = (s: string) =>
    s.replace(
      /\{\{([^{}]+)\}\}/g,
      (_, key: string) =>
        d.fields.find((f) => f.key === key.trim())?.value || '[não preenchido]',
    );
  const blocks: DocumentBlock[] = [
    {
      title: 'Identificação do laudo',
      paragraphs: [
        `Laudo #${v.reportId} · Projeto #${v.projectId}`,
        d.sources.fields['company.name'] ?? 'Empresa não informada',
        d.sources.fields['project.name'] ?? 'Projeto não informado',
        `Modelo de conteúdo #${d.template.id} · publicação #${d.template.version_id}`,
        `Extração: ${documentDate(d.sources.generated_at)}`,
      ],
    },
    {
      title: 'Campos do documento',
      paragraphs: d.fields.map(
        (f) =>
          `${f.label}: ${f.value || '[não preenchido]'}${f.origin === 'manual' && f.source_key ? ` (valor original extraído: ${f.original_value ?? 'indisponível'})` : ''}`,
      ),
    },
    ...d.sections.map((s) => ({
      title: s.title,
      paragraphs: [materialize(s.text)],
    })),
    {
      title: 'Indicadores do recorte selecionado',
      table: {
        columns: ['Indicador', 'Valor'],
        rows: Object.entries(d.sources.metrics).map(([k, value]) => [
          k,
          value === null ? 'Indisponível' : String(value),
        ]),
      },
      paragraphs: [
        'Ausência de fonte não equivale a zero. Valores de avaliações sem moeda declarada não são somados nem convertidos.',
      ],
    },
    ...d.sources.tables
      .filter((t) => d.template.data.tables.includes(t.family))
      .map((t) => ({
        title: families[t.family] ?? t.family,
        table: {
          columns: t.columns,
          rows: t.rows.map((row) =>
            row.map((c) => (c === null ? 'Não informado' : String(c))),
          ),
        },
        paragraphs: [`${t.rows.length} registro(s) · Fonte SHA-256: ${t.hash}`],
      })),
    {
      title: 'Observações técnicas',
      paragraphs: [materialize(d.technical_notes) || '[não preenchido]'],
    },
    {
      title: 'Conclusão',
      paragraphs: [materialize(d.conclusion) || '[não preenchido]'],
    },
    {
      title: 'Responsáveis declarados',
      paragraphs: d.responsibles.length
        ? d.responsibles.flatMap((r) => [
            r.display_name,
            `${r.function} · Usuário #${r.user_id}`,
            `Registro declarado: ${r.professional_registration || 'Não informado'}`,
            ...(r.registration_evidence
              ? [`Referência comprobatória: ${r.registration_evidence}`]
              : []),
          ])
        : ['Nenhum responsável vinculado.'],
    },
    {
      title: 'Referências e limitações',
      paragraphs: [
        'Aprovação interna não equivale a assinatura digital, ART/RRT ou comprovação de habilitação profissional.',
        `Critérios: ${JSON.stringify(d.sources.selection)}`,
        `Fontes sem informação suficiente: ${d.sources.missing.join(', ') || 'Nenhuma identificada; não certifica completude do trabalho.'}`,
        ...v.validation.issues.map(
          (i) =>
            `${i.severity === 'block' ? 'Bloqueio' : 'Aviso'}: ${i.message}`,
        ),
        `Fontes SHA-256: ${d.sources.hash}`,
        `Modelo de conteúdo SHA-256: ${d.template.hash}`,
      ],
    },
  ];
  return {
    title: d.title,
    subtitle: d.template.data.report_type,
    version: `Revisão ${v.revision} · versão ID ${v.id}`,
    date: documentDate(v.recordedAt),
    status: 'Versão aprovada preservada',
    sourceHash: v.hash,
    visual: d.visual_template ?? { ...DEFAULT_VISUAL },
    blocks,
  };
}
export function budgetDocument(
  v: BudgetVersionEntity,
  approved: boolean,
  proposal: boolean,
  memory: boolean,
): ProfessionalDocument {
  const s = v.snapshot,
    c = s.calculation,
    money = (n: string) => documentMoney(n, c.currency);
  const blocks: DocumentBlock[] = [
    {
      title: 'Cliente e projeto',
      paragraphs: [
        s.context.company.name,
        s.context.company.address ?? '',
        s.context.project?.name ?? 'Projeto não vinculado',
        ...s.context.units.map((u) => `${u.name}: ${u.address}`),
        ...s.input.addresses,
      ],
    },
    { title: 'Escopo', paragraphs: [s.input.scope] },
    {
      title: 'Serviços e quantidades',
      table: {
        columns: ['Serviço', 'Quantidade de bens estimada (escopo global)'],
        rows: s.input.services.map((service) => [
          service,
          String(s.input.estimated_assets),
        ]),
      },
    },
    {
      title: 'Prazo e condições comerciais',
      paragraphs: [
        `Prazo estimado de campo: ${c.sizing.field_days} dia(s)`,
        `Equipe prevista: ${c.sizing.team} profissional(is)`,
        `Preço total: ${money(c.final_price)}`,
        `Validade: ${documentDate(s.input.valid_until)}`,
        `Elaboração: ${documentDate(s.input.prepared_on)}`,
        `Pagamento: ${c.payment.mode === 'cash' ? 'À vista' : 'Parcelado'}`,
      ],
      table: {
        columns: ['Tipo', 'Vencimento', 'Valor'],
        rows: c.payment.rows.map((r) => [
          r.kind === 'entry' ? 'Entrada' : `Parcela ${r.position}`,
          documentDate(r.due_on),
          money(r.amount),
        ]),
      },
    },
  ];
  if (memory)
    blocks.push({
      title: 'Memória de cálculo interna · inclusão solicitada explicitamente',
      table: {
        columns: ['Custo', 'Quantidade', 'Valor unitário', 'Subtotal'],
        rows: c.lines.map((l) => [
          l.label,
          String(l.quantity),
          money(l.unit_value),
          money(l.subtotal),
        ]),
      },
      paragraphs: [
        `Custo total: ${money(c.cost_total)}`,
        `Margem: ${c.rates.margin_pct}%`,
        `Comissão: ${c.rates.commission_pct}%`,
        `Impostos: ${c.rates.tax_pct}%`,
        ...Object.values(c.formulas),
      ],
    });
  return {
    title: `${proposal ? 'Proposta comercial' : 'Orçamento'} ${s.input.number}`,
    subtitle: s.context.company.name,
    version: `Versão ${v.version} · ID ${v.id}`,
    date: documentDate(v.recordedAt),
    status: approved
      ? 'Versão aprovada preservada'
      : 'NÃO APROVADO · documento para análise',
    sourceHash: v.hash,
    visual: s.visual_template ?? { ...DEFAULT_VISUAL },
    blocks,
  };
}
