import { z } from 'zod';

/**
 * Standard Browser Actions supported by the BrowserMCP infrastructure
 */
export enum BrowserAction {
  NAVIGATE = 'navigate',
  CLICK = 'click',
  TYPE = 'type',
  PRESS_KEY = 'press_key',
  SCROLL = 'scroll',
  GET_DOM = 'get_dom',
  GET_TEXT = 'get_text',
  SCREENSHOT = 'screenshot',
  LIST_TABS = 'list_tabs',
  SWITCH_TAB = 'switch_tab',
  NEW_TAB = 'new_tab',
  CLOSE_TAB = 'close_tab',
  WAIT_FOR = 'wait_for',
  HIGHLIGHT = 'highlight',
  EVALUATE = 'evaluate',
  GET_STATUS = 'get_status'
}

/**
 * Interactive element representation for LLM context
 */
export interface BrowserElementNode {
  ref: string; // e.g. '@e1', '@e2'
  tagName: string;
  role?: string;
  text?: string;
  placeholder?: string;
  type?: string;
  value?: string;
  ariaLabel?: string;
  href?: string;
  disabled?: boolean;
  checked?: boolean;
  rect?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

/**
 * Structured DOM snapshot returned by the DOM Reader
 */
export interface DOMSnapshot {
  url: string;
  title: string;
  elementCount: number;
  interactiveElements: BrowserElementNode[];
  formattedTree: string;
  readableText?: string;
}

/**
 * Tab information
 */
export interface ChromeTabInfo {
  id: number;
  url: string;
  title: string;
  active: boolean;
  favIconUrl?: string;
  status?: string;
  windowId?: number;
}

/**
 * Action Parameter Schemas
 */
export const NavigateSchema = z.object({
  url: z.string().describe('URL to navigate to, e.g. https://www.google.com'),
  newTab: z.boolean().optional().describe('Whether to open in a new tab (defaults to false)'),
  timeoutMs: z.number().optional().describe('Navigation timeout in milliseconds (defaults to 15000)')
});
export type NavigateParams = z.infer<typeof NavigateSchema>;

export const ClickSchema = z.object({
  ref: z.string().optional().describe('Element reference identifier from browser_get_dom, e.g. "@e1"'),
  selector: z.string().optional().describe('CSS selector if ref is not used, e.g. "button#submit"'),
  text: z.string().optional().describe('Exact or partial text matching of the element'),
  tabId: z.number().optional().describe('Optional specific tab ID (defaults to active tab)')
});
export type ClickParams = z.infer<typeof ClickSchema>;

export const TypeSchema = z.object({
  ref: z.string().optional().describe('Element reference identifier from browser_get_dom, e.g. "@e2"'),
  selector: z.string().optional().describe('CSS selector of input/textarea'),
  text: z.string().describe('Text to type into the field'),
  clearFirst: z.boolean().optional().describe('Whether to clear current input content before typing (defaults to true)'),
  pressEnter: z.boolean().optional().describe('Whether to simulate pressing the Enter key after typing (defaults to false)'),
  tabId: z.number().optional().describe('Optional specific tab ID')
});
export type TypeParams = z.infer<typeof TypeSchema>;

export const PressKeySchema = z.object({
  key: z.string().describe('Key name: Enter, Tab, Escape, ArrowDown, ArrowUp, Backspace, etc.'),
  count: z.number().optional().describe('Number of times to repeat the key press (defaults to 1)'),
  tabId: z.number().optional().describe('Optional specific tab ID')
});
export type PressKeyParams = z.infer<typeof PressKeySchema>;

export const ScrollSchema = z.object({
  direction: z.enum(['up', 'down', 'top', 'bottom']).optional().describe('Direction to scroll'),
  amount: z.number().optional().describe('Pixel distance to scroll (defaults to 500)'),
  ref: z.string().optional().describe('Scroll a specific element into view or scroll inside it'),
  tabId: z.number().optional().describe('Optional specific tab ID')
});
export type ScrollParams = z.infer<typeof ScrollSchema>;

export const GetDomSchema = z.object({
  tabId: z.number().optional().describe('Optional specific tab ID (defaults to active tab)'),
  maxElements: z.number().optional().describe('Maximum number of interactive elements to index (defaults to 150)'),
  highlightInteractive: z.boolean().optional().describe('Highlight interactive elements with visual ref labels on page'),
  includeTextContent: z.boolean().optional().describe('Include clean extracted text along with interactive elements')
});
export type GetDomParams = z.infer<typeof GetDomSchema>;

export const GetTextSchema = z.object({
  tabId: z.number().optional().describe('Optional specific tab ID'),
  selector: z.string().optional().describe('Specific container selector to extract text from, defaults to entire page body'),
  format: z.enum(['markdown', 'plain']).optional().describe('Output format: "markdown" or "plain"')
});
export type GetTextParams = z.infer<typeof GetTextSchema>;

export const ScreenshotSchema = z.object({
  tabId: z.number().optional().describe('Optional specific tab ID'),
  fullPage: z.boolean().optional().describe('Capture full scrollable page if possible (defaults to false)'),
  format: z.enum(['jpeg', 'png']).optional().describe('Image format (defaults to png)'),
  quality: z.number().optional().describe('Quality level for jpeg (0-100)')
});
export type ScreenshotParams = z.infer<typeof ScreenshotSchema>;

export const ListTabsSchema = z.object({});
export type ListTabsParams = z.infer<typeof ListTabsSchema>;

export const SwitchTabSchema = z.object({
  tabId: z.number().describe('The Chrome tab ID to activate')
});
export type SwitchTabParams = z.infer<typeof SwitchTabSchema>;

export const NewTabSchema = z.object({
  url: z.string().optional().describe('URL to open in the new tab, defaults to about:blank')
});
export type NewTabParams = z.infer<typeof NewTabSchema>;

export const CloseTabSchema = z.object({
  tabId: z.number().describe('The Chrome tab ID to close')
});
export type CloseTabParams = z.infer<typeof CloseTabSchema>;

export const WaitForSchema = z.object({
  selector: z.string().describe('CSS selector to wait for on the page'),
  state: z.enum(['visible', 'attached', 'hidden']).optional().describe('Desired state (defaults to visible)'),
  timeoutMs: z.number().optional().describe('Timeout in milliseconds (defaults to 10000)'),
  tabId: z.number().optional().describe('Optional specific tab ID')
});
export type WaitForParams = z.infer<typeof WaitForSchema>;

export const EvaluateSchema = z.object({
  script: z.string().describe('JavaScript code expression to execute in active page context'),
  tabId: z.number().optional().describe('Optional specific tab ID')
});
export type EvaluateParams = z.infer<typeof EvaluateSchema>;

/**
 * WebSocket Bridge Message Envelopes
 */
export type BridgeMessageType =
  | 'CLIENT_HELLO'
  | 'SERVER_HELLO_ACK'
  | 'EXECUTE_ACTION'
  | 'ACTION_RESULT'
  | 'REQUEST_APPROVAL'
  | 'APPROVAL_DECISION'
  | 'PAGE_EVENT'
  | 'PING'
  | 'PONG'
  | 'ERROR';

export interface BridgeMessage<T = any> {
  id: string;
  type: BridgeMessageType;
  timestamp: number;
  payload: T;
}

export interface ClientHelloPayload {
  extensionVersion: string;
  browser: string;
  authToken?: string;
}

export interface ServerHelloAckPayload {
  sessionId: string;
  status: 'authenticated' | 'unauthorized';
  supportedActions: string[];
}

export interface ExecuteActionPayload {
  action: BrowserAction;
  params: Record<string, any>;
  tabId?: number;
  requestId: string;
}

export interface ActionResultPayload {
  requestId: string;
  success: boolean;
  data?: any;
  error?: string;
  tabId?: number;
  url?: string;
}

export interface RequestApprovalPayload {
  approvalId: string;
  action: BrowserAction;
  params: Record<string, any>;
  domain: string;
  reason: string;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
}

export interface ApprovalDecisionPayload {
  approvalId: string;
  approved: boolean;
  rememberDomain?: boolean;
}
