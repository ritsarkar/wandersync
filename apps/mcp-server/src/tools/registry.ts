import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool
} from '@modelcontextprotocol/sdk/types.js';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { BROWSER_MCP_TOOLS } from '@browser-mcp/protocol';
import { BrowserToolHandlers } from './handlers.js';
import { Logger } from '@browser-mcp/shared';

const logger = new Logger('ToolRegistry');

export function registerBrowserTools(server: Server, handlers: BrowserToolHandlers): void {
  // Convert Zod schemas to JSON Schema for MCP registration
  const tools: Tool[] = BROWSER_MCP_TOOLS.map(t => {
    const jsonSchema = (zodToJsonSchema as any)(t.parameters, { target: 'openApi3' });
    // Remove top-level $schema to conform to strict MCP tool schemas
    delete (jsonSchema as any).$schema;

    return {
      name: t.name,
      description: t.description,
      inputSchema: jsonSchema as any
    };
  });

  // Handler for listing available tools
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return { tools };
  });

  // Handler for executing tool calls
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args = {} } = request.params;
    logger.info(`Received tool invocation: ${name} with args: ${JSON.stringify(args)}`);

    try {
      let result: any;
      switch (name) {
        case 'browser_navigate':
          result = await handlers.navigate(args);
          break;
        case 'browser_get_dom':
          result = await handlers.getDom(args);
          break;
        case 'browser_get_text':
          result = await handlers.getText(args);
          break;
        case 'browser_click':
          result = await handlers.click(args);
          break;
        case 'browser_type':
          result = await handlers.type(args);
          break;
        case 'browser_press_key':
          result = await handlers.pressKey(args);
          break;
        case 'browser_scroll':
          result = await handlers.scroll(args);
          break;
        case 'browser_screenshot':
          result = await handlers.screenshot(args);
          break;
        case 'browser_list_tabs':
          result = await handlers.listTabs(args);
          break;
        case 'browser_switch_tab':
          result = await handlers.switchTab(args);
          break;
        case 'browser_new_tab':
          result = await handlers.newTab(args);
          break;
        case 'browser_close_tab':
          result = await handlers.closeTab(args);
          break;
        case 'browser_wait_for':
          result = await handlers.waitFor(args);
          break;
        case 'browser_evaluate':
          result = await handlers.evaluate(args);
          break;
        default:
          throw new Error(`Unknown browser tool: ${name}`);
      }

      // Handle screenshot image output vs text output
      if (name === 'browser_screenshot' && result?.image) {
        return {
          content: [
            {
              type: 'image',
              data: result.image,
              mimeType: result.mimeType || 'image/png'
            }
          ]
        };
      }

      const textResponse = typeof result === 'string' ? result : JSON.stringify(result, null, 2);
      return {
        content: [
          {
            type: 'text',
            text: textResponse
          }
        ]
      };
    } catch (err) {
      const errorMsg = (err as Error).message;
      logger.error(`Error in tool ${name}: ${errorMsg}`);
      return {
        isError: true,
        content: [
          {
            type: 'text',
            text: `BrowserMCP Error [${name}]: ${errorMsg}`
          }
        ]
      };
    }
  });
}
