# Responsividade

Matriz exigida: 360, 390, 768, 1024, 1366 e 1920 px, nos temas claro e escuro. Altura de 900 px nos testes. Foram registrados 96 percursos de página com medidas de viewport/documento e controles visíveis em observed-*.json.

Em 360 e 1366 px, a matriz percorre projetos, resumo, dashboard, itens, sessões de inventário, base contábil, preparação, campo, contratos, orçamentos, financeiro do projeto, laudos, recebíveis, caixa, DRE, usuários, perfis e empresas. Nos demais tamanhos, valida projetos, dashboard de projeto e recebíveis. Login, drawer de projeto e navegação também têm capturas próprias em 390 e 1366 px.

Sidebar de desktop a partir de 1024 px; abaixo disso, diálogo mobile. Abas de projeto e seções rolam horizontalmente. Tabelas largas mantêm todas as colunas e ações em uma região rolável/focável; indicação de gesto no mobile. Formulários preservam todos os campos e drawers podem ocupar a largura inteira no celular.

Teste adicional de toque real emulado em 360, 390, 768 e 1024 px nos dois temas: coarse pointer, todos os 27 alvos de UF com pelo menos 44×44 px, filtro SP acionado por tap e menu aberto/fechado por toque. Cards estreitos trocam a geometria do cartograma por uma grade alfabética de UFs mediante container query; nenhuma UF é removida. Rótulos dos pontos usam superfície opaca para não perder contraste sobre a intensidade do mapa. Evidência em touch.json e touch-map-*.png.

A matriz exige document.scrollWidth <= viewport + 1 px; rolagem interna intencional de tabelas/abas é permitida. Não se oculta coluna ou ação essencial para obter aprovação. Screenshots e medições não certificam todo dispositivo, zoom, conteúdo extremo ou teclado virtual.
