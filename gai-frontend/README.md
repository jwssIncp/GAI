# GAI Frontend

Frontend independente para o SaaS GAI, alinhado aos contratos OpenAPI do backend NestJS em `../gai-backend/specs/**/contracts/*.yaml`.

## Executar

```powershell
cd C:\Users\suporte\Downloads\gai-backend (1)\gai-backend\gai-frontend
npm.cmd install
npm.cmd run dev
```

O Vite sobe em `http://localhost:5173` e faz proxy de `/api` para `http://localhost:3000`.

## Validar

```powershell
npm.cmd run lint
npm.cmd run test
npm.cmd run build
npm.cmd run test:e2e
```

Use `npm.cmd` no Windows para evitar bloqueios de ExecutionPolicy com `npm.ps1`.

## Contratos usados

- Base URL: `/api/v1`
- Swagger backend: `/api/docs`
- Auth: Bearer token opaco de sessao
- Erro: `{ code, message, details? }`
- Paginação: suportada nos formatos `items/page_size/total_items` e `data/meta.total`
