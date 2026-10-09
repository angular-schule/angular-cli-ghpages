import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    // Run test files serially: several suites run real git commands and the
    // standalone CLI against temporary repositories
    fileParallelism: false
  }
});
