# Developer Getting Started Guide

This guide walks through configuring, building, and running BrowserMCP for local development and connecting it with Claude Desktop or ChatGPT.

---

## 1. Prerequisites
- **Node.js**: v18.0.0 or later (v24.x recommended)
- **npm**: v9.0.0 or later
- **Google Chrome**: Stable or Canary

---

## 2. Setup & Installation

```bash
# 1. Clone or navigate to the repository
cd browser-mcp

# 2. Install dependencies across all monorepo workspaces
npm install

# 3. Build shared packages and extension
npm run build
```

---

## 3. Load Chrome Extension

1. Open Google Chrome and go to `chrome://extensions`.
2. Toggle on **Developer mode** in the upper-right corner.
3. Click **Load unpacked**.
4. Select the directory: `<REPO_PATH>/apps/chrome-extension`.
5. Note the Extension Icon appearing in your toolbar!

---

## 4. Connect to Claude Desktop

Edit your Claude Desktop configuration file:
- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

Add the `browser-mcp` entry under `mcpServers`:

```json
{
  "mcpServers": {
    "browser-mcp": {
      "command": "node",
      "args": [
        "<FULL_PATH_TO_REPO>/apps/mcp-server/dist/index.js"
      ],
      "env": {
        "BROWSER_MCP_SECURITY_MODE": "MODERATE"
      }
    }
  }
}
```

Restart Claude Desktop. You will see the hammer icon with all 14 browser tools available!

---

## 5. Pairing Extension with Server

When the MCP Server starts, it generates a secure pairing token located at `~/.browser-mcp/token.json`.
1. Click the BrowserMCP extension icon in Chrome -> click **Configure Settings & Token**.
2. Paste the token from `~/.browser-mcp/token.json` (or verify it auto-connected).
3. The popup badge will turn green and say **Connected**.

---

## 6. Example AI Prompts to Try in Claude

- *"Open a new tab to https://news.ycombinator.com, read the top 3 stories, and summarize them for me."*
- *"Navigate to https://wikipedia.org and search for Quantum Computing."*
- *"Take a screenshot of the active tab and describe what is visible."*
