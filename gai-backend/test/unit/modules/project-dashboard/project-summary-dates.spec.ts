import { TypeOrmProjectSummaryRepository } from '../../../../src/modules/project-dashboard/infrastructure/persistence/typeorm-project-summary.repository';

describe('Project summary raw database dates', () => {
  it.each([new Date('2026-10-27T12:34:56.789Z'), '2026-10-27T12:34:56.789Z'])(
    'serializes MySQL Date and SQLite string aggregates (%s)',
    async (value) => {
      const raw = {
        last_inventory_item_created_at: value,
        last_inventory_item_updated_at: value,
        last_import_finished_at: value,
        last_export_finished_at: value,
        last_pending_issue_created_at: value,
        last_payment_updated_at: value,
      };
      const builder = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue(raw),
      };
      const repo = { createQueryBuilder: () => builder } as never;
      const summary = new TypeOrmProjectSummaryRepository(
        repo,
        repo,
        repo,
        repo,
        repo,
        repo,
        repo,
        repo,
        repo,
        repo,
        repo,
        repo,
        repo,
        repo,
        repo,
      );
      const result = await summary.getRecentActivitySummary(7);
      expect(Object.values(result)).toEqual(
        Array(6).fill('2026-10-27T12:34:56.789Z'),
      );
    },
  );
});
