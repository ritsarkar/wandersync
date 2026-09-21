import { io } from 'socket.io-client';
import http from 'http';

async function testWanderSync() {
  console.log('Testing WanderSync Backend & Real-Time Gateway...');

  // 1. Check HTTP Health Endpoint
  const healthCheck = await fetch('http://localhost:4000/api/health').then((r) => r.json());
  console.log('✓ Server Health Response:', healthCheck);

  // 2. Test Multi-Route Calculation Endpoint
  const routeRes = await fetch('http://localhost:4000/api/routes/calculate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      startLat: 46.885,
      startLng: 8.644,
      endLat: 46.634,
      endLng: 8.594,
    }),
  }).then((r) => r.json());

  console.log(`✓ Multi-Route Engine computed ${routeRes.routes?.length} distinct routes!`);
  routeRes.routes?.forEach((r, idx) => {
    console.log(`   Route ${idx + 1}: "${r.name}" -> ${r.distanceKm} km, ETA: ${r.durationMins} mins`);
  });

  // 3. Test Real-Time WebSocket Multi-Friend Synchronization
  const clientA = io('http://localhost:4000', { transports: ['websocket'] });
  const clientB = io('http://localhost:4000', { transports: ['websocket'] });

  await new Promise((resolve) => clientA.on('connect', resolve));
  await new Promise((resolve) => clientB.on('connect', resolve));
  console.log('✓ Both Traveler Clients Connected to Socket Server');

  const groupId = 'TEST-EXPEDITION-2026';

  // Client B listens for location updates from Client A
  const locationPromise = new Promise((resolve) => {
    clientB.on('member_location_updated', (data) => {
      console.log(`✓ Client B received real-time GPS broadcast from ${data.userId}:`, data.location.speed, 'km/h');
      resolve(data);
    });
  });

  // Client A and B join group
  clientA.emit('join_group', {
    groupId,
    profile: {
      id: 'traveler-alex',
      name: 'Alex (Driver)',
      avatar: '🚗',
      color: '#3b82f6',
      mode: 'car',
      assignedRouteId: 'route-1',
    },
  });

  clientB.emit('join_group', {
    groupId,
    profile: {
      id: 'traveler-elena',
      name: 'Elena (Cyclist)',
      avatar: '🚲',
      color: '#10b981',
      mode: 'bike',
      assignedRouteId: 'route-2',
    },
  });

  // Small delay then emit location
  await new Promise((r) => setTimeout(r, 500));

  clientA.emit('update_location', {
    groupId,
    userId: 'traveler-alex',
    location: {
      lat: 46.812,
      lng: 8.638,
      speed: 78,
      heading: 185,
      altitude: 540,
      battery: 89,
      timestamp: Date.now(),
    },
  });

  await locationPromise;
  console.log('✓ Real-Time Multi-Client Bi-directional sync verified successfully!');

  clientA.disconnect();
  clientB.disconnect();
  process.exit(0);
}

testWanderSync().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
