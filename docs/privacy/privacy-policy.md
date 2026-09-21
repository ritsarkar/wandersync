# BrowserMCP Privacy Assurances & Guarantees

## 1. Zero Cloud Relay
BrowserMCP contains **no cloud backend servers, no analytics beacons, and no telemetry services**. All communication is strictly local:
`AI Client (Local / Desktop) <--> MCP Server (Localhost) <--> Chrome Extension (Localhost) <--> Chrome Tabs`.

## 2. No AI Training on User Browsing
BrowserMCP does not collect, retain, or feed your browser content, tabs, or DOM trees to any AI training dataset. When an AI client (such as Claude Desktop or ChatGPT) invokes an MCP tool, the data is delivered directly to the client under the privacy agreement you hold with your AI provider.

## 3. Data Redaction at Source
Before page DOM trees or extracted text are returned to the calling AI client:
- Form passwords are never sent in plain text.
- Credit cards, government IDs, and cryptographic keys are masked automatically.

## 4. Local Audit Log
Any action history recorded by BrowserMCP remains on your local filesystem (`database/` or `~/.browser-mcp/`) and can be cleared or audited at any time.
