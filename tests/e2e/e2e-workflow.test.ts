import test from 'node:test';
import assert from 'node:assert/strict';
import { WebSocket } from 'ws';
import { BrowserBridgeServer } from '../../apps/mcp-server/src/browser/bridge-server.js';
import { BridgeAuthManager } from '../../apps/mcp-server/src/security/auth.js';
import { ExtensionConnectionManager } from '../../apps/mcp-server/src/browser/connection-manager.js';
import { ServerPermissionValidator } from '../../apps/mcp-server/src/permissions/validator.js';
import { TaskManager } from '../../apps/mcp-server/src/tasks/task-manager.js';
import { BrowserToolHandlers } from '../../apps/mcp-server/src/tools/handlers.js';
import { BrowserAction, BridgeMessage } from '@browser-mcp/protocol';

test('E2E - Multi-step AI Autonomous Browser Workflow', async () => {
  process.env.BROWSER_MCP_PORT = '29998';

  const authManager = new BridgeAuthManager();
  const connManager = new ExtensionConnectionManager();
  const bridge = new BrowserBridgeServer(authManager, connManager);
  const validator = new ServerPermissionValidator();
  const taskManager = new TaskManager();
  const handlers = new BrowserToolHandlers(bridge, validator, taskManager);

  await bridge.start();

  // Connect mock extension
  const ws = new WebSocket('ws://127.0.0.1:29998');

  await new Promise<void>((resolve) => {
    ws.on('open', () => {
      ws.send(
        JSON.stringify({
          id: 'auth-1',
          type: 'CLIENT_HELLO',
          timestamp: Date.now(),
          payload: { authToken: authManager.getToken() }
        })
      );
    });

    ws.on('message', (data) => {
      const msg: BridgeMessage = JSON.parse(data.toString());
      if (msg.type === 'SERVER_HELLO_ACK') {
        resolve();
      } else if (msg.type === 'EXECUTE_ACTION') {
        // Mock appropriate responses based on action
        const req = msg.payload;
        let responseData: any = {};

        if (req.action === BrowserAction.NAVIGATE) {
          responseData = { url: req.params.url, title: 'Google Search' };
        } else if (req.action === BrowserAction.GET_DOM) {
          responseData = {
            url: 'https://www.google.com',
            title: 'Google Search',
            elementCount: 2,
            interactiveElements: [
              { ref: '@e1', tagName: 'input', type: 'text', placeholder: 'Search Google or type a URL' },
              { ref: '@e2', tagName: 'button', text: 'Google Search' }
            ],
            formattedTree: '[@e1] <input type="text" placeholder="Search Google">\n[@e2] <button> "Google Search"'
          };
        } else if (req.action === BrowserAction.TYPE) {
          responseData = { typed: true, textLength: req.params.text.length };
        } else if (req.action === BrowserAction.CLICK) {
          responseData = { clicked: true, tagName: 'button' };
        }

        ws.send(
          JSON.stringify({
            id: 'res-' + req.requestId,
            type: 'ACTION_RESULT',
            timestamp: Date.now(),
            payload: {
              requestId: req.requestId,
              success: true,
              data: responseData
            }
          })
        );
      }
    });
  });

  // Step 1: AI calls browser_navigate
  const navResult = await handlers.navigate({ url: 'https://www.google.com' });
  assert.equal(navResult.title, 'Google Search');

  // Step 2: AI calls browser_get_dom
  const domResult = await handlers.getDom({ maxElements: 10 });
  assert.equal(domResult.interactiveElements.length, 2);
  assert.equal(domResult.interactiveElements[0].ref, '@e1');

  // Step 3: AI calls browser_type into input
  const typeResult = await handlers.type({ ref: '@e1', text: 'Python internships Bangalore' });
  assert.ok(typeResult.typed);

  // Step 4: AI calls browser_click on submit
  const clickResult = await handlers.click({ ref: '@e2' });
  assert.ok(clickResult.clicked);

  // Verify TaskManager has recorded all 4 steps
  const taskHistory = taskManager.listTasks(10);
  assert.equal(taskHistory.length, 4);
  assert.equal(taskHistory[0].action, BrowserAction.CLICK);
  assert.equal(taskHistory[0].status, 'completed');

  // Cleanup
  ws.close();
  await bridge.stop();
});
