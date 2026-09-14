import mongoose from 'mongoose';
import { logger } from '../logger.js';
import { config } from '../../config/environment.js';
import { ResilientExecutor } from '../utils/resiliency/index.js';

export class DBConnectionManager {
  private static instance: DBConnectionManager | null = null;
  private isShuttingDown = false;

  private constructor() {
    this.setupListeners();
  }

  public static getInstance(): DBConnectionManager {
    if (!DBConnectionManager.instance) {
      DBConnectionManager.instance = new DBConnectionManager();
    }
    return DBConnectionManager.instance;
  }

  public async connect(): Promise<void> {
    if (mongoose.connection.readyState >= 1) return;

    try {
      mongoose.set('strictQuery', true);

      const options = {
        maxPoolSize: 200,
        minPoolSize: 20,
        maxIdleTimeMS: 30000,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
        autoIndex: !config.isProduction,
      };

      await ResilientExecutor.execute(
        {
          name: 'MongoDB',
          retryCount: 5,
          baseDelayMs: 200,
          maxDelayMs: 2000,
          backoffType: 'EXPONENTIAL',
          jitterType: 'FULL',
          isIdempotent: true,
        },
        async () => {
          await mongoose.connect(config.mongodbUri, options);
        }
      );

      if ((config.isTest || process.env.VITEST) && mongoose.connection.name === 'stockora') {
        logger.error(
          'CRITICAL: Test runner connected to development database "stockora". Aborting.'
        );
        await mongoose.connection.close();
        throw new Error(
          'FATAL: Attempted to run test suite against development database "stockora". Tests must connect to stockora_test.'
        );
      }

      logger.info(`MongoDB Connected successfully: ${mongoose.connection.host}`);
    } catch (err) {
      logger.error('Failed to establish MongoDB database pool:', err);
      throw err;
    }
  }

  private setupListeners(): void {
    mongoose.connection.on('disconnected', () => {
      if (!this.isShuttingDown) {
        logger.warn('MongoDB connection lost. Reconnecting...');
      }
    });

    mongoose.connection.on('error', (err) => {
      logger.error('MongoDB pool internal error:', err);
    });
  }

  public async disconnect(): Promise<void> {
    this.isShuttingDown = true;
    if (mongoose.connection.readyState === 0) return;

    try {
      await mongoose.connection.close();
      logger.info('MongoDB database pool disconnected cleanly.');
    } catch (err) {
      logger.error('Error closing MongoDB connection:', err);
    }
  }
}
