import {
  NavigateSchema,
  ClickSchema,
  TypeSchema,
  PressKeySchema,
  ScrollSchema,
  GetDomSchema,
  GetTextSchema,
  ScreenshotSchema,
  ListTabsSchema,
  SwitchTabSchema,
  NewTabSchema,
  CloseTabSchema,
  WaitForSchema,
  EvaluateSchema
} from './types.js';

export interface MCPToolDefinition {
  name: string;
  description: string;
  parameters: any;
}

export const BROWSER_MCP_TOOLS: MCPToolDefinition[] = [
  {
    name: 'browser_navigate',
    description: 'Navigate the browser to a given URL, reload, or navigate back/forward.',
    parameters: NavigateSchema
  },
  {
    name: 'browser_get_dom',
    description: 'Extract a clean, token-efficient semantic accessibility snapshot of the current page with tagged interactive elements (ref=@e1, @e2, etc.).',
    parameters: GetDomSchema
  },
  {
    name: 'browser_get_text',
    description: 'Extract readable main content and text from the webpage in clean Markdown or plain text format.',
    parameters: GetTextSchema
  },
  {
    name: 'browser_click',
    description: 'Click an element on the webpage by its ref identifier (e.g. "@e1"), CSS selector, or visible text.',
    parameters: ClickSchema
  },
  {
    name: 'browser_type',
    description: 'Type text into an input field or contenteditable element with realistic simulated keyboard input.',
    parameters: TypeSchema
  },
  {
    name: 'browser_press_key',
    description: 'Press a keyboard key (e.g. Enter, Tab, Escape, ArrowDown, Backspace) on the active element.',
    parameters: PressKeySchema
  },
  {
    name: 'browser_scroll',
    description: 'Scroll the browser page or a specific container up, down, top, bottom, or to an element.',
    parameters: ScrollSchema
  },
  {
    name: 'browser_screenshot',
    description: 'Capture a screenshot of the current active browser tab or viewport.',
    parameters: ScreenshotSchema
  },
  {
    name: 'browser_list_tabs',
    description: 'List all currently open tabs in Google Chrome with their tab IDs, titles, URLs, and active status.',
    parameters: ListTabsSchema
  },
  {
    name: 'browser_switch_tab',
    description: 'Switch the active view to a specific tab by its tab ID.',
    parameters: SwitchTabSchema
  },
  {
    name: 'browser_new_tab',
    description: 'Open a new tab in Google Chrome with an optional target URL.',
    parameters: NewTabSchema
  },
  {
    name: 'browser_close_tab',
    description: 'Close an open Chrome tab by its tab ID.',
    parameters: CloseTabSchema
  },
  {
    name: 'browser_wait_for',
    description: 'Wait until an element matching a CSS selector is visible or present on the page.',
    parameters: WaitForSchema
  },
  {
    name: 'browser_evaluate',
    description: 'Execute a sandboxed JavaScript expression in the context of the active tab (subject to security policy).',
    parameters: EvaluateSchema
  }
];
