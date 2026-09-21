import { TravelRoute, TravelerMember, RendezvousPoint } from '../types';

export interface SimulationPreset {
  id: string;
  name: string;
  description: string;
  center: [number, number];
  zoom: number;
  rendezvous: RendezvousPoint;
  routes: TravelRoute[];
  simulatedFriends: {
    id: string;
    name: string;
    avatar: string;
    color: string;
    mode: 'car' | 'motorcycle' | 'bike' | 'walk';
    routeId: string;
    baseSpeed: number; // km/h
    initialProgress: number; // 0 to 1
  }[];
}

// Calculate bearing angle between two coordinates in degrees (0 = North)
export function calculateBearing(startLat: number, startLng: number, endLat: number, endLng: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const toDeg = (rad: number) => (rad * 180) / Math.PI;

  const φ1 = toRad(startLat);
  const φ2 = toRad(endLat);
  const Δλ = toRad(endLng - startLng);

  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  const θ = Math.atan2(y, x);

  return (toDeg(θ) + 360) % 360;
}

// Cubic Bézier curve interpolator for smooth road path curves
function generateSmoothRoad(p0: [number, number], p1: [number, number], p2: [number, number], p3: [number, number], steps: number = 40): [number, number][] {
  const points: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const mt = 1 - t;
    const lat = mt * mt * mt * p0[0] + 3 * mt * mt * t * p1[0] + 3 * mt * t * t * p2[0] + t * t * t * p3[0];
    const lng = mt * mt * mt * p0[1] + 3 * mt * mt * t * p1[1] + 3 * mt * t * t * p2[1] + t * t * t * p3[1];
    points.push([+lat.toFixed(5), +lng.toFixed(5)]);
  }
  return points;
}

// PRESET 1: Alpine Expedition (Switzerland)
const alpineExpressRoute: TravelRoute = {
  id: 'route-alpine-express',
  name: 'Gotthard Highway Express (Route 1)',
  distanceKm: 46.2,
  durationMins: 35,
  color: '#3b82f6', // Electric Blue
  tag: 'Fast Highway (3 Friends)',
  coordinates: generateSmoothRoad(
    [46.885, 8.644], // Altdorf
    [46.812, 8.638], // Erstfeld
    [46.732, 8.612], // Wassen
    [46.634, 8.594], // Andermatt Summit
    50
  ),
};

const alpineScenicPassRoute: TravelRoute = {
  id: 'route-alpine-scenic',
  name: 'Susten Panoramic Pass (Route 2)',
  distanceKm: 68.5,
  durationMins: 62,
  color: '#10b981', // Emerald Green
  tag: 'Scenic Mountain Pass (4 Friends)',
  coordinates: generateSmoothRoad(
    [46.885, 8.644], // Altdorf
    [46.780, 8.450], // Engelberg / Gadmen loop
    [46.660, 8.480], // High Alpine viewpoint
    [46.634, 8.594], // Andermatt Summit
    60
  ),
};

const alpineBypassRoute: TravelRoute = {
  id: 'route-alpine-bypass',
  name: 'Eastern Valley Byway (Route 3)',
  distanceKm: 58.0,
  durationMins: 48,
  color: '#f59e0b', // Amber Orange
  tag: 'Secondary Road',
  coordinates: generateSmoothRoad(
    [46.885, 8.644], // Altdorf
    [46.850, 8.780], // Klausen valley
    [46.720, 8.710], // Disentis connector
    [46.634, 8.594], // Andermatt Summit
    55
  ),
};

// PRESET 2: California Coastal Adventure (San Francisco -> Point Reyes)
const calHighway101Route: TravelRoute = {
  id: 'route-cal-101',
  name: 'US-101 Northbound Corridor',
  distanceKm: 52.4,
  durationMins: 42,
  color: '#3b82f6',
  tag: 'Highway Transit (3 Friends)',
  coordinates: generateSmoothRoad(
    [37.795, -122.393], // SF Ferry Building
    [37.865, -122.510], // Marin City
    [37.973, -122.531], // San Rafael
    [38.000, -122.750], // Point Reyes Station
    50
  ),
};

const calCoastalPCHRoute: TravelRoute = {
  id: 'route-cal-coastal',
  name: 'Pacific Coast Highway 1',
  distanceKm: 67.8,
  durationMins: 65,
  color: '#10b981',
  tag: 'Ocean Scenic Drive (4 Friends)',
  coordinates: generateSmoothRoad(
    [37.795, -122.393], // SF Ferry Building
    [37.830, -122.480], // Golden Gate Viewpoint
    [37.890, -122.610], // Stinson Beach
    [38.000, -122.750], // Point Reyes Station
    60
  ),
};

