# BrowserMCP — AI-Controlled Browser Infrastructure

> **Universal browser-control layer enabling AI clients (ChatGPT, Claude, Cursor, Custom Agents) to safely inspect and operate Google Chrome via Model Context Protocol (MCP).**

---

## 🌟 Overview

**BrowserMCP** turns your real Google Chrome browser into an interactive, tool-driven environment for AI models. Without requiring fragile headless browser drivers, BrowserMCP uses a lightweight local-first architecture:

1. **AI Clients** (Claude Desktop, ChatGPT, Open-WebUI, CLI agents) connect to the **BrowserMCP Server** via standard MCP (Model Context Protocol).
2. **BrowserMCP Server** exposes tools for navigation, structured semantic DOM inspection, element clicking, form typing, tab switching, and screenshots.
3. A **Secure Local Bridge** (WebSocket with HMAC token authentication) links the MCP Server with the **BrowserMCP Chrome Extension**.
4. The **Chrome Extension** (Manifest V3) executes browser actions within your active sessions, authenticated profiles, and real tabs while enforcing safety policies and in-page user approval overlays for high-risk actions.

```
                         ┌──────────────┐
                         │     USER     │
                         └──────┬───────┘
                                │
                                v
                  ┌────────────────────────┐
                  │      AI CLIENTS        │
                  │                        │
                  │ ChatGPT | Claude | ... │
                  └───────────┬────────────┘
                              │
                              │ MCP (stdio / SSE)
                              v
                  ┌────────────────────────┐
                  │    BROWSERMCP MCP      │
                  │        SERVER          │
                  │                        │
                  │ Tools                  │
                  │ Permissions            │
                  │ Security               │
                  │ Tasks                  │
                  │ Logging                │
                  └───────────┬────────────┘
                              │
                              │ Secure Local Bridge (ws://127.0.0.1:19999)
                              v
                  ┌────────────────────────┐
                  │    CHROME EXTENSION    │
                  │                        │
                  │ DOM Reader             │
                  │ Element Finder         │
                  │ Action Executor        │
                  │ Tab Manager            │
                  │ Permission Manager     │
                  │ Approval System        │
                  └───────────┬────────────┘
                              │
                              v
                  ┌────────────────────────┐
                  │         CHROME         │
                  │                        │
                  │ Google                 │
                  │ LinkedIn               │
                  │ Gmail                  │
                  │ Amazon                 │
                  │ Other permitted sites  │
                  └────────────────────────┘
```

---

## 🚀 Key Features

- **Token-Efficient Semantic DOM Reader**: Converts messy HTML trees into compact accessibility snapshots tagged with element refs (`@e1`, `@e2`, `@e3`). Decreases prompt token consumption by 90%+ compared to raw HTML.
- **Full Action Suite**:
  - `browser_navigate`: Go to any URL, back, forward, or reload.
  - `browser_get_dom`: Returns structured page nodes with text, inputs, buttons, links, and bounding boxes.
  - `browser_get_text`: Clean article / markdown extraction.
  - `browser_click`: Click interactive elements by ref (`@e1`), CSS selector, or visible text.
  - `browser_type`: Type text into fields with realistic events, clearing, and optional submission.
  - `browser_press_key`: Trigger keyboard interactions (Enter, Tab, Escape, arrow keys).
  - `browser_scroll`: Smoothly scroll viewports or scrollable containers to elements or directions.
  - `browser_list_tabs`: View all open Chrome tabs with IDs, titles, URLs, and active states.
  - `browser_switch_tab` / `browser_new_tab` / `browser_close_tab`: Full tab lifecycle management.
  - `browser_screenshot`: Capture high-resolution viewport or element snapshots.
  - `browser_wait_for`: Poll for DOM elements or state changes with timeout.
  - `browser_evaluate`: Run sandboxed JavaScript expressions when authorized.
- **Safety & Permissions**:
  - Domain Allowlist & Blocklist.
  - High-risk action verification (e.g. form submissions, navigation away from allowed zones).
  - Automatic PII & credentials sanitization (strips passwords, tokens, and credit card patterns from DOM snapshots).
  - Visual in-page HUD & notification banner whenever the AI is interacting with a page.
- **Local-First & Private**:
  - No remote cloud servers, no telemetries, no third-party data relays.
  - Direct local communication between Chrome and your local AI client.

---

## 📦 Project Architecture

```
browser-mcp/
├── apps/
│   ├── website/             # Showcase portal, interactive demo & docs
│   ├── mcp-server/          # MCP Server (stdio / SSE) & WebSocket Bridge Server
│   └── chrome-extension/    # Chrome Extension Manifest V3 (Service Worker, Content Script, Popup, Options)
├── packages/
│   ├── protocol/            # Message schemas, RPC protocol, MCP tool definitions
│   ├── browser-core/        # DOM parsing, ref tagging (@e1), element finder, readability
│   ├── permissions/         # Policy engine, permission levels, domain matcher
│   ├── security/            # Token authentication, origin checks, PII redactor
│   └── shared/              # Shared utilities, loggers, error classes, constants
├── database/                # Local audit database schema & migrations
├── tests/                   # Unit, integration, security, and e2e test suites
└── docs/                    # Complete architecture, API, security, privacy & dev guides
```

---

## ⚡ Quick Start

### 1. Install Dependencies & Build
```bash
npm install
npm run build
```

### 2. Configure Claude Desktop
Add BrowserMCP to your Claude Desktop configuration (`claude_desktop_config.json`):
```json
{
  "mcpServers": {
    "browser-mcp": {
      "command": "node",
      "args": ["<PATH_TO_BROWSER_MCP>/apps/mcp-server/dist/index.js"]
    }
  }
}
```

### 3. Load Chrome Extension
1. Open Chrome and navigate to `chrome://extensions`.
2. Enable **Developer mode** in the top right.
3. Click **Load unpacked** and select the `apps/chrome-extension` directory.
4. The extension will automatically pair with your local BrowserMCP Server!

---

## 📄 License
MIT © BrowserMCP Authors
