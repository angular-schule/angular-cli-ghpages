/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  modulePathIgnorePatterns: ['<rootDir>/dist/package.json'],
  // Run tests serially to avoid ghPages.clean() race conditions
  // engine.gh-pages-clean.spec.ts calls ghPages.clean() which affects ALL cache dirs
  maxWorkers: 1
};
