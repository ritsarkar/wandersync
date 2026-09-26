import { io, Socket } from 'socket.io-client';
import mqtt, { MqttClient } from 'mqtt';
import {
  GroupMessage,
  LocationData,
  RendezvousPoint,
  TravelGroup,
  TravelerMember,
  TravelRoute,
  Waypoint,
  TripCountdownEvent,
} from '../types';
import { getSecureMqttChannel, sanitizeText, isValidCoordinate } from '../utils/security';

type LocationCallback = (data: {
  userId: string;
  location: LocationData;
  status: string;
  trailPoint: [number, number];
  name?: string;
  avatar?: string;
  color?: string;
  mode?: string;
}) => void;

class SocketService {
  private socket: Socket | null = null;
  private mqttClient: MqttClient | null = null;
  private savedGroupId: string | null = null;
  private savedProfile: Partial<TravelerMember> | null = null;
  private recentEvents: Set<string> = new Set();
  private rdvVersion: number = 0;

  // Internal listener registries for universal dual-transport dispatch
  private groupStateListeners: Set<(group: TravelGroup) => void> = new Set();
  private locationListeners: Set<LocationCallback> = new Set();
  private messageListeners: Set<(msg: GroupMessage) => void> = new Set();
  private sosListeners: Set<(sosMsg: GroupMessage) => void> = new Set();
  private rendezvousListeners: Set<(data: { rendezvous: RendezvousPoint; routes: TravelRoute[] }) => void> = new Set();
  private routesListeners: Set<(routes: TravelRoute[]) => void> = new Set();
  private memberRouteListeners: Set<(data: { userId: string; routeId: string | null }) => void> = new Set();
  private waypointAddedListeners: Set<(waypoint: Waypoint) => void> = new Set();
  private waypointRemovedListeners: Set<(data: { waypointId: string }) => void> = new Set();
  private permissionDeniedListeners: Set<(data: { message: string }) => void> = new Set();
  private countdownStartedListeners: Set<(event: TripCountdownEvent) => void> = new Set();
  private countdownCancelledListeners: Set<(data: { cancelledBy: string }) => void> = new Set();
  private tripActiveListeners: Set<(data: { isTripActive: boolean }) => void> = new Set();
  private memberLeftListeners: Set<(data: { userId: string; replacedBy?: string }) => void> = new Set();

  connect(): Socket {
    if (!this.socket) {
      // 1. Initialize Primary Socket.IO Transport (For Local Dev & Dedicated Node Servers)
      const socketUrl = (import.meta.env.VITE_SOCKET_URL as string) || window.location.origin;
      this.socket = io(socketUrl, {
        reconnection: true,
        reconnectionAttempts: 20,
        reconnectionDelay: 1000,
        transports: ['websocket', 'polling'],
      });

      this.socket.on('connect', () => {
        console.log('[Socket] Connected to WanderSync gateway:', this.socket?.id);
        if (this.savedGroupId && this.savedProfile) {
          console.log('[Socket] Auto-rejoining group on reconnect:', this.savedGroupId);
          this.socket?.emit('join_group', { groupId: this.savedGroupId, profile: this.savedProfile });
        }
      });

      this.socket.on('disconnect', (reason) => {
        console.warn('[Socket] Disconnected from gateway:', reason);
      });

      // Wire Socket.IO incoming events into unified listeners
      this.socket.on('group_state_updated', (group) => this.dispatchGroupState(group));
      this.socket.on('member_location_updated', (data) => this.dispatchLocation(data));
      this.socket.on('member_left', (data) => this.dispatchMemberLeft(data));
      this.socket.on('new_message', (msg) => this.dispatchMessage(msg));
      this.socket.on('sos_triggered', (sosMsg) => this.dispatchSOS(sosMsg));
      this.socket.on('rendezvous_updated', (data) => this.dispatchRendezvous(data));
      this.socket.on('routes_updated', (routes) => this.dispatchRoutes(routes));
      this.socket.on('member_route_updated', (data) => this.dispatchMemberRoute(data));
      this.socket.on('waypoint_added', (wp) => this.dispatchWaypointAdded(wp));
      this.socket.on('waypoint_removed', (data) => this.dispatchWaypointRemoved(data));
      this.socket.on('permission_denied', (data) => this.dispatchPermissionDenied(data));
      this.socket.on('trip_countdown_started', (event) => this.dispatchCountdownStarted(event));
      this.socket.on('trip_countdown_cancelled', (data) => this.dispatchCountdownCancelled(data));
      this.socket.on('trip_active_updated', (data) => this.dispatchTripActive(data));
    }

    // 2. Initialize Universal Cloud Pub/Sub Bridge (Zero-Config, Real-Time for Vercel & Mobile)
    if (!this.mqttClient) {
      this.initMqttBridge();
    }

    return this.socket;
  }

