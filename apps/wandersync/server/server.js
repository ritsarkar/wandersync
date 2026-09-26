import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { getGoogleRoutes, getOSRMRoute, calculateDistanceKm } from './routingService.js';
import { loadPersistedGroups, scheduleSaveGroups } from './storage.js';
import { sanitizeGroupId, isValidCoordinate, sanitizeString, securityHeadersMiddleware } from './security.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distPath = path.join(__dirname, '../dist');

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(securityHeadersMiddleware);
app.use(express.json({ limit: '1mb' }));

// Serve static frontend assets in production
app.use(express.static(distPath));

// In-Memory Group / Room Storage with Persistent Disk Recovery
const groups = loadPersistedGroups();

/**
 * Get or initialize a travel group
 */
function getOrCreateGroup(groupId) {
  const id = sanitizeGroupId(groupId);
  if (!groups.has(id)) {
    groups.set(id, {
      id,
      creatorId: null,
      name: `Expedition ${id}`,
      createdAt: Date.now(),
      rendezvous: null,
      waypoints: [],
      routes: [],
      isTripActive: false,
      members: new Map(),
      messages: [
        {
          id: 'welcome-msg',
          senderId: 'system',
          senderName: 'WanderSync Bot',
          senderColor: '#10b981',
          text: `Welcome to Travel Group ${id}! Share this code with your friends to track each other live on the map.`,
          type: 'system',
          timestamp: Date.now(),
        },
      ],
    });
  }
  return groups.get(id);
}

function getGroup(groupId) {
  if (!groupId) return null;
  return groups.get(sanitizeGroupId(groupId)) || null;
}

// Convert group state to client-friendly JSON
function serializeGroup(group) {
  return {
    id: group.id,
    creatorId: group.creatorId,
    name: group.name,
    createdAt: group.createdAt,
    rendezvous: group.rendezvous,
    waypoints: group.waypoints || [],
    routes: group.routes,
    isTripActive: Boolean(group.isTripActive),
    members: Array.from(group.members.values()),
    messages: group.messages.slice(-50),
  };
}

// REST APIs
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'WanderSync Core Engine',
    activeGroups: groups.size,
    timestamp: Date.now(),
  });
});

app.get('/api/groups/:groupId', (req, res) => {
  const group = getOrCreateGroup(req.params.groupId);
  res.json(serializeGroup(group));
});

const GOOGLE_API_KEY = process.env.GOOGLE_MAPS_API_KEY || 'AIzaSyD7TQUFCM4BhUXzWtGDIVXh3zORe19Se7s';

app.post('/api/routes/calculate', async (req, res) => {
  const { startLat, startLng, endLat, endLng, mode = 'driving' } = req.body;
  if (!isValidCoordinate(startLat, startLng) || !isValidCoordinate(endLat, endLng)) {
    return res.status(400).json({ error: 'Missing or invalid coordinates for route calculation' });
  }

  try {
    const routes = await getGoogleRoutes(startLat, startLng, endLat, endLng, mode, GOOGLE_API_KEY, true);
    res.json({ success: true, routes });
  } catch (err) {
    res.status(500).json({ error: 'Failed to compute routes', details: err.message });
  }
});

app.post('/api/routes/google', async (req, res) => {
  const { startLat, startLng, endLat, endLng, mode = 'driving' } = req.body;
  if (!isValidCoordinate(startLat, startLng) || !isValidCoordinate(endLat, endLng)) {
    return res.status(400).json({ error: 'Missing or invalid coordinates for route calculation' });
  }

  try {
    const routes = await getGoogleRoutes(startLat, startLng, endLat, endLng, mode, GOOGLE_API_KEY, true);
    res.json({ success: true, routes });
  } catch (err) {
    res.status(500).json({ error: 'Failed to compute routes', details: err.message });
  }
});

