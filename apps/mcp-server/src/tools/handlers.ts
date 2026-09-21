import { BrowserAction } from '@browser-mcp/protocol';
import { BrowserBridgeServer } from '../browser/bridge-server.js';
import { ServerPermissionValidator } from '../permissions/validator.js';
import { TaskManager } from '../tasks/task-manager.js';
import { Logger } from '@browser-mcp/shared';

const logger = new Logger('ToolHandlers');

export class BrowserToolHandlers {
  private bridge: BrowserBridgeServer;
  private validator: ServerPermissionValidator;
  private taskManager: TaskManager;

  constructor(bridge: BrowserBridgeServer, validator: ServerPermissionValidator, taskManager: TaskManager) {
    this.bridge = bridge;
    this.validator = validator;
    this.taskManager = taskManager;
  }

  private async runAction(action: BrowserAction, params: Record<string, any>, tabId?: number, timeoutMs?: number) {
    const task = this.taskManager.createTask(action, params);
    try {
      this.taskManager.updateStatus(task.id, 'running');
      this.validator.validateOrThrow(action, params.url);

      const result = await this.bridge.executeAction(action, params, tabId, timeoutMs);
      if (!result.success) {
        throw new Error(result.error || `Action ${action} failed in browser`);
      }

      this.taskManager.updateStatus(task.id, 'completed', result.data);
      return result.data;
    } catch (err) {
      const errorMsg = (err as Error).message;
      this.taskManager.updateStatus(task.id, 'failed', undefined, errorMsg);
      logger.error(`Error executing ${action}: ${errorMsg}`);
      throw err;
    }
  }

  public async navigate(args: any) {
    return await this.runAction(BrowserAction.NAVIGATE, args, args.tabId, args.timeoutMs || 30000);
  }

  public async getDom(args: any) {
    return await this.runAction(BrowserAction.GET_DOM, args, args.tabId);
  }

  public async getText(args: any) {
    return await this.runAction(BrowserAction.GET_TEXT, args, args.tabId);
  }

  public async click(args: any) {
    return await this.runAction(BrowserAction.CLICK, args, args.tabId);
  }

  public async type(args: any) {
    return await this.runAction(BrowserAction.TYPE, args, args.tabId);
  }

  public async pressKey(args: any) {
    return await this.runAction(BrowserAction.PRESS_KEY, args, args.tabId);
  }

  public async scroll(args: any) {
    return await this.runAction(BrowserAction.SCROLL, args, args.tabId);
  }

  public async screenshot(args: any) {
    return await this.runAction(BrowserAction.SCREENSHOT, args, args.tabId);
  }

  public async listTabs(_args: any) {
    return await this.runAction(BrowserAction.LIST_TABS, {});
  }

  public async switchTab(args: any) {
    return await this.runAction(BrowserAction.SWITCH_TAB, args);
  }

  public async newTab(args: any) {
    return await this.runAction(BrowserAction.NEW_TAB, args);
  }

  public async closeTab(args: any) {
    return await this.runAction(BrowserAction.CLOSE_TAB, args);
  }

  public async waitFor(args: any) {
    return await this.runAction(BrowserAction.WAIT_FOR, args, args.tabId, args.timeoutMs || 15000);
  }

  public async evaluate(args: any) {
    return await this.runAction(BrowserAction.EVALUATE, args, args.tabId);
  }
}
