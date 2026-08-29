import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './test/browser',
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  use: {
    browserName: 'chromium',
    headless: true,
  },
});
