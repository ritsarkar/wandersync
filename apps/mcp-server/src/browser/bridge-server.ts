import { WebSocketServer, WebSocket } from 'ws';
import {
  DEFAULT_BRIDGE_PORT,
  DEFAULT_BRIDGE_HOST,
  DEFAULT_ACTION_TIMEOUT_MS,
  Logger,
  BridgeConnectionError,
  ActionTimeoutError,
  generateUUID
} from '@browser-mcp/shared';
import {
  BrowserAction,
  BridgeMessage,
  ClientHelloPayload,
  ServerHelloAckPayload,
  ExecuteActionPayload,
  ActionResultPayload
} from '@browser-mcp/protocol';
import { isAllowedOrigin, DataSanitizer } from '@browser-mcp/security';
import { BridgeAuthManager } from '../security/auth.js';
import { ExtensionConnectionManager } from './connection-manager.js';

const logger = new Logger('BridgeServer');

interface PendingAction {
  resolve: (result: ActionResultPayload) => void;
  reject: (err: Error) => void;
  timer: NodeJS.Timeout;
  action: BrowserAction;
}

export class BrowserBridgeServer {
  private wss: WebSocketServer | null = null;
  private authManager: BridgeAuthManager;
  private connectionManager: ExtensionConnectionManager;
  private pendingActions: Map<string, PendingAction> = new Map();
  private port: number;
  private host: string;

  constructor(authManager: BridgeAuthManager, connectionManager: ExtensionConnectionManager) {
    this.authManager = authManager;
    this.connectionManager = connectionManager;
    this.port = parseInt(process.env.BROWSER_MCP_PORT || `${DEFAULT_BRIDGE_PORT}`, 10);
    this.host = process.env.BROWSER_MCP_HOST || DEFAULT_BRIDGE_HOST;
  }

  public start(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.wss = new WebSocketServer({
          host: this.host,
          port: this.port
        });

        this.wss.on('listening', () => {
          logger.info(`Bridge WebSocket Server running at ws://${this.host}:${this.port}`);
          logger.info(`Pairing Token: ${this.authManager.getToken()}`);
          resolve();
        });

        this.wss.on('connection', (socket: WebSocket, req) => {
          this.handleConnection(socket, req);
        });

        this.wss.on('error', (err) => {
          logger.error(`Bridge WebSocket Server error: ${err.message}`);
          reject(err);
        });
      } catch (err) {
        reject(err);
      }
    });
  }

  private handleConnection(socket: WebSocket, req: any): void {
    const origin = req.headers.origin;
    if (!isAllowedOrigin(origin)) {
      logger.warn(`Rejected connection from unauthorized origin: ${origin}`);
      socket.close(4403, 'Forbidden origin');
      return;
    }

    let authenticated = false;

    socket.on('message', (rawData: string) => {
      try {
        const message: BridgeMessage = JSON.parse(rawData.toString());
        this.handleMessage(socket, message, () => {
          authenticated = true;
        }, authenticated);
      } catch (err) {
        logger.error(`Failed to parse incoming message: ${(err as Error).message}`);
      }
    });

    socket.on('close', (code, reason) => {
      this.connectionManager.setDisconnected(socket);
      logger.info(`Extension disconnected (code: ${code}, reason: ${reason.toString()})`);
      // Reject any pending requests
      for (const [id, pending] of this.pendingActions.entries()) {
        clearTimeout(pending.timer);
        pending.reject(new BridgeConnectionError('Connection closed while waiting for browser action response'));
        this.pendingActions.delete(id);
      }
    });

    socket.on('error', (err) => {
      logger.error(`Socket error: ${err.message}`);
    });
  }

  private handleMessage(
    socket: WebSocket,
    message: BridgeMessage,
    onAuthSuccess: () => void,
    isAuthenticated: boolean
  ): void {
    switch (message.type) {
      case 'CLIENT_HELLO': {
        const payload = message.payload as ClientHelloPayload;
        const valid = this.authManager.validateToken(payload.authToken);

        if (!valid) {
          logger.warn('Client authentication failed: invalid token');
          const errorAck: BridgeMessage<ServerHelloAckPayload> = {
            id: generateUUID(),
            type: 'SERVER_HELLO_ACK',
            timestamp: Date.now(),
            payload: {
              sessionId: '',
              status: 'unauthorized',
              supportedActions: []
            }
          };
          socket.send(JSON.stringify(errorAck));
          socket.close(4401, 'Unauthorized');
          return;
        }

        onAuthSuccess();
        const sessionId = generateUUID();
        this.connectionManager.setConnected(socket, payload.extensionVersion || '1.0.0');

        const ack: BridgeMessage<ServerHelloAckPayload> = {
          id: generateUUID(),
          type: 'SERVER_HELLO_ACK',
          timestamp: Date.now(),
          payload: {
            sessionId,
            status: 'authenticated',
            supportedActions: Object.values(BrowserAction)
          }
        };
        socket.send(JSON.stringify(ack));
        break;
      }

      case 'ACTION_RESULT': {
        if (!isAuthenticated) return;
        const payload = message.payload as ActionResultPayload;
        const pending = this.pendingActions.get(payload.requestId);
        if (pending) {
          clearTimeout(pending.timer);
          this.pendingActions.delete(payload.requestId);

          // Redact DOM snapshot data if present
          if (payload.data && pending.action === BrowserAction.GET_DOM) {
            payload.data = DataSanitizer.sanitizeSnapshot(payload.data);
          } else if (payload.data && pending.action === BrowserAction.GET_TEXT) {
            if (typeof payload.data === 'string') {
              payload.data = DataSanitizer.sanitizeText(payload.data);
            } else if (typeof payload.data.text === 'string') {
              payload.data.text = DataSanitizer.sanitizeText(payload.data.text);
            }
          }

          pending.resolve(payload);
        }
        break;
      }

      case 'PAGE_EVENT': {
        if (!isAuthenticated) return;
        if (message.payload?.tabs) {
          this.connectionManager.updateTabs(message.payload.tabs);
        }
        break;
      }

      case 'PING': {
        const pong: BridgeMessage = {
          id: message.id,
          type: 'PONG',
          timestamp: Date.now(),
          payload: {}
        };
        socket.send(JSON.stringify(pong));
        break;
      }
    }
  }

  /**
   * Execute an action on the browser through the bridge
   */
  public executeAction(
    action: BrowserAction,
    params: Record<string, any> = {},
    tabId?: number,
    timeoutMs = DEFAULT_ACTION_TIMEOUT_MS
  ): Promise<ActionResultPayload> {
    if (!this.connectionManager.isConnected()) {
      return Promise.reject(
        new BridgeConnectionError(
          'Chrome Extension is not connected. Please make sure the BrowserMCP extension is installed and running in Google Chrome.'
        )
      );
    }

    const socket = this.connectionManager.getSocket()!;
    const requestId = generateUUID();

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingActions.delete(requestId);
        reject(new ActionTimeoutError(action, timeoutMs));
      }, timeoutMs);

      this.pendingActions.set(requestId, {
        resolve,
        reject,
        timer,
        action
      });

      const message: BridgeMessage<ExecuteActionPayload> = {
        id: generateUUID(),
        type: 'EXECUTE_ACTION',
        timestamp: Date.now(),
        payload: {
          requestId,
          action,
          params,
          tabId
        }
      };

      try {
        socket.send(JSON.stringify(message));
      } catch (err) {
        clearTimeout(timer);
        this.pendingActions.delete(requestId);
        reject(err);
      }
    });
  }

  public stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.wss) {
        this.wss.close(() => {
          logger.info('Bridge server stopped');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }
}
