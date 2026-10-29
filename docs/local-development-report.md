# Ambiente local GAI

Validado em 26/10/2026. API, frontend e MySQL mantidos em execução. O núcleo está disponível para desenvolvimento; arquivos binários em object storage permanecem pendentes.

## A. Arquitetura confirmada no código

- `gai-backend`: TypeScript 5.9.3, NestJS 11.1.27, Express, TypeORM 0.3.30 e mysql2 3.22.5. API REST `/api/v1`, Swagger `/api/docs`, autenticação com token opaco Bearer e permissões RBAC. Módulos de organizações, usuários/perfis, empresas/unidades, projetos, inventariantes, inventário/operações/evidências, catálogo, base contábil, pendências, pagamentos/despesas, prestações, importações, exportações e dashboard.
- `gai-frontend`: React 19.2.7, React Router 7, Vite 6.4.3, TypeScript, Tailwind, React Query e Axios. `VITE_API_BASE_URL=/api/v1`; Vite encaminha `/api` para `http://localhost:3000`.
- MySQL 8.0.46 em Docker, volume nomeado já existente `gai_mysql_data`. Banco local `gai`, sem conexão com produção.
- Exportações têm processador interno com polling no processo NestJS. Não foi identificada dependência obrigatória de Redis ou outro broker.
- E-mail local usa mock; SES é integração opcional. Storage usa assinatura HMAC própria `X-GAI-*`, sem implementação AWS SigV4.
- `infra/`: Terraform/AWS de homologação e produção, não executado nem alterado. `docs/`: documentação operacional; `scripts/`: utilitários.
- Não há PHP/Laravel, Vue ou microsserviços adicionais na aplicação analisada.

## B. Ambiente e configuração

- Windows, Node 24.18.0 e npm 11.16.0, compatíveis com o Node 24 do Dockerfile.
- Docker 29.5.3 / Compose 5.1.4 disponíveis. Docker exigiu execução fora do sandbox para acesso ao pipe.
- Git disponível; PHP, Composer e cliente MySQL não estão no PATH e não são necessários a esta arquitetura. MySQL foi acessado pelo driver real da aplicação.
- `.env` backend e `.env.local` frontend existentes foram preservados. Valores locais e mock de e-mail confirmados sem imprimir credenciais.
- Portas 3000, 3306 e 5173 estavam livres na inspeção inicial.
- Backend: dependências existentes válidas, sem reinstalação. Frontend: `npm.cmd ci --include=optional --no-audit --no-fund`, respeitando `package-lock.json`, para instalar executáveis Windows ausentes.
- API roda no host com watch; frontend no host com Vite; banco usa o Compose existente. O serviço Docker `app` foi analisado, mas não iniciado: executa migrations/seed automaticamente no primeiro boot e para quando detecta migrations pendentes. Execução explícita no host permitiu revisar o banco existente e reutilizar dependências instaladas.
- Quatro migrations de avanço aplicadas com sucesso: CreateInventoryOperations, CreateExpenseAccountabilities, CloseInventoryOperationGaps e FixEvidenceStorageKeyIndex. A última verifica conversão ASCII sem perda antes do ALTER. Estado final: 22 migrations, 59 tabelas, 3 usuários existentes. Não houve seed, rollback, wipe, remoção de volumes ou reset.

## C. Serviços e verificações

| Serviço | Tecnologia | Porta | Endereço | Resultado |
| --- | --- | --- | --- | --- |
| Frontend | React/Vite | 5173 | http://localhost:5173 | HTTP 200; login e dashboard reais no Chromium |
| API | NestJS | 3000 | http://localhost:3000/api/v1/health | HTTP 200, `status=ok` |
| Swagger | NestJS Swagger | 3000 | http://localhost:3000/api/docs | HTTP 200 |
| Banco | MySQL Docker `gai-mysql` | 3306 | localhost:3306 | healthy; consulta SQL real e migrations confirmadas |

Testes executados:

- Backend build Nest passou; 42 suítes / 202 testes unitários passaram.
- Frontend TypeScript + build Vite passaram; 24 arquivos / 164 testes Vitest passaram. Avisos de dimensões dos gráficos em JSDOM e bundle JS de aproximadamente 1,38 MB não impediram execução.
- Login API 200, `/auth/me` autenticado 200, listagens `/organizations` e `/projects` 200, logout 204. `/auth/me` sem token retornou 401, como esperado.
- Pelo proxy Vite: health 200, endpoint protegido sem token 401; HTML de `/` e `/login` e módulo de entrada retornaram 200.
- Chromium headless com API real: login usando credenciais locais já existentes, dashboard carregado e refresh passaram; nenhum `pageerror`. Evidência visual em `.local/dashboard.png`.
- Logs stderr finais da API e Vite vazios; Nest registrou inicialização bem-sucedida; MySQL saudável. Não houve teste funcional completo de todos os módulos nem execução da suíte de integração que pode criar ou alterar dados de teste.

## D. Problemas encontrados e soluções