export const SIMULATION_PRESETS: SimulationPreset[] = [
  {
    id: 'preset-alpine',
    name: 'Swiss Alps Expedition (Multi-Route Challenge)',
    description: '3 Friends taking the fast Highway Tunnel vs. 4 Friends taking the Scenic Mountain Pass to Andermatt Summit.',
    center: [46.76, 8.61],
    zoom: 11,
    rendezvous: {
      lat: 46.634,
      lng: 8.594,
      title: 'Andermatt Summit Basecamp 🏕️',
      setBy: 'Expedition Leader',
      timestamp: Date.now(),
    },
    routes: [alpineExpressRoute, alpineScenicPassRoute, alpineBypassRoute],
    simulatedFriends: [
      // Group A (Highway 1: 3 friends)
      { id: 'sim-1', name: 'Alex (SUV Lead)', avatar: '🚙', color: '#3b82f6', mode: 'car', routeId: 'route-alpine-express', baseSpeed: 78, initialProgress: 0.42 },
      { id: 'sim-2', name: 'Maya (Touring Bike)', avatar: '🏍️', color: '#60a5fa', mode: 'motorcycle', routeId: 'route-alpine-express', baseSpeed: 82, initialProgress: 0.46 },
      { id: 'sim-3', name: 'David (Sedan)', avatar: '🚗', color: '#93c5fd', mode: 'car', routeId: 'route-alpine-express', baseSpeed: 72, initialProgress: 0.38 },

      // Group B (Scenic Pass: 4 friends)
      { id: 'sim-4', name: 'Elena (4x4 Wrangler)', avatar: '🚙', color: '#10b981', mode: 'car', routeId: 'route-alpine-scenic', baseSpeed: 48, initialProgress: 0.28 },
      { id: 'sim-5', name: 'Lucas (Vanlife Camper)', avatar: '🚐', color: '#34d399', mode: 'car', routeId: 'route-alpine-scenic', baseSpeed: 42, initialProgress: 0.22 },
      { id: 'sim-6', name: 'Sophie (Cyclist Scout)', avatar: '🚴‍♀️', color: '#6ee7b7', mode: 'bike', routeId: 'route-alpine-scenic', baseSpeed: 32, initialProgress: 0.35 },
      { id: 'sim-7', name: 'Oliver (Hiker/Photographer)', avatar: '📸', color: '#a7f3d0', mode: 'walk', routeId: 'route-alpine-scenic', baseSpeed: 45, initialProgress: 0.25 },
    ],
  },
  {
    id: 'preset-california',
    name: 'California Coastline Roadtrip',
    description: 'Highway 101 vs. Pacific Coast Highway 1 towards Point Reyes Lighthouse.',
    center: [37.90, -122.56],
    zoom: 11,
    rendezvous: {
      lat: 38.000,
      lng: -122.750,
      title: 'Point Reyes Oyster Bay 🦪',
      setBy: 'Trip Planner',
      timestamp: Date.now(),
    },
    routes: [calHighway101Route, calCoastalPCHRoute],
    simulatedFriends: [
      { id: 'sim-c1', name: 'Jack (Tesla)', avatar: '⚡', color: '#3b82f6', mode: 'car', routeId: 'route-cal-101', baseSpeed: 85, initialProgress: 0.50 },
      { id: 'sim-c2', name: 'Rachel (Cruiser)', avatar: '🏍️', color: '#60a5fa', mode: 'motorcycle', routeId: 'route-cal-101', baseSpeed: 80, initialProgress: 0.44 },
      { id: 'sim-c3', name: 'Sam (Convertible)', avatar: '🚗', color: '#93c5fd', mode: 'car', routeId: 'route-cal-101', baseSpeed: 76, initialProgress: 0.39 },
      { id: 'sim-c4', name: 'Zoe (Jeep Safari)', avatar: '🚙', color: '#10b981', mode: 'car', routeId: 'route-cal-coastal', baseSpeed: 52, initialProgress: 0.31 },
      { id: 'sim-c5', name: 'Leo (Photographer)', avatar: '📸', color: '#34d399', mode: 'car', routeId: 'route-cal-coastal', baseSpeed: 46, initialProgress: 0.28 },
      { id: 'sim-c6', name: 'Chloe (E-Bike Explorer)', avatar: '🚴', color: '#6ee7b7', mode: 'bike', routeId: 'route-cal-coastal', baseSpeed: 38, initialProgress: 0.33 },
      { id: 'sim-c7', name: 'Marcus (Van)', avatar: '🚐', color: '#a7f3d0', mode: 'car', routeId: 'route-cal-coastal', baseSpeed: 44, initialProgress: 0.24 },
    ],
  },
];

/**
 * Calculates current coordinate and bearing given a route path and 0.0-1.0 progress
 */
export function getInterpolatedPosition(
  coordinates: [number, number][],
  progress: number
): { lat: number; lng: number; heading: number } {
  if (!coordinates || coordinates.length === 0) {
    return { lat: 0, lng: 0, heading: 0 };
  }
  if (coordinates.length === 1 || progress <= 0) {
    return { lat: coordinates[0][0], lng: coordinates[0][1], heading: 0 };
  }
  if (progress >= 1) {
    const last = coordinates[coordinates.length - 1];
    const prev = coordinates[coordinates.length - 2];
    return {
      lat: last[0],
      lng: last[1],
      heading: calculateBearing(prev[0], prev[1], last[0], last[1]),
    };
  }

  const totalSegments = coordinates.length - 1;
  const scaledIndex = progress * totalSegments;
  const segmentIndex = Math.min(Math.floor(scaledIndex), totalSegments - 1);
  const segmentFraction = scaledIndex - segmentIndex;

  const p0 = coordinates[segmentIndex];
  const p1 = coordinates[segmentIndex + 1];

  const lat = p0[0] + (p1[0] - p0[0]) * segmentFraction;
  const lng = p0[1] + (p1[1] - p0[1]) * segmentFraction;
  const heading = calculateBearing(p0[0], p0[1], p1[0], p1[1]);

  return { lat: +lat.toFixed(5), lng: +lng.toFixed(5), heading: Math.round(heading) };
}
