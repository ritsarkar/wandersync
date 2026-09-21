import { BrowserBridgeServer } from '../apps/mcp-server/src/browser/bridge-server.js';
import { BridgeAuthManager } from '../apps/mcp-server/src/security/auth.js';
import { ExtensionConnectionManager } from '../apps/mcp-server/src/browser/connection-manager.js';
import { BrowserAction, ChromeTabInfo } from '@browser-mcp/protocol';
import { delay } from '@browser-mcp/shared';
import fs from 'node:fs';
import path from 'node:path';

async function main() {
  console.log('====================================================');
  console.log('🔍 BrowserMCP — LinkedIn Profile Analyzer');
  console.log('====================================================');

  const authManager = new BridgeAuthManager();
  const connManager = new ExtensionConnectionManager();
  const bridge = new BrowserBridgeServer(authManager, connManager);

  await bridge.start();

  console.log('Waiting for Chrome Extension to connect on ws://127.0.0.1:19999...');

  const startWait = Date.now();
  while (!connManager.isConnected()) {
    if (Date.now() - startWait > 25000) {
      console.error('❌ Timed out waiting for Chrome Extension. Ensure Chrome is running.');
      await bridge.stop();
      process.exit(1);
    }
    await delay(500);
  }

  console.log('✅ Chrome Extension connected!');

  // 1. List tabs
  const tabsResult = await bridge.executeAction(BrowserAction.LIST_TABS);
  const tabs: ChromeTabInfo[] = tabsResult.data?.tabs || [];

  console.log(`Open tabs (${tabs.length}):`);
  tabs.forEach(t => console.log(` - [#${t.id}] ${t.title} (${t.url})`));

  let targetTab = tabs.find(t => t.url && t.url.includes('linkedin.com/in/'));
  if (!targetTab) {
    targetTab = tabs.find(t => t.url && t.url.includes('linkedin.com'));
  }

  let tabId: number;

  if (targetTab) {
    tabId = targetTab.id;
    console.log(`\nUsing existing LinkedIn tab [#${tabId}]: ${targetTab.url}`);
    // If not on profile, navigate to /in/me
    if (!targetTab.url.includes('/in/')) {
      console.log('Navigating tab to https://www.linkedin.com/in/me/ ...');
      await bridge.executeAction(BrowserAction.NAVIGATE, {
        url: 'https://www.linkedin.com/in/me/'
      }, tabId);
    } else {
      console.log('Switching to profile tab...');
      await bridge.executeAction(BrowserAction.SWITCH_TAB, { tabId });
    }
  } else {
    console.log('\nOpening new tab for https://www.linkedin.com/in/me/ ...');
    const newTabRes = await bridge.executeAction(BrowserAction.NAVIGATE, {
      url: 'https://www.linkedin.com/in/me/',
      newTab: true
    });
    // Find new tab ID
    const refreshedTabs = await bridge.executeAction(BrowserAction.LIST_TABS);
    const found = (refreshedTabs.data?.tabs || []).find((t: ChromeTabInfo) => t.url && t.url.includes('linkedin.com'));
    tabId = found?.id || 0;
  }

  console.log('Waiting 6 seconds for profile components and data to hydrate...');
  await delay(6000);

  // Scroll down to load Experience, Education, and Skills
  console.log('Scrolling page to load all profile sections...');
  await bridge.executeAction(BrowserAction.SCROLL, { direction: 'down', amount: 800 }, tabId);
  await delay(1500);
  await bridge.executeAction(BrowserAction.SCROLL, { direction: 'down', amount: 800 }, tabId);
  await delay(1500);
  await bridge.executeAction(BrowserAction.SCROLL, { direction: 'down', amount: 800 }, tabId);
  await delay(1500);
  await bridge.executeAction(BrowserAction.SCROLL, { direction: 'top' }, tabId);
  await delay(1000);

  // Extract structured DOM snapshot
  console.log('Extracting structured DOM and elements...');
  const domResult = await bridge.executeAction(BrowserAction.GET_DOM, {
    maxElements: 120,
    includeTextContent: true
  }, tabId);

  // Extract readable text in Markdown
  console.log('Extracting full profile readable text...');
  const textResult = await bridge.executeAction(BrowserAction.GET_TEXT, {
    format: 'markdown'
  }, tabId);

  const profileData = {
    capturedAt: new Date().toISOString(),
    url: domResult.data?.url || '',
    title: domResult.data?.title || '',
    interactiveElementsCount: domResult.data?.elementCount || 0,
    interactiveElements: domResult.data?.interactiveElements || [],
    readableText: textResult.data?.text || domResult.data?.readableText || ''
  };

  const outputPath = path.join(process.cwd(), 'scripts', 'extracted_linkedin.json');
  fs.writeFileSync(outputPath, JSON.stringify(profileData, null, 2), 'utf-8');
  console.log(`\n✅ Profile data saved to: ${outputPath}`);
  console.log(`Page Title: ${profileData.title}`);
  console.log(`URL: ${profileData.url}`);
  console.log(`Text Length: ${profileData.readableText.length} characters`);

  await bridge.stop();
  process.exit(0);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
