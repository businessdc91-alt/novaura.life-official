module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.ts', '**/?(*.)+(spec|test).ts'],
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
  moduleFileExtensions: ['ts', 'js', 'json'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/index.ts',
  ],
  coverageThreshold: {
    'src/services/emailService.ts': {
      branches: 35,
      functions: 80,
      lines: 70,
      statements: 70,
    },
    'src/api/routes/email.ts': {
      branches: 50,
      functions: 80,
      lines: 60,
      statements: 60,
    },
  },
};
