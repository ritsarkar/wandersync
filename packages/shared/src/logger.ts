export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export class Logger {
  private context: string;

  constructor(context: string) {
    this.context = context;
  }

  private format(level: LogLevel, message: string): string {
    const timestamp = new Date().toISOString();
    return `[${timestamp}] [${level.toUpperCase()}] [${this.context}] ${message}`;
  }

  debug(message: string, ...args: any[]): void {
    try {
      if (typeof process !== 'undefined' && process.env && (process.env.DEBUG || process.env.NODE_ENV === 'development')) {
        console.error(this.format('debug', message), ...args);
      }
    } catch {
      // ignore
    }
  }

  info(message: string, ...args: any[]): void {
    console.error(this.format('info', message), ...args);
  }

  warn(message: string, ...args: any[]): void {
    console.error(this.format('warn', message), ...args);
  }

  error(message: string, ...args: any[]): void {
    console.error(this.format('error', message), ...args);
  }
}
