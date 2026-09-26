/**
 * Backend Security & Sanitization Utilities for WanderSync Server
 */

/**
 * Sanitize and validate Travel Group IDs
 * Rejects prototype pollution attempts and enforces clean alphanumeric format.
 */
export function sanitizeGroupId(groupId) {
  if (!groupId || typeof groupId !== 'string') {
    return 'WANDER-SQUAD';
  }
  const clean = groupId.toUpperCase().trim().replace(/[^A-Z0-9_-]/g, '').slice(0, 32);
  const FORBIDDEN = ['__PROTO__', 'CONSTRUCTOR', 'PROTOTYPE'];
  if (!clean || FORBIDDEN.includes(clean)) {
    return 'WANDER-SQUAD';
  }
  return clean;
}

/**
 * Validate latitude and longitude coordinate boundaries
 */
export function isValidCoordinate(lat, lng) {
  if (typeof lat !== 'number' || typeof lng !== 'number') return false;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

/**
 * Sanitize untrusted text input (names, messages, waypoint labels)
 */
export function sanitizeString(text, maxLength = 200) {
  if (typeof text !== 'string') return '';
  return text
    .replace(/<[^>]*>/g, '') // Strip HTML tags
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, '') // Strip control chars
    .trim()
    .slice(0, maxLength);
}

/**
 * Express middleware for defensive HTTP security headers
 */
export function securityHeadersMiddleware(req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  // Allow scripts and assets needed for Google Maps, Leaflet, and fonts
  res.setHeader(
    'Permissions-Policy',
    'geolocation=(self)'
  );
  next();
}
