import { readFileSync } from 'fs';
import { join } from 'path';
describe('expense-accountabilities contract', () => {
  const content = readFileSync(
    join(process.cwd(), 'specs/017-expense-accountabilities/spec.md'),
    'utf8',
  );
  it('documents lifecycle and endpoints', () => {
    for (const value of [
      'expense-accountabilities',
      '/{id}/expenses',
      '/{id}/close',
      'installments',
    ])
      expect(content).toContain(value);
  });
  it('documents all permissions', () => {
    for (const value of [
      'expense-accountabilities:create',
      'expense-accountabilities:read',
      'expense-accountabilities:update',
      'expense-accountabilities:close',
      'expense-installments:create',
      'expense-installments:read',
    ])
      expect(content).toContain(value);
  });
});
