import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Paridade financeira, etapa 1 (só acrescenta; nenhuma coluna existente muda):
 * - M1 finance_settings_versions: parâmetros financeiros versionados por organização;
 * - M2 field_agents.state: UF do inventariante (nula nos registros antigos);
 * - M3 field_agent_documents: documentos anexados ao inventariante;
 * - permissões novas do catálogo.
 */
export class FinanceSettingsAndFieldAgentRecords1794700000001 implements MigrationInterface {
  name = 'FinanceSettingsAndFieldAgentRecords1794700000001';

  async up(q: QueryRunner): Promise<void> {
    const engine =
      'ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci';
    if (!(await q.hasTable('finance_settings_versions')))
      await q.query(
        `CREATE TABLE finance_settings_versions (id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, organization_id BIGINT UNSIGNED NOT NULL, version INT NOT NULL, valid_from DATE NOT NULL, \`values\` JSON NOT NULL, reason TEXT NOT NULL, actor_id BIGINT UNSIGNED NULL, recorded_at DATETIME(3) NOT NULL, PRIMARY KEY(id), UNIQUE KEY uq_finance_settings_version(organization_id,version), UNIQUE KEY uq_finance_settings_valid_from(organization_id,valid_from), CONSTRAINT fk_finance_settings_org FOREIGN KEY(organization_id) REFERENCES organizations(id), CONSTRAINT fk_finance_settings_actor FOREIGN KEY(actor_id) REFERENCES users(id)) ${engine}`,
      );
    if (!(await q.hasColumn('field_agents', 'state')))
      await q.query(
        'ALTER TABLE field_agents ADD COLUMN state VARCHAR(2) NULL AFTER document, ADD INDEX idx_field_agents_org_state (organization_id, state)',
      );
    if (!(await q.hasTable('field_agent_documents')))
      await q.query(
        `CREATE TABLE field_agent_documents (id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, organization_id BIGINT UNSIGNED NOT NULL, field_agent_id BIGINT UNSIGNED NOT NULL, storage_provider VARCHAR(50) NOT NULL, bucket VARCHAR(255) NOT NULL, path VARCHAR(500) NOT NULL, original_name VARCHAR(255) NOT NULL, mime_type VARCHAR(100) NOT NULL, size_bytes BIGINT UNSIGNED NOT NULL, checksum VARCHAR(128) NULL, status VARCHAR(20) NOT NULL DEFAULT 'pending_upload', uploaded_by_id BIGINT UNSIGNED NULL, created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3), deleted_at DATETIME(3) NULL, PRIMARY KEY(id), INDEX idx_field_agent_documents_agent_status(field_agent_id, status), CONSTRAINT fk_field_agent_documents_agent FOREIGN KEY(field_agent_id) REFERENCES field_agents(id), CONSTRAINT fk_field_agent_documents_org FOREIGN KEY(organization_id) REFERENCES organizations(id), CONSTRAINT fk_field_agent_documents_uploader FOREIGN KEY(uploaded_by_id) REFERENCES users(id)) ${engine}`,
      );
    for (const [key, description] of [
      ['finance-settings:read', 'Parâmetros financeiros: consultar'],
      ['finance-settings:update', 'Parâmetros financeiros: criar nova versão'],
      ['field-agents:export', 'Exportar inventariantes'],
      [
        'field-agent-documents:read',
        'Documentos do inventariante: consultar e baixar',
      ],
      ['field-agent-documents:upload', 'Documentos do inventariante: anexar'],
      ['field-agent-documents:remove', 'Documentos do inventariante: remover'],
    ]) {
      const [resource, action] = key.split(':');
      await q.query(
        'INSERT INTO permissions (`key`,resource,action,scope,description) VALUES (?,?,?,?,?) ON DUPLICATE KEY UPDATE `key`=`key`',
        [key, resource, action, 'ORGANIZATION', description],
      );
    }
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(
      "DELETE rp FROM role_permissions rp JOIN permissions p ON p.id = rp.permission_id WHERE p.`key` IN ('finance-settings:read','finance-settings:update','field-agents:export','field-agent-documents:read','field-agent-documents:upload','field-agent-documents:remove')",
    );
    await q.query(
      "DELETE FROM permissions WHERE `key` IN ('finance-settings:read','finance-settings:update','field-agents:export','field-agent-documents:read','field-agent-documents:upload','field-agent-documents:remove')",
    );
    await q.query('DROP TABLE IF EXISTS field_agent_documents');
    if (await q.hasColumn('field_agents', 'state'))
      await q.query(
        'ALTER TABLE field_agents DROP INDEX idx_field_agents_org_state, DROP COLUMN state',
      );
    await q.query('DROP TABLE IF EXISTS finance_settings_versions');
  }
}
