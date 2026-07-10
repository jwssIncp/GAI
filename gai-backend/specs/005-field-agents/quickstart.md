# Quickstart: Field Agents

1. Instalar dependencias:

```bash
npm install
```

2. Subir banco local conforme `.env` e migrations existentes.

3. Rodar migrations:

```bash
npm run migration:run
```

4. Aplicar seeds de permissoes:

```bash
npm run seed:bootstrap
```

5. Executar testes:

```bash
npm test -- field-agents
npm run test:e2e -- field-agents
```
