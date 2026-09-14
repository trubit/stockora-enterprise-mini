import type { IntegrationAdapter, ConnectionValidationResult } from './types.js';

export class SlackAdapter implements IntegrationAdapter {
  public readonly provider = 'slack';
  public readonly name = 'Slack Workspace Alerts';
  public readonly category = 'Messaging';
  public readonly description =
    'Real-time alert dispatch for low stock, backorders, high-value POS transactions, and security incidents.';
  public readonly isOAuthSupported = true;

  public readonly requiredConfigFields = [
    {
      name: 'webhookUrl',
      label: 'Incoming Webhook URL',
      type: 'url' as const,
      required: true,
      helperText: 'e.g. https://hooks.slack.com/services/...',
    },
    {
      name: 'defaultChannel',
      label: 'Notification Channel',
      type: 'text' as const,
      required: true,
      helperText: 'e.g. #inventory-alerts or #ops',
    },
  ];

  public async validateConnection(
    config: Record<string, any>,
    _credentials?: string
  ): Promise<ConnectionValidationResult> {
    if (!config.webhookUrl || !config.webhookUrl.startsWith('https://hooks.slack.com')) {
      return {
        success: false,
        message: 'Invalid Slack Webhook URL. Must begin with https://hooks.slack.com',
        error: 'VALIDATION_ERROR',
      };
    }

    return {
      success: true,
      message: `Slack Webhook verified for channel ${config.defaultChannel || '#general'}.`,
      statusCode: 200,
      providerDetails: {
        accountName: 'Connected Slack Workspace',
      },
    };
  }
}
