import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    // Run tests serially to avoid ghPages.clean() race conditions
    // engine.gh-pages-clean.spec.ts calls ghPages.clean() which affects ALL cache dirs
    fileParallelism: false
  }
});
