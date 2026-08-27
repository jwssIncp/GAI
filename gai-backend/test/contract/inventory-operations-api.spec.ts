import { readFileSync } from 'fs';
import { join } from 'path';

describe('inventory-operations contract', () => {
  const content = readFileSync(
    join(process.cwd(), 'specs/016-inventory-operations/spec.md'),
    'utf8',
  );

  it('documents sessions, reinventory, observations, reconciliation and consolidation', () => {
    for (const value of [
      'inventory-sessions',
      'current_round_id',
      '/rounds',
      'reinventory',
      'observations',
      'evidence/upload-url',
      'confirm-upload',
      'download-url',
      '/finish',
      '/cancel',
      'reconciliations',
      'consolidate',
      'valuations',
      'plate-history',
    ])
      expect(content).toContain(value);
  });

  it('documents authorization keys', () => {
    for (const value of [
      'inventory-sessions:create',
      'inventory-rounds:reinventory',
      'inventory-observations:create',
      'reconciliations:create',
      'consolidations:create',
      'asset-valuations:create',
      'plate-history:read',
    ])
      expect(content).toContain(value);
  });

  it('documents restart recovery, lifecycle and storage authorization', () => {
    for (const value of [
      'After a restart',
      'draft -> active -> finished',
      'object-storage',
      'organization, project, session, round and observation',
      'INVENTORY_ROUND_CONCURRENT_MODIFICATION',
      'RECONCILIATION_ALREADY_CONSOLIDATED',
    ])
      expect(content).toContain(value);
  });
});
