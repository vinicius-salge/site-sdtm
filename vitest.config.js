import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    env: {
      JWT_SECRET: 'test-secret-key-for-unit-tests-only',
      JWT_EXPIRES_IN: '1h',
      NODE_ENV: 'test',
    },
  },
});
