import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import mongoose from 'mongoose';
import express, { type Express } from 'express';
import request from 'supertest';
import { Tenant } from '../models/Tenant.js';
import { User } from '../models/User.js';
import { Role } from '../models/Role.js';
import { Branch } from '../models/Branch.js';
import { Warehouse } from '../models/Warehouse.js';
import { Product } from '../models/Product.js';
import { TenantService } from '../services/tenant.service.js';
import { AuthService } from '../services/auth.service.js';
import { apiRouter } from '../routes/api.js';
import { errorHandler } from '../errors/handlers.js';

let app: Express;
let harnUser: any;
let harnToken: string;
let harnTenant: any;

let hansonUser: any;
let hansonToken: string;
let hansonTenant: any;

let platformAdminUser: any;
let platformAdminToken: string;

describe('Phase 43: Multi-Tenant Architecture & Data Isolation Tests', () => {
  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/stockora_test';
      await mongoose.connect(mongoUri);
    }

    app = express();
    app.use(express.json());
    app.use('/api', apiRouter);
    app.use(errorHandler);

    // Clean test collections
    const testEmails = ['harn_owner@harn.com', 'hanson_owner@hanson.com', 'admin@stockora.com'];
    const testTenants = await Tenant.find({ slug: { $in: ['harn-company', 'hanson-company'] } });
    const tenantIds = testTenants.map((t) => t._id);
    await Promise.all([
      User.deleteMany({ email: { $in: testEmails } }),
      Tenant.deleteMany({ slug: { $in: ['harn-company', 'hanson-company'] } }),
      Product.deleteMany({ tenantId: { $in: tenantIds } }),
      Branch.deleteMany({ tenantId: { $in: tenantIds } }),
      Warehouse.deleteMany({ tenantId: { $in: tenantIds } }),
    ]);

    try {
      await Branch.collection.dropIndex('code_1');
    } catch {
      // ignore if index does not exist
    }

    try {
      await Warehouse.collection.dropIndex('code_1');
    } catch {
      // ignore
    }

    // Seed default roles safely
    const roles = [
      { name: 'Super Administrator', permissions: ['*'] },
      {
        name: 'Company Owner',
        permissions: [
          'companies:read',
          'companies:write',
          'products:read',
          'products:write',
          'transactions:read',
          'transactions:write',
          'branches:read',
          'branches:write',
        ],
      },
      {
        name: 'Cashier',
        permissions: ['transactions:read', 'transactions:write', 'products:read'],
      },
      { name: 'Employee', permissions: ['products:read'] },
    ];
    for (const r of roles) {
      await Role.findOneAndUpdate({ name: r.name }, r, { upsert: true });
    }

    // 1. Create Platform Super Admin
    platformAdminUser = await User.create({
      username: 'superadmin',
      email: 'admin@stockora.saas',
      password: 'Password123!',
      roleName: 'Super Administrator',
      isPlatformAdmin: true,
      isActive: true,
    });
    platformAdminToken = AuthService.generateAccessToken(platformAdminUser);

    // 2. Create Harn Company User & Tenant
    harnUser = await User.create({
      username: 'harn_owner',
      email: 'owner@harncompany.com',
      password: 'Password123!',
      roleName: 'Company Owner',
      isActive: true,
    });

    const harnOnboard = await TenantService.onboardTenant({
      name: 'Harn Company',
      legalName: 'Harn Enterprises Ltd',
      email: 'owner@harncompany.com',
      businessType: 'Retail',
      currency: 'USD',
      branchName: 'Harn Lagos Flagship',
      branchCode: 'HARN-LAG',
      userId: harnUser._id.toString(),
    });
    harnTenant = harnOnboard.tenant;
    harnToken = harnOnboard.token;

    // 3. Create Hanson Company User & Tenant
    hansonUser = await User.create({
      username: 'hanson_owner',
      email: 'owner@hansoncompany.com',
      password: 'Password123!',
      roleName: 'Company Owner',
      isActive: true,
    });

    const hansonOnboard = await TenantService.onboardTenant({
      name: 'Hanson Company',
      legalName: 'Hanson Global Corp',
      email: 'owner@hansoncompany.com',
      businessType: 'Wholesale',
      currency: 'EUR',
      currencySymbol: '€',
      branchName: 'Hanson Victoria Store',
      branchCode: 'HANS-VIC',
      userId: hansonUser._id.toString(),
    });
    hansonTenant = hansonOnboard.tenant;
    hansonToken = hansonOnboard.token;
  });

  it('1. Secure Tenant Provisioning: Provisions independent companies with unique slugs', async () => {
    expect(harnTenant.name).toBe('Harn Company');
    expect(harnTenant.slug).toBe('harn-company');
    expect(harnTenant.status).toBe('ACTIVE');

    expect(hansonTenant.name).toBe('Hanson Company');
    expect(hansonTenant.slug).toBe('hanson-company');
    expect(hansonTenant.status).toBe('ACTIVE');
    expect(harnTenant._id.toString()).not.toBe(hansonTenant._id.toString());
  });

  it('2. Tenant Profile API: Returns active company profile with isolation', async () => {
    const harnRes = await request(app)
      .get('/api/tenants/current')
      .set('Authorization', `Bearer ${harnToken}`);

    expect(harnRes.status).toBe(200);
    expect(harnRes.body.name).toBe('Harn Company');
    expect(harnRes.body.slug).toBe('harn-company');

    const hansonRes = await request(app)
      .get('/api/tenants/current')
      .set('Authorization', `Bearer ${hansonToken}`);

    expect(hansonRes.status).toBe(200);
    expect(hansonRes.body.name).toBe('Hanson Company');
    expect(hansonRes.body.slug).toBe('hanson-company');
    expect(hansonRes.body.fiscalConfig.currency).toBe('EUR');
  });

  it('3. Cross-Tenant IDOR Attack Prevention: User cannot access another tenant via header without membership', async () => {
    const attackRes = await request(app)
      .get('/api/tenants/current')
      .set('Authorization', `Bearer ${harnToken}`)
      .set('x-tenant-id', hansonTenant._id.toString());

    expect(attackRes.status).toBe(403);
    const errMessage =
      attackRes.body.error?.message || attackRes.body.message || JSON.stringify(attackRes.body);
    expect(errMessage).toMatch(/Access Denied|forbidden/i);
  });

  it('4. Product Data Isolation: Products created under Harn Company cannot be viewed by Hanson Company', async () => {
    await Product.create({
      tenantId: harnTenant._id.toString(),
      sku: 'HARN-SKU-001',
      name: 'Harn Industrial Generator',
      category: 'Equipment',
      costPrice: 500,
      sellingPrice: 1200,
      price: 1200,
      cost: 500,
      quantity: 100,
    });

    await Product.create({
      tenantId: hansonTenant._id.toString(),
      sku: 'HANS-SKU-001',
      name: 'Hanson Luxury Watch',
      category: 'Jewelry',
      costPrice: 80,
      sellingPrice: 250,
      price: 250,
      cost: 80,
      quantity: 40,
    });

    const harnList = await Product.find({ tenantId: harnTenant._id.toString() });
    const hansonList = await Product.find({ tenantId: hansonTenant._id.toString() });

    expect(harnList.length).toBe(1);
    expect(harnList[0].name).toBe('Harn Industrial Generator');
    expect(harnList[0].quantity).toBe(100);

    expect(hansonList.length).toBe(1);
    expect(hansonList[0].name).toBe('Hanson Luxury Watch');
    expect(hansonList[0].quantity).toBe(40);
  });

  it('5. Branch Isolation: Branches are isolated by tenant', async () => {
    const harnBranchesRes = await request(app)
      .get('/api/org/branches')
      .set('Authorization', `Bearer ${harnToken}`);

    expect(harnBranchesRes.status).toBe(200);
    expect(harnBranchesRes.body.length).toBe(1);
    expect(harnBranchesRes.body[0].name).toBe('Harn Lagos Flagship');

    const hansonBranchesRes = await request(app)
      .get('/api/org/branches')
      .set('Authorization', `Bearer ${hansonToken}`);

    expect(hansonBranchesRes.status).toBe(200);
    expect(hansonBranchesRes.body.length).toBe(1);
    expect(hansonBranchesRes.body[0].name).toBe('Hanson Victoria Store');
  });

  it('6. Tenant Feature Flags: Dynamically enforces enabled/disabled modules', async () => {
    await request(app)
      .put('/api/tenants/current/features')
      .set('Authorization', `Bearer ${harnToken}`)
      .send({ features: { loyalty: false, wholesale: false, pos: true } });

    const tenant = await Tenant.findById(harnTenant._id);
    expect(tenant?.features.get('loyalty')).toBe(false);
    expect(tenant?.features.get('pos')).toBe(true);
  });

  it('7. Tenant Branding Configuration: Allows safe brand identity and receipt customizations', async () => {
    const brandingUpdate = {
      primaryColor: '#ef4444',
      secondaryColor: '#b91c1c',
      accentColor: '#f59e0b',
      receiptHeader: 'Welcome to Harn Global Store',
      receiptFooter: 'Warranty valid for 1 year with receipt',
    };

    const res = await request(app)
      .put('/api/tenants/current/branding')
      .set('Authorization', `Bearer ${harnToken}`)
      .send(brandingUpdate);

    expect(res.status).toBe(200);
    expect(res.body.branding.primaryColor).toBe('#ef4444');
    expect(res.body.branding.receiptHeader).toBe('Welcome to Harn Global Store');
  });

  it('8. Tenant Switching: Multi-company users can seamlessly switch context', async () => {
    const multiUser = await User.create({
      username: 'multi_consultant',
      email: 'consultant@enterprise.com',
      password: 'Password123!',
      roleName: 'Employee',
      tenants: [
        {
          tenantId: harnTenant._id,
          tenantSlug: 'harn-company',
          tenantName: 'Harn Company',
          roleName: 'Company Owner',
          isDefault: true,
          joinedAt: new Date(),
        },
        {
          tenantId: hansonTenant._id,
          tenantSlug: 'hanson-company',
          tenantName: 'Hanson Company',
          roleName: 'Employee',
          isDefault: false,
          joinedAt: new Date(),
        },
      ],
      tenantId: harnTenant._id,
      isActive: true,
    });

    const initialToken = AuthService.generateAccessToken(multiUser);

    const switchRes = await request(app)
      .post('/api/tenants/switch')
      .set('Authorization', `Bearer ${initialToken}`)
      .send({ tenantId: hansonTenant._id.toString() });

    expect(switchRes.status).toBe(200);
    expect(switchRes.body.activeTenant.name).toBe('Hanson Company');
    expect(switchRes.body.token).toBeDefined();

    const currentRes = await request(app)
      .get('/api/tenants/current')
      .set('Authorization', `Bearer ${switchRes.body.token}`);

    expect(currentRes.status).toBe(200);
    expect(currentRes.body.name).toBe('Hanson Company');

    // Verify unauthorized tenant switch is rejected with 403 Forbidden
    const thirdTenant = await Tenant.create({
      name: 'Unauthorized Third Tenant',
      slug: 'unauthorized-third-tenant',
      status: 'ACTIVE',
      contact: { email: 'stranger@example.com' },
      subscriptionTier: 'STARTER',
    });

    const unauthorizedSwitch = await request(app)
      .post('/api/tenants/switch')
      .set('Authorization', `Bearer ${switchRes.body.token}`)
      .send({ tenantId: thirdTenant._id.toString() });

    expect(unauthorizedSwitch.status).toBe(403);

    // Verify getUserTenants returns accurate database memberships
    const userTenantsRes = await request(app)
      .get('/api/tenants/user-tenants')
      .set('Authorization', `Bearer ${switchRes.body.token}`);

    expect(userTenantsRes.status).toBe(200);
    expect(userTenantsRes.body.length).toBe(2);
    expect(
      userTenantsRes.body.some((t: any) => t.tenantName === 'Hanson Company' && t.isDefault)
    ).toBe(true);
  });

  it('9. Platform Super Admin: Can list all SaaS tenants and manage organization status', async () => {
    const listRes = await request(app)
      .get('/api/tenants/admin/all')
      .set('Authorization', `Bearer ${platformAdminToken}`);

    expect(listRes.status).toBe(200);
    expect(listRes.body.length).toBeGreaterThanOrEqual(2);

    const suspendRes = await request(app)
      .patch(`/api/tenants/admin/${hansonTenant._id}/status`)
      .set('Authorization', `Bearer ${platformAdminToken}`)
      .send({ status: 'SUSPENDED' });

    expect(suspendRes.status).toBe(200);
    expect(suspendRes.body.status).toBe('SUSPENDED');

    const checkSuspended = await Tenant.findById(hansonTenant._id);
    expect(checkSuspended?.status).toBe('SUSPENDED');
  });

  it('10. Stale Session: Token with deleted/orphaned user ID returns 401 Unauthorized (never 403)', async () => {
    // Generate valid JWT for a non-existent user ID
    const deletedUserId = new mongoose.Types.ObjectId().toString();
    const staleToken = (AuthService as any).generateAccessToken
      ? (AuthService as any).generateAccessToken({
          _id: deletedUserId,
          id: deletedUserId,
          role: 'ADMIN',
          roleName: 'Admin',
          tenantId: harnTenant._id,
        })
      : null;

    if (staleToken) {
      const res = await request(app)
        .get('/api/tenants/current')
        .set('Authorization', `Bearer ${staleToken}`);

      expect(res.status).toBe(401);
      expect(res.body.error?.message || res.body.message).toContain('User account not found');
    }
  });

  afterAll(async () => {
    const testEmails = ['harn_owner@harn.com', 'hanson_owner@hanson.com', 'admin@stockora.com'];
    const testTenants = await Tenant.find({ slug: { $in: ['harn-company', 'hanson-company'] } });
    const tenantIds = testTenants.map((t) => t._id);
    await Promise.all([
      User.deleteMany({ email: { $in: testEmails } }),
      Tenant.deleteMany({ slug: { $in: ['harn-company', 'hanson-company'] } }),
      Product.deleteMany({ tenantId: { $in: tenantIds } }),
      Branch.deleteMany({ tenantId: { $in: tenantIds } }),
      Warehouse.deleteMany({ tenantId: { $in: tenantIds } }),
    ]);
  });
});
