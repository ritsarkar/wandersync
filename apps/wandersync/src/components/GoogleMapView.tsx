import React, { useEffect, useRef, useState, useCallback } from 'react';
import { TravelerMember, TravelRoute, RendezvousPoint, MapTileStyle, Waypoint, SQUAD_FRIEND_PALETTE, DRIVER_PRIMARY_COLOR } from '../types';
import { CornerUpLeft, CornerUpRight, Navigation, LocateFixed } from 'lucide-react';

// Pure client-side haversine distance helper
function calcDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) return 0;
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Calculate bearing/heading between two [lat, lng] points
function calcBearing(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const y = Math.sin(dLon) * Math.cos((lat2 * Math.PI) / 180);
  const x =
    Math.cos((lat1 * Math.PI) / 180) * Math.sin((lat2 * Math.PI) / 180) -
    Math.sin((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.cos(dLon);
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

// Web Audio API feedback chime for dropping/marking pins on map
function playPinChime() {
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(587.33, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.12);
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.22);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.22);
  } catch (e) {}
}

interface GoogleMapViewProps {
  apiKey: string;
  members: TravelerMember[];
  currentUserId: string;
  routes: TravelRoute[];
  rendezvous: RendezvousPoint | null;
  tileStyle: MapTileStyle;
  isSettingRendezvous: boolean;
  onSelectLocationForRendezvous: (lat: number, lng: number) => void;
  selectedMemberId: string | null;
  onSelectMember: (memberId: string | null) => void;
  followMe: boolean;
  isTripActive?: boolean;
  is3DTiltActive?: boolean;
  isCornerMapSwapped?: boolean;
  onToggleCornerMapSwap?: () => void;
  onLoadError?: (error: Error) => void;
  onRoutesCalculated?: (routes: TravelRoute[]) => void;
  waypoints?: Waypoint[];
  onAddWaypoint?: (lat: number, lng: number, type: string, label: string) => void;
  onRemoveWaypoint?: (waypointId: string) => void;
  onSelectRoute?: (routeId: string) => void;
  pinningWaypoint?: { type: string; label: string } | null;
  onPlaceWaypointOnMap?: (lat: number, lng: number) => void;
  onCancelPinningWaypoint?: () => void;
  isPointingPinMode?: boolean;
  onTogglePointingPin?: () => void;
}

