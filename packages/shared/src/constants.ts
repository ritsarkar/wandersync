export const DEFAULT_BRIDGE_PORT = 19999;
export const DEFAULT_BRIDGE_HOST = '127.0.0.1';
export const DEFAULT_BRIDGE_WS_URL = `ws://${DEFAULT_BRIDGE_HOST}:${DEFAULT_BRIDGE_PORT}`;

export const DEFAULT_ACTION_TIMEOUT_MS = 15000;
export const DEFAULT_NAVIGATION_TIMEOUT_MS = 30000;
export const DEFAULT_WAIT_TIMEOUT_MS = 10000;

export const EXTENSION_STORAGE_KEYS = {
  AUTH_TOKEN: 'bmcp_auth_token',
  BRIDGE_PORT: 'bmcp_bridge_port',
  SECURITY_MODE: 'bmcp_security_mode',
  DOMAIN_ALLOWLIST: 'bmcp_domain_allowlist',
  DOMAIN_BLOCKLIST: 'bmcp_domain_blocklist',
  ACTION_LOGS: 'bmcp_action_logs',
  HIGHLIGHT_ENABLED: 'bmcp_highlight_enabled',
  REDACTION_ENABLED: 'bmcp_redaction_enabled'
} as const;

export const SENSITIVE_DOMAINS_DEFAULT = [
  'paypal.com',
  'chase.com',
  'bankofamerica.com',
  'wellsfargo.com',
  'fidelity.com',
  'coinbase.com',
  'binance.com',
  'accounts.google.com',
  'login.live.com',
  'appleid.apple.com'
];
