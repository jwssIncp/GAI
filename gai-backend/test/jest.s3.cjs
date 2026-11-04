const base = require('./jest.base.cjs');
module.exports = {
  ...base,
  displayName: 's3',
  testRegex: undefined,
  testMatch: ['<rootDir>/test/integration/storage/**/*.e2e-spec.ts'],
  testTimeout: 300000,
};
