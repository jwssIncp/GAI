# Configuração documental ECS — GAI-007

## Causa e alteração preparada

Em produção, `DocumentsService` exige `DOCUMENT_STORAGE=database`; ausência do modo permanece negativa segura (503). O Terraform anterior não declarava a variável. Além disso, `deploy-app.yml` baixa a task definition atual e registra novas revisões a partir dela; `ecs.tf` ignora drift de `container_definitions`. Alterar somente a definição inicial não reconciliaria uma task antiga no pipeline.

Foi preparado:

- `infra/terraform/ecs.tf`: modo documental `database`; piso de 1.024 unidades CPU e 2.048 MiB, mantendo alocações superiores e a proporção mínima de memória para CPUs superiores.
- `infra/terraform/rds.tf`: `max_allowed_packet=33554432`, compatível com o limite aplicativo de 10 MiB por artefato.
- `.github/scripts/prepare-document-task.cjs`: transformação local/idempotente da revisão baixada, preservando imagem, secrets, IAM, storage e healthcheck; valida combinações CPU/memória e recusa um hard cap de container insuficiente.
- `register-task-definitions.sh`: executa essa preparação antes do registro existente de app/release. O teste local da transformação foi incluído no CI.

Nenhum comando de registro AWS foi executado. A alteração do piso pode aumentar o custo de uma futura aplicação; é dimensionamento inicial para Node mais dois heaps de renderer, **não resultado de carga Fargate homologada**.

## Renderer, storage, IAM e tempo

PDF usa fontes Roboto embutidas pela biblioteca; DOCX gera OOXML nativo. O runtime de produção não precisa instalar Word ou LibreOffice para criar esses formatos. O worker JS é incluído no build Nest e no `dist` copiado pela imagem. LibreOffice/Word continuam necessários à homologação visual do DOCX, em ambiente separado.

Artefatos documentais são blobs privados no MySQL, não objetos S3. Não foi ampliada a política IAM. As permissões existentes de S3 continuam destinadas a imagens/evidências/exports. É necessário homologar as permissões SQL efetivas do usuário da aplicação nas tabelas documentais, restore, retenção e crescimento dos blobs.

Foram preservados RDS criptografado, backups configuráveis, redes, secrets SSM, IAM, healthcheck e circuit breaker existentes. Não foi adicionada limpeza automática de histórico. O renderer mantém 30 segundos; o ALB tem padrão documentado de 60 segundos quando não configurado. Latência real, filas, conexões, limites por réplica e uso simultâneo ainda exigem medição na AWS.

Referências primárias: [combinações Fargate CPU/memória](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/task-cpu-memory-error.html) e [atributos do ALB](https://docs.aws.amazon.com/elasticloadbalancing/latest/application/application-load-balancers.html). O par inicial 1 vCPU/2 GiB é admitido; sua suficiência operacional é uma hipótese a homologar.

## Validação local e impedimentos

Terraform oficial 1.11.4 foi baixado para a cópia de ferramentas, com SHA-256 conferido contra o manifesto oficial. `init -backend=false` instalou os providers já fixados no lock (AWS 5.100.0 e random 3.9.1); `validate` passou sem erros/avisos. O fmt foi aplicado somente na cópia, revisado e transferido ao arquivo alterado; a checagem final e os logs ficam em `evidencias/terraform-final-checks.json`.

Os testes HTTP simulam o gate de produção: modo ausente → 503; `database` → geração autorizada. Não equivalem ao boot de uma imagem publicada, ao RDS efetivo nem a recuperação de desastre.

**Situação: configuração preparada localmente; homologação AWS pendente.** Não houve plan/apply, publicação de imagem, migration em produção, deploy ou inspeção de uma task AWS efetiva. Antes de liberar: revisar capacidade/custo, aplicar pelo fluxo autorizado, verificar task e banco reais, geração/download com permissões, retenção e backup/restore, alarmes e comportamento sob concorrência.
