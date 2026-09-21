import { BrowserBridgeServer } from '../apps/mcp-server/src/browser/bridge-server.js';
import { BridgeAuthManager } from '../apps/mcp-server/src/security/auth.js';
import { ExtensionConnectionManager } from '../apps/mcp-server/src/browser/connection-manager.js';
import { BrowserAction, ChromeTabInfo } from '@browser-mcp/protocol';
import { delay } from '@browser-mcp/shared';

async function main() {
  console.log('====================================================');
  console.log('🚀 BrowserMCP — LinkedIn Data Fetcher');
  console.log('====================================================');

  const authManager = new BridgeAuthManager();
  const connManager = new ExtensionConnectionManager();
  const bridge = new BrowserBridgeServer(authManager, connManager);

  await bridge.start();

  console.log('\n[1/4] Waiting for Chrome Extension to connect on ws://127.0.0.1:19999...');
  console.log('(Make sure Google Chrome is open with the BrowserMCP extension enabled)\n');

  // Wait up to 30 seconds for extension to pair
  const startWait = Date.now();
  while (!connManager.isConnected()) {
    if (Date.now() - startWait > 30000) {
      console.error('\n❌ Timed out waiting for Chrome Extension to connect.');
      console.error('Please ensure:');
      console.error('1. Chrome is open.');
      console.error('2. BrowserMCP extension is loaded in chrome://extensions.');
      await bridge.stop();
      process.exit(1);
    }
    await delay(500);
  }

  console.log('✅ Chrome Extension connected successfully!');

  // [2/4] List open tabs
  console.log('\n[2/4] Querying open Chrome tabs...');
  const tabsResult = await bridge.executeAction(BrowserAction.LIST_TABS);
  const tabs: ChromeTabInfo[] = tabsResult.data?.tabs || [];

  console.log(`Found ${tabs.length} open tab(s):`);
  tabs.forEach(t => {
    console.log(` - [Tab #${t.id}] ${t.title || 'Untitled'} (${t.url})`);
  });

  // Check if a LinkedIn tab is already open
  let linkedinTab = tabs.find(t => t.url && t.url.includes('linkedin.com'));

  if (linkedinTab) {
    console.log(`\n✅ Detected existing LinkedIn tab: [Tab #${linkedinTab.id}] "${linkedinTab.title}"`);
    console.log('Switching to LinkedIn tab...');
    await bridge.executeAction(BrowserAction.SWITCH_TAB, { tabId: linkedinTab.id });
  } else {
    console.log('\n[3/4] No LinkedIn tab currently open. Opening https://www.linkedin.com/feed/ ...');
    const navResult = await bridge.executeAction(BrowserAction.NAVIGATE, {
      url: 'https://www.linkedin.com/feed/',
      newTab: true
    });
    console.log(`Navigated to: ${navResult.data?.url || 'https://www.linkedin.com/feed/'}`);
    console.log('Waiting 5 seconds for feed / profile to load...');
    await delay(5000);

    // Refresh tabs list
    const updatedTabs = await bridge.executeAction(BrowserAction.LIST_TABS);
    linkedinTab = (updatedTabs.data?.tabs || []).find((t: ChromeTabInfo) => t.url && t.url.includes('linkedin.com'));
  }

  const targetTabId = linkedinTab?.id;

  // [4/4] Fetch content and structure from the page
  console.log('\n[4/4] Extracting LinkedIn data from active page...');

  // Get DOM summary
  const domResult = await bridge.executeAction(BrowserAction.GET_DOM, {
    maxElements: 80,
    includeTextContent: true
  }, targetTabId);

  // Get readable text
  const textResult = await bridge.executeAction(BrowserAction.GET_TEXT, {
    format: 'markdown'
  }, targetTabId);

  console.log('\n====================================================');
  console.log('📄 EXTRACTED LINKEDIN PAGE INFO:');
  console.log('====================================================');
  console.log('Page Title:', domResult.data?.title || 'Unknown');
  console.log('URL:', domResult.data?.url || 'Unknown');
  console.log('Interactive Elements Count:', domResult.data?.elementCount || 0);

  console.log('\n--- KEY INTERACTIVE ELEMENTS / REFS ---');
  if (domResult.data?.interactiveElements) {
    domResult.data.interactiveElements.slice(0, 15).forEach((el: any) => {
      console.log(`[${el.ref}] <${el.tagName}> ${el.text || el.placeholder || el.ariaLabel || ''}`);
    });
  }

  console.log('\n--- EXTRACTED READABLE CONTENT (Preview) ---');
  const fullText: string = textResult.data?.text || domResult.data?.readableText || '';
  if (fullText) {
    console.log(fullText.slice(0, 1500));
    if (fullText.length > 1500) {
      console.log('\n... [Content truncated, total length: ' + fullText.length + ' chars]');
    }
  } else {
    console.log('(No text content extracted - page may still be loading or require sign in)');
  }

  console.log('\n====================================================');
  console.log('✅ Extraction complete!');
  console.log('====================================================');

  await delay(1000);
  await bridge.stop();
  process.exit(0);
}

main().catch(err => {
  console.error('Fatal error in LinkedIn fetcher:', err);
  process.exit(1);
});
