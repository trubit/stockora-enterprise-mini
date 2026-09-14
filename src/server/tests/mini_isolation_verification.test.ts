import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import express, { type Express } from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { apiRouter } from '../routes/api.js';
import { errorHandler } from '../errors/handlers.js';
import { DBConnectionManager } from '../database/connection.js';
import { User } from '../models/User.js';
import { config } from '../../config/environment.js';
import { redisManager } from '../database/redis.js';

describe('Stockora Enterprise Mini — Complete Isolation & Auth Verification', () => {
  const dbManager = DBConnectionManager.getInstance();
  const testEmail = `mini_verify_${Date.now()}@stockoramini.test`;
  let miniToken: string;
  let app: Express;

  beforeAll(async () => {
    await dbManager.connect();
    app = express();
    app.use(express.json());
    app.use('/api/v1', apiRouter);
    app.use('/api', apiRouter);
    app.use(errorHandler);

    // Clean up test user if exists
    await User.deleteOne({ email: testEmail });
  });

  afterAll(async () => {
    await User.deleteOne({ email: testEmail });
    await dbManager.disconnect();
    await redisManager.disconnect();
  });

  it('1. Registration: Successfully registers a fresh account on stockora_mini_database without "already exists" conflict', async () => {
    const res = await request(app).post('/api/v1/auth/register').send({
      username: 'mini_operator',
      email: testEmail,
      password: 'Password123!@#',
      roleName: 'Company Owner',
      companyName: 'Mini Logistics Hub',
    });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.email).toBe(testEmail);

    // Verify user exists in database and is marked active or pending verification
    const createdUser = await User.findOne({ email: testEmail });
    expect(createdUser).toBeDefined();
    expect(createdUser?.email).toBe(testEmail);

    // For test convenience, mark user verified so we can test login
    if (createdUser) {
      createdUser.isEmailVerified = true;
      await createdUser.save();
    }
  });

  it('2. Duplicate Registration: Correctly rejects duplicate registration with 409 Conflict', async () => {
    const res = await request(app).post('/api/v1/auth/register').send({
      username: 'mini_operator',
      email: testEmail,
      password: 'Password123!@#',
      roleName: 'Company Owner',
      companyName: 'Mini Logistics Hub',
    });

    expect(res.status).toBe(409);
    expect(res.body.error?.message || res.body.message).toMatch(/already registered/i);
  });

  it('3. Login & Token Claims: Returns JWT with issuer and audience strictly set to "stockora-enterprise-mini"', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({
      email: testEmail,
      password: 'Password123!@#',
    });

    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeDefined();
    miniToken = res.body.accessToken;

    // Decode and verify claims
    const decoded = jwt.decode(miniToken) as any;
    expect(decoded).toBeDefined();
    expect(decoded.iss).toBe('stockora-enterprise-mini');
    expect(decoded.aud).toBe('stockora-enterprise-mini');
    expect(decoded.email).toBe(testEmail);
  });

  it('4. Authenticated Route: Accepts valid Mini token on /api/v1/auth/me', async () => {
    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${miniToken}`);

    expect(res.status).toBe(200);
    expect(res.body.email).toBe(testEmail);
  });

  it('5. Cross-Project Isolation: Rejects tokens issued by Stockora Enterprise Pro (issuer mismatch)', async () => {
    // Generate an illegitimate foreign token issued by "stockora-enterprise-pro"
    const proForeignToken = jwt.sign(
      {
        id: 'foreign_user_123',
        email: 'attacker@pro.test',
        roleName: 'Super Administrator',
        isPlatformAdmin: true,
      },
      config.jwtSecret,
      {
        issuer: 'stockora-enterprise-pro', // FOREIGN ISSUER
        audience: 'stockora-enterprise-pro',
        expiresIn: '1h',
      }
    );

    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${proForeignToken}`);

    // Must be rejected as unauthorized
    expect(res.status).toBe(401);
  });

  it('6. Cross-Project Isolation: Rejects tokens without explicit mini issuer claim', async () => {
    const genericToken = jwt.sign(
      {
        id: 'generic_user_123',
        email: 'generic@test.com',
        roleName: 'Company Owner',
      },
      config.jwtSecret,
      {
        expiresIn: '1h',
      }
    );

    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${genericToken}`);

    expect(res.status).toBe(401);
  });

  it('7. Redis Namespace Isolation: Client is configured with "mini:" key prefix', async () => {
    const redis = redisManager.getClient();
    const opts = (redis as any).options;
    expect(opts.keyPrefix).toBe('mini:');
  });
});
