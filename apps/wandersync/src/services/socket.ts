import { io, Socket } from 'socket.io-client';
import { GroupMessage, LocationData, RendezvousPoint, TravelGroup, TravelerMember, TravelRoute, Waypoint, TripCountdownEvent } from '../types';

class SocketService {
  private socket: Socket | null = null;
  private savedGroupId: string | null = null;
  private savedProfile: Partial<TravelerMember> | null = null;

  connect(): Socket {
    if (!this.socket) {
      // In development Vite proxies /socket.io to backend port 4000
      // In production / Vercel, connects to dedicated backend via VITE_SOCKET_URL if defined
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
    }
    return this.socket;
  }

  getSocket(): Socket | null {
    return this.socket;
  }

  joinGroup(groupId: string, profile: Partial<TravelerMember>) {
    this.savedGroupId = groupId;
    this.savedProfile = profile;
    this.socket?.emit('join_group', { groupId, profile });
  }

  leaveGroup() {
    this.savedGroupId = null;
    this.savedProfile = null;
  }

  updateLocation(groupId: string, userId: string, location: LocationData) {
    this.socket?.emit('update_location', { groupId, userId, location });
  }

  batchUpdateSimulated(groupId: string, membersList: TravelerMember[]) {
    this.socket?.emit('batch_update_simulated', { groupId, membersList });
  }

  assignRoute(groupId: string, userId: string, routeId: string | null) {
    this.socket?.emit('assign_route', { groupId, userId, routeId });
  }

  setRendezvous(groupId: string, rendezvous: RendezvousPoint, userId?: string) {
    this.socket?.emit('set_rendezvous', { groupId, rendezvous, userId: userId || this.savedProfile?.id });
  }

  claimAdmin(groupId: string) {
    this.socket?.emit('claim_admin', { groupId });
  }

  setRoutes(groupId: string, routes: TravelRoute[], userId?: string) {
    this.socket?.emit('set_routes', { groupId, routes, userId: userId || this.savedProfile?.id });
  }

  sendMessage(groupId: string, message: Omit<GroupMessage, 'id' | 'timestamp'>) {
    this.socket?.emit('send_message', { groupId, message });
  }

  triggerSOS(groupId: string, alert: { senderId: string; senderName: string; location: LocationData }) {
    this.socket?.emit('trigger_sos', { groupId, alert });
  }

  onGroupState(callback: (group: TravelGroup) => void) {
    this.socket?.on('group_state_updated', callback);
    return () => this.socket?.off('group_state_updated', callback);
  }

  onMemberLocation(
    callback: (data: {
      userId: string;
      location: LocationData;
      status: string;
      trailPoint: [number, number];
      name?: string;
      avatar?: string;
      color?: string;
      mode?: string;
    }) => void
  ) {
    this.socket?.on('member_location_updated', callback);
    return () => this.socket?.off('member_location_updated', callback);
  }

  onNewMessage(callback: (msg: GroupMessage) => void) {
    this.socket?.on('new_message', callback);
    return () => this.socket?.off('new_message', callback);
  }

  onSOSTriggered(callback: (sosMsg: GroupMessage) => void) {
    this.socket?.on('sos_triggered', callback);
    return () => this.socket?.off('sos_triggered', callback);
  }

  onRendezvousUpdated(callback: (data: { rendezvous: RendezvousPoint; routes: TravelRoute[] }) => void) {
    this.socket?.on('rendezvous_updated', callback);
    return () => this.socket?.off('rendezvous_updated', callback);
  }

  onRoutesUpdated(callback: (routes: TravelRoute[]) => void) {
    this.socket?.on('routes_updated', callback);
    return () => this.socket?.off('routes_updated', callback);
  }

  onMemberRouteUpdated(callback: (data: { userId: string; routeId: string | null }) => void) {
    this.socket?.on('member_route_updated', callback);
    return () => this.socket?.off('member_route_updated', callback);
  }

  addWaypoint(groupId: string, waypoint: Omit<Waypoint, 'id' | 'timestamp'>) {
    this.socket?.emit('add_waypoint', { groupId, waypoint });
  }

  removeWaypoint(groupId: string, waypointId: string) {
    this.socket?.emit('remove_waypoint', { groupId, waypointId });
  }

  onWaypointAdded(callback: (waypoint: Waypoint) => void) {
    this.socket?.on('waypoint_added', callback);
    return () => this.socket?.off('waypoint_added', callback);
  }

  onWaypointRemoved(callback: (data: { waypointId: string }) => void) {
    this.socket?.on('waypoint_removed', callback);
    return () => this.socket?.off('waypoint_removed', callback);
  }

  onPermissionDenied(callback: (data: { message: string }) => void) {
    this.socket?.on('permission_denied', callback);
    return () => this.socket?.off('permission_denied', callback);
  }

  startTripCountdown(groupId: string, profile: Partial<TravelerMember>, durationSeconds: number = 4) {
    this.socket?.emit('start_trip_countdown', { groupId, profile, durationSeconds });
  }

  cancelTripCountdown(groupId: string, profile: Partial<TravelerMember>) {
    this.socket?.emit('cancel_trip_countdown', { groupId, profile });
  }

  setTripActive(groupId: string, active: boolean) {
    this.socket?.emit('set_trip_active', { groupId, active });
  }

  onTripCountdownStarted(callback: (event: TripCountdownEvent) => void) {
    this.socket?.on('trip_countdown_started', callback);
    return () => this.socket?.off('trip_countdown_started', callback);
  }

  onTripCountdownCancelled(callback: (data: { cancelledBy: string }) => void) {
    this.socket?.on('trip_countdown_cancelled', callback);
    return () => this.socket?.off('trip_countdown_cancelled', callback);
  }

  onTripActiveUpdated(callback: (data: { isTripActive: boolean }) => void) {
    this.socket?.on('trip_active_updated', callback);
    return () => this.socket?.off('trip_active_updated', callback);
  }
}

export const socketService = new SocketService();
