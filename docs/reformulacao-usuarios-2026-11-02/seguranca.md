# Segurança e limites de validação

## Credenciais e sessões

O mecanismo continua sendo sessão persistida com token opaco, não JWT. Não foram encontrados refresh tokens independentes a revogar. Cada sessão carrega a versão de autenticação da conta. Redefinir ou trocar senha atualiza hash e `password_changed_at`, incrementa a versão, revoga sessões e invalida tokens pendentes na mesma transação. O guard confere versão, revogação, prazo, estado do usuário e organização.

A operação de rotação é compartilhada também com o comando operacional de administrador da plataforma. Uma redefinição explícita por esse comando segue a mesma política e revogação. O código do comando foi compilado e verificado por lint, sem executar provisionamento ou redefinição das contas locais.

O prolongamento de sessão atualiza apenas linhas não revogadas. Uma sessão antiga não volta a ser válida após uma redefinição. A criação da sessão é serializada com a mudança da senha por trava no usuário em MySQL. Requisições que já estavam em andamento antes de uma revogação não são interrompidas retroativamente; requisições protegidas posteriores precisam passar novamente pelo guard.

A senha temporária dá acesso somente a consulta da própria sessão, logout e troca de senha. Seu prazo padrão é 24 horas, configurável. A troca exige a credencial atual, uma senha diferente e nova autenticação após encerrar todas as sessões. Contas legadas mantêm `must_change_password=false`; suas credenciais anteriores não são alteradas por essa evolução de política.

## Política única

Novas senhas têm de 15 a 128 caracteres, contados por pontos de código, com espaços e frases permitidos. Não há exigência de classes de caracteres nem bloqueio de colagem. A validação definitiva está em `Password.create()`, utilizada em criação, redefinição administrativa, troca voluntária, recuperação, ativação e novo provisionamento de desenvolvimento. O algoritmo permanece Argon2id.

A escolha de comprimento e ausência de composição obrigatória segue as orientações de [NIST SP 800-63B, seção de senhas](https://pages.nist.gov/800-63-4/sp800-63b.html). Isso não é uma certificação de conformidade integral. Não foi adicionada consulta externa a senhas comprometidas, pois não existe infraestrutura configurada para esse serviço; tampouco foi introduzido envio de senhas para terceiros.

## Identificadores e entradas

Login é normalizado antes da validação: trim e minúsculas, de 3 a 100 caracteres, iniciando por letra/número e continuando com letras, números, ponto, hífen ou sublinhado. Espaços internos e `@` são recusados. E-mail é normalizado e validado separadamente, com limite de 255 caracteres.

Autenticação decide inequivocamente a coluna pela presença de `@`. CHECKs no banco mantêm separados os dois espaços de identificação e os índices UNIQUE garantem unicidade concorrente. A migration faz preflight das identidades existentes e não as renomeia.

Campos omitidos e nulos têm semânticas distintas. Nome, login, e-mail, lista de perfis e credenciais não aceitam `null` quando fornecidos. Telefone e cargo podem ser limpos explicitamente com `null`. Organização nula é reservada ao contexto de plataforma. A senha não faz parte do PATCH geral. Erros de unicidade são tratados especificamente; falhas internas genuínas não são convertidas indiscriminadamente em validação.

## RBAC e administração

O escopo é aplicado no servidor, incluindo consulta, cadastro, edição, redefinição, bloqueio e reenvio. Os perfis iniciais precisam existir, estar ativos, ser concedíveis e ser compatíveis com o destinatário. Atores organizacionais não criam contas em outra organização ou na plataforma e não concedem privilégios globais.

Os acessos de múltiplos perfis continuam cumulativos. O cadastro apresenta perfis e responsabilidades; não expõe o catálogo de 161 permissões. `ORG_USER` não recebe acessos implícitos. O Operador local permanece com uma permissão e sem gestão administrativa.

Bloqueio administrativo (`BLOCKED`), desativação (`INACTIVE`), convite (`PENDING_ACTIVATION`) e bloqueio temporário (`LOCKED` com prazo) são distintos. O prazo temporário é conferido e o contador reinicia corretamente após sua expiração. Falhas concorrentes usam a mesma trava de usuário, sem perder incrementos. Os mecanismos existentes de rate limiting continuam aplicados, com limites adicionais nas ações de credenciais e convites.

A proteção ao último administrador é reavaliada dentro da gravação, usando a trava administrativa já existente. A organização 2 continua sem administrador por ser um cenário local deliberadamente preservado.

## Convite e recuperação

Convites usam 32 bytes aleatórios, hash SHA-256 armazenado no repositório de tokens existente, propósito explícito, prazo configurável e consumo único. O consumo é serializado por usuário e confere novamente elegibilidade da conta, organização e perfil. Reenvio invalida o token anterior. Recuperação não permite ativar conta pendente nem contornar bloqueio administrativo.

O token de convite vai no fragmento da URL, que não integra a requisição HTTP ao frontend; a página o remove do endereço após a leitura. Não é retornado na resposta administrativa de cadastro. Não há endpoint público para inspecionar a caixa simulada. O harness de navegador contém somente um token sintético de teste, sem relação com qualquer conta local ou de produção.

Uma falha de entrega não ativa a conta. Ela permanece pendente e o resultado `FAILED` é informado ao administrador, que pode corrigir a configuração e reenviar. Envio e ativação possuem registros de auditoria. Não foi implementado um serviço externo adicional ou uma fila de e-mail; o reenvio administrativo é o mecanismo de recuperação operacional de entrega.

## Auditoria e riscos residuais

Operações administrativas registram ator, destinatário, operação e alterações antes/depois, incluindo perfis. Senhas são redigidas; tokens e URLs de ativação integram as regras de redação de logs. A auditoria de autenticação registra sucesso/falha e contexto permitido, sem credenciais.

Limites: SES real não foi exercitado porque o ambiente usa e-mail simulado; produção não foi acessada. Firefox, Safari e leitores de tela não foram certificados. A política atual ainda não integra bloqueio de senhas comprometidas ou MFA, que não foram requeridos como infraestrutura nova. A entrega deve passar por homologação do provedor de e-mail e do ambiente de destino antes de qualquer publicação autorizada.