1. PowerShell bloqueia `npm.ps1`: comandos usam `npm.cmd`, sem mudar ExecutionPolicy global.
2. Dependências frontend tinham atalhos Unix e não incluíam Rollup/esbuild Windows: reinstalação pelo lock corrigiu. A tentativa inicial de `npm rebuild` falhou por restrição de rede do sandbox; `npm ci` autorizado fora do sandbox concluiu.
3. esbuild não conseguia ler diretórios ancestrais no sandbox: Vite/build/testes executados fora do sandbox. Nenhuma alteração de código de negócio necessária.
4. Banco existente estava quatro migrations atrás: avanço explícito corrigiu o schema, preservando dados.
5. Uma tentativa adicional de iniciar a API retornou EADDRINUSE porque a API em watch já havia terminado de subir. O processo duplicado encerrou; a API original continuou funcional.
6. O repositório versiona 18.399 arquivos de `gai-frontend/node_modules`, apesar do ignore. A reinstalação alterou artefatos de plataforma e cache; isso não foi corrigido estruturalmente nesta tarefa.
7. Storage aponta para domínio `.invalid` e assina URLs com protocolo próprio incompatível com S3/MinIO padrão. Inicializar MinIO sozinho não resolve. Nenhum falso serviço de storage foi criado.

## E. Arquivos criados/alterados

- `scripts/local-start.ps1`: inicia MySQL e servidores ocultos com logs/PIDs, preservando processos que já ocupem as portas; não aplica migrations automaticamente.
- `scripts/local-stop.ps1`: encerra árvores dos processos registrados após conferir nome/comando e para apenas o MySQL do Compose, preservando volume.
- `docs/local-development-report.md`: este relatório.
- `.local/.gitignore`, `backend.pid`, `frontend.pid`, `processes.json`, logs de backend/frontend, `smoke.cjs`, `dashboard.png` e `generated-changes.txt`: artefatos locais ignorados de operação, teste e diagnóstico. `processes.json` é registro inicial; os arquivos `.pid` são usados pelos scripts.
- `gai-frontend/tsconfig.app.tsbuildinfo`: cache gerado pelo build TypeScript.
- `gai-frontend/node_modules/`: atalhos, binários e cache regenerados pela instalação Windows. Relação individual das diferenças rastreadas em `.local/generated-changes.txt`; os arquivos `.cmd` e pacotes opcionais da plataforma também foram instalados localmente.
- Os arquivos de lock do projeto, `.env`, Compose, Dockerfile e código de negócio não foram modificados nesta tarefa. As alterações preexistentes em serviços, entidade, migrations, testes e relatórios foram preservadas. Nenhum commit, push ou merge.

## F. Comandos futuros

Execute na raiz do repositório, com Docker Desktop ativo:

```powershell
# Iniciar em segundo plano (logs em .local)
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\local-start.ps1

# Parar, preservando o banco
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\local-stop.ps1

# Reiniciar
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\local-stop.ps1
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\local-start.ps1

# Logs (cada comando pode ser usado separadamente)
Get-Content .local\backend.log -Tail 50 -Wait
Get-Content .local\frontend.log -Tail 50 -Wait
docker compose -f gai-backend/docker-compose.yml logs --tail 50 -f mysql

# Estado das migrations; revisar antes de aplicar novas
Set-Location gai-backend
npm.cmd run migration:show
# Somente depois da revisao: npm.cmd run migration:run
npm.cmd run build
npm.cmd test -- --runInBand test/unit
Set-Location ..\gai-frontend
npm.cmd run build
npm.cmd test
Set-Location ..

# Smoke com navegador e credenciais locais, sem imprimi-las
node .local/smoke.cjs
```

Alternativa interativa: `npm.cmd run start:dev` em `gai-backend` e `npm.cmd run dev -- --host 127.0.0.1 --strictPort` em `gai-frontend`, em terminais separados; Ctrl+C encerra cada servidor. Não executar simultaneamente com os processos em segundo plano nas mesmas portas. Credenciais locais permanecem em `gai-backend/.env` nos campos `SEED_ADMIN_LOGIN` e `SEED_ADMIN_PASSWORD`.

## G. Pendências e limites

- Upload/download binário de imagens, comprovantes e evidências depende de integração de storage funcional. Corrigir protocolo de assinatura e validação de objetos é mudança funcional relevante, fora das correções de inicialização autorizadas; precisa de escopo/decisão antes de implementação. Não foi testado contra storage real nesta execução.
- E-mail externo não foi testado: mock local ativo.
- Filas internas iniciaram com a API, mas não foi criado job real de exportação nesta rodada.
- A suíte Playwright de homologação preexistente exige fixtures específicas; foi usado smoke local independente sem inventar esses dados. Integração completa dos domínios e permissões não foi revalidada.
- Bundle grande e dependências versionadas são melhorias futuras; nenhuma refatoração ou atualização de versões aplicada.
- Resultado: núcleo local operacional e verificado; ambiente funcional completo permanece parcial por causa do storage. Nenhuma ação destrutiva depende de autorização para o uso atual.
