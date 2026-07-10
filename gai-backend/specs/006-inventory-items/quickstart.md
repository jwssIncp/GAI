# Quickstart: Inventory Items

## Comandos

```bash
npm install
npm run migration:run
npm run seed:bootstrap
npm run test -- inventory-items
npm run test:e2e -- inventory-items
```

## Fluxo manual

1. Autenticar como usuario com permissoes de inventory items.
2. Criar um project operacional (`draft`, `active` ou `paused`).
3. Criar item:

```http
POST /api/v1/projects/1/inventory-items
Authorization: Bearer <token>
Content-Type: application/json

{
  "description": "Notebook Dell",
  "old_plate": " abc-123 ",
  "new_plate": "gai 0001",
  "used_value": "1200.50",
  "metadata": { "row": 10 }
}
```

4. Listar itens paginados:

```http
GET /api/v1/projects/1/inventory-items?page=1&page_size=20&search=dell
Authorization: Bearer <token>
```
