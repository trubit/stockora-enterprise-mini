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
import { RegisterSession } from '../models/RegisterSession.js';
import { Transaction } from '../models/Transaction.js';
import { apiRouter } from '../routes/api.js';
import { authRouter } from '../routes/auth.routes.js';
import { posRouter } from '../routes/pos.routes.js';

import { AuthService } from '../services/auth.service.js';

let app: Express;

describe('Final Production Clean-State + Real Company Onboarding Test Suite', () => {
  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      const mongoUri = 'mongodb://127.0.0.1:27017/stockora_test_clean_state';
      await mongoose.connect(mongoUri);
    }

    app = express();
    app.use(express.json());
    app.use('/api/auth', authRouter);
    app.use('/api/pos', posRouter);
    app.use('/api', apiRouter);

    const testEmails = ['founder@apexlogistics.io', 'owner@summitretail.com'];
    const testTenants = await Tenant.find({
      slug: { $in: ['apex-logistics-global', 'summit-retail-inc'] },
    });
    const tenantIds = testTenants.map((t) => t._id);
    await Promise.all([
      User.deleteMany({ email: { $in: testEmails } }),
      Tenant.deleteMany({ slug: { $in: ['apex-logistics-global', 'summit-retail-inc'] } }),
      Branch.deleteMany({ tenantId: { $in: tenantIds } }),
      Warehouse.deleteMany({ tenantId: { $in: tenantIds } }),
      Product.deleteMany({ tenantId: { $in: tenantIds } }),
      RegisterSession.deleteMany({ tenantId: { $in: tenantIds } }),
      Transaction.deleteMany({ tenantId: { $in: tenantIds } }),
    ]);

    const roles = [
      { name: 'Super Administrator', permissions: ['*'] },
      {
        name: 'Company Owner',
        permissions: [
          'companies:read',
          'companies:write',
          'users:read',
          'users:write',
          'products:read',
          'products:write',
          'transactions:read',
          'transactions:write',
          'pos:access',
        ],
      },
      { name: 'Cashier', permissions: ['transactions:read', 'transactions:write', 'pos:access'] },
    ];
    for (const r of roles) {
      await Role.findOneAndUpdate({ name: r.name }, r, { upsert: true });
    }
  });

  afterAll(async () => {
    const testEmails = ['founder@apexlogistics.io', 'owner@summitretail.com'];
    const testTenants = await Tenant.find({
      slug: { $in: ['apex-logistics-global', 'summit-retail-inc'] },
    });
    const tenantIds = testTenants.map((t) => t._id);
    await Promise.all([
      User.deleteMany({ email: { $in: testEmails } }),
      Tenant.deleteMany({ slug: { $in: ['apex-logistics-global', 'summit-retail-inc'] } }),
      Branch.deleteMany({ tenantId: { $in: tenantIds } }),
      Warehouse.deleteMany({ tenantId: { $in: tenantIds } }),
      Product.deleteMany({ tenantId: { $in: tenantIds } }),
      RegisterSession.deleteMany({ tenantId: { $in: tenantIds } }),
      Transaction.deleteMany({ tenantId: { $in: tenantIds } }),
    ]);
  });

  let ownerToken1: string;
  let tenant1Id: string;
  let ownerUser1: any;

  it('1. Real Company Sign Up: Creates real tenant with onboardingCompleted=false and exact company name', async () => {
    const signupRes = await request(app).post('/api/auth/register').send({
      username: 'apex_founder',
      email: 'founder@apexlogistics.io',
      password: 'Password123!',
      roleName: 'Company Owner',
      companyName: 'Apex Logistics Global',
    });

    expect(signupRes.status).toBe(201);
    expect(signupRes.body.success).toBe(true);
    expect(signupRes.body.requiresVerification).toBe(true);

    const user = await User.findOne({ email: 'founder@apexlogistics.io' });
    expect(user).not.toBeNull();
    expect(user?.tenantId).toBeDefined();

    ownerUser1 = user;
    tenant1Id = user!.tenantId!.toString();

    // Verify tenant created in DB
    const tenantInDb = await Tenant.findById(tenant1Id);
    expect(tenantInDb).not.toBeNull();
    expect(tenantInDb?.name).toBe('Apex Logistics Global');
    expect(tenantInDb?.slug).toBe('apex-logistics-global');
    expect(tenantInDb?.onboardingCompleted).toBe(false);
    expect(tenantInDb?.ownerUserId?.toString()).toBe(user!._id.toString());

    // Verify user is verified and authenticated
    user!.isVerified = true;
    await user!.save();
    ownerToken1 = AuthService.generateAccessToken(user!);
  });

  it('2. Zero Clean State: Brand-new company has strictly 0 shift revenue, 0 transactions, 0 products', async () => {
    // Check shift summary endpoint
    const shiftRes = await request(app)
      .get('/api/pos/register/shift-summary')
      .set('Authorization', `Bearer ${ownerToken1}`)
      .set('x-tenant-id', tenant1Id);

    expect(shiftRes.status).toBe(200);
    expect(shiftRes.body.hasActiveShift).toBe(false);
    expect(shiftRes.body.shiftRevenue).toBe(0);
    expect(shiftRes.body.shiftSalesCount).toBe(0);

    // Check transactions list
    const txRes = await request(app)
      .get('/api/transactions')
      .set('Authorization', `Bearer ${ownerToken1}`)
      .set('x-tenant-id', tenant1Id);

    expect(txRes.status).toBe(200);
    expect(Array.isArray(txRes.body)).toBe(true);
    expect(txRes.body.length).toBe(0);

    // Check products list
    const prodRes = await request(app)
      .get('/api/products')
      .set('Authorization', `Bearer ${ownerToken1}`)
      .set('x-tenant-id', tenant1Id);

    expect(prodRes.status).toBe(200);
    expect(Array.isArray(prodRes.body)).toBe(true);
    expect(prodRes.body.length).toBe(0);
  });

  it('3. Completing Onboarding: Updates existing tenant to onboardingCompleted=true without duplicate record', async () => {
    const onboardRes = await request(app)
      .post('/api/tenants/onboard')
      .set('Authorization', `Bearer ${ownerToken1}`)
      .set('x-tenant-id', tenant1Id)
      .send({
        name: 'Apex Logistics Global Ltd',
        legalName: 'Apex Logistics Global Corporation',
        email: 'founder@apexlogistics.io',
        businessType: 'Logistics & Supply',
        branchName: 'Headquarters',
        branchCode: 'APX-HQ',
      });

    expect(onboardRes.status).toBe(201);
    expect(onboardRes.body.tenant.onboardingCompleted).toBe(true);

    // Verify tenant count didn't duplicate
    const totalTenants = await Tenant.countDocuments({ ownerUserId: ownerUser1.id });
    expect(totalTenants).toBe(1);

    const updatedTenant = await Tenant.findById(tenant1Id);
    expect(updatedTenant?.onboardingCompleted).toBe(true);
    expect(updatedTenant?.legalName).toBe('Apex Logistics Global Corporation');
  });

  it('4. Shift Revenue Dynamic Calculation: Reflects only current active session within tenant', async () => {
    // Open a register session for tenant 1
    const testBranchId = new mongoose.Types.ObjectId().toString();
    const openRes = await request(app)
      .post('/api/pos/register/open')
      .set('Authorization', `Bearer ${ownerToken1}`)
      .set('x-tenant-id', tenant1Id)
      .send({
        openingFloat: 100,
        registerId: 'REG-001',
        registerName: 'Main Checkout',
        branchId: testBranchId,
        cashierId: ownerUser1._id.toString(),
        cashierName: ownerUser1.username,
      });

    expect(openRes.status).toBe(201);
    const session = openRes.body.data;
    expect(session).toBeDefined();

    // Create a transaction attached to this session
    await Transaction.create({
      tenantId: tenant1Id,
      branchId: new mongoose.Types.ObjectId(testBranchId),
      branchName: 'Main Branch',
      cashierId: ownerUser1._id.toString(),
      cashierName: ownerUser1.username,
      transactionNumber: `TX-TEST-CS-${Date.now()}`,
      type: 'SALE',
      status: 'COMPLETED',
      paymentMethod: 'CASH',
      items: [],
      subtotal: 250,
      tax: 0,
      discount: 0,
      total: 250,
      registerSessionId: session._id,
      timestamp: new Date(),
    });

    // Check shift summary again
    const shiftRes = await request(app)
      .get('/api/pos/register/shift-summary')
      .set('Authorization', `Bearer ${ownerToken1}`)
      .set('x-tenant-id', tenant1Id);

    expect(shiftRes.status).toBe(200);
    expect(shiftRes.body.hasActiveShift).toBe(true);
    expect(shiftRes.body.shiftRevenue).toBe(250);
    expect(shiftRes.body.shiftSalesCount).toBe(1);
  });

  it('5. Cross-Tenant Isolation: Tenant 2 cannot see Tenant 1 data or shift revenue', async () => {
    // Register Tenant 2
    const signupRes2 = await request(app).post('/api/auth/register').send({
      username: 'summit_owner',
      email: 'owner@summitretail.com',
      password: 'Password123!',
      roleName: 'Company Owner',
      companyName: 'Summit Retail Inc',
    });

    expect(signupRes2.status).toBe(201);
    const user2 = await User.findOne({ email: 'owner@summitretail.com' });
    expect(user2).not.toBeNull();
    user2!.isVerified = true;
    await user2!.save();

    const token2 = AuthService.generateAccessToken(user2!);
    const tenant2Id = user2!.tenantId!.toString();

    // Check Tenant 2 shift summary - must be 0 despite Tenant 1 having an active session with $250
    const shiftRes2 = await request(app)
      .get('/api/pos/register/shift-summary')
      .set('Authorization', `Bearer ${token2}`)
      .set('x-tenant-id', tenant2Id);

    expect(shiftRes2.status).toBe(200);
    expect(shiftRes2.body.hasActiveShift).toBe(false);
    expect(shiftRes2.body.shiftRevenue).toBe(0);
    expect(shiftRes2.body.shiftSalesCount).toBe(0);

    // Check Tenant 2 transactions - must be empty
    const txRes2 = await request(app)
      .get('/api/transactions')
      .set('Authorization', `Bearer ${token2}`)
      .set('x-tenant-id', tenant2Id);

    expect(txRes2.status).toBe(200);
    expect(txRes2.body.length).toBe(0);
  });
});
