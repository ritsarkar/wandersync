export type TransportMode = 'car' | 'motorcycle' | 'bike' | 'walk' | 'train';

export interface LocationData {
  lat: number;
  lng: number;
  speed: number; // km/h
  heading: number; // 0-360 degrees
  altitude?: number; // meters
  accuracy?: number; // meters
  battery?: number; // 0-100 percentage
  timestamp: number;
}

export interface TravelerMember {
  id: string;
  name: string;
  avatar: string;
  color: string;
  mode: TransportMode;
  assignedRouteId: string | null;
  location: LocationData;
  trail?: [number, number][];
  isSimulated?: boolean;
  isLeader?: boolean;
  status: 'moving' | 'idle' | 'stopped' | 'offline';
  lastSeen: number;
  socketId?: string;
}

export interface TravelRoute {
  id: string;
  name: string;
  distanceKm: number;
  durationMins: number;
  coordinates: [number, number][];
  color: string;
  tag?: string;
  forUserId?: string;
  forUserName?: string;
}

export interface RendezvousPoint {
  lat: number;
  lng: number;
  title: string;
  setBy: string;
  timestamp: number;
}

export interface GroupMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderColor: string;
  text: string;
  type: 'chat' | 'ping' | 'sos' | 'system';
  location?: LocationData;
  timestamp: number;
}

export type WaypointType = 'speed-breaker' | 'sharp-turn' | 'pothole' | 'police' | 'hazard' | 'road-problem' | 'fuel' | 'rest' | 'food' | 'checkpoint' | 'scenic';

export interface Waypoint {
  id: string;
  lat: number;
  lng: number;
  type: WaypointType;
  label: string;
  addedBy: string;
  addedByName?: string;
  timestamp: number;
}

export interface TravelGroup {
  id: string;
  name: string;
  createdAt: number;
  creatorId: string | null;
  rendezvous: RendezvousPoint | null;
  routes: TravelRoute[];
  members: TravelerMember[];
  messages: GroupMessage[];
  waypoints: Waypoint[];
  isTripActive?: boolean;
}

export type MapTileStyle = 'dark' | 'streets' | 'satellite' | 'terrain' | 'v2v';

export interface TripCountdownEvent {
  startedBy: string;
  startedById: string;
  durationSeconds: number;
  timestamp: number;
}

export interface CandidateSearchLocation {
  id: string;
  name: string;
  lat: number;
  lng: number;
  icon?: string;
  formattedAddress?: string;
  type?: 'popular' | 'search_result';
}

export const SQUAD_FRIEND_PALETTE = ['#ec4899', '#f59e0b', '#8b5cf6', '#10b981', '#f97316', '#3b82f6'];
export const DRIVER_PRIMARY_COLOR = '#00f0ff';

export function getDeterministicMemberColor(
  memberId: string | null | undefined,
  members: { id: string; color?: string; isLeader?: boolean }[]
): string {
  if (!memberId) return DRIVER_PRIMARY_COLOR;
  const member = members.find((m) => m.id === memberId);
  if (member?.isLeader) return DRIVER_PRIMARY_COLOR;

  // Filter non-leaders for consistent palette distribution across all devices
  const nonLeaders = members.filter((m) => !m.isLeader);
  const idx = nonLeaders.findIndex((m) => m.id === memberId);
  if (idx >= 0) {
    return SQUAD_FRIEND_PALETTE[idx % SQUAD_FRIEND_PALETTE.length];
  }
  if (member?.color && member.color !== '#00f0ff' && member.color !== '#3b82f6') {
    return member.color;
  }
  return SQUAD_FRIEND_PALETTE[0];
}

export function getMemberRouteColor(
  member: { id: string; color?: string; isLeader?: boolean } | null | undefined,
  isDriver: boolean,
  friendIndex: number = 0
): string {
  if (isDriver || member?.isLeader) return DRIVER_PRIMARY_COLOR;
  if (member?.color && member.color !== '#00f0ff' && member.color !== '#3b82f6') {
    return member.color;
  }
  return SQUAD_FRIEND_PALETTE[Math.max(0, friendIndex) % SQUAD_FRIEND_PALETTE.length];
}

