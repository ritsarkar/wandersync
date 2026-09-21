-- Migration 001: Initial BrowserMCP Schema
CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    action TEXT NOT NULL,
    domain TEXT,
    url TEXT,
    tab_id INTEGER,
    risk_level TEXT NOT NULL,
    decision TEXT NOT NULL,
    user_approved BOOLEAN DEFAULT 0,
    success BOOLEAN NOT NULL,
    error_message TEXT,
    duration_ms INTEGER,
    client_version TEXT
);

CREATE TABLE IF NOT EXISTS ai_tasks (
    id TEXT PRIMARY KEY,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME,
    action TEXT NOT NULL,
    parameters_json TEXT,
    result_json TEXT,
    status TEXT NOT NULL,
    duration_ms INTEGER,
    error TEXT
);

CREATE TABLE IF NOT EXISTS domain_rules (
    domain TEXT PRIMARY KEY,
    policy TEXT NOT NULL, -- ALLOW, BLOCK, REQUIRE_APPROVAL
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    notes TEXT
);
