import { EXTENSION_STORAGE_KEYS, SENSITIVE_DOMAINS_DEFAULT } from '@browser-mcp/shared';
import { SecurityMode, SecurityPolicyConfig } from '@browser-mcp/permissions';

export class ExtensionPermissionManager {
  public static async getConfig(): Promise<SecurityPolicyConfig> {
    const data = await chrome.storage.local.get([
      EXTENSION_STORAGE_KEYS.SECURITY_MODE,
      EXTENSION_STORAGE_KEYS.DOMAIN_ALLOWLIST,
      EXTENSION_STORAGE_KEYS.DOMAIN_BLOCKLIST
    ]);

    return {
      mode: data[EXTENSION_STORAGE_KEYS.SECURITY_MODE] || SecurityMode.MODERATE,
      allowlist: data[EXTENSION_STORAGE_KEYS.DOMAIN_ALLOWLIST] || [],
      blocklist: data[EXTENSION_STORAGE_KEYS.DOMAIN_BLOCKLIST] || [...SENSITIVE_DOMAINS_DEFAULT],
      requireApprovalForHighRisk: true
    };
  }

  public static async setSecurityMode(mode: SecurityMode): Promise<void> {
    await chrome.storage.local.set({ [EXTENSION_STORAGE_KEYS.SECURITY_MODE]: mode });
  }

  public static async addAllowlistDomain(domain: string): Promise<void> {
    const config = await this.getConfig();
    if (!config.allowlist.includes(domain)) {
      config.allowlist.push(domain);
      await chrome.storage.local.set({ [EXTENSION_STORAGE_KEYS.DOMAIN_ALLOWLIST]: config.allowlist });
    }
  }

  public static async addBlocklistDomain(domain: string): Promise<void> {
    const config = await this.getConfig();
    if (!config.blocklist.includes(domain)) {
      config.blocklist.push(domain);
      await chrome.storage.local.set({ [EXTENSION_STORAGE_KEYS.DOMAIN_BLOCKLIST]: config.blocklist });
    }
  }

  public static async getAuthToken(): Promise<string> {
    const data = await chrome.storage.local.get([EXTENSION_STORAGE_KEYS.AUTH_TOKEN]);
    return data[EXTENSION_STORAGE_KEYS.AUTH_TOKEN] || '';
  }

  public static async setAuthToken(token: string): Promise<void> {
    await chrome.storage.local.set({ [EXTENSION_STORAGE_KEYS.AUTH_TOKEN]: token });
  }

  public static async getBridgePort(): Promise<number> {
    const data = await chrome.storage.local.get([EXTENSION_STORAGE_KEYS.BRIDGE_PORT]);
    return data[EXTENSION_STORAGE_KEYS.BRIDGE_PORT] || 19999;
  }

  public static async setBridgePort(port: number): Promise<void> {
    await chrome.storage.local.set({ [EXTENSION_STORAGE_KEYS.BRIDGE_PORT]: port });
  }
}