  private pendingPublishes: Array<{ subTopic: string; payload: any; retain: boolean }> = [];

  private initMqttBridge() {
    try {
      const clientId = `ws_wsync_${Math.random().toString(16).substr(2, 8)}`;
      // Primary: EMQX public SSL WebSocket broker; Fallback: HiveMQ
      this.mqttClient = mqtt.connect('wss://broker.emqx.io:8084/mqtt', {
        clientId,
        clean: true,
        reconnectPeriod: 2500,
        connectTimeout: 5000,
      });

      this.mqttClient.on('connect', () => {
        console.log('[MqttBridge] Connected to Global Real-Time Convoy Relay');
        if (this.savedGroupId) {
          this.subscribeMqttGroup(this.savedGroupId);
        }
        // Flush all queued publishes
        while (this.pendingPublishes.length > 0) {
          const item = this.pendingPublishes.shift();
          if (item) {
            this.publishMqtt(item.subTopic, item.payload, item.retain);
          }
        }
      });

      this.mqttClient.on('error', (err) => {
        console.warn('[MqttBridge] EMQX connection notice, trying fallback...', err?.message);
        // If EMQX fails, try HiveMQ broker
        try {
          this.mqttClient?.end(true);
          this.mqttClient = mqtt.connect('wss://broker.hivemq.com:8884/mqtt', {
            clientId: `ws_wsync_hmq_${Math.random().toString(16).substr(2, 8)}`,
            clean: true,
            reconnectPeriod: 3000,
          });
          this.mqttClient.on('connect', () => {
            console.log('[MqttBridge] Fallback HiveMQ broker connected successfully');
            if (this.savedGroupId) this.subscribeMqttGroup(this.savedGroupId);
            while (this.pendingPublishes.length > 0) {
              const item = this.pendingPublishes.shift();
              if (item) {
                this.publishMqtt(item.subTopic, item.payload, item.retain);
              }
            }
          });
          this.setupMqttMessageReceiver();
        } catch (e) {
          console.warn('[MqttBridge] Fallback init error:', e);
        }
      });

      this.setupMqttMessageReceiver();
    } catch (err) {
      console.warn('[MqttBridge] Bridge init error:', err);
    }
  }

  private setupMqttMessageReceiver() {
    if (!this.mqttClient) return;
    this.mqttClient.on('message', (topic, payloadBuffer) => {
      try {
        const payloadStr = payloadBuffer.toString();
        if (!payloadStr) return;
        const data = JSON.parse(payloadStr);
        this.handleIncomingMqttPayload(topic, data);
      } catch (e) {
        // ignore parse error
      }
    });
  }

  private subscribeMqttGroup(groupId: string) {
    if (!groupId) return;
    this.savedGroupId = groupId;
    if (!this.mqttClient || !this.mqttClient.connected) return;
    const channel = getSecureMqttChannel(groupId);
    const topic = `wandersync/v2/c/${channel}/#`;
    this.mqttClient.subscribe(topic, (err) => {
      if (err) {
        console.warn('[MqttBridge] Subscribe error:', err.message);
      } else {
        console.log(`[MqttBridge] Subscribed to real-time topic: ${topic}`);
      }
    });
  }

