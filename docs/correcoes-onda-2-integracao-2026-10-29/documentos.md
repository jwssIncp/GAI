# Regressão documental

O builder e os renderers nativos foram preservados: PDF por pdfmake, DOCX por `docx` em OOXML. Não há HTML renomeado. Geração/download continuam reconsultando organização, pai, versão, permissões de documento e de fontes; cache usa hashes da versão e da identidade visual aprovada.

## Snapshot aprovado e volume

O cenário MySQL aprova o laudo com 2.500 itens, modifica um item mestre e gera os dois formatos a partir da versão preservada. A versão inteira é comparada por hash antes/depois. O conteúdo novo do mestre não pode aparecer no arquivo; o último item e o hash da versão devem estar presentes. O teste também verifica negativas 401/403 no download. A suíte documental existente cobre isolamento organizacional, IDs de outros pais, revogação de fonte, cache, corrupção e versões comerciais.

O PDF de volume tem 135 páginas; resultados exatos da execução final estão em `evidencias/volume-final/report-volume.json`. O renderer mantém 2 workers por processo, heap de 256 MiB por worker, entrada de 3 MiB, 30 segundos, arquivo de 10 MiB e validação de até 500 páginas. Na rodada MySQL completa executada junto de outras compilações/testes, o PDF de 2.500 itens atingiu o limite de 30 segundos: retornou 503 e não criou artefato parcial. Na reexecução documental sem essa carga, os dois formatos foram gerados (PDF de 135 páginas). As duas evidências foram mantidas; não se aumentou o timeout para ocultar o limite. Se um limite impedir geração, exige-se 503 explícito e nenhum artefato parcial. Isso não certifica geração de qualquer quantidade ou comprimento de células.

A matriz final de sete volumes e dois formatos está em `evidencias/volume-final/volume-exports.json`: 0, 1, 999, 1.000, 1.001 e 2.500 itens geraram PDF/DOCX com 201. Em 5.000 itens a captura/snapshot foi integral, mas o DOCX retornou 503 (falha do worker) e o PDF 503 (timeout de 30 segundos); o número de artefatos permaneceu inalterado em ambas as recusas. Não há evidência suficiente para atribuir a falha genérica do worker à memória ou ao tamanho da entrada. A tentativa inicial pressupunha sucesso do DOCX de 5.000 e falhou; a expectativa foi corrigida para admitir o impedimento explícito exigido pelo escopo, sem alterar código/limites de produção.

`inspect-documents.py` só aceita um arquivo quando a execução atual registra geração 201 e o hash da versão aparece no conteúdo, evitando validar um arquivo remanescente de rodada anterior. No PDF, confere os 2.500 marcadores, margens de todas as páginas e renderização Poppler. Contact sheets e páginas individuais ficam em `render-qa/`; a revisão visual e seu escopo estão em `inspection.json`.

No DOCX, confere CRC do ZIP, parsing de todas as partes XML, relacionamentos internos, tabelas nativas/cabeçalhos repetidos, PAGE/NUMPAGES e as 2.500 linhas na ordem exata. Todas as células da tabela de inventário também são comparadas ao snapshot aprovado preservado em JSON. A regressão Playwright também gera e baixa laudos, orçamentos e propostas pela UI/API reais.

## Paginação Word não homologada

A tentativa com o renderer empacotado está em `evidencias/docx-render-attempt/`: `render_docx.py` falhou porque `soffice.exe` não está disponível no runtime selecionado. Não foi usado o LibreOffice desktop do usuário. Estrutura OOXML válida não prova a paginação de Word, atualização de campos ou substituição de fontes. Essa homologação permanece pendente em um renderizador real.

As skills [documents](C:/Users/Jonathan/.codex/plugins/cache/openai-primary-runtime/documents/26.1025.11240/skills/documents/SKILL.md) e [pdf](C:/Users/Jonathan/.codex/plugins/cache/openai-primary-runtime/pdf/26.1025.11240/skills/pdf/SKILL.md) orientaram a inspeção. A primeira exige: “Run `render_docx.py` to produce `page-<N>.png` images”. A falha foi preservada e impede declarar homologação visual de DOCX; não impede a validação do pacote nativo e das garantias da aplicação solicitadas nesta onda.

Não há assinatura digital, certificação normativa, PDF/A, fotos patrimoniais compostas no laudo ou política nova de expiração de blobs. Esses recursos não foram simulados.
