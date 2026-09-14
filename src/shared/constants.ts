export const TRANSACTION_STATUSES = {
  PENDING: 'PENDING',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
  REFUNDED: 'REFUNDED',
} as const;

export type TransactionStatus = (typeof TRANSACTION_STATUSES)[keyof typeof TRANSACTION_STATUSES];

export const PAYMENT_METHODS = {
  CASH: 'CASH',
  CARD: 'CARD',
  MOBILE: 'MOBILE',
} as const;

export type PaymentMethod = (typeof PAYMENT_METHODS)[keyof typeof PAYMENT_METHODS];

export const DEFAULT_CURRENCY = 'USD';
export const CURRENCY_SYMBOLS = {
  USD: '$',
  EUR: '€',
  GBP: '£',
} as const;

export const SYSTEM_ROLES = {
  SUPER_ADMIN: 'Super Administrator',
  COMPANY_OWNER: 'Company Owner',
  BRANCH_MANAGER: 'Branch Manager',
  WAREHOUSE_MANAGER: 'Warehouse Manager',
  CASHIER: 'Cashier',
  INVENTORY_MANAGER: 'Inventory Manager',
  SALES_MANAGER: 'Sales Manager',
  PURCHASING_MANAGER: 'Purchasing Manager',
  ACCOUNTANT: 'Accountant',
  EMPLOYEE: 'Employee',
  AUDITOR: 'Read-Only Auditor',
} as const;

export type SystemRole = (typeof SYSTEM_ROLES)[keyof typeof SYSTEM_ROLES];

export const SYSTEM_PERMISSIONS = {
  USERS_READ: 'users:read',
  USERS_WRITE: 'users:write',
  ROLES_READ: 'roles:read',
  ROLES_WRITE: 'roles:write',
  COMPANIES_READ: 'companies:read',
  COMPANIES_WRITE: 'companies:write',
  PLATFORM_COMPANIES_VIEW: 'platform:companies:view',
  BRANCHES_READ: 'branches:read',
  BRANCHES_WRITE: 'branches:write',
  WAREHOUSES_READ: 'warehouses:read',
  WAREHOUSES_WRITE: 'warehouses:write',
  MASTER_DATA_READ: 'master_data:read',
  MASTER_DATA_WRITE: 'master_data:write',
  PRODUCTS_READ: 'products:read',
  PRODUCTS_WRITE: 'products:write',
  INVENTORY_ADJUST: 'inventory:adjust',
  TRANSACTIONS_READ: 'transactions:read',
  TRANSACTIONS_WRITE: 'transactions:write',
  SUPPLIERS_READ: 'suppliers:read',
  SUPPLIERS_WRITE: 'suppliers:write',
  CUSTOMERS_READ: 'customers:read',
  CUSTOMERS_WRITE: 'customers:write',
  AUDIT_READ: 'audit:read',
  // Phase 11-16 permissions
  PROMOTIONS_READ: 'promotions:read',
  PROMOTIONS_WRITE: 'promotions:write',
  GIFTCARDS_READ: 'giftcards:read',
  GIFTCARDS_WRITE: 'giftcards:write',
  SECURITY_READ: 'security:read',
  SECURITY_WRITE: 'security:write',
  AUTOMATION_READ: 'automation:read',
  AUTOMATION_WRITE: 'automation:write',
  NOTIFICATIONS_READ: 'notifications:read',
  NOTIFICATIONS_WRITE: 'notifications:write',
  RETURNS_READ: 'returns:read',
  RETURNS_WRITE: 'returns:write',
  WARRANTIES_READ: 'warranties:read',
  WARRANTIES_WRITE: 'warranties:write',
  FINANCE_READ: 'finance:read',
  FINANCE_WRITE: 'finance:write',
  REPORTS_READ: 'reports:read',
  REPORTS_WRITE: 'reports:write',
  WORKFLOWS_READ: 'workflows:read',
  WORKFLOWS_WRITE: 'workflows:write',
  // AI Intelligence permissions
  AI_VIEW: 'ai:view',
  AI_ANALYZE: 'ai:analyze',
  AI_INVENTORY: 'ai:inventory',
  AI_SALES: 'ai:sales',
  AI_FORECASTING: 'ai:forecasting',
  AI_RECOMMENDATIONS: 'ai:recommendations',
  AI_REPORTS: 'ai:reports',
} as const;

export type SystemPermission = (typeof SYSTEM_PERMISSIONS)[keyof typeof SYSTEM_PERMISSIONS];

export const MASTER_DATA_TYPES = {
  CATEGORY: 'CATEGORY',
  BRAND: 'BRAND',
  UOM: 'UOM',
  TAX_RATE: 'TAX_RATE',
  CUSTOMER_TYPE: 'CUSTOMER_TYPE',
  SUPPLIER_TYPE: 'SUPPLIER_TYPE',
} as const;

export type MasterDataType = (typeof MASTER_DATA_TYPES)[keyof typeof MASTER_DATA_TYPES];