  private publishMqtt(subTopic: string, payload: any, retain: boolean = false) {
    if (!this.savedGroupId) return;
    const channel = getSecureMqttChannel(this.savedGroupId);
    const topic = `wandersync/v2/c/${channel}/${subTopic}`;
    const serialized = JSON.stringify({
      ...payload,
      senderId: this.savedProfile?.id,
      _timestamp: Date.now(),
      _eventId: `${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
    });

    if (!this.mqttClient || !this.mqttClient.connected) {
      this.pendingPublishes.push({ subTopic, payload, retain });
      return;
    }

    try {
      this.mqttClient.publish(topic, serialized, { qos: 1, retain });
    } catch (e) {
      console.warn('[MqttBridge] Publish error:', e);
    }
  }

  private handleIncomingMqttPayload(topic: string, data: any) {
    if (!data || typeof data !== 'object') return;

    // Only filter self-echo for location events (prevents GPS position echo).
    // Allow routes, rendezvous, group_state etc. through — they carry aggregated multi-user data.
    const event = data.event || (topic.includes('/location/') ? 'member_location_updated' : null);
    if (data.senderId && this.savedProfile?.id && data.senderId === this.savedProfile.id) {
      if (event === 'member_location_updated' || event === 'member_joined' || event === 'member_status_updated') {
        return;
      }
    }
    if (!event) return;

    // Deduplicate only if explicit unique event ID is provided
    if (data._eventId) {
      if (this.recentEvents.has(data._eventId)) return;
      this.recentEvents.add(data._eventId);
      setTimeout(() => this.recentEvents.delete(data._eventId), 4000);
    }

    switch (event) {
      case 'member_location_updated':
        this.dispatchLocation({
          userId: data.userId || data.senderId,
          location: data.location,
          status: data.status || 'active',
          trailPoint: data.trailPoint || [data.location?.lat, data.location?.lng],
          name: data.name,
          avatar: data.avatar,
          color: data.color,
          mode: data.mode,
        });
        break;

      case 'member_joined':
        if (data.member) {
          // If joining member already has a location, dispatch location update immediately so their vehicle appears
          if (data.member.location) {
            this.dispatchLocation({
              userId: data.member.id,
              location: data.member.location,
              status: data.member.status || 'active',
              trailPoint: [data.member.location.lat, data.member.location.lng],
              name: data.member.name,
              avatar: data.member.avatar,
              color: data.member.color,
              mode: data.member.mode,
            });
          }
        }
        break;

      case 'rendezvous_updated':
        if (data.rendezvous) {
          // Ignore stale retained rendezvous messages
          if (typeof data._rdvVersion === 'number' && data._rdvVersion < this.rdvVersion) {
            return;
          }
          this.dispatchRendezvous({ rendezvous: data.rendezvous, routes: data.routes || [] });
        }
        break;

      case 'routes_updated':
        if (Array.isArray(data.routes)) {
          this.dispatchRoutes(data.routes);
        }
        break;

      case 'member_route_updated':
        if (data.userId) {
          this.dispatchMemberRoute({ userId: data.userId, routeId: data.routeId });
        }
        break;

      case 'group_state_updated':
        if (data.group) {
          this.dispatchGroupState(data.group);
        }
        break;

      case 'new_message':
        if (data.message) {
          this.dispatchMessage(data.message);
        }
        break;

      case 'sos_triggered':
        if (data.sosMsg || data.alert) {
          this.dispatchSOS(data.sosMsg || data.alert);
        }
        break;

      case 'trip_countdown_started':
        if (data.countdownPayload || data.event) {
          this.dispatchCountdownStarted(data.countdownPayload || data.event);
        }
        break;

      case 'trip_countdown_cancelled':
        this.dispatchCountdownCancelled(data);
        break;

      case 'trip_active_updated':
        this.dispatchTripActive({ isTripActive: Boolean(data.isTripActive) });
        break;

      case 'waypoint_added':
        if (data.waypoint) {
          this.dispatchWaypointAdded(data.waypoint);
        }
        break;

      case 'waypoint_removed':
        if (data.waypointId) {
          this.dispatchWaypointRemoved({ waypointId: data.waypointId });
        }
        break;

      case 'member_left':
        if (data.userId) {
          this.dispatchMemberLeft({ userId: data.userId, replacedBy: data.replacedBy });
        }
        break;
    }
  }

  // =========================================================================
  // UNIFIED DISPATCHERS (Pass events to local subscribers)
  // =========================================================================
  private dispatchMemberLeft(data: { userId: string; replacedBy?: string }) {
    this.memberLeftListeners.forEach((cb) => {
      try { cb(data); } catch (e) { console.error(e); }
    });
  }

  private dispatchGroupState(group: TravelGroup) {
    this.groupStateListeners.forEach((cb) => {
      try { cb(group); } catch (e) { console.error(e); }
    });
  }

  private dispatchLocation(data: {
    userId: string;
    location: LocationData;
    status: string;
    trailPoint: [number, number];
    name?: string;
    avatar?: string;
    color?: string;
    mode?: string;
  }) {
    this.locationListeners.forEach((cb) => {
      try { cb(data); } catch (e) { console.error(e); }
    });
  }

  private dispatchMessage(msg: GroupMessage) {
    this.messageListeners.forEach((cb) => {
      try { cb(msg); } catch (e) { console.error(e); }
    });
  }

  private dispatchSOS(sosMsg: GroupMessage) {
    this.sosListeners.forEach((cb) => {
      try { cb(sosMsg); } catch (e) { console.error(e); }
    });
  }

  private dispatchRendezvous(data: { rendezvous: RendezvousPoint; routes: TravelRoute[] }) {
    this.rendezvousListeners.forEach((cb) => {
      try { cb(data); } catch (e) { console.error(e); }
    });
  }

  private dispatchRoutes(routes: TravelRoute[]) {
    this.routesListeners.forEach((cb) => {
      try { cb(routes); } catch (e) { console.error(e); }
    });
  }

  private dispatchMemberRoute(data: { userId: string; routeId: string | null }) {
    this.memberRouteListeners.forEach((cb) => {
      try { cb(data); } catch (e) { console.error(e); }
    });
  }

  private dispatchWaypointAdded(wp: Waypoint) {
    this.waypointAddedListeners.forEach((cb) => {
      try { cb(wp); } catch (e) { console.error(e); }
    });
  }

  private dispatchWaypointRemoved(data: { waypointId: string }) {
    this.waypointRemovedListeners.forEach((cb) => {
      try { cb(data); } catch (e) { console.error(e); }
    });
  }

  private dispatchPermissionDenied(data: { message: string }) {
    this.permissionDeniedListeners.forEach((cb) => {
      try { cb(data); } catch (e) { console.error(e); }
    });
  }

  private dispatchCountdownStarted(event: TripCountdownEvent) {
    this.countdownStartedListeners.forEach((cb) => {
      try { cb(event); } catch (e) { console.error(e); }
    });
  }

  private dispatchCountdownCancelled(data: { cancelledBy: string }) {
    this.countdownCancelledListeners.forEach((cb) => {
      try { cb(data); } catch (e) { console.error(e); }
    });
  }

  private dispatchTripActive(data: { isTripActive: boolean }) {
    this.tripActiveListeners.forEach((cb) => {
      try { cb(data); } catch (e) { console.error(e); }
    });
  }

  // =========================================================================
  // PUBLIC EMIT API (Dual-Emits to Socket.IO and Global MQTT WebSocket Relay)
  // =========================================================================
  getSocket(): Socket | null {
    return this.socket;
  }

  joinGroup(groupId: string, profile: Partial<TravelerMember>) {
    this.savedGroupId = groupId;
    this.savedProfile = profile;

    // 1. Socket.IO (Local Server)
    if (this.socket && this.socket.connected) {
      this.socket.emit('join_group', { groupId, profile });
    }

    // 2. Global MQTT WebSocket Relay
    if (this.mqttClient) {
      this.subscribeMqttGroup(groupId);
      // Publish presence with retain so newly joining friends immediately discover us!
      this.publishMqtt(`presence/${profile.id}`, { event: 'member_joined', member: profile }, true);
      this.publishMqtt('events', { event: 'member_joined', member: profile });
    }
  }

  leaveGroup() {
    if (this.savedGroupId && this.savedProfile?.id) {
      const uId = this.savedProfile.id;
      const gId = this.savedGroupId;
      // 1. Notify Socket.IO server so it deletes the member and recalculates
      if (this.socket && this.socket.connected) {
        this.socket.emit('leave_group', { groupId: gId, userId: uId });
      }
      // 2. Clear retained presence in MQTT broker so ghosts don't resurrect
      this.publishMqtt(`presence/${uId}`, {
        event: 'member_left',
        userId: uId,
      }, true);
      this.publishMqtt('events', {
        event: 'member_left',
        userId: uId,
      });
      if (this.mqttClient && this.mqttClient.connected) {
        const channel = getSecureMqttChannel(gId);
        this.mqttClient.unsubscribe(`wandersync/v2/c/${channel}/#`);
      }
    }
    this.savedGroupId = null;
    this.savedProfile = null;
  }

