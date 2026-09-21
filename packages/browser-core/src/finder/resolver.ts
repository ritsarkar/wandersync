export interface ResolveElementOptions {
  ref?: string;
  selector?: string;
  text?: string;
  doc?: Document;
}

/**
 * Locate a target element using ref identifier, CSS selector, or text matching
 */
export function findElement(options: ResolveElementOptions): HTMLElement | null {
  const doc = options.doc || document;

  // 1. Ref identifier lookup (e.g. '@e5' or 'e5')
  if (options.ref) {
    const cleanRef = options.ref.startsWith('@') ? options.ref.substring(1) : options.ref;
    const el = doc.querySelector(`[data-mcp-ref="${cleanRef}"]`);
    if (el instanceof HTMLElement) {
      return el;
    }
  }

  // 2. CSS selector lookup
  if (options.selector) {
    try {
      const el = doc.querySelector(options.selector);
      if (el instanceof HTMLElement) {
        return el;
      }
    } catch {
      // Invalid selector syntax, proceed to text search fallback
    }
  }

  // 3. Visible text search lookup
  if (options.text) {
    const searchText = options.text.trim().toLowerCase();

    // Priority to interactive buttons and links
    const candidates = Array.from(doc.querySelectorAll('button, a, input[type="button"], input[type="submit"], [role="button"]'));
    for (const cand of candidates) {
      if (cand instanceof HTMLElement) {
        const text = (cand.innerText || cand.getAttribute('value') || cand.getAttribute('aria-label') || '').toLowerCase();
        if (text.includes(searchText)) {
          return cand;
        }
      }
    }

    // Secondary search: any element containing text
    const allElements = Array.from(doc.body.querySelectorAll('*'));
    for (const el of allElements) {
      if (el instanceof HTMLElement && el.children.length === 0) {
        const text = (el.innerText || el.textContent || '').trim().toLowerCase();
        if (text === searchText || text.includes(searchText)) {
          return el;
        }
      }
    }
  }

  return null;
}
