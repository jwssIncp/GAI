/**
 * Mapa ÚNICO dos status financeiros (rótulo + tom), usado pelo StatusBadge
 * (`<StatusBadge finance="overdue" />`). As telas traduzem o status do domínio
 * para uma destas chaves; o rótulo e a cor vêm sempre daqui.
 *
 * Tons (todos AA nos dois temas):
 * - neutral: em aberto, sem alerta (Previsto, A pagar, Lançado)
 * - attention: âmbar suave (Não confirmado) · warning: âmbar (Pendente)
 * - danger: vermelho com --destructive-text (Em atraso) · danger-soft: vermelho suave (Cancelado)
 * - success: verde (Recebido, Pago) · info: azul (Aprovado)
 * - void: cinza riscado (Estornado) · estimate: cinza itálico (Estimado) · locked: cinza com cadeado (Fechada)
 *
 * Gênero: o rótulo padrão é o do lançamento genérico (masculino: "Pago", "Aprovado").
 * Quando a tela já usa outro rótulo no filtro (ex.: Despesas: "Paga", "Aprovada"),
 * passe esse rótulo em `label` — o badge usa o MESMO texto do filtro da tela e só
 * o tom vem do mapa.
 */
export type FinanceStatus =
  | 'forecast'
  | 'payable'
  | 'unconfirmed'
  | 'overdue'
  | 'received'
  | 'paid'
  | 'reversed'
  | 'cancelled'
  | 'pending'
  | 'approved'
  | 'posted'
  | 'estimated'
  | 'closed';

export type FinanceTone = 'neutral' | 'attention' | 'warning' | 'danger' | 'danger-soft' | 'success' | 'info' | 'void' | 'estimate' | 'locked';

export const financeStatuses: Record<FinanceStatus, { label: string; tone: FinanceTone; hint: string }> = {
  forecast: { label: 'Previsto', tone: 'neutral', hint: 'Entrada em aberto' },
  payable: { label: 'A pagar', tone: 'neutral', hint: 'Saída em aberto' },
  unconfirmed: { label: 'Não confirmado', tone: 'attention', hint: 'Previsto, ainda não confirmado' },
  overdue: { label: 'Em atraso', tone: 'danger', hint: 'Data prevista já passou' },
  received: { label: 'Recebido', tone: 'success', hint: 'Entrada realizada' },
  paid: { label: 'Pago', tone: 'success', hint: 'Saída realizada' },
  reversed: { label: 'Estornado', tone: 'void', hint: 'Desfeito por estorno; mantido no histórico' },
  cancelled: { label: 'Cancelado', tone: 'danger-soft', hint: 'Cancelado; não entra nos totais' },
  pending: { label: 'Pendente', tone: 'warning', hint: 'Aguarda aprovação' },
  approved: { label: 'Aprovado', tone: 'info', hint: 'Liberado para pagar' },
  posted: { label: 'Lançado', tone: 'neutral', hint: 'Valor lançado (não significa pago)' },
  estimated: { label: 'Estimado', tone: 'estimate', hint: 'Estimativa, sem lançamento' },
  closed: { label: 'Fechada', tone: 'locked', hint: 'Competência fechada; não aceita alteração' },
};

/** Classes de cada tom (fundo suave + texto AA + anel). */
export const financeToneClass: Record<FinanceTone, string> = {
  neutral: 'bg-muted text-foreground ring-border',
  attention: 'bg-warning-subtle/70 text-warning-text ring-warning/20',
  warning: 'bg-warning-subtle text-warning-text ring-warning/35',
  danger: 'bg-destructive/10 text-destructive-text ring-destructive/30',
  'danger-soft': 'bg-destructive/[0.06] text-destructive-text ring-destructive/15',
  success: 'bg-success-subtle text-success ring-success/20',
  info: 'bg-info-subtle text-info ring-info/20',
  void: 'bg-muted text-muted-foreground line-through ring-border',
  estimate: 'bg-muted text-muted-foreground italic ring-border',
  locked: 'bg-muted text-muted-foreground ring-border',
};
