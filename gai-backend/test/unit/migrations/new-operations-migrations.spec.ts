import { FixEvidenceStorageKeyIndex1793000000001 } from '../../../src/migrations/1793000000001-fix-evidence-storage-key-index';
import { CreateInventoryOperations1741200000001 } from '../../../src/migrations/1741200000001-create-inventory-operations';
import { CreateExpenseAccountabilities1741300000001 } from '../../../src/migrations/1741300000001-create-expense-accountabilities';
import { CloseInventoryOperationGaps1741400000001 } from '../../../src/migrations/1741400000001-close-inventory-operation-gaps';

describe('new operations migrations', () => {
  const runner = (existingColumns: string[] = []) => {
    const queries: string[] = [];
    return {
      queries,
      queryRunner: {
        query: jest.fn((sql: string) => {
          queries.push(sql);
          if (/information_schema/i.test(sql))
            return Promise.resolve(
              existingColumns.map((COLUMN_NAME) => ({ COLUMN_NAME })),
            );
          return Promise.resolve();
        }),
      },
    };
  };

  it('creates inventory dependencies in order and rolls them back in reverse order', async () => {
    const up = runner();
    await new CreateInventoryOperations1741200000001().up(
      up.queryRunner as never,
    );
    expect(
      up.queries.map((sql) => sql.match(/CREATE TABLE (\w+)/)?.[1]),
    ).toEqual([
      'inventory_sessions',
      'inventory_rounds',
      'inventory_observations',
      'inventory_plate_history',
      'inventory_reconciliations',
      'inventory_consolidations',
      'asset_valuations',
      'inventory_operation_audit_logs',
    ]);
    expect(up.queries.join('\n')).toContain(
      'UNIQUE INDEX uq_inventory_observations_round_item',
    );
    expect(up.queries.join('\n')).toContain('DECIMAL(15,2)');
    const down = runner();
    await new CreateInventoryOperations1741200000001().down(
      down.queryRunner as never,
    );
    expect(down.queries[0]).toBe('DROP TABLE inventory_operation_audit_logs');
    expect(down.queries.at(-1)).toBe('DROP TABLE inventory_sessions');
  });

  it('enforces unique expense membership and exact financial precision', async () => {
    const up = runner();
    await new CreateExpenseAccountabilities1741300000001().up(
      up.queryRunner as never,
    );
    const sql = up.queries.join('\n');
    expect(sql).toContain(
      'UNIQUE INDEX uq_expense_accountability_items_expense(expense_id)',
    );
    expect(sql.match(/DECIMAL\(15,2\)/g)).toHaveLength(2);
    const down = runner();
    await new CreateExpenseAccountabilities1741300000001().down(
      down.queryRunner as never,
    );
    expect(down.queries).toEqual([
      'DROP TABLE expense_accountability_audit_logs',
      'DROP TABLE expense_installments',
      'DROP TABLE expense_accountability_items',
      'DROP TABLE expense_accountabilities',
    ]);
  });

  it('adds cancellable sessions and append-only observation evidence', async () => {
    const up = runner();
    await new CloseInventoryOperationGaps1741400000001().up(
      up.queryRunner as never,
    );
    const sql = up.queries.join('\n');
    expect(sql).toContain('ADD COLUMN cancelled_at');
    expect(sql).toContain('CREATE TABLE inventory_observation_evidence');
    expect(sql).toContain(
      'UNIQUE INDEX uq_inventory_observation_evidence_storage_key (storage_key(768))',
    );
    expect(sql).toContain('FOREIGN KEY (observation_id)');

    const down = runner();
    await new CloseInventoryOperationGaps1741400000001().down(
      down.queryRunner as never,
    );
    expect(down.queries[0]).toBe('DROP TABLE inventory_observation_evidence');
    expect(down.queries[1]).toContain('DROP COLUMN cancelled_at');
  });
  it('resumes after session columns were committed by MySQL', async () => {
    const partial = runner(['cancelled_at', 'cancellation_reason']);
    await new CloseInventoryOperationGaps1741400000001().up(
      partial.queryRunner as never,
    );
    expect(
      partial.queries.filter((sql) => /ADD COLUMN/.test(sql)),
    ).toHaveLength(0);
    expect(
      partial.queries.some((sql) =>
        /CREATE TABLE inventory_observation_evidence/.test(sql),
      ),
    ).toBe(true);
  });

  it('uses full binary ASCII uniqueness in a forward migration', async () => {
    const query = jest.fn().mockResolvedValue([]);
    await new FixEvidenceStorageKeyIndex1793000000001().up({ query } as never);
    expect(query.mock.calls[1][0]).toContain(
      'CHARACTER SET ascii COLLATE ascii_bin',
    );
    expect(query.mock.calls[1][0]).toContain('(storage_key)');
    expect(query.mock.calls[1][0]).not.toMatch(/DROP TABLE|DROP COLUMN/);
    await new FixEvidenceStorageKeyIndex1793000000001().down({
      query,
    } as never);
    expect(query.mock.calls[3][0]).toContain('(storage_key(768))');
  });

  it.each(['up', 'down'] as const)(
    'refuses unsafe %s before DDL',
    async (direction) => {
      const query = jest.fn().mockResolvedValue([{ id: 1 }]);
      await expect(
        new FixEvidenceStorageKeyIndex1793000000001()[direction]({
          query,
        } as never),
      ).rejects.toThrow();
      expect(query).toHaveBeenCalledTimes(1);
    },
  );
});
