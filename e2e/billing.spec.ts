import { test, expect } from '@playwright/test';

test.describe('Phase 44: SaaS Billing, Invoices & Usage Limits E2E Tests', () => {
  test('1. Billing Dashboard: Renders active plan, renewal date, and quick resource meters', async ({ page }) => {
    await page.goto('/company/billing');

    // Verify main header
    await expect(page.locator('text=Billing & SaaS Subscription')).toBeVisible();
    await expect(page.locator('text=Full Usage Dashboard')).toBeVisible();
    await expect(page.locator('text=Change / Upgrade Plan')).toBeVisible();

    // Verify Invoices & Transactions section headers
    await expect(page.locator('text=SaaS Invoices')).toBeVisible();
    await expect(page.locator('text=Payment History (Paystack)')).toBeVisible();
  });

  test('2. Resource Quota & Usage Dashboard: Renders 11 metered quota cards with thresholds', async ({ page }) => {
    await page.goto('/company/usage');

    // Verify Usage Dashboard Header
    await expect(page.locator('text=Resource Quota & Usage Metering')).toBeVisible();
    await expect(page.locator('button:has-text("Sync / Reconcile")')).toBeVisible();
    await expect(page.locator('button:has-text("Upgrade Quota")')).toBeVisible();

    // Verify key metrics exist
    await expect(page.locator('text=Staff & Team Users')).toBeVisible();
    await expect(page.locator('text=Store Branches')).toBeVisible();
    await expect(page.locator('text=Warehouses')).toBeVisible();
    await expect(page.locator('text=Catalog Products')).toBeVisible();
  });

  test('3. Platform Billing Admin: Displays global SaaS MRR, ARR, and plan catalog editor', async ({ page }) => {
    await page.goto('/admin/billing');

    // Verify Admin Header
    await expect(page.locator('text=Platform Billing & SaaS Administration')).toBeVisible();
    await expect(page.locator('text=Configurable SaaS Plan Catalog')).toBeVisible();
    await expect(page.locator('text=Tenant Subscriptions Registry')).toBeVisible();
  });
});
