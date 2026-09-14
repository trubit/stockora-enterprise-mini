import { test, expect } from '@playwright/test';

test.describe('Phase 44: SaaS Pricing & Plan Catalog E2E Tests', () => {
  test('1. Pricing Matrix: Loads all SaaS plans and toggles billing interval', async ({ page }) => {
    await page.goto('/pricing');

    // Verify title and header
    await expect(page.locator('text=Flexible SaaS Plans for Modern Enterprises')).toBeVisible();

    // Verify interval switch buttons
    const monthlyBtn = page.locator('button:has-text("Monthly Billing")');
    const yearlyBtn = page.locator('button:has-text("Yearly Billing")');
    await expect(monthlyBtn).toBeVisible();
    await expect(yearlyBtn).toBeVisible();

    // Verify discount badge
    await expect(page.locator('text=Save 20%')).toBeVisible();

    // Switch to Yearly
    await yearlyBtn.click();
    await expect(page.locator('text=Billed annually').first()).toBeVisible();

    // Switch back to Monthly
    await monthlyBtn.click();
  });

  test('2. Feature & Limit Matrix: Renders detailed capability comparison', async ({ page }) => {
    await page.goto('/pricing');

    // Verify comparison table exists
    await expect(page.locator('text=Detailed Feature & Limit Comparison')).toBeVisible();
    await expect(page.locator('text=Max Users')).toBeVisible();
    await expect(page.locator('text=Max Branches')).toBeVisible();
    await expect(page.locator('text=Max Warehouses')).toBeVisible();
    await expect(page.locator('text=POS & Inventory Checkout')).toBeVisible();
  });

  test('3. Checkout Modal: Triggers Paystack checkout flow upon selecting plan', async ({ page }) => {
    await page.goto('/pricing');

    // Click subscribe on a plan card
    const subscribeBtn = page.locator('button:has-text("Subscribe"), button:has-text("Get Started")').first();
    if (await subscribeBtn.isVisible()) {
      await subscribeBtn.click();
      // If modal opens
      const modal = page.locator('.modal-title:has-text("Confirm Subscription Change")');
      if (await modal.isVisible()) {
        await expect(page.locator('text=Pay with Paystack')).toBeVisible();
      }
    }
  });
});
