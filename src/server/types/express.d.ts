/**
 * express.d.ts
 * Global Express namespace augmentation for Stockora Multi-Tenant SaaS.
 */

declare namespace Express {
  interface User {
    id: string;
    username: string;
    email?: string;
    roleName: string;
    tenantId?: string;
    tenantSlug?: string;
    isPlatformAdmin?: boolean;
    branchId?: string;
    allowedBranches?: string[];
    tenants?: Array<{
      tenantId: string;
      tenantSlug?: string;
      tenantName?: string;
      roleName: string;
      branchId?: string;
      allowedBranches?: string[];
      isDefault?: boolean;
    }>;
    sessionToken?: string;
  }
}
