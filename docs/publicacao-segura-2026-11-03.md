# Preparação da publicação segura do GAI — iniciada em 2026-11-03

Conferência final: 2026-11-04, fuso America/Sao_Paulo.

Repositório: `jwssIncp/GAI`. Branch de trabalho e destino: `feature/gai-ajustes-homologacao`. Base da consolidação: `fa068e06f66d63760a0dd67389826e0d3c6f962b`.

## Credenciais

Foram removidos valores que coincidiam com as senhas de seed locais de scripts de auditoria, exemplos de contratos, documentação e testes. Não foram alteradas as credenciais dos ambientes existentes.

- Scripts que autenticam em uma API recebem as credenciais do ambiente do processo, por meio de `scripts/runtime-credentials.cjs`, sem senha padrão nem carregamento automático de `.env` para essa autenticação.
- Os testes de navegador leem `SEED_ADMIN_PASSWORD`, `SEED_TEST_USER_PASSWORD` e, quando definido, `SEED_ORG_ADMIN_PASSWORD`. A ausência de uma credencial necessária produz erro contendo somente o nome da variável.
- As fixtures de banco descartável usam valores sintéticos próprios. No modo explícito de navegador, o servidor de fixtures usa os mesmos valores fornecidos ao executor, permitindo senhas diferentes para os três perfis.
- A verificação de navegador desta publicação fornece senhas aleatórias e independentes, válidas somente durante o banco SQLite em memória criado pelo teste. Nenhum valor é incluído neste relatório.

### Exposição anterior e rotação

A inspeção dirigida dos valores de seed conhecidos encontrou ocorrências em nove arquivos e dez commits distintos acessíveis no histórico local, incluindo `d80a8b164709176f11ea4addc6078e0e90a22291` e `bdfbdb46b904908c5a2a8a3f3919fa936b75e246`. Os arquivos incluem documentação de onboarding, contratos e exemplos de autenticação, o DTO de login e testes antigos. Essa inspeção dirigida não equivale a uma auditoria exaustiva de todos os segredos históricos. Os caminhos, hashes e nomes de variáveis identificados estão no [inventário histórico sem valores de credenciais](publicacao-segura-2026-11-03-exposicao-historica.json).

Recomenda-se trocar essas senhas em qualquer ambiente persistente em que tenham sido reutilizadas, atualizar a configuração de execução correspondente e revogar as sessões afetadas. A correção atual não elimina os valores do histórico. Nenhum histórico foi reescrito e nenhuma senha ou conta existente foi modificada automaticamente.

## Organização do Git

Foram retirados apenas do índice 18.416 arquivos: dependências de `gai-frontend/node_modules`, conteúdo de `dist`, resultados de testes, arquivos TypeScript incrementais, um log, o `.env.local` do frontend e três capturas geradas de autenticação. `git rm --cached` preservou os arquivos existentes no disco; dois assets de build já estavam ausentes antes desta intervenção.

O `.gitignore` passou a cobrir resultados de testes, caches, traces, logs e cópias de trabalho geradas pelas auditorias. Dumps sintéticos de banco e capturas de autenticação também ficam locais. Foram preservados no versionamento os fontes principais, migrations, testes, configurações, relatórios técnicos, evidências finais pertinentes e o pacote SheetJS vendorizado necessário à instalação reproduzível.

Os três arquivos de código e teste previamente preparados no staging foram mantidos e integrados à seleção completa das alterações legítimas.

A consolidação inclui 1.820 arquivos adicionados, 244 modificados e 18.416 removidos do rastreamento. As remoções correspondem exclusivamente aos artefatos e arquivos locais descritos acima. Desses caminhos, 18.414 continuam presentes no disco; os outros dois são os assets de build que já estavam ausentes.

## Validações

Todas as verificações abaixo foram concluídas. Os logs brutos e as saídas detalhadas permanecem em `.local/`, fora do versionamento.

- Lint e build do frontend: aprovados.
- Lint, verificação completa de tipos e build do backend: aprovados. A checagem de tipos identificou um parâmetro `unknown` incompatível com o Supertest em um helper de teste já existente nas alterações locais; o parâmetro foi tipado como objeto, sem mudar os payloads ou regras de negócio.
- Frontend: 335 testes aprovados em 55 arquivos.
- Backend padrão: 798 testes aprovados, quatro testes condicionais ignorados, 120 suítes aprovadas.
- Regressão de cadastro de projetos repetida após a alteração de fixtures: 27 testes aprovados.
- Integração MySQL descartável: 411 testes aprovados em 50 suítes, sem falhas ou testes ignorados.
- Scripts de credenciais e preparação de documentos: sete testes aprovados.
- Armazenamento S3 compatível descartável: sete testes aprovados.
- Navegador: dois testes aprovados com credenciais aleatórias distintas por perfil.
- Migrations: 36 arquivos passaram na inspeção estática de sintaxe, identidade, timestamps únicos e métodos `up`/`down`. A suíte MySQL validou a execução em schema novo, a integridade dos índices e metadados e a ausência de migrations pendentes.
- Varredura dos textos, incluindo UTF-16, e de 30 arquivos Office compactados: nenhuma coincidência com os segredos locais conhecidos.
- PDFs: 34 documentos, 1.011 páginas examinadas, nenhuma coincidência com os segredos locais conhecidos e nenhuma falha de leitura.
- Pacote SheetJS vendorizado: SHA-256 conferido com a proveniência registrada; mantido no repositório por ser dependência necessária.

Nenhuma migration foi aplicada a um banco persistente ou de produção. Os serviços auxiliares desta validação são containers locais descartáveis. A suíte MySQL foi reiniciada com o diretório de dados em memória, após lentidão nas recriações de schema no armazenamento do container. Nesse banco descartável, a sincronização física dos logs foi reduzida; os testes cobrem a integridade transacional e não simulam perda física ou desligamento abrupto do servidor. Não houve deploy nem alteração do ambiente AWS.
