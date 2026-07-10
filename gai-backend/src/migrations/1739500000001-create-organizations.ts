import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateOrganizations1739500000001 implements MigrationInterface {
  name = 'CreateOrganizations1739500000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE organizations (
        id CHAR(36) NOT NULL,
        legal_name VARCHAR(255) NOT NULL,
        trade_name VARCHAR(255) NULL,
        cnpj CHAR(14) NOT NULL,
        contact_email VARCHAR(255) NULL,
        contact_phone VARCHAR(20) NULL,
        status ENUM('ACTIVE','INACTIVE') NOT NULL DEFAULT 'ACTIVE',
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
        PRIMARY KEY (id),
        UNIQUE KEY uk_organizations_cnpj (cnpj),
        INDEX idx_organizations_status (status),
        INDEX idx_organizations_legal_name (legal_name)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await queryRunner.query(`
      CREATE TABLE organization_audit_logs (
        id CHAR(36) NOT NULL,
        organization_id CHAR(36) NOT NULL,
        operation VARCHAR(50) NOT NULL,
        performed_by CHAR(36) NULL,
        changes JSON NOT NULL,
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        PRIMARY KEY (id),
        INDEX idx_org_audit_org_created (organization_id, created_at),
        CONSTRAINT fk_org_audit_organization FOREIGN KEY (organization_id) REFERENCES organizations(id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS organization_audit_logs');
    await queryRunner.query('DROP TABLE IF EXISTS organizations');
  }
}
