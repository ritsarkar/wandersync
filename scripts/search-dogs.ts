import { BrowserBridgeServer } from '../apps/mcp-server/src/browser/bridge-server.js';
import { BridgeAuthManager } from '../apps/mcp-server/src/security/auth.js';
import { ExtensionConnectionManager } from '../apps/mcp-server/src/browser/connection-manager.js';
import { BrowserAction, ChromeTabInfo } from '@browser-mcp/protocol';
import { delay } from '@browser-mcp/shared';
import fs from 'node:fs';
import path from 'node:path';

async function main() {
  console.log('====================================================');
  console.log('🐶 BrowserMCP — Dog Images Search & Extractor');
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

  // 1. Open new tab with Unsplash Dog search for high quality images
  const targetUrl = 'https://unsplash.com/s/photos/dog';
  console.log(`\n[1/4] Navigating Chrome to ${targetUrl} ...`);

  await bridge.executeAction(BrowserAction.NAVIGATE, {
    url: targetUrl,
    newTab: true
  });

  console.log('Waiting 6 seconds for high-resolution images to render in Chrome...');
  await delay(6000);

  // Get active tabs
  const tabsRes = await bridge.executeAction(BrowserAction.LIST_TABS);
  const tabs: ChromeTabInfo[] = tabsRes.data?.tabs || [];
  const dogTab = tabs.find(t => t.url && t.url.includes('unsplash.com')) || tabs[0];
  const tabId = dogTab?.id;

  console.log(`Using tab [#${tabId}]: ${dogTab?.title} (${dogTab?.url})`);

  // Scroll down slightly to trigger lazy-loaded images
  console.log('\n[2/4] Scrolling to load more images...');
  await bridge.executeAction(BrowserAction.SCROLL, { direction: 'down', amount: 800 }, tabId);
  await delay(2000);
  await bridge.executeAction(BrowserAction.SCROLL, { direction: 'top' }, tabId);
  await delay(1000);

  // 2. Capture screenshot of the dog images
  console.log('\n[3/4] Capturing high-resolution browser screenshot...');
  const screenshotRes = await bridge.executeAction(BrowserAction.SCREENSHOT, {
    format: 'png'
  }, tabId);

  const artifactDir = 'C:\\Users\\rits7\\.gemini\\antigravity\\brain\\7f01854f-6f81-4e8c-b0c5-30eaf3151135';
  if (!fs.existsSync(artifactDir)) {
    fs.mkdirSync(artifactDir, { recursive: true });
  }

  const screenshotPath = path.join(artifactDir, 'dog_search_screenshot.png');
  if (screenshotRes.data?.image) {
    fs.writeFileSync(screenshotPath, Buffer.from(screenshotRes.data.image, 'base64'));
    console.log(`✅ Screenshot saved to: ${screenshotPath}`);
  }

  // 3. Extract images data and titles
  console.log('\n[4/4] Extracting image titles, links, and metadata via DOM reader...');
  const evalRes = await bridge.executeAction(BrowserAction.EVALUATE, {
    script: `
      (() => {
        const images = Array.from(document.querySelectorAll('figure img, img[alt*="dog" i], img[srcset]'))
          .filter(img => img.src && (img.alt || img.src.includes('images.unsplash.com')))
          .slice(0, 12)
          .map(img => ({
            alt: img.alt || 'Cute Dog',
            src: img.src,
            width: img.naturalWidth || img.width,
            height: img.naturalHeight || img.height
          }));
        return {
          title: document.title,
          url: window.location.href,
          imagesCount: images.length,
          images
        };
      })()
    `
  }, tabId);

  const extractedData = evalRes.data?.result || {};
  console.log(`Extracted ${extractedData.images?.length || 0} dog images!`);

  const resultsPath = path.join(process.cwd(), 'scripts', 'dog_images.json');
  fs.writeFileSync(resultsPath, JSON.stringify(extractedData, null, 2), 'utf-8');

  console.log('\n====================================================');
  console.log('🐾 BEST DOG IMAGES DISCOVERED:');
  console.log('====================================================');
  (extractedData.images || []).slice(0, 6).forEach((img: any, i: number) => {
    console.log(`${i + 1}. ${img.alt}`);
    console.log(`   Image URL: ${img.src.slice(0, 100)}...`);
  });

  console.log('\n====================================================');
  console.log('✅ Search and extraction complete!');
  console.log('====================================================');

  await delay(1000);
  await bridge.stop();
  process.exit(0);
}

main().catch(err => {
  console.error('Fatal error in search-dogs:', err);
  process.exit(1);
});
