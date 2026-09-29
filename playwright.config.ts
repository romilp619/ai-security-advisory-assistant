import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './tests/browser', fullyParallel: true, retries: 0,
  use: {baseURL:'http://127.0.0.1:3000',trace:'retain-on-failure'},
  webServer: {command:'npm run start',url:'http://127.0.0.1:3000',reuseExistingServer:!process.env.CI,timeout:60000},
  projects: [
    {name:'desktop',use:{...devices['Desktop Chrome'],viewport:{width:1440,height:1100}}},
    {name:'mobile',use:{...devices['iPhone 13'],defaultBrowserType:'chromium'}},
  ],
});
