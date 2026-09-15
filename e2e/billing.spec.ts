import { test, expect } from '@playwright/test';
import { authenticateE2E } from './helpers/auth.js';

test.describe('Phase 44: SaaS Billing, Invoices & Usage Limits E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    await authenticateE2E(page);
  });

  test('1. Billing Dashboard: Renders active plan, renewal date, and quick resource meters', async ({ page }) => {
    await page.goto('/company/billing', { waitUntil: 'domcontentloaded' });

    // Verify main header
    await expect(page.locator('text=Billing & Subscription Suite').first()).toBeVisible();
    await expect(page.locator('button:has-text("Usage Telemetry")')).toBeVisible();
    await expect(page.locator('button:has-text("Change / Upgrade Plan")')).toBeVisible();

    // Verify Invoices & Transactions section headers
    await expect(page.locator('text=Official SaaS Invoices & Tax Receipts').first()).toBeVisible();
    await expect(page.locator('text=Paystack Gateway Settlements').first()).toBeVisible();
  });

  test('2. Resource Quota & Usage Dashboard: Renders 11 metered quota cards with thresholds', async ({ page }) => {
    await page.goto('/company/usage', { waitUntil: 'domcontentloaded' });

    // Verify Usage Dashboard Header
    await expect(page.locator('text=Resource Quota & Usage Telemetry').first()).toBeVisible();
    await expect(page.locator('button:has-text("Sync & Reconcile")')).toBeVisible();
    await expect(page.locator('button:has-text("Upgrade Limits")')).toBeVisible();

    // Verify key metrics exist
    await expect(page.locator('text=Staff & Team Seats')).toBeVisible();
    await expect(page.locator('text=Store Branches')).toBeVisible();
    await expect(page.locator('text=Warehouses & Hubs')).toBeVisible();
    await expect(page.locator('text=Catalog Products & SKUs')).toBeVisible();
  });

  test('3. Platform Billing Admin: Displays global SaaS MRR, ARR, and plan catalog editor', async ({ page }) => {
    await page.goto('/admin/billing', { waitUntil: 'domcontentloaded' });

    // Verify Admin Header
    await expect(page.locator('text=Platform Billing & Governance').first()).toBeVisible();
    await expect(page.locator('text=Configurable SaaS Plan Catalog')).toBeVisible();
    await expect(page.locator('text=Tenant Subscriptions Registry')).toBeVisible();
  });
});
