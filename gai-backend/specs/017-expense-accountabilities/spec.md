# Feature Specification: Expense Accountabilities and Installments

Prestacoes de contas are tenant/project/field-agent scoped. Only open records
accept expenses; each expense belongs to at most one accountability. Closing is
transactional, requires at least one expense and recalculates the total from the
persisted expense values. Installments are generated once and distribute cents
deterministically so their sum equals the expense amount.

An expense must belong to the same organization, project and field agent and
its date must fall inside the accountability period. Removal is not supported in
this version. Accountabilities and installments use the standard paginated
envelope (`page`, `page_size`, `total_items`, `total_pages`).

Endpoints: `/projects/{projectId}/expense-accountabilities`,
`/{id}/expenses`, `/{id}/close`, and
`/projects/{projectId}/expenses/{expenseId}/installments`.

Permissions:

- `expense-accountabilities:create`
- `expense-accountabilities:read`
- `expense-accountabilities:update`
- `expense-accountabilities:close`
- `expense-installments:create`
- `expense-installments:read`
