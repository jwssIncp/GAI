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
      'reinventory',
      'observations',
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
});
