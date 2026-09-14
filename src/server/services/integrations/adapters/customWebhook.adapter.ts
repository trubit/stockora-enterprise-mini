import type { IntegrationAdapter, ConnectionValidationResult } from './types.js';

export class CustomWebhookAdapter implements IntegrationAdapter {
  public readonly provider = 'custom_webhook';
  public readonly name = 'Custom REST / Webhook Gateway';
  public readonly category = 'Custom';
  public readonly description =
    'Connect proprietary internal ERPs, custom inventory hardware, or bespoke microservices via signed webhook payloads.';
  public readonly isOAuthSupported = false;

  public readonly requiredConfigFields = [
    {
      name: 'targetUrl',
      label: 'Target Destination URL',
      type: 'url' as const,
      required: true,
      helperText: 'e.g. https://api.yourcompany.com/v1/stockora-receiver',
    },
    {
      name: 'signingSecret',
      label: 'HMAC Signing Secret',
      type: 'password' as const,
      required: true,
      helperText: 'Secret used to cryptographically sign payloads.',
    },
  ];

  public async validateConnection(
    config: Record<string, any>,
    _credentials?: string
  ): Promise<ConnectionValidationResult> {
    if (!config.targetUrl || !config.targetUrl.startsWith('http')) {
      return {
        success: false,
        message: 'Valid HTTP/HTTPS target URL is required.',
        error: 'VALIDATION_ERROR',
      };
    }

    return {
      success: true,
      message: 'Custom Webhook destination validated successfully.',
      statusCode: 200,
      providerDetails: {
        accountName: config.targetUrl,
      },
    };
  }
}
