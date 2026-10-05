if (!process.env.TEST_DB) {
  require('dotenv').config({ path: '.env.test' });
}

const nextJest = require('next/jest');

const createJestConfig = nextJest({
  dir: './',
});

/** @type {import('jest').Config} */
const customJestConfig = {
  testEnvironment: 'node',
  watchman: false,
  haste: {
    enableSymlinks: true,
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  testTimeout: 30000,
  maxWorkers: 1,
  globalSetup: '<rootDir>/jest.global-setup.js',
};

// next/jest may override testMatch; re-apply it after createJestConfig
const jestConfig = createJestConfig(customJestConfig);

module.exports = async () => {
  const config = await jestConfig();
  return {
    ...config,
    testMatch: ['**/__tests__/**/*.test.js'],
    testPathIgnorePatterns: ['/node_modules/', '/.next/'],
  };
};
