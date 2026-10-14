import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './e2e',
  workers: 1,
  use: {
    baseURL: 'http://127.0.0.1:4173/receitas/',
    browserName: 'chromium',
    channel: process.platform === 'win32' ? 'msedge' : undefined,
  },
  webServer: {
    command: 'node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 4173 --strictPort',
    url: 'http://127.0.0.1:4173/receitas/',
    reuseExistingServer: false,
    env: {
      VITE_SUPABASE_URL: 'https://rama-test.supabase.co',
      VITE_SUPABASE_PUBLISHABLE_KEY: 'test-public-key',
    },
  },
});
