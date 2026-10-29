// Safe default: fast domain/unit checks and explicitly compatible SQLite HTTP.
const base = require('./test/jest.base.cjs');
module.exports = {
  testTimeout: base.testTimeout,
  coverageThreshold: base.coverageThreshold,
  collectCoverageFrom: base.collectCoverageFrom,
  coverageDirectory: base.coverageDirectory,
  projects: [
    require('./test/jest.unit.cjs'),
    require('./test/jest.sqlite.cjs'),
  ],
};
