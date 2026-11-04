const base = require('./jest.base.cjs');
module.exports = {
  ...base,
  displayName: 'sqlite',
  testRegex: undefined,
  testMatch: [
    '<rootDir>/test/contract/**/*.spec.ts',
    '<rootDir>/test/integration/**/*.e2e-spec.ts',
  ],
  // These suites require MySQL isolation/DECIMAL semantics, not a mock engine.
  testPathIgnorePatterns: [
    '/node_modules/',
    '/test/integration/(budgets|contracts|documents|managerial-dre|receivables|technical-reports)/',
    '\\.mysql\\.e2e-spec\\.ts$',
    '/test/integration/storage/',
  ],
};
