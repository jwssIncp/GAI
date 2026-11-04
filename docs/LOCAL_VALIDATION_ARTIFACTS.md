# Evidências locais e integração de outubro de 2026

Esta branch reúne as alterações acumuladas do GAI para revisão contra `develop`. Publicar a branch não libera o sistema para produção.

Os relatórios das auditorias, das Ondas 0, 1 e 2 e do redesign conservam referências às execuções originais. Diretórios `evidencias/`, cópias de workspaces/dependências, builds, logs, capturas e exemplos PDF/DOCX dessas execuções foram deliberadamente excluídos desta publicação. Links para esses arquivos dependem do acervo local original; sua ausência no GitHub não indica nova execução nem validação adicional. As fontes, relatórios textuais, manifests, testes e scripts de reprodução foram preservados.

As evidências completas permanecem no checkout original. A cópia de integração foi criada separadamente, sem modificar sua branch, arquivos ou seleção anterior de staging. A retirada de arquivos gerados do versionamento desta branch não os apaga do checkout original e não reescreve o histórico já existente.

O pacote `gai-backend/vendor/xlsx-0.20.3.tgz` é uma dependência de instalação, não um build local descartável. Sua origem e hash constam em `gai-backend/vendor/README.md`; deve acompanhar o lockfile. As 33 migrations são fontes versionadas e não foram executadas em banco persistente nesta preparação.

Os valores de autenticação demonstrativos preexistentes e as credenciais dos serviços descartáveis nos testes são dados de fixtures, não configuração de produção. Arquivos `.env` locais não integram esta entrega.

## Atenção ao integrar

O workflow existente `Infra (Terraform)` executa planos nos PRs que alteram infraestrutura. Após merge em `develop`, alterações de infraestrutura podem disparar aplicação automática em homologação. Revisar esse comportamento, o diff Terraform e as pendências dos relatórios antes do merge. Esta preparação não autoriza nem executa deploy, aplicação Terraform ou alteração de banco real.

Para validar uma instalação nova, executar `npm ci`, os testes padrão, lint e build em cada projeto. Os testes MySQL/S3 e Playwright reais exigem os serviços descartáveis e as configurações específicas documentadas; resultados anteriores não substituem sua execução no ambiente de revisão.
