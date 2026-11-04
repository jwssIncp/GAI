# Correção da infraestrutura S3 do GitHub Actions

Classificação: **APTO COM RESSALVAS**. Download público, inicialização, health check, contrato S3 e limpeza foram executados localmente e aprovados. A execução do workflow modificado no runner do GitHub permanece pendente de publicação manual. Nenhum commit, push, deploy ou alteração de produção foi realizado nesta tarefa.

## Causa e evidências

A CI dependia de uma imagem MinIO sem acesso público no registry configurado. O erro ocorre antes de qualquer teste S3. Em 04/11/2026:

| Verificação executada | Resultado |
| --- | --- |
| Manifesto anônimo Docker Hub de `minio/minio` no digest antigo | HTTP 401; o comando Docker também retornou `denied` / `unauthorized` |
| Quay: digest antigo e releases `2025-09-07T16-13-09Z`, `2025-04-22T22-12-26Z`, `2025-09-06T17-38-46Z` | `no such manifest` em todas as consultas Docker |
| Manifesto anônimo da imagem Silo escolhida | HTTP 200; SHA256 do conteúdo recebido igual ao digest publicado |
| Pull efetivo da imagem Silo | Camadas baixadas e digest confirmado pelo Docker |
| Proveniência da imagem linux/amd64 baixada | Source `https://github.com/pgsty/silo`; revision `c3ad836aed0d8a7d23c2e44a5eaa3009d08525e3` |

Não houve resposta HTTP 429 nos probes executados. A evidência demonstra indisponibilidade pública da referência antiga; não permite distinguir definitivamente exclusão do repositório e mudança de visibilidade interna do registry. Não há indicação de que credenciais AWS, buckets, TypeORM ou os testes tenham causado a falha de pull. Fazer login não é requisito da imagem pública substituta.

