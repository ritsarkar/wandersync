import test from 'node:test';
import assert from 'node:assert/strict';
import { generateSecureToken, timingSafeEqual, isAllowedOrigin } from '@browser-mcp/security';

test('Security - Token Generation', () => {
  const token1 = generateSecureToken(16);
  const token2 = generateSecureToken(16);
  assert.equal(typeof token1, 'string');
  assert.equal(token1.length, 32); // hex of 16 bytes
  assert.notEqual(token1, token2);
});

test('Security - Timing Safe Equal', () => {
  const secret = 'my-secret-pairing-key-12345';
  assert.ok(timingSafeEqual(secret, 'my-secret-pairing-key-12345'));
  assert.ok(!timingSafeEqual(secret, 'wrong-key'));
  assert.ok(!timingSafeEqual(secret, 'my-secret-pairing-key-12346'));
});

test('Security - Origin Validation', () => {
  assert.ok(isAllowedOrigin(undefined)); // Local process
  assert.ok(isAllowedOrigin('chrome-extension://abcdefghijklmnopqrstuvwxyz123456'));
  assert.ok(isAllowedOrigin('http://localhost:3000'));
  assert.ok(isAllowedOrigin('http://127.0.0.1:8080'));
  assert.ok(!isAllowedOrigin('https://malicious-website.com'));
});