// Google Places Autocomplete Endpoint
app.get('/api/places/autocomplete', async (req, res) => {
  const query = (req.query.input || req.query.query || '').trim();
  if (!query) {
    return res.json({ suggestions: [] });
  }

  try {
    const response = await fetch('https://places.googleapis.com/v1/places:autocomplete', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': GOOGLE_API_KEY,
      },
      body: JSON.stringify({
        input: query,
        includedRegionCodes: ['IN'], // prioritize India locations, e.g. Gangarampur
      }),
    });

    const data = await response.json();
    if (data.suggestions && Array.isArray(data.suggestions)) {
      const formatted = data.suggestions.map((s) => ({
        placeId: s.placePrediction?.placeId || '',
        text: s.placePrediction?.text?.text || '',
        mainText: s.placePrediction?.structuredFormat?.mainText?.text || s.placePrediction?.text?.text || '',
        secondaryText: s.placePrediction?.structuredFormat?.secondaryText?.text || '',
      }));
      return res.json({ suggestions: formatted });
    }
  } catch (err) {
    console.warn('[Places] Autocomplete error:', err.message);
  }

  // Fallback to Nominatim if Google Places rate-limits or fails
  try {
    const nomRes = await fetch(`https://nominatim.openstreetmap.org/search?format=json&countrycodes=in&q=${encodeURIComponent(query)}`);
    const nomData = await nomRes.json();
    if (Array.isArray(nomData)) {
      const formatted = nomData.slice(0, 5).map((item) => ({
        placeId: `nom-${item.place_id}`,
        text: item.display_name,
        mainText: item.name || item.display_name.split(',')[0],
        secondaryText: item.display_name.split(',').slice(1, 3).join(','),
        location: {
          lat: parseFloat(item.lat),
          lng: parseFloat(item.lon),
        },
      }));
      return res.json({ suggestions: formatted });
    }
  } catch (e) {
    // ignore
  }

  res.json({ suggestions: [] });
});

// Geo-IP Location Resolver: Detects user's real regional location (e.g. West Bengal) from Vercel edge headers or IP lookup
app.get('/api/my-location', async (req, res) => {
  try {
    // 1. Check Vercel Edge Geolocation Headers (Zero-latency real region)
    const vLat = parseFloat(req.headers['x-vercel-ip-latitude']);
    const vLng = parseFloat(req.headers['x-vercel-ip-longitude']);
    const city = req.headers['x-vercel-ip-city'];
    const region = req.headers['x-vercel-ip-country-region'];
    const country = req.headers['x-vercel-ip-country'];

    if (!isNaN(vLat) && !isNaN(vLng) && isValidCoordinate(vLat, vLng)) {
      return res.json({
        lat: vLat,
        lng: vLng,
        city: city ? decodeURIComponent(city) : undefined,
        region: region || undefined,
        country: country || undefined,
        source: 'vercel_edge'
      });
    }

    // 2. Fallback to client IP lookup if local or headers absent
    const clientIp = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress;
    if (clientIp && !clientIp.startsWith('127.') && !clientIp.startsWith('192.168.') && clientIp !== '::1') {
      const ipRes = await fetch(`https://ipapi.co/${clientIp}/json/`, { signal: AbortSignal.timeout(3000) });
      if (ipRes.ok) {
        const ipData = await ipRes.json();
        if (ipData.latitude && ipData.longitude && isValidCoordinate(ipData.latitude, ipData.longitude)) {
          return res.json({
            lat: Number(ipData.latitude),
            lng: Number(ipData.longitude),
            city: ipData.city,
            region: ipData.region,
            country: ipData.country_code,
            source: 'ip_lookup'
          });
        }
      }
    }
  } catch (e) {
    // ignore
  }

  return res.json({ lat: null, lng: null, source: 'none' });
});

