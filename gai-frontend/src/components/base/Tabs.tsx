import { NavLink, useLocation } from 'react-router-dom';
import { navigationHref } from '@/features/projects/navigationContext';

/** Aba que é rota: ativa pela URL (NavLink marca aria-current="page"). */
export type LinkTab = { label: string; to: string; /** Ativa só no caminho exato (ex.: a aba inicial). */ end?: boolean };
/** Aba da mesma tela (ex.: ?tab= do detalhe): ativa por `value`. */
export type ButtonTab = { label: string; value: string };

type LinkTabsProps = {
  tabs: LinkTab[];
  /** Nome acessível da navegação. */
  label?: string;
  /** Mantém o contexto da URL (projeto, retorno e filtros do módulo) ao trocar de aba. Padrão: sim. */
  keepContext?: boolean;
};
type ButtonTabsProps = { tabs: ButtonTab[]; label?: string; value: string; onChange: (value: string) => void };

/**
 * Barra de abas única do sistema (classe `.section-navigation`): a aba ativa tem
 * aria-current="page", que também define o destaque visual.
 * - Abas de rota: `tabs=[{ label, to, end? }]`.
 * - Abas da mesma tela: `tabs=[{ label, value }]`, `value` e `onChange`.
 */
export function Tabs(props: LinkTabsProps | ButtonTabsProps) {
  const label = props.label ?? 'Navegação da seção';
  if ('onChange' in props) {
    return (
      <nav aria-label={label} className="section-navigation">
        {props.tabs.map((tab) => (
          <button key={tab.value} type="button" aria-current={tab.value === props.value ? 'page' : undefined} onClick={() => props.onChange(tab.value)}>
            {tab.label}
          </button>
        ))}
      </nav>
    );
  }
  return <LinkTabs {...props} label={label} />;
}

function LinkTabs({ tabs, label, keepContext = true }: LinkTabsProps) {
  const location = useLocation();
  return (
    <nav aria-label={label} className="section-navigation">
      {tabs.map((tab) => (
        <NavLink key={tab.to} end={tab.end} to={keepContext ? navigationHref(tab.to, location.search) : tab.to}>
          {tab.label}
        </NavLink>
      ))}
    </nav>
  );
}
