/**
 * Stockora Enterprise Mini - Isolated Client Storage Keys
 * Prevents session/token collisions with Stockora Enterprise Pro across ports and domains.
 */
export const STORAGE_KEYS = {
  TOKEN: 'stockora_mini_token',
  REFRESH_TOKEN: 'stockora_mini_refresh_token',
  USER: 'stockora_mini_user',
  ACTIVE_TENANT_ID: 'stockora_mini_active_tenant_id',
  ACTIVE_TENANT_SLUG: 'stockora_mini_active_tenant_slug',
  DISPLAY_CURRENCY: 'stockora_mini_display_currency',
  LANGUAGE: 'stockora_mini_language',
  OFFLINE_DB: 'stockora_mini_offline',
} as const;
