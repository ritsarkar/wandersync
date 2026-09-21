import test from 'node:test';
import assert from 'node:assert/strict';
import { PermissionEngine, matchDomain, SecurityMode } from '@browser-mcp/permissions';
import { BrowserAction } from '@browser-mcp/protocol';

test('Permissions - Domain Wildcard Matching', () => {
  assert.ok(matchDomain('github.com', 'github.com'));
  assert.ok(matchDomain('api.github.com', '*.github.com'));
  assert.ok(matchDomain('docs.sub.github.com', '*.github.com'));
  assert.ok(!matchDomain('fakegithub.com', '*.github.com'));
  assert.ok(!matchDomain('google.com', 'github.com'));
});

test('Permissions - Sensitive Domain Blocklist', () => {
  const engine = new PermissionEngine({
    mode: SecurityMode.MODERATE,
    blocklist: ['paypal.com', '*.bankofamerica.com']
  });

  const paypalDecision = engine.evaluate(BrowserAction.CLICK, 'https://paypal.com/signin');
  assert.equal(paypalDecision.decision, 'BLOCK');

  const bofaDecision = engine.evaluate(BrowserAction.NAVIGATE, 'https://secure.bankofamerica.com/login');
  assert.equal(bofaDecision.decision, 'BLOCK');

  const githubDecision = engine.evaluate(BrowserAction.CLICK, 'https://github.com');
  assert.equal(githubDecision.decision, 'ALLOW');
});

test('Permissions - Security Modes', () => {
  const strictEngine = new PermissionEngine({ mode: SecurityMode.STRICT });
  const moderateEngine = new PermissionEngine({ mode: SecurityMode.MODERATE });
  const unrestrictEngine = new PermissionEngine({ mode: SecurityMode.UNRESTRICTED });

  // Read-only actions allowed in all modes
  assert.equal(strictEngine.evaluate(BrowserAction.GET_DOM, 'https://example.com').decision, 'ALLOW');
  assert.equal(moderateEngine.evaluate(BrowserAction.GET_DOM, 'https://example.com').decision, 'ALLOW');

  // Interactive action requires approval in STRICT mode
  assert.equal(strictEngine.evaluate(BrowserAction.CLICK, 'https://example.com').decision, 'REQUIRE_APPROVAL');
  assert.equal(moderateEngine.evaluate(BrowserAction.CLICK, 'https://example.com').decision, 'ALLOW');

  // Critical action (evaluate) requires approval in MODERATE but allowed in UNRESTRICTED
  assert.equal(moderateEngine.evaluate(BrowserAction.EVALUATE, 'https://example.com').decision, 'REQUIRE_APPROVAL');
  assert.equal(unrestrictEngine.evaluate(BrowserAction.EVALUATE, 'https://example.com').decision, 'ALLOW');
});
