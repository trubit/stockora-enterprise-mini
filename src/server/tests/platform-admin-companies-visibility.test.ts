import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import mongoose from 'mongoose';
import express, { type Express } from 'express';
import request from 'supertest';
import { Tenant } from '../models/Tenant.js';
import { User } from '../models/User.js';
import { Role } from '../models/Role.js';
import { Branch } from '../models/Branch.js';
import { Warehouse } from '../models/Warehouse.js';
import { TenantService } from '../services/tenant.service.js';
import { AuthService } from '../services/auth.service.js';
import { apiRouter } from '../routes/api.js';
import { errorHandler } from '../errors/handlers.js';
import { SYSTEM_PERMISSIONS } from '../../shared/permissions.js';

let app: Express;
let platformAdminUser: any;
let platformAdminToken: string;

let ownerAUser: any;
let ownerAToken: string;
let companyATenant: any;

let ownerBUser: any;
let ownerBToken: string;
let companyBTenant: any;

let employeeAUser: any;
let employeeAToken: string;

describe('Platform Admin All-Companies Visibility & Access Matrix Tests', () => {
  beforeAll(async () => {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    const mongoUri = 'mongodb://127.0.0.1:27017/stockora_test_platform_admin_visibility';
    await mongoose.connect(mongoUri);

    app = express();
    app.use(express.json());
    app.use('/api', apiRouter);
    app.use(errorHandler);

    // Clean test collections
    await Promise.all([
      Tenant.deleteMany({}),
      User.deleteMany({}),
      Role.deleteMany({}),
      Branch.deleteMany({}),
      Warehouse.deleteMany({}),
    ]);

    try {
      await Branch.collection.dropIndex('code_1');
    } catch {
      // ignore
    }

    try {
      await Warehouse.collection.dropIndex('code_1');
    } catch {
      // ignore
    }

    // Seed default roles
    const roles = [
      {
        name: 'Super Administrator',
        permissions: ['*'],
      },
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
          'users:read',
          'users:write',
        ],
      },
      {
        name: 'Employee',
        permissions: ['products:read', 'transactions:read'],
      },
    ];
    for (const r of roles) {
      await Role.findOneAndUpdate({ name: r.name }, r, { upsert: true });
    }

    // 1. Create Platform Admin (Trust Ezika)
    platformAdminUser = await User.create({
      username: 'trustezika',
      email: 'trustezika831@gmail.com',
      password: 'Password123!',
      roleName: 'Super Administrator',
      isPlatformAdmin: true,
      isActive: true,
    });
    platformAdminToken = AuthService.generateAccessToken(platformAdminUser);

    // 2. Create Company Owner A & Company A (Truson-Hub)
    ownerAUser = await User.create({
      username: 'owner_a',
      email: 'truson@example.com',
      password: 'Password123!',
      roleName: 'Company Owner',
      isActive: true,
    });

    const onboardA = await TenantService.onboardTenant({
      name: 'Truson-Hub',
      legalName: 'Truson Hub Enterprises',
      email: 'truson@example.com',
      businessType: 'Retail',
      currency: 'USD',
      branchName: 'Truson HQ',
      branchCode: 'TRUSON-01',
      userId: ownerAUser._id.toString(),
    });
    companyATenant = onboardA.tenant;
    ownerAToken = onboardA.token;

    // 3. Create Company Owner B & Company B (Pharmacy Co)
    ownerBUser = await User.create({
      username: 'wiliamshilton',
      email: 'wiliamshilton064@gmail.com',
      password: 'Password123!',
      roleName: 'Company Owner',
      isActive: true,
    });

    const onboardB = await TenantService.onboardTenant({
      name: 'pharmacy',
      legalName: 'Global Pharmacy Corp',
      email: 'wiliamshilton064@gmail.com',
      businessType: 'Healthcare',
      currency: 'EUR',
      currencySymbol: '€',
      branchName: 'Pharmacy Central',
      branchCode: 'PHARM-01',
      userId: ownerBUser._id.toString(),
    });
    companyBTenant = onboardB.tenant;
    ownerBToken = onboardB.token;

    // 4. Create Employee under Company A
    employeeAUser = await User.create({
      username: 'employee_a',
      email: 'employee@truson.com',
      password: 'Password123!',
      roleName: 'Employee',
      tenantId: companyATenant._id,
      tenants: [
        {
          tenantId: companyATenant._id,
          roleName: 'Employee',
          joinedAt: new Date(),
        },
      ],
      isActive: true,
    });
    employeeAToken = AuthService.generateAccessToken(employeeAUser);
  });

  afterAll(async () => {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  });

  it('1. Platform Admin: GET /api/tenants/user-tenants returns ALL registered companies', async () => {
    const res = await request(app)
      .get('/api/tenants/user-tenants')
      .set('Authorization', `Bearer ${platformAdminToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(2);

    const names = res.body.map((t: any) => t.tenantName);
    expect(names).toContain('Truson-Hub');
    expect(names).toContain('pharmacy');

    // Platform admin should have roleName set appropriately
    for (const item of res.body) {
      expect(item.roleName).toBe('Super Administrator');
    }
  });

  it('2. Platform Admin: GET /api/tenants/admin/all returns ALL companies with stats', async () => {
    const res = await request(app)
      .get('/api/tenants/admin/all')
      .set('Authorization', `Bearer ${platformAdminToken}`);

    expect(res.status).toBe(200);
    const tenantsList = Array.isArray(res.body) ? res.body : res.body.tenants;
    expect(tenantsList.length).toBeGreaterThanOrEqual(2);

    const slugs = tenantsList.map((t: any) => t.slug);
    expect(slugs).toContain('truson-hub');
    expect(slugs).toContain('pharmacy');
  });

  it('3. Company Owner A: GET /api/tenants/user-tenants returns ONLY Company A', async () => {
    const res = await request(app)
      .get('/api/tenants/user-tenants')
      .set('Authorization', `Bearer ${ownerAToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(1);
    expect(res.body[0].tenantName).toBe('Truson-Hub');
  });

  it('4. Company Owner B: GET /api/tenants/user-tenants returns ONLY Company B', async () => {
    const res = await request(app)
      .get('/api/tenants/user-tenants')
      .set('Authorization', `Bearer ${ownerBToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(1);
    expect(res.body[0].tenantName).toBe('pharmacy');
  });

  it('5. Company Owner: GET /api/tenants/admin/all is rejected with 403 Forbidden', async () => {
    const res = await request(app)
      .get('/api/tenants/admin/all')
      .set('Authorization', `Bearer ${ownerAToken}`);

    expect(res.status).toBe(403);
  });

  it('6. Employee: GET /api/tenants/admin/all is rejected with 403 Forbidden', async () => {
    const res = await request(app)
      .get('/api/tenants/admin/all')
      .set('Authorization', `Bearer ${employeeAToken}`);

    expect(res.status).toBe(403);
  });

  it('7. Platform Admin: Can switch context into ANY company via POST /api/tenants/switch', async () => {
    const switchRes = await request(app)
      .post('/api/tenants/switch')
      .set('Authorization', `Bearer ${platformAdminToken}`)
      .send({ tenantId: companyBTenant._id.toString() });

    expect(switchRes.status).toBe(200);
    expect(switchRes.body.token).toBeDefined();
    expect(switchRes.body.activeTenant.slug).toBe('pharmacy');
  });

  it('8. Company Owner: CANNOT switch context into an unowned company', async () => {
    const unauthorizedSwitch = await request(app)
      .post('/api/tenants/switch')
      .set('Authorization', `Bearer ${ownerAToken}`)
      .send({ tenantId: companyBTenant._id.toString() });

    expect(unauthorizedSwitch.status).toBe(403);
  });

  it('9. Pagination & Search: /api/tenants/admin/all filters by search query and respects pagination', async () => {
    const pagedRes = await request(app)
      .get('/api/tenants/admin/all?page=1&limit=1&search=pharmacy')
      .set('Authorization', `Bearer ${platformAdminToken}`);

    expect(pagedRes.status).toBe(200);
    expect(pagedRes.body.tenants).toBeDefined();
    expect(pagedRes.body.tenants.length).toBe(1);
    expect(pagedRes.body.tenants[0].name).toBe('pharmacy');
    expect(pagedRes.body.pagination.total).toBe(1);
    expect(pagedRes.body.pagination.page).toBe(1);
    expect(pagedRes.body.pagination.limit).toBe(1);
  });

  it('10. Dynamic Onboarding: Newly registered company appears immediately in platform admin list', async () => {
    const newOwner = await User.create({
      username: 'owner_c',
      email: 'owner_c@newcorp.com',
      password: 'Password123!',
      roleName: 'Company Owner',
      isActive: true,
    });

    const onboardC = await TenantService.onboardTenant({
      name: 'Dynamic New Corp',
      legalName: 'Dynamic New Corporation',
      email: 'owner_c@newcorp.com',
      businessType: 'Retail',
      currency: 'USD',
      branchName: 'Branch 1',
      branchCode: 'DYN-01',
      userId: newOwner._id.toString(),
    });

    const adminListRes = await request(app)
      .get('/api/tenants/user-tenants')
      .set('Authorization', `Bearer ${platformAdminToken}`);

    expect(adminListRes.status).toBe(200);
    const names = adminListRes.body.map((t: any) => t.tenantName);
    expect(names).toContain('Dynamic New Corp');
  });
});
