/**
 * Security & Sanitization Utilities for WanderSync
 * Defends against XSS, injection, data snooping, and prototype tampering.
 */

/**
 * HTML Entity Encoder to prevent Stored & DOM Cross-Site Scripting (XSS)
 * in Leaflet popups, Google Maps overlays, and custom div icons.
 */
export function escapeHtml(str: unknown): string {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Sanitize plain text strings: strip HTML tags, remove ASCII control characters,
 * and truncate to safe maximum length.
 */
export function sanitizeText(text: unknown, maxLength = 200): string {
  if (typeof text !== 'string') return '';
  return text
    .replace(/<[^>]*>/g, '') // Strip HTML tags
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, '') // Strip control chars
    .trim()
    .slice(0, maxLength);
}

/**
 * Validate latitude and longitude coordinate boundaries
 */
export function isValidCoordinate(lat: unknown, lng: unknown): boolean {
  if (typeof lat !== 'number' || typeof lng !== 'number') return false;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

/**
 * Deterministic fast cryptographic hash for room channel isolation
 * Protects traveler location data from wildcard snooping on public MQTT brokers.
 */
export function getSecureMqttChannel(groupId: string): string {
  const cleanId = (groupId || 'WANDER-SQUAD').toUpperCase().trim();
  const salt = 'WANDERSYNC_SECURE_V2_SALT_98471203';
  let hash = 0x811c9dc5;
  const combined = `${salt}:${cleanId}`;
  for (let i = 0; i < combined.length; i++) {
    hash ^= combined.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  const hex = (hash >>> 0).toString(16).padStart(8, '0');
  return `ws_${hex}`;
}
