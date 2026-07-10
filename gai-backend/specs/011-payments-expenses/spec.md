# Feature Specification: Payments & Expenses / Pagamentos e Despesas

**Feature Branch**: `011-payments-expenses`

**Created**: 2026-07-08

**Status**: Draft

**Repository Scope**: Backend GAI. O projeto usa NestJS com TypeORM, migrations em
`src/migrations`, RBAC por permissions e StorageSigner para URLs pre-assinadas.

## User Scenarios & Testing

### User Story 1 - Criar Pagamento de Inventariante (Priority: P1)

Como usuario autorizado, quero registrar pagamento de inventariante vinculado a um
project operacional, calculando diarias, adicionais, descontos e valor final.

**Acceptance Scenarios**:

1. **Given** project operacional e field agent da mesma organization vinculado ao
   project, **When** cria pagamento, **Then** status e `pending`, totais sao
   calculados e auditoria e registrada.
2. **Given** field agent de outra organization ou nao vinculado ao project, **When**
   cria pagamento, **Then** o backend rejeita a operacao.
3. **Given** project bloqueado, **When** tenta criar/alterar/aprovar/pagar/cancelar,
   **Then** a mutacao e bloqueada.

### User Story 2 - Gerenciar Ciclo de Pagamento (Priority: P2)

Atualizar pagamento e permitido somente enquanto `pending`; aprovar altera para
`approved`; marcar como pago altera para `paid` e registra `paid_by_id`, `paid_at` e
`payment_date`; cancelar altera para `cancelled`.

### User Story 3 - Criar e Gerenciar Despesas (Priority: P3)

Despesa pertence a um project e pode opcionalmente se vincular a field agent. O ciclo
inclui `pending`, `approved`, `rejected`, `paid` e `cancelled`.

### User Story 4 - Anexar Comprovantes (Priority: P4)

Cliente solicita URL de upload, backend gera path seguro, grava metadados, confirma
upload, lista anexos, gera URL de download e remove logicamente.

## Requirements

- **FR-001**: Pagamento DEVE pertencer a organization, project e field agent.
- **FR-002**: Despesa DEVE pertencer a organization e project; field agent e opcional.
- **FR-003**: Usuario de organization so PODE operar dados da propria organization.
- **FR-004**: Platform admin PODE operar qualquer organization.
- **FR-005**: Project bloqueado (`inactive`, `finished`, `cancelled`, `archived`) bloqueia
  mutacoes.
- **FR-006**: Field agent de pagamento DEVE pertencer a mesma organization e estar
  vinculado ao project.
- **FR-007**: Valores monetarios DEVEM ser DECIMAL no banco e strings decimais na API.
- **FR-008**: `daily_total = days * daily_rate`.
- **FR-009**: `final_amount = daily_total + additional_amount - discount_amount`.
- **FR-010**: Valores de amount/rates/adicionais/descontos/finais NAO PODEM ser negativos.
- **FR-011**: `days` DEVE ser inteiro >= 0.
- **FR-012**: `end_date` NAO PODE ser anterior a `start_date`.
- **FR-013**: `payment_date` NAO PODE ser anterior a `start_date`.
- **FR-014**: Mutacoes DEVEM registrar auditoria.
- **FR-015**: Listagens DEVEM ser paginadas e filtraveis por project, field agent, status,
  state, periodo, payment_date e busca textual.
- **FR-016**: Anexos guardam apenas metadados; bucket/path interno nao e retornado por
  padrao nas respostas publicas.
- **FR-017**: URLs pre-assinadas usam expiracao curta configuravel.

## Permissions

- `payments:create`, `payments:read`, `payments:update`, `payments:approve`,
  `payments:mark-as-paid`, `payments:cancel`, `payments:export`
- `expenses:create`, `expenses:read`, `expenses:update`, `expenses:approve`,
  `expenses:reject`, `expenses:mark-as-paid`, `expenses:cancel`,
  `expenses:upload-attachment`, `expenses:download-attachment`

## Key Entities

- **FieldAgentPayment**: Pagamento por periodo/inventariante/project.
- **Expense**: Despesa avulsa do project, com field agent opcional.
- **ExpenseAttachment**: Comprovante armazenado em storage externo.
- **PaymentExpenseAuditLog**: Auditoria imutavel das mutacoes financeiras.
