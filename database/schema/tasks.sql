-- BrowserMCP AI Tasks Schema (SQLite compatible)
CREATE TABLE IF NOT EXISTS ai_tasks (
    id TEXT PRIMARY KEY,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME,
    action TEXT NOT NULL,
    parameters_json TEXT,
    result_json TEXT,
    status TEXT NOT NULL, -- pending, running, completed, failed
    duration_ms INTEGER,
    error TEXT
);

CREATE INDEX IF NOT EXISTS idx_ai_tasks_status ON ai_tasks(status);
CREATE INDEX IF NOT EXISTS idx_ai_tasks_created_at ON ai_tasks(created_at);
