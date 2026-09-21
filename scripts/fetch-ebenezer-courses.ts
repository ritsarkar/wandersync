import { BrowserBridgeServer } from '../apps/mcp-server/src/browser/bridge-server.js';
import { BridgeAuthManager } from '../apps/mcp-server/src/security/auth.js';
import { ExtensionConnectionManager } from '../apps/mcp-server/src/browser/connection-manager.js';
import { BrowserAction, ChromeTabInfo } from '@browser-mcp/protocol';
import { delay } from '@browser-mcp/shared';
import fs from 'node:fs';
import path from 'node:path';

async function main() {
  console.log('====================================================');
  console.log('🏫 BrowserMCP — Navigate to Ebenezer Group & Extract Courses');
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

  // 1. Search Google for Ebenezer Group of Institutions
  const query = 'Ebenezer Group of Institutions';
  const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
  console.log(`\n[Step 1] Navigating Chrome to Google Search: ${searchUrl} ...`);

  await bridge.executeAction(BrowserAction.NAVIGATE, {
    url: searchUrl,
    newTab: true
  });

  await delay(4000);

  // Get active tab
  let tabsRes = await bridge.executeAction(BrowserAction.LIST_TABS);
  let tabs: ChromeTabInfo[] = tabsRes.data?.tabs || [];
  let currentTab = tabs.find(t => t.url && t.url.includes('google.com/search')) || tabs[0];
  let tabId = currentTab?.id;

  console.log(`Search Tab [#${tabId}]: ${currentTab?.title}`);

  // 2. Navigate directly to the first organic link: https://ebenezercollege.edu.in/
  const firstUrl = 'https://ebenezercollege.edu.in/';
  console.log(`\n[Step 2] Navigating to first link: ${firstUrl} ...`);

  await bridge.executeAction(BrowserAction.NAVIGATE, {
    url: firstUrl,
    newTab: false
  }, tabId);

  console.log('Waiting 6 seconds for Ebenezer College website to load...');
  await delay(6000);

  // Re-fetch tab info
  tabsRes = await bridge.executeAction(BrowserAction.LIST_TABS);
  tabs = tabsRes.data?.tabs || [];
  currentTab = tabs.find(t => t.id === tabId) || tabs[0];
  tabId = currentTab?.id;

  console.log(`Current page title: "${currentTab?.title}" at ${currentTab?.url}`);

  // Scroll down to courses section
  console.log('\n[Step 3] Scrolling page to reveal courses and programs...');
  await bridge.executeAction(BrowserAction.SCROLL, { direction: 'down', amount: 800 }, tabId);
  await delay(2500);

  // Capture screenshot of the first link
  console.log('\n[Step 4] Capturing screenshot of the first link...');
  const screenshotRes = await bridge.executeAction(BrowserAction.SCREENSHOT, {
    format: 'png'
  }, tabId);

  const artifactDir = 'C:\\Users\\rits7\\.gemini\\antigravity\\brain\\7f01854f-6f81-4e8c-b0c5-30eaf3151135';
  const screenshotPath = path.join(artifactDir, 'ebenezer_courses_screenshot.png');
  if (screenshotRes.data?.image) {
    fs.writeFileSync(screenshotPath, Buffer.from(screenshotRes.data.image, 'base64'));
    console.log(`✅ Screenshot saved to: ${screenshotPath}`);
  }

  // Extract full page text & DOM
  console.log('\n[Step 5] Extracting full text content and links from the website...');
  const textRes = await bridge.executeAction(BrowserAction.GET_TEXT, {
    format: 'markdown'
  }, tabId);

  const domRes = await bridge.executeAction(BrowserAction.GET_DOM, {
    maxElements: 200
  }, tabId);

  const homePageText = textRes.data?.text || '';
  const interactiveElements = domRes.data?.interactiveElements || [];

  console.log(`Extracted text length: ${homePageText.length} characters.`);

  // Save all raw extracted data
  const resultData = {
    url: currentTab?.url,
    title: currentTab?.title,
    homePageText,
    interactiveElements: interactiveElements.slice(0, 100)
  };

  fs.writeFileSync(
    path.join(process.cwd(), 'scripts', 'ebenezer_courses_data.json'),
    JSON.stringify(resultData, null, 2),
    'utf-8'
  );

  console.log('\n====================================================');
  console.log('✅ Course extraction complete!');
  console.log('====================================================');

  await bridge.stop();
  process.exit(0);
}

main().catch(async (err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
