import { Page } from '@playwright/test';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });
const secret = process.env.JWT_SECRET || 'CHANGE_ME_replace_with_secure_64_char_random_hex';

export const mockE2EUser = {
  _id: '6aa5ad3ff5b17cfa883ba66e',
  username: 'trustezika831',
  email: 'trustezika831@gmail.com',
  role: 'Super Administrator',
  roleName: 'Super Administrator',
  isPlatformAdmin: true,
  isActive: true,
  isVerified: true,
  tenants: [
    {
      tenantId: '65f123456789abcdef012346',
      role: 'Super Administrator',
      roleName: 'Super Administrator',
      name: 'Default Organization',
      slug: 'default-org',
    },
  ],
  activeTenantId: '65f123456789abcdef012346',
};

export async function authenticateE2E(page: Page) {
  const token = jwt.sign(
    {
      id: mockE2EUser._id,
      userId: mockE2EUser._id,
      username: mockE2EUser.username,
      email: mockE2EUser.email,
      roleName: 'Super Administrator',
      isPlatformAdmin: true,
      tenantId: '65f123456789abcdef012346',
      tenantSlug: 'default-org',
      tenants: [
        {
          tenantId: '65f123456789abcdef012346',
          tenantSlug: 'default-org',
          tenantName: 'Default Organization',
          roleName: 'Super Administrator',
        },
      ],
    },
    secret,
    {
      expiresIn: '24h',
      issuer: 'stockora-enterprise-mini',
      audience: 'stockora-enterprise-mini',
    }
  );

  await page.addInitScript(
    ({ user, token }) => {
      localStorage.setItem('stockora_mini_token', token);
      localStorage.setItem('stockora_mini_refresh_token', 'mock_refresh_token_valid');
      localStorage.setItem('stockora_mini_user', JSON.stringify(user));
      localStorage.setItem('stockora_mini_active_tenant_id', '65f123456789abcdef012346');
      localStorage.setItem('stockora_mini_active_tenant_slug', 'default-org');
    },
    { user: mockE2EUser, token }
  );
}