// Obsidian Noir V2V Google Maps Vector Styling (matching user reference image)
const OBSIDIAN_V2V_MAP_STYLE: google.maps.MapTypeStyle[] = [
  { elementType: 'geometry', stylers: [{ color: '#05070c' }] },
  { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#526077' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#05070c' }, { weight: 3 }] },
  { featureType: 'administrative', elementType: 'geometry', stylers: [{ color: '#0e1420' }] },
  { featureType: 'administrative.country', elementType: 'geometry.stroke', stylers: [{ color: '#1a2334' }] },
  { featureType: 'administrative.land_parcel', stylers: [{ visibility: 'off' }] },
  { featureType: 'administrative.neighborhood', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#131824' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#07090f' }, { weight: 1 }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#687792' }] },
  { featureType: 'road.arterial', elementType: 'geometry', stylers: [{ color: '#1c2436' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#25314a' }] },
  { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: '#0e131f' }, { weight: 1.5 }] },
  { featureType: 'road.local', elementType: 'geometry', stylers: [{ color: '#0f1420' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#020406' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#2b3648' }] },
];



// Persistent Friend Overlay Class Factory
function getFriendOverlayClass() {
  return class FriendOverlayView extends google.maps.OverlayView {
    public div: HTMLDivElement | null = null;
    public position: google.maps.LatLng;
    public memberId: string;
    private member: TravelerMember;
    private isSelected: boolean;
    private isMe: boolean;
    private isV2V: boolean;
    private onSelect: (id: string) => void;

    constructor(
      member: TravelerMember,
      isMe: boolean,
      isSelected: boolean,
      isV2V: boolean,
      onSelect: (id: string) => void
    ) {
      super();
      this.memberId = member.id;
      this.member = member;
      this.isMe = isMe;
      this.isSelected = isSelected;
      this.isV2V = isV2V;
      this.onSelect = onSelect;
      this.position = new google.maps.LatLng(member.location!.lat, member.location!.lng);
    }

    update(member: TravelerMember, isMe: boolean, isSelected: boolean, isV2V: boolean) {
      this.member = member;
      this.isMe = isMe;
      this.isSelected = isSelected;
      this.isV2V = isV2V;
      if (member.location) {
        this.position = new google.maps.LatLng(member.location.lat, member.location.lng);
      }
      this.renderContent();
      this.draw();
    }

    private renderContent() {
      if (!this.div || !this.member.location) return;
      const speed = Math.round(this.member.location.speed || 0);
      const isMoving = speed > 3;
      const heading = this.member.location.heading || 0;

      // V2V Cockpit Visualization (matching user reference image)
      if (this.isV2V) {
        if (this.isMe) {
          // Current User: Glowing Orange 3D Chevron Pointer with Dynamic Headlight Cone on Road
          this.div.innerHTML = `
            <div class="traveler-marker-container relative flex flex-col items-center justify-center">
              <div class="relative flex items-center justify-center" style="transform: rotate(${heading}deg); transition: transform 0.25s ease-out;">
                <!-- Headlight Beam Cone illuminating road ahead -->
                <div class="v2v-headlight-cone"></div>
                <!-- Glowing Orange Navigation Chevron -->
                <svg viewBox="0 0 32 32" class="w-10 h-10 v2v-pointer-chevron relative z-10" style="transform: translateY(-2px);">
                  <path d="M16 2 L29 27 L16 21 L3 27 Z" fill="#ff6200" stroke="#ffa31a" stroke-width="2" stroke-linejoin="round" />
                </svg>
              </div>
              <div class="mt-2 px-2.5 py-0.5 rounded-full bg-slate-950/95 border border-amber-500/70 text-amber-300 text-[10px] font-mono font-bold shadow-2xl flex items-center gap-1.5 whitespace-nowrap z-20">
                <span class="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span>
                <span>YOU</span>
                <span class="text-slate-400">•</span>
                <span>${speed} km/h</span>
              </div>
            </div>
          `;
          return;
        } else {
          // Squad Member / Ahead Vehicle: Concentric Red Radar Pulse Rings & Proximity Warning
          this.div.innerHTML = `
            <div class="traveler-marker-container relative flex flex-col items-center justify-center ${this.isSelected ? 'scale-110' : ''}">
              <!-- Concentric Radar Pulse Rings from user's image -->
              <div class="v2v-radar-pulse"></div>
              <div class="v2v-radar-pulse-outer"></div>
              <div class="traveler-avatar-bubble" style="border-color: #ef4444; box-shadow: 0 0 24px rgba(239, 68, 68, 0.85); background: #080a10;">
                ${this.member.avatar || (this.member.mode === 'motorcycle' ? '🏍️' : '🚗')}
                <div class="heading-cone-wrapper" style="transform: rotate(${heading}deg);">
                  <div class="heading-cone-arrow" style="border-bottom-color: #ef4444;"></div>
                </div>
              </div>
              <div class="mt-1.5 px-2.5 py-0.5 rounded-full bg-slate-950/95 border border-red-500/80 text-red-400 text-[10px] font-mono font-bold flex items-center gap-1.5 shadow-2xl whitespace-nowrap z-20">
                <span class="text-xs text-red-400 animate-pulse">⚠️</span>
                <span>${this.member.name}</span>
                <span class="text-slate-400 font-normal">(${speed} km/h)</span>
              </div>
            </div>
          `;
          return;
        }
      }

      // Standard Map Marker View
      this.div.innerHTML = `
        <div class="traveler-marker-container ${this.isSelected ? 'scale-110' : ''}">
          ${isMoving ? `<div class="pulse-radar-ring" style="border-color: ${this.member.color}"></div>` : ''}
          <div class="traveler-avatar-bubble" style="border-color: ${this.member.color}; ${this.isSelected ? `box-shadow: 0 0 25px ${this.member.color}` : ''}">
            ${this.member.avatar || '🚗'}
            <div class="heading-cone-wrapper" style="transform: rotate(${heading}deg);">
              <div class="heading-cone-arrow" style="border-bottom-color: ${this.member.color};"></div>
            </div>
          </div>
          <div class="traveler-tag">
            <span class="truncate max-w-[80px]">${this.isMe ? 'You' : this.member.name}</span>
            <span class="speed-badge">${speed} km/h</span>
          </div>
        </div>
      `;
    }


    onAdd() {
      this.div = document.createElement('div');
      this.div.style.position = 'absolute';
      this.div.style.transform = 'translate(-50%, -50%)';
      this.div.style.cursor = 'pointer';
      this.div.style.zIndex = this.isMe ? '35' : '30';
      this.renderContent();

      this.div.addEventListener('click', (e) => {
        e.stopPropagation();
        this.onSelect(this.memberId);
      });

      const panes = this.getPanes();
      if (panes && panes.overlayMouseTarget && this.div) {
        panes.overlayMouseTarget.appendChild(this.div);
      }
    }

    draw() {
      try {
        if (!this.div) return;
        const projection = this.getProjection();
        if (!projection) return;
        const pos = projection.fromLatLngToDivPixel(this.position);
        if (pos) {
          this.div.style.left = `${pos.x}px`;
          this.div.style.top = `${pos.y}px`;
        }
      } catch (e) {}
    }

    onRemove() {
      if (this.div?.parentNode) {
        this.div.parentNode.removeChild(this.div);
        this.div = null;
      }
    }
  };
}

export const GoogleMapView: React.FC<GoogleMapViewProps> = ({
  apiKey,
  members,
  currentUserId,
  routes,
  rendezvous,
  tileStyle,
  isSettingRendezvous,
  onSelectLocationForRendezvous,
  selectedMemberId,
  onSelectMember,
  followMe,
  isTripActive = false,
  is3DTiltActive = true,
  isCornerMapSwapped = false,
  onToggleCornerMapSwap,
  onLoadError,
  onRoutesCalculated,
  waypoints = [],
  onAddWaypoint,
  onRemoveWaypoint,
  onSelectRoute,
  pinningWaypoint = null,
  onPlaceWaypointOnMap,
  onCancelPinningWaypoint,
  isPointingPinMode: controlledPointingPinMode,
  onTogglePointingPin: controlledTogglePointingPin,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const polylinesRef = useRef<google.maps.Polyline[]>([]);
  const overlaysMapRef = useRef<Map<string, any>>(new Map());
  const v2vTargetOverlayRef = useRef<google.maps.OverlayView | null>(null);
  const infoBoxesRef = useRef<google.maps.OverlayView[]>([]);
  const rendezvousOverlayRef = useRef<google.maps.OverlayView | null>(null);
  const nativeRendezvousMarkerRef = useRef<google.maps.Marker | null>(null);
  const waypointOverlaysRef = useRef<google.maps.OverlayView[]>([]);
  const turnOverlayRef = useRef<google.maps.OverlayView | null>(null);
  const [nextManeuver, setNextManeuver] = useState<{
    type: 'left' | 'right' | 'slight-left' | 'straight';
    label: string;
    distMeters: number;
    streetName: string;
  } | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  // Manual navigation tracking: when user zooms or drags, NEVER override camera or zoom out
  const [isManualNav, setIsManualNav] = useState(false);
  const isManualNavRef = useRef(false);
  const isProgrammaticCameraChangeRef = useRef(false);

  // Re-center camera onto the driver smoothly
  const recenterOnDriver = useCallback(() => {
    isManualNavRef.current = false;
    setIsManualNav(false);
    const myMember = members.find((m) => m.id === currentUserId);
    if (myMember?.location && mapInstanceRef.current) {
      isProgrammaticCameraChangeRef.current = true;
      mapInstanceRef.current.panTo({ lat: myMember.location.lat, lng: myMember.location.lng });
      mapInstanceRef.current.setZoom(18.5);
      try {
        if (isTripActive && typeof (mapInstanceRef.current as any).setTilt === 'function') {
          (mapInstanceRef.current as any).setTilt(55);
        }
        if (myMember.location.heading != null && typeof (mapInstanceRef.current as any).setHeading === 'function') {
          (mapInstanceRef.current as any).setHeading(myMember.location.heading);
        }
      } catch (e) {}
      setTimeout(() => {
        isProgrammaticCameraChangeRef.current = false;
      }, 400);
    }
  }, [members, currentUserId, isTripActive]);

  // Pointing Pin on Main Map: human-centric direct road spot marking
  const [internalPointingPinMode, setInternalPointingPinMode] = useState<boolean>(false);
  const isPointingPinMode = controlledPointingPinMode !== undefined ? controlledPointingPinMode : internalPointingPinMode;
  const setIsPointingPinMode = (val: boolean | ((p: boolean) => boolean)) => {
    if (controlledTogglePointingPin) {
      if (typeof val === 'function') {
        controlledTogglePointingPin();
      } else if (val !== isPointingPinMode) {
        controlledTogglePointingPin();
      }
    } else {
      setInternalPointingPinMode(val);
    }
  };
  const [selectedPinCategory, setSelectedPinCategory] = useState<string>('speed-breaker');
  const [pinnedConfirmationToast, setPinnedConfirmationToast] = useState<string | null>(null);

  // Keep track of active calculated routes (Declared early for point-route logic)
  const [activeDisplayRoutes, setActiveDisplayRoutes] = useState<TravelRoute[]>(routes);

  // Sync / merge active display routes when remote group routes change
  useEffect(() => {
    if (routes && routes.length > 0) {
      setActiveDisplayRoutes((prev) => {
        if (!prev || prev.length === 0) return routes;
        const myLocalRoutes = prev.filter((r) => !r.forUserId || r.forUserId === currentUserId);
        const remoteRoutes = routes.filter((r) => r.forUserId && r.forUserId !== currentUserId);
        return [...myLocalRoutes, ...remoteRoutes];
      });
    }
  }, [routes, currentUserId]);

  // =========================================================================
  // CREATIVE & MINIMAL POINT-ON-MAP ROUTE ENGINE
  // =========================================================================
  interface PointedLocation {
    lat: number;
    lng: number;
    isOnRoute: boolean;
    roadName?: string;
    distanceKm?: number;
    durationMins?: number;
  }

  const [pointedPoint, setPointedPoint] = useState<PointedLocation | null>(null);
  const [isCalculatingPointRoute, setIsCalculatingPointRoute] = useState(false);
  const originalDirectRoutesRef = useRef<TravelRoute[]>([]);
  const pointedOverlayRef = useRef<any>(null);

  // Distance in meters from a point P to a line segment AB
  const getDistanceToSegmentMeters = (
    pLat: number,
    pLng: number,
    aLat: number,
    aLng: number,
    bLat: number,
    bLng: number
  ): number => {
    const R = 6371000;
    const toRad = Math.PI / 180;
    const latMid = ((aLat + bLat) / 2) * toRad;

    const xA = aLng * toRad * Math.cos(latMid) * R;
    const yA = aLat * toRad * R;
    const xB = bLng * toRad * Math.cos(latMid) * R;
    const yB = bLat * toRad * R;
    const xP = pLng * toRad * Math.cos(latMid) * R;
    const yP = pLat * toRad * R;

    const dx = xB - xA;
    const dy = yB - yA;
    const lenSq = dx * dx + dy * dy;

    if (lenSq === 0) {
      return Math.hypot(xP - xA, yP - yA);
    }

    const t = Math.max(0, Math.min(1, ((xP - xA) * dx + (yP - yA) * dy) / lenSq));
    const projX = xA + t * dx;
    const projY = yA + t * dy;

    return Math.hypot(xP - projX, yP - projY);
  };

  // Check if a clicked/aimed point lies along the current active route
  const checkIfPointIsOnRoute = useCallback(
    (pLat: number, pLng: number, toleranceMeters = 160): boolean => {
      // 1. Google Maps Geometry isLocationOnEdge check
      if (window.google?.maps?.geometry?.poly) {
        for (const p of polylinesRef.current) {
          try {
            const isOn = google.maps.geometry.poly.isLocationOnEdge(
              new google.maps.LatLng(pLat, pLng),
              p,
              0.0016
            );
            if (isOn) return true;
          } catch (e) {}
        }
      }

      // 2. High-precision coordinate segment math fallback
      const myRoutes = activeDisplayRoutes.filter((r) => !r.forUserId || r.forUserId === currentUserId);
      for (const route of myRoutes) {
        if (!route.coordinates || route.coordinates.length < 2) continue;
        for (let i = 0; i < route.coordinates.length - 1; i++) {
          const [lat1, lng1] = route.coordinates[i];
          const [lat2, lng2] = route.coordinates[i + 1];
          const dist = getDistanceToSegmentMeters(pLat, pLng, lat1, lng1, lat2, lng2);
          if (dist <= toleranceMeters) return true;
        }
      }
      return false;
    },
    [activeDisplayRoutes, currentUserId]
  );

  // Clear pointed route detour and restore original direct route
  const handleClearPointedRoute = useCallback(() => {
    setPointedPoint(null);
    if (originalDirectRoutesRef.current.length > 0) {
      setActiveDisplayRoutes(originalDirectRoutesRef.current);
      if (onRoutesCalculated) {
        const myRoutes = originalDirectRoutesRef.current.filter((r) => !r.forUserId || r.forUserId === currentUserId);
        onRoutesCalculated(myRoutes);
      }
    }
    setPinnedConfirmationToast('Reverted to direct route');
    setTimeout(() => setPinnedConfirmationToast(null), 2500);
  }, [onRoutesCalculated, currentUserId]);

  // Main Point Location Handler
  const handlePointLocation = useCallback(
    async (lat: number, lng: number) => {
      // 1. If pointing on our route: keep route unchanged!
      const isOnRoute = checkIfPointIsOnRoute(lat, lng);

      playPinChime();
      if (navigator.vibrate) {
        navigator.vibrate(25);
      }

      if (isOnRoute) {
        setPointedPoint({
          lat,
          lng,
          isOnRoute: true,
        });
        setPinnedConfirmationToast('✨ Point is on current route');
        setTimeout(() => setPinnedConfirmationToast(null), 2800);
        return;
      }

      // 2. If pointing to another location: calculate route through there with all alternatives!
      setIsCalculatingPointRoute(true);
      setPointedPoint({
        lat,
        lng,
        isOnRoute: false,
      });
      setPinnedConfirmationToast('Calculating route via point...');

      // Cache original direct routes before overriding
      if (originalDirectRoutesRef.current.length === 0 && activeDisplayRoutes.length > 0) {
        originalDirectRoutesRef.current = activeDisplayRoutes;
      }

      const myMember = members.find((m) => m.id === currentUserId);
      const mapCenter = mapInstanceRef.current?.getCenter();
      const userOrigin = myMember?.location
        ? { lat: myMember.location.lat, lng: myMember.location.lng }
        : mapCenter
        ? { lat: mapCenter.lat(), lng: mapCenter.lng() }
        : { lat: 28.6139, lng: 77.2090 };

      const destination = rendezvous
        ? { lat: rendezvous.lat, lng: rendezvous.lng }
        : { lat, lng };

      const hasDistinctDestination = Boolean(
        rendezvous && (Math.abs(rendezvous.lat - lat) > 0.0008 || Math.abs(rendezvous.lng - lng) > 0.0008)
      );

      try {
        if (window.google?.maps?.DirectionsService) {
          const directionsService = new window.google.maps.DirectionsService();
          const request: google.maps.DirectionsRequest = {
            origin: { lat: userOrigin.lat, lng: userOrigin.lng },
            destination,
            travelMode: window.google.maps.TravelMode.DRIVING,
            provideRouteAlternatives: true,
            ...(hasDistinctDestination
              ? {
                  waypoints: [
                    {
                      location: new window.google.maps.LatLng(lat, lng),
                      stopover: true,
                    },
                  ],
                }
              : {}),
          };

          const result = await directionsService.route(request);
          if (result.routes && result.routes.length > 0) {
            const viaRoutes: TravelRoute[] = result.routes.map((r, idx) => {
              const path = r.overview_path || [];
              const coordinates: [number, number][] = path.map((p) => [p.lat(), p.lng()]);
              let totalDistMeters = 0;
              let totalDurationSecs = 0;
              r.legs?.forEach((leg) => {
                totalDistMeters += leg.distance?.value || 0;
                totalDurationSecs += leg.duration?.value || 0;
              });
              const distanceKm = +(totalDistMeters / 1000).toFixed(1);
              const durationMins = Math.round(totalDurationSecs / 60);
              const summary = r.summary ? `via ${r.summary}` : `Route via Point ${idx + 1}`;

              return {
                id: `via-route-${currentUserId}-${idx + 1}`,
                name: summary,
                distanceKm,
                durationMins,
                coordinates,
                color: idx === 0 ? DRIVER_PRIMARY_COLOR : '#60a5fa',
                tag: idx === 0 ? 'Fastest via Point' : `Alternative ${idx + 1}`,
                forUserId: currentUserId,
                forUserName: myMember?.name || 'You',
              };
            });

            // Display via routes with all alternatives
            setActiveDisplayRoutes((prev) => {
              const others = prev.filter((r) => r.forUserId && r.forUserId !== currentUserId);
              return [...viaRoutes, ...others];
            });

            if (onRoutesCalculated) {
              onRoutesCalculated(viaRoutes);
            }

            setPointedPoint((prev) =>
              prev
                ? {
                    ...prev,
                    roadName: viaRoutes[0].name,
                    distanceKm: viaRoutes[0].distanceKm,
                    durationMins: viaRoutes[0].durationMins,
                  }
                : null
            );

            setPinnedConfirmationToast(
              `🛣️ Route via point active (${viaRoutes[0].durationMins}m, ${viaRoutes[0].distanceKm}km)`
            );
            setTimeout(() => setPinnedConfirmationToast(null), 3500);
          }
        }
      } catch (err) {
        console.warn('[GoogleMapView] Error routing via point:', err);
        setPinnedConfirmationToast('No drivable road route found through this point');
        setTimeout(() => setPinnedConfirmationToast(null), 3000);
      } finally {
        setIsCalculatingPointRoute(false);
      }
    },
    [checkIfPointIsOnRoute, activeDisplayRoutes, members, currentUserId, rendezvous, onRoutesCalculated]
  );

  const handleDropPinAtCoords = useCallback((lat: number, lng: number, categoryOverride?: string) => {
    if (!onAddWaypoint) return;
    const cat = categoryOverride || selectedPinCategory;
    const labels: Record<string, string> = {
      'speed-breaker': 'Speed Breaker 🛑',
      'sharp-turn': 'Sharp Turn ↩️',
      'pothole': 'Pothole 🕳️',
      'police': 'Police Checkpoint 👮',
      'fuel': 'Fuel Station ⛽',
      'rest': 'Rest Area ☕',
      'checkpoint': 'Meeting Point 📍',
    };
    const label = labels[cat] || 'Road Marker 📍';
    onAddWaypoint(lat, lng, cat, label);
    playPinChime();
    setPinnedConfirmationToast(`${label} marked on road!`);
    setTimeout(() => setPinnedConfirmationToast(null), 3200);
  }, [onAddWaypoint, selectedPinCategory]);

  const handleDropAtAimedSpot = useCallback((categoryOverride?: string) => {
    if (!mapInstanceRef.current) return;
    const center = mapInstanceRef.current.getCenter();
    if (!center) return;
    handleDropPinAtCoords(center.lat(), center.lng(), categoryOverride);
  }, [handleDropPinAtCoords]);

  const handleDropAtMyGPS = useCallback((categoryOverride?: string) => {
    const me = members.find((m) => m.id === currentUserId);
    if (!me?.location) return;
    handleDropPinAtCoords(me.location.lat, me.location.lng, categoryOverride);
  }, [members, currentUserId, handleDropPinAtCoords]);

  // Turn map cursor into crosshair when Pointing Pin Mode is active
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    mapInstanceRef.current.setOptions({
      draggableCursor: isPointingPinMode ? 'crosshair' : undefined,
    });
  }, [isPointingPinMode]);

  const clickHandlerRef = useRef<(lat: number, lng: number) => void>();
  clickHandlerRef.current = (lat: number, lng: number) => {
    if (isSettingRendezvous) {
      onSelectLocationForRendezvous(lat, lng);
    } else if (pinningWaypoint && onPlaceWaypointOnMap) {
      onPlaceWaypointOnMap(lat, lng);
    } else {
      // User tapped map: check route and route through point!
      handlePointLocation(lat, lng);
      if (isPointingPinMode) {
        setIsPointingPinMode(false);
      }
    }
  };

  // Load Google Maps Script
  useEffect(() => {
    if (window.google?.maps) {
      setIsLoaded(true);
      return;
    }

    const scriptId = 'google-maps-script';
    if (document.getElementById(scriptId)) {
      const checkInterval = setInterval(() => {
        if (window.google?.maps) {
          clearInterval(checkInterval);
          setIsLoaded(true);
        }
      }, 100);
      return () => clearInterval(checkInterval);
    }

    const script = document.createElement('script');
    script.id = scriptId;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=geometry,places`;
    script.async = true;
    script.defer = true;

    script.onload = () => setIsLoaded(true);
    script.onerror = (e) => {
      console.warn('Google Maps failed to load, falling back:', e);
      if (onLoadError) onLoadError(new Error('Google Maps script load failed'));
    };

    document.head.appendChild(script);
  }, [apiKey]);

  // Initialize Map
  useEffect(() => {
    if (!isLoaded || !mapContainerRef.current || mapInstanceRef.current || !window.google?.maps) {
      return;
    }

    const isV2VMode = isTripActive || tileStyle === 'v2v';
    const mapTypeId =
      tileStyle === 'terrain'
        ? google.maps.MapTypeId.TERRAIN
        : tileStyle === 'satellite'
        ? google.maps.MapTypeId.HYBRID
        : google.maps.MapTypeId.ROADMAP;

    const myMember = members.find((m) => m.id === currentUserId);
    const initialCenter = myMember?.location
      ? { lat: myMember.location.lat, lng: myMember.location.lng }
      : { lat: 20.5937, lng: 78.9629 }; // Centered on India default
    const initialZoom = isV2VMode ? 17 : myMember?.location ? 14 : 5;

    const map = new google.maps.Map(mapContainerRef.current, {
      center: initialCenter,
      zoom: initialZoom,
      mapTypeId,
      styles: isV2VMode ? OBSIDIAN_V2V_MAP_STYLE : undefined,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
      zoomControl: !isV2VMode,
      zoomControlOptions: { position: google.maps.ControlPosition.RIGHT_BOTTOM },
    });

    // Map Click Listener to drop / move Meeting Spot or place road marker
    map.addListener('click', (e: google.maps.MapMouseEvent) => {
      if (e.latLng) {
        clickHandlerRef.current?.(e.latLng.lat(), e.latLng.lng());
      }
    });

    // Detect user manual pan/drag: lock camera at user's chosen spot
    map.addListener('dragstart', () => {
      isManualNavRef.current = true;
      setIsManualNav(true);
    });

    // Detect user manual zoom: lock camera at user's chosen zoom level
    map.addListener('zoom_changed', () => {
      if (!isProgrammaticCameraChangeRef.current) {
        isManualNavRef.current = true;
        setIsManualNav(true);
      }
    });

    mapInstanceRef.current = map;
  }, [isLoaded]);

  // Fit all squad members and meeting point comfortably on screen
  const fitAllTravelers = useCallback(() => {
    if (!mapInstanceRef.current || !window.google?.maps) return;

    const membersWithLoc = members.filter((m) => m.location && m.status !== 'offline');
    if (membersWithLoc.length === 0 && !rendezvous) return;

    if (membersWithLoc.length === 0 && rendezvous) {
      mapInstanceRef.current.panTo({ lat: rendezvous.lat, lng: rendezvous.lng });
      mapInstanceRef.current.setZoom(14);
      return;
    }

    if (membersWithLoc.length === 1 && !rendezvous) {
      const single = membersWithLoc[0].location!;
      mapInstanceRef.current.panTo({ lat: single.lat, lng: single.lng });
      mapInstanceRef.current.setZoom(15);
      return;
    }

    const bounds = new google.maps.LatLngBounds();
    membersWithLoc.forEach((m) => {
      bounds.extend(new google.maps.LatLng(m.location!.lat, m.location!.lng));
    });

    if (rendezvous) {
      bounds.extend(new google.maps.LatLng(rendezvous.lat, rendezvous.lng));
    }

    mapInstanceRef.current.fitBounds(bounds, {
      top: 100,
      bottom: 120,
      left: 60,
      right: 60,
    });
  }, [members, rendezvous]);

  // Update Map Type & Obsidian Noir V2V Styling
  useEffect(() => {
    if (!mapInstanceRef.current || !window.google?.maps) return;

    const isV2VMode = isTripActive || tileStyle === 'v2v';

    if (isV2VMode) {
      mapInstanceRef.current.setMapTypeId(google.maps.MapTypeId.ROADMAP);
      mapInstanceRef.current.setOptions({ styles: OBSIDIAN_V2V_MAP_STYLE });
    } else {
      const mapTypeId =
        tileStyle === 'terrain'
          ? google.maps.MapTypeId.TERRAIN
          : tileStyle === 'satellite'
          ? google.maps.MapTypeId.HYBRID
          : google.maps.MapTypeId.ROADMAP;

      mapInstanceRef.current.setMapTypeId(mapTypeId);
      mapInstanceRef.current.setOptions({ styles: null });
    }
  }, [tileStyle, isTripActive]);

  // 3D Cockpit Camera Orientation & Tracking in V2V Trip Mode
  useEffect(() => {
    if (!mapInstanceRef.current || !window.google?.maps) return;

    // Never override camera position or zoom if user is manually panning or inspecting
    if (isManualNavRef.current) return;

    const isV2VMode = isTripActive || tileStyle === 'v2v';
    const myMember = members.find((m) => m.id === currentUserId);

    if (isV2VMode) {
      if (isCornerMapSwapped) {
        // Swapped: Main screen displays full convoy route overview
        try {
          if (typeof (mapInstanceRef.current as any).setTilt === 'function') {
            mapInstanceRef.current.setTilt(0);
          }
          if (typeof (mapInstanceRef.current as any).setHeading === 'function') {
            mapInstanceRef.current.setHeading(0);
          }
        } catch (e) {}
        fitAllTravelers();
        return;
      }

      // Default: Main screen displays Google Maps Zoomed Driver Navigation View
      if (is3DTiltActive) {
        try {
          if (typeof (mapInstanceRef.current as any).setTilt === 'function') {
            mapInstanceRef.current.setTilt(55);
          }
          if (myMember?.location?.heading !== undefined && typeof (mapInstanceRef.current as any).setHeading === 'function') {
            mapInstanceRef.current.setHeading(myMember.location.heading);
          }
        } catch (e) {}
      } else {
        try {
          if (typeof (mapInstanceRef.current as any).setTilt === 'function') {
            mapInstanceRef.current.setTilt(0);
          }
          if (typeof (mapInstanceRef.current as any).setHeading === 'function') {
            mapInstanceRef.current.setHeading(0);
          }
        } catch (e) {}
      }

      if (myMember?.location) {
        isProgrammaticCameraChangeRef.current = true;
        mapInstanceRef.current.panTo({ lat: myMember.location.lat, lng: myMember.location.lng });
        const currentZoom = mapInstanceRef.current.getZoom();
        if (currentZoom != null && currentZoom < 18) {
          mapInstanceRef.current.setZoom(18.5);
        }
        setTimeout(() => {
          isProgrammaticCameraChangeRef.current = false;
        }, 300);
      } else if (rendezvous) {
        isProgrammaticCameraChangeRef.current = true;
        mapInstanceRef.current.panTo({ lat: rendezvous.lat, lng: rendezvous.lng });
        setTimeout(() => {
          isProgrammaticCameraChangeRef.current = false;
        }, 300);
      }
    } else {
      try {
        if (typeof (mapInstanceRef.current as any).setTilt === 'function') {
          mapInstanceRef.current.setTilt(0);
        }
        if (typeof (mapInstanceRef.current as any).setHeading === 'function') {
          mapInstanceRef.current.setHeading(0);
        }
      } catch (e) {}
    }
  }, [isTripActive, tileStyle, is3DTiltActive, isCornerMapSwapped, currentUserId, rendezvous, fitAllTravelers]);

  // Initial smart camera: auto-fit if rendezvous or friends are present, otherwise center on user
  const hasInitializedCameraRef = useRef(false);
  useEffect(() => {
    const myMember = members.find((m) => m.id === currentUserId);
    if (!mapInstanceRef.current || !myMember?.location) return;

    if (!hasInitializedCameraRef.current) {
      hasInitializedCameraRef.current = true;
      const friendsWithLoc = members.filter((m) => m.id !== currentUserId && m.location && m.status !== 'offline');
      if (rendezvous || friendsWithLoc.length > 0) {
        fitAllTravelers();
      } else {
        mapInstanceRef.current.panTo({ lat: myMember.location.lat, lng: myMember.location.lng });
        if (mapInstanceRef.current.getZoom()! < 12) {
          mapInstanceRef.current.setZoom(15);
        }
      }
    }
  }, [members, rendezvous, currentUserId, fitAllTravelers]);

  // Auto-fit bounds whenever rendezvous is updated or arrived
  useEffect(() => {
    if (rendezvous && isLoaded && mapInstanceRef.current && !isTripActive && !isManualNavRef.current) {
      fitAllTravelers();
    }
  }, [rendezvous?.lat, rendezvous?.lng, isLoaded, isTripActive, fitAllTravelers]);

  // Global fit_all event listener
  useEffect(() => {
    const handleFitAll = () => fitAllTravelers();
    window.addEventListener('wandersync:fit_all', handleFitAll);
    return () => window.removeEventListener('wandersync:fit_all', handleFitAll);
  }, [fitAllTravelers]);

  // =========================================================================
  // CORE FEATURE: GOOGLE DIRECTIONS ENGINE TO MEETING DESTINATION
  // =========================================================================
  const routeCalcDebounceRef = useRef<any>(null);
  const lastCalculatedParamsRef = useRef<string>('');

  const recalculateAllRoutes = useCallback(async () => {
    if (!isLoaded || !mapInstanceRef.current || !window.google?.maps) return;

    // Only calculate routes if rendezvous / meeting point is set!
    if (!rendezvous) {
      setActiveDisplayRoutes([]);
      if (onRoutesCalculated) onRoutesCalculated([]);
      return;
    }

    const myMember = members.find((m) => m.id === currentUserId);
    const friendsWithLoc = members.filter((m) => m.id !== currentUserId && m.location);

    // Determine user starting origin:
    // Prefer real GPS; if not yet locked or desktop, fallback to current map center or default coordinates
    const mapCenter = mapInstanceRef.current?.getCenter();
    const userOrigin = myMember?.location
      ? { lat: myMember.location.lat, lng: myMember.location.lng }
      : mapCenter
      ? { lat: mapCenter.lat(), lng: mapCenter.lng() }
      : { lat: 28.6139, lng: 77.2090 };

    // Fingerprint to avoid duplicate calls if coordinates haven't moved noticeably
    const currentFingerprint = `${rendezvous.lat.toFixed(4)},${rendezvous.lng.toFixed(4)}_${userOrigin.lat.toFixed(3)},${userOrigin.lng.toFixed(3)}_${friendsWithLoc.map(f => `${f.id}:${f.location!.lat.toFixed(3)},${f.location!.lng.toFixed(3)}`).join(';')}`;
    if (currentFingerprint === lastCalculatedParamsRef.current) return;

    const destination = { lat: rendezvous.lat, lng: rendezvous.lng };
    const newCalculatedRoutes: TravelRoute[] = [];

    // Helper to fetch real routes with full curve geometries from backend routing API
    const fetchRealRoute = async (startLat: number, startLng: number, endLat: number, endLng: number) => {
      // 1. Try backend (Google Routes API → OSRM fallback)
      try {
        const res = await fetch('/api/routes/google', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ startLat, startLng, endLat, endLng, mode: 'driving' }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.success && Array.isArray(data.routes) && data.routes.length > 0) {
            return data.routes;
          }
        }
      } catch (err) {
        console.warn('[GoogleMapView] Backend route fetch failed:', err);
      }

      // 2. Fallback: Use Google Maps DirectionsService (client-side, real road geometry)
      if (window.google?.maps?.DirectionsService) {
        try {
          const directionsService = new window.google.maps.DirectionsService();
          const result = await directionsService.route({
            origin: { lat: startLat, lng: startLng },
            destination: { lat: endLat, lng: endLng },
            travelMode: window.google.maps.TravelMode.DRIVING,
            provideRouteAlternatives: true,
          });
          if (result.routes && result.routes.length > 0) {
            return result.routes.map((r: google.maps.DirectionsRoute, idx: number) => {
              const path = r.overview_path || [];
              const coordinates: [number, number][] = path.map((p: google.maps.LatLng) => [p.lat(), p.lng()]);
              const leg = r.legs?.[0];
              const distanceKm = leg?.distance?.value ? +(leg.distance.value / 1000).toFixed(1) : 0;
              const durationMins = leg?.duration?.value ? Math.round(leg.duration.value / 60) : 0;
              const routeName = r.summary ? `via ${r.summary}` : `Route ${idx + 1}`;
              return {
                id: `gmaps-route-${idx + 1}`,
                name: routeName,
                distanceKm,
                durationMins,
                coordinates,
              };
            });
          }
        } catch (err) {
          console.warn('[GoogleMapView] Google Directions Service fallback failed:', err);
        }
      }

      // 3. No route available — return empty (no fake lines)
      return [];
    };

    const promises: Promise<void>[] = [];
    const myCalculatedRoutes: TravelRoute[] = [];
    const friendCalculatedRoutes: TravelRoute[] = [];

    // 1A. User route to rendezvous (with alternatives)
    promises.push(
      fetchRealRoute(userOrigin.lat, userOrigin.lng, destination.lat, destination.lng).then((resRoutes) => {
        if (resRoutes && resRoutes.length > 0) {
          resRoutes.forEach((r: any, idx: number) => {
            myCalculatedRoutes.push({
              id: `my-route-${currentUserId}-${idx + 1}`,
              name: r.name,
              distanceKm: r.distanceKm,
              durationMins: r.durationMins,
              coordinates: r.coordinates,
              color: idx === 0 ? (myMember?.color || '#2563eb') : '#60a5fa',
              tag: idx === 0 ? 'Fastest for You' : `Alternative ${idx + 1}`,
              forUserId: currentUserId,
              forUserName: myMember?.name || 'You',
            });
          });
        }
      })
    );

    // 1B. Squad friends routes to rendezvous (compute only if not already provided by server)
    friendsWithLoc.forEach((friend) => {
      const existingFriendRoute = (routes || []).find((r) => r.forUserId === friend.id);
      if (!existingFriendRoute) {
        const friendOrigin = { lat: friend.location!.lat, lng: friend.location!.lng };
        promises.push(
          fetchRealRoute(friendOrigin.lat, friendOrigin.lng, destination.lat, destination.lng).then((res) => {
            if (res && res.length > 0) {
              const primary = res[0];
              friendCalculatedRoutes.push({
                id: `friend-route-${friend.id}`,
                name: primary.name,
                distanceKm: primary.distanceKm,
                durationMins: primary.durationMins,
                coordinates: primary.coordinates,
                color: friend.color || '#10b981',
                tag: `${friend.name}'s route`,
                forUserId: friend.id,
                forUserName: friend.name,
              });
            }
          })
        );
      }
    });

    await Promise.all(promises);

    if (myCalculatedRoutes.length > 0) {
      lastCalculatedParamsRef.current = currentFingerprint;
      // Merge this traveler's routes with existing remote squad routes
      const remoteRoutes = (routes || []).filter((r) => r.forUserId && r.forUserId !== currentUserId);
      const combined = [...myCalculatedRoutes, ...remoteRoutes, ...friendCalculatedRoutes];
      setActiveDisplayRoutes(combined);
      // Publish ONLY this user's routes to the server so other members' routes are never overwritten!
      if (onRoutesCalculated) onRoutesCalculated([...myCalculatedRoutes]);
    }
  }, [rendezvous, members, currentUserId, isLoaded, onRoutesCalculated, routes]);

  // Members location fingerprint to automatically recalculate when friends join or move
  const membersLocFingerprint = members
    .map((m) => `${m.id}:${m.location?.lat?.toFixed(3)},${m.location?.lng?.toFixed(3)}`)
    .join(';');

  // Debounced route calculation trigger: recalculate on rendezvous or squad location changes
  useEffect(() => {
    lastCalculatedParamsRef.current = '';
    if (routeCalcDebounceRef.current) clearTimeout(routeCalcDebounceRef.current);
    routeCalcDebounceRef.current = setTimeout(() => {
      recalculateAllRoutes();
    }, 250);
    return () => {
      if (routeCalcDebounceRef.current) clearTimeout(routeCalcDebounceRef.current);
    };
  }, [rendezvous?.lat, rendezvous?.lng, membersLocFingerprint, recalculateAllRoutes]);

  // =========================================================================
  // DRAW ALL POLYLINES (AUTHENTIC GOOGLE MAPS HIGHWAY & ROAD DISPLAY)
  // =========================================================================
  useEffect(() => {
    if (!mapInstanceRef.current || !window.google?.maps) return;

    // Clear old polylines
    polylinesRef.current.forEach((p) => p.setMap(null));
    polylinesRef.current = [];

    const displayRoutes = activeDisplayRoutes.length > 0 ? activeDisplayRoutes : routes;
    const myMember = members.find((m) => m.id === currentUserId);
    const myAssignedRouteId = myMember?.assignedRouteId;

    const myRoutesList = displayRoutes.filter((r) => !r.forUserId || r.forUserId === currentUserId);
    const myChosenRoute = myAssignedRouteId
      ? myRoutesList.find((r) => r.id === myAssignedRouteId) || myRoutesList[0]
      : myRoutesList[0];

    const otherFriends = members.filter((m) => m.id !== currentUserId);

    type RouteRenderItem = {
      route: TravelRoute;
      isDriver: boolean;
      isSelected: boolean;
      primaryColor: string;
      ownerName: string;
      ownerAvatar: string;
    };

    const routesToDraw: RouteRenderItem[] = [];

    // 1. Driver's Chosen Route (Electric Cyan #00f0ff)
    if (myChosenRoute && myChosenRoute.coordinates && myChosenRoute.coordinates.length >= 2) {
      routesToDraw.push({
        route: myChosenRoute,
        isDriver: true,
        isSelected: true,
        primaryColor: DRIVER_PRIMARY_COLOR,
        ownerName: myMember?.name || 'You (Driver)',
        ownerAvatar: myMember?.avatar || '🚗',
      });
    }

    // 2. Driver Alternative Routes (Only before trip starts, subtle slate for tap-to-select)
    if (!isTripActive) {
      const myAlternatives = myRoutesList.filter((r) => r.id !== myChosenRoute?.id);
      myAlternatives.forEach((altRoute) => {
        if (altRoute.coordinates && altRoute.coordinates.length >= 2) {
          routesToDraw.push({
            route: altRoute,
            isDriver: true,
            isSelected: false,
            primaryColor: '#64748b',
            ownerName: myMember?.name || 'You (Driver)',
            ownerAvatar: myMember?.avatar || '🚗',
          });
        }
      });
    }

    // 3. Friends' CHOSEN Routes ONLY (Strictly 1 chosen route per friend, distinct colors)
    otherFriends.forEach((friend, fIdx) => {
      const friendRoutes = displayRoutes.filter((r) => r.forUserId === friend.id);
      const friendChosen = friend.assignedRouteId
        ? friendRoutes.find((r) => r.id === friend.assignedRouteId) || friendRoutes[0]
        : friendRoutes[0];

      if (friendChosen && friendChosen.coordinates && friendChosen.coordinates.length >= 2) {
        const friendColor =
          friend.color && friend.color !== '#00f0ff' && friend.color !== '#3b82f6'
            ? friend.color
            : SQUAD_FRIEND_PALETTE[fIdx % SQUAD_FRIEND_PALETTE.length];

        routesToDraw.push({
          route: friendChosen,
          isDriver: false,
          isSelected: true,
          primaryColor: friendColor,
          ownerName: friend.name,
          ownerAvatar: friend.avatar || '🎒',
        });
      }
    });

    const isV2VMode = isTripActive || tileStyle === 'v2v';

    routesToDraw.forEach((item) => {
      const path = item.route.coordinates.map(([lat, lng]) => ({ lat, lng }));
      let interactivePolyline: google.maps.Polyline;

      if (isV2VMode && item.isSelected) {
        // =====================================================================
        // V2V FUTURISTIC NEON LASER BEAM (Vibrant & Distinct Per Member)
        // =====================================================================
        // Layer 1: Wide Atmospheric Glow (Bloom) in Member's distinct color
        const outerGlowPolyline = new google.maps.Polyline({
          path,
          geodesic: true,
          strokeColor: item.primaryColor,
          strokeOpacity: 0.38,
          strokeWeight: 14,
          zIndex: item.isDriver ? 17 : 14,
          clickable: false,
          map: mapInstanceRef.current,
        });
        polylinesRef.current.push(outerGlowPolyline);

        // Layer 2: Radiant Colored Laser Beam
        const midLaserPolyline = new google.maps.Polyline({
          path,
          geodesic: true,
          strokeColor: item.primaryColor,
          strokeOpacity: 0.95,
          strokeWeight: 5,
          zIndex: item.isDriver ? 18 : 15,
          clickable: false,
          map: mapInstanceRef.current,
        });
        polylinesRef.current.push(midLaserPolyline);

        // Layer 3: White-Hot Center Core Laser with Forward Chevrons
        interactivePolyline = new google.maps.Polyline({
          path,
          geodesic: true,
          strokeColor: '#ffffff',
          strokeOpacity: 1.0,
          strokeWeight: 2.2,
          zIndex: item.isDriver ? 19 : 16,
          icons: [
            {
              icon: {
                path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
                scale: 2.6,
                strokeColor: '#ffffff',
                fillColor: item.primaryColor,
                fillOpacity: 1,
                strokeWeight: 1.2,
              },
              offset: '100%',
              repeat: '60px',
            },
          ],
          map: mapInstanceRef.current,
        });
        polylinesRef.current.push(interactivePolyline);
      } else if (item.isSelected) {
        // 1. Shadow / Casing Polyline for highway depth & contrast
        const casingPolyline = new google.maps.Polyline({
          path,
          geodesic: true,
          strokeColor: '#0f172a',
          strokeOpacity: 0.65,
          strokeWeight: 8,
          zIndex: item.isDriver ? 12 : 9,
          clickable: false,
          map: mapInstanceRef.current,
        });
        polylinesRef.current.push(casingPolyline);

        // 2. Core Road Polyline (exact street turns, curves, and flyovers)
        interactivePolyline = new google.maps.Polyline({
          path,
          geodesic: true,
          strokeColor: item.primaryColor,
          strokeOpacity: 0.95,
          strokeWeight: 5,
          zIndex: item.isDriver ? 13 : 10,
          icons: [
            {
              icon: {
                path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
                scale: 2.8,
                strokeColor: '#ffffff',
                fillColor: item.primaryColor,
                fillOpacity: 1,
                strokeWeight: 1.5,
              },
              offset: '100%',
              repeat: '65px',
            },
          ],
          map: mapInstanceRef.current,
        });
        polylinesRef.current.push(interactivePolyline);
      } else {
        // Driver unselected alternative (subtle gray, clickable to switch)
        const altCasing = new google.maps.Polyline({
          path,
          geodesic: true,
          strokeColor: '#1e293b',
          strokeOpacity: 0.35,
          strokeWeight: 6,
          zIndex: 4,
          clickable: false,
          map: mapInstanceRef.current,
        });
        polylinesRef.current.push(altCasing);

        interactivePolyline = new google.maps.Polyline({
          path,
          geodesic: true,
          strokeColor: '#64748b',
          strokeOpacity: 0.65,
          strokeWeight: 3.5,
          zIndex: 5,
          map: mapInstanceRef.current,
        });
        polylinesRef.current.push(interactivePolyline);
      }

      // Click polyline to see route details or select alternative route
      const infoWindow = new google.maps.InfoWindow({
        content: `
          <div style="color: #0f172a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 6px; min-width: 170px;">
            <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 4px;">
              <span style="font-size: 15px;">${item.ownerAvatar}</span>
              <span style="font-weight: 800; font-size: 12px; color: ${item.primaryColor};">${item.ownerName}'s Route</span>
            </div>
            <div style="font-weight: 700; font-size: 13px; color: #0f172a; margin-bottom: 2px;">${item.route.name}</div>
            <div style="font-size: 12px; color: #475569; display: flex; align-items: center; gap: 8px; margin-top: 4px;">
              <span>🛣️ <b>${item.route.distanceKm} km</b></span>
              <span>⏱️ <b>${item.route.durationMins} min</b></span>
            </div>
            ${item.route.tag ? `<div style="margin-top: 6px; display: inline-block; padding: 2px 8px; border-radius: 6px; background: #eff6ff; color: #1d4ed8; font-size: 10px; font-weight: 700;">${item.route.tag}</div>` : ''}
            ${
              item.isDriver && !item.isSelected
                ? `<div style="margin-top: 6px; font-size: 11px; color: #2563eb; font-weight: 700;">👆 Tap to choose this route</div>`
                : ''
            }
          </div>
        `,
      });

      interactivePolyline.addListener('click', (e: google.maps.PolyMouseEvent) => {
        if (e.latLng) {
          infoWindow.setPosition(e.latLng);
          infoWindow.open(mapInstanceRef.current);
        }
        if (item.isDriver && onSelectRoute) {
          onSelectRoute(item.route.id);
        }
      });
    });
  }, [activeDisplayRoutes, routes, currentUserId, isLoaded, members, onSelectRoute, isTripActive, tileStyle]);

  // =========================================================================
  // RENDER RENDEZVOUS PIN WITH CLICK AND HOVER
  // =========================================================================
  useEffect(() => {
    if (!mapInstanceRef.current || !window.google?.maps) return;

    if (rendezvousOverlayRef.current) {
      rendezvousOverlayRef.current.setMap(null);
      rendezvousOverlayRef.current = null;
    }
    if (nativeRendezvousMarkerRef.current) {
      nativeRendezvousMarkerRef.current.setMap(null);
      nativeRendezvousMarkerRef.current = null;
    }

    if (!rendezvous) return;

    // 1. Guaranteed native Google Maps marker (WebGL layer)
    try {
      const marker = new google.maps.Marker({
        position: { lat: rendezvous.lat, lng: rendezvous.lng },
        map: mapInstanceRef.current,
        title: `🎯 ${rendezvous.title || 'Meeting Spot'}`,
        zIndex: 20,
        animation: google.maps.Animation.DROP,
      });
      nativeRendezvousMarkerRef.current = marker;
    } catch (e) {}

    // 2. Rich Animated Custom DOM Overlay Badge
    class RendezvousOverlay extends google.maps.OverlayView {
      private div: HTMLDivElement | null = null;
      private position: google.maps.LatLng;

      constructor(lat: number, lng: number) {
        super();
        this.position = new google.maps.LatLng(lat, lng);
      }

      onAdd() {
        this.div = document.createElement('div');
        this.div.style.position = 'absolute';
        this.div.style.transform = 'translate(-50%, -100%)';
        this.div.style.cursor = 'pointer';
        this.div.innerHTML = `
          <div class="flex flex-col items-center">
            <div class="w-12 h-12 rounded-full bg-gradient-to-tr from-amber-500 to-red-500 border-2 border-amber-200 shadow-2xl flex items-center justify-center text-2xl animate-bounce">
              📍
            </div>
            <div class="mt-1 px-3 py-1 rounded-full bg-slate-900/95 border border-amber-400 text-amber-300 text-[11px] font-bold whitespace-nowrap shadow-xl">
              🎯 ${rendezvous.title || 'Meeting Spot'}
            </div>
          </div>
        `;

        const panes = this.getPanes();
        if (panes && panes.overlayMouseTarget && this.div) {
          panes.overlayMouseTarget.appendChild(this.div);
        }
      }

      draw() {
        try {
          if (!this.div) return;
          const projection = this.getProjection();
          if (!projection) return;
          const pos = projection.fromLatLngToDivPixel(this.position);
          if (pos) {
            this.div.style.left = `${pos.x}px`;
            this.div.style.top = `${pos.y}px`;
          }
        } catch (e) {}
      }

      onRemove() {
        if (this.div?.parentNode) {
          this.div.parentNode.removeChild(this.div);
          this.div = null;
        }
      }
    }

    const overlay = new RendezvousOverlay(rendezvous.lat, rendezvous.lng);
    overlay.setMap(mapInstanceRef.current);
    rendezvousOverlayRef.current = overlay;

    return () => {
      if (rendezvousOverlayRef.current) {
        rendezvousOverlayRef.current.setMap(null);
        rendezvousOverlayRef.current = null;
      }
      if (nativeRendezvousMarkerRef.current) {
        nativeRendezvousMarkerRef.current.setMap(null);
        nativeRendezvousMarkerRef.current = null;
      }
    };
  }, [rendezvous, isLoaded]);

  // =========================================================================
  // RENDER POINTED LOCATION BEACON (CREATIVE, MINIMAL GLOWING BADGE)
  // =========================================================================
  useEffect(() => {
    if (!mapInstanceRef.current || !window.google?.maps) return;

    if (pointedOverlayRef.current) {
      pointedOverlayRef.current.setMap(null);
      pointedOverlayRef.current = null;
    }

    if (!pointedPoint) return;

    class PointedPointOverlay extends google.maps.OverlayView {
      private div: HTMLDivElement | null = null;
      private position: google.maps.LatLng;

      constructor(lat: number, lng: number) {
        super();
        this.position = new google.maps.LatLng(lat, lng);
      }

      onAdd() {
        this.div = document.createElement('div');
        this.div.style.position = 'absolute';
        this.div.style.transform = 'translate(-50%, -100%)';
        this.div.style.cursor = 'pointer';
        this.div.className = 'pointer-events-auto select-none';

        const isGreen = Boolean(pointedPoint?.isOnRoute);
        const label = isGreen
          ? 'On Route'
          : pointedPoint?.distanceKm
          ? `${pointedPoint.distanceKm} km • via Point`
          : 'Route via Point';

        this.div.innerHTML = `
          <div class="flex flex-col items-center">
            <!-- Radiant Pulsing Beacon -->
            <div class="relative flex items-center justify-center">
              <span class="absolute w-8 h-8 rounded-full ${isGreen ? 'bg-[#34C759]/35' : 'bg-[#00f0ff]/35'} animate-ping"></span>
              <span class="absolute w-5 h-5 rounded-full ${isGreen ? 'bg-[#34C759]/25 border border-[#34C759]/70' : 'bg-[#00f0ff]/25 border border-[#00f0ff]/70'}"></span>
              <div class="w-3.5 h-3.5 rounded-full ${isGreen ? 'bg-[#34C759] shadow-[0_0_12px_#34C759]' : 'bg-[#00f0ff] shadow-[0_0_12px_#00f0ff]'} border border-white/90"></div>
            </div>

            <!-- Stem -->
            <div class="w-[2px] h-2.5 ${isGreen ? 'bg-[#34C759]' : 'bg-[#00f0ff]'} shadow-[0_0_6px_currentColor]"></div>

            <!-- Minimal Creative Glass Pill -->
            <div class="apple-glass-pill px-2.5 py-1 rounded-full text-[10px] font-bold shadow-2xl flex items-center gap-1.5 border border-white/20 mt-0.5">
              <span>${isGreen ? '✨' : '🛣️'}</span>
              <span class="${isGreen ? 'text-[#34C759]' : 'text-white'}">${label}</span>
              ${!isGreen ? '<button id="clear-pointed-btn" class="ml-1 text-slate-400 hover:text-white px-1 text-xs" title="Clear detour">✕</button>' : ''}
            </div>
          </div>
        `;

        const clearBtn = this.div.querySelector('#clear-pointed-btn');
        if (clearBtn) {
          clearBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            handleClearPointedRoute();
          });
        }

        const panes = this.getPanes();
        if (panes && panes.overlayMouseTarget && this.div) {
          panes.overlayMouseTarget.appendChild(this.div);
        }
      }

      draw() {
        try {
          if (!this.div) return;
          const projection = this.getProjection();
          if (!projection) return;
          const pos = projection.fromLatLngToDivPixel(this.position);
          if (pos) {
            this.div.style.left = `${pos.x}px`;
            this.div.style.top = `${pos.y}px`;
          }
        } catch (e) {}
      }

      onRemove() {
        if (this.div?.parentNode) {
          this.div.parentNode.removeChild(this.div);
          this.div = null;
        }
      }
    }

    const overlay = new PointedPointOverlay(pointedPoint.lat, pointedPoint.lng);
    overlay.setMap(mapInstanceRef.current);
    pointedOverlayRef.current = overlay;

    return () => {
      if (pointedOverlayRef.current) {
        pointedOverlayRef.current.setMap(null);
        pointedOverlayRef.current = null;
      }
    };
  }, [pointedPoint, handleClearPointedRoute]);

  // =========================================================================
  // RENDER CUSTOM REAL-TIME AVATAR OVERLAYS (PERSISTENT & NON-FLICKERING)
  // =========================================================================
  useEffect(() => {
    if (!mapInstanceRef.current || !window.google?.maps) return;

    const OverlayClass = getFriendOverlayClass();
    const currentMap = overlaysMapRef.current;
    const activeMemberIds = new Set<string>();
    const isV2VMode = isTripActive || tileStyle === 'v2v';

    members.forEach((member) => {
      if (!member.location) return;
      activeMemberIds.add(member.id);

      const isMe = member.id === currentUserId;
      const isSelected = member.id === selectedMemberId;

      if (currentMap.has(member.id)) {
        const overlay = currentMap.get(member.id);
        overlay.update(member, isMe, isSelected, isV2VMode);
      } else {
        const overlay = new OverlayClass(member, isMe, isSelected, isV2VMode, (id: string) => onSelectMember(id));
        overlay.setMap(mapInstanceRef.current);
        currentMap.set(member.id, overlay);
      }
    });

    // Remove overlays for members who left or have no location
    for (const [id, overlay] of currentMap.entries()) {
      if (!activeMemberIds.has(id)) {
        overlay.setMap(null);
        currentMap.delete(id);
      }
    }

    if (followMe && !isV2VMode) {
      const target = selectedMemberId
        ? members.find((m) => m.id === selectedMemberId)
        : members.find((m) => m.id === currentUserId);

      if (target?.location && mapInstanceRef.current) {
        mapInstanceRef.current.panTo({ lat: target.location.lat, lng: target.location.lng });
      }
    }
  }, [members, currentUserId, selectedMemberId, followMe, isLoaded, onSelectMember, isTripActive, tileStyle]);

  // =========================================================================
  // RENDER ON-ROAD AHEAD VEHICLE DISTANCE TARGET "(o) 350 m" (from reference image)
  // =========================================================================
  useEffect(() => {
    if (!mapInstanceRef.current || !window.google?.maps) return;

    if (v2vTargetOverlayRef.current) {
      v2vTargetOverlayRef.current.setMap(null);
      v2vTargetOverlayRef.current = null;
    }

    const isV2VMode = isTripActive || tileStyle === 'v2v';
    if (!isV2VMode) return;

    const myMember = members.find((m) => m.id === currentUserId);
    if (!myMember?.location) return;

    const otherMembers = members.filter((m) => m.id !== currentUserId && m.location && m.status !== 'offline');
    if (otherMembers.length === 0) return;

    let closest: { member: TravelerMember; distanceMeters: number; lat: number; lng: number } | null = null;
    otherMembers.forEach((other) => {
      const distKm = calcDistanceKm(
        myMember.location.lat,
        myMember.location.lng,
        other.location.lat,
        other.location.lng
      );
      const distMeters = Math.round(distKm * 1000);
      if (distMeters <= 1500) {
        if (!closest || distMeters < closest.distanceMeters) {
          // Position target ~60% along the path to the ahead vehicle
          const targetLat = myMember.location.lat + (other.location.lat - myMember.location.lat) * 0.6;
          const targetLng = myMember.location.lng + (other.location.lng - myMember.location.lng) * 0.6;
          closest = { member: other, distanceMeters: distMeters, lat: targetLat, lng: targetLng };
        }
      }
    });

    if (!closest) return;

    class DistanceTargetOverlay extends google.maps.OverlayView {
      private div: HTMLDivElement | null = null;
      private position: google.maps.LatLng;
      private dist: number;

      constructor(lat: number, lng: number, dist: number) {
        super();
        this.position = new google.maps.LatLng(lat, lng);
        this.dist = dist;
      }

      onAdd() {
        this.div = document.createElement('div');
        this.div.style.position = 'absolute';
        this.div.style.transform = 'translate(-50%, -50%)';
        this.div.style.zIndex = '24';
        this.div.innerHTML = `
          <div class="v2v-distance-target">
            <div class="v2v-target-ring"><div class="v2v-target-dot"></div></div>
            <span class="text-xs font-bold text-red-400 font-mono tracking-tight">${this.dist} m</span>
          </div>
        `;
        const panes = this.getPanes();
        if (panes && panes.overlayMouseTarget && this.div) {
          panes.overlayMouseTarget.appendChild(this.div);
        }
      }

      draw() {
        try {
          if (!this.div) return;
          const pos = this.getProjection()?.fromLatLngToDivPixel(this.position);
          if (pos) {
            this.div.style.left = `${pos.x}px`;
            this.div.style.top = `${pos.y}px`;
          }
        } catch (e) {}
      }

      onRemove() {
        if (this.div?.parentNode) {
          this.div.parentNode.removeChild(this.div);
          this.div = null;
        }
      }
    }

    const overlay = new DistanceTargetOverlay(closest.lat, closest.lng, closest.distanceMeters);
    overlay.setMap(mapInstanceRef.current);
    v2vTargetOverlayRef.current = overlay;

    return () => {
      if (v2vTargetOverlayRef.current) {
        v2vTargetOverlayRef.current.setMap(null);
        v2vTargetOverlayRef.current = null;
      }
    };
  }, [isTripActive, tileStyle, members, currentUserId]);


  // Clean up overlays on unmount
  useEffect(() => {
    return () => {
      overlaysMapRef.current.forEach((o) => o.setMap(null));
      overlaysMapRef.current.clear();
    };
  }, []);

  // Pan to event listener
  useEffect(() => {
    const handlePan = (e: any) => {
      if (e.detail && mapInstanceRef.current) {
        mapInstanceRef.current.panTo({ lat: e.detail.lat, lng: e.detail.lng });
        if (!rendezvous) {
          mapInstanceRef.current.setZoom(14);
        }
      }
    };
    window.addEventListener('wandersync:pan_to', handlePan);
    return () => window.removeEventListener('wandersync:pan_to', handlePan);
  }, [rendezvous]);

  // =========================================================================
  // RENDER WAYPOINT MARKERS (Fuel, Rest, Hazard, etc.)
  // =========================================================================
  useEffect(() => {
    if (!mapInstanceRef.current || !window.google?.maps) return;

    // Clear old waypoint overlays
    waypointOverlaysRef.current.forEach((o) => o.setMap(null));
    waypointOverlaysRef.current = [];

    const wpIcons: Record<string, string> = {
      'speed-breaker': '🛑',
      'sharp-turn': '↩️',
      pothole: '🕳️',
      police: '👮',
      hazard: '⚠️',
      'road-problem': '🚧',
      fuel: '⛽',
      rest: '☕',
      food: '🍕',
      scenic: '📸',
      checkpoint: '🏁',
    };

    const wpColors: Record<string, string> = {
      'speed-breaker': '#ef4444',
      'sharp-turn': '#f59e0b',
      pothole: '#dc2626',
      police: '#3b82f6',
      hazard: '#f97316',
      'road-problem': '#dc2626',
      fuel: '#f59e0b',
      rest: '#8b5cf6',
      food: '#f97316',
      scenic: '#06b6d4',
      checkpoint: '#22c55e',
    };

    waypoints.forEach((wp) => {
      class WaypointOverlay extends google.maps.OverlayView {
        private div: HTMLDivElement | null = null;
        private position: google.maps.LatLng;

        constructor(lat: number, lng: number) {
          super();
          this.position = new google.maps.LatLng(lat, lng);
        }

        onAdd() {
          this.div = document.createElement('div');
          this.div.style.position = 'absolute';
          this.div.style.transform = 'translate(-50%, -100%)';
          this.div.style.cursor = 'pointer';
          this.div.style.zIndex = '20';

          const icon = wpIcons[wp.type] || '📍';
          const isHazardAlert = wp.type === 'speed-breaker' || wp.type === 'sharp-turn' || wp.type === 'pothole';
          this.div.innerHTML = `
            <div style="display: flex; flex-direction: column; align-items: center; position: relative;">
              ${isHazardAlert ? `
                <div style="position: absolute; top: -5px; left: 50%; transform: translateX(-50%); width: 44px; height: 44px; border-radius: 50%; border: 2px solid ${color}; opacity: 0.8; animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite; pointer-events: none;"></div>
              ` : ''}
              <div style="width: 34px; height: 34px; border-radius: 50%; background: ${color}; border: 2.5px solid white; box-shadow: 0 0 16px ${color}aa, 0 4px 10px rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; font-size: 17px; z-index: 2;">
                ${icon}
              </div>
              <div style="margin-top: 3px; padding: 2px 7px; border-radius: 9999px; background: rgba(5,8,14,0.92); border: 1.5px solid ${color}; color: #ffffff; font-size: 9px; font-weight: 800; white-space: nowrap; max-width: 120px; overflow: hidden; text-overflow: ellipsis; box-shadow: 0 2px 8px rgba(0,0,0,0.6); text-transform: uppercase; letter-spacing: 0.04em;">
                ${wp.label}
              </div>
            </div>
          `;

          this.div.addEventListener('click', () => {
            const infoWindow = new google.maps.InfoWindow({
              content: `
                <div style="font-family: sans-serif; padding: 4px; color: #0f172a;">
                  <div style="font-weight: 700; font-size: 13px;">${icon} ${wp.label}</div>
                  <div style="font-size: 11px; color: #475569; margin-top: 2px;">Added by ${wp.addedByName || 'Team member'}</div>
                  <div style="font-size: 10px; color: #94a3b8; margin-top: 2px;">${new Date(wp.timestamp).toLocaleTimeString()}</div>
                </div>
              `,
            });
            infoWindow.setPosition(this.position);
            infoWindow.open(mapInstanceRef.current);
          });

          const panes = this.getPanes();
          if (panes && panes.overlayMouseTarget && this.div) {
            panes.overlayMouseTarget.appendChild(this.div);
          }
        }

        draw() {
          try {
            if (!this.div) return;
            const projection = this.getProjection();
            if (!projection) return;
            const pos = projection.fromLatLngToDivPixel(this.position);
            if (pos) {
              this.div.style.left = `${pos.x}px`;
              this.div.style.top = `${pos.y}px`;
            }
          } catch (e) {}
        }

        onRemove() {
          if (this.div?.parentNode) {
            this.div.parentNode.removeChild(this.div);
            this.div = null;
          }
        }
      }

      const overlay = new WaypointOverlay(wp.lat, wp.lng);
      overlay.setMap(mapInstanceRef.current);
      waypointOverlaysRef.current.push(overlay);
    });
  }, [waypoints, isLoaded]);

  // =========================================================================
  // GOOGLE MAPS ON-ROAD TURN NAVIGATION (SHOWS HOW TO TAKE A TURN & LEFT ON MAP)
  // =========================================================================
  useEffect(() => {
    if (!mapInstanceRef.current || !window.google?.maps || !isTripActive || isCornerMapSwapped) {
      if (turnOverlayRef.current) {
        turnOverlayRef.current.setMap(null);
        turnOverlayRef.current = null;
      }
      setNextManeuver(null);
      return;
    }

    const myMember = members.find((m) => m.id === currentUserId);
    if (!myMember?.location) return;

    const myRoutesList = activeDisplayRoutes.filter((r) => !r.forUserId || r.forUserId === currentUserId);
    const activeRoute = myMember.assignedRouteId
      ? activeDisplayRoutes.find((r) => r.id === myMember.assignedRouteId) || myRoutesList[0]
      : myRoutesList[0];

    const myPos = myMember.location;
    let turnPoint: [number, number] = [myPos.lat + 0.0018, myPos.lng - 0.0015];
    let turnType: 'left' | 'right' | 'slight-left' | 'straight' = 'left';
    let turnLabel = 'Turn Left';
    let distMeters = 220;

    if (activeRoute?.coordinates && activeRoute.coordinates.length >= 3) {
      const coords = activeRoute.coordinates;
      let closestIdx = 0;
      let minDist = Infinity;
      for (let i = 0; i < coords.length; i++) {
        const d = calcDistanceKm(myPos.lat, myPos.lng, coords[i][0], coords[i][1]);
        if (d < minDist) {
          minDist = d;
          closestIdx = i;
        }
      }

      // Look ahead for turn (change in bearing)
      let foundTurn = false;
      for (let i = Math.max(0, closestIdx); i < Math.min(coords.length - 2, closestIdx + 30); i++) {
        const b1 = calcBearing(coords[i][0], coords[i][1], coords[i + 1][0], coords[i + 1][1]);
        const b2 = calcBearing(coords[i + 1][0], coords[i + 1][1], coords[i + 2][0], coords[i + 2][1]);
        const diff = (b2 - b1 + 540) % 360 - 180;

        if (Math.abs(diff) >= 20) {
          turnPoint = coords[i + 1];
          if (diff < -20) {
            turnType = diff < -60 ? 'left' : 'slight-left';
            turnLabel = diff < -60 ? 'Turn Left' : 'Take Slight Left';
          } else {
            turnType = 'right';
            turnLabel = 'Turn Right';
          }
          distMeters = Math.max(40, Math.round(calcDistanceKm(myPos.lat, myPos.lng, turnPoint[0], turnPoint[1]) * 1000));
          foundTurn = true;
          break;
        }
      }

      if (!foundTurn && coords.length > closestIdx + 2) {
        turnPoint = coords[Math.min(closestIdx + 3, coords.length - 1)];
        distMeters = Math.max(50, Math.round(calcDistanceKm(myPos.lat, myPos.lng, turnPoint[0], turnPoint[1]) * 1000));
        turnType = 'left';
        turnLabel = 'Turn Left';
      }
    }

    const streetName = rendezvous ? `Towards ${rendezvous.title.split(',')[0]}` : 'Main Expressway';
    setNextManeuver({
      type: turnType,
      label: turnLabel,
      distMeters,
      streetName,
    });

    // Mount On-Road Turn Overlay
    if (turnOverlayRef.current) {
      turnOverlayRef.current.setMap(null);
      turnOverlayRef.current = null;
    }

    class RoadTurnOverlay extends google.maps.OverlayView {
      private div: HTMLDivElement | null = null;
      private position: google.maps.LatLng;

      constructor(lat: number, lng: number) {
        super();
        this.position = new google.maps.LatLng(lat, lng);
      }

      onAdd() {
        this.div = document.createElement('div');
        this.div.style.position = 'absolute';
        this.div.style.transform = 'translate(-50%, -100%)';
        this.div.style.pointerEvents = 'none';
        this.div.style.zIndex = '120';
        this.div.innerHTML = `
          <div class="flex flex-col items-center pointer-events-none">
            <!-- Animated Glowing Turn Arrow on the Asphalt -->
            <div class="relative flex items-center justify-center">
              <div class="w-16 h-16 rounded-3xl bg-emerald-500 border-2 border-white shadow-[0_0_35px_rgba(16,185,129,0.95)] flex items-center justify-center text-3xl text-white font-black animate-bounce">
                ${turnType === 'right' ? '↱' : '↰'}
              </div>
              <div class="absolute -inset-2.5 rounded-3xl border-2 border-emerald-300 animate-ping opacity-50"></div>
            </div>
            <!-- Asphalt Turn Distance Pill -->
            <div class="mt-2 px-3.5 py-1 rounded-full bg-slate-950/95 border-2 border-emerald-400 text-white text-[11px] font-black uppercase tracking-wider shadow-[0_5px_20px_rgba(0,0,0,0.8)] flex items-center gap-1.5 whitespace-nowrap">
              <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>${turnLabel.toUpperCase()} • IN ${distMeters}M</span>
            </div>
          </div>
        `;

        const panes = this.getPanes();
        if (panes && panes.overlayMouseTarget && this.div) {
          panes.overlayMouseTarget.appendChild(this.div);
        }
      }

      draw() {
        try {
          if (!this.div) return;
          const projection = this.getProjection();
          if (!projection) return;
          const pos = projection.fromLatLngToDivPixel(this.position);
          if (pos) {
            this.div.style.left = `${pos.x}px`;
            this.div.style.top = `${pos.y}px`;
          }
        } catch (e) {}
      }

      onRemove() {
        if (this.div?.parentNode) {
          this.div.parentNode.removeChild(this.div);
          this.div = null;
        }
      }
    }

    const overlay = new RoadTurnOverlay(turnPoint[0], turnPoint[1]);
    overlay.setMap(mapInstanceRef.current);
    turnOverlayRef.current = overlay;

    return () => {
      if (turnOverlayRef.current) {
        turnOverlayRef.current.setMap(null);
        turnOverlayRef.current = null;
      }
    };
  }, [isTripActive, isCornerMapSwapped, members, currentUserId, activeDisplayRoutes, rendezvous]);

  return (
    <div
      className="relative w-full h-full"
      onWheel={() => {
        isManualNavRef.current = true;
        setIsManualNav(true);
      }}
    >
      <div ref={mapContainerRef} className="w-full h-full" />

      {/* Top Google Maps Turn-by-Turn Guidance HUD */}
      {isTripActive && !isCornerMapSwapped && nextManeuver && (
        <div className="absolute top-4 left-3 right-auto z-40 max-w-sm pointer-events-auto animate-fade-in">
          <div className="bg-emerald-600/95 backdrop-blur-xl border border-emerald-400/60 rounded-3xl p-3.5 shadow-[0_12px_40px_rgba(0,0,0,0.7)] text-white flex items-center gap-3.5">
            {/* Big Turn Maneuver Icon */}
            <div className="w-12 h-12 rounded-2xl bg-emerald-700 border-2 border-white flex items-center justify-center text-white shrink-0 shadow-lg">
              {nextManeuver.type === 'right' ? (
                <CornerUpRight className="w-7 h-7 stroke-[2.5]" />
              ) : (
                <CornerUpLeft className="w-7 h-7 stroke-[2.5]" />
              )}
            </div>

            {/* Turn Instructions */}
            <div className="min-w-0 flex-1">
              <div className="text-xl font-black tracking-tight text-white flex items-baseline gap-1.5">
                <span>In {nextManeuver.distMeters} m</span>
              </div>
              <div className="text-xs font-bold text-emerald-100 truncate mt-0.5">
                {nextManeuver.label} onto {nextManeuver.streetName}
              </div>
              {/* Lane Indicator */}
              <div className="mt-1.5 flex items-center gap-1">
                <span className="px-2 py-0.5 rounded bg-emerald-800 border border-emerald-300/50 text-[10px] font-mono font-bold text-white shadow">
                  ↰ LEFT LANE
                </span>
                <span className="px-2 py-0.5 rounded bg-emerald-900/60 text-[10px] font-mono text-emerald-200">
                  ↑ STRAIGHT
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
      {isSettingRendezvous && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-30 pointer-events-none">
          <div className="bg-amber-500 text-slate-950 font-bold px-4 py-2 rounded-full shadow-2xl flex items-center gap-2 border-2 border-amber-300 animate-pulse">
            <span>📍 Tap anywhere on the Google Map to place Meeting Spot</span>
          </div>
        </div>
      )}
      {pinningWaypoint && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-30 pointer-events-auto flex items-center gap-2">
          <div className="bg-rose-600 text-white font-bold px-4 py-2 rounded-full shadow-2xl flex items-center gap-2 border-2 border-rose-300 animate-pulse text-xs">
            <span>⚠️ Tap road on map to place: {pinningWaypoint.label}</span>
          </div>
          {onCancelPinningWaypoint && (
            <button
              onClick={onCancelPinningWaypoint}
              className="bg-slate-900 text-white font-bold px-3 py-2 rounded-full border border-slate-700 shadow-xl text-xs hover:bg-slate-800"
            >
              Cancel
            </button>
          )}
        </div>
      )}

      {/* Google Maps Style Recenter Button on the Left Side */}
      <div className="absolute left-4 bottom-44 sm:left-6 sm:bottom-32 z-30 pointer-events-auto">
        <button
          type="button"
          onClick={recenterOnDriver}
          className={`w-12 h-12 rounded-full shadow-2xl flex items-center justify-center border apple-pressable cursor-pointer transition-all ${
            isManualNav
              ? 'bg-white text-[#007AFF] border-[#007AFF] shadow-[0_4px_20px_rgba(0,122,255,0.5)] ring-4 ring-blue-500/25 animate-pulse'
              : 'bg-slate-900/90 hover:bg-slate-800 text-slate-200 hover:text-white border-white/20 shadow-[0_4px_20px_rgba(0,0,0,0.6)]'
          }`}
          title="Re-center on my location (Google Maps)"
        >
          <LocateFixed className="w-5 h-5 stroke-[2.2]" />
        </button>
      </div>

      {/* Floating Map Actions: Pointing Pin & Fit Squad on the Right Side (Clear of Left Dock) */}
      {!isTripActive && (
        <div className="absolute right-3.5 bottom-28 sm:right-6 sm:bottom-32 z-20 pointer-events-auto flex flex-col items-end gap-2.5">
          {/* Point Route Button */}
          <button
            type="button"
            onClick={() => setIsPointingPinMode((prev) => !prev)}
            className={`apple-glass-pill px-3.5 py-2.5 rounded-full shadow-2xl flex items-center gap-2 text-xs font-bold transition active:scale-95 border apple-pressable cursor-pointer ${
              isPointingPinMode
                ? 'bg-[#007AFF]/25 border-[#007AFF] text-[#007AFF] shadow-[0_0_20px_rgba(0,122,255,0.4)]'
                : 'text-slate-200 hover:text-white border-white/15'
            }`}
            title={isPointingPinMode ? 'Exit Point Route' : 'Point on map to route'}
          >
            <span className="text-sm">🎯</span>
            <span className="hidden sm:inline">{isPointingPinMode ? 'Aiming...' : 'Point Route'}</span>
          </button>

          {/* Fit Squad Button */}
          <button
            type="button"
            onClick={() => {
              isManualNavRef.current = false;
              setIsManualNav(false);
              fitAllTravelers();
            }}
            className="px-3.5 py-2.5 bg-slate-900/90 hover:bg-slate-800 border border-slate-700/80 rounded-full shadow-2xl text-white flex items-center gap-1.5 text-xs font-bold transition active:scale-95 backdrop-blur-md cursor-pointer"
            title="Fit all squad members on screen"
          >
            <span className="text-sm">👥</span>
            <span className="hidden sm:inline">Fit Squad</span>
          </button>
        </div>
      )}

      {/* 1. Precision Pointing Reticle at Viewport Center (Minimal & Creative) */}
      {isPointingPinMode && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-40 flex flex-col items-center select-none animate-fade-in">
          {/* Creative Floating Glass Pill */}
          <div className="mb-2 px-3 py-1 rounded-full apple-glass-pill text-[#007AFF] text-[11px] font-bold tracking-wide shadow-2xl flex items-center gap-1.5 animate-pulse border border-[#007AFF]/40">
            <span>🎯</span>
            <span>Tap map or aim to route</span>
          </div>

          {/* Minimalist Radiant Crosshair Ring */}
          <div className="w-9 h-9 rounded-full border border-cyan-400/80 shadow-[0_0_20px_rgba(0,240,255,0.6)] flex items-center justify-center relative">
            <div className="w-2 h-2 rounded-full bg-cyan-300 shadow-[0_0_8px_#00f0ff]" />
            <div className="absolute w-2.5 h-[1px] bg-cyan-400 -left-1" />
            <div className="absolute w-2.5 h-[1px] bg-cyan-400 -right-1" />
            <div className="absolute h-2.5 w-[1px] bg-cyan-400 -top-1" />
            <div className="absolute h-2.5 w-[1px] bg-cyan-400 -bottom-1" />
          </div>
        </div>
      )}

      {/* 2. Minimal Creative Bottom Dock for Point Mode */}
      {isPointingPinMode && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-40 pointer-events-auto flex items-center gap-2 animate-fade-in select-none">
          <button
            type="button"
            onClick={() => {
              const center = mapInstanceRef.current?.getCenter();
              if (center) {
                handlePointLocation(center.lat(), center.lng());
                setIsPointingPinMode(false);
              }
            }}
            className="apple-glass-pill px-4 py-2 rounded-full text-xs font-bold text-white shadow-2xl flex items-center gap-2 border border-cyan-400/50 bg-cyan-950/50 hover:bg-cyan-900/60 apple-pressable cursor-pointer"
          >
            <span>🎯</span>
            <span>Route via Center</span>
          </button>

          <button
            type="button"
            onClick={() => setIsPointingPinMode(false)}
            className="w-8 h-8 rounded-full apple-glass-pill text-slate-400 hover:text-white flex items-center justify-center border border-white/15 apple-pressable cursor-pointer text-xs"
            title="Cancel"
          >
            ✕
          </button>
        </div>
      )}

      {/* 3. Toast Notification (Minimal Glass Pill) */}
      {pinnedConfirmationToast && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-40 pointer-events-none animate-fade-in">
          <div className="px-4 py-1.5 rounded-full apple-glass-pill border border-white/20 text-white font-bold text-xs shadow-2xl flex items-center gap-2">
            <span>{pinnedConfirmationToast}</span>
          </div>
        </div>
      )}
    </div>
  );
};
