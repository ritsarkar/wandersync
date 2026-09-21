export class BrowserMcpError extends Error {
  public code: string;
  public details?: any;

  constructor(message: string, code = 'BROWSER_MCP_ERROR', details?: any) {
    super(message);
    this.name = 'BrowserMcpError';
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class BridgeConnectionError extends BrowserMcpError {
  constructor(message = 'Browser extension is not connected to local bridge server') {
    super(message, 'BRIDGE_NOT_CONNECTED');
  }
}

export class ElementNotFoundError extends BrowserMcpError {
  constructor(identifier: string) {
    super(`Element matching "${identifier}" was not found on the page or is not interactive`, 'ELEMENT_NOT_FOUND');
  }
}

export class ActionTimeoutError extends BrowserMcpError {
  constructor(action: string, timeoutMs: number) {
    super(`Browser action "${action}" timed out after ${timeoutMs}ms`, 'ACTION_TIMEOUT');
  }
}

export class SecurityPolicyViolationError extends BrowserMcpError {
  constructor(reason: string) {
    super(`Operation rejected by security policy: ${reason}`, 'SECURITY_VIOLATION');
  }
}

export class UserDeniedApprovalError extends BrowserMcpError {
  constructor(action: string) {
    super(`User explicitly denied approval for action: ${action}`, 'USER_DENIED_APPROVAL');
  }
}
