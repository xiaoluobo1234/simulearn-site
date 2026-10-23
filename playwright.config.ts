import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  use: { baseURL: 'http://127.0.0.1:8787' },
  webServer: {
    // Ephemeral local account tests use a development-only key and never call live AI.
    command: 'npm run dev:ai -- --port 8787 --var JWT_SECRET:local-study-acceptance-only --var SIMULEARN_AI_MODE:mock',
    url: 'http://127.0.0.1:8787',
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
