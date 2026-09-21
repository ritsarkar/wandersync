import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { Logger } from '@browser-mcp/shared';
import { BridgeAuthManager } from '../security/auth.js';
import { ExtensionConnectionManager } from '../browser/connection-manager.js';
import { BrowserBridgeServer } from '../browser/bridge-server.js';
import { ServerPermissionValidator } from '../permissions/validator.js';
import { TaskManager } from '../tasks/task-manager.js';
import { BrowserToolHandlers } from '../tools/handlers.js';
import { registerBrowserTools } from '../tools/registry.js';

const logger = new Logger('MCPServer');

export class BrowserMcpServer {
  private server: Server;
  private bridge: BrowserBridgeServer;
  private authManager: BridgeAuthManager;
  private connectionManager: ExtensionConnectionManager;
  private validator: ServerPermissionValidator;
  private taskManager: TaskManager;
  private handlers: BrowserToolHandlers;

  constructor() {
    this.server = new Server(
      {
        name: 'browser-mcp',
        version: '1.0.0'
      },
      {
        capabilities: {
          tools: {}
        }
      }
    );

    this.authManager = new BridgeAuthManager();
    this.connectionManager = new ExtensionConnectionManager();
    this.bridge = new BrowserBridgeServer(this.authManager, this.connectionManager);
    this.validator = new ServerPermissionValidator();
    this.taskManager = new TaskManager();

    this.handlers = new BrowserToolHandlers(this.bridge, this.validator, this.taskManager);

    registerBrowserTools(this.server, this.handlers);
  }

  public async start(): Promise<void> {
    logger.info('Starting BrowserMCP Server...');

    // 1. Start WebSocket Bridge for Chrome Extension
    await this.bridge.start();

    // 2. Connect to MCP Stdio transport
    const transport = new StdioServerTransport();
    await this.server.connect(transport);

    logger.info('BrowserMCP MCP Server connected via stdio transport and ready for AI requests');
  }

  public async stop(): Promise<void> {
    await this.bridge.stop();
    await this.server.close();
    logger.info('BrowserMCP Server stopped');
  }

  public getAuthToken(): string {
    return this.authManager.getToken();
  }

  public isExtensionConnected(): boolean {
    return this.connectionManager.isConnected();
  }
}
