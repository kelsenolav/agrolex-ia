import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  // pdfjs-dist é ESM puro (import.meta.url). O Jest em CJS não consegue
  // parseá-lo diretamente. Testes de integração real com pdfjs-dist devem
  // usar o script ESM: npm run test:integration:pdf
  transformIgnorePatterns: [
    'node_modules/(?!(pdfjs-dist)/)',
  ],
};

export default config;
