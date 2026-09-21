import { BrowserAction, ExecuteActionPayload, ActionResultPayload } from '@browser-mcp/protocol';
import { Logger, generateUUID } from '@browser-mcp/shared';
import { BridgeClient } from '../communication/bridge-client.js';
import { BackgroundTabManager } from './tab-manager.js';
import { ExtensionPermissionManager } from '../permissions/permission-manager.js';

const logger = new Logger('BackgroundServiceWorker');

let bridgeClient: BridgeClient;

async function updateBadge(connected: boolean) {
  try {
    if (connected) {
      await chrome.action.setBadgeText({ text: 'ON' });
      await chrome.action.setBadgeBackgroundColor({ color: '#10b981' });
    } else {
      await chrome.action.setBadgeText({ text: 'OFF' });
      await chrome.action.setBadgeBackgroundColor({ color: '#ef4444' });
    }
  } catch {
    // ignore
  }
}

async function initBackground() {
  logger.info('Initializing BrowserMCP Service Worker...');

  bridgeClient = new BridgeClient((connected) => {
    updateBadge(connected);
  });

  bridgeClient.setActionHandler(handleIncomingAction);
  await bridgeClient.connect();

  // Listen for tab events and inform bridge
  chrome.tabs.onActivated.addListener(async () => {
    broadcastTabsUpdate();
  });

  chrome.tabs.onUpdated.addListener(async (_tabId, changeInfo) => {
    if (changeInfo.status === 'complete') {
      broadcastTabsUpdate();
    }
  });

  chrome.tabs.onRemoved.addListener(() => {
    broadcastTabsUpdate();
  });
}

async function broadcastTabsUpdate() {
  if (bridgeClient && bridgeClient.isConnected()) {
    try {
      const tabs = await BackgroundTabManager.listTabs();
      bridgeClient.send({
        id: generateUUID(),
        type: 'PAGE_EVENT',
        timestamp: Date.now(),
        payload: { tabs }
      });
    } catch {
      // ignore
    }
  }
}

async function handleIncomingAction(payload: ExecuteActionPayload): Promise<ActionResultPayload> {
  const { action, params, tabId, requestId } = payload;
  logger.info(`Handling action: ${action} for request: ${requestId}`);

  try {
    // 1. Tab management actions handled in background directly
    switch (action) {
      case BrowserAction.LIST_TABS: {
        const tabs = await BackgroundTabManager.listTabs();
        return { requestId, success: true, data: { tabs } };
      }

      case BrowserAction.SWITCH_TAB: {
        await BackgroundTabManager.switchTab(params.tabId);
        return { requestId, success: true, data: { switchedTo: params.tabId } };
      }

      case BrowserAction.NEW_TAB: {
        const newTab = await BackgroundTabManager.newTab(params.url);
        return { requestId, success: true, data: newTab };
      }

      case BrowserAction.CLOSE_TAB: {
        await BackgroundTabManager.closeTab(params.tabId);
        return { requestId, success: true, data: { closedTabId: params.tabId } };
      }

      case BrowserAction.NAVIGATE: {
        const result = await BackgroundTabManager.navigate(params.url, tabId, params.newTab);
        return { requestId, success: true, data: result };
      }

      case BrowserAction.SCREENSHOT: {
        const result = await BackgroundTabManager.captureScreenshot(tabId, params.format, params.quality);
        return { requestId, success: true, data: result };
      }
    }

    // 2. In-page content actions routed to content script
    const activeTab = tabId ? await chrome.tabs.get(tabId) : await BackgroundTabManager.getActiveTab();
    if (!activeTab || !activeTab.id) {
      throw new Error('No active Chrome tab found to perform action');
    }

    const targetTabId = activeTab.id;
    await BackgroundTabManager.ensureContentScript(targetTabId);

    // Forward to content script
    const response = await chrome.tabs.sendMessage(targetTabId, {
      action,
      params,
      requestId
    });

    if (!response) {
      throw new Error('No response received from content script');
    }

    return {
      requestId,
      success: response.success,
      data: response.data,
      error: response.error,
      tabId: targetTabId,
      url: activeTab.url
    };
  } catch (err) {
    logger.error(`Failed handling action ${action}: ${(err as Error).message}`);
    return {
      requestId,
      success: false,
      error: (err as Error).message
    };
  }
}

// Start service worker
initBackground().catch(err => {
  logger.error(`Error starting background service worker: ${(err as Error).message}`);
});