  updateLocation(groupId: string, userId: string, location: LocationData) {
    // 1. Socket.IO
    if (this.socket && this.socket.connected) {
      this.socket.emit('update_location', { groupId, userId, location });
    }

    // 2. Global MQTT WebSocket Relay
    const speed = location.speed || 0;
    const status = speed > 3 ? 'moving' : 'idle';
    this.publishMqtt(`location/${userId}`, {
      event: 'member_location_updated',
      userId,
      location,
      status,
      trailPoint: [location.lat, location.lng],
      name: this.savedProfile?.name,
      avatar: this.savedProfile?.avatar,
      color: this.savedProfile?.color,
      mode: this.savedProfile?.mode,
    }, true);
  }

  batchUpdateSimulated(groupId: string, membersList: TravelerMember[]) {
    if (this.socket && this.socket.connected) {
      this.socket.emit('batch_update_simulated', { groupId, membersList });
    }
  }

  assignRoute(groupId: string, userId: string, routeId: string | null) {
    if (this.socket && this.socket.connected) {
      this.socket.emit('assign_route', { groupId, userId, routeId });
    }
    this.publishMqtt('events', { event: 'member_route_updated', userId, routeId });
    if (userId) {
      this.publishMqtt(`member_route/${userId}`, { event: 'member_route_updated', userId, routeId }, true);
    }
  }

