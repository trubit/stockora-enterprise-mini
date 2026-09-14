import type {
  IntegrationAdapter,
  ConnectionValidationResult,
  SyncOptions,
  SyncResult,
} from './types.js';

export class QuickBooksAdapter implements IntegrationAdapter {
  public readonly provider = 'quickbooks';
  public readonly name = 'QuickBooks Online';
  public readonly category = 'Accounting';
  public readonly description =
    'Sync invoices, ledger accounts, accounts receivable, and customer master records directly with Intuit QuickBooks.';
  public readonly isOAuthSupported = true;

  public readonly requiredConfigFields = [
    {
      name: 'realmId',
      label: 'QuickBooks Company ID (Realm ID)',
      type: 'text' as const,
      required: true,
      helperText: 'Found in your QuickBooks Online Account Settings > Billing & Subscription.',
    },
    {
      name: 'environment',
      label: 'Target Environment',
      type: 'select' as const,
      options: ['sandbox', 'production'],
      required: true,
    },
  ];

  public async validateConnection(
    config: Record<string, any>,
    credentials?: string
  ): Promise<ConnectionValidationResult> {
    if (!config.realmId) {
      return {
        success: false,
        message: 'Missing QuickBooks Realm ID.',
        error: 'VALIDATION_ERROR',
      };
    }

    if (!credentials && !config.accessToken) {
      return {
        success: false,
        message: 'No OAuth credentials or API access token supplied.',
        error: 'AUTHENTICATION_ERROR',
      };
    }

    // Simulate verified handshake with Intuit API
    return {
      success: true,
      message: 'Successfully established communication with QuickBooks Online.',
      statusCode: 200,
      providerDetails: {
        accountName: `QuickBooks Org (${config.realmId})`,
        organizationId: config.realmId,
        environment: config.environment || 'sandbox',
      },
    };
  }

  public async sync(
    _config: Record<string, any>,
    _credentials: string | undefined,
    options: SyncOptions
  ): Promise<SyncResult> {
    const start = Date.now();
    const entitiesSynced: Record<string, { pushed: number; pulled: number; failed: number }> = {};

    for (const entity of options.entities) {
      entitiesSynced[entity] = {
        pushed: Math.floor(Math.random() * 8) + 1,
        pulled: Math.floor(Math.random() * 5),
        failed: 0,
      };
    }

    return {
      success: true,
      entitiesSynced,
      durationMs: Date.now() - start,
    };
  }
}
