import type { IntegrationAdapter } from './adapters/types.js';
import { QuickBooksAdapter } from './adapters/quickbooks.adapter.js';
import { XeroAdapter } from './adapters/xero.adapter.js';
import { ShopifyAdapter } from './adapters/shopify.adapter.js';
import { SlackAdapter } from './adapters/slack.adapter.js';
import { ShipStationAdapter } from './adapters/shipstation.adapter.js';
import { CustomWebhookAdapter } from './adapters/customWebhook.adapter.js';

export class AdapterRegistry {
  private static adapters: Map<string, IntegrationAdapter> = new Map();

  static {
    this.register(new QuickBooksAdapter());
    this.register(new XeroAdapter());
    this.register(new ShopifyAdapter());
    this.register(new SlackAdapter());
    this.register(new ShipStationAdapter());
    this.register(new CustomWebhookAdapter());
  }

  public static register(adapter: IntegrationAdapter): void {
    this.adapters.set(adapter.provider.toLowerCase(), adapter);
  }

  public static get(provider: string): IntegrationAdapter | undefined {
    return this.adapters.get(provider.toLowerCase());
  }

  public static getAll(): IntegrationAdapter[] {
    return Array.from(this.adapters.values());
  }

  public static getAvailableCatalog(): Array<{
    provider: string;
    name: string;
    category: string;
    description: string;
    isOAuthSupported: boolean;
    requiredConfigFields: any[];
  }> {
    return this.getAll().map((a) => ({
      provider: a.provider,
      name: a.name,
      category: a.category,
      description: a.description,
      isOAuthSupported: a.isOAuthSupported,
      requiredConfigFields: a.requiredConfigFields,
    }));
  }
}
