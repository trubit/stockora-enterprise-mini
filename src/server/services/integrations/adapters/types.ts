import type { IntegrationCategory } from '../../../models/Integration.js';

export interface ConnectionValidationResult {
  success: boolean;
  message: string;
  statusCode?: number;
  providerDetails?: {
    accountName?: string;
    organizationId?: string;
    environment?: 'sandbox' | 'production';
    rateLimitRemaining?: number;
  };
  error?: string;
}

export interface SyncOptions {
  tenantId: string;
  entities: string[];
  since?: Date;
  fullSync?: boolean;
}

export interface SyncResult {
  success: boolean;
  entitiesSynced: Record<string, { pushed: number; pulled: number; failed: number }>;
  errors?: string[];
  durationMs: number;
}

export interface IntegrationAdapter {
  readonly provider: string;
  readonly name: string;
  readonly category: IntegrationCategory;
  readonly description: string;
  readonly requiredConfigFields: Array<{
    name: string;
    label: string;
    type: 'text' | 'password' | 'select' | 'url';
    options?: string[];
    required: boolean;
    helperText?: string;
  }>;
  readonly isOAuthSupported: boolean;

  validateConnection(
    config: Record<string, any>,
    credentials?: string
  ): Promise<ConnectionValidationResult>;

  sync?(
    config: Record<string, any>,
    credentials: string | undefined,
    options: SyncOptions
  ): Promise<SyncResult>;

  handleWebhook?(
    headers: Record<string, string>,
    payload: any,
    credentials?: string
  ): Promise<{ handled: boolean; eventType?: string; actionTaken?: string }>;
}
