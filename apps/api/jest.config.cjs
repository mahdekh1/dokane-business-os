/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testRegex: '\\.spec\\.ts$',
  moduleNameMapper: {
    '^@dokane/contracts$': '<rootDir>/../../packages/contracts/src/index.ts',
    '^@dokane/module-sdk$': '<rootDir>/../../packages/module-sdk/src/index.ts',
  },
  setupFiles: ['<rootDir>/test/setup-env.ts'],
  testTimeout: 20000,
};
