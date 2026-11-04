const base = require('./jest.base.cjs');
module.exports = {
  ...base,
  displayName: 'unit',
  testRegex: undefined,
  testMatch: ['<rootDir>/src/**/*.spec.ts', '<rootDir>/test/unit/**/*.spec.ts'],
};