O MinIO já existente no Docker local estava em cache. Isso explica por que iniciar esse artefato localmente funcionou nas validações anteriores, sem demonstrar que um runner novo conseguiria baixá-lo. O [repositório oficial MinIO](https://github.com/minio/minio#source-only-distribution) informa distribuição comunitária por código-fonte e está arquivado. A simples troca de Docker Hub para Quay foi descartada após as consultas reais acima.

## Imagens e escolha

Anterior:

```text
minio/minio@sha256:14cea493d9a34af32f524e538b8346cf79f3321eff8e708c1e2960462bd8936e
```

Substituta:

```text
docker.io/pgsty/silo:RELEASE.2026-10-26T00-00-00Z@sha256:7bb2aff6b89efe1cb1303c10fc21d579447434ed06649ac9ec05a5e2dbf30ad7
```

Silo é um fork mantido do MinIO, publicado por PGSTY; não é uma nova imagem oficial da organização MinIO. Foi escolhido porque preserva o contrato já usado pelos testes: API S3, variáveis `MINIO_*`, comando `server /data` e rota `/minio/health/ready`. A [release de origem](https://github.com/pgsty/silo/releases/tag/RELEASE.2026-10-26T00-00-00Z) está identificada por versão explícita e commit. O índice OCI validado inclui linux/amd64 e linux/arm64; a execução local usou linux/amd64, como o runner Ubuntu padrão.

SeaweedFS foi considerado como alternativa mantida com API S3, mas o fork Silo exigiu menos diferenças operacionais para esse contrato. Os sete testes originais passaram contra a imagem candidata antes de qualquer ampliação dos testes. Não foi necessário alterar aplicação, SDK, adaptador de produção ou configuração AWS.

Um digest garante o conteúdo selecionado, não a disponibilidade futura de um registry externo. O teste cobre o contrato atual do GAI em uma instância descartável; não certifica equivalência integral entre implementações S3 nem operações distribuídas de produção.

## Arquivos e comportamento

- `.github/workflows/ci.yml`: inicializa e verifica S3 antes da suíte MySQL para detectar falha de infraestrutura cedo; mantém ambas as suítes; adiciona diagnóstico em `failure()` e limpeza em `always()`.
- `.github/scripts/ci-s3.cjs`: centraliza a imagem fixa, pull explícito mesmo com cache, inicialização, readiness, diagnóstico restrito e limpeza segura.
- `.github/scripts/ci-s3.test.cjs`: nove casos de regressão de infraestrutura, incluindo registry indisponível, serviço encerrado, tentativas limitadas, falha parcial de criação, limpeza e recusa de remoção de contêiner alheio.
- `gai-backend/test/integration/storage/s3-isolated.e2e-spec.ts`: preserva os sete casos e acrescenta dois, cobrindo listagem/exclusão de versões e marcadores e rejeição de segredo sintético inválido.
- Este relatório registra diagnóstico, resultados, referências e validação posterior.

Foram inspecionados os seis workflows: CI, deploy app reutilizável, deploy homolog, deploy production, infra e ops reset admin. A única referência executável versionada ao servidor MinIO antigo estava em `ci.yml`. Referências de evidências antigas em `docs/correcao-pendencias-criticas-gai-2026-10-27/{README.md,testes.json}` e `docs/correcoes-onda-1-integridade-2026-10-28/evidencias/packaging-ci.json` foram preservadas como registros históricos.

O helper usa o nome `gai-ci-s3`, porta `127.0.0.1:33318:9000`, dados em tmpfs descartável e label `io.gai.ci.s3=disposable`. Recusa substituir um contêiner existente; diagnóstico e remoção verificam a label. `docker rm -f -v` remove o contêiner e volumes associados, sem procurar contêineres por prefixo ou atingir os serviços locais persistentes.

Readiness exige HTTP 200, com no máximo 30 tentativas, timeout de dois segundos por requisição e intervalo de um segundo. Os comandos Docker também têm timeout. A CI limita início a cinco minutos, S3 a dez, MySQL a quarenta e o job de integração a sessenta. Falhas de início tentam diagnóstico e limpeza imediatamente; a etapa `always()` cobre também falhas posteriores dos testes. Encerramento abrupto do runner depende adicionalmente do descarte da máquina efêmera pelo GitHub.

## Segurança e isolamento

- Credenciais de teste mantidas: usuário sintético `gai-validation` e segredo exclusivo de fixture; não são credenciais de produção. O segredo é ocultado no diagnóstico; o helper não imprime `Config.Env`.
- Endpoint fixo `http://127.0.0.1:33318`, bucket `gai-isolated-tests`, região `us-east-1` e path style, como na configuração de testes existente.
- `syntheticStorageEnv()` substitui as credenciais AWS por valores fictícios e remove o session token; os clientes adicionais também recebem endpoint e credenciais explícitos.
- O bucket é criado e versionado somente no serviço local descartável. A rota de health check não exige autenticação; as operações S3 exigem assinatura, inclusive nos testes negativos.
- Nenhum secret de GitHub, perfil AWS, bucket real, Terraform, configuração de produção, migration ou código de negócio foi modificado.

## Validações executadas nesta tarefa

| Validação | Resultado |
| --- | --- |
| Sete testes S3 originais contra a candidata | 7 aprovados, nenhuma falha ou omissão |
| Suíte S3 final, com cobertura adicional | 9 aprovados, nenhuma falha ou omissão |
| `storage-signer-validation.spec.ts` | 28 aprovados |
| `security-storage.e2e-spec.ts` | 28 aprovados |
| Scripts CI S3, task definition e credenciais | 17 aprovados, incluindo 9 novos casos de infraestrutura |
| Pull anônimo e validação SHA256 do manifesto | Aprovados |
| `node ../.github/scripts/ci-s3.cjs start` equivalente à CI | Aprovado; readiness na segunda tentativa |
| Diagnóstico real, limpeza e segunda limpeza | Aprovados; nenhum segredo exibido; segunda limpeza sem erro |
| Falha controlada de comando após início | Exit esperado 37; cleanup exit 0; ausência do contêiner confirmada |
| `actionlint` v1.7.12 nos seis workflows | Aprovado; executável oficial baixado e SHA256 conferido |
| Parsing YAML dos workflows | Incluído na auditoria final |
| `node --check` dos dois scripts novos | Aprovado |
| Lint backend e TypeScript completo | Aprovados |

O actionlint foi executado sem integrações opcionais shellcheck/pyflakes, que não estão instaladas no ambiente Windows. As novas etapas de infraestrutura executam Node, cuja sintaxe e comportamentos foram verificados separadamente.

Operações exercitadas: upload assinado, HEAD, download e igualdade dos bytes, checksum/conteúdo, MIME assinado, expiração real da URL, versionamento, substituição após confirmação, leitura de versão anterior, listagem, exclusão com delete marker, exclusão explícita de versão e recusa de credencial inválida. O ciclo de imagens pela API Nest também passou.

As evidências brutas desta execução estão em `.local/s3-ci-*.json` e `.local/s3-ci-*.log`, ignoradas pelo Git. Os serviços temporários desta tarefa foram removidos; `gai-mysql` e `gai-local-storage-storage-1` foram preservados. Não foram repetidas as suítes completas MySQL, frontend ou toda a suíte backend nesta tarefa, pois não houve alterações nessas funcionalidades; os comandos de CI dessas suítes foram mantidos.

## Validação no GitHub Actions

Após revisar e publicar manualmente os arquivos:

1. Execute somente o workflow **CI** na branch com a correção, por atualização do PR para develop ou por `workflow_dispatch` do próprio CI. Não é necessário acionar deploy homolog, deploy production ou infra.
2. Confirme no job **Backend integration (disposable MySQL and S3)** a imagem e o digest indicados no início, seguidos de `Disposable S3 ready`.
3. Confirme que MySQL e os nove casos S3 passam; confira também os demais jobs de qualidade.
4. Verifique a etapa **Remove disposable storage**. Em falhas, examine **Diagnose isolated storage failure**, sem imprimir env/secrets.

Reexecutar um run antigo sem publicar a correção usa o workflow antigo e pode repetir a falha. A ressalva de aceite é a execução do conteúdo novo no runner GitHub: ela não foi acionada porque as alterações devem permanecer sem commit/push automático.
