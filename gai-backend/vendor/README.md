# SheetJS CE 0.20.3

Distribuição oficial vendorizada para instalação reproduzível pelo lockfile.

- Origem: https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz
- Orientação do mantenedor: https://docs.sheetjs.com/docs/getting-started/installation/nodejs/
- Licença: Apache-2.0; o texto integral está em `package/LICENSE` dentro do arquivo.
- Tamanho: 2.409.319 bytes.
- SHA-256: `8dc73fc3b00203e72d176e85b50938627c7b086e607c682e8d3c22c02bb99fe8`.
- SHA-512/SRI: registrado em `package-lock.json` e em `docs/correcoes-onda-1-integridade-2026-10-28/evidencias/sheetjs-provenance.json`.

A versão 0.18.5 do registro npm estava afetada por prototype pollution e ReDoS. A distribuição 0.20.3 supera os limites corrigidos 0.19.3 e 0.20.2. A origem local é intencional: `npm ci` não depende da disponibilidade futura do CDN. Não editar o tarball; uma atualização exige nova conferência de origem, licença, hash e regressões dos parsers/importações/exportações.
