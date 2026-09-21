import type { WebSocket } from 'ws';
import type { ChromeTabInfo } from '@browser-mcp/protocol';
import { Logger } from '@browser-mcp/shared';

const logger = new Logger('ConnectionManager');

export class ExtensionConnectionManager {
  private activeSocket: WebSocket | null = null;
  private tabs: ChromeTabInfo[] = [];
  private activeTabId: number | null = null;
  private extensionVersion: string | null = null;

  public setConnected(socket: WebSocket, version: string): void {
    if (this.activeSocket && this.activeSocket !== socket) {
      try {
        this.activeSocket.close(1000, 'Superseded by new connection');
      } catch {
        // ignore
      }
    }
    this.activeSocket = socket;
    this.extensionVersion = version;
    logger.info(`Extension paired successfully (version: ${version})`);
  }

  public setDisconnected(socket: WebSocket): void {
    if (this.activeSocket === socket) {
      this.activeSocket = null;
      logger.warn('Extension connection closed');
    }
  }

  public isConnected(): boolean {
    return this.activeSocket !== null && this.activeSocket.readyState === 1; // 1 = OPEN
  }

  public getSocket(): WebSocket | null {
    return this.activeSocket;
  }

  public updateTabs(tabs: ChromeTabInfo[]): void {
    this.tabs = tabs;
    const active = tabs.find(t => t.active);
    if (active) {
      this.activeTabId = active.id;
    }
  }

  public getTabs(): ChromeTabInfo[] {
    return this.tabs;
  }

  public getActiveTabId(): number | null {
    return this.activeTabId;
  }

  public getExtensionVersion(): string | null {
    return this.extensionVersion;
  }
}
