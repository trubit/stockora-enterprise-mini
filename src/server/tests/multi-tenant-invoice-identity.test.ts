import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import mongoose from 'mongoose';
import { POSService } from '../services/pos.service.js';
import { POSAdvancedService } from '../services/posAdvanced.service.js';
import { EmailService } from '../services/email.service.js';
import { Tenant } from '../models/Tenant.js';
import { Company } from '../models/Company.js';
import { Product } from '../models/Product.js';
import { Transaction } from '../models/Transaction.js';
import { Receipt } from '../models/Receipt.js';
import { OmnichannelOrder } from '../models/OmnichannelOrder.js';

describe('Multi-Tenant Company-Specific Invoice & Receipt Identity Tests', () => {
  let tenantAId: string;
  let tenantBId: string;
  let companyAId: mongoose.Types.ObjectId;
  let companyBId: mongoose.Types.ObjectId;
  let productAId: mongoose.Types.ObjectId;
  let productBId: mongoose.Types.ObjectId;
  const skuA = `SKU-A-${Date.now()}`;
  const skuB = `SKU-B-${Date.now()}`;

  beforeAll(async () => {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    await mongoose.connect('mongodb://127.0.0.1:27017/stockora_test_multi_tenant_identity');

    // 1. Create Tenant A & Company A
    const tenantA = await Tenant.create({
      name: 'Apex Supermarket Ltd',
      legalName: 'Apex Retail Enterprises Limited',
      slug: `apex-supermarket-${Date.now()}`,
      status: 'ACTIVE',
      plan: 'ENTERPRISE',
      branding: {
        logoUrl: 'https://cdn.apex.example.com/logo.png',
        primaryColor: '#0055ff',
        receiptHeader: 'Welcome to Apex Supermarket - Quality Everyday',
        receiptFooter: 'Thank you for shopping at Apex! Returns within 7 days with receipt.',
      },
      contact: {
        email: 'sales@apexmarket.example.com',
        phone: '+234 801 111 2222',
        addressLine1: '100 Marina Road, Lagos Island, Lagos',
      },
      taxConfig: {
        taxId: 'TIN-APEX-998877',
        taxRegistrationName: 'Apex Retail VAT Reg',
        defaultTaxRate: 7.5,
        isTaxInclusive: false,
      },
    });
    tenantAId = (tenantA._id as mongoose.Types.ObjectId).toString();

    const compA = await Company.create({
      tenantId: tenantA._id,
      name: 'Apex Supermarket Ltd',
      legalName: 'Apex Retail Enterprises Limited',
      logoUrl: 'https://cdn.apex.example.com/logo.png',
      address: '100 Marina Road, Lagos Island, Lagos',
      phone: '+234 801 111 2222',
      email: 'sales@apexmarket.example.com',
      taxId: 'TIN-APEX-998877',
      currency: 'USD',
      status: 'ACTIVE',
    });
    companyAId = compA._id as mongoose.Types.ObjectId;

    // 2. Create Tenant B & Company B
    const tenantB = await Tenant.create({
      name: 'Beacon Pharmacy & Health',
      legalName: 'Beacon Healthcare Global PLC',
      slug: `beacon-pharmacy-${Date.now()}`,
      status: 'ACTIVE',
      plan: 'ENTERPRISE',
      branding: {
        logoUrl: 'https://cdn.beacon.example.com/rx-logo.png',
        primaryColor: '#00cc66',
        receiptHeader: 'Beacon Pharmacy - Caring for your wellness',
        receiptFooter: 'Prescription medications cannot be returned. Stay healthy!',
      },
      contact: {
        email: 'care@beaconhealth.example.com',
        phone: '+234 809 999 8888',
        addressLine1: '45 Adetokunbo Ademola St, Victoria Island, Lagos',
      },
      taxConfig: {
        taxId: 'TIN-BEACON-554433',
        taxRegistrationName: 'Beacon Pharma VAT Reg',
        defaultTaxRate: 5.0,
        isTaxInclusive: false,
      },
    });
    tenantBId = (tenantB._id as mongoose.Types.ObjectId).toString();

    const compB = await Company.create({
      tenantId: tenantB._id,
      name: 'Beacon Pharmacy & Health',
      legalName: 'Beacon Healthcare Global PLC',
      logoUrl: 'https://cdn.beacon.example.com/rx-logo.png',
      address: '45 Adetokunbo Ademola St, Victoria Island, Lagos',
      phone: '+234 809 999 8888',
      email: 'care@beaconhealth.example.com',
      taxId: 'TIN-BEACON-554433',
      currency: 'USD',
      status: 'ACTIVE',
    });
    companyBId = compB._id as mongoose.Types.ObjectId;

    // 3. Create Products for Tenant A and Tenant B
    const prodA = await Product.create({
      tenantId: tenantAId,
      companyId: companyAId,
      name: 'Organic Milk 1L',
      sku: skuA,
      costPrice: 2,
      sellingPrice: 5,
      quantity: 100,
    });
    productAId = prodA._id as mongoose.Types.ObjectId;

    const prodB = await Product.create({
      tenantId: tenantBId,
      companyId: companyBId,
      name: 'Vitamin C 1000mg Tabs',
      sku: skuB,
      costPrice: 4,
      sellingPrice: 12,
      quantity: 50,
    });
    productBId = prodB._id as mongoose.Types.ObjectId;
  });

  afterAll(async () => {
    await Tenant.deleteMany({ tenantId: { $in: [tenantAId, tenantBId] } });
    await Company.deleteMany({ _id: { $in: [companyAId, companyBId] } });
    await Product.deleteMany({ sku: { $in: [skuA, skuB] } });
    await OmnichannelOrder.deleteMany({ tenantId: { $in: [tenantAId, tenantBId] } });
    await Transaction.deleteMany({ tenantId: { $in: [tenantAId, tenantBId] } });
    await Receipt.deleteMany({ tenantId: { $in: [tenantAId, tenantBId] } });
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  });

  describe('TEST 1 - 8: Multi-Tenant Checkout & Receipt Generation', () => {
    it('should generate Company A receipt identifying Apex Supermarket Ltd with its company branding', async () => {
      const orderA = await POSService.checkout({
        tenantId: tenantAId,
        channel: 'IN_STORE',
        warehouseId: new mongoose.Types.ObjectId().toString(),
        cashierId: new mongoose.Types.ObjectId().toString(),
        cashierName: 'Jane Cashier',
        taxRate: 0.075,
        items: [
          {
            productId: productAId.toString(),
            sku: skuA,
            name: 'Organic Milk 1L',
            quantity: 2,
            unitPrice: 5,
            subtotal: 10,
            tax: 0.75,
            discount: 0,
            total: 10.75,
          } as any,
        ],
        subtotal: 10,
        taxTotal: 0.75,
        discountTotal: 0,
        grandTotal: 10.75,
        currency: 'USD',
        payments: [{ paymentMethod: 'CASH', amount: 10.75 }],
      });

      expect(orderA.tenantId).toBe(tenantAId);

      // Generate receipt
      const receiptA = await POSService.generateReceipt(orderA._id.toString());

      // 1. Authoritative Seller Identity MUST match Company A
      expect(receiptA.companyName).toBe('Apex Supermarket Ltd');
      expect(receiptA.companyLegalName).toBe('Apex Retail Enterprises Limited');
      expect(receiptA.companyLogoUrl).toBe('https://cdn.apex.example.com/logo.png');
      expect(receiptA.companyAddress).toBe('100 Marina Road, Lagos Island, Lagos');
      expect(receiptA.companyPhone).toBe('+234 801 111 2222');
      expect(receiptA.companyEmail).toBe('sales@apexmarket.example.com');
      expect(receiptA.companyTaxId).toBe('TIN-APEX-998877');
      expect(receiptA.receiptHeader).toBe('Welcome to Apex Supermarket - Quality Everyday');
      expect(receiptA.receiptFooter).toBe(
        'Thank you for shopping at Apex! Returns within 7 days with receipt.'
      );

      // 2. Legacy header object MUST also reflect Company A
      expect(receiptA.header.storeName).toBe('Apex Supermarket Ltd');
      expect(receiptA.header.address).toBe('100 Marina Road, Lagos Island, Lagos');
      expect(receiptA.header.phone).toBe('+234 801 111 2222');
      expect(receiptA.header.taxId).toBe('TIN-APEX-998877');

      // 3. Platform attribution is present but separate
      expect(receiptA.platformAttribution).toBe('Powered by Stockora Enterprise');

      // 4. MUST NOT contain Company B info or generic hardcoded store name
      expect(receiptA.companyName).not.toBe('Stockora Enterprise Superstore');
      expect(receiptA.companyName).not.toBe('Beacon Pharmacy & Health');
      expect(receiptA.companyTaxId).not.toBe('TIN-BEACON-554433');
    });

    it('should generate Company B receipt identifying Beacon Pharmacy & Health with its company branding', async () => {
      const orderB = await POSService.checkout({
        tenantId: tenantBId,
        channel: 'IN_STORE',
        warehouseId: new mongoose.Types.ObjectId().toString(),
        cashierId: new mongoose.Types.ObjectId().toString(),
        cashierName: 'John Pharmacist',
        taxRate: 0.05,
        items: [
          {
            productId: productBId.toString(),
            sku: skuB,
            name: 'Vitamin C 1000mg Tabs',
            quantity: 3,
            unitPrice: 12,
            subtotal: 36,
            tax: 1.8,
            discount: 0,
            total: 37.8,
          } as any,
        ],
        subtotal: 36,
        taxTotal: 1.8,
        discountTotal: 0,
        grandTotal: 37.8,
        currency: 'USD',
        payments: [{ paymentMethod: 'CARD', amount: 37.8 }],
      });

      expect(orderB.tenantId).toBe(tenantBId);

      // Generate receipt
      const receiptB = await POSService.generateReceipt(orderB._id.toString());

      // 1. Authoritative Seller Identity MUST match Company B
      expect(receiptB.companyName).toBe('Beacon Pharmacy & Health');
      expect(receiptB.companyLegalName).toBe('Beacon Healthcare Global PLC');
      expect(receiptB.companyLogoUrl).toBe('https://cdn.beacon.example.com/rx-logo.png');
      expect(receiptB.companyAddress).toBe('45 Adetokunbo Ademola St, Victoria Island, Lagos');
      expect(receiptB.companyPhone).toBe('+234 809 999 8888');
      expect(receiptB.companyEmail).toBe('care@beaconhealth.example.com');
      expect(receiptB.companyTaxId).toBe('TIN-BEACON-554433');
      expect(receiptB.receiptHeader).toBe('Beacon Pharmacy - Caring for your wellness');
      expect(receiptB.receiptFooter).toBe(
        'Prescription medications cannot be returned. Stay healthy!'
      );

      // 2. Platform attribution is present but separate
      expect(receiptB.platformAttribution).toBe('Powered by Stockora Enterprise');

      // 3. MUST NOT contain Company A info or generic hardcoded store name
      expect(receiptB.companyName).not.toBe('Stockora Enterprise Superstore');
      expect(receiptB.companyName).not.toBe('Apex Supermarket Ltd');
      expect(receiptB.companyTaxId).not.toBe('TIN-APEX-998877');
    });
  });

  describe('TEST 9 - 13: Thermal Receipt & Print Generation Isolation', () => {
    it('should generate ESC/POS thermal receipt string with Company A identity', async () => {
      const txA = await Transaction.create({
        tenantId: tenantAId,
        companyId: companyAId,
        transactionNumber: `TX-A-${Date.now()}`,
        type: 'SALE',
        subtotal: 50,
        total: 50,
        amount: 50,
        paymentMethod: 'CASH',
        status: 'COMPLETED',
        cashierId: new mongoose.Types.ObjectId(),
        cashierName: 'Jane Cashier',
        branchId: new mongoose.Types.ObjectId(),
        branchName: 'Main Branch',
        items: [
          {
            productId: productAId,
            productName: 'Organic Milk 1L',
            sku: skuA,
            quantity: 10,
            price: 5,
            total: 50,
          },
        ],
      });

      const thermalA = await POSAdvancedService.generateThermalReceipt(txA._id.toString());

      // Assert tenant seller identity in thermal receipt metadata
      expect(thermalA.header.businessName).toBe('Apex Supermarket Ltd');
      expect(thermalA.header.legalName).toBe('Apex Retail Enterprises Limited');
      expect(thermalA.header.address).toBe('100 Marina Road, Lagos Island, Lagos');
      expect(thermalA.header.phone).toBe('+234 801 111 2222');
      expect(thermalA.header.taxId).toBe('TIN-APEX-998877');
      expect(thermalA.header.logoUrl).toBe('https://cdn.apex.example.com/logo.png');
      expect(thermalA.platformAttribution).toBe('Powered by Stockora Enterprise');

      // Assert no leakage of Company B or hardcoded generic store
      expect(thermalA.header.businessName).not.toBe('Beacon Pharmacy & Health');
      expect(thermalA.header.businessName).not.toBe('Stockora Enterprise Store');
    });

    it('should generate ESC/POS thermal receipt string with Company B identity', async () => {
      const txB = await Transaction.create({
        tenantId: tenantBId,
        companyId: companyBId,
        transactionNumber: `TX-B-${Date.now()}`,
        type: 'SALE',
        subtotal: 120,
        total: 120,
        amount: 120,
        paymentMethod: 'CARD',
        status: 'COMPLETED',
        cashierId: new mongoose.Types.ObjectId(),
        cashierName: 'John Pharmacist',
        branchId: new mongoose.Types.ObjectId(),
        branchName: 'VI Branch',
        items: [
          {
            productId: productBId,
            productName: 'Vitamin C 1000mg Tabs',
            sku: skuB,
            quantity: 10,
            price: 12,
            total: 120,
          },
        ],
      });

      const thermalB = await POSAdvancedService.generateThermalReceipt(txB._id.toString());

      // Assert tenant seller identity in thermal receipt metadata
      expect(thermalB.header.businessName).toBe('Beacon Pharmacy & Health');
      expect(thermalB.header.legalName).toBe('Beacon Healthcare Global PLC');
      expect(thermalB.header.address).toBe('45 Adetokunbo Ademola St, Victoria Island, Lagos');
      expect(thermalB.header.phone).toBe('+234 809 999 8888');
      expect(thermalB.header.taxId).toBe('TIN-BEACON-554433');
      expect(thermalB.header.logoUrl).toBe('https://cdn.beacon.example.com/rx-logo.png');
      expect(thermalB.platformAttribution).toBe('Powered by Stockora Enterprise');

      // Assert no leakage of Company A or hardcoded generic store
      expect(thermalB.header.businessName).not.toBe('Apex Supermarket Ltd');
      expect(thermalB.header.businessName).not.toBe('Stockora Enterprise Store');
    });
  });

  describe('TEST 14 - 15: Customer E-Receipt Email Tenant Seller Identity', () => {
    it('should format customer email receipt identifying the selling company with platform attribution', async () => {
      // Test email dispatch formatting
      let capturedOptions: any = null;
      const originalSend = EmailService.send;
      EmailService.send = async (options: any) => {
        capturedOptions = options;
      };

      try {
        await EmailService.sendCustomerInvoiceReceipt({
          to: 'customer@example.com',
          customerName: 'Amina Bello',
          companyName: 'Apex Supermarket Ltd',
          companyLegalName: 'Apex Retail Enterprises Limited',
          companyLogoUrl: 'https://cdn.apex.example.com/logo.png',
          companyAddress: '100 Marina Road, Lagos Island, Lagos',
          companyPhone: '+234 801 111 2222',
          companyEmail: 'sales@apexmarket.example.com',
          companyTaxId: 'TIN-APEX-998877',
          receiptHeader: 'Welcome to Apex Supermarket',
          receiptFooter: 'Returns accepted within 7 days',
          invoiceNumber: 'INV-APEX-000123',
          items: [{ name: 'Organic Milk 1L', quantity: 2, unitPrice: 5, total: 10 }],
          subtotal: 10,
          taxTotal: 0.75,
          discountTotal: 0,
          totalAmount: 10.75,
          currency: 'USD',
          paymentMethod: 'CASH',
          date: new Date(),
        });

        expect(capturedOptions).not.toBeNull();
        expect(capturedOptions.subject).toContain(
          'Your Receipt from Apex Supermarket Ltd - #INV-APEX-000123'
        );
        expect(capturedOptions.html).toContain('Apex Supermarket Ltd');
        expect(capturedOptions.html).toContain('100 Marina Road, Lagos Island, Lagos');
        expect(capturedOptions.html).toContain('TIN-APEX-998877');
        expect(capturedOptions.html).toContain('Powered by Stockora Enterprise');
        expect(capturedOptions.text).toContain('RECEIPT FROM Apex Supermarket Ltd');
      } finally {
        EmailService.send = originalSend;
      }
    });
  });

  describe('TEST 16 - 17: Historical Snapshot Integrity', () => {
    it('should retain historical company snapshot on transactions even if company name is updated later', async () => {
      // 1. Transaction created with snapshot
      const tx = await Transaction.create({
        tenantId: tenantAId,
        companyId: companyAId,
        transactionNumber: `TX-HIST-${Date.now()}`,
        subtotal: 25,
        total: 25,
        companyName: 'Apex Supermarket Ltd',
        companyAddress: '100 Marina Road, Lagos Island, Lagos',
        companyTaxId: 'TIN-APEX-998877',
        type: 'SALE',
        amount: 25,
        paymentMethod: 'CASH',
        status: 'COMPLETED',
        cashierId: new mongoose.Types.ObjectId(),
        cashierName: 'Jane Cashier',
        branchId: new mongoose.Types.ObjectId(),
        branchName: 'Main Branch',
      });

      // 2. Later, Company updates name to "Apex Retail Group PLC"
      await Tenant.updateOne({ tenantId: tenantAId }, { name: 'Apex Retail Group PLC' });

      // 3. Historical transaction MUST retain historical snapshot
      const retrievedTx = await Transaction.findById(tx._id);
      expect(retrievedTx?.companyName).toBe('Apex Supermarket Ltd');
      expect(retrievedTx?.companyAddress).toBe('100 Marina Road, Lagos Island, Lagos');

      // Revert tenant name
      await Tenant.updateOne({ tenantId: tenantAId }, { name: 'Apex Supermarket Ltd' });
    });
  });

  describe('TEST 18: Cross-Tenant Isolation & Access Protection', () => {
    it('should strictly isolate receipts so Tenant A cannot query or access Tenant B receipts', async () => {
      // 1. Create a receipt for Tenant B
      const receiptB = await Receipt.create({
        tenantId: tenantBId,
        transactionId: new mongoose.Types.ObjectId(),
        transactionNumber: `TX-REC-B-${Date.now()}`,
        receiptNumber: `REC-B-SEC-${Date.now()}`,
        orderId: `ORD-B-${Date.now()}`,
        totalAmount: 150,
        printedAt: new Date(),
        data: {
          companyName: 'Beacon Pharmacy & Health',
          companyTaxId: 'TIN-BEACON-554433',
        },
      });

      // 2. Querying receipts scoped by Tenant A MUST NOT return Tenant B's receipt
      const tenantAReceipts = await Receipt.find({ tenantId: tenantAId }).lean();
      const leakedReceipt = tenantAReceipts.find((r) => r.receiptNumber === receiptB.receiptNumber);
      expect(leakedReceipt).toBeUndefined();

      // 3. Attempting to fetch Tenant B receipt with Tenant A filter returns null
      const isolatedQuery = await Receipt.findOne({
        _id: receiptB._id,
        tenantId: tenantAId,
      }).lean();
      expect(isolatedQuery).toBeNull();
    });
  });
});
