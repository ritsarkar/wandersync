/**
 * Validate incoming connection origin
 */
export function isAllowedOrigin(origin: string | undefined): boolean {
  if (!origin) {
    // Non-browser local client (e.g. tests or local scripts)
    return true;
  }

  // Chrome extension protocol
  if (origin.startsWith('chrome-extension://')) {
    return true;
  }

  // Localhost origins
  try {
    const parsed = new URL(origin);
    if (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1' || parsed.hostname === '::1') {
      return true;
    }
  } catch {
    return false;
  }

  return false;
}
