# Documentos e storage

## Geração nativa e conteúdo

PDF é gerado por pdfmake e verificado por pdf-lib; DOCX é pacote OOXML gerado pela biblioteca docx, com tabelas nativas, títulos, cabeçalho/rodapé e campos PAGE/NUMPAGES. Não é HTML com extensão Word. `gai-backend/src/modules/documents/document.render.ts:67`; `gai-backend/src/modules/documents/document.builder.ts:1`. Snapshot aprovado e identidade visual versionada são a fonte; alteração posterior de modelo não deve modificar o arquivo histórico.

Foram geradas novas fixtures sintéticas pelo renderer atual, com 1, 60 e 180 linhas e descrições longas. Um clone separado foi usado para cada formato, reproduzindo a separação de objetos do worker: pdfmake pode transformar internamente células recebidas por referência. As tentativas de preparação e ajustes do harness não foram rotuladas como falhas da API de produção.

| Arquivo sintético | Bytes | Páginas PDF / partes XML válidas | Última linha | Validação |
| --- | --- | --- | --- | --- |
| sintetico-1.pdf | 22074 | 2 | Preservada | PDF parseável e sem texto fora da margem de 20 pt |
| sintetico-1.docx | 12020 | 21 | Preservada | Relacionamentos internos válidos e tabela/campos nativos |
| sintetico-60.pdf | 34049 | 5 | Preservada | PDF parseável e sem texto fora da margem de 20 pt |
| sintetico-60.docx | 13069 | 21 | Preservada | Relacionamentos internos válidos e tabela/campos nativos |
| sintetico-180.pdf | 59002 | 12 | Preservada | PDF parseável e sem texto fora da margem de 20 pt |
| sintetico-180.docx | 14869 | 21 | Preservada | Relacionamentos internos válidos e tabela/campos nativos |

Os 19 PNGs das páginas PDF foram gerados; inspeção visual amostral de capa, tabela curta, linhas longas intermediárias e página final não mostrou cortes/sobreposição. A checagem de limites horizontais e presença da última linha cobriu todos os PDFs. Fontes/acentos portugueses foram verificados. Não é garantia universal para qualquer conteúdo. Evidências em evidencias/documentos-render/inspection.json e PNGs/arquivos de teste; arquivos gerados via download autenticado pelo Playwright ficam em evidencias/documentos e evidencias/playwright.

## Versões, permissões, hash e cache

Laudo exige versão aprovada; orçamento avulso pode gerar documento rotulado como não aprovado. Proposta usa a versão comercial selecionada. Memória interna fica excluída por padrão e exige permissão adicional. Geração e download reconsultam permissões de documento e fontes, organização e IDs de pai/versão. Cache usa engine, organização, fonte/hash, modelo visual/hash, formato e opção de memória. Bytes têm SHA-256, tamanho e limite verificados; arquivo corrompido é negado. Cache-Control private,no-store e nosniff são aplicados. `gai-backend/src/modules/documents/documents.service.ts:278`; `gai-backend/src/modules/documents/documents.controller.ts:24`.

Worker limita duas renderizações concorrentes por processo, entrada de 3 MB, 30 segundos e arquivo de 10 MB; renderer PDF valida até 500 páginas. Cache/coalescência é local ao processo mais índice único SQL; não há fila distribuída. São limites explícitos, não teste de carga.

## Armazenamento e expiração

Artefatos documentais são mediumblob privado no banco; não usam S3. Não foi localizada política de expiração/limpeza desses blobs; retenção e crescimento precisam de decisão operacional. Export jobs são outro mecanismo e têm expiração/limpeza própria. Não confundir validade de URL assinada de evidência com retenção de PDF aprovado.

Em NODE_ENV=production, DocumentsService recusa geração salvo DOCUMENT_STORAGE=database. A definição ECS atual não declara essa variável: o caminho declarativo não habilita geração documental (GAI-007). Isso não foi observado numa AWS implantada; é inconsistência confirmada entre configuração de fonte e gate do serviço. Definir e homologar modo, backup, retenção e capacidade antes de liberar, sem alterar o gate na auditoria.

Imagens/anexos/evidências usam adapter AWS SDK SigV4, PUT autorizado, confirmação com HEAD/leitura/hash/MIME e download preso à versão do objeto. Os 7 testes MinIO reais passaram, incluindo expiração e substituição; outras suítes usam FakeStorage explicitamente. IAM GetObjectVersion, versionamento, CORS e criptografia estão declarados em Terraform; **homologação AWS real não comprovada e permanece pendente**. Nenhum deploy, PUT em bucket AWS ou alteração de infraestrutura remota foi realizado.

## Limitações visuais

DOCX foi validado estruturalmente, mas não foi homologado em Word nem renderizado pelo renderer canônico da skill nesta estação; o runtime empacotado necessário não estava disponível por ferramenta. Não se usou o LibreOffice desktop do usuário como substituto. Paginação Word pode variar por aplicação, versão e substituição de fontes; PAGE/NUMPAGES dependem de atualização pelo editor. PDF incorpora Roboto; opção Times usa fontes padrão, com cobertura Unicode mais limitada. DOCX declara fontes, sem comprovação de incorporação/instalação no cliente.

Somente logo PNG institucional está previsto no modelo visual; DocumentBlock não compõe fotos/legendas de ativos. Não há assinatura digital, motor normativo certificado ou PDF/A comprovado. A captura de fontes de laudo limita 1.000 registros por família (GAI-006). Tabelas longas testadas não eliminam esse limite de extração no serviço.
