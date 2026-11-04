import { MigrationInterface, QueryRunner } from 'typeorm';
export class CreateProfessionalDocuments1793900000002 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    const base =
      'id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, organization_id BIGINT UNSIGNED NOT NULL, actor_id BIGINT UNSIGNED NOT NULL, recorded_at DATETIME(3) NOT NULL';
    const tail =
      ',PRIMARY KEY(id),FOREIGN KEY(organization_id) REFERENCES organizations(id),FOREIGN KEY(actor_id) REFERENCES users(id)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci';
    await q.query(
      `CREATE TABLE document_visual_versions (${base}, data JSON NOT NULL, hash VARCHAR(64) NOT NULL${tail}`,
    );
    await q.query(
      `CREATE TABLE document_artifacts (${base}, cache_key VARCHAR(64) NOT NULL, kind VARCHAR(12) NOT NULL, source_id BIGINT UNSIGNED NOT NULL, version_id BIGINT UNSIGNED NOT NULL, project_id BIGINT UNSIGNED NULL, format VARCHAR(8) NOT NULL, source_hash VARCHAR(64) NOT NULL, visual_hash VARCHAR(64) NOT NULL, visual_version VARCHAR(80) NOT NULL, include_memory BOOLEAN NOT NULL, status VARCHAR(120) NOT NULL, checksum VARCHAR(64) NOT NULL, size_bytes INT NOT NULL, bytes MEDIUMBLOB NOT NULL, UNIQUE KEY uq_document_artifact_key(cache_key), CHECK(size_bytes > 0 AND size_bytes <= 10485760), CHECK(format IN ('pdf','docx'))${tail}`,
    );
    await q.query(
      `CREATE TABLE document_audit_logs (${base}, operation VARCHAR(30) NOT NULL, details JSON NOT NULL${tail}`,
    );
    for (const key of ['budgets:export', 'documents:templates'])
      await q.query(
        'INSERT INTO permissions (`key`,resource,action,scope,description) VALUES (?,?,?,?,?) ON DUPLICATE KEY UPDATE scope=VALUES(scope)',
        [
          key,
          key.split(':')[0],
          key.split(':')[1],
          'ORGANIZATION',
          'Documentos profissionais: ' + key,
        ],
      );
  }
  down(): Promise<void> {
    return Promise.reject(
      new Error(
        'Histórico documental preservado: reversão destrutiva não suportada.',
      ),
    );
  }
}
