import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Onda 1 (mobile auth). Additive only: existing sessions keep working as
 * 'web' (column default), no row is rewritten or revoked.
 */
export class CreateMobileSessions1794400000001 implements MigrationInterface {
  name = 'CreateMobileSessions1794400000001';

  async up(q: QueryRunner): Promise<void> {
    if (!(await q.hasColumn('sessions', 'client_type')))
      await q.query(
        "ALTER TABLE `sessions` ADD COLUMN `client_type` VARCHAR(10) NOT NULL DEFAULT 'web'",
      );
    if (!(await q.hasColumn('sessions', 'refresh_family_id')))
      await q.query(
        'ALTER TABLE `sessions` ADD COLUMN `refresh_family_id` VARCHAR(36) NULL',
      );
    if (
      !(await q.getTable('sessions'))!.indices.some(
        (i) => i.name === 'idx_sessions_refresh_family',
      )
    )
      await q.query(
        'CREATE INDEX `idx_sessions_refresh_family` ON `sessions` (`refresh_family_id`)',
      );
    if (!(await q.hasTable('mobile_refresh_tokens')))
      await q.query(`CREATE TABLE \`mobile_refresh_tokens\` (
        \`id\` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        \`family_id\` VARCHAR(36) NOT NULL,
        \`token_hash\` VARCHAR(64) NOT NULL,
        \`user_id\` BIGINT UNSIGNED NOT NULL,
        \`organization_id\` BIGINT UNSIGNED NOT NULL,
        \`session_id\` VARCHAR(36) NOT NULL,
        \`auth_version\` INT NOT NULL DEFAULT 0,
        \`expires_at\` DATETIME(3) NOT NULL,
        \`family_expires_at\` DATETIME(3) NOT NULL,
        \`rotated_at\` DATETIME(3) NULL,
        \`revoked_at\` DATETIME(3) NULL,
        \`revoked_reason\` VARCHAR(30) NULL,
        \`replaced_by_id\` BIGINT UNSIGNED NULL,
        \`device_label\` VARCHAR(100) NULL,
        \`created_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        PRIMARY KEY (\`id\`),
        UNIQUE INDEX \`uq_mobile_refresh_tokens_hash\` (\`token_hash\`),
        INDEX \`idx_mobile_refresh_tokens_family\` (\`family_id\`),
        INDEX \`idx_mobile_refresh_tokens_user\` (\`user_id\`),
        CONSTRAINT \`fk_mobile_refresh_tokens_user\` FOREIGN KEY (\`user_id\`) REFERENCES \`users\` (\`id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
  }

  async down(q: QueryRunner): Promise<void> {
    if (await q.hasTable('mobile_refresh_tokens'))
      await q.query('DROP TABLE `mobile_refresh_tokens`');
    if (
      (await q.getTable('sessions'))!.indices.some(
        (i) => i.name === 'idx_sessions_refresh_family',
      )
    )
      await q.query('DROP INDEX `idx_sessions_refresh_family` ON `sessions`');
    if (await q.hasColumn('sessions', 'refresh_family_id'))
      await q.query('ALTER TABLE `sessions` DROP COLUMN `refresh_family_id`');
    if (await q.hasColumn('sessions', 'client_type'))
      await q.query('ALTER TABLE `sessions` DROP COLUMN `client_type`');
  }
}
