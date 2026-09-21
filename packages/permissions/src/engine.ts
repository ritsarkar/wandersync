import { BrowserAction } from '@browser-mcp/protocol';
import { extractHostname, SENSITIVE_DOMAINS_DEFAULT } from '@browser-mcp/shared';
import {
  ActionRiskLevel,
  ACTION_RISK_MAP,
  PermissionDecision,
  SecurityMode,
  SecurityPolicyConfig
} from './types.js';
import { isDomainInList } from './matcher.js';

export class PermissionEngine {
  private config: SecurityPolicyConfig;

  constructor(customConfig?: Partial<SecurityPolicyConfig>) {
    this.config = {
      mode: customConfig?.mode ?? SecurityMode.MODERATE,
      allowlist: customConfig?.allowlist ?? [],
      blocklist: customConfig?.blocklist ?? [...SENSITIVE_DOMAINS_DEFAULT],
      requireApprovalForHighRisk: customConfig?.requireApprovalForHighRisk ?? true
    };
  }

  public updateConfig(updates: Partial<SecurityPolicyConfig>): void {
    this.config = { ...this.config, ...updates };
  }

  public getConfig(): SecurityPolicyConfig {
    return { ...this.config };
  }

  /**
   * Evaluate permission for executing an action on a given page URL
   */
  public evaluate(action: BrowserAction, url?: string, _params?: Record<string, any>): PermissionDecision {
    const riskLevel = ACTION_RISK_MAP[action] ?? ActionRiskLevel.INTERACTIVE;
    const hostname = url ? extractHostname(url) : '';

    // 1. Check blocked domains
    if (hostname && isDomainInList(hostname, this.config.blocklist)) {
      return {
        decision: 'BLOCK',
        reason: `Access to domain "${hostname}" is blocked by security policy`,
        riskLevel
      };
    }

    // 2. Critical risk actions (evaluate) always require explicit approval unless in unrestricted mode
    if (riskLevel === ActionRiskLevel.CRITICAL) {
      if (this.config.mode !== SecurityMode.UNRESTRICTED) {
        return {
          decision: 'REQUIRE_APPROVAL',
          reason: `Action "${action}" executes arbitrary code and requires approval`,
          riskLevel
        };
      }
    }

    // 3. Strict mode requires approval for all interactive and high-risk actions
    if (this.config.mode === SecurityMode.STRICT) {
      if (riskLevel !== ActionRiskLevel.READ_ONLY) {
        return {
          decision: 'REQUIRE_APPROVAL',
          reason: `Strict security mode requires approval for interactive action "${action}"`,
          riskLevel
        };
      }
    }

    // 4. Moderate mode requires approval for HIGH_RISK actions
    if (this.config.mode === SecurityMode.MODERATE) {
      if (riskLevel === ActionRiskLevel.HIGH_RISK && this.config.requireApprovalForHighRisk) {
        // If domain is explicitly allowlisted, we can allow it
        if (hostname && this.config.allowlist.length > 0 && isDomainInList(hostname, this.config.allowlist)) {
          return {
            decision: 'ALLOW',
            reason: `Domain "${hostname}" is explicitly allowlisted`,
            riskLevel
          };
        }

        return {
          decision: 'REQUIRE_APPROVAL',
          reason: `High risk action "${action}" requires user approval`,
          riskLevel
        };
      }
    }

    return {
      decision: 'ALLOW',
      reason: 'Action permitted by current security policy',
      riskLevel
    };
  }
}
