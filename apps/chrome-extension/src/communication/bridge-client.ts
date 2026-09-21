import {
  BridgeMessage,
  ClientHelloPayload,
  ExecuteActionPayload,
  ActionResultPayload
} from '@browser-mcp/protocol';
import { generateUUID, Logger } from '@browser-mcp/shared';
import { ExtensionPermissionManager } from '../permissions/permission-manager.js';

const logger = new Logger('BridgeClient');

export type ActionHandler = (payload: ExecuteActionPayload) => Promise<ActionResultPayload>;

export class BridgeClient {
  private socket: WebSocket | null = null;
  private isConnecting = false;
  private isDestroyed = false;
  private actionHandler: ActionHandler | null = null;
  private reconnectTimeout: number | null = null;
  private reconnectAttempts = 0;
  private heartbeatInterval: number | null = null;
  private port = 19999;
  private host = '127.0.0.1';
  private onStatusChange?: (connected: boolean) => void;

  constructor(onStatusChange?: (connected: boolean) => void) {
    this.onStatusChange = onStatusChange;
  }

  public setActionHandler(handler: ActionHandler): void {
    this.actionHandler = handler;
  }

  public async connect(): Promise<void> {
    if (this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) {
      return;
    }

    this.isConnecting = true;
    this.port = await ExtensionPermissionManager.getBridgePort();
    const token = await ExtensionPermissionManager.getAuthToken();
    const url = `ws://${this.host}:${this.port}`;

    try {
      this.socket = new WebSocket(url);

      this.socket.onopen = () => {
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        logger.info('Connected to BrowserMCP Bridge Server! Sending handshake...');
        this.sendHandshake(token);
        this.startHeartbeat();
        this.onStatusChange?.(true);
      };

      this.socket.onmessage = async (event) => {
        try {
          const message: BridgeMessage = JSON.parse(event.data);
          await this.handleMessage(message);
        } catch (err) {
          logger.error(`Error parsing incoming message: ${(err as Error).message}`);
        }
      };

      this.socket.onclose = () => {
        this.isConnecting = false;
        this.socket = null;
        this.stopHeartbeat();
        this.onStatusChange?.(false);
        this.scheduleReconnect();
      };

      this.socket.onerror = () => {
        // Handled cleanly in onclose
      };
    } catch {
      this.isConnecting = false;
      this.scheduleReconnect();
    }
  }

  private sendHandshake(token: string): void {
    const hello: BridgeMessage<ClientHelloPayload> = {
      id: generateUUID(),
      type: 'CLIENT_HELLO',
      timestamp: Date.now(),
      payload: {
        extensionVersion: '1.0.0',
        browser: 'Google Chrome',
        authToken: token
      }
    };
    this.send(hello);
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatInterval = setInterval(() => {
      if (this.isConnected()) {
        this.send({
          id: generateUUID(),
          type: 'PING',
          timestamp: Date.now(),
          payload: {}
        });
      }
    }, 20000) as unknown as number;
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  private scheduleReconnect(): void {
    if (this.isDestroyed || this.reconnectTimeout) return;
    this.reconnectAttempts++;
    const backoffMs = Math.min(3000 * Math.min(this.reconnectAttempts, 5), 15000);
    this.reconnectTimeout = setTimeout(() => {
      this.reconnectTimeout = null;
      this.connect();
    }, backoffMs) as unknown as number;
  }

  private async handleMessage(message: BridgeMessage): Promise<void> {
    switch (message.type) {
      case 'SERVER_HELLO_ACK':
        logger.info(`Bridge Handshake ACK: status = ${message.payload.status}`);
        break;

      case 'EXECUTE_ACTION': {
        const payload = message.payload as ExecuteActionPayload;
        logger.info(`Received action request: ${payload.action} (id: ${payload.requestId})`);

        if (!this.actionHandler) {
          this.sendResult({
            requestId: payload.requestId,
            success: false,
            error: 'No action handler registered in Chrome extension'
          });
          return;
        }

        try {
          const result = await this.actionHandler(payload);
          this.sendResult(result);
        } catch (err) {
          this.sendResult({
            requestId: payload.requestId,
            success: false,
            error: (err as Error).message
          });
        }
        break;
      }

      case 'PONG':
        // Heartbeat received
        break;
    }
  }

  public sendResult(result: ActionResultPayload): void {
    const message: BridgeMessage<ActionResultPayload> = {
      id: generateUUID(),
      type: 'ACTION_RESULT',
      timestamp: Date.now(),
      payload: result
    };
    this.send(message);
  }

  public send(msg: BridgeMessage): void {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(msg));
    }
  }

  public isConnected(): boolean {
    return this.socket !== null && this.socket.readyState === WebSocket.OPEN;
  }

  public disconnect(): void {
    this.isDestroyed = true;
    this.stopHeartbeat();
    if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
  }
}
