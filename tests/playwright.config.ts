import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  testMatch: /\d{2}-.*\.spec\.ts$/,
  timeout: 30000,
  retries: 0,
  reporter: [['html', { outputFolder: 'reports/ultima-execucao' }], ['list']],
  use: {
    baseURL: 'http://localhost:3001',
    viewport: { width: 1280, height: 720 },
    screenshot: 'only-on-failure',
    video: 'off',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { browserName: 'chromium' },
    },
  ],
});
