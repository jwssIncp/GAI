# Acessibilidade

Melhorias alinhadas a WCAG 2.2 AA, sem alegação de conformidade integral.

- Contraste semântico medido, com correção de textos verdes/sucesso e distinção entre aviso preenchido e sutil.
- Foco visível, link para pular ao conteúdo e um landmark main no layout autenticado.
- Diálogos e menu mobile com semântica Radix, Tab contido e Escape; retorno de foco explicitamente verificado.
- Navegação e breadcrumbs nomeados; rota atual identificada.
- Busca com nome acessível, labels existentes preservados, indicador visual de obrigatório sem alterar o nome acessível e aria-describedby composto.
- Caption/scope em DataTable e região de rolagem focável.
- Feedback de erro com role=alert, carregamento/status e ações pendentes desabilitadas.
- Controles padrão/toque em 44 px; alvos compactos mantidos no desktop.
- prefers-reduced-motion respeitado no CSS e animação de séries Recharts desabilitada.

## Contrastes medidos

| Tema | Texto / fundo | Razão |
| --- | --- | ---: |
| light | foreground / background | 17.10:1 |
| light | foreground / card | 17.87:1 |
| light | popover-foreground / popover | 17.87:1 |
| light | muted-foreground / card | 5.67:1 |
| light | primary-text / background | 5.11:1 |
| light | primary-text / primary-subtle | 5.00:1 |
| light | primary-foreground / primary | 11.24:1 |
| light | destructive-foreground / destructive | 4.67:1 |
| light | success / success-subtle | 5.00:1 |
| light | success-foreground / success | 5.34:1 |
| light | info / info-subtle | 5.10:1 |
| light | warning-text / warning-subtle | 7.88:1 |
| light | warning-foreground / warning | 6.85:1 |
| dark | foreground / background | 17.42:1 |
| dark | foreground / card | 16.30:1 |
| dark | popover-foreground / popover | 15.94:1 |
| dark | muted-foreground / card | 7.55:1 |
| dark | primary-text / background | 13.29:1 |
| dark | primary-text / primary-subtle | 8.84:1 |
| dark | primary-foreground / primary | 11.24:1 |
| dark | destructive-foreground / destructive | 6.77:1 |
| dark | success / success-subtle | 5.91:1 |
| dark | success-foreground / success | 8.82:1 |
| dark | info / info-subtle | 5.99:1 |
| dark | warning-text / warning-subtle | 9.57:1 |
| dark | warning-foreground / warning | 8.93:1 |

Os pares de texto usam limiar 4,5:1. A inspeção inclui teclado real em Chromium, screenshots e verificações de semântica compartilhada. Não foi feita certificação externa, auditoria completa com leitor de tela, zoom de 400%, toda condição de erro ou todos os estados de gráficos. Mapa, tabelas próprias e formulários especializados têm cobertura representativa; consulte ações não verificadas individualmente.
