# Documentos profissionais PDF e DOCX — GAI

Implementação funcional de geração centralizada, com arquivos binários reais e download autenticado. A primeira integração atende laudos aprovados; a mesma infraestrutura atende versões de orçamentos e propostas. Não substitui XLSX. Dados dos exemplos são sintéticos.

## Arquitetura

`DocumentsModule` reúne controllers de laudos e comerciais, autorização de origem, cache de artefatos, auditoria e entrega. `DocumentTemplatesModule` publica identidades visuais organizacionais e compartilha o serviço de renderização. Não cria autenticação alternativa.

1. `TechnicalReportsService.version` ou `BudgetService.documentVersion` recupera a versão exata, com organização, projeto e origem compatíveis.
2. `document.builder.ts` monta um contrato `ProfessionalDocument`, com texto, campos, blocos e tabelas. Não faz consultas nem recalcula valores comerciais.
3. O modelo visual preservado no snapshot fornece marca, cores, tipografia, cabeçalho, rodapé e capa.
4. `DocumentRendererService` executa PDF/DOCX em worker terminável, com memória e tempo limitados.
5. `document.render.ts` valida PDF e OOXML antes da persistência.
6. `DocumentsService` armazena o binário privado com checksum e metadados; cada download revalida a origem e a integridade.
7. `document_audit_logs` registra geração, cache, falha, publicação e entrega, sem conteúdo documental.

O identificador do motor participa da chave de cache. Uma alteração de renderizador cria outro artefato; nunca regrava os bytes de um artefato anterior.

## Bibliotecas e identidade visual

- **pdfmake 0.2.23**: PDF nativo, A4, tabelas paginadas, cabeçalhos repetidos, rodapé `página / total`. Linha estável 0.2 com patch atualizado.
- **docx 9.15.0**: pacote Office Open XML, parágrafos editáveis, estilos de títulos, tabelas nativas, cabeçalhos/rodapés e campos `PAGE`/`NUMPAGES`.
- **pdf-lib 1.17.1**: abertura estrutural do PDF, contagem e limite de páginas.
- **fflate 0.8.3**: inspeção do pacote ZIP/OOXML. A versão inicial foi atualizada após inspeção de dependências.
- **pdfjs-dist** e **docx-preview** são dependências de desenvolvimento para extração, abertura e revisão visual dos arquivos reais.

Modelo padrão imutável `gai-a4-v1`: identidade GAI, azul `#16324F`, A4, capa, hierarquia tipográfica e paginação. Modelos da organização são publicados como `visual-ID`, sem endpoint de edição retroativa. A interface permite nome, informações institucionais, cor, cabeçalho/rodapé, estilo com/sem serifa, capa e logotipo PNG opcional.

Roboto 3.014 do pacote pdfmake usa licença SIL OFL-1.1 e é incorporada ao PDF. A versão/licença foi conferida na tabela `name` do binário da fonte; o aviso está em `gai-backend/third-party/Roboto-OFL.txt`. A alternativa serifada usa as fontes PDF padrão Times. DOCX declara Arial ou Times New Roman e usa as fontes disponíveis no editor, sem distribuir arquivos dessas fontes. Nenhuma fonte ou imagem é baixada de URL informada pelo usuário.

As larguras das tabelas favorecem descrições; linhas usuais permanecem juntas. Células excepcionalmente altas podem atravessar páginas para não perder conteúdo. Cabeçalhos são repetidos nas quebras automáticas.

