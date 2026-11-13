import { MigrationInterface, QueryRunner } from 'typeorm';

const PERMISSIONS: Array<[string, string]> = [
  ['expenses:delete', 'Despesas: excluir lançamento (exclusão lógica)'],
  ['expenses:import', 'Despesas: importar lista (Excel/CSV)'],
  ['expenses:export-zip', 'Despesas: exportar ZIP com comprovantes'],
  ['expenses:reopen', 'Despesas: reabrir lançamento aprovado para edição'],
  ['expense-advances:read', 'Adiantamentos: consultar'],
  ['expense-advances:create', 'Adiantamentos: lançar'],
  ['expense-advances:update', 'Adiantamentos: editar'],
  ['expense-advances:delete', 'Adiantamentos: excluir'],
  ['reimbursement-batches:read', 'Lotes de reembolso: consultar'],
  [
    'reimbursement-batches:create',
    'Lotes de reembolso: criar e incluir despesas (prestar conta)',
  ],
  ['reimbursement-batches:close', 'Lotes de reembolso: faturar ao cliente'],
  ['reimbursement-batches:reopen', 'Lotes de reembolso: reabrir ou cancelar'],
  ['project-finance:close', 'Financeiro do projeto: concluir'],
  ['project-finance:reopen', 'Financeiro do projeto: reabrir'],
];

/**
 * Paridade financeira, etapa 4 (Despesas). Só acrescenta; nenhuma coluna existente muda.
 * - M5 expenses: tipo (reembolsável/não), motivo da lista, forma de pagamento,
 *   data de faturamento, valor depositado, código sequencial por projeto,
 *   motivo da rejeição em coluna própria, lote de reembolso e reabertura;
 * - M6 expense_advances: adiantamentos por projeto e técnico;
 * - M7 expense_reimbursement_batches: lote de reembolso ao cliente (decisão D-B);
 * - M8 project_financial_closures: concluir/reabrir o financeiro do projeto;
 * - ⚠ ajuste de dados aprovado (D-M): numerar project_sequence das despesas existentes
 *   (por projeto, na ordem data da despesa, id). Tipo e forma de pagamento das
 *   antigas ficam nulos ("não classificada").
 */
export class ExpensesParity1795000000001 implements MigrationInterface {
  name = 'ExpensesParity1795000000001';