// Google Place Details (Coordinates) Endpoint
app.get('/api/places/details', async (req, res) => {
  const { placeId } = req.query;
  if (!placeId) {
    return res.status(400).json({ error: 'Missing placeId' });
  }

  // If it was a Nominatim fallback place
  if (typeof placeId === 'string' && placeId.startsWith('nom-')) {
    const rawId = placeId.replace('nom-', '').replace(/[^0-9a-zA-Z_-]/g, '');
    const realId = encodeURIComponent(rawId);
    if (!realId) {
      return res.status(400).json({ error: 'Invalid placeId' });
    }
    try {
      const nomRes = await fetch(`https://nominatim.openstreetmap.org/details?format=json&place_id=${realId}`);
      const nomData = await nomRes.json();
      if (nomData?.geometry?.coordinates) {
        return res.json({
          success: true,
          lat: nomData.geometry.coordinates[1],
          lng: nomData.geometry.coordinates[0],
          name: nomData.localname || 'Selected Place',
          formattedAddress: nomData.localname,
        });
      }
    } catch (e) {
      // ignore
    }
  }

  try {
    const response = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`, {
      headers: {
        'X-Goog-Api-Key': GOOGLE_API_KEY,
        'X-Goog-FieldMask': 'location,displayName,formattedAddress',
      },
    });

    const data = await response.json();
    if (data.location) {
      return res.json({
        success: true,
        lat: data.location.latitude,
        lng: data.location.longitude,
        name: data.displayName?.text || data.formattedAddress || 'Selected Place',
        formattedAddress: data.formattedAddress,
      });
    }
  } catch (err) {
    console.warn('[Places] Details error:', err.message);
  }

  res.status(500).json({ error: 'Failed to fetch place details' });
});

// Socket.IO Real-time Synchronization
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

io.on('connection', (socket) => {
  let currentGroupId = null;
  let currentUserId = null;

  // 1. Join or Create Group Room
  socket.on('join_group', async ({ groupId, profile }) => {
    const group = getOrCreateGroup(groupId);
    if (currentGroupId && currentGroupId !== group.id) {
      socket.leave(currentGroupId);
    }
    currentGroupId = group.id;

    const safeId = sanitizeString(profile?.id, 64) || `user-${socket.id}`;
    const safeName = sanitizeString(profile?.name, 40) || 'Anonymous Traveler';
    const safeAvatar = sanitizeString(profile?.avatar, 10) || '🎒';
    const safeMode = ['car', 'bike', 'motorcycle', 'walk', 'train'].includes(profile?.mode) ? profile.mode : 'car';

    // Check if group already has an established creator
    if (!group.creatorId) {
      group.creatorId = safeId;
    } else if (profile?.isCreator && !group.members.has(group.creatorId)) {
      group.creatorId = safeId;
    }

    currentUserId = safeId;

    socket.join(currentGroupId);

    // === UNIQUE NAME & IDENTITY RE-ENROLLMENT DEDUPLICATION ===
    const cleanName = safeName.trim().toLowerCase();
    let existingMember = group.members.get(currentUserId);
    let matchedOldId = null;

    if (!existingMember) {
      for (const [mId, m] of group.members.entries()) {
        if (m.name && m.name.trim().toLowerCase() === cleanName) {
          existingMember = m;
          matchedOldId = mId;
          break;
        }
      }
    }

    // If member is re-enrolling from same name but a different/new socket ID:
    if (matchedOldId && matchedOldId !== currentUserId) {
      console.log(`[Deduplication] Merging rejoining member "${safeName}": old ID ${matchedOldId} -> new ID ${currentUserId}`);
      // Re-assign routes from old ID to new currentUserId
      if (group.routes) {
        group.routes.forEach((r) => {
          if (r.forUserId === matchedOldId) {
            r.forUserId = currentUserId;
            r.forUserName = safeName;
          }
        });
      }
      group.members.delete(matchedOldId);
      io.to(currentGroupId).emit('member_left', { userId: matchedOldId, replacedBy: currentUserId });
    }

    // Clean up any lingering ghost members with the same normalized name
    for (const [mId, m] of group.members.entries()) {
      if (mId !== currentUserId && m.name && m.name.trim().toLowerCase() === cleanName) {
        group.members.delete(mId);
        io.to(currentGroupId).emit('member_left', { userId: mId, replacedBy: currentUserId });
      }
    }

    const hasInitialLoc = Boolean(
      (profile?.location && isValidCoordinate(profile.location.lat, profile.location.lng)) || 
      (existingMember?.location && isValidCoordinate(existingMember.location.lat, existingMember.location.lng))
    );
    const isLeader = group.creatorId === currentUserId;

    // Distinct neon colors for friends: 1st friend = Magenta, 2nd = Amber, 3rd = Purple, etc.
    const SQUAD_FRIEND_PALETTE = ['#ec4899', '#f59e0b', '#8b5cf6', '#10b981', '#f97316', '#3b82f6'];
    let memberColor = profile?.color;
    if (isLeader) {
      memberColor = '#00f0ff'; // Driver/Leader gets Electric Cyan
    } else {
      const otherFriends = Array.from(group.members.values()).filter((m) => m.id !== group.creatorId && m.id !== currentUserId);
      const friendIdx = otherFriends.length;
      if (!memberColor || memberColor === '#3b82f6' || memberColor === '#00f0ff' || memberColor === '#10b981') {
        memberColor = SQUAD_FRIEND_PALETTE[friendIdx % SQUAD_FRIEND_PALETTE.length];
      }
    }

    const initialLocation = hasInitialLoc
      ? (profile?.location && isValidCoordinate(profile.location.lat, profile.location.lng) ? profile.location : existingMember.location)
      : null;

    const memberData = {
      id: currentUserId,
      name: safeName,
      avatar: safeAvatar,
      color: memberColor,
      mode: safeMode,
      isLeader: isLeader,
      assignedRouteId: profile?.assignedRouteId || (existingMember ? existingMember.assignedRouteId : null),
      location: initialLocation,
      trail: existingMember?.trail || (initialLocation ? [[initialLocation.lat, initialLocation.lng]] : []),
      isSimulated: Boolean(profile?.isSimulated),
      status: hasInitialLoc ? 'active' : 'locating',
      lastSeen: Date.now(),
      socketId: socket.id,
    };

    group.members.set(currentUserId, memberData);

    // 1. Immediately push destination to the joining socket (0ms latency!)
    if (group.rendezvous) {
      socket.emit('rendezvous_updated', {
        rendezvous: group.rendezvous,
        routes: group.routes || [],
      });
    }

    // Broadcast member initial location only if valid real coordinates are known
    if (memberData.location) {
      io.to(currentGroupId).emit('member_location_updated', {
        userId: memberData.id,
        name: memberData.name,
        avatar: memberData.avatar,
        color: memberData.color,
        mode: memberData.mode,
        location: memberData.location,
        status: memberData.status,
        trailPoint: [memberData.location.lat, memberData.location.lng],
      });
    }

    // Announce traveler joined
    const joinMsg = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      senderId: 'system',
      senderName: 'System',
      senderColor: '#64748b',
      text: `${memberData.name} joined the squad!`,
      type: 'system',
      timestamp: Date.now(),
    };
    group.messages.push(joinMsg);
    io.to(currentGroupId).emit('new_message', joinMsg);

    // Send initial group state WITHOUT waiting for routes (so member list updates)
    io.to(currentGroupId).emit('group_state_updated', serializeGroup(group));
    scheduleSaveGroups(groups);

    // 2. Asynchronously compute road routes for joining member, THEN broadcast updated state
    if (group.rendezvous && memberData.location) {
      getGoogleRoutes(
        memberData.location.lat,
        memberData.location.lng,
        group.rendezvous.lat,
        group.rendezvous.lng,
        'driving',
        GOOGLE_API_KEY,
        true
      )
        .then((computed) => {
          if (computed && computed.length > 0) {
            const userRouteFormatted = computed.map((r, idx) => ({
              ...r,
              id: `${memberData.id}-${r.id}`,
              forUserId: memberData.id,
              forUserName: memberData.name,
              color: memberData.color || (idx === 0 ? '#00f0ff' : '#ec4899'),
              tag: idx === 0 ? `Fastest for ${memberData.name}` : `Alt ${idx + 1} for ${memberData.name}`,
            }));
            if (!memberData.assignedRouteId) {
              memberData.assignedRouteId = userRouteFormatted[0].id;
            }
            group.routes = [
              ...(group.routes || []).filter((r) => r.forUserId !== memberData.id),
              ...userRouteFormatted,
            ];
            io.to(currentGroupId).emit('member_route_updated', { userId: memberData.id, routeId: memberData.assignedRouteId });
            io.to(currentGroupId).emit('routes_updated', group.routes);
            // Now broadcast the complete group state WITH routes included
            io.to(currentGroupId).emit('group_state_updated', serializeGroup(group));
            scheduleSaveGroups(groups);
          }
        })
        .catch((err) => {
          console.warn('[Routes] Could not compute route for joining member:', err.message);
        });
    }
  });

  // Member Departure / Leave Group Handler
  socket.on('leave_group', ({ groupId, userId }) => {
    const targetGroupId = groupId || currentGroupId;
    const targetUserId = userId || currentUserId;
    if (!targetGroupId || !targetUserId) return;

    const group = groups.get(targetGroupId);
    if (group) {
      group.members.delete(targetUserId);
      if (group.routes) {
        group.routes = group.routes.filter((r) => r.forUserId !== targetUserId);
      }
      io.to(targetGroupId).emit('member_left', { userId: targetUserId });
      io.to(targetGroupId).emit('group_state_updated', serializeGroup(group));
      scheduleSaveGroups(groups);
    }
    socket.leave(targetGroupId);
  });

  // 2. High-Frequency Real-Time Location Update
  socket.on('update_location', ({ groupId, userId, location }) => {
    // Session identity binding: reject attempts to spoof another traveler's position
    const effectiveUserId = currentUserId || userId;
    if (userId && currentUserId && userId !== currentUserId) {
      console.warn(`[Security] Location spoofing attempt blocked: socket ${socket.id} (user ${currentUserId}) tried to update location for ${userId}`);
      return;
    }
    const group = getGroup(groupId) || (currentGroupId ? getGroup(currentGroupId) : null);
    if (!group || !location) return;

    // Sanity check coordinates to prevent corrupted data
    if (!isValidCoordinate(location.lat, location.lng)) {
      return;
    }

    const member = group.members.get(effectiveUserId);
    if (member) {
      member.location = {
        ...member.location,
        lat: Number(location.lat),
        lng: Number(location.lng),
        speed: Number(location.speed) || 0,
        heading: Number(location.heading) || 0,
        accuracy: Number(location.accuracy) || 0,
        timestamp: Date.now(),
      };
      member.lastSeen = Date.now();

      // Append to breadcrumb trail (keep last 50 points)
      if (!member.trail) member.trail = [];
      const lastPoint = member.trail[member.trail.length - 1];
      if (!lastPoint || calculateDistanceKm(lastPoint[0], lastPoint[1], location.lat, location.lng) > 0.01) {
        member.trail.push([member.location.lat, member.location.lng]);
        if (member.trail.length > 60) member.trail.shift();
      }

      // Determine moving status
      member.status = (member.location.speed || 0) > 3 ? 'moving' : 'idle';

      // Broadcast single member position to squad with member metadata
      io.to(group.id).emit('member_location_updated', {
        userId: effectiveUserId,
        name: member.name,
        avatar: member.avatar,
        color: member.color,
        mode: member.mode,
        location: member.location,
        status: member.status,
        trailPoint: [member.location.lat, member.location.lng],
      });

      // If group has a rendezvous and this member doesn't have a route or moved significantly (> 1 km), calculate it!
      const shouldCalculateRoute = group.rendezvous && (
        !group.routes ||
        !group.routes.some(r => r.forUserId === effectiveUserId) ||
        !member.lastRoutedPos ||
        calculateDistanceKm(member.lastRoutedPos.lat, member.lastRoutedPos.lng, location.lat, location.lng) > 1.0
      );

      if (shouldCalculateRoute) {
        member.lastRoutedPos = { lat: location.lat, lng: location.lng };
        getGoogleRoutes(
          location.lat,
          location.lng,
          group.rendezvous.lat,
          group.rendezvous.lng,
          'driving',
          GOOGLE_API_KEY,
          true
        ).then((computedRoutes) => {
          if (computedRoutes && computedRoutes.length > 0) {
            const formatted = computedRoutes.map((r, idx) => ({
              ...r,
              id: `${member.id}-${r.id}`,
              forUserId: member.id,
              forUserName: member.name,
              color: member.color || (idx === 0 ? '#00f0ff' : '#ec4899'),
              tag: idx === 0 ? `Fastest for ${member.name}` : `Alt ${idx + 1} for ${member.name}`,
            }));
            if (!member.assignedRouteId) {
              member.assignedRouteId = formatted[0].id;
            }
            group.routes = [
              ...(group.routes || []).filter(r => r.forUserId !== member.id),
              ...formatted,
            ];
            io.to(group.id).emit('member_route_updated', { userId: member.id, routeId: member.assignedRouteId });
            io.to(group.id).emit('routes_updated', group.routes);
            io.to(group.id).emit('group_state_updated', serializeGroup(group));
            scheduleSaveGroups(groups);
          }
        }).catch((err) => console.warn('[Routes] Error calculating route on update_location:', err.message));
      }
    }
  });

  // 3. Batch Update for Simulated Friends
  socket.on('batch_update_simulated', ({ groupId, membersList }) => {
    const group = groups.get(groupId);
    if (!group || !Array.isArray(membersList)) return;

    membersList.forEach((m) => {
      group.members.set(m.id, {
        ...m,
        lastSeen: Date.now(),
      });
    });

    // Notify room of full batch
    io.to(group.id).emit('group_state_updated', serializeGroup(group));
    scheduleSaveGroups(groups);
  });

  // 4. Assign Route to Traveler
  socket.on('assign_route', ({ groupId, userId, routeId }) => {
    const group = getGroup(groupId) || (currentGroupId ? getGroup(currentGroupId) : null);
    if (!group) return;

    const targetUserId = userId || currentUserId;
    if (targetUserId !== currentUserId && group.creatorId !== currentUserId) {
      console.warn(`[Security] Unauthorized assign_route blocked for socket ${socket.id}`);
      return;
    }

    const member = group.members.get(targetUserId);
    if (member) {
      member.assignedRouteId = routeId ? sanitizeString(routeId, 64) : null;
      io.to(group.id).emit('member_route_updated', { userId: targetUserId, routeId: member.assignedRouteId });
      io.to(group.id).emit('group_state_updated', serializeGroup(group));
      scheduleSaveGroups(groups);
    }
  });

  // 5. Synchronize Destination / Rendezvous Pin
  socket.on('set_rendezvous', async ({ groupId, rendezvous, recalculateRoutes, userId }) => {
    const group = getOrCreateGroup(groupId);
    const effectiveUserId = currentUserId || userId;

    if (!rendezvous || !isValidCoordinate(rendezvous.lat, rendezvous.lng)) {
      return;
    }

    const currentCreator = group.creatorId ? group.members.get(group.creatorId) : null;
    const isCreatorOnline = currentCreator && currentCreator.status !== 'offline' && !currentCreator.isSimulated;

    // Strict Admin Lock: Only trip creator/leader can set or change destination
    if (group.creatorId && effectiveUserId && group.creatorId !== effectiveUserId) {
      socket.emit('permission_denied', { message: 'Only the trip admin can set or change the destination.' });
      return;
    }

    if (!isCreatorOnline || !group.creatorId) {
      group.creatorId = effectiveUserId;
      for (const [mId, m] of group.members.entries()) {
        m.isLeader = (mId === effectiveUserId);
      }
    }

    group.rendezvous = {
      lat: Number(rendezvous.lat),
      lng: Number(rendezvous.lng),
      title: sanitizeString(rendezvous.title, 80) || 'Target Destination',
      address: sanitizeString(rendezvous.address, 120),
      setBy: sanitizeString(rendezvous.setBy || 'Admin', 40),
      timestamp: Date.now(),
    };

    // 1. Instantly broadcast destination to all connected squad members (0ms latency!)
    io.to(group.id).emit('rendezvous_updated', {
      rendezvous: group.rendezvous,
      routes: group.routes || [],
    });
    io.to(group.id).emit('group_state_updated', serializeGroup(group));
    scheduleSaveGroups(groups);

    // 2. Recalculate real Google road routes for all active members with a location
    let activeMembers = Array.from(group.members.values()).filter(m => m.location);
    if (activeMembers.length === 0) {
      // If members are still acquiring GPS, calculate route from default India/city center so a route is immediately visible
      const fallbackMember = group.members.get(effectiveUserId) || {
        id: effectiveUserId || 'leader',
        name: 'Leader',
        color: '#2563eb',
      };
      activeMembers = [{
        ...fallbackMember,
        location: { lat: 28.6139, lng: 77.2090 },
      }];
    }

    try {
      const otherFriends = activeMembers.filter((x) => x.id !== group.creatorId);
      const SQUAD_FRIEND_PALETTE = ['#ec4899', '#f59e0b', '#8b5cf6', '#10b981', '#f97316', '#3b82f6'];

      const routePromises = activeMembers.map(async (m) => {
        const isLeader = m.id === group.creatorId;
        const friendIdx = otherFriends.findIndex((x) => x.id === m.id);
        const memberColor = isLeader
          ? '#00f0ff'
          : (m.color && m.color !== '#00f0ff' && m.color !== '#3b82f6'
              ? m.color
              : SQUAD_FRIEND_PALETTE[Math.max(0, friendIdx) % SQUAD_FRIEND_PALETTE.length]);
        m.color = memberColor;

        const mRoutes = await getGoogleRoutes(
          m.location.lat,
          m.location.lng,
          rendezvous.lat,
          rendezvous.lng,
          'driving',
          GOOGLE_API_KEY,
          true
        );
        if (mRoutes && mRoutes.length > 0) {
          if (!m.assignedRouteId) {
            m.assignedRouteId = `${m.id}-${mRoutes[0].id}`;
          }
          return mRoutes.map((r, idx) => ({
            ...r,
            id: `${m.id}-${r.id}`,
            forUserId: m.id,
            forUserName: m.name,
            color: memberColor,
            tag: idx === 0 ? `Fastest for ${m.name}` : `Alt ${idx + 1} for ${m.name}`,
          }));
        }
        return [];
      });
      const allRoutesNested = await Promise.all(routePromises);
      const computedNewRoutes = allRoutesNested.flat();
      if (computedNewRoutes.length > 0) {
        group.routes = computedNewRoutes;
        io.to(group.id).emit('routes_updated', group.routes);
        io.to(group.id).emit('group_state_updated', serializeGroup(group));
        scheduleSaveGroups(groups);
      }
    } catch (err) {
      console.error('Route calculation error:', err);
    }
  });

  // Claim or Transfer Admin Role
  socket.on('claim_admin', ({ groupId }) => {
    const group = groups.get(sanitizeGroupId(groupId));
    if (!group) return;
    const currentCreator = group.creatorId ? group.members.get(group.creatorId) : null;
    const isCreatorRecentlyActive = currentCreator && (Date.now() - (currentCreator.lastSeen || 0) < 15 * 60 * 1000);
    if (!isCreatorRecentlyActive || group.members.size <= 1) {
      group.creatorId = currentUserId;
      for (const [mId, m] of group.members.entries()) {
        m.isLeader = (mId === currentUserId);
      }
      io.to(group.id).emit('group_state_updated', serializeGroup(group));
      scheduleSaveGroups(groups);
    } else {
      socket.emit('permission_denied', { message: 'Trip creator is currently active. Admin role cannot be seized.' });
    }
  });

  socket.on('add_waypoint', ({ groupId, waypoint }) => {
    const group = groups.get(sanitizeGroupId(groupId));
    if (!group || !waypoint || !isValidCoordinate(waypoint.lat, waypoint.lng)) return;
    
    if (!group.waypoints) group.waypoints = [];
    
    const wpObj = {
      id: `wp-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      lat: Number(waypoint.lat),
      lng: Number(waypoint.lng),
      type: sanitizeString(waypoint.type, 30) || 'custom',
      label: sanitizeString(waypoint.label, 80) || 'Waypoint',
      addedBy: currentUserId,
      timestamp: Date.now(),
    };
    
    group.waypoints.push(wpObj);
    if (group.waypoints.length > 50) group.waypoints.shift();
    
    io.to(group.id).emit('waypoint_added', wpObj);
    scheduleSaveGroups(groups);
  });

  socket.on('remove_waypoint', ({ groupId, waypointId }) => {
    const group = groups.get(sanitizeGroupId(groupId));
    if (!group || !group.waypoints) return;
    
    // Only leader or the person who added can remove
    const wp = group.waypoints.find(w => w.id === waypointId);
    if (!wp) return;
    if (wp.addedBy !== currentUserId && group.creatorId !== currentUserId) return;
    
    group.waypoints = group.waypoints.filter(w => w.id !== waypointId);
    io.to(group.id).emit('waypoint_removed', { waypointId });
    scheduleSaveGroups(groups);
  });

  // 6. Sync Routes List with Safe Per-Traveler Merging
  socket.on('set_routes', ({ groupId, routes, userId }) => {
    const group = groups.get(sanitizeGroupId(groupId));
    if (!group) return;

    const targetUserId = userId || currentUserId;
    if (Array.isArray(routes)) {
      const incoming = routes.map((r) => ({
        ...r,
        forUserId: r.forUserId || targetUserId,
      }));
      const incomingUserIds = new Set(incoming.map((r) => r.forUserId));
      const otherRoutes = (group.routes || []).filter((r) => !r.forUserId || !incomingUserIds.has(r.forUserId));
      group.routes = [...otherRoutes, ...incoming];
      io.to(group.id).emit('routes_updated', group.routes);
      io.to(group.id).emit('group_state_updated', serializeGroup(group));
      scheduleSaveGroups(groups);
    }
  });

  // 7. Chat Messages & Quick Radar Pings
  socket.on('send_message', ({ groupId, message }) => {
    const group = groups.get(sanitizeGroupId(groupId));
    if (!group || !message || typeof message.text !== 'string') return;

    const cleanText = sanitizeString(message.text, 500);
    if (!cleanText) return;

    const senderMember = currentUserId ? group.members.get(currentUserId) : null;

    const msgObj = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      senderId: currentUserId || 'traveler',
      senderName: senderMember ? senderMember.name : (sanitizeString(message.senderName, 40) || 'Traveler'),
      senderColor: senderMember ? senderMember.color : (message.senderColor || '#3b82f6'),
      text: cleanText,
      type: message.type === 'system' ? 'chat' : (message.type || 'chat'),
      timestamp: Date.now(),
    };

    group.messages.push(msgObj);
    if (group.messages.length > 100) group.messages.shift();

    io.to(group.id).emit('new_message', msgObj);
  });

  // 8. Emergency SOS Alert
  socket.on('trigger_sos', ({ groupId, alert }) => {
    const group = groups.get(sanitizeGroupId(groupId));
    if (!group) return;

    const senderMember = currentUserId ? group.members.get(currentUserId) : null;
    const effectiveLoc = alert?.location && isValidCoordinate(alert.location.lat, alert.location.lng)
      ? alert.location
      : senderMember?.location;

    if (!effectiveLoc) return;

    const senderName = senderMember ? senderMember.name : (sanitizeString(alert?.senderName, 40) || 'Squad Member');

    const sosMsg = {
      id: `sos-${Date.now()}`,
      senderId: currentUserId,
      senderName: senderName,
      senderColor: '#ef4444',
      text: `🚨 SOS EMERGENCY BEACON! ${senderName} signaled for help at [${effectiveLoc.lat.toFixed(4)}, ${effectiveLoc.lng.toFixed(4)}]!`,
      type: 'sos',
      location: effectiveLoc,
      timestamp: Date.now(),
    };

    group.messages.push(sosMsg);
    io.to(group.id).emit('sos_triggered', sosMsg);
  });

  // 9. Synchronized Convoy Trip Start & Countdown
  socket.on('start_trip_countdown', ({ groupId, profile, durationSeconds = 4 }) => {
    const targetGroupId = sanitizeGroupId(groupId || currentGroupId);
    const group = groups.get(targetGroupId);
    if (!group) {
      console.warn('[Countdown] Group not found:', targetGroupId);
      return;
    }

    const starterName = sanitizeString(profile?.name, 40) || 'Squad Member';
    const starterId = currentUserId || profile?.id;

    const eventPayload = {
      startedBy: starterName,
      startedById: starterId,
      durationSeconds: Math.min(30, Math.max(1, Number(durationSeconds) || 4)),
      timestamp: Date.now(),
    };

    console.log(`[Countdown] Broadcasting trip_countdown_started to room ${group.id} by ${starterName}`);
    // Broadcast departure countdown notification to all squad members in this trip
    io.to(group.id).emit('trip_countdown_started', eventPayload);

    // Also send a system chat message
    const sysMsg = {
      id: `sys-start-${Date.now()}`,
      senderId: 'system',
      senderName: 'Convoy Control',
      senderColor: '#f59e0b',
      text: `🚀 Convoy departure initiated by ${starterName}! Departure countdown commenced.`,
      type: 'system',
      timestamp: Date.now(),
    };
    group.messages.push(sysMsg);
    io.to(group.id).emit('new_message', sysMsg);
    scheduleSaveGroups(groups);
  });

  socket.on('cancel_trip_countdown', ({ groupId, profile }) => {
    const targetGroupId = sanitizeGroupId(groupId || currentGroupId);
    const group = groups.get(targetGroupId);
    if (!group) return;

    group.isTripActive = false;
    io.to(group.id).emit('trip_countdown_cancelled', {
      cancelledBy: sanitizeString(profile?.name, 40) || 'Squad Member',
    });
    io.to(group.id).emit('trip_active_updated', { isTripActive: false });
    io.to(group.id).emit('group_state_updated', serializeGroup(group));
    scheduleSaveGroups(groups);
  });

  socket.on('set_trip_active', ({ groupId, active, isActive }) => {
    const targetGroupId = sanitizeGroupId(groupId || currentGroupId);
    const group = groups.get(targetGroupId);
    if (!group) return;

    group.isTripActive = Boolean(active !== undefined ? active : isActive);
    io.to(group.id).emit('trip_active_updated', { isTripActive: group.isTripActive });
    scheduleSaveGroups(groups);
  });

  // Clean stale members every 5 minutes
  setInterval(() => {
    const now = Date.now();
    for (const [gId, group] of groups.entries()) {
      let cleaned = false;
      for (const [mId, member] of group.members.entries()) {
        // Remove members not seen for 30 minutes
        if (now - member.lastSeen > 30 * 60 * 1000) {
          group.members.delete(mId);
          cleaned = true;
        }
      }
      if (cleaned) {
        io.to(gId).emit('group_state_updated', serializeGroup(group));
      }
      // Remove empty groups older than 1 hour
      if (group.members.size === 0 && now - group.createdAt > 60 * 60 * 1000) {
        groups.delete(gId);
      }
    }
  }, 5 * 60 * 1000);

  // 9. Disconnect handling
  socket.on('disconnect', () => {
    if (currentGroupId && currentUserId) {
      const group = groups.get(currentGroupId);
      if (group) {
        const member = group.members.get(currentUserId);
        if (member && !member.isSimulated) {
          member.status = 'offline';
          member.lastSeen = Date.now();
          io.to(currentGroupId).emit('member_status_updated', {
            userId: currentUserId,
            status: 'offline',
          });
          io.to(currentGroupId).emit('group_state_updated', serializeGroup(group));
        }
      }
    }
  });
});

// Production SPA Fallback: Serve index.html for non-API routes
app.get('*', (req, res) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/socket.io')) {
    return res.status(404).json({ error: 'Endpoint not found' });
  }
  const indexPath = path.join(distPath, 'index.html');
  res.sendFile(indexPath, (err) => {
    if (err) {
      res.status(200).send('WanderSync Core API is online. Build the frontend with `npm run build` to enable single-port UI hosting.');
    }
  });
});

if (!process.env.VERCEL) {
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`[WanderSync Production Server] Running on http://0.0.0.0:${PORT}`);
    console.log(`[WanderSync Local Network] Access on Wi-Fi: http://192.168.1.3:${PORT}`);
  });
}

export { app, server };
export default app;
