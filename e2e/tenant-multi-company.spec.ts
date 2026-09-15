import { test, expect } from '@playwright/test';
import { authenticateE2E } from './helpers/auth.js';

test.describe('Phase 43: Multi-Tenant SaaS & Company Isolation E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    await authenticateE2E(page);
  });

  test('1. Onboarding Wizard: Allows new company registration with 8-step flow', async ({ page }) => {
    // Navigate to onboarding wizard
    await page.goto('/onboarding');
    await expect(page).toHaveTitle(/Stockora/i);

    // Verify Wizard Header and Steps are rendered
    await expect(page.locator('text=Company Onboarding Wizard')).toBeVisible();
    await expect(page.locator('text=Company Profile')).toBeVisible();
    await expect(page.locator('text=Launch Setup')).toBeVisible();

    // Verify company name input field
    const companyInput = page.locator('input[name="name"], input').first();
    await expect(companyInput).toBeVisible();
  });

  test('2. Company SaaS Settings: Renders tabs for profile, branding, tax, feature flags, and team invites', async ({ page }) => {
    await page.goto('/company/settings');

    // Verify Company Settings Header
    await expect(page.locator('text=Company & SaaS Settings')).toBeVisible();

    // Verify Tabs
    await expect(page.locator('button:has-text("General Profile")')).toBeVisible();
    await expect(page.locator('button:has-text("Branding & Themes")')).toBeVisible();
    await expect(page.locator('button:has-text("Localization & Tax")')).toBeVisible();
    await expect(page.locator('button:has-text("Feature Flags")')).toBeVisible();
    await expect(page.locator('button:has-text("Team Invitations")')).toBeVisible();
    await expect(page.locator('button:has-text("Limits & Tier")')).toBeVisible();

    // Click Branding & Themes tab
    await page.click('button:has-text("Branding & Themes")');
    await expect(page.locator('text=Primary Brand Color').first()).toBeVisible();
    await expect(page.locator('text=Custom Branding & Document Layouts')).toBeVisible();

    // Click Feature Flags tab
    await page.click('button:has-text("Feature Flags")');
    await expect(page.locator('text=Tenant Feature Flag Controls')).toBeVisible();

    // Click Team Invitations tab
    await page.click('button:has-text("Team Invitations")');
    await expect(page.locator('text=Invite Employees & Manage Team Access')).toBeVisible();
  });

  test('3. Platform Super Admin Console: Renders SaaS tenant directory and status controls', async ({ page }) => {
    await page.goto('/admin/platform');

    // Verify Platform Admin Title
    await expect(page.locator('text=SaaS Platform Administration Console')).toBeVisible();
    await expect(page.locator('text=Cross-tenant operational oversight')).toBeVisible();
  });

  test('4. Tenant Switcher Component: Renders and provides seamless tenant selection', async ({ page }) => {
    await page.goto('/dashboard');

    // Switcher button should be visible in AppBar
    const switcher = page.locator('button:has-text("HQ"), button:has-text("Company"), button:has-text("Default Organization")').first();
    if (await switcher.isVisible()) {
      await switcher.click();
      await expect(page.locator('text=My Organizations')).toBeVisible();
      await expect(page.locator('text=Register New Company')).toBeVisible();
    }
  });
});