  setRendezvous(groupId: string, rendezvous: RendezvousPoint, userId?: string) {
    const effectiveUserId = userId || this.savedProfile?.id;
    this.rdvVersion++;
    if (this.socket && this.socket.connected) {
      this.socket.emit('set_rendezvous', { groupId, rendezvous, userId: effectiveUserId });
    }
    // Retain rendezvous so any friend opening the link at any time immediately sees the destination!
    this.publishMqtt('rendezvous', { event: 'rendezvous_updated', rendezvous, senderId: effectiveUserId, _rdvVersion: this.rdvVersion }, true);
  }

  claimAdmin(groupId: string) {
    if (this.socket && this.socket.connected) {
      this.socket.emit('claim_admin', { groupId });
    }
  }

  setRoutes(groupId: string, routes: TravelRoute[], userId?: string) {
    const effectiveUserId = userId || this.savedProfile?.id;
    if (this.socket && this.socket.connected) {
      this.socket.emit('set_routes', { groupId, routes, userId: effectiveUserId });
    }
    // Retain routes so newly joined squad members get immediate access to calculated paths!
    // Publish to user-specific retained topic so Admin and Friend routes never clobber each other
    if (effectiveUserId) {
      this.publishMqtt(`routes/${effectiveUserId}`, { event: 'routes_updated', routes, senderId: effectiveUserId }, true);
    }
    this.publishMqtt('routes', { event: 'routes_updated', routes, senderId: effectiveUserId }, true);
  }

  sendMessage(groupId: string, message: Omit<GroupMessage, 'id' | 'timestamp'>) {
    const cleanText = sanitizeText(message.text, 500);
    const safeSenderName = sanitizeText(message.senderName, 40) || 'Traveler';
    const fullMsg: GroupMessage = {
      ...message,
      text: cleanText,
      senderName: safeSenderName,
      id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      timestamp: Date.now(),
    };
    if (this.socket && this.socket.connected) {
      this.socket.emit('send_message', { groupId, message: fullMsg });
    }
    this.publishMqtt('events', { event: 'new_message', message: fullMsg });
  }

  triggerSOS(groupId: string, alert: { senderId: string; senderName: string; location: LocationData }) {
    const safeAlert = {
      ...alert,
      senderName: sanitizeText(alert.senderName, 40) || 'Squad Member',
    };
    if (this.socket && this.socket.connected) {
      this.socket.emit('trigger_sos', { groupId, alert: safeAlert });
    }
    this.publishMqtt('events', { event: 'sos_triggered', alert: safeAlert });
  }

  startTripCountdown(groupId: string, profile: Partial<TravelerMember>, durationSeconds: number = 4) {
    const countdownPayload: TripCountdownEvent = {
      startedBy: sanitizeText(profile?.name, 40) || 'Squad Member',
      startedById: profile?.id || this.savedProfile?.id || 'admin',
      durationSeconds: Math.min(30, Math.max(1, Number(durationSeconds) || 4)),
      timestamp: Date.now(),
    };
    if (this.socket && this.socket.connected) {
      this.socket.emit('start_trip_countdown', { groupId, profile, durationSeconds: countdownPayload.durationSeconds });
    }
    this.publishMqtt('events', { event: 'trip_countdown_started', countdownPayload });
  }

