import { defineConfig, devices } from '@playwright/test';

// E2E and screenshot runs against an already running app (local standalone server or docker compose).
// Browsers live in the project (.playwright-browsers/) so nothing is installed outside it.
process.env.PLAYWRIGHT_BROWSERS_PATH ??= `${process.cwd()}/.playwright-browsers`;

export default defineConfig({
  testDir: 'tests/e2e',
  outputDir: 'test-results',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  timeout: 60_000,
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3100',
    trace: 'retain-on-failure',
    locale: 'el-GR',
    timezoneId: 'Europe/Athens',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
