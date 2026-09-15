import { Page } from '@playwright/test';

export const mockE2EUser = {
  _id: '65f123456789abcdef012345',
  username: 'platform_super_admin',
  email: 'admin@stockora.com',
  role: 'Platform Admin',
  roleName: 'Platform Admin',
  isPlatformAdmin: true,
  isActive: true,
  isVerified: true,
  tenants: [
    {
      tenantId: '65f123456789abcdef012346',
      role: 'Owner',
      roleName: 'Owner',
      name: 'Default Organization',
      slug: 'default-org',
    },
  ],
  activeTenantId: '65f123456789abcdef012346',
};

export async function authenticateE2E(page: Page) {
  await page.addInitScript((user) => {
    localStorage.setItem('stockora_mini_token', 'mock_jwt_e2e_token_valid');
    localStorage.setItem('stockora_mini_user', JSON.stringify(user));
    localStorage.setItem('stockora_mini_active_tenant_id', '65f123456789abcdef012346');
    localStorage.setItem('stockora_mini_active_tenant_slug', 'default-org');
  }, mockE2EUser);
}
