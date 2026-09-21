import type { BrowserElementNode, DOMSnapshot } from '@browser-mcp/protocol';

export interface SerializationOptions {
  maxElements?: number;
  highlightInteractive?: boolean;
  includeTextContent?: boolean;
}

/**
 * Check if a DOM element is visible in the viewport or rendered layout
 */
export function isElementVisible(el: Element): boolean {
  if (!(el instanceof HTMLElement || el instanceof SVGElement)) return false;
  if (el instanceof HTMLElement) {
    if (el.offsetWidth === 0 && el.offsetHeight === 0 && !el.getClientRects().length) {
      return false;
    }
  } else if (!el.getClientRects().length) {
    return false;
  }
  const style = window.getComputedStyle(el);
  if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
    return false;
  }
  return true;
}

/**
 * Check if an element is inherently interactive or clickable
 */
export function isInteractiveElement(el: Element): boolean {
  if (!isElementVisible(el)) return false;

  const tagName = el.tagName.toLowerCase();
  if (['a', 'button', 'input', 'select', 'textarea', 'option'].includes(tagName)) {
    return true;
  }

  const role = el.getAttribute('role')?.toLowerCase();
  if (role && ['button', 'link', 'checkbox', 'radio', 'combobox', 'menuitem', 'tab', 'switch', 'textbox'].includes(role)) {
    return true;
  }

  if (el.hasAttribute('onclick') || el.getAttribute('tabindex') === '0' || el.getAttribute('contenteditable') === 'true') {
    return true;
  }

  const style = window.getComputedStyle(el);
  if (style.cursor === 'pointer') {
    return true;
  }

  return false;
}

/**
 * Extract clean accessibility text for an element
 */
export function getElementAccessibleName(el: Element): string {
  const ariaLabel = el.getAttribute('aria-label');
  if (ariaLabel) return ariaLabel.trim();

  const labelledBy = el.getAttribute('aria-labelledby');
  if (labelledBy) {
    const labelEl = document.getElementById(labelledBy);
    if (labelEl && labelEl.textContent) return labelEl.textContent.trim();
  }

  if (el instanceof HTMLInputElement) {
    if (el.placeholder) return el.placeholder.trim();
    if (el.value && el.type !== 'password') return el.value.trim();
  }

  const innerText = (el as HTMLElement).innerText || el.textContent || '';
  return innerText.replace(/\s+/g, ' ').trim();
}

/**
 * Serialize document into a compact, token-efficient DOM Snapshot
 */
export function serializeDOM(doc: Document = document, options: SerializationOptions = {}): DOMSnapshot {
  const maxElements = options.maxElements ?? 150;
  const interactiveNodes: BrowserElementNode[] = [];
  const lines: string[] = [];

  let refCounter = 1;

  // Clear existing mcp refs
  const existingRefs = doc.querySelectorAll('[data-mcp-ref]');
  existingRefs.forEach(el => el.removeAttribute('data-mcp-ref'));

  // Walk through document body
  const walker = doc.createTreeWalker(
    doc.body,
    NodeFilter.SHOW_ELEMENT,
    {
      acceptNode(node) {
        if (!(node instanceof HTMLElement)) return NodeFilter.FILTER_SKIP;
        const tag = node.tagName.toLowerCase();
        if (['script', 'style', 'noscript', 'svg', 'iframe'].includes(tag)) {
          return NodeFilter.FILTER_REJECT;
        }
        if (!isElementVisible(node)) {
          return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      }
    }
  );

  let currentNode = walker.nextNode() as HTMLElement | null;
  while (currentNode && interactiveNodes.length < maxElements) {
    if (isInteractiveElement(currentNode)) {
      const ref = `@e${refCounter++}`;
      currentNode.setAttribute('data-mcp-ref', ref.substring(1)); // store without '@'

      const rect = currentNode.getBoundingClientRect();
      const tagName = currentNode.tagName.toLowerCase();
      const role = currentNode.getAttribute('role') || undefined;
      const accessibleText = getElementAccessibleName(currentNode);
      const inputType = currentNode instanceof HTMLInputElement ? currentNode.type : undefined;
      const placeholder = currentNode.getAttribute('placeholder') || undefined;
      const href = currentNode.getAttribute('href') || undefined;
      const disabled = (currentNode as any).disabled ?? undefined;
      const checked = (currentNode as any).checked ?? undefined;

      const elementNode: BrowserElementNode = {
        ref,
        tagName,
        role,
        text: accessibleText.slice(0, 100),
        placeholder,
        type: inputType,
        value: currentNode instanceof HTMLInputElement ? currentNode.value : undefined,
        ariaLabel: currentNode.getAttribute('aria-label') || undefined,
        href,
        disabled,
        checked,
        rect: {
          x: Math.round(rect.x),
          y: Math.round(rect.y),
          width: Math.round(rect.width),
          height: Math.round(rect.height)
        }
      };

      interactiveNodes.push(elementNode);

      // Build structured line description
      let desc = `[${ref}] <${tagName}`;
      if (role) desc += ` role="${role}"`;
      if (inputType) desc += ` type="${inputType}"`;
      if (placeholder) desc += ` placeholder="${placeholder}"`;
      if (disabled) desc += ` disabled`;
      if (checked) desc += ` checked`;
      desc += `>`;
      if (accessibleText) desc += ` "${accessibleText.slice(0, 80)}"`;
      if (href) desc += ` -> ${href.slice(0, 60)}`;
      lines.push(desc);
    }
    currentNode = walker.nextNode() as HTMLElement | null;
  }

  // Extract top-level readable body text if requested
  let readableText: string | undefined;
  if (options.includeTextContent) {
    readableText = (doc.body.innerText || '').slice(0, 3000).replace(/\n\s*\n/g, '\n');
  }

  return {
    url: doc.location?.href || '',
    title: doc.title || '',
    elementCount: interactiveNodes.length,
    interactiveElements: interactiveNodes,
    formattedTree: lines.join('\n'),
    readableText
  };
}
