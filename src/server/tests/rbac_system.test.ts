import { describe, it, expect, beforeEach } from 'vitest';
import {
  SYSTEM_ROLES,
  SYSTEM_PERMISSIONS,
  DEFAULT_ROLE_PERMISSIONS,
  getEffectivePermissions,
  hasPermission,
  hasAnyPermission,
  hasAllPermissions,
  hasRole,
} from '../../shared/permissions.js';
import { rbacMiddleware, requireAnyPermission, requireRole } from '../middleware/rbac.js';
import { AuthorizationError } from '../errors/AppError.js';

describe('Role-Based Access Control (RBAC) & Permission Engine', () => {
  describe('1. Centralized Permission Resolver (getEffectivePermissions)', () => {
    it('grants full platform permissions to Super Administrator and tenant permissions to Company Owner', () => {
      const superAdminUser = { roleName: SYSTEM_ROLES.SUPER_ADMIN };
      const ownerUser = { roleName: SYSTEM_ROLES.COMPANY_OWNER };
      const platformAdminUser = { isPlatformAdmin: true };

      const allPerms = Object.values(SYSTEM_PERMISSIONS);

      expect(getEffectivePermissions(superAdminUser)).toEqual(allPerms);
      expect(getEffectivePermissions(platformAdminUser)).toEqual(allPerms);
      expect(getEffectivePermissions(ownerUser)).toEqual(
        Array.from(DEFAULT_ROLE_PERMISSIONS[SYSTEM_ROLES.COMPANY_OWNER])
      );
    });

    it('resolves strict least-privilege permissions for Cashier role', () => {
      const cashierUser = { roleName: SYSTEM_ROLES.CASHIER };
      const perms = getEffectivePermissions(cashierUser);

      // Must have POS and customer read/write permissions
      expect(perms).toContain(SYSTEM_PERMISSIONS.TRANSACTIONS_WRITE);
      expect(perms).toContain(SYSTEM_PERMISSIONS.CUSTOMERS_READ);
      expect(perms).toContain(SYSTEM_PERMISSIONS.PRODUCTS_READ);

      // Must NOT have admin, billing, security, or audit permissions
      expect(perms).not.toContain(SYSTEM_PERMISSIONS.USERS_WRITE);
      expect(perms).not.toContain(SYSTEM_PERMISSIONS.COMPANIES_WRITE);
      expect(perms).not.toContain(SYSTEM_PERMISSIONS.FINANCE_WRITE);
      expect(perms).not.toContain(SYSTEM_PERMISSIONS.SECURITY_WRITE);
      expect(perms).not.toContain(SYSTEM_PERMISSIONS.AUDIT_READ);
    });

    it('resolves warehouse and logistics permissions for Warehouse Manager', () => {
      const whManager = { roleName: SYSTEM_ROLES.WAREHOUSE_MANAGER };
      const perms = getEffectivePermissions(whManager);

      expect(perms).toContain(SYSTEM_PERMISSIONS.WAREHOUSES_READ);
      expect(perms).toContain(SYSTEM_PERMISSIONS.WAREHOUSES_WRITE);
      expect(perms).toContain(SYSTEM_PERMISSIONS.PRODUCTS_READ);
      expect(perms).not.toContain(SYSTEM_PERMISSIONS.FINANCE_READ);
      expect(perms).not.toContain(SYSTEM_PERMISSIONS.USERS_WRITE);
    });

    it('resolves finance and accounting permissions for Accountant', () => {
      const accountant = { roleName: SYSTEM_ROLES.ACCOUNTANT };
      const perms = getEffectivePermissions(accountant);

      expect(perms).toContain(SYSTEM_PERMISSIONS.FINANCE_READ);
      expect(perms).toContain(SYSTEM_PERMISSIONS.FINANCE_WRITE);
      expect(perms).toContain(SYSTEM_PERMISSIONS.REPORTS_READ);
      expect(perms).not.toContain(SYSTEM_PERMISSIONS.WAREHOUSES_WRITE);
      expect(perms).not.toContain(SYSTEM_PERMISSIONS.USERS_WRITE);
    });

    it('correctly merges role permissions with custom assigned user permissions', () => {
      const customStaff = {
        roleName: SYSTEM_ROLES.EMPLOYEE,
        permissions: [SYSTEM_PERMISSIONS.REPORTS_READ, SYSTEM_PERMISSIONS.CUSTOMERS_READ],
      };
      const perms = getEffectivePermissions(customStaff);

      expect(perms).toContain(SYSTEM_PERMISSIONS.PRODUCTS_READ); // from EMPLOYEE role
      expect(perms).toContain(SYSTEM_PERMISSIONS.REPORTS_READ); // custom user perm
      expect(perms).toContain(SYSTEM_PERMISSIONS.CUSTOMERS_READ); // custom user perm
      expect(perms).not.toContain(SYSTEM_PERMISSIONS.USERS_WRITE);
    });

    it('fails closed to empty array for null, undefined, or unknown role users', () => {
      expect(getEffectivePermissions(null)).toEqual([]);
      expect(getEffectivePermissions(undefined)).toEqual([]);
      expect(getEffectivePermissions({ roleName: 'UnknownHackerRole' })).toEqual([]);
    });
  });

  describe('2. Permission Checking Utilities', () => {
    const cashier = { roleName: SYSTEM_ROLES.CASHIER };
    const owner = { roleName: SYSTEM_ROLES.COMPANY_OWNER };

    it('evaluates hasPermission correctly', () => {
      expect(hasPermission(cashier, SYSTEM_PERMISSIONS.TRANSACTIONS_WRITE)).toBe(true);
      expect(hasPermission(cashier, SYSTEM_PERMISSIONS.FINANCE_WRITE)).toBe(false);
      expect(hasPermission(owner, SYSTEM_PERMISSIONS.FINANCE_WRITE)).toBe(true);
      expect(hasPermission(null, SYSTEM_PERMISSIONS.PRODUCTS_READ)).toBe(false);
      expect(hasPermission(cashier, undefined)).toBe(true); // undefined permission = public/open
    });

    it('evaluates hasAnyPermission correctly', () => {
      expect(
        hasAnyPermission(cashier, [
          SYSTEM_PERMISSIONS.FINANCE_WRITE,
          SYSTEM_PERMISSIONS.CUSTOMERS_READ,
        ])
      ).toBe(true);
      expect(
        hasAnyPermission(cashier, [
          SYSTEM_PERMISSIONS.FINANCE_WRITE,
          SYSTEM_PERMISSIONS.SECURITY_WRITE,
        ])
      ).toBe(false);
    });

    it('evaluates hasAllPermissions correctly', () => {
      expect(
        hasAllPermissions(cashier, [
          SYSTEM_PERMISSIONS.PRODUCTS_READ,
          SYSTEM_PERMISSIONS.CUSTOMERS_READ,
        ])
      ).toBe(true);
      expect(
        hasAllPermissions(cashier, [
          SYSTEM_PERMISSIONS.PRODUCTS_READ,
          SYSTEM_PERMISSIONS.USERS_WRITE,
        ])
      ).toBe(false);
    });

    it('evaluates hasRole correctly', () => {
      expect(hasRole(cashier, SYSTEM_ROLES.CASHIER)).toBe(true);
      expect(hasRole(cashier, [SYSTEM_ROLES.BRANCH_MANAGER, SYSTEM_ROLES.CASHIER])).toBe(true);
      expect(hasRole(cashier, SYSTEM_ROLES.COMPANY_OWNER)).toBe(false);
      expect(hasRole(owner, SYSTEM_ROLES.COMPANY_OWNER)).toBe(true);
    });
  });

  describe('3. Backend RBAC Middleware Enforcement (Fail-Closed & 403 Rejection)', () => {
    it('allows Super Administrator and Company Owner through without restriction', async () => {
      const req: any = {
        user: { roleName: SYSTEM_ROLES.SUPER_ADMIN, isPlatformAdmin: true },
      };
      let nextCalled = false;
      const middleware = rbacMiddleware([SYSTEM_PERMISSIONS.SECURITY_WRITE]);

      await middleware(req, {} as any, (err?: any) => {
        expect(err).toBeUndefined();
        nextCalled = true;
      });
      expect(nextCalled).toBe(true);
    });

    it('rejects unauthenticated requests with AuthorizationError', async () => {
      const req: any = {};
      let caughtError: any = null;
      const middleware = rbacMiddleware([SYSTEM_PERMISSIONS.PRODUCTS_READ]);

      await middleware(req, {} as any, (err?: any) => {
        caughtError = err;
      });
      expect(caughtError).toBeInstanceOf(AuthorizationError);
      expect(caughtError.message).toContain('Authentication required');
    });

    it('rejects Cashier when attempting to access admin/finance endpoints with 403 AuthorizationError', async () => {
      const req: any = {
        user: { roleName: SYSTEM_ROLES.CASHIER },
      };
      let caughtError: any = null;
      const middleware = rbacMiddleware([SYSTEM_PERMISSIONS.FINANCE_WRITE]);

      await middleware(req, {} as any, (err?: any) => {
        caughtError = err;
      });
      expect(caughtError).toBeInstanceOf(AuthorizationError);
      expect(caughtError.message).toContain('lacks required permission(s)');
    });

    it('allows Cashier when requesting authorized transactions:write endpoint', async () => {
      const req: any = {
        user: { roleName: SYSTEM_ROLES.CASHIER },
      };
      let nextCalled = false;
      const middleware = rbacMiddleware([SYSTEM_PERMISSIONS.TRANSACTIONS_WRITE]);

      await middleware(req, {} as any, (err?: any) => {
        expect(err).toBeUndefined();
        nextCalled = true;
      });
      expect(nextCalled).toBe(true);
    });

    it('requireAnyPermission accepts if at least one permission is met', async () => {
      const req: any = {
        user: { roleName: SYSTEM_ROLES.CASHIER },
      };
      let nextCalled = false;
      const middleware = requireAnyPermission([
        SYSTEM_PERMISSIONS.FINANCE_WRITE,
        SYSTEM_PERMISSIONS.PRODUCTS_READ,
      ]);

      await middleware(req, {} as any, (err?: any) => {
        expect(err).toBeUndefined();
        nextCalled = true;
      });
      expect(nextCalled).toBe(true);
    });

    it('requireRole rejects users not belonging to specified allowed roles', () => {
      const req: any = {
        user: { roleName: SYSTEM_ROLES.CASHIER },
      };
      let caughtError: any = null;
      const middleware = requireRole([SYSTEM_ROLES.ACCOUNTANT, SYSTEM_ROLES.BRANCH_MANAGER]);

      middleware(req, {} as any, (err?: any) => {
        caughtError = err;
      });
      expect(caughtError).toBeInstanceOf(AuthorizationError);
      expect(caughtError.message).toContain('Requires one of roles');
    });
  });

  describe('4. Role Normalization & Sales Back Office Access Matrix', () => {
    it('normalizes uppercase enum keys and title-case roles identically', () => {
      const salesManagerEnum = { roleName: 'SALES_MANAGER' };
      const salesManagerTitle = { roleName: SYSTEM_ROLES.SALES_MANAGER };
      const branchManagerEnum = { roleName: 'BRANCH_MANAGER' };
      const adminRole = { roleName: 'ADMIN' };
      const cashierEnum = { roleName: 'CASHIER' };

      expect(getEffectivePermissions(salesManagerEnum)).toEqual(
        getEffectivePermissions(salesManagerTitle)
      );
      expect(getEffectivePermissions(salesManagerEnum)).toContain(
        SYSTEM_PERMISSIONS.TRANSACTIONS_READ
      );
      expect(getEffectivePermissions(salesManagerEnum)).toContain(SYSTEM_PERMISSIONS.PRODUCTS_READ);
      expect(getEffectivePermissions(salesManagerEnum)).toContain(
        SYSTEM_PERMISSIONS.CUSTOMERS_READ
      );

      expect(getEffectivePermissions(branchManagerEnum)).toContain(
        SYSTEM_PERMISSIONS.TRANSACTIONS_READ
      );
      expect(getEffectivePermissions(branchManagerEnum)).toContain(
        SYSTEM_PERMISSIONS.PRODUCTS_READ
      );
      expect(getEffectivePermissions(branchManagerEnum)).toContain(
        SYSTEM_PERMISSIONS.CUSTOMERS_READ
      );

      expect(getEffectivePermissions(adminRole)).toEqual(
        Array.from(DEFAULT_ROLE_PERMISSIONS[SYSTEM_ROLES.COMPANY_OWNER])
      );
      expect(getEffectivePermissions(cashierEnum)).toContain(SYSTEM_PERMISSIONS.CUSTOMERS_READ);
    });

    it('authorizes Sales Back Office read operations for Sales Manager, Cashier, and Branch Manager', async () => {
      const rolesToTest = ['SALES_MANAGER', 'Sales Manager', 'Branch Manager', 'Cashier'];

      for (const role of rolesToTest) {
        const req: any = { user: { roleName: role, id: 'user_123', tenantId: 'tenant_abc' } };
        let nextCalled = false;

        const soMiddleware = requireAnyPermission([
          SYSTEM_PERMISSIONS.TRANSACTIONS_READ,
          SYSTEM_PERMISSIONS.PRODUCTS_READ,
        ]);
        await soMiddleware(req, {} as any, (err?: any) => {
          expect(err).toBeUndefined();
          nextCalled = true;
        });
        expect(nextCalled).toBe(true);

        nextCalled = false;
        const custMiddleware = rbacMiddleware([SYSTEM_PERMISSIONS.CUSTOMERS_READ]);
        await custMiddleware(req, {} as any, (err?: any) => {
          expect(err).toBeUndefined();
          nextCalled = true;
        });
        expect(nextCalled).toBe(true);
      }
    });

    it('strictly denies unauthorized users lacking required permissions', async () => {
      const unprivilegedUser: any = {
        user: { roleName: SYSTEM_ROLES.EMPLOYEE, id: 'emp_1', tenantId: 'tenant_abc' },
      };

      let caughtError: any = null;
      const custMiddleware = rbacMiddleware([SYSTEM_PERMISSIONS.CUSTOMERS_READ]);
      await custMiddleware(unprivilegedUser, {} as any, (err?: any) => {
        caughtError = err;
      });

      expect(caughtError).toBeInstanceOf(AuthorizationError);
      expect(caughtError.message).toContain('lacks required permission(s)');
    });
  });
});
