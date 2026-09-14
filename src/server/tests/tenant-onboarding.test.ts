import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import mongoose from 'mongoose';
import express, { type Express } from 'express';
import request from 'supertest';
import { Tenant } from '../models/Tenant.js';
import { User } from '../models/User.js';
import { Role } from '../models/Role.js';
import { Branch } from '../models/Branch.js';
import { Warehouse } from '../models/Warehouse.js';
import { TenantInvitation } from '../models/TenantInvitation.js';
import { Subscription } from '../models/Subscription.js';
import { TenantService } from '../services/tenant.service.js';
import { apiRouter } from '../routes/api.js';

let app: Express;
let ownerUser: any;
let ownerToken: string;
let tenant: any;

describe('Phase 43: Tenant Onboarding & Employee Invitations Tests', () => {
  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/stockora_test';
      await mongoose.connect(mongoUri);
    }

    app = express();
    app.use(express.json());
    app.use('/api', apiRouter);

    await Promise.all([
      Tenant.deleteMany({}),
      User.deleteMany({}),
      Role.deleteMany({}),
      Branch.deleteMany({}),
      Warehouse.deleteMany({}),
      TenantInvitation.deleteMany({}),
      Subscription.deleteMany({}),
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

    const roles = [
      { name: 'Super Administrator', permissions: ['*'] },
      {
        name: 'Company Owner',
        permissions: ['companies:read', 'companies:write', 'users:read', 'users:write'],
      },
      { name: 'Cashier', permissions: ['transactions:read', 'transactions:write'] },
      { name: 'Employee', permissions: ['products:read'] },
    ];
    for (const r of roles) {
      await Role.findOneAndUpdate({ name: r.name }, r, { upsert: true });
    }

    ownerUser = await User.create({
      username: 'test_owner_user',
      email: 'owner@testisolatedonboarding.com',
      password: 'Password123!',
      roleName: 'Company Owner',
      isActive: true,
    });

    const onboard = await TenantService.onboardTenant({
      name: 'Test Isolated Onboarding Corp',
      legalName: 'Test Isolated Onboarding Corporation International',
      email: 'owner@testisolatedonboarding.com',
      businessType: 'Retail',
      branchName: 'HQ Abuja',
      branchCode: 'ABJ-01',
      userId: ownerUser._id.toString(),
    });

    tenant = onboard.tenant;
    ownerToken = onboard.token;

    // Ensure tenant and subscription user limits permit team member invitation
    await Tenant.findByIdAndUpdate(tenant._id, {
      $set: { 'limits.maxUsers': 10 },
    });
    await Subscription.findOneAndUpdate(
      { tenantId: tenant._id },
      { $set: { 'planSnapshot.limits.users': { count: 10, unlimited: false } } }
    );
  });

  afterAll(async () => {
    // Teardown
  });

  it('1. Slug Generation: Generates collision-free, URL-friendly slugs', async () => {
    const slug1 = await TenantService.generateUniqueSlug('Test Isolated Apex Enterprise');
    expect(slug1).toBe('test-isolated-apex-enterprise');

    await Tenant.create({
      name: 'Test Isolated Apex Enterprise',
      slug: slug1,
      contact: { email: 'test@apexisolated.com' },
      status: 'ACTIVE',
    });

    const slug2 = await TenantService.generateUniqueSlug('Test Isolated Apex Enterprise');
    expect(slug2).toBe('test-isolated-apex-enterprise-1');
  });

  it('2. Team Invitation Flow: Creates secure random invitation token with expiration', async () => {
    const inviteRes = await request(app)
      .post('/api/tenants/invitations')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        email: 'newcashier@testisolatedonboarding.com',
        roleName: 'Cashier',
      });

    expect(inviteRes.status).toBe(201);
    expect(inviteRes.body.token).toBeDefined();
    expect(inviteRes.body.token.length).toBeGreaterThanOrEqual(32);
    expect(inviteRes.body.invitation.status).toBe('PENDING');
    expect(new Date(inviteRes.body.invitation.expiresAt).getTime()).toBeGreaterThan(Date.now());
  });

  it('3. Accept Invitation: Adds membership to invited user and marks invitation accepted', async () => {
    const invitation = await TenantService.createInvitation(
      tenant._id.toString(),
      ownerUser._id.toString(),
      'staff@testisolatedonboarding.com',
      'Cashier'
    );

    const invitedUser = await User.create({
      username: 'staff_john',
      email: 'staff@testisolatedonboarding.com',
      password: 'Password123!',
      roleName: 'Employee',
      isActive: true,
    });

    const result = await TenantService.acceptInvitation(
      invitation.token,
      invitedUser._id.toString()
    );
    expect(result.tenant.name).toBe('Test Isolated Onboarding Corp');
    expect(result.token).toBeDefined();

    const updatedUser = await User.findById(invitedUser._id);
    expect(updatedUser?.tenantId?.toString()).toBe(tenant._id.toString());
    expect(
      updatedUser?.tenants.some((t: any) => t.tenantId.toString() === tenant._id.toString())
    ).toBe(true);

    const updatedInv = await TenantInvitation.findById(invitation.invitation._id);
    expect(updatedInv?.status).toBe('ACCEPTED');
  });

  it('4. Expired Invitation Security: Rejects expired invitation tokens', async () => {
    const rawExpiredToken = 'expired-random-token-12345';
    const expiredInv = await TenantInvitation.create({
      tenantId: tenant._id,
      email: 'expired@testisolatedonboarding.com',
      roleName: 'Cashier',
      tokenHash: TenantService.hashInvitationToken(rawExpiredToken),
      status: 'PENDING',
      expiresAt: new Date(Date.now() - 10000),
      invitedBy: ownerUser._id,
    });

    const user = await User.create({
      username: 'expired_user',
      email: 'expired@testisolatedonboarding.com',
      password: 'Password123!',
      roleName: 'Employee',
      isActive: true,
    });

    await expect(
      TenantService.acceptInvitation(rawExpiredToken, user._id.toString())
    ).rejects.toThrow(/expired/i);
  });

  it('5. Link Validation Endpoint: Returns safe public metadata for valid token', async () => {
    const { token: rawToken } = await TenantService.createInvitation(
      tenant._id.toString(),
      ownerUser._id.toString(),
      'validate_test@testisolatedonboarding.com',
      'Cashier'
    );

    const valRes = await request(app).get(`/api/tenants/invitations/validate/${rawToken}`);
    expect(valRes.status).toBe(200);
    expect(valRes.body.status).toBe('VALID');
    expect(valRes.body.invitation.email).toBe('validate_test@testisolatedonboarding.com');
    expect(valRes.body.invitation.roleName).toBe('Cashier');
    expect(valRes.body.invitation.companyName).toBe('Test Isolated Onboarding Corp');
  });

  it('6. Direct Registration from Link: Creates new employee user and accepts invitation', async () => {
    const { token: rawToken } = await TenantService.createInvitation(
      tenant._id.toString(),
      ownerUser._id.toString(),
      'direct_signup@testisolatedonboarding.com',
      'Cashier'
    );

    const regRes = await request(app).post('/api/tenants/invitations/accept-and-register').send({
      token: rawToken,
      username: 'direct_cashier',
      password: 'SecurePassword123!',
      fullName: 'Direct Cashier',
    });

    expect(regRes.status).toBe(201);
    expect(regRes.body.user.email).toBe('direct_signup@testisolatedonboarding.com');
    expect(regRes.body.user.roleName).toBe('Cashier');
    expect(regRes.body.token).toBeDefined();

    // Reusing the same link must fail
    const reuseRes = await request(app).post('/api/tenants/invitations/accept-and-register').send({
      token: rawToken,
      username: 'duplicate_attempt',
      password: 'SecurePassword123!',
    });
    expect(reuseRes.status).toBeGreaterThanOrEqual(400);
  });

  it('7. Wrong Email Protection: Rejects logged-in user with mismatching email', async () => {
    const { token: rawToken } = await TenantService.createInvitation(
      tenant._id.toString(),
      ownerUser._id.toString(),
      'intended_recipient@testisolatedonboarding.com',
      'Cashier'
    );

    const wrongUser = await User.create({
      username: 'wrong_user_bob',
      email: 'attacker_or_wrong@testisolatedonboarding.com',
      password: 'Password123!',
      roleName: 'Employee',
      isActive: true,
    });

    await expect(
      TenantService.acceptInvitation(rawToken, wrongUser._id.toString())
    ).rejects.toThrow(/issued to intended_recipient@testisolatedonboarding.com/i);
  });

  it('8. Revoke Invitation: Immediately invalidates link', async () => {
    const { invitation, token: rawToken } = await TenantService.createInvitation(
      tenant._id.toString(),
      ownerUser._id.toString(),
      'revoked_test@testisolatedonboarding.com',
      'Cashier'
    );

    await TenantService.revokeInvitation(invitation._id.toString(), tenant._id.toString());

    const valRes = await TenantService.validateInvitationToken(rawToken);
    expect(valRes.status).toBe('REVOKED');
  });
});
