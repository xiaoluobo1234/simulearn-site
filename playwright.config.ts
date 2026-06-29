import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  use: { baseURL: 'http://127.0.0.1:8787' },
  webServer: {
    command: 'npm run dev:ai -- --port 8787',
    url: 'http://127.0.0.1:8787',
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
