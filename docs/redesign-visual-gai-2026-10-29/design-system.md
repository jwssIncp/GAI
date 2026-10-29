# Design system

Fonte de verdade: src/styles/globals.css e tailwind.config.ts. A identidade principal mantém brand-ink, brand-navy, brand-green, brand-green-deep e brand-teal. Ajustes de contraste ficam nos tokens de uso, sem trocar a paleta.

| Token | Claro (HSL ou dimensão) | Escuro (herda quando ausente) |
| --- | --- | --- |
| --brand-ink | 216 100% 6% | 216 100% 6% |
| --brand-navy | 214 98% 16% | 214 98% 16% |
| --brand-green | 151 92% 46% | 151 92% 46% |
| --brand-green-deep | 157 100% 39% | 157 100% 39% |
| --brand-teal | 164 100% 31% | 164 100% 31% |
| --background | 210 25% 98% | 215 64% 7% |
| --foreground | 222 47% 11% | 210 33% 96% |
| --card | 0 0% 100% | 214 52% 10% |
| --card-foreground | 222 47% 11% | 210 33% 96% |
| --popover | 0 0% 100% | 214 48% 11% |
| --popover-foreground | 222 47% 11% | 210 33% 96% |
| --surface | 150 20% 98% | 215 59% 8% |
| --surface-elevated | 0 0% 100% | 214 48% 12% |
| --primary | 151 92% 46% | 151 92% 46% |
| --primary-foreground | 216 100% 6% | 216 100% 6% |
| --primary-subtle | 151 80% 95% | 154 62% 14% |
| --primary-hover | 151 92% 42% | 151 85% 54% |
| --primary-text | 164 100% 24% | 151 80% 68% |
| --disabled | 214 14% 48% | 214 16% 58% |
| --control-height | 2.75rem | 2.75rem |
| --secondary | 210 29% 95% | 213 34% 16% |
| --secondary-foreground | 216 60% 14% | 210 30% 94% |
| --muted | 210 29% 96% | 214 32% 15% |
| --muted-foreground | 215 16% 42% | 212 16% 67% |
| --accent | 164 58% 92% | 164 47% 16% |
| --accent-foreground | 164 100% 24% | 158 84% 72% |
| --destructive | 348 77% 50% | 348 85% 72% |
| --destructive-foreground | 0 0% 100% | 348 80% 12% |
| --success | 160 84% 26% | 157 100% 39% |
| --success-foreground | 0 0% 100% | 216 100% 6% |
| --success-subtle | 151 80% 95% | 156 55% 14% |
| --warning | 38 92% 50% | 40 94% 58% |
| --warning-foreground | 30 92% 13% | 35 94% 10% |
| --warning-subtle | 42 100% 93% | 39 52% 14% |
| --warning-text | 30 92% 24% | 40 94% 72% |
| --info | 205 91% 36% | 198 82% 55% |
| --info-foreground | 0 0% 100% | 216 100% 6% |
| --info-subtle | 203 73% 95% | 201 50% 15% |
| --border | 210 24% 88% | 213 32% 20% |
| --input | 214 18% 54% | 214 22% 43% |
| --ring | 164 100% 25% | 151 92% 46% |
| --sidebar | 214 98% 16% | 214 98% 16% |
| --sidebar-foreground | 0 0% 100% | 0 0% 100% |
| --sidebar-muted | 211 22% 72% | 211 22% 72% |
| --sidebar-accent | 202 100% 24% | 202 100% 24% |
| --sidebar-border | 210 64% 24% | 210 64% 24% |
| --topbar | 216 100% 6% | 216 100% 6% |
| --topbar-foreground | 0 0% 100% | 0 0% 100% |
| --topbar-muted | 213 18% 70% | 213 18% 70% |
| --topbar-border | 216 55% 14% | 216 55% 14% |
| --chart-1 | 157 100% 30% | 151 92% 46% |
| --chart-2 | 164 100% 31% | 157 100% 39% |
| --chart-3 | 214 98% 16% | 198 71% 48% |
| --chart-4 | 151 70% 30% | 164 72% 48% |
| --chart-5 | 198 71% 38% | 214 18% 62% |
| --shadow-color | 216 72% 12% | 216 100% 2% |
| --radius | 0.75rem | 0.75rem |

Tipografia usa a pilha local existente Inter/Geist/system-ui, sem carregar fontes remotas. Títulos principais em torno de 32 px, seções em 20/24 px e corpo/controles em 14 px. KPIs usam números tabulares e quebra quando necessário. Espaçamento usa a escala Tailwind de 4 px; cartões e formulários priorizam 16–24 px.

Raio base de 12 px, variações já existentes e sombras semânticas. Botões padrão e ícones em 44 px; versão compacta em 36 px, ampliada em ponteiros de toque. Input/select/textarea em pelo menos 44 px. Foco com ring semântico e reduced-motion respeitado.

Reutilizados Button, Input, FormField, FilterPanel, MetricCard, ProgressCard, DataTable, Pagination, Tabs, ModalForm, DrawerForm, ConfirmDialog, States e Toast. GaiLogo é o único componente visual de marca novo. Contratos existentes mantidos; DataTable recebe apenas caption opcional e Topbar recebe navigationOpen opcional.

Primary é preenchimento de marca; primary-text é texto legível. Warning-foreground é texto sobre warning preenchido; warning-text é texto sobre warning-subtle. Não intercambiar esses pares. Gráficos usam chart-1 a chart-5 e mantêm fórmulas/dados originais.
