import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { config } from '../src/config/environment.js';
import { Role } from '../src/server/models/Role.js';
import { User } from '../src/server/models/User.js';
import { Tenant } from '../src/server/models/Tenant.js';
import { Company } from '../src/server/models/Company.js';
import { Branch } from '../src/server/models/Branch.js';
import { Warehouse } from '../src/server/models/Warehouse.js';
import { MasterData } from '../src/server/models/MasterData.js';
import { Plan } from '../src/server/models/Plan.js';
import { Subscription } from '../src/server/models/Subscription.js';
import { BillingInvoice } from '../src/server/models/BillingInvoice.js';
import { SubscriptionService } from '../src/server/services/subscription.service.js';
import { SYSTEM_ROLES, SYSTEM_PERMISSIONS } from '../src/shared/constants.js';
import { DEFAULT_ROLE_PERMISSIONS } from '../src/shared/permissions.js';


dotenv.config();

async function seed() {
  const mongoUri = config.mongodbUri || process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/stockora';
  console.log(`Connecting to Stockora Enterprise Database: ${mongoUri}...`);
  await mongoose.connect(mongoUri);

  console.log('1. Seeding Enterprise System Roles...');
  const rolesToCreate = [
    {
      name: SYSTEM_ROLES.SUPER_ADMIN,
      description: 'System Super Administrator with full global rights.',
      permissions: Object.values(SYSTEM_PERMISSIONS),
      isSystem: true,
    },
    {
      name: SYSTEM_ROLES.COMPANY_OWNER,
      description: 'Company Tenant Owner with full administrative rights within tenant scope.',
      permissions: DEFAULT_ROLE_PERMISSIONS[SYSTEM_ROLES.COMPANY_OWNER],
      isSystem: true,
    },
    {
      name: SYSTEM_ROLES.BRANCH_MANAGER,
      description: 'Branch Manager managing store site operations.',
      permissions: [
        SYSTEM_PERMISSIONS.PRODUCTS_READ,
        SYSTEM_PERMISSIONS.PRODUCTS_WRITE,
        SYSTEM_PERMISSIONS.TRANSACTIONS_READ,
        SYSTEM_PERMISSIONS.TRANSACTIONS_WRITE,
        SYSTEM_PERMISSIONS.WAREHOUSES_READ,
        SYSTEM_PERMISSIONS.USERS_READ,
        SYSTEM_PERMISSIONS.CUSTOMERS_READ,
        SYSTEM_PERMISSIONS.CUSTOMERS_WRITE,
        SYSTEM_PERMISSIONS.SUPPLIERS_READ,
      ],
      isSystem: true,
    },
    {
      name: SYSTEM_ROLES.WAREHOUSE_MANAGER,
      description: 'Warehouse Manager handling inventory and transfers.',
      permissions: [
        SYSTEM_PERMISSIONS.PRODUCTS_READ,
        SYSTEM_PERMISSIONS.WAREHOUSES_READ,
        SYSTEM_PERMISSIONS.WAREHOUSES_WRITE,
        SYSTEM_PERMISSIONS.SUPPLIERS_READ,
      ],
      isSystem: true,
    },
    {
      name: SYSTEM_ROLES.CASHIER,
      description: 'Cashier handling POS checkouts.',
      permissions: [
        SYSTEM_PERMISSIONS.PRODUCTS_READ,
        SYSTEM_PERMISSIONS.TRANSACTIONS_WRITE,
        SYSTEM_PERMISSIONS.CUSTOMERS_READ,
        SYSTEM_PERMISSIONS.CUSTOMERS_WRITE,
      ],
      isSystem: true,
    },
    {
      name: SYSTEM_ROLES.AUDITOR,
      description: 'Read-Only Auditor.',
      permissions: [
        SYSTEM_PERMISSIONS.USERS_READ,
        SYSTEM_PERMISSIONS.ROLES_READ,
        SYSTEM_PERMISSIONS.COMPANIES_READ,
        SYSTEM_PERMISSIONS.BRANCHES_READ,
        SYSTEM_PERMISSIONS.WAREHOUSES_READ,
        SYSTEM_PERMISSIONS.PRODUCTS_READ,
        SYSTEM_PERMISSIONS.TRANSACTIONS_READ,
        SYSTEM_PERMISSIONS.AUDIT_READ,
        SYSTEM_PERMISSIONS.CUSTOMERS_READ,
        SYSTEM_PERMISSIONS.SUPPLIERS_READ,
      ],
      isSystem: true,
    },
  ];

  for (const r of rolesToCreate) {
    await Role.findOneAndUpdate(
      { name: r.name },
      { $set: { permissions: r.permissions, description: r.description, isSystem: r.isSystem } },
      { upsert: true, new: true }
    );
  }
  console.log('✓ System Roles initialized.');

  console.log('2. Initializing Primary Platform Organization...');
  let primaryTenant = await Tenant.findOne({ slug: 'stockora-hq' });
  if (!primaryTenant) {
    primaryTenant = await Tenant.create({
      name: 'Stockora Enterprise',
      legalName: 'Stockora Technologies Inc.',
      slug: 'stockora-hq',
      status: 'ACTIVE',
      contact: { email: 'admin@stockora.com', phone: '+1-800-555-0100' },
      taxConfig: { taxId: 'TAX-STK-001', defaultTaxRate: 0.05, isTaxInclusive: false },
      fiscalConfig: { currency: 'USD', currencySymbol: '$', fiscalYearStartMonth: 1, timezone: 'UTC' },
      features: new Map([
        ['pos', true],
        ['inventory', true],
        ['finance', true],
        ['crm', true],
        ['copilot', true],
        ['analytics', true],
        ['wholesale', true],
      ]),
      limits: {
        maxUsers: 100,
        maxBranches: 20,
        maxWarehouses: 10,
        maxPOSTerminals: 50,
        maxProducts: 50000,
        maxStorageBytes: 10737418240,
      },
      subscriptionTier: 'ENTERPRISE',
    });
  }

  let company = await Company.findOne({ tenantId: primaryTenant._id });
  if (!company) {
    company = await Company.create({
      tenantId: primaryTenant._id,
      name: 'Stockora Enterprise Inc.',
      slug: 'stockora-enterprise',
      taxId: 'TX-998877',
      address: '100 Innovation Way, Toronto, ON',
      phone: '416-555-0199',
      currency: 'USD',
      timeZone: 'EST',
    });
  }

  let branch = await Branch.findOne({ tenantId: primaryTenant._id });
  if (!branch) {
    branch = await Branch.create({
      tenantId: primaryTenant._id,
      companyId: company._id,
      name: 'Main HQ Store',
      code: 'BR-HQ-01',
      address: '100 Innovation Way, Suite 100',
      phone: '416-555-0199',
      email: 'hq@stockora.com',
      isMain: true,
    });
  }

  let warehouse = await Warehouse.findOne({ tenantId: primaryTenant._id });
  if (!warehouse) {
    await Warehouse.create({
      tenantId: primaryTenant._id,
      companyId: company._id,
      branchId: branch._id,
      name: 'Central Distribution Warehouse',
      code: 'WH-MAIN-01',
      type: 'DISTRIBUTION_CENTER',
      capacity: 100000,
      isDefault: true,
    });
  }

  console.log('3. Initializing Master Data...');
  const masterCategories = ['General', 'Electronics', 'Apparel', 'Food & Beverage', 'Industrial Supplies', 'Services'];
  for (const cat of masterCategories) {
    const code = cat.toUpperCase().replace(/\s+/g, '_');
    await MasterData.findOneAndUpdate(
      { type: 'CATEGORY', code },
      { $set: { type: 'CATEGORY', name: cat, code, value: cat } },
      { upsert: true, new: true }
    );
  }

  console.log('4. Initializing Super Administrator Accounts...');
  const salt = await bcrypt.genSalt(10);
  const adminPassword = process.env.INITIAL_ADMIN_PASSWORD || 'Password123!';
  const hashedPassword = await bcrypt.hash(adminPassword, salt);

  const adminEmails = [
    (config.platformAdminEmail || process.env.PLATFORM_ADMIN_EMAIL || 'trustezika831@gmail.com')
      .toLowerCase()
      .trim(),
  ];

  for (const adminEmail of adminEmails) {
    const uname = adminEmail.split('@')[0];
    const existing = await User.findOne({ email: adminEmail });
    if (!existing) {
      await User.create({
        username: uname,
        email: adminEmail,
        password: hashedPassword,
        roleName: SYSTEM_ROLES.SUPER_ADMIN,
        isPlatformAdmin: true,
        isActive: true,
        isVerified: true,
        tenantId: primaryTenant._id,
        tenants: [
          {
            tenantId: primaryTenant._id,
            tenantSlug: primaryTenant.slug,
            tenantName: primaryTenant.name,
            roleName: SYSTEM_ROLES.SUPER_ADMIN,
            isDefault: true,
            joinedAt: new Date(),
          },
        ],
        failedLoginAttempts: 0,
        lockUntil: null,
      });
    } else {
      await User.updateOne(
        { email: adminEmail },
        {
          $set: {
            roleName: SYSTEM_ROLES.SUPER_ADMIN,
            isPlatformAdmin: true,
            isActive: true,
            isVerified: true,
            tenantId: primaryTenant._id,
            tenants: [
              {
                tenantId: primaryTenant._id,
                tenantSlug: primaryTenant.slug,
                tenantName: primaryTenant.name,
                roleName: SYSTEM_ROLES.SUPER_ADMIN,
                isDefault: true,
                joinedAt: new Date(),
              },
            ],
            failedLoginAttempts: 0,
            lockUntil: null,
          },
        }
      );
    }
  }

  console.log('5. Initializing SaaS Subscription Plans...');
  await Plan.deleteMany({ slug: { $ne: 'enterprise' } });
  const plansToSeed = [
    {
      name: 'Stockora Enterprise Plan',
      slug: 'enterprise',
      tier: 'ENTERPRISE',
      description: 'Complete all-in-one unified enterprise inventory, multi-branch POS, warehouse logistics, CRM, and analytics suite.',
      price: 5000,
      yearlyDiscountPercent: 20,
      currency: 'NGN',
      status: 'ACTIVE',
      sortOrder: 1,
      isPopular: true,
      features: {
        pos: true,
        inventory: true,
        advancedInventory: true,
        crm: true,
        loyalty: true,
        aiAssistant: true,
        advancedAnalytics: true,
        multiBranch: true,
        warehouseManagement: true,
        employeeManagement: true,
        reports: true,
        apiAccess: true,
        integrations: true,
        automation: true,
        customBranding: true,
        prioritySupport: true,
      },
      limits: {
        users: { count: 100, unlimited: true },
        branches: { count: 50, unlimited: true },
        warehouses: { count: 50, unlimited: true },
        posTerminals: { count: 50, unlimited: true },
        products: { count: 100000, unlimited: true },
        customers: { count: 100000, unlimited: true },
        orders: { count: 100000, unlimited: true },
        storageMb: { count: 51200, unlimited: true },
        apiRequestsMonthly: { count: 100000, unlimited: true },
        aiRequestsMonthly: { count: 5000, unlimited: true },
        automations: { count: 100, unlimited: true },
      },
      trialConfiguration: { trialDays: 14, isTrialEnabled: true },
    },
  ];

  const seededPlans: Record<string, any> = {};
  for (const p of plansToSeed) {
    const planDoc = await Plan.findOneAndUpdate(
      { slug: p.slug },
      { $set: p },
      { upsert: true, new: true }
    );
    seededPlans[p.slug] = planDoc;
  }
  console.log('✓ Single authoritative ₦5,000 Enterprise SaaS Plan seeded.');

  console.log('6. Initializing Multi-Tenant Subscriptions (Stockora HQ, Harn, Hanson)...');
  // 6a. Stockora HQ -> Enterprise Plan
  const hqSnapshot = SubscriptionService.createPlanSnapshot(seededPlans['enterprise'], 'YEARLY');
  await Subscription.findOneAndUpdate(
    { tenantId: primaryTenant._id.toString() },
    {
      $set: {
        tenantId: primaryTenant._id.toString(),
        planId: seededPlans['enterprise']._id,
        planSlug: 'enterprise',
        status: 'ACTIVE',
        billingInterval: 'YEARLY',
        currency: 'NGN',
        price: hqSnapshot.price,
        startDate: new Date(),
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        renewalDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        planSnapshot: hqSnapshot,
        provider: 'SYSTEM',
      },
    },
    { upsert: true }
  );

  // Multi-tenant subscriptions for individual tenant companies are created dynamically during tenant onboarding.
  console.log('✓ System Plans & Primary Organization ready.');


  console.log('\n=========================================================');
  console.log('Stockora Enterprise Platform Database Successfully Initialized!');
  console.log(`Default System Admin: ${adminEmails[0]}`);
  console.log('=========================================================\n');

  await mongoose.disconnect();
  process.exit(0);
}

seed().catch((err) => {
  console.error('Database seeding failed:', err);
  process.exit(1);
});
