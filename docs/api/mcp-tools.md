# BrowserMCP Tools Reference

This document provides the complete API reference for all Model Context Protocol (MCP) tools provided by **BrowserMCP**.

---

## 1. Navigation & Page Management

### `browser_navigate`
Navigates the browser to a target URL, back/forward, or reloads.
- **Parameters**:
  - `url` *(string, required)*: The URL to navigate to (e.g. `https://news.ycombinator.com`).
  - `newTab` *(boolean, optional)*: Open in a new tab instead of the current active tab (default: `false`).
  - `timeoutMs` *(number, optional)*: Navigation timeout in milliseconds (default: `30000`).
- **Response**: `{ "url": "...", "title": "..." }`

### `browser_list_tabs`
Returns a list of all currently open Chrome tabs.
- **Parameters**: None
- **Response**:
  ```json
  {
    "tabs": [
      {
        "id": 104,
        "title": "GitHub: Let's build from here",
        "url": "https://github.com",
        "active": true
      }
    ]
  }
  ```

### `browser_switch_tab`
Switches focus to an existing tab by tab ID.
- **Parameters**:
  - `tabId` *(number, required)*: The ID of the tab to focus.

### `browser_new_tab`
Opens a new blank tab or specified URL.
- **Parameters**:
  - `url` *(string, optional)*: Initial URL (default: `about:blank`).

### `browser_close_tab`
Closes an open tab.
- **Parameters**:
  - `tabId` *(number, required)*: The ID of the tab to close.

---

## 2. DOM Inspection & Content Extraction

### `browser_get_dom`
Extracts a clean, token-efficient semantic accessibility snapshot of the current active page. Each interactive element is assigned an identifier ref (e.g. `@e1`, `@e2`) that can be targeted in subsequent clicks or typing actions.
- **Parameters**:
  - `maxElements` *(number, optional)*: Maximum number of interactive elements to tag (default: `150`).
  - `highlightInteractive` *(boolean, optional)*: Display visual ref badges on the page (default: `false`).
  - `includeTextContent` *(boolean, optional)*: Include cleaned article body text (default: `false`).
- **Response**:
  ```json
  {
    "url": "https://example.com",
    "title": "Example Domain",
    "elementCount": 2,
    "formattedTree": "[@e1] <a href=\"https://www.iana.org/domains/example\"> \"More information...\" -> https://www.iana.org/domains/example",
    "interactiveElements": [
      {
        "ref": "@e1",
        "tagName": "a",
        "text": "More information...",
        "href": "https://www.iana.org/domains/example",
        "rect": { "x": 100, "y": 240, "width": 120, "height": 18 }
      }
    ]
  }
  ```

### `browser_get_text`
Extracts readable main body text in Markdown or plain text format, automatically stripping scripts, ads, and navigation clutter.
- **Parameters**:
  - `selector` *(string, optional)*: Specific CSS container (default: entire document).
  - `format` *(enum: "markdown" | "plain", optional)*: Output format (default: `"markdown"`).

### `browser_screenshot`
Captures a viewport screenshot of the target tab.
- **Parameters**:
  - `tabId` *(number, optional)*: Target tab ID (default: active tab).
  - `format` *(enum: "jpeg" | "png", optional)*: Image format (default: `"png"`).
  - `quality` *(number, optional)*: JPEG quality 0-100 (default: `90`).
- **Response**: Returns standard MCP image content `{ "type": "image", "data": "base64...", "mimeType": "image/png" }`.

---

## 3. User Interactions & Automation

### `browser_click`
Simulates an authentic user mouse click on an element.
- **Parameters**:
  - `ref` *(string, optional)*: Element reference from `browser_get_dom` (e.g. `"@e1"`).
  - `selector` *(string, optional)*: CSS selector fallback (e.g. `"button.submit-btn"`).
  - `text` *(string, optional)*: Text match fallback (e.g. `"Sign in"`).

### `browser_type`
Simulates authentic keyboard typing into an input or textarea element.
- **Parameters**:
  - `ref` *(string, optional)*: Element reference (e.g. `"@e2"`).
  - `selector` *(string, optional)*: CSS selector.
  - `text` *(string, required)*: Text to type.
  - `clearFirst` *(boolean, optional)*: Clear existing field contents before typing (default: `true`).
  - `pressEnter` *(boolean, optional)*: Trigger Enter key press after typing (default: `false`).

### `browser_press_key`
Simulates pressing a keyboard key on the active element.
- **Parameters**:
  - `key` *(string, required)*: Key name (`"Enter"`, `"Tab"`, `"Escape"`, `"ArrowDown"`, `"ArrowUp"`, `"Backspace"`).
  - `count` *(number, optional)*: Repetitions (default: `1`).

### `browser_scroll`
Scrolls the window or an element container.
- **Parameters**:
  - `direction` *(enum: "up" | "down" | "top" | "bottom", optional)*: Direction (default: `"down"`).
  - `amount` *(number, optional)*: Distance in pixels (default: `500`).
  - `ref` *(string, optional)*: Scroll inside a specific element container.

### `browser_wait_for`
Waits for an element matching a CSS selector to appear in the DOM.
- **Parameters**:
  - `selector` *(string, required)*: CSS selector to wait for.
  - `timeoutMs` *(number, optional)*: Timeout in milliseconds (default: `10000`).

### `browser_evaluate`
Executes a sandboxed JavaScript expression in the context of the page (requires permission in Strict/Moderate mode).
- **Parameters**:
  - `script` *(string, required)*: JavaScript expression string.
