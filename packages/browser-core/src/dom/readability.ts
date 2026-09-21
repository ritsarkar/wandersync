/**
 * Extract clean, readable article or body text in plain or markdown format
 */
export function extractReadableContent(
  container: Element | Document = document,
  format: 'markdown' | 'plain' = 'markdown'
): string {
  const root = container instanceof Document ? container.body : container;
  if (!root) return '';

  const clone = root.cloneNode(true) as HTMLElement;

  // Remove noisy non-content elements
  const selectorsToRemove = [
    'script',
    'style',
    'noscript',
    'svg',
    'header',
    'footer',
    'nav',
    'aside',
    '.ad',
    '.advertisement',
    '.cookie-banner',
    '.modal',
    '[aria-hidden="true"]'
  ];

  selectorsToRemove.forEach(sel => {
    clone.querySelectorAll(sel).forEach(el => el.remove());
  });

  if (format === 'plain') {
    return clone.innerText ? clone.innerText.replace(/\n\s*\n\s*\n/g, '\n\n').trim() : '';
  }

  // Convert basic HTML structures to Markdown
  let md = '';

  function processNode(node: Node): void {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent?.replace(/\s+/g, ' ') || '';
      md += text;
      return;
    }

    if (node.nodeType !== Node.ELEMENT_NODE) return;

    const el = node as HTMLElement;
    const tag = el.tagName.toLowerCase();

    switch (tag) {
      case 'h1':
        md += '\n\n# ';
        break;
      case 'h2':
        md += '\n\n## ';
        break;
      case 'h3':
        md += '\n\n### ';
        break;
      case 'h4':
      case 'h5':
      case 'h6':
        md += '\n\n#### ';
        break;
      case 'p':
        md += '\n\n';
        break;
      case 'li':
        md += '\n- ';
        break;
      case 'br':
        md += '\n';
        break;
      case 'strong':
      case 'b':
        md += '**';
        break;
      case 'em':
      case 'i':
        md += '*';
        break;
      case 'code':
        md += '`';
        break;
      case 'a':
        md += '[';
        break;
    }

    for (let i = 0; i < el.childNodes.length; i++) {
      processNode(el.childNodes[i]);
    }

    switch (tag) {
      case 'h1':
      case 'h2':
      case 'h3':
      case 'h4':
      case 'h5':
      case 'h6':
      case 'p':
        md += '\n';
        break;
      case 'strong':
      case 'b':
        md += '**';
        break;
      case 'em':
      case 'i':
        md += '*';
        break;
      case 'code':
        md += '`';
        break;
      case 'a':
        const href = el.getAttribute('href');
        md += `](${href || ''})`;
        break;
    }
  }

  processNode(clone);
  return md.replace(/\n\s*\n\s*\n/g, '\n\n').trim();
}
