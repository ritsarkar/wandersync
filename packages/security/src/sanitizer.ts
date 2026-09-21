import type { BrowserElementNode, DOMSnapshot } from '@browser-mcp/protocol';

// Patterns for sensitive data
const CREDIT_CARD_REGEX = /\b(?:\d{4}[ -]?){3}\d{4}\b/g;
const SSN_REGEX = /\b\d{3}-\d{2}-\d{4}\b/g;
const JWT_REGEX = /\beyJ[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+\.?[A-Za-z0-9-_.+/=]*\b/g;
const API_KEY_REGEX = /(?:api[_-]?key|secret|token|auth[_-]?token)["']?\s*[:=]\s*["']?([A-Za-z0-9_\-]{16,})["']?/gi;
const PRIVATE_KEY_REGEX = /-----BEGIN [A-Z ]+PRIVATE KEY-----[\s\S]*?-----END [A-Z ]+PRIVATE KEY-----/g;

export class DataSanitizer {
  /**
   * Redact sensitive strings from raw text
   */
  public static sanitizeText(text: string): string {
    if (!text || typeof text !== 'string') return '';
    return text
      .replace(PRIVATE_KEY_REGEX, '[REDACTED_PRIVATE_KEY]')
      .replace(JWT_REGEX, '[REDACTED_JWT]')
      .replace(CREDIT_CARD_REGEX, '[REDACTED_CREDIT_CARD]')
      .replace(SSN_REGEX, '[REDACTED_SSN]')
      .replace(API_KEY_REGEX, (match, p1) => match.replace(p1, '[REDACTED_KEY]'));
  }

  /**
   * Sanitize an interactive element node
   */
  public static sanitizeElement(node: BrowserElementNode): BrowserElementNode {
    const isPassword =
      node.type?.toLowerCase() === 'password' ||
      node.placeholder?.toLowerCase().includes('password') ||
      node.ariaLabel?.toLowerCase().includes('password') ||
      node.text?.toLowerCase().includes('password');

    return {
      ...node,
      value: isPassword && node.value ? '[REDACTED_PASSWORD]' : node.value ? this.sanitizeText(node.value) : undefined,
      text: node.text ? this.sanitizeText(node.text) : undefined,
      placeholder: node.placeholder ? this.sanitizeText(node.placeholder) : undefined,
      ariaLabel: node.ariaLabel ? this.sanitizeText(node.ariaLabel) : undefined
    };
  }

  /**
   * Sanitize an entire DOM snapshot
   */
  public static sanitizeSnapshot(snapshot: DOMSnapshot): DOMSnapshot {
    return {
      ...snapshot,
      interactiveElements: snapshot.interactiveElements.map(el => this.sanitizeElement(el)),
      formattedTree: this.sanitizeText(snapshot.formattedTree),
      readableText: snapshot.readableText ? this.sanitizeText(snapshot.readableText) : undefined
    };
  }
}
