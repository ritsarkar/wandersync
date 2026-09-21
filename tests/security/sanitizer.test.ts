import test from 'node:test';
import assert from 'node:assert/strict';
import { DataSanitizer } from '@browser-mcp/security';

test('Security - Redact Credit Card Numbers', () => {
  const input = 'User credit card is 4532-1234-5678-9012 on checkout page';
  const sanitized = DataSanitizer.sanitizeText(input);
  assert.ok(!sanitized.includes('4532-1234-5678-9012'));
  assert.ok(sanitized.includes('[REDACTED_CREDIT_CARD]'));
});

test('Security - Redact Social Security Numbers', () => {
  const input = 'SSN on record: 123-45-6789.';
  const sanitized = DataSanitizer.sanitizeText(input);
  assert.ok(!sanitized.includes('123-45-6789'));
  assert.ok(sanitized.includes('[REDACTED_SSN]'));
});

test('Security - Redact Password Element Values', () => {
  const passwordNode = {
    ref: '@e1',
    tagName: 'input',
    type: 'password',
    value: 'SuperSecret123!'
  };

  const sanitized = DataSanitizer.sanitizeElement(passwordNode);
  assert.equal(sanitized.value, '[REDACTED_PASSWORD]');
});

test('Security - Redact JWT Tokens', () => {
  const jwt = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.doNotLeakThisSignature';
  const input = `Auth token header: Bearer ${jwt}`;
  const sanitized = DataSanitizer.sanitizeText(input);
  assert.ok(!sanitized.includes('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9'));
  assert.ok(sanitized.includes('[REDACTED_JWT]'));
});
