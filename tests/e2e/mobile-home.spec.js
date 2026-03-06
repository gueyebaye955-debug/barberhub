const { test, expect } = require('@playwright/test');
const path = require('path');
const { pathToFileURL } = require('url');

const HOME_URL = pathToFileURL(path.resolve(__dirname, '../../index.html')).href;

test.describe('Mobile homepage', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('renders categories and special offers on mobile', async ({ page }) => {
    await page.goto(HOME_URL, { waitUntil: 'domcontentloaded' });

    await expect(page.locator('#searchInput')).toBeVisible();
    await page.waitForSelector('#categoryRow .category-item', { timeout: 15000 });
    await page.waitForSelector('#offerRow .offer-card', { timeout: 15000 });

    const categoryCount = await page.locator('#categoryRow .category-item').count();
    const offerCount = await page.locator('#offerRow .offer-card').count();

    expect(categoryCount).toBeGreaterThanOrEqual(6);
    expect(offerCount).toBeGreaterThan(0);
  });

  test('city quick filter toggles active state', async ({ page }) => {
    await page.goto(HOME_URL, { waitUntil: 'domcontentloaded' });

    const allCities = page.locator('.quick-tag[data-city=""]');
    const brooklyn = page.locator('.quick-tag[data-city="Brooklyn"]');

    await expect(allCities).toHaveAttribute('aria-pressed', 'true');
    await brooklyn.click();
    await expect(brooklyn).toHaveAttribute('aria-pressed', 'true');
  });
});
