import type { ChromeTabInfo } from '@browser-mcp/protocol';

export class BackgroundTabManager {
  /**
   * Get current active tab in current window
   */
  public static async getActiveTab(): Promise<chrome.tabs.Tab | null> {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    return tabs[0] || null;
  }

  /**
   * List all open Chrome tabs
   */
  public static async listTabs(): Promise<ChromeTabInfo[]> {
    const tabs = await chrome.tabs.query({});
    return tabs.map(t => ({
      id: t.id || 0,
      url: t.url || '',
      title: t.title || '',
      active: !!t.active,
      favIconUrl: t.favIconUrl,
      status: t.status,
      windowId: t.windowId
    }));
  }

  /**
   * Switch active tab
   */
  public static async switchTab(tabId: number): Promise<boolean> {
    const tab = await chrome.tabs.update(tabId, { active: true });
    if (tab.windowId) {
      await chrome.windows.update(tab.windowId, { focused: true });
    }
    return true;
  }

  /**
   * Open a new tab
   */
  public static async newTab(url = 'about:blank'): Promise<ChromeTabInfo> {
    const tab = await chrome.tabs.create({ url, active: true });
    return {
      id: tab.id || 0,
      url: tab.url || url,
      title: tab.title || '',
      active: true,
      windowId: tab.windowId
    };
  }

  /**
   * Close a tab by ID
   */
  public static async closeTab(tabId: number): Promise<boolean> {
    await chrome.tabs.remove(tabId);
    return true;
  }

  /**
   * Navigate tab to URL
   */
  public static async navigate(url: string, tabId?: number, newTab = false): Promise<{ url: string; title: string }> {
    if (newTab) {
      const created = await chrome.tabs.create({ url, active: true });
      await this.waitForTabLoad(created.id!);
      const tab = await chrome.tabs.get(created.id!);
      return { url: tab.url || url, title: tab.title || '' };
    }

    const targetTab = tabId ? await chrome.tabs.get(tabId) : await this.getActiveTab();
    if (!targetTab || !targetTab.id) {
      throw new Error('No active Chrome tab found to navigate');
    }

    await chrome.tabs.update(targetTab.id, { url });
    await this.waitForTabLoad(targetTab.id);
    const updated = await chrome.tabs.get(targetTab.id);
    return { url: updated.url || url, title: updated.title || '' };
  }

  /**
   * Wait until tab finishes loading
   */
  public static waitForTabLoad(tabId: number, timeoutMs = 25000): Promise<void> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        chrome.tabs.onUpdated.removeListener(listener);
        resolve(); // resolve anyway on timeout to allow DOM inspection
      }, timeoutMs);

      const listener = (updatedTabId: number, changeInfo: chrome.tabs.TabChangeInfo) => {
        if (updatedTabId === tabId && changeInfo.status === 'complete') {
          clearTimeout(timer);
          chrome.tabs.onUpdated.removeListener(listener);
          resolve();
        }
      };

      chrome.tabs.onUpdated.addListener(listener);
    });
  }

  /**
   * Capture screenshot of visible tab
   */
  public static async captureScreenshot(
    tabId?: number,
    format: 'jpeg' | 'png' = 'png',
    quality = 90
  ): Promise<{ image: string; mimeType: string }> {
    const tab = tabId ? await chrome.tabs.get(tabId) : await this.getActiveTab();
    if (!tab || !tab.windowId) {
      throw new Error('No target tab available for screenshot');
    }

    const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, {
      format,
      quality: format === 'jpeg' ? quality : undefined
    });

    // Strip base64 prefix
    const base64Data = dataUrl.replace(/^data:image\/[a-z]+;base64,/, '');
    const mimeType = format === 'jpeg' ? 'image/jpeg' : 'image/png';

    return {
      image: base64Data,
      mimeType
    };
  }

  /**
   * Ensure content script is injected into tab if not already present
   */
  public static async ensureContentScript(tabId: number): Promise<void> {
    try {
      // Test ping
      await chrome.tabs.sendMessage(tabId, { type: 'PING' });
    } catch {
      // Content script not loaded yet, inject it
      try {
        await chrome.scripting.executeScript({
          target: { tabId },
          files: ['dist/content.js']
        });
      } catch (err) {
        console.warn(`Could not inject content script into tab ${tabId}: ${(err as Error).message}`);
      }
    }
  }
}
