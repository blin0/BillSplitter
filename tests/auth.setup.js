import { test as setup } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const authFile = path.join(__dirname, '../playwright/.auth/user.json');

setup('authenticate', async ({ page }) => {
  await page.goto('/login');

  await page.fill('input[name="email"]', process.env.TEST_EMAIL);
  await page.fill('input[name="password"]', process.env.TEST_PASSWORD);
  await page.click('button[type="submit"]');

  await page.waitForURL('**/dashboard');

  await page.context().storageState({ path: authFile });
});
