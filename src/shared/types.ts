export type UserRole = 'ADMIN' | 'MANAGER' | 'CASHIER' | 'WAREHOUSE';

export interface User {
  id: string;
  _id?: string;
  name: string;
  username?: string;
  email: string;
  role: UserRole;
  roleName?: string;
  permissions?: string[];
  isActive: boolean;
  branchId?: string;
  branchName?: string;
  avatarUrl?: string;
  preferredLanguage?: string;
  timeZone?: string;
  themePreference?: 'light' | 'dark';
  createdAt: string;
  updatedAt: string;
}

export interface Branch {
  id: string;
  _id?: string;
  name: string;
  code: string;
  address: string;
  phone: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProductVariant {
  sku: string;
  name: string;
  price?: number;
  quantity: number;
  attributes: { key: string; value: string }[];
}

export interface Product {
  id?: string;
  _id?: string;
  sku: string;
  name: string;
  description?: string;
  category: string;
  subcategory?: string;
  brand?: string;
  uom?: string;
  isActive: boolean;
  status: 'ACTIVE' | 'INACTIVE' | 'DRAFT' | 'OUT_OF_STOCK';
  costPrice: number;
  sellingPrice: number;
  price: number;
  cost: number;
  quantity: number;
  lowStockAlert: number;
  reservedQuantity?: number;
  damagedQuantity?: number;
  returnedQuantity?: number;
  barcode?: string;
  qrCode?: string;
  wholesalePrice?: number;
  retailPrice?: number;
  promotionalPrice?: number;
  isTaxInclusive?: boolean;
  currency?: string;
  variants?: ProductVariant[];
  attributes?: { key: string; value: string }[];
  width?: number;
  height?: number;
  depth?: number;
  weight?: number;
  imageUrl?: string;
  gallery?: string[];
  tags?: string[];
  notes?: string;
  expirationDate?: string;
  batchNumbers?: string[];
  serialNumbers?: string[];
  createdAt?: string;
  updatedAt?: string;
}

export type TransactionType = 'SALE' | 'RETURN' | 'TRANSFER';
export type TransactionStatus = 'COMPLETED' | 'PENDING' | 'CANCELLED';
export type PaymentMethod = 'CASH' | 'CARD' | 'BANK_TRANSFER';

export interface TransactionItem {
  productId: string;
  productName: string;
  sku: string;
  quantity: number;
  price: number;
  discount: number;
  total: number;
}

export interface Transaction {
  id: string;
  _id?: string;
  transactionNumber: string;
  type: TransactionType;
  status: TransactionStatus;
  items: TransactionItem[];
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  paymentMethod: PaymentMethod;
  cashierId: string;
  cashierName: string;
  branchId: string;
  branchName: string;
  customerEmail?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Receipt {
  id: string;
  _id?: string;
  transactionId: string;
  transactionNumber: string;
  customerEmail?: string;
  branchId?: string;
  cashierId?: string;
  data: {
    transactionNumber: string;
    items: TransactionItem[];
    subtotal: number;
    tax: number;
    discount: number;
    total: number;
    paymentMethod: string;
    cashierName: string;
    branchName: string;
    customerEmail?: string;
    createdAt?: string;
  };
  createdAt: string;
  updatedAt: string;
}

export type TransferStatus = 'PENDING' | 'EN_ROUTE' | 'RECEIVED' | 'CANCELLED';

export interface TransferItem {
  productId: string;
  productName: string;
  sku: string;
  quantity: number;
}

export interface StockTransfer {
  id: string;
  _id?: string;
  transferNumber: string;
  sourceBranchId: string;
  sourceBranchName: string;
  targetBranchId: string;
  targetBranchName: string;
  items: TransferItem[];
  status: TransferStatus;
  createdBy: string;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
}

export interface Role {
  id: string;
  _id?: string;
  name: string;
  description?: string;
  permissions: string[];
  isSystem: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Company {
  id: string;
  _id?: string;
  name: string;
  logoUrl?: string;
  taxId?: string;
  address?: string;
  phone?: string;
  currency: string;
  timeZone: string;
  createdAt: string;
  updatedAt: string;
}

export interface Warehouse {
  id: string;
  _id?: string;
  branchId: string;
  name: string;
  code: string;
  zones: string[];
  capacity?: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Department {
  id: string;
  _id?: string;
  companyId: string;
  name: string;
  managerId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Employee {
  id: string;
  _id?: string;
  userId: string;
  employeeId: string;
  departmentId?: string;
  assignedBranchId?: string;
  assignedWarehouseId?: string;
  status: 'ACTIVE' | 'TERMINATED' | 'ON_LEAVE';
  hireDate: string;
  contactPhone?: string;
  createdAt: string;
  updatedAt: string;
}

export interface MasterData {
  id: string;
  _id?: string;
  type: string;
  name: string;
  code: string;
  value?: number | string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: User;
}

export interface Supplier {
  id?: string;
  _id?: string;
  name: string;
  code: string;
  contactPerson: string;
  email: string;
  phone: string;
  address: string;
  paymentTerms: string;
  creditLimit: number;
  taxId?: string;
  rating?: number;
  documents?: string[];
  isActive: boolean;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Customer {
  id?: string;
  _id?: string;
  name: string;
  code: string;
  email: string;
  phone?: string;
  group: string;
  creditLimit: number;
  loyaltyPoints: number;
  billingAddress?: string;
  shippingAddress?: string;
  isActive: boolean;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

// ── Phase 47 Globalization & Regional Settings Types ─────────────────────────

export interface TaxRateItem {
  id?: string;
  _id?: string;
  name: string;
  code: string;
  ratePercentage: number;
  type: 'VAT' | 'SALES_TAX' | 'GST' | 'CUSTOMS' | 'EXEMPT';
  category: 'STANDARD' | 'REDUCED' | 'ZERO_RATED' | 'EXEMPT';
  isInclusive: boolean;
  isActive: boolean;
  description?: string;
}

export interface TaxConfiguration {
  taxId?: string;
  taxRegistrationName?: string;
  taxType: 'VAT' | 'SALES_TAX' | 'GST' | 'EXEMPT';
  defaultTaxRate: number;
  isTaxInclusive: boolean;
  taxExemptionAllowed: boolean;
  taxRates?: TaxRateItem[];
}

export interface RegionalSettings {
  country: string;
  countryCode: string;
  currency: string;
  currencySymbol: string;
  supportedCurrencies: string[];
  timezone: string;
  language: string;
  dateFormat: string;
  timeFormat: '12h' | '24h';
  numberFormat: {
    decimalSeparator: string;
    thousandSeparator: string;
    precision: number;
  };
  firstDayOfWeek: 'Sunday' | 'Monday';
  measurementSystem: 'Metric' | 'Imperial';
  taxConfig: TaxConfiguration;
}

export interface ExchangeRate {
  id?: string;
  _id?: string;
  tenantId?: string;
  baseCurrency: string;
  targetCurrency: string;
  rate: number;
  provider: string;
  fetchedAt: Date | string;
  isStale?: boolean;
  isCustomOverride?: boolean;
}

export interface CurrencyConversionResult {
  fromCurrency: string;
  toCurrency: string;
  originalAmount: number;
  convertedAmount: number;
  exchangeRate: number;
  rateTimestamp: Date | string;
  provider: string;
}
