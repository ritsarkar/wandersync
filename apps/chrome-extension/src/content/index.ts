import { BrowserAction } from '@browser-mcp/protocol';
import {
  serializeDOM,
  extractReadableContent,
  findElement,
  simulateClick,
  simulateType,
  simulateKeyPress,
  simulateScroll
} from '@browser-mcp/browser-core';
import { ContentOverlay } from './overlay.js';

// Initialize HUD on page load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => ContentOverlay.initHUD());
} else {
  ContentOverlay.initHUD();
}

/**
 * Handle incoming message from background service worker
 */
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'PING') {
    sendResponse({ pong: true });
    return true;
  }

  const { action, params, requestId } = message;

  handleAction(action, params)
    .then(data => {
      sendResponse({ requestId, success: true, data });
    })
    .catch(err => {
      sendResponse({ requestId, success: false, error: (err as Error).message });
    });

  // Keep channel open for async response
  return true;
});

async function handleAction(action: BrowserAction, params: Record<string, any> = {}): Promise<any> {
  switch (action) {
    case BrowserAction.GET_DOM: {
      ContentOverlay.showStatus('AI Reading Page Structure...');
      const snapshot = serializeDOM(document, {
        maxElements: params.maxElements ?? 150,
        highlightInteractive: params.highlightInteractive,
        includeTextContent: params.includeTextContent
      });

      if (params.highlightInteractive) {
        ContentOverlay.highlightElements();
      }

      return snapshot;
    }

    case BrowserAction.GET_TEXT: {
      ContentOverlay.showStatus('AI Extracting Content...');
      const target = params.selector ? document.querySelector(params.selector) : document;
      if (!target) {
        throw new Error(`Selector "${params.selector}" not found for get_text`);
      }
      const text = extractReadableContent(target, params.format || 'markdown');
      return { text, format: params.format || 'markdown' };
    }

    case BrowserAction.CLICK: {
      const el = findElement({
        ref: params.ref,
        selector: params.selector,
        text: params.text,
        doc: document
      });

      if (!el) {
        throw new Error(`Element not found for click: ${JSON.stringify(params)}`);
      }

      ContentOverlay.showStatus(`AI Clicking ${params.ref || params.text || el.tagName}...`);
      await simulateClick(el);
      return { clicked: true, tagName: el.tagName.toLowerCase() };
    }

    case BrowserAction.TYPE: {
      const el = findElement({
        ref: params.ref,
        selector: params.selector,
        doc: document
      });

      if (!el) {
        throw new Error(`Element not found for typing: ${JSON.stringify(params)}`);
      }

      ContentOverlay.showStatus(`AI Typing into ${params.ref || el.tagName}...`);
      await simulateType(el, params.text, params.clearFirst ?? true, params.pressEnter ?? false);
      return { typed: true, textLength: params.text.length };
    }

    case BrowserAction.PRESS_KEY: {
      const active = (document.activeElement as HTMLElement) || document.body;
      const count = params.count || 1;
      ContentOverlay.showStatus(`AI Pressing ${params.key}...`);
      for (let i = 0; i < count; i++) {
        await simulateKeyPress(active, params.key);
      }
      return { pressed: params.key, count };
    }

    case BrowserAction.SCROLL: {
      let el: HTMLElement | null = null;
      if (params.ref) {
        el = findElement({ ref: params.ref, doc: document });
      }
      ContentOverlay.showStatus(`AI Scrolling ${params.direction || 'down'}...`);
      await simulateScroll(params.direction || 'down', params.amount || 500, el);
      return {
        scrolled: true,
        direction: params.direction || 'down',
        scrollY: window.scrollY
      };
    }

    case BrowserAction.HIGHLIGHT: {
      ContentOverlay.highlightElements();
      return { highlighted: true };
    }

    case BrowserAction.WAIT_FOR: {
      const timeoutMs = params.timeoutMs || 10000;
      const selector = params.selector;
      ContentOverlay.showStatus(`Waiting for ${selector}...`);

      const start = Date.now();
      while (Date.now() - start < timeoutMs) {
        const el = document.querySelector(selector);
        if (el) {
          return { found: true, elapsedMs: Date.now() - start };
        }
        await new Promise(r => setTimeout(r, 200));
      }
      throw new Error(`Timeout waiting for element "${selector}" after ${timeoutMs}ms`);
    }

    case BrowserAction.EVALUATE: {
      ContentOverlay.showStatus('AI Evaluating Code...');
      // Safe execution via Function
      const evalFn = new Function(`return (${params.script});`);
      const result = evalFn();
      return { result };
    }

    default:
      throw new Error(`Unsupported in-page action: ${action}`);
  }
}
