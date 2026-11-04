# Interface de usuários

## Cadastro e edição

O drawer foi retirado do fluxo principal. “Cadastrar usuário” leva a `/app/users/new`, mantendo sidebar, topbar, marca, tipografia, cores e tokens dos temas do GAI. `/app/users/:id/edit` reutiliza `UserEditor` e os mesmos campos.

O formulário permanece em uma página, com seções de identificação; organização e perfis; credenciais e ativação; e ações. Nome completo é obrigatório para novas contas. Nome desconhecido de conta legada pode permanecer vazio, sem inventar dados ou impedir edição de outro campo. Edição envia somente campos alterados, preservando o login original quando não editado.

Telefone e cargo são opcionais. O seletor organizacional da plataforma usa nomes, pesquisa e paginação e consulta somente organizações ativas para cadastro. Administradores organizacionais têm contexto fixado pelo servidor. A plataforma é uma opção explícita, mantendo a semântica de organização nula.

Perfis são apresentados como opções com descrição de responsabilidade. É possível selecionar vários; a interface explica a soma de acessos e os perfis sem permissões. Concessão administrativa exige ciência explícita. Alterações sensíveis de organização/perfis usam confirmação, e a API repete todas as verificações.

Convite por e-mail é preferencial quando há entrega configurada. Em modo simulado, a interface explica a indisponibilidade e oferece senha temporária com troca obrigatória e prazo informado. Na edição, a senha não aparece no formulário geral; redefinição é uma ação protegida separada.

## Navegação, erros e estados

Há breadcrumb, retorno à listagem e cancelar. `useBlocker` solicita confirmação antes de descartar alterações; `beforeunload` também protege atualização/fechamento da aba. O navegador controla a mensagem nativa nesse último caso.

Carregamentos e falhas de API têm estados próprios e nova tentativa. Erros mantêm os dados preenchidos. Submissões e ações exibem estado ocupado e evitam acionamento repetido. Sucesso invalida as consultas e apresenta notificação; a edição dos próprios acessos atualiza a sessão. Se a conta deixa de ser administrativa, o retorno é à visão geral.

## Listagem e detalhes

A busca é feita no servidor por nome, login ou e-mail. Filtros de organização, perfil e estado, ordenação e página ficam no endereço. A listagem reúne identificação, organização por nome, perfis, situação efetiva, último acesso e menu de ações.

O menu usa o Radix Dropdown já instalado, com foco e navegação por teclado. Disponibiliza detalhes, edição, perfis, bloqueio/liberação, desativação/reativação, redefinição e reenvio conforme a conta e os direitos do ator. Operações sensíveis usam confirmação; erros do último administrador são exibidos.

Contas sem nome legado exibem o login. Último acesso desconhecido é informado como não registrado. Não se fabricam datas históricas anteriores à implantação do novo campo. A página de detalhes apresenta os dados cadastrais sem senha ou hash.

## Ativação e senha

`/activate-account` utiliza o layout de autenticação do GAI. Recebe o token no fragmento, remove-o do endereço e pede senha e confirmação. Erros indicam a possibilidade de expiração e orientação para solicitar reenvio. Após ativar, o usuário entra com sua própria senha.

`/app/change-password` atende troca voluntária e primeiro acesso. Enquanto houver troca obrigatória, o frontend redireciona para essa página e o backend impede acesso aos módulos. Após alterar, a nova autenticação é obrigatória. Meu perfil possui o link de troca voluntária.

## Responsividade e acessibilidade

Os campos usam duas colunas quando há espaço e uma coluna no celular; ações se empilham em larguras menores. A tabela mantém rolagem interna conforme o componente existente, sem alargar a página. Sidebars e topbar usam o comportamento responsivo já adotado pelo GAI.

Foram reutilizados PageContainer, PageHeader, FormField, Input, Button, DataTable, Pagination, SearchInput, ConfirmDialog, ModalForm e notificações. SearchInput passou a aceitar o ID de FormField para associação correta de label. Erros de campo usam `role=alert`, rótulos e descrições associadas; foco e teclado foram exercitados em Chromium. Não foi certificada conformidade integral com leitores de tela.

As capturas em [screenshots](./screenshots/) usam dados sintéticos em SQLite temporário. Incluem listagem, cadastro e edição em desktop, tablet e celular, em temas claro/escuro, além da ativação pública. A regressão de Perfis e acessos possui capturas no subdiretório próprio, sem substituir as evidências do trabalho anterior.
