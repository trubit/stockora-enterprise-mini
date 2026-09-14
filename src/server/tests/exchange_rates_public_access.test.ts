import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import express, { type Express } from 'express';
import request from 'supertest';
import { apiRouter } from '../routes/api.js';
import { errorHandler } from '../errors/handlers.js';
import { DBConnectionManager } from '../database/connection.js';
import { redisManager } from '../database/redis.js';

describe('Stockora Enterprise Mini — Exchange Rates Public Access & 401 Elimination', () => {
  const dbManager = DBConnectionManager.getInstance();
  let app: Express;

  beforeAll(async () => {
    await dbManager.connect();
    app = express();
    app.use(express.json());
    app.use('/api/v1', apiRouter);
    app.use(errorHandler);
  });

  afterAll(async () => {
    await dbManager.disconnect();
    await redisManager.disconnect();
  });

  it('1. GET /api/v1/exchange-rates?base=USD succeeds with 200 OK without authentication token', async () => {
    const res = await request(app).get('/api/v1/exchange-rates?base=USD').expect(200);

    expect(res.body).toBeDefined();
    expect(res.body.baseCurrency).toBe('USD');
    expect(res.body.rates).toBeDefined();
    expect(res.body.rates.NGN).toBeGreaterThan(0);
  });

  it('2. GET /api/v1/exchange-rates?base=NGN succeeds with 200 OK without authentication token', async () => {
    const res = await request(app).get('/api/v1/exchange-rates?base=NGN').expect(200);

    expect(res.body).toBeDefined();
    expect(res.body.baseCurrency).toBe('NGN');
    expect(res.body.rates).toBeDefined();
    expect(res.body.rates.USD).toBeGreaterThan(0);
  });

  it('3. GET /api/v1/currencies and GET /api/v1/countries succeed with 200 OK without token', async () => {
    const currRes = await request(app).get('/api/v1/currencies').expect(200);
    expect(Array.isArray(currRes.body) || typeof currRes.body === 'object').toBe(true);

    const countryRes = await request(app).get('/api/v1/countries').expect(200);
    expect(Array.isArray(countryRes.body) || typeof countryRes.body === 'object').toBe(true);
  });

  it('4. POST /api/v1/exchange-rates/convert succeeds with 200 OK without token', async () => {
    const res = await request(app)
      .post('/api/v1/exchange-rates/convert')
      .send({
        amount: 100,
        fromCurrency: 'USD',
        toCurrency: 'NGN',
      })
      .expect(200);

    expect(res.body).toBeDefined();
    expect(res.body.convertedAmount).toBeGreaterThan(0);
  });

  it('5. PATCH /api/v1/regional-settings strictly rejects unauthenticated calls with 401 Unauthorized', async () => {
    const res = await request(app).patch('/api/v1/regional-settings').send({ currency: 'EUR' });

    expect(res.status).toBe(401);
  });

  it('6. POST /api/v1/exchange-rates/custom strictly rejects unauthenticated calls with 401 Unauthorized', async () => {
    const res = await request(app)
      .post('/api/v1/exchange-rates/custom')
      .send({ targetCurrency: 'EUR', rate: 0.95 });

    expect(res.status).toBe(401);
  });
});
