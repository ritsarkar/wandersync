export class ContentOverlay {
  private static hudElement: HTMLElement | null = null;
  private static statusTimer: number | null = null;

  /**
   * Ensure HUD floating badge is attached to DOM
   */
  public static initHUD(): void {
    if (this.hudElement || !document.body) return;

    this.hudElement = document.createElement('div');
    this.hudElement.id = 'bmcp-hud-badge';
    Object.assign(this.hudElement.style, {
      position: 'fixed',
      bottom: '16px',
      right: '16px',
      zIndex: '2147483640',
      backgroundColor: '#0f172a',
      color: '#f8fafc',
      padding: '8px 14px',
      borderRadius: '8px',
      fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      fontSize: '12px',
      fontWeight: '500',
      boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      pointerEvents: 'none',
      transition: 'all 0.2s ease',
      border: '1px solid #334155',
      opacity: '0.9'
    });

    const dot = document.createElement('span');
    Object.assign(dot.style, {
      width: '8px',
      height: '8px',
      borderRadius: '50%',
      backgroundColor: '#10b981',
      display: 'inline-block'
    });

    const text = document.createElement('span');
    text.id = 'bmcp-hud-text';
    text.textContent = 'BrowserMCP Ready';

    this.hudElement.appendChild(dot);
    this.hudElement.appendChild(text);
    document.body.appendChild(this.hudElement);
  }

  /**
   * Update status text on HUD badge temporarily
   */
  public static showStatus(message: string, durationMs = 3000): void {
    this.initHUD();
    const text = document.getElementById('bmcp-hud-text');
    if (text) {
      text.textContent = message;
    }

    if (this.statusTimer) {
      clearTimeout(this.statusTimer);
    }

    this.statusTimer = setTimeout(() => {
      if (text) text.textContent = 'BrowserMCP Ready';
    }, durationMs) as unknown as number;
  }

  /**
   * Highlight interactive elements with small badges showing @e1, @e2
   */
  public static highlightElements(): void {
    // Clear any previous badges
    document.querySelectorAll('.bmcp-ref-badge').forEach(b => b.remove());

    const taggedElements = document.querySelectorAll('[data-mcp-ref]');
    taggedElements.forEach(el => {
      const ref = el.getAttribute('data-mcp-ref');
      if (!ref) return;

      const rect = el.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) return;

      const badge = document.createElement('div');
      badge.className = 'bmcp-ref-badge';
      badge.textContent = `@e${ref}`;
      Object.assign(badge.style, {
        position: 'absolute',
        left: `${rect.left + window.scrollX}px`,
        top: `${Math.max(0, rect.top + window.scrollY - 18)}px`,
        backgroundColor: '#6366f1',
        color: '#ffffff',
        padding: '2px 5px',
        borderRadius: '4px',
        fontSize: '10px',
        fontWeight: '700',
        zIndex: '2147483642',
        pointerEvents: 'none',
        lineHeight: '1',
        boxShadow: '0 1px 4px rgba(0,0,0,0.3)'
      });

      document.body.appendChild(badge);
    });

    // Remove badges after 5 seconds
    setTimeout(() => {
      document.querySelectorAll('.bmcp-ref-badge').forEach(b => b.remove());
    }, 5000);
  }

  /**
   * Show in-page approval dialog for high-risk actions
   */
  public static promptApproval(action: string, reason: string): Promise<boolean> {
    return new Promise((resolve) => {
      const modalContainer = document.createElement('div');
      modalContainer.id = 'bmcp-approval-modal';
      Object.assign(modalContainer.style, {
        position: 'fixed',
        inset: '0',
        backgroundColor: 'rgba(15, 23, 42, 0.7)',
        backdropFilter: 'blur(4px)',
        zIndex: '2147483647',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
      });

      const card = document.createElement('div');
      Object.assign(card.style, {
        backgroundColor: '#1e293b',
        color: '#f8fafc',
        borderRadius: '12px',
        padding: '24px',
        width: '420px',
        maxWidth: '90vw',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5)',
        border: '1px solid #334155'
      });

      card.innerHTML = `
        <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 14px;">
          <div style="width: 32px; height: 32px; border-radius: 8px; background-color: #ef4444; display: flex; align-items: center; justify-content: center; font-weight: bold; color: white;">!</div>
          <div>
            <h3 style="margin: 0; font-size: 16px; font-weight: 600;">BrowserMCP Approval Required</h3>
            <p style="margin: 2px 0 0; font-size: 12px; color: #94a3b8;">An AI agent is requesting permission to perform an action.</p>
          </div>
        </div>
        <div style="background-color: #0f172a; padding: 12px; border-radius: 8px; margin-bottom: 18px; border: 1px solid #334155;">
          <div style="font-size: 11px; color: #64748b; text-transform: uppercase; font-weight: 700; margin-bottom: 4px;">Action</div>
          <div style="font-size: 14px; font-weight: 600; color: #38bdf8; margin-bottom: 8px;">${action}</div>
          <div style="font-size: 11px; color: #64748b; text-transform: uppercase; font-weight: 700; margin-bottom: 4px;">Reason</div>
          <div style="font-size: 13px; color: #cbd5e1;">${reason}</div>
        </div>
        <div style="display: flex; gap: 12px; justify-content: flex-end;">
          <button id="bmcp-btn-deny" style="padding: 8px 16px; border-radius: 6px; border: 1px solid #475569; background: transparent; color: #cbd5e1; font-weight: 500; cursor: pointer; font-size: 13px;">Deny</button>
          <button id="bmcp-btn-approve" style="padding: 8px 16px; border-radius: 6px; border: none; background: #3b82f6; color: white; font-weight: 500; cursor: pointer; font-size: 13px;">Approve Action</button>
        </div>
      `;

      modalContainer.appendChild(card);
      document.body.appendChild(modalContainer);

      const cleanup = () => modalContainer.remove();

      document.getElementById('bmcp-btn-approve')?.addEventListener('click', () => {
        cleanup();
        resolve(true);
      });

      document.getElementById('bmcp-btn-deny')?.addEventListener('click', () => {
        cleanup();
        resolve(false);
      });
    });
  }
}
