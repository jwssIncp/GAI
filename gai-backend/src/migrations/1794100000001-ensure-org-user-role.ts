import { MigrationInterface, QueryRunner } from 'typeorm';

/** Additive and idempotent: preserve existing roles, permissions and links. */
export class EnsureOrgUserRole1794100000001 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    await q.query(`INSERT INTO roles (\`key\`, type, organization_id, name, description, is_active, created_at, updated_at)
      SELECT 'ORG_USER', 'SYSTEM', NULL, 'Usuário da organização',
      'Perfil básico de acesso à organização, com funcionalidades definidas pelas permissões efetivamente associadas.',
      1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      WHERE NOT EXISTS (SELECT 1 FROM roles WHERE \`key\` = 'ORG_USER')`);
  }
  async down(): Promise<void> {
    // Intentionally retain the role: it may already have user assignments.
  }
}
