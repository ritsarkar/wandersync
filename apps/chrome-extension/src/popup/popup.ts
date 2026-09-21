import { ExtensionPermissionManager } from '../permissions/permission-manager.js';
import { SecurityMode } from '@browser-mcp/permissions';
import { BrowserAction } from '@browser-mcp/protocol';

document.addEventListener('DOMContentLoaded', async () => {
  const statusBadge = document.getElementById('connection-badge');
  const statusText = document.getElementById('connection-status-text');
  const tabTitleEl = document.getElementById('tab-title');
  const tabUrlEl = document.getElementById('tab-url');
  const btnHighlight = document.getElementById('btn-highlight');
  const btnReconnect = document.getElementById('btn-reconnect');
  const btnOpenOptions = document.getElementById('btn-open-options');

  const modeButtons = document.querySelectorAll('.mode-btn');

  // 1. Load active tab information
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const activeTab = tabs[0];
  if (activeTab) {
    if (tabTitleEl) tabTitleEl.textContent = activeTab.title || 'Untitled Tab';
    if (tabUrlEl) tabUrlEl.textContent = activeTab.url || '';
  }

  // 2. Load and reflect security policy mode
  const config = await ExtensionPermissionManager.getConfig();
  updateModeUI(config.mode);

  modeButtons.forEach(btn => {
    btn.addEventListener('click', async () => {
      const selectedMode = btn.getAttribute('data-mode') as SecurityMode;
      if (selectedMode) {
        await ExtensionPermissionManager.setSecurityMode(selectedMode);
        updateModeUI(selectedMode);
      }
    });
  });

  function updateModeUI(mode: SecurityMode) {
    modeButtons.forEach(b => {
      if (b.getAttribute('data-mode') === mode) {
        b.classList.add('active');
      } else {
        b.classList.remove('active');
      }
    });
  }

  // 3. Check connection status via background test
  try {
    const badgeText = await chrome.action.getBadgeText({});
    const isConnected = badgeText === 'ON';
    if (statusBadge && statusText) {
      if (isConnected) {
        statusBadge.className = 'badge badge-connected';
        statusText.textContent = 'Connected';
      } else {
        statusBadge.className = 'badge badge-disconnected';
        statusText.textContent = 'Disconnected';
      }
    }
  } catch {
    // ignore
  }

  // 4. Quick Actions
  btnHighlight?.addEventListener('click', async () => {
    if (activeTab?.id) {
      await chrome.tabs.sendMessage(activeTab.id, {
        action: BrowserAction.GET_DOM,
        params: { highlightInteractive: true },
        requestId: crypto.randomUUID()
      });
      window.close();
    }
  });

  btnReconnect?.addEventListener('click', async () => {
    chrome.runtime.reload();
    window.close();
  });

  btnOpenOptions?.addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });
});
