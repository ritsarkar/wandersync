-- BrowserMCP Audit Log Schema (SQLite compatible)
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

CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_audit_logs_domain ON audit_logs(domain);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