  async up(q: QueryRunner): Promise<void> {
    const engine =
      'ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci';
    if (!(await q.hasTable('expense_reimbursement_batches')))
      await q.query(
        `CREATE TABLE expense_reimbursement_batches (id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, organization_id BIGINT UNSIGNED NOT NULL, project_id BIGINT UNSIGNED NOT NULL, number INT UNSIGNED NOT NULL, batch_date DATE NOT NULL, expected_receipt_on DATE NULL, status VARCHAR(20) NOT NULL DEFAULT 'open', receivable_id BIGINT UNSIGNED NULL, notes TEXT NULL, created_by_id BIGINT UNSIGNED NULL, billed_at DATETIME(3) NULL, billed_by_id BIGINT UNSIGNED NULL, created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3), PRIMARY KEY(id), UNIQUE KEY uq_reimbursement_batch_number(project_id, number), INDEX idx_reimbursement_batch_org_status(organization_id, status), CONSTRAINT fk_reimbursement_batch_org FOREIGN KEY(organization_id) REFERENCES organizations(id), CONSTRAINT fk_reimbursement_batch_project FOREIGN KEY(project_id) REFERENCES projects(id), CONSTRAINT fk_reimbursement_batch_receivable FOREIGN KEY(receivable_id) REFERENCES receivables(id), CONSTRAINT fk_reimbursement_batch_creator FOREIGN KEY(created_by_id) REFERENCES users(id), CONSTRAINT fk_reimbursement_batch_biller FOREIGN KEY(billed_by_id) REFERENCES users(id)) ${engine}`,
      );
    const columns: Array<[string, string]> = [
      ['expense_type', 'VARCHAR(20) NULL'],
      ['reason_code', 'VARCHAR(60) NULL'],
      ['payment_method', 'VARCHAR(20) NULL'],
      ['invoiced_payment_date', 'DATE NULL'],
      ['deposited_amount', 'DECIMAL(15,2) NULL'],
      ['project_sequence', 'INT UNSIGNED NULL'],
      ['rejection_reason', 'TEXT NULL'],
      ['reimbursement_batch_id', 'BIGINT UNSIGNED NULL'],
      ['reopened_at', 'DATETIME(3) NULL'],
      ['reopened_by_id', 'BIGINT UNSIGNED NULL'],
    ];
    for (const [name, type] of columns)
      if (!(await q.hasColumn('expenses', name)))
        await q.query(`ALTER TABLE expenses ADD COLUMN ${name} ${type}`);
    const indexes = (await q.query(
      "SELECT DISTINCT INDEX_NAME AS name FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'expenses'",
    )) as Array<{ name: string }>;
    const has = (name: string) => indexes.some((i) => i.name === name);
    // Ajuste de dados (D-M): numera as despesas existentes antes da unicidade.
    await q.query(
      'UPDATE expenses e JOIN (SELECT id, ROW_NUMBER() OVER (PARTITION BY project_id ORDER BY expense_date, id) AS rn FROM expenses) x ON x.id = e.id SET e.project_sequence = x.rn WHERE e.project_sequence IS NULL',
    );
    if (!has('uq_expenses_project_sequence'))
      await q.query(
        'ALTER TABLE expenses ADD UNIQUE KEY uq_expenses_project_sequence (project_id, project_sequence)',
      );
    if (!has('idx_expenses_reimbursement_batch'))
      await q.query(
        'ALTER TABLE expenses ADD INDEX idx_expenses_reimbursement_batch (reimbursement_batch_id), ADD CONSTRAINT fk_expenses_reimbursement_batch FOREIGN KEY (reimbursement_batch_id) REFERENCES expense_reimbursement_batches(id), ADD CONSTRAINT fk_expenses_reopened_by FOREIGN KEY (reopened_by_id) REFERENCES users(id)',
      );
    if (!(await q.hasTable('expense_advances')))
      await q.query(
        `CREATE TABLE expense_advances (id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, organization_id BIGINT UNSIGNED NOT NULL, project_id BIGINT UNSIGNED NOT NULL, field_agent_id BIGINT UNSIGNED NOT NULL, advanced_on DATE NOT NULL, amount DECIMAL(15,2) NOT NULL, notes TEXT NULL, deposited_by_user_id BIGINT UNSIGNED NULL, deposited_by_name VARCHAR(150) NULL, created_by_id BIGINT UNSIGNED NULL, updated_by_id BIGINT UNSIGNED NULL, created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3), deleted_at DATETIME(3) NULL, PRIMARY KEY(id), INDEX idx_expense_advances_project_agent(project_id, field_agent_id), CONSTRAINT fk_expense_advances_org FOREIGN KEY(organization_id) REFERENCES organizations(id), CONSTRAINT fk_expense_advances_project FOREIGN KEY(project_id) REFERENCES projects(id), CONSTRAINT fk_expense_advances_agent FOREIGN KEY(field_agent_id) REFERENCES field_agents(id), CONSTRAINT fk_expense_advances_depositor FOREIGN KEY(deposited_by_user_id) REFERENCES users(id), CONSTRAINT fk_expense_advances_creator FOREIGN KEY(created_by_id) REFERENCES users(id), CONSTRAINT fk_expense_advances_updater FOREIGN KEY(updated_by_id) REFERENCES users(id), CHECK(amount > 0)) ${engine}`,
      );
    if (!(await q.hasTable('project_financial_closures')))
      await q.query(
        `CREATE TABLE project_financial_closures (id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, organization_id BIGINT UNSIGNED NOT NULL, project_id BIGINT UNSIGNED NOT NULL, closed_at DATETIME(3) NOT NULL, closed_by_id BIGINT UNSIGNED NULL, close_reason TEXT NOT NULL, reopened_at DATETIME(3) NULL, reopened_by_id BIGINT UNSIGNED NULL, reopen_reason TEXT NULL, PRIMARY KEY(id), INDEX idx_project_financial_closures_project(project_id, reopened_at), CONSTRAINT fk_project_financial_closures_org FOREIGN KEY(organization_id) REFERENCES organizations(id), CONSTRAINT fk_project_financial_closures_project FOREIGN KEY(project_id) REFERENCES projects(id), CONSTRAINT fk_project_financial_closures_closer FOREIGN KEY(closed_by_id) REFERENCES users(id), CONSTRAINT fk_project_financial_closures_reopener FOREIGN KEY(reopened_by_id) REFERENCES users(id)) ${engine}`,
      );
    for (const [key, description] of PERMISSIONS) {
      const [resource, action] = key.split(':');
      await q.query(
        'INSERT INTO permissions (`key`,resource,action,scope,description) VALUES (?,?,?,?,?) ON DUPLICATE KEY UPDATE `key`=`key`',
        [key, resource, action, 'ORGANIZATION', description],
      );
    }
  }

  async down(q: QueryRunner): Promise<void> {
    const keys = PERMISSIONS.map(([key]) => `'${key}'`).join(',');
    await q.query(
      `DELETE rp FROM role_permissions rp JOIN permissions p ON p.id = rp.permission_id WHERE p.\`key\` IN (${keys})`,
    );
    await q.query(`DELETE FROM permissions WHERE \`key\` IN (${keys})`);
    await q.query('DROP TABLE IF EXISTS project_financial_closures');
    await q.query('DROP TABLE IF EXISTS expense_advances');
    if (await q.hasColumn('expenses', 'reimbursement_batch_id'))
      await q.query(
        'ALTER TABLE expenses DROP FOREIGN KEY fk_expenses_reimbursement_batch, DROP FOREIGN KEY fk_expenses_reopened_by, DROP INDEX idx_expenses_reimbursement_batch, DROP INDEX uq_expenses_project_sequence',
      );
    for (const name of [
      'reopened_by_id',
      'reopened_at',
      'reimbursement_batch_id',
      'rejection_reason',
      'project_sequence',
      'deposited_amount',
      'invoiced_payment_date',
      'payment_method',
      'reason_code',
      'expense_type',
    ])
      if (await q.hasColumn('expenses', name))
        await q.query(`ALTER TABLE expenses DROP COLUMN ${name}`);
    await q.query('DROP TABLE IF EXISTS expense_reimbursement_batches');
  }
}
