const base = require('./jest.base.cjs');
module.exports = {
  ...base,
  displayName: 'mysql',
  testRegex: undefined,
  testMatch: ['<rootDir>/test/integration/**/*.e2e-spec.ts'],
  testPathIgnorePatterns: ['/node_modules/', '/test/integration/storage/'],
  testTimeout: 300000,
};
