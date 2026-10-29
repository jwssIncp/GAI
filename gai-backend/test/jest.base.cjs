const path = require('node:path');
module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  testRegex: '.*\\.(spec|e2e-spec)\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.spec.ts',
    '!src/main.ts',
    '!src/app.module.ts',
    '!src/**/*.entity.ts',
    '!src/modules/auth/infrastructure/email/ses-email.sender.ts',
    '!src/migrations/**',
    '!src/scripts/**',
  ],
  coverageDirectory: 'coverage',
  coverageThreshold: {
    global: {
      branches: 60,
      functions: 60,
      lines: 60,
      statements: 60,
    },
  },
  testEnvironment: 'node',
  testTimeout: 60000,
  rootDir: path.resolve(__dirname, '..'),
};
