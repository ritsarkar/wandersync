import { BrowserAction } from '@browser-mcp/protocol';

export enum ActionRiskLevel {
  READ_ONLY = 'READ_ONLY',
  INTERACTIVE = 'INTERACTIVE',
  HIGH_RISK = 'HIGH_RISK',
  CRITICAL = 'CRITICAL'
}

export enum SecurityMode {
  STRICT = 'STRICT',           // Prompts approval for all interactive & high-risk actions
  MODERATE = 'MODERATE',       // Prompts only for high-risk / sensitive domain actions
  UNRESTRICTED = 'UNRESTRICTED' // Auto-approves actions except blocked domains
}

export type PermissionDecisionType = 'ALLOW' | 'REQUIRE_APPROVAL' | 'BLOCK';

export interface PermissionDecision {
  decision: PermissionDecisionType;
  reason: string;
  riskLevel: ActionRiskLevel;
}

export interface SecurityPolicyConfig {
  mode: SecurityMode;
  allowlist: string[];
  blocklist: string[];
  requireApprovalForHighRisk: boolean;
}

export const ACTION_RISK_MAP: Record<BrowserAction, ActionRiskLevel> = {
  [BrowserAction.GET_DOM]: ActionRiskLevel.READ_ONLY,
  [BrowserAction.GET_TEXT]: ActionRiskLevel.READ_ONLY,
  [BrowserAction.SCREENSHOT]: ActionRiskLevel.READ_ONLY,
  [BrowserAction.LIST_TABS]: ActionRiskLevel.READ_ONLY,
  [BrowserAction.GET_STATUS]: ActionRiskLevel.READ_ONLY,
  [BrowserAction.WAIT_FOR]: ActionRiskLevel.READ_ONLY,
  [BrowserAction.HIGHLIGHT]: ActionRiskLevel.READ_ONLY,

  [BrowserAction.SCROLL]: ActionRiskLevel.INTERACTIVE,
  [BrowserAction.SWITCH_TAB]: ActionRiskLevel.INTERACTIVE,
  [BrowserAction.NEW_TAB]: ActionRiskLevel.INTERACTIVE,
  [BrowserAction.NAVIGATE]: ActionRiskLevel.INTERACTIVE,
  [BrowserAction.CLICK]: ActionRiskLevel.INTERACTIVE,
  [BrowserAction.PRESS_KEY]: ActionRiskLevel.INTERACTIVE,

  [BrowserAction.TYPE]: ActionRiskLevel.HIGH_RISK,
  [BrowserAction.CLOSE_TAB]: ActionRiskLevel.HIGH_RISK,

  [BrowserAction.EVALUATE]: ActionRiskLevel.CRITICAL
};
