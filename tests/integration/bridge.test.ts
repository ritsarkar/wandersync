import test from 'node:test';
import assert from 'node:assert/strict';
import { WebSocket } from 'ws';
import { BrowserBridgeServer } from '../../apps/mcp-server/src/browser/bridge-server.js';
import { BridgeAuthManager } from '../../apps/mcp-server/src/security/auth.js';
import { ExtensionConnectionManager } from '../../apps/mcp-server/src/browser/connection-manager.js';
import { BrowserAction, BridgeMessage } from '@browser-mcp/protocol';

test('Integration - WebSocket Bridge Connection & Action Dispatch', async () => {
  process.env.BROWSER_MCP_PORT = '29999';

  const authManager = new BridgeAuthManager();
  const connManager = new ExtensionConnectionManager();
  const bridge = new BrowserBridgeServer(authManager, connManager);

  await bridge.start();
  const token = authManager.getToken();

  // Connect mock extension
  const ws = new WebSocket('ws://127.0.0.1:29999');

  await new Promise<void>((resolve, reject) => {
    ws.on('open', () => {
      // Send handshake
      const hello: BridgeMessage = {
        id: 'msg-1',
        type: 'CLIENT_HELLO',
        timestamp: Date.now(),
        payload: {
          extensionVersion: '1.0.0',
          browser: 'Chrome Mock',
          authToken: token
        }
      };
      ws.send(JSON.stringify(hello));
    });

    ws.on('message', (data) => {
      const msg: BridgeMessage = JSON.parse(data.toString());
      if (msg.type === 'SERVER_HELLO_ACK') {
        assert.equal(msg.payload.status, 'authenticated');
        resolve();
      }
    });

    ws.on('error', reject);
  });

  // Verify connection manager state
  assert.ok(connManager.isConnected());

  // Listen for action and reply
  ws.on('message', (data) => {
    const msg: BridgeMessage = JSON.parse(data.toString());
    if (msg.type === 'EXECUTE_ACTION') {
      const payload = msg.payload;
      assert.equal(payload.action, BrowserAction.NAVIGATE);
      assert.equal(payload.params.url, 'https://example.com');

      // Send result back
      const reply: BridgeMessage = {
        id: 'msg-res',
        type: 'ACTION_RESULT',
        timestamp: Date.now(),
        payload: {
          requestId: payload.requestId,
          success: true,
          data: { title: 'Example Domain', url: 'https://example.com' }
        }
      };
      ws.send(JSON.stringify(reply));
    }
  });

  // Execute action from server
  const result = await bridge.executeAction(BrowserAction.NAVIGATE, { url: 'https://example.com' });
  assert.ok(result.success);
  assert.equal(result.data.title, 'Example Domain');

  // Cleanup
  ws.close();
  await bridge.stop();
});
