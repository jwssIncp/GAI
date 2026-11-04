# Temas claro, escuro e sistema

Uma única preferência gai.theme, com valores light/dark/system; ausência ou valor desconhecido usa o sistema. O script no head aplica classe e color-scheme antes do módulo React. O hook existente foi evoluído com useSyncExternalStore: mídia, storage entre abas e evento local sincronizam os consumidores sem estados divergentes. Storage bloqueado tem fallback de memória.

Menus/diálogos em portals herdam tokens do html. Inputs não são mais forçados a branco pelo FilterPanel. Cards, tabelas, filtros, modal, drawer, toast, dropdown, foco, logo e Recharts seguem o tema. Tooltips de terceiros recebem superfície e texto semânticos. Gráficos deixam de animar, também evitando movimento que CSS reduced-motion não controlaria.

Prévia de laudo continua como papel branco com texto escuro: é conteúdo documental deliberado, não superfície da aplicação. A marca do produto foi integrada apenas na identificação GAI já existente da prévia. Cores editáveis do documento e identidades de clientes permanecem preservadas.

Contraste calculado de 26 pares na execução atual: [contrast.json](evidencias/visual/contrast.json). Isso valida os pares especificados, não todas as composições, transparências, gráficos ou combinações possíveis da aplicação.
