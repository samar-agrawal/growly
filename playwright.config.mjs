import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './e2e',
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  use: { baseURL: 'http://127.0.0.1:3108', trace: 'retain-on-failure' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['iPhone 13'], defaultBrowserType: 'chromium' } },
  ],
  webServer: {
    command: 'node scripts/e2e-server.mjs',
    url: 'http://127.0.0.1:3108/api/dashboard',
    reuseExistingServer: false,
    timeout: 120000,
  },
});
