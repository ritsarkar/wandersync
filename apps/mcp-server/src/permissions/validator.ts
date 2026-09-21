import { PermissionEngine, SecurityMode } from '@browser-mcp/permissions';
import { BrowserAction } from '@browser-mcp/protocol';
import { SecurityPolicyViolationError } from '@browser-mcp/shared';

export class ServerPermissionValidator {
  private engine: PermissionEngine;

  constructor() {
    const mode = (process.env.BROWSER_MCP_SECURITY_MODE as SecurityMode) || SecurityMode.MODERATE;
    this.engine = new PermissionEngine({ mode });
  }

  public getEngine(): PermissionEngine {
    return this.engine;
  }

  public validateOrThrow(action: BrowserAction, url?: string, params?: Record<string, any>): void {
    const decision = this.engine.evaluate(action, url, params);
    if (decision.decision === 'BLOCK') {
      throw new SecurityPolicyViolationError(decision.reason);
    }
  }
}