  cancelTripCountdown(groupId: string, profile: Partial<TravelerMember>) {
    if (this.socket && this.socket.connected) {
      this.socket.emit('cancel_trip_countdown', { groupId, profile });
    }
    this.publishMqtt('events', {
      event: 'trip_countdown_cancelled',
      cancelledBy: sanitizeText(profile?.name, 40) || 'Squad Member',
    });
  }

  setTripActive(groupId: string, active: boolean) {
    if (this.socket && this.socket.connected) {
      this.socket.emit('set_trip_active', { groupId, active });
    }
    this.publishMqtt('trip_active', { event: 'trip_active_updated', isTripActive: active }, true);
  }

  addWaypoint(groupId: string, waypoint: Omit<Waypoint, 'id' | 'timestamp'>) {
    const fullWp: Waypoint = {
      ...waypoint,
      label: sanitizeText(waypoint.label, 80),
      type: (sanitizeText(waypoint.type, 30) as any) || 'custom',
      id: `wp-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      timestamp: Date.now(),
    };
    if (this.socket && this.socket.connected) {
      this.socket.emit('add_waypoint', { groupId, waypoint: fullWp });
    }
    this.publishMqtt('events', { event: 'waypoint_added', waypoint: fullWp });
  }

  removeWaypoint(groupId: string, waypointId: string) {
    if (this.socket && this.socket.connected) {
      this.socket.emit('remove_waypoint', { groupId, waypointId });
    }
    this.publishMqtt('events', { event: 'waypoint_removed', waypointId });
  }

  // =========================================================================
  // LISTENERS (Register handlers for real-time events)
  // =========================================================================
  onGroupState(callback: (group: TravelGroup) => void) {
    this.groupStateListeners.add(callback);
    return () => this.groupStateListeners.delete(callback);
  }

  onMemberLocation(callback: LocationCallback) {
    this.locationListeners.add(callback);
    return () => this.locationListeners.delete(callback);
  }

  onNewMessage(callback: (msg: GroupMessage) => void) {
    this.messageListeners.add(callback);
    return () => this.messageListeners.delete(callback);
  }

  onSOSTriggered(callback: (sosMsg: GroupMessage) => void) {
    this.sosListeners.add(callback);
    return () => this.sosListeners.delete(callback);
  }

  onRendezvousUpdated(callback: (data: { rendezvous: RendezvousPoint; routes: TravelRoute[] }) => void) {
    this.rendezvousListeners.add(callback);
    return () => this.rendezvousListeners.delete(callback);
  }

  onRoutesUpdated(callback: (routes: TravelRoute[]) => void) {
    this.routesListeners.add(callback);
    return () => this.routesListeners.delete(callback);
  }

  onMemberRouteUpdated(callback: (data: { userId: string; routeId: string | null }) => void) {
    this.memberRouteListeners.add(callback);
    return () => this.memberRouteListeners.delete(callback);
  }

  onWaypointAdded(callback: (waypoint: Waypoint) => void) {
    this.waypointAddedListeners.add(callback);
    return () => this.waypointAddedListeners.delete(callback);
  }

  onWaypointRemoved(callback: (data: { waypointId: string }) => void) {
    this.waypointRemovedListeners.add(callback);
    return () => this.waypointRemovedListeners.delete(callback);
  }

  onPermissionDenied(callback: (data: { message: string }) => void) {
    this.permissionDeniedListeners.add(callback);
    return () => this.permissionDeniedListeners.delete(callback);
  }

  onTripCountdownStarted(callback: (event: TripCountdownEvent) => void) {
    this.countdownStartedListeners.add(callback);
    return () => this.countdownStartedListeners.delete(callback);
  }

  onTripCountdownCancelled(callback: (data: { cancelledBy: string }) => void) {
    this.countdownCancelledListeners.add(callback);
    return () => this.countdownCancelledListeners.delete(callback);
  }

  onTripActiveUpdated(callback: (data: { isTripActive: boolean }) => void) {
    this.tripActiveListeners.add(callback);
    return () => this.tripActiveListeners.delete(callback);
  }

  onMemberLeft(callback: (data: { userId: string; replacedBy?: string }) => void) {
    this.memberLeftListeners.add(callback);
    return () => this.memberLeftListeners.delete(callback);
  }
}

export const socketService = new SocketService();
