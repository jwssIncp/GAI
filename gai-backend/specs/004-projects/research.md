# Research: Projects

## Decisions

- Persistencia segue TypeORM porque o projeto atual nao possui Prisma.
- API usa snake_case para contratos externos, alinhada aos DTOs existentes.
- Status de project usa valores lowercase conforme escopo solicitado.
- Mutacoes sao transacionais no repository, com auditoria na mesma transacao.
- Isolamento tenant e aplicado em use cases com actor context, preservando bypass de
  `PLATFORM_ADMIN`.

