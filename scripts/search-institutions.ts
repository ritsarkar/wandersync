import { BrowserBridgeServer } from '../apps/mcp-server/src/browser/bridge-server.js';
import { BridgeAuthManager } from '../apps/mcp-server/src/security/auth.js';
import { ExtensionConnectionManager } from '../apps/mcp-server/src/browser/connection-manager.js';
import { BrowserAction, ChromeTabInfo } from '@browser-mcp/protocol';
import { delay } from '@browser-mcp/shared';
import fs from 'node:fs';
import path from 'node:path';

async function main() {
  console.log('====================================================');
  console.log('🏫 BrowserMCP — Institution Search & Analysis');
  console.log('====================================================');

  const authManager = new BridgeAuthManager();
  const connManager = new ExtensionConnectionManager();
  const bridge = new BrowserBridgeServer(authManager, connManager);

  await bridge.start();

  console.log('Waiting for Chrome Extension to connect on ws://127.0.0.1:19999...');

  const startWait = Date.now();
  while (!connManager.isConnected()) {
    if (Date.now() - startWait > 25000) {
      console.error('❌ Timed out waiting for Chrome Extension.');
      await bridge.stop();
      process.exit(1);
    }
    await delay(500);
  }

  console.log('✅ Chrome Extension connected!');

  // 1. Search Google in Chrome
  const query = 'New Ebenezer Group of Institutions Bangalore';
  const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
  console.log(`\n[1/4] Navigating Chrome to Google Search: ${searchUrl} ...`);

  await bridge.executeAction(BrowserAction.NAVIGATE, {
    url: searchUrl,
    newTab: true
  });

  console.log('Waiting 5 seconds for search results to render in Chrome...');
  await delay(5000);

  // Get active tab
  const tabsRes = await bridge.executeAction(BrowserAction.LIST_TABS);
  const tabs: ChromeTabInfo[] = tabsRes.data?.tabs || [];
  const searchTab = tabs.find(t => t.url && t.url.includes('google.com/search')) || tabs[0];
  const tabId = searchTab?.id;

  console.log(`Using tab [#${tabId}]: ${searchTab?.title}`);

  // Scroll down slightly
  console.log('\n[2/4] Scrolling search results...');
  await bridge.executeAction(BrowserAction.SCROLL, { direction: 'down', amount: 500 }, tabId);
  await delay(1500);

  // Capture screenshot
  console.log('\n[3/4] Capturing screenshot of search results...');
  const screenshotRes = await bridge.executeAction(BrowserAction.SCREENSHOT, {
    format: 'png'
  }, tabId);

  const artifactDir = 'C:\\Users\\rits7\\.gemini\\antigravity\\brain\\7f01854f-6f81-4e8c-b0c5-30eaf3151135';
  const screenshotPath = path.join(artifactDir, 'institutions_search_screenshot.png');
  if (screenshotRes.data?.image) {
    fs.writeFileSync(screenshotPath, Buffer.from(screenshotRes.data.image, 'base64'));
    console.log(`✅ Screenshot saved to: ${screenshotPath}`);
  }

  // Extract structured search results
  console.log('\n[4/4] Extracting search results text and links via DOM...');
  const textRes = await bridge.executeAction(BrowserAction.GET_TEXT, {
    format: 'markdown'
  }, tabId);

  const domRes = await bridge.executeAction(BrowserAction.GET_DOM, {
    maxElements: 80
  }, tabId);

  const fullText = textRes.data?.text || '';
  console.log('\n--- SEARCH RESULTS TEXT PREVIEW ---');
  console.log(fullText.slice(0, 2000));

  const resultData = {
    query,
    title: searchTab?.title,
    url: searchTab?.url,
    extractedText: fullText,
    interactiveElements: domRes.data?.interactiveElements || []
  };

  fs.writeFileSync(
    path.join(process.cwd(), 'scripts', 'institutions_results.json'),
    JSON.stringify(resultData, null, 2),
    'utf-8'
  );

  console.log('\n====================================================');
  console.log('✅ Search complete and recorded!');
  console.log('====================================================');

  await delay(1000);
  await bridge.stop();
  process.exit(0);
}

main().catch(err => {
  console.error('Fatal error in search-institutions:', err);
  process.exit(1);
});
