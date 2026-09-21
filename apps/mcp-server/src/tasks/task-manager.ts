import { generateUUID } from '@browser-mcp/shared';
import { BrowserAction } from '@browser-mcp/protocol';

export interface TaskRecord {
  id: string;
  action: BrowserAction;
  params: Record<string, any>;
  status: 'pending' | 'running' | 'completed' | 'failed';
  result?: any;
  error?: string;
  startedAt: string;
  completedAt?: string;
  durationMs?: number;
}

export class TaskManager {
  private tasks: Map<string, TaskRecord> = new Map();
  private maxHistory = 100;

  public createTask(action: BrowserAction, params: Record<string, any>): TaskRecord {
    const task: TaskRecord = {
      id: generateUUID(),
      action,
      params,
      status: 'pending',
      startedAt: new Date().toISOString()
    };
    this.tasks.set(task.id, task);
    this.prune();
    return task;
  }

  public updateStatus(id: string, status: 'running' | 'completed' | 'failed', result?: any, error?: string): void {
    const task = this.tasks.get(id);
    if (!task) return;

    task.status = status;
    if (result !== undefined) task.result = result;
    if (error !== undefined) task.error = error;

    if (status === 'completed' || status === 'failed') {
      task.completedAt = new Date().toISOString();
      task.durationMs = new Date(task.completedAt).getTime() - new Date(task.startedAt).getTime();
    }
  }

  public getTask(id: string): TaskRecord | undefined {
    return this.tasks.get(id);
  }

  public listTasks(limit = 20): TaskRecord[] {
    return Array.from(this.tasks.values())
      .slice(-limit)
      .reverse();
  }

  private prune(): void {
    if (this.tasks.size > this.maxHistory) {
      const keys = Array.from(this.tasks.keys());
      const toRemove = keys.slice(0, keys.length - this.maxHistory);
      for (const k of toRemove) {
        this.tasks.delete(k);
      }
    }
  }
}
