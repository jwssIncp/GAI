# Navegação e UX

Rotas e permissões continuam como fonte de verdade. navigationContext/navigationHref da Onda 2 permanecem responsáveis pelo transporte e pela validação do contexto, incluindo return_to restrito. Não houve mudança de autenticação, guards ou autorização de projeto.

- Visão geral e Dashboard iniciam as abas do projeto; módulos financeiros e laudos permanecem disponíveis.
- Sidebar coloca a visão geral e os projetos antes dos módulos especializados. Recolhimento persistido em gai.sidebar.collapsed; rótulos acessíveis e titles nos ícones.
- Menu mobile usa Radix Dialog, Escape, foco contido, scroll lock e retorno explícito ao acionador. Trocar de rota fecha o menu; alcançar desktop também fecha.
- Breadcrumbs oferecem ancestrais válidos. O ProjectContextLink autorizado da Onda 2 foi preservado.
- O atalho de teclado para o conteúdo move foco e rolagem sem alterar o hash da rota, preservando a identificação da aba ativa de projeto.
- Abas e retorno da Preparação preservam return_to.
- Busca/página das listas administrativas usam URL; busca substitui o histórico de digitação e paginação cria entrada de histórico.
- A vista Pagamentos/Despesas usa tab=payments ou tab=expenses, mantendo refresh e voltar/avançar.

Validação real de links diretos, índices, filtros, voltar/avançar, refresh, origem do dashboard, leitor e limites entre organizações: suíte da Onda 2 reexecutada, resultado 14/14; 0 falhas; 0 ignorados. Novas verificações de preparação, breadcrumb e aba financeira: suíte de redesign, 23/23; 0 falhas; 0 ignorados. As rotas reservadas não foram transformadas em funcionalidades fictícias.
