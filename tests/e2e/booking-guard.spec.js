const { test, expect } = require('@playwright/test');
const path = require('path');
const { pathToFileURL } = require('url');

const BOOK_URL = `${pathToFileURL(path.resolve(__dirname, '../../book.html')).href}?barber=1`;

test.describe('Booking access guard', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('redirects unauthenticated users to login', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.removeItem('bh_token');
      localStorage.removeItem('bh_user');
      localStorage.removeItem('bh_current_user');
    });

    await page.goto(BOOK_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForURL(/login\.html/, { timeout: 10000 });

    await expect(page.locator('#loginForm')).toBeVisible();
  });
});
