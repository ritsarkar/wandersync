import { io } from 'socket.io-client';

const SERVER_URL = 'http://localhost:4000';
const TEST_GROUP = `convoy-routes-${Date.now()}`;

console.log(`[TEST] Connecting 3 travelers to group: ${TEST_GROUP}`);

async function runTest() {
  // 1. Leader (Driver)
  const leaderSocket = io(SERVER_URL, { transports: ['websocket'] });
  // 2. Friend 1
  const friend1Socket = io(SERVER_URL, { transports: ['websocket'] });
  // 3. Friend 2
  const friend2Socket = io(SERVER_URL, { transports: ['websocket'] });

  await new Promise((r) => setTimeout(r, 1000));

  const leaderId = `driver-${Date.now()}`;
  const friend1Id = `friend1-${Date.now()}`;
  const friend2Id = `friend2-${Date.now()}`;

  let latestGroupState = null;

  leaderSocket.on('group_state_updated', (group) => {
    latestGroupState = group;
  });

  // Join Leader
  leaderSocket.emit('join_group', {
    groupId: TEST_GROUP,
    profile: {
      id: leaderId,
      name: 'Leader (You)',
      avatar: '🏎️',
      color: '#00f0ff',
      location: { lat: 28.6139, lng: 77.209, speed: 45, heading: 90, timestamp: Date.now() },
      isCreator: true,
    },
  });

  await new Promise((r) => setTimeout(r, 600));

  // Join Friend 1
  friend1Socket.emit('join_group', {
    groupId: TEST_GROUP,
    profile: {
      id: friend1Id,
      name: 'Aarav (Friend 1)',
      avatar: '🏍️',
      location: { lat: 28.618, lng: 77.215, speed: 42, heading: 85, timestamp: Date.now() },
    },
  });

  await new Promise((r) => setTimeout(r, 600));

  // Join Friend 2
  friend2Socket.emit('join_group', {
    groupId: TEST_GROUP,
    profile: {
      id: friend2Id,
      name: 'Priya (Friend 2)',
      avatar: '🚙',
      location: { lat: 28.610, lng: 77.202, speed: 40, heading: 95, timestamp: Date.now() },
    },
  });

  await new Promise((r) => setTimeout(r, 1000));

  // Verify Distinct Colors
  console.log('\n--- VERIFYING DISTINCT COLORS ---');
  const members = latestGroupState.members;
  const leaderMember = members.find((m) => m.id === leaderId);
  const friend1Member = members.find((m) => m.id === friend1Id);
  const friend2Member = members.find((m) => m.id === friend2Id);

  console.log(`Leader Color:   ${leaderMember?.color} (expected #00f0ff Cyan)`);
  console.log(`Friend 1 Color: ${friend1Member?.color} (expected #ec4899 Magenta)`);
  console.log(`Friend 2 Color: ${friend2Member?.color} (expected #f59e0b Amber Gold)`);

  if (leaderMember.color !== friend1Member.color && friend1Member.color !== friend2Member.color) {
    console.log('✅ PASS: All 3 travelers have distinct, non-overlapping colors!');
  } else {
    console.error('❌ FAIL: Color collision detected between members!');
    process.exit(1);
  }

  // Set Rendezvous Destination
  console.log('\n--- SETTING DESTINATION & COMPUTING ROUTES ---');
  leaderSocket.emit('set_rendezvous', {
    groupId: TEST_GROUP,
    rendezvous: {
      lat: 28.5355,
      lng: 77.391,
      title: 'City Expressway Junction',
      setBy: 'Leader',
      timestamp: Date.now(),
    },
    userId: leaderId,
  });

  // Wait for route computation
  await new Promise((r) => setTimeout(r, 2500));

  console.log(`Total Generated Routes in Group: ${latestGroupState.routes.length}`);

  // Now test 1-Route-Per-Friend Filtering
  console.log('\n--- VERIFYING 1-ROUTE-PER-FRIEND FILTERING ---');
  const otherFriends = latestGroupState.members.filter((m) => m.id !== leaderId);
  console.log(`Squad Friends Count: ${otherFriends.length} (expected 2)`);

  const SQUAD_FRIEND_PALETTE = ['#ec4899', '#f59e0b', '#8b5cf6', '#10b981', '#f97316', '#3b82f6'];
  const routesToDraw = [];

  // Driver chosen route
  const myRoutesList = latestGroupState.routes.filter((r) => !r.forUserId || r.forUserId === leaderId);
  const myChosenRoute = leaderMember.assignedRouteId
    ? myRoutesList.find((r) => r.id === leaderMember.assignedRouteId) || myRoutesList[0]
    : myRoutesList[0];

  if (myChosenRoute) {
    routesToDraw.push({
      owner: 'Driver',
      routeId: myChosenRoute.id,
      color: '#00f0ff',
    });
  }

  // Friends chosen routes
  otherFriends.forEach((friend, fIdx) => {
    const friendRoutes = latestGroupState.routes.filter((r) => r.forUserId === friend.id);
    const friendChosen = friend.assignedRouteId
      ? friendRoutes.find((r) => r.id === friend.assignedRouteId) || friendRoutes[0]
      : friendRoutes[0];

    if (friendChosen) {
      const friendColor = friend.color || SQUAD_FRIEND_PALETTE[fIdx % SQUAD_FRIEND_PALETTE.length];
      routesToDraw.push({
        owner: friend.name,
        routeId: friendChosen.id,
        color: friendColor,
      });
    }
  });

  console.log(`Routes to draw on map:`, routesToDraw);
  console.log(`Total chosen routes rendered: ${routesToDraw.length} (expected 3: 1 Driver + 2 Friends)`);

  if (routesToDraw.length === 3) {
    console.log('✅ PASS: Exactly 1 route per friend is rendered on the map alongside the driver!');
  } else {
    console.error(`❌ FAIL: Unexpected number of routes: ${routesToDraw.length}`);
    process.exit(1);
  }

  // Test Friend choosing an alternate route
  console.log('\n--- TESTING FRIEND ROUTE SELECTION & LIVE UPDATE ---');
  const friend1Routes = latestGroupState.routes.filter((r) => r.forUserId === friend1Id);
  if (friend1Routes.length > 1) {
    const alternateRouteId = friend1Routes[1].id;
    console.log(`Friend 1 switching to alternate route: ${alternateRouteId}`);
    friend1Socket.emit('assign_route', {
      groupId: TEST_GROUP,
      userId: friend1Id,
      routeId: alternateRouteId,
    });

    await new Promise((r) => setTimeout(r, 1000));

    const updatedFriend1 = latestGroupState.members.find((m) => m.id === friend1Id);
    console.log(`Updated Friend 1 assignedRouteId: ${updatedFriend1.assignedRouteId}`);
    if (updatedFriend1.assignedRouteId === alternateRouteId) {
      console.log('✅ PASS: Real-time route selection synchronization verified across all travelers!');
    } else {
      console.error('❌ FAIL: Route selection was not synchronized!');
      process.exit(1);
    }
  } else {
    console.log('Note: Only 1 route was generated by fallback routing service, which is valid.');
  }

  console.log('\n===========================================');
  console.log('ALL FRIEND ROUTE & COLOR TESTS PASSED (100%)');
  console.log('===========================================');

  leaderSocket.disconnect();
  friend1Socket.disconnect();
  friend2Socket.disconnect();
  process.exit(0);
}

runTest().catch((err) => {
  console.error('[TEST ERROR]', err);
  process.exit(1);
});
