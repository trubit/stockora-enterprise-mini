import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import mongoose from 'mongoose';
import { Company } from '../models/Company.js';
import { Branch } from '../models/Branch.js';
import { Warehouse } from '../models/Warehouse.js';
import { MasterData } from '../models/MasterData.js';

describe('Organization & Tenancy Records', () => {
  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect('mongodb://127.0.0.1:27017/stockora_test_org');
    }
    await Company.deleteMany({});
    await Branch.deleteMany({});
    await Warehouse.deleteMany({});
    await MasterData.deleteMany({});
  });

  afterAll(async () => {
    await Company.deleteMany({});
    await Branch.deleteMany({});
    await Warehouse.deleteMany({});
    await MasterData.deleteMany({});
    await mongoose.connection.close();
  });

  it('should initialize company profiles', async () => {
    const company = await Company.create({
      name: 'Stockora Test Tenancy',
      currency: 'USD',
      timeZone: 'UTC',
    });
    expect(company.name).toBe('Stockora Test Tenancy');
    expect(company.currency).toBe('USD');
  });

  it('should register branch locations', async () => {
    const company = await Company.findOne();
    const branch = await Branch.create({
      companyId: company!._id,
      name: 'Stockora Branch London',
      code: 'LON-01',
    });
    expect(branch.name).toBe('Stockora Branch London');
    expect(branch.code).toBe('LON-01');
  });

  it('should list master data records under indexes', async () => {
    const md = await MasterData.create({
      type: 'CATEGORY',
      name: 'Fresh Fruits',
      code: 'CAT-FRUIT',
    });
    expect(md.name).toBe('Fresh Fruits');
    expect(md.type).toBe('CATEGORY');
  });
});
