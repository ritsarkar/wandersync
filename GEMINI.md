# Engineering Protocol: Library-First & Token-Efficient Code

## Core Mandate: Search First, Minimize Tokens, Avoid Reinventing Wheels

Before writing or generating large blocks of custom code (>30 lines), the AI agent MUST adhere to this three-question protocol:

### 1. "Is it necessary?" (YAGNI & Scope Check)
- Challenge whether the feature or complexity is genuinely required right now.
- If it can be achieved with zero code, configuration, or removing dead code, do that first.

### 2. "Is there an existing shortcut or library?" (The Reuse Ladder)
Stop at the first level that solves the problem:
1. **Existing Repo Utilities**: Check existing helper functions and files first.
2. **Standard Library & Platform Features**: Use native capabilities (e.g. browser Web APIs, native `<dialog>`, `Intl`, CSS animations) instead of heavy custom code.
3. **Established Third-Party Libraries**: Search the web/npm (`search_web`) for reputable, lightweight libraries before attempting to write custom engines, math parsers, chart drawers, or complex UI components from scratch.
4. **Custom Implementation**: Only write custom code if no suitable library or native feature exists.

### 3. "Use Fewer Tokens"
- Writing 300 lines of custom code wastes thousands of output and input tokens on every turn.
- Prefer installing a battle-tested package (`npm install ...`) and writing 5–10 lines of clean glue code.
- Always report what library was selected and why it was chosen over manual coding.
