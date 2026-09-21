#!/usr/bin/env node
import dotenv from 'dotenv';
dotenv.config();

import { BrowserMcpServer } from './server/mcp-server.js';
import { Logger } from '@browser-mcp/shared';

const logger = new Logger('Main');

async function main() {
  const server = new BrowserMcpServer();

  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}, shutting down BrowserMCP server gracefully...`);
    try {
      await server.stop();
      process.exit(0);
    } catch (err) {
      logger.error(`Error during shutdown: ${(err as Error).message}`);
      process.exit(1);
    }
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  try {
    await server.start();
  } catch (err) {
    logger.error(`Fatal error starting BrowserMCP Server: ${(err as Error).message}`);
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Unhandled fatal error:', err);
  process.exit(1);
});
