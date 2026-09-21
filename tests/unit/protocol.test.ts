import test from 'node:test';
import assert from 'node:assert/strict';
import {
  NavigateSchema,
  ClickSchema,
  TypeSchema,
  ScrollSchema,
  BROWSER_MCP_TOOLS,
  BrowserAction
} from '@browser-mcp/protocol';

test('Protocol - Tools registry has all 14 tools defined', () => {
  assert.equal(BROWSER_MCP_TOOLS.length, 14);
  const toolNames = BROWSER_MCP_TOOLS.map(t => t.name);
  assert.ok(toolNames.includes('browser_navigate'));
  assert.ok(toolNames.includes('browser_get_dom'));
  assert.ok(toolNames.includes('browser_get_text'));
  assert.ok(toolNames.includes('browser_click'));
  assert.ok(toolNames.includes('browser_type'));
  assert.ok(toolNames.includes('browser_press_key'));
  assert.ok(toolNames.includes('browser_scroll'));
  assert.ok(toolNames.includes('browser_screenshot'));
  assert.ok(toolNames.includes('browser_list_tabs'));
  assert.ok(toolNames.includes('browser_switch_tab'));
  assert.ok(toolNames.includes('browser_new_tab'));
  assert.ok(toolNames.includes('browser_close_tab'));
  assert.ok(toolNames.includes('browser_wait_for'));
  assert.ok(toolNames.includes('browser_evaluate'));
});

test('Protocol - NavigateSchema validates correctly', () => {
  const valid = NavigateSchema.safeParse({ url: 'https://example.com', newTab: true });
  assert.ok(valid.success);

  const invalid = NavigateSchema.safeParse({});
  assert.ok(!invalid.success);
});

test('Protocol - ClickSchema validates ref and selector', () => {
  const validRef = ClickSchema.safeParse({ ref: '@e1' });
  assert.ok(validRef.success);

  const validSelector = ClickSchema.safeParse({ selector: 'button.primary' });
  assert.ok(validSelector.success);
});

test('Protocol - TypeSchema validates parameters', () => {
  const valid = TypeSchema.safeParse({ ref: '@e2', text: 'Hello World', pressEnter: true });
  assert.ok(valid.success);

  const missingText = TypeSchema.safeParse({ ref: '@e2' });
  assert.ok(!missingText.success);
});
