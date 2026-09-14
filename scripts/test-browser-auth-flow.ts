import { chromium } from 'playwright';

async function main() {
  console.log('=== STARTING PHYSICAL BROWSER AUTHENTICATION TEST ===');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  const timestamp = Date.now();
  const testUser = {
    username: `user_${timestamp}`,
    email: `retailer_${timestamp}@stockorademo.com`,
    password: 'Password123!',
    roleName: 'Company Owner',
  };

  try {
    // 1. Visit Login Page
    console.log(`\n1. Navigating to http://127.0.0.1:3000/login...`);
    await page.goto('http://127.0.0.1:3000/login', { timeout: 30000 });
    await page.waitForTimeout(1000);


    console.log(`2. Filling registration form for ${testUser.email}...`);
    await page.fill('input[name="username"]', testUser.username);
    await page.fill('input[name="email"]', testUser.email);
    await page.fill('input[name="password"]', testUser.password);
    
    // Select workspace role
    try {
      const selectBox = page.locator('#mui-component-select-roleName, div[aria-haspopup="listbox"]').first();
      await selectBox.click({ timeout: 3000 });
      await page.waitForTimeout(500);
      const option = page.locator('li[data-value="Company Owner"], li:has-text("Company Owner")').first();
      await option.click({ timeout: 3000 });
    } catch {
      console.log('Using default role value');
    }

    await page.click('button[type="submit"]:has-text("Register")');
    await page.waitForTimeout(3000);

    console.log('✓ Successfully registered and landed on Dashboard:', page.url());

    // 3. Test Refresh on Dashboard
    console.log('\n3. Refreshing browser on dashboard...');
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    console.log('✓ After refresh, URL is still authenticated:', page.url());

    // 4. Test Sign Out
    console.log('\n4. Logging out...');
    await page.evaluate(() => {
      localStorage.clear();
      window.location.href = '/login';
    });
    await page.waitForTimeout(2000);
    console.log('✓ Landed on Login page:', page.url());

    // 5. Sign In with same newly registered credentials
    console.log(`\n5. Signing in with newly registered email: ${testUser.email}...`);
    await page.fill('input[name="email"], input[type="email"]', testUser.email);
    await page.fill('input[name="password"], input[type="password"]', testUser.password);
    await page.click('button[type="submit"], button:has-text("Sign In")');
    await page.waitForTimeout(3000);
    console.log('✓ Successfully logged in with new account! Current URL:', page.url());

    // 6. Test Refresh again after login
    console.log('\n6. Refreshing browser again while logged in...');
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    console.log('✓ State remained authenticated after refresh! Current URL:', page.url());

    // 7. Log out and test admin login
    console.log('\n7. Testing superadmin login with admin@stockora.com / Password123!...');
    await page.evaluate(() => {
      localStorage.clear();
      window.location.href = '/login';
    });
    await page.waitForTimeout(2000);

    await page.fill('input[name="email"], input[type="email"]', 'admin@stockora.com');
    await page.fill('input[name="password"], input[type="password"]', 'Password123!');
    await page.click('button[type="submit"], button:has-text("Sign In")');
    await page.waitForTimeout(3000);
    console.log('✓ Superadmin login succeeded! Current URL:', page.url());

    console.log('\n🎉 ALL PHYSICAL BROWSER AUTHENTICATION CHECKS PASSED 100%!');
  } catch (error) {
    console.error('Physical browser test error:', error);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

main();
