# BrowserMCP Security Architecture & Threat Model

## 1. Threat Landscape & Design Mitigations

### 1.1 Local Bridge Protection
- **Threat**: Malicious local processes or websites trying to hijack the browser control socket.
- **Mitigation**:
  1. Origin Verification: The WebSocket server only accepts requests with valid `chrome-extension://` origins or local loopback.
  2. Cryptographic Pairing Tokens: During handshake, the extension must submit the pairing token created by the MCP server at `~/.browser-mcp/token.json`. Connections lacking this token are immediately rejected.
  3. Constant-time comparison (`timingSafeEqual`) is used to prevent side-channel timing attacks.

### 1.2 Sensitive Domain Safeguards
- **Threat**: AI models attempting to perform unauthorized actions on banking, cryptocurrency, or identity provider websites.
- **Mitigation**:
  1. Built-in Blocklist: Default blocks on known sensitive financial and authentication domains (`paypal.com`, `chase.com`, `accounts.google.com`, etc.).
  2. Domain Matching Engine: Configurable allowlists and blocklists with wildcard support.
  3. Action Risk Categorization: Write operations (`TYPE`, `CLICK` on submit, `CLOSE_TAB`, `EVALUATE`) trigger the in-page approval dialog unless explicitly permitted.

### 1.3 PII and Credential Leakage Protection
- **Threat**: Sensitive user information (credit card numbers, passwords, private keys, JWTs) leaking into the LLM context window.
- **Mitigation**:
  1. In-memory DOM Sanitization: `DataSanitizer` scans snapshots and redacts:
     - `input[type="password"]` values
     - Credit card numbers matching 16-digit PAN format
     - Social Security Numbers
     - Bearer tokens, JWT headers, and private keys
  2. Values are replaced with tags such as `[REDACTED_PASSWORD]` and `[REDACTED_CREDIT_CARD]` before transmission to the AI client.

### 1.4 User Consent & Visual HUD
- **Threat**: AI actions executing silently without user awareness.
- **Mitigation**:
  1. Persistent In-page HUD: Floating pill badge appears on the active tab showing current AI actions ("AI Reading Page...", "AI Clicking @e2...").
  2. High-Risk Modal: In `STRICT` mode or when executing high-risk actions, a modal overlay requires explicit user confirmation before the action proceeds.
