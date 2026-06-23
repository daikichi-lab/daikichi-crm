import { defineConfig, devices } from '@playwright/test';

const PORT = 3100;
const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30000,
  expect: { timeout: 7500 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    // Dev/test run uses the PGlite driver + dev-auth (no cloud Supabase needed).
    command: 'npm run build && npm run start -- -p 3100',
    url: BASE_URL,
    timeout: 180000,
    reuseExistingServer: !process.env.CI,
    env: {
      APP_DATA_DRIVER: 'pglite',
      APP_AUTH: 'dev',
      APP_SEED: '1',
      NODE_ENV: 'production',
    },
  },
});
