import { extractHostname } from '@browser-mcp/shared';

/**
 * Match a hostname against a pattern (supports wildcards like *.example.com)
 */
export function matchDomain(hostname: string, pattern: string): boolean {
  if (!hostname || !pattern) return false;
  hostname = hostname.toLowerCase().trim();
  pattern = pattern.toLowerCase().trim();

  if (pattern === '*' || pattern === hostname) {
    return true;
  }

  if (pattern.startsWith('*.')) {
    const root = pattern.slice(2);
    return hostname === root || hostname.endsWith('.' + root);
  }

  return hostname === pattern;
}

/**
 * Check if a URL matches any domain pattern in a list
 */
export function isDomainInList(urlOrHost: string, patterns: string[]): boolean {
  const host = urlOrHost.includes('://') ? extractHostname(urlOrHost) : urlOrHost.toLowerCase().trim();
  if (!host) return false;

  for (const pattern of patterns) {
    if (matchDomain(host, pattern)) {
      return true;
    }
  }
  return false;
}
