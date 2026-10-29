import { MigrationInterface, QueryRunner } from 'typeorm';

export class FixEvidenceStorageKeyIndex1793000000001 implements MigrationInterface {
  name = 'FixEvidenceStorageKeyIndex1793000000001';

  async up(queryRunner: QueryRunner): Promise<void> {
    // Generated evidence paths contain ASCII only. Refuse lossy conversion of
    // legacy data before issuing DDL (MySQL DDL commits implicitly).
    const invalid = (await queryRunner.query(`SELECT id
      FROM inventory_observation_evidence
      WHERE HEX(storage_key) <> HEX(CONVERT(CONVERT(storage_key USING ascii) USING utf8mb4))
      LIMIT 1`)) as unknown[];
    if (invalid.length) {
      throw new Error(
        'Evidence storage keys contain non-ASCII data; conversion requires manual review',
      );
    }
    // One ALTER keeps retries safe and fails on missing/incompatible schema.
    // Full ASCII keys use 1024 bytes; utf8mb4 prefix uniqueness used 3072.
    await queryRunner.query(`ALTER TABLE inventory_observation_evidence
      DROP INDEX uq_inventory_observation_evidence_storage_key,
      MODIFY COLUMN storage_key VARCHAR(1024) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
      ADD UNIQUE INDEX uq_inventory_observation_evidence_storage_key (storage_key)`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    // Full binary uniqueness permits keys sharing the old case-insensitive
    // prefix. Refuse rollback rather than lose data or leave a partial change.
    const collisions = (await queryRunner.query(`SELECT 1
      FROM inventory_observation_evidence
      GROUP BY LEFT(CONVERT(storage_key USING utf8mb4), 768) COLLATE utf8mb4_unicode_ci
      HAVING COUNT(*) > 1 LIMIT 1`)) as unknown[];
    if (collisions.length) {
      throw new Error(
        'Evidence storage keys conflict under the legacy prefix index',
      );
    }
    await queryRunner.query(`ALTER TABLE inventory_observation_evidence
      DROP INDEX uq_inventory_observation_evidence_storage_key,
      MODIFY COLUMN storage_key VARCHAR(1024) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
      ADD UNIQUE INDEX uq_inventory_observation_evidence_storage_key (storage_key(768))`);
  }
}