Documentação primária consultada: [tabelas PDF](https://pdfmake.github.io/docs/0.1/document-definition-object/tables/), [cabeçalhos/rodapés PDF](https://pdfmake.github.io/docs/0.1/document-definition-object/headers-footers/), [DOCX](https://docx.js.org/).

## Snapshots e imutabilidade

**Laudos:** exportação exige revisão cujo próprio estado seja `approved`, mesmo após reabertura ou arquivamento do cabeçalho atual. Usa exclusivamente seus campos, seções, fontes, indicadores, quadros selecionados, observações, conclusão, responsáveis, datas, hashes e avisos preservados. Campos `{{chave}}` são materializados dos valores congelados. O serviço confere o hash aprovado; não atualiza fontes nem completa lacunas com dados atuais.

A identidade visual é copiada para a nova revisão no momento da aprovação. Aprovações anteriores à implementação permanecem intactas e usam sempre o padrão `gai-a4-v1`; não recebem a identidade visual corrente por consulta silenciosa. Não se inventam assinaturas, habilitações, ART/RRT ou certificação digital.

**Comercial:** cada arquivo indica a versão exata e usa seu cliente, projeto, escopo, serviços, quantidades, dimensionamento, prazo de campo, preço, moeda, pagamentos e validade. A aprovação da versão é identificada no histórico de transições, sem confundir a revisão corrente com outra proposta. Versões sem aprovação levam a identificação **NÃO APROVADO**. A interface de prévia comercial exporta a mesma versão aprovada exibida na tela.

Memória interna, custos, margem, comissão e fórmulas ficam fora do arquivo por padrão. A inclusão exige `include_memory: true` e `budgets:configure-prices`, além das permissões de exportação. Não são incluídas notas internas indiscriminadamente. Datas civis são formatadas sem deslocamento de fuso, e valores decimais são formatados sem conversão para ponto flutuante.

## Persistência e migration

Migration aditiva `1793900000002-create-professional-documents.ts`:

| Tabela | Finalidade |
|---|---|
| `document_visual_versions` | Publicações organizacionais imutáveis, autor, data e hash |
| `document_artifacts` | Binário privado MEDIUMBLOB, origem/versão, modelo, formato, checksum, tamanho e chave única de cache |
| `document_audit_logs` | Eventos e resultados, sem texto ou dados patrimoniais integrais |

FKs de organização e usuário; o vínculo polimórfico com a origem é validado pelo serviço em cada operação. Não há endpoint de sobrescrita ou exclusão de artefatos. A reversão destrutiva da migration é recusada para preservar histórico.

Foi aplicada apenas esta migration no MySQL local confirmado, `NODE_ENV=local`, `localhost:3306/gai`, MySQL 8.0.46, total de 32 migrations. Nenhum laudo aprovado, orçamento histórico ou contrato foi atualizado pela migration. Produção não foi acessada.

## Segurança e storage

Laudos exigem `projects:read`, `technical-reports:read`, `technical-reports:export` e as permissões atuais das fontes do snapshot. Orçamentos/propostas exigem `budgets:read` e a nova `budgets:export`; vínculos com projeto também exigem `projects:read`. Administração visual exige a nova `documents:templates`. As novas chaves entram no catálogo, sem conceder exportação a ORG_USER ou a papéis personalizados automaticamente. ORG_ADMIN usa o catálogo vigente somente em sua organização.

Escopo e permissões são verificados novamente no download, mesmo em cache. IDs de outra versão, documento, projeto ou organização são recusados. Downloads enviam `Content-Disposition: attachment`, MIME correto, tamanho, `nosniff`, `Cache-Control: private, no-store` e `X-Document-SHA256`. Não há URL pública nem token de download que dispense autenticação; portanto, não se cria prazo artificial de URL presignada.

O adaptador S3 existente foi inspecionado: seu contrato é de assinatura/verificação de upload de cliente, sem operação de escrita de binários pelo servidor. Esta implementação usa **persistência privada no banco e entrega autenticada**, escolhida explicitamente, sem simular S3 e sem fallback público/local em produção. Em produção, a geração falha se `DOCUMENT_STORAGE=database` não for explicitamente configurado. Uma futura implementação de escrita S3 deve preservar o mesmo contrato e homologar bucket privado, versionamento, checksums e política de retenção antes de ativar.

Limites: dois workers por processo, 256 MB de heap por worker, 30 segundos de renderização, entrada até 3 MB, saída até 10 MB, PDF até 500 páginas. Pedidos idênticos compartilham geração em andamento e cache persistente; chave única também protege gravações concorrentes em múltiplas instâncias. Sob saturação, retorna indisponibilidade controlada. Logotipo: PNG local em base64, até 128 KB e 1024 × 1024, com validação de assinatura/dimensões e decodificação em worker. Não aceita HTML, scripts, SVG ativo, caminhos arbitrários ou URLs de imagens.

## Endpoints

Prefixo `/api/v1`. POST recebe `{ "format": "pdf" | "docx", "include_memory"?: boolean }`; o segundo campo só se aplica ao comercial. Retorna metadados, incluindo `id`, checksum, tamanho, versão e modelo visual. GET entrega o binário com nova autorização.

| Método | Caminho |
|---|---|
| POST | `/projects/:projectId/technical-reports/:id/versions/:versionId/documents` |
| GET | `/projects/:projectId/technical-reports/:id/versions/:versionId/documents/:artifactId` |
| POST | `/budgets/:id/versions/:versionId/documents` |
| GET | `/budgets/:id/versions/:versionId/documents/:artifactId` |
| POST | `/budgets/:id/versions/:versionId/proposal-documents` |
| GET | `/budgets/:id/versions/:versionId/proposal-documents/:artifactId` |
| GET / POST | `/organizations/:organizationId/document-templates` |

O export JSON anterior do laudo e os endpoints XLSX existentes continuam disponíveis.

## Interface

Na prévia de uma revisão aprovada: **Baixar PDF**, **Baixar DOCX** e **Consultar versão do documento**. A exportação JSON e a impressão da prévia continuam acessíveis. No orçamento: PDF da versão selecionada. Na prévia comercial: PDF/DOCX da versão aprovada exibida. Modelos visuais ficam em Modelos de Laudos e no detalhe do orçamento, conforme a permissão.

O componente compartilhado apresenta preparação, geração, download, sucesso, erro e indisponibilidade; bloqueia cliques duplicados enquanto trabalha. A memória interna é opção desmarcada por padrão e só aparece para usuários autorizados. Mantém layout, navegação e componentes existentes.

## Exemplos, testes e evidências

Os arquivos em `exemplos/` foram baixados pelo Chromium com ORG_ADMIN, sem mocks. `playwright-evidence.json` registra os IDs sintéticos e o hash aprovado; `arquivos-validacao.json` contém checksums, contagens de páginas e validação de paginação; `ooxml-validacao.json` registra CRC, XML, relacionamentos, tabelas e campos de página. Capturas e logs de execução ficam em `.local/documents-*`.

Validação automatizada: 90 testes de backend em nove suítes, incluindo renderização, imutabilidade, fonte aprovada, autorização, organizações, projetos/IDs estrangeiros, concorrência, cache, corrupção, revogação de permissão e regressão de laudos/orçamentos. Frontend: 17 testes em quatro arquivos. TypeScript e builds de ambos os projetos; lint dos arquivos alterados. O percurso Playwright cobre publicação visual, laudo com 60 itens, downloads reais, desktop/móvel, repetição idempotente após publicação posterior e versões comerciais.

O PDF é aberto e renderizado página a página, com conferência de acentos, última linha da tabela e numeração. DOCX é validado como ZIP/OOXML e aberto com docx-preview. **O runtime Windows disponível não inclui LibreOffice empacotado; a renderização canônica `render_docx.py` e a paginação final em Word/LibreOffice não foram homologadas nesta execução.** A prévia de navegador não substitui o motor de paginação de um editor Office. Os campos de página são nativos e serão calculados pelo editor.

Além do percurso descartável, o laudo sintético histórico do projeto 44, laudo 5, aprovação 23 foi exportado pelo backend habitual em `localhost:3306/gai`, usando o login ORG_ADMIN do ambiente. PDF/DOCX foram baixados e seus checksums conferidos; o conteúdo e o hash aprovados permaneceram idênticos. Ambos usaram `gai-a4-v1`, sem acrescentar campos ao snapshot anterior. O mesmo histórico foi validado novamente pelos botões de download no Chromium real. Evidências em `historico-local-validacao.json` e `historico-playwright-validacao.json`. O container de testes foi removido; o ambiente habitual de desenvolvimento permanece iniciado.

## Homologação local

No ambiente habitual, a migration já foi aplicada. Para outro checkout local equivalente, com `.env` revisado para `NODE_ENV=local`, loopback:3306/gai, executar `node scripts/documents-migrate-local.cjs`; o script recusa outros destinos ou migrations inesperadas. Depois, `scripts/local-start.ps1` e login ORG_ADMIN do ambiente. Abrir projeto → Laudos → versão aprovada preservada → Baixar PDF/DOCX. Uma aprovação antiga usa o modelo padrão; uma nova aprovação congela o modelo visual vigente.

Para repetir testes em isolamento, sem apagar o banco de desenvolvimento:

```powershell
docker run --detach --name gai-documents-mysql-test --publish 127.0.0.1:33317:3306 --tmpfs /var/lib/mysql:rw --env MYSQL_ROOT_PASSWORD=gai-validation-only --env MYSQL_DATABASE=gai_validation_disposable mysql:8.0 --max-allowed-packet=32M
node scripts/documents-checks.cjs tests
node scripts/documents-checks.cjs backend
node scripts/documents-checks.cjs frontend
```

As suítes MySQL usam exclusivamente `127.0.0.1:33317/gai_validation_disposable`, com credenciais sintéticas, e recriam somente esse esquema. Não executar suítes que recriam esse esquema enquanto o servidor descartável estiver ativo.

Para Playwright, em terminais separados, com portas 3000/5173 livres:

```powershell
$env:GAI_DOCUMENTS_DISPOSABLE='1'
node scripts/documents-disposable-server.cjs
# Outro terminal, em gai-frontend:
npm.cmd run dev -- --host 127.0.0.1
# Outro terminal, em gai-frontend:
$env:GAI_DOCUMENTS_REAL='1'
$env:GAI_E2E_LOGIN='org.admin'
$env:GAI_E2E_PASSWORD='Admin@123456' # somente fixture descartável
node node_modules/@playwright/test/cli.js test e2e/documents-real.spec.ts --reporter=line
# Na raiz, depois dos downloads:
node scripts/documents-inspect.cjs
```

`documents-validate-ooxml.py` usa apenas a biblioteca padrão de Python para CRC/XML/relacionamentos. O servidor descartável exige opt-in e não utiliza a conexão DB_* de desenvolvimento. Encerrar apenas seus processos e remover apenas `gai-documents-mysql-test` após os testes; não remover `gai-mysql` ou seus volumes.

## Limitações e operação

- Assinatura digital, certificação, emissão ART/RRT e incorporação de fotografias patrimoniais não fazem parte desta implementação.
- Não há renderização de HTML, scripts, templates executáveis, SVG ativo ou URLs externas.
- Não há endpoint de limpeza/retention automática de binários; dimensionar o banco e backups antes de habilitar produção. O limite de 10 MB por arquivo exige `max_allowed_packet` compatível. A homologação usa 32 MB.
- Não existe fila distribuída; o limite de workers é por processo. Saturação retorna erro recuperável para nova tentativa.
- O catálogo npm do repositório tem avisos de vulnerabilidades anteriores à tarefa. Não foi aplicado `audit fix --force` a módulos alheios; o ZIP novo foi atualizado para a versão corrigida.
- Não foram feitos commit, push ou deploy, e as alterações locais anteriores foram preservadas.

O inventário exato dos arquivos desta entrega está em `arquivos-alterados.json`.
