import mongoose from 'mongoose';
import { Role } from '../models/Role.js';
import { SYSTEM_ROLES, SYSTEM_PERMISSIONS } from '../../shared/constants.js';
import { DEFAULT_ROLE_PERMISSIONS } from '../../shared/permissions.js';
import { logger } from '../logger.js';
import { config } from '../../config/environment.js';

export async function seedRolesIfEmpty(): Promise<void> {
  if (mongoose.connection.readyState !== 1) return;
  try {
    // Always ensure the authoritative permissions for default system roles in the DB
    await Role.updateOne(
      { name: SYSTEM_ROLES.COMPANY_OWNER },
      {
        $set: {
          permissions: DEFAULT_ROLE_PERMISSIONS[SYSTEM_ROLES.COMPANY_OWNER],
          description: 'Company Tenant Owner with full access within tenant scope.',
          isSystem: true,
        },
      },
      { upsert: true }
    );

    const existingCount = await Role.countDocuments();
    if (existingCount >= 6) return;

    const rolesToCreate = [
      {
        name: SYSTEM_ROLES.SUPER_ADMIN,
        description: 'System Super Administrator with full global rights.',
        permissions: Object.values(SYSTEM_PERMISSIONS),
        isSystem: true,
      },
      {
        name: SYSTEM_ROLES.COMPANY_OWNER,
        description: 'Company Tenant Owner with full access within tenant scope.',
        permissions: DEFAULT_ROLE_PERMISSIONS[SYSTEM_ROLES.COMPANY_OWNER],
        isSystem: true,
      },
      {
        name: SYSTEM_ROLES.BRANCH_MANAGER,
        description: 'Branch Manager managing single store site operations.',
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

    await Promise.all(
      rolesToCreate.map((r) =>
        Role.findOneAndUpdate(
          { name: r.name },
          {
            $set: { permissions: r.permissions, description: r.description, isSystem: r.isSystem },
          },
          { upsert: true, new: true }
        )
      )
    );
    logger.info(
      `[Database Seeding] Successfully seeded ${rolesToCreate.length} default system roles.`
    );
  } catch (err: unknown) {
    logger.error('Failed to seed system roles:', err);
  }
}

export async function seedProductsIfEmpty(): Promise<void> {
  if (config.isProduction || mongoose.connection.readyState !== 1) {
    return;
  }
  const { Product } = await import('../models/Product.js');
  try {
    const count = await Product.countDocuments();
    if (count > 0) return;

    const initialDevProducts = [
      {
        sku: 'SKU-APP-001',
        name: 'Fuji Apples (Organic)',
        description: 'Fresh organic imported Fuji apples.',
        category: 'Produce',
        price: 4.99,
        cost: 2.2,
        quantity: 150,
        lowStockAlert: 20,
        barcode: '40012011',
        isActive: true,
      },
      {
        sku: 'SKU-MILK-002',
        name: 'Whole Milk 1L',
        description: 'Pasteurized homogenized whole milk.',
        category: 'Dairy',
        price: 2.49,
        cost: 1.1,
        quantity: 80,
        lowStockAlert: 15,
        barcode: '40012022',
        isActive: true,
      },
      {
        sku: 'SKU-BREAD-003',
        name: 'Sourdough Bread',
        description: 'Freshly baked artisanal sourdough bread.',
        category: 'Bakery',
        price: 3.99,
        cost: 1.8,
        quantity: 12,
        lowStockAlert: 10,
        barcode: '40012033',
        isActive: true,
      },
      {
        sku: 'SKU-COF-004',
        name: 'Espresso Coffee Beans 500g',
        description: 'Medium roast Arabica coffee beans.',
        category: 'Pantry',
        price: 12.99,
        cost: 6.5,
        quantity: 45,
        lowStockAlert: 8,
        barcode: '40012044',
        isActive: true,
      },
    ];

    await Product.insertMany(initialDevProducts);
    logger.info('[Database Seeding] Successfully seeded initial development products.');
  } catch (err: unknown) {
    logger.error('Failed to seed default products:', err);
  }
}

export async function seedDefaultsIfEmpty(): Promise<void> {
  if (config.isProduction || mongoose.connection.readyState !== 1) {
    return;
  }
  try {
    const { Company } = await import('../models/Company.js');
    const { Branch } = await import('../models/Branch.js');
    const { Warehouse } = await import('../models/Warehouse.js');
    const { Supplier } = await import('../models/Supplier.js');
    const { Customer } = await import('../models/Customer.js');

    const companyCount = await Company.countDocuments();
    if (companyCount > 0) return;

    let company = await Company.findOne();
    if (!company) {
      company = await Company.create({
        name: 'Stockora Enterprise Inc.',
        taxId: 'TX-998877',
        address: '100 Innovation Way, Toronto, ON',
        phone: '416-555-0199',
        currency: 'USD',
        timeZone: 'EST',
      });
      logger.info('[Database Seeding] Seeded default company.');
    }

    let branch = await Branch.findOne();
    if (!branch) {
      branch = await Branch.create({
        companyId: company._id,
        name: 'Main HQ Store',
        code: 'BR-HQ-01',
        address: '100 Innovation Way, Suite 100',
        phone: '416-555-0199',
        email: 'hq@stockora.com',
        isMain: true,
      });
      logger.info('[Database Seeding] Seeded default branch.');
    }

    let warehouse = await Warehouse.findOne();
    if (!warehouse) {
      warehouse = await Warehouse.create({
        companyId: company._id,
        branchId: branch._id,
        name: 'Central Distribution Warehouse',
        code: 'WH-MAIN-01',
        type: 'DISTRIBUTION_CENTER',
        capacity: 100000,
        isDefault: true,
      });
      logger.info('[Database Seeding] Seeded default warehouse.');
    }

    const supplier = await Supplier.findOne();
    if (!supplier) {
      await Supplier.create({
        name: 'Apex Industrial Supplies',
        code: 'SUP-001',
        contactPerson: 'Sarah Jenkins',
        email: 'sjenkins@apexsupplies.com',
        phone: '1-800-555-0199',
        address: '500 Logistics Blvd, Chicago, IL',
        paymentTerms: 'NET 30',
        status: 'ACTIVE',
        isActive: true,
      });
      logger.info('[Database Seeding] Seeded default supplier.');
    }

    const customer = await Customer.findOne();
    if (!customer) {
      await Customer.create({
        name: 'Alice Johnson',
        code: 'CUST-001',
        email: 'alice@example.com',
        phone: '555-0199',
        tier: 'GOLD',
        loyaltyPoints: 120,
      });
      logger.info('[Database Seeding] Seeded default customer.');
    }
  } catch (err: unknown) {
    logger.error('Failed to seed default organizational entities:', err);
  }
}

export async function seedUsersIfEmpty(): Promise<void> {
  if (config.isProduction || mongoose.connection.readyState !== 1) {
    return;
  }
  try {
    const { User } = await import('../models/User.js');
    const bcrypt = (await import('bcryptjs')).default;

    const salt = await bcrypt.genSalt(10);
    const adminPassword = process.env.INITIAL_ADMIN_PASSWORD || 'Password123!';
    const passwordHash = await bcrypt.hash(adminPassword, salt);

    // STRICT INVARIANT: The ONLY authorized platform superadmin email (configured via environment)
    const solePlatformAdminEmail = config.platformAdminEmail
      ? config.platformAdminEmail.toLowerCase().trim()
      : '';

    if (solePlatformAdminEmail) {
      // 1. If the user has already registered, ensure they have proper platform superadmin rights
      const existing = await User.findOne({ email: solePlatformAdminEmail });
      if (existing) {
        await User.updateOne(
          { email: solePlatformAdminEmail },
          {
            $set: {
              roleName: 'Super Administrator',
              isPlatformAdmin: true,
              isActive: true,
              isVerified: true,
            },
          }
        );
        logger.info(
          `[Database Bootstrap] Sole platform superadmin verified: ${solePlatformAdminEmail}`
        );
      }

      // 2. CRITICAL SANITIZATION: Demote any other user in the database who was mistakenly granted
      // isPlatformAdmin: true or roleName: 'Super Administrator'
      const demoteResult = await User.updateMany(
        {
          email: { $ne: solePlatformAdminEmail },
          $or: [{ isPlatformAdmin: true }, { roleName: 'Super Administrator' }],
        },
        {
          $set: {
            isPlatformAdmin: false,
            roleName: 'Company Owner',
          },
        }
      );
      if (demoteResult.modifiedCount > 0) {
        logger.warn(
          `[Database Security] Demoted ${demoteResult.modifiedCount} unauthorized account(s) from platform superadmin status.`
        );
      }
    }
  } catch (err: unknown) {
    logger.error('Failed to bootstrap initial enterprise administrator accounts:', err);
  }
}
