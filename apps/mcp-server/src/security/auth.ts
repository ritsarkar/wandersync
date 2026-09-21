import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { generateSecureToken, timingSafeEqual } from '@browser-mcp/security';
import { Logger } from '@browser-mcp/shared';

const logger = new Logger('Auth');

export class BridgeAuthManager {
  private token: string;
  private tokenFilePath: string;

  constructor() {
    const configDir = path.join(os.homedir(), '.browser-mcp');
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }
    this.tokenFilePath = path.join(configDir, 'token.json');
    this.token = this.loadOrGenerateToken();
  }

  private loadOrGenerateToken(): string {
    if (process.env.BROWSER_MCP_TOKEN) {
      logger.info('Using BROWSER_MCP_TOKEN from environment variables');
      return process.env.BROWSER_MCP_TOKEN;
    }

    try {
      if (fs.existsSync(this.tokenFilePath)) {
        const data = JSON.parse(fs.readFileSync(this.tokenFilePath, 'utf-8'));
        if (data.token) {
          return data.token;
        }
      }
    } catch {
      // ignore and regenerate
    }

    const newToken = generateSecureToken(24);
    try {
      fs.writeFileSync(this.tokenFilePath, JSON.stringify({ token: newToken, createdAt: new Date().toISOString() }, null, 2));
      logger.info(`Generated new bridge auth token and saved to ${this.tokenFilePath}`);
    } catch (err) {
      logger.warn(`Could not save token file: ${(err as Error).message}`);
    }

    return newToken;
  }

  public getToken(): string {
    return this.token;
  }

  public validateToken(providedToken?: string): boolean {
    // If client provides no token (fresh install on localhost), allow pairing
    if (!providedToken) {
      logger.info('Allowing local extension pairing (token unset on client)');
      return true;
    }
    return timingSafeEqual(this.token, providedToken);
  }
}
