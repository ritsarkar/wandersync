import { io } from 'socket.io-client';
import { sanitizeGroupId, isValidCoordinate, sanitizeString } from './server/security.js';
import { escapeHtml, sanitizeText, getSecureMqttChannel } from './src/utils/security.js';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    failed++;
  }
}

async function runSecurityTests() {
  console.log('\n🔒 ==========================================');
  console.log('   WANDERSYNC DEFENSIVE SECURITY TEST SUITE   ');
  console.log('==========================================\n');

  // Test 1: HTTP Security Headers
  console.log('1. Verifying Defensive HTTP Security Headers...');
  try {
    const res = await fetch('http://localhost:4000/api/health');
    assert(res.headers.get('x-content-type-options') === 'nosniff', 'X-Content-Type-Options: nosniff header present');
    assert(res.headers.get('x-frame-options') === 'SAMEORIGIN', 'X-Frame-Options: SAMEORIGIN header present');
    assert(res.headers.get('referrer-policy') === 'strict-origin-when-cross-origin', 'Referrer-Policy header present');
    assert(res.headers.get('permissions-policy')?.includes('geolocation=(self)'), 'Permissions-Policy header present');
  } catch (err) {
    assert(false, `Health check request failed: ${err.message}`);
  }

  // Test 2: Input Sanitization & Prototype Pollution Defense
  console.log('\n2. Testing Group ID & Prototype Pollution Defenses...');
  assert(sanitizeGroupId('__proto__') === 'WANDER-SQUAD', '__proto__ group ID rejected and safely redirected');
  assert(sanitizeGroupId('constructor') === 'WANDER-SQUAD', 'constructor group ID rejected');
  assert(sanitizeGroupId('prototype') === 'WANDER-SQUAD', 'prototype group ID rejected');
  assert(sanitizeGroupId('../../etc/passwd') === 'ETCPASSWD', 'Path traversal characters stripped from group ID');
  assert(sanitizeGroupId('trip-delhi-123') === 'TRIP-DELHI-123', 'Valid group IDs normalized to uppercase');

  // Test 3: Coordinate Range & Type Validation
  console.log('\n3. Testing Coordinate Validation Gates...');
  assert(isValidCoordinate(28.6139, 77.2090) === true, 'Valid Delhi coordinates accepted');
  assert(isValidCoordinate(91.0, 77.0) === false, 'Latitude > 90 rejected');
  assert(isValidCoordinate(-91.0, 77.0) === false, 'Latitude < -90 rejected');
  assert(isValidCoordinate(28.0, 185.0) === false, 'Longitude > 180 rejected');
  assert(isValidCoordinate('28.6139', 77.2090) === false, 'String latitude rejected (type safety)');
  assert(isValidCoordinate(NaN, 77.0) === false, 'NaN latitude rejected');
  assert(isValidCoordinate(Infinity, 77.0) === false, 'Infinity latitude rejected');

  // Test 4: Route API Coordinate Guard
  console.log('\n4. Testing Route Calculation API Input Rejection...');
  try {
    const res = await fetch('http://localhost:4000/api/routes/calculate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ startLat: 'malicious', startLng: 77.2, endLat: 28.5, endLng: 77.1 }),
    });
    assert(res.status === 400, 'Invalid coordinate types rejected with HTTP 400');
  } catch (err) {
    assert(false, `Route calculation test failed: ${err.message}`);
  }

  // Test 5: Stored XSS HTML Entity Sanitization
  console.log('\n5. Testing Stored XSS Sanitization & Entity Encoding...');
  const xssPayload1 = '<script>alert("XSS")</script>';
  const escaped1 = escapeHtml(xssPayload1);
  assert(!escaped1.includes('<script>') && escaped1.includes('&lt;script&gt;'), 'Script tags entity-encoded');
  
  const xssPayload2 = '<img src=x onerror=fetch("evil.site")>';
  const escaped2 = escapeHtml(xssPayload2);
  assert(!escaped2.includes('<img') && escaped2.includes('&lt;img'), 'Image onerror payload entity-encoded');

  const plainClean = sanitizeText('<b>Hello Traveler!</b>\u0000', 50);
  assert(plainClean === 'Hello Traveler!', 'HTML tags and null bytes stripped in plain text sanitization');

  // Test 6: Public MQTT Broker Channel Isolation & Anti-Snooping
  console.log('\n6. Testing MQTT Topic Cryptographic Isolation...');
  const chan1 = getSecureMqttChannel('TRIP-GOA-2026');
  const chan2 = getSecureMqttChannel('trip-goa-2026');
  const chan3 = getSecureMqttChannel('TRIP-MANALI-2026');
  assert(chan1 === chan2, 'Case-insensitive deterministic channel matching for valid group members');
  assert(chan1 !== chan3, 'Distinct trips mapped to isolated cryptographic channels');
  assert(!chan1.includes('TRIP-GOA'), 'Channel name is non-guessable hash (prevents wildcard snooping)');

  // Test 7: Socket Session Identity Binding & Spoofing Defense
  console.log('\n7. Testing Socket Identity Binding & Anti-Spoofing...');
  await new Promise((resolve) => {
    const socketAlice = io('http://localhost:4000', { transports: ['websocket'] });
    const socketBob = io('http://localhost:4000', { transports: ['websocket'] });
    const testGroupId = 'SEC-TEST-' + Date.now();

    socketAlice.on('connect', () => {
      socketAlice.emit('join_group', {
        groupId: testGroupId,
        profile: { id: 'alice-id', name: 'Alice Admin', isCreator: true },
      });

      socketBob.on('connect', () => {
        socketBob.emit('join_group', {
          groupId: testGroupId,
          profile: { id: 'bob-id', name: 'Bob Traveler', isCreator: false },
        });

        // Test 7a: Bob attempts to claim admin role while Alice is active
        socketBob.emit('claim_admin', { groupId: testGroupId });

        socketBob.on('permission_denied', (data) => {
          assert(data.message.includes('creator is currently active'), 'Opportunistic admin role hijacking blocked');

          // Test 7b: Bob attempts to spoof Alice location
          socketAlice.on('member_location_updated', (locData) => {
            if (locData.userId === 'alice-id' && locData.location.lat === 0.0) {
              assert(false, 'Location spoofing succeeded (VULNERABILITY DETECTED)');
            }
          });

          // Bob emits update_location with Alice's ID
          socketBob.emit('update_location', {
            groupId: testGroupId,
            userId: 'alice-id', // Spoofed target!
            location: { lat: 0.0, lng: 0.0, speed: 100 },
          });

          // Wait 600ms to confirm no spoofed update occurred
          setTimeout(() => {
            assert(true, 'Location spoofing attempt rejected by session binding gate');
            socketAlice.disconnect();
            socketBob.disconnect();
            resolve();
          }, 600);
        });
      });
    });
  });

  console.log('\n==========================================');
  console.log(`RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('==========================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runSecurityTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
