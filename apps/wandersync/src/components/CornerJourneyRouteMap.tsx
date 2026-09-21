import React, { useEffect, useRef, useState, useMemo } from 'react';
import { TravelerMember, TravelRoute, RendezvousPoint, SQUAD_FRIEND_PALETTE, DRIVER_PRIMARY_COLOR } from '../types';
import {
  Maximize2,
  Minimize2,
  ArrowRightLeft,
  ChevronRight,
  ChevronLeft,
  ArrowRight,
  Compass,
  Crosshair,
  Users,
  Radio,
} from 'lucide-react';

// Pitch Black Heatmap Google Maps Styling
const HEATMAP_MAP_STYLE: google.maps.MapTypeStyle[] = [
  { elementType: 'geometry', stylers: [{ color: '#030508' }] },
  { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#334155' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#030508' }, { weight: 2 }] },
  { featureType: 'administrative', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#0f172a' }] },
  { featureType: 'road.arterial', elementType: 'geometry', stylers: [{ color: '#141e33' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#1e293b' }] },
  { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: '#090d16' }, { weight: 1 }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#020408' }] },
];

const SQUAD_PALETTE = [
  '#ec4899', // Pink / Magenta (Default friend)
  '#f59e0b', // Amber / Gold
  '#8b5cf6', // Purple / Violet
  '#10b981', // Emerald Green
  '#f97316', // Orange
  '#3b82f6', // Blue
  '#06b6d4', // Cyan (Driver)
];

function haversineDistKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
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
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export type RadarViewMode = 'driver' | 'together' | 'friend';

interface CornerJourneyRouteMapProps {
  members: TravelerMember[];
  currentUserId: string;
  routes: TravelRoute[];
  rendezvous: RendezvousPoint | null;
  isSwapped: boolean;
  onToggleSwap: () => void;
  selectedMemberId?: string | null;
  onSelectMember?: (id: string) => void;
  onAssignRoute?: (userId: string, routeId: string) => void;
  onClose?: () => void;
}

export const CornerJourneyRouteMap: React.FC<CornerJourneyRouteMapProps> = ({
  members,
  currentUserId,
  routes,
  rendezvous,
  isSwapped,
  onToggleSwap,
  selectedMemberId,
  onSelectMember,
  onAssignRoute,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const miniMapRef = useRef<google.maps.Map | null>(null);
  const polylinesRef = useRef<google.maps.Polyline[]>([]);
  const friendMarkersRef = useRef<Map<string, google.maps.Marker>>(new Map());
  const destMarkerRef = useRef<google.maps.Marker | null>(null);

  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [isSwipedOut, setIsSwipedOut] = useState<boolean>(false);
  const [showMiniMap, setShowMiniMap] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<RadarViewMode>('together');
  const [selectedFriendIdx, setSelectedFriendIdx] = useState<number>(0);

  const [dragOffset, setDragOffset] = useState<number>(0);
  const [isDraggingCard, setIsDraggingCard] = useState<boolean>(false);
  const touchStartXRef = useRef<number>(0);
  const touchStartYRef = useRef<number>(0);

  const currentUser = members.find((m) => m.id === currentUserId);
  const mySpeed = Math.round(currentUser?.location?.speed || 0);

  // Other friends in the squad
  const otherMembers = useMemo(() => {
    return members.filter((m) => m.id !== currentUserId);
  }, [members, currentUserId]);

  const activeFriend = otherMembers.length > 0
    ? otherMembers[selectedFriendIdx % otherMembers.length]
    : null;

  // Active primary route for current user
  const myRoute = useMemo(() => {
    if (!routes || routes.length === 0) return null;
    if (currentUser?.assignedRouteId) {
      const assigned = routes.find((r) => r.id === currentUser.assignedRouteId);
      if (assigned) return assigned;
    }
    const forMe = routes.find((r) => r.forUserId === currentUserId);
    if (forMe) return forMe;
    return routes[0];
  }, [routes, currentUser, currentUserId]);

  // Active route for the currently inspected friend
  const friendRoute = useMemo(() => {
    if (!activeFriend || !routes || routes.length === 0) return null;
    if (activeFriend.assignedRouteId) {
      const assigned = routes.find((r) => r.id === activeFriend.assignedRouteId);
      if (assigned) return assigned;
    }
    const forFriend = routes.find((r) => r.forUserId === activeFriend.id);
    if (forFriend) return forFriend;
    return routes.find((r) => r.id !== myRoute?.id) || routes[1] || routes[0];
  }, [routes, activeFriend, myRoute]);

  // All alternative routes available to the driver
  const myAvailableRoutes = useMemo(() => {
    if (!routes || routes.length === 0) return [];
    const userSpecific = routes.filter((r) => !r.forUserId || r.forUserId === currentUserId);
    return userSpecific.length > 0 ? userSpecific : routes;
  }, [routes, currentUserId]);

  // All alternative routes available to the active friend
  const friendAvailableRoutes = useMemo(() => {
    if (!activeFriend || !routes || routes.length === 0) return [];
    const friendSpecific = routes.filter((r) => r.forUserId === activeFriend.id);
    return friendSpecific.length > 0 ? friendSpecific : routes;
  }, [routes, activeFriend]);

  // Total Distance & Moving Time
  const totalDistanceKm = useMemo(() => {
    if (myRoute?.distanceKm) return myRoute.distanceKm;
    if (rendezvous && currentUser?.location) {
      return haversineDistKm(
        currentUser.location.lat,
        currentUser.location.lng,
        rendezvous.lat,
        rendezvous.lng
      );
    }
    return 128.4;
  }, [myRoute, rendezvous, currentUser]);

  const timeFormatted = useMemo(() => {
    const mins = myRoute?.durationMins || Math.round((totalDistanceKm / 60) * 60) || 128;
    const hrs = Math.floor(mins / 60);
    const remainMins = mins % 60;
    return { hrs: hrs > 0 ? hrs : 1, mins: remainMins };
  }, [myRoute, totalDistanceKm]);

  // Distance between driver and active friend
  const distanceToFriendMeters = useMemo(() => {
    if (!currentUser?.location || !activeFriend?.location) return null;
    const dKm = haversineDistKm(
      currentUser.location.lat,
      currentUser.location.lng,
      activeFriend.location.lat,
      activeFriend.location.lng
    );
    return Math.round(dKm * 1000);
  }, [currentUser?.location, activeFriend?.location]);

  // ---------------------------------------------------------------------------
  // 1. INITIALIZE MINI GOOGLE MAP
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!mapContainerRef.current || !window.google?.maps || miniMapRef.current) return;

    const initialCenter = currentUser?.location
      ? { lat: currentUser.location.lat, lng: currentUser.location.lng }
      : { lat: 28.6139, lng: 77.209 };

    const map = new window.google.maps.Map(mapContainerRef.current, {
      center: initialCenter,
      zoom: 14,
      styles: HEATMAP_MAP_STYLE,
      disableDefaultUI: true,
      zoomControl: false,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
      gestureHandling: 'cooperative',
      backgroundColor: '#030508',
    });

    miniMapRef.current = map;
  }, [currentUser]);

  // ---------------------------------------------------------------------------
  // 2. DRAW POLYLINES PER VIEW MODE
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const map = miniMapRef.current;
    if (!map || !window.google?.maps) return;

    // Clear previous polylines
    polylinesRef.current.forEach((p) => p.setMap(null));
    polylinesRef.current = [];

    const driverLaserColor = '#00f0ff'; // Electric Cyan for Driver
    const friendLaserColor = activeFriend?.color || '#ec4899'; // Neon Magenta for Friend

    // Helper to draw a glowing laser route on the mini-map
    const drawLaserRoute = (route: TravelRoute, color: string, isPrimary: boolean) => {
      if (!route.coordinates || route.coordinates.length < 2) return;
      const path = route.coordinates.map(([lat, lng]) => ({ lat, lng }));

      // Glow layer
      const glow = new window.google.maps.Polyline({
        path,
        geodesic: true,
        strokeColor: color,
        strokeOpacity: isPrimary ? 0.45 : 0.25,
        strokeWeight: isPrimary ? 10 : 7,
        zIndex: isPrimary ? 12 : 8,
        clickable: false,
        map,
      });
      polylinesRef.current.push(glow);

      // Core beam
      const core = new window.google.maps.Polyline({
        path,
        geodesic: true,
        strokeColor: isPrimary ? '#ffffff' : color,
        strokeOpacity: 0.95,
        strokeWeight: isPrimary ? 3 : 2,
        zIndex: isPrimary ? 14 : 9,
        clickable: false,
        icons: isPrimary
          ? [
              {
                icon: {
                  path: window.google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
                  scale: 2.2,
                  strokeColor: '#ffffff',
                  fillColor: color,
                  fillOpacity: 1,
                  strokeWeight: 1,
                },
                offset: '100%',
                repeat: '50px',
              },
            ]
          : undefined,
        map,
      });
      polylinesRef.current.push(core);
    };

    if (viewMode === 'driver') {
      // Driver view: Only driver route in Cyan
      if (myRoute) drawLaserRoute(myRoute, driverLaserColor, true);
    } else if (viewMode === 'together') {
      // Together view: Driver route (Cyan) and EACH Friend's chosen route with their distinct color
      if (myRoute) drawLaserRoute(myRoute, driverLaserColor, true);

      otherMembers.forEach((friend, fIdx) => {
        const friendRoutes = routes.filter((r) => r.forUserId === friend.id);
        const friendChosen = friend.assignedRouteId
          ? friendRoutes.find((r) => r.id === friend.assignedRouteId) || routes.find((r) => r.id === friend.assignedRouteId) || friendRoutes[0]
          : friendRoutes[0];

        if (friendChosen) {
          const friendColor =
            friend.color && friend.color !== '#00f0ff' && friend.color !== '#3b82f6'
              ? friend.color
              : SQUAD_FRIEND_PALETTE[fIdx % SQUAD_FRIEND_PALETTE.length];
          drawLaserRoute(friendChosen, friendColor, true);
        }
      });
    } else if (viewMode === 'friend') {
      // Friend view: Highlight active friend's route in their distinct color
      if (friendRoute) drawLaserRoute(friendRoute, friendLaserColor, true);
      if (myRoute) drawLaserRoute(myRoute, driverLaserColor, false);
    }
  }, [viewMode, myRoute, friendRoute, routes, activeFriend, otherMembers]);

  // ---------------------------------------------------------------------------
  // 3. UPDATE MARKERS & CAMERA ACCORDING TO VIEW MODE
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const map = miniMapRef.current;
    if (!map || !window.google?.maps) return;

    // Rendezvous marker (Double white target ring)
    if (rendezvous) {
      const rendezvousPos = { lat: rendezvous.lat, lng: rendezvous.lng };
      if (!destMarkerRef.current) {
        destMarkerRef.current = new window.google.maps.Marker({
          position: rendezvousPos,
          map,
          title: rendezvous.title || 'Meeting Point',
          icon: {
            path: window.google.maps.SymbolPath.CIRCLE,
            scale: 8,
            fillColor: '#ffffff',
            fillOpacity: 1,
            strokeColor: '#00f0ff',
            strokeWeight: 3,
          },
          zIndex: 50,
        });
      } else {
        destMarkerRef.current.setPosition(rendezvousPos);
      }
    }

    // Traveler markers
    const currentMarkers = friendMarkersRef.current;
    const memberIds = new Set(members.map((m) => m.id));

    for (const [id, marker] of currentMarkers.entries()) {
      if (!memberIds.has(id)) {
        marker.setMap(null);
        currentMarkers.delete(id);
      }
    }

    const bounds = new window.google.maps.LatLngBounds();
    let hasPoints = false;

    members.forEach((m, idx) => {
      if (!m.location) return;
      const pos = { lat: m.location.lat, lng: m.location.lng };
      bounds.extend(pos);
      hasPoints = true;

      const isMe = m.id === currentUserId;
      const isSelectedFriend = activeFriend?.id === m.id;
      const color = isMe ? '#00f0ff' : m.color || SQUAD_PALETTE[idx % SQUAD_PALETTE.length];

      let marker = currentMarkers.get(m.id);
      if (!marker) {
        marker = new window.google.maps.Marker({
          position: pos,
          map,
          title: `${m.name} (${m.mode})`,
          icon: {
            path: window.google.maps.SymbolPath.CIRCLE,
            scale: isSelectedFriend ? 8 : isMe ? 7 : 5,
            fillColor: color,
            fillOpacity: 1,
            strokeColor: '#ffffff',
            strokeWeight: isSelectedFriend ? 3 : 2,
          },
          zIndex: isSelectedFriend ? 60 : isMe ? 40 : 30,
        });
        currentMarkers.set(m.id, marker);
      } else {
        marker.setPosition(pos);
        marker.setIcon({
          path: window.google.maps.SymbolPath.CIRCLE,
          scale: isSelectedFriend ? 8 : isMe ? 7 : 5,
          fillColor: color,
          fillOpacity: 1,
          strokeColor: '#ffffff',
          strokeWeight: isSelectedFriend ? 3 : 2,
        });
      }
    });

    // Camera positioning based on mode
    if (viewMode === 'driver' && currentUser?.location) {
      map.panTo({ lat: currentUser.location.lat, lng: currentUser.location.lng });
      map.setZoom(16);
    } else if (viewMode === 'friend' && activeFriend?.location) {
      map.panTo({ lat: activeFriend.location.lat, lng: activeFriend.location.lng });
      map.setZoom(16);
    } else if (viewMode === 'together' && hasPoints) {
      if (rendezvous) bounds.extend({ lat: rendezvous.lat, lng: rendezvous.lng });
      map.fitBounds(bounds, { top: 25, bottom: 25, left: 25, right: 25 });
    }
  }, [members, viewMode, activeFriend, currentUser, rendezvous, currentUserId]);

  // Swipe navigation between modes: driver <-> together <-> friend
  const handleNextMode = () => {
    if (viewMode === 'driver') setViewMode('together');
    else if (viewMode === 'together') setViewMode('friend');
    else if (viewMode === 'friend') {
      if (otherMembers.length > 1) {
        setSelectedFriendIdx((prev) => (prev + 1) % otherMembers.length);
      } else {
        setViewMode('driver');
      }
    }
  };

  const handlePrevMode = () => {
    if (viewMode === 'friend') {
      if (selectedFriendIdx > 0) {
        setSelectedFriendIdx((prev) => prev - 1);
      } else {
        setViewMode('together');
      }
    } else if (viewMode === 'together') {
      setViewMode('driver');
    } else if (viewMode === 'driver') {
      setViewMode('friend');
    }
  };

  // Focus friend on the main map
  const handleFocusOnMainMap = (m: TravelerMember) => {
    if (!m.location) return;
    if (onSelectMember) onSelectMember(m.id);
    window.dispatchEvent(
      new CustomEvent('wandersync:pan_to', {
        detail: { lat: m.location.lat, lng: m.location.lng },
      })
    );
  };

  return (
    <>
      {/* Edge Restore Pill when radar is swiped out */}
      {isSwipedOut && (
        <button
          type="button"
          onClick={() => setIsSwipedOut(false)}
          className="fixed top-20 right-0 z-50 px-3.5 py-2.5 rounded-l-2xl bg-[#05080e]/95 border-l-2 border-y-2 border-cyan-500/70 text-slate-100 font-bold text-xs shadow-[0_10px_35px_rgba(0,0,0,0.85)] backdrop-blur-xl flex items-center gap-2 hover:bg-slate-900 transition active:scale-95 cursor-pointer animate-fade-in group pointer-events-auto"
          title="Tap or swipe in to restore Convoy Radar"
        >
          <Radio className="w-4 h-4 text-cyan-400 animate-pulse" />
          <span className="font-serif">Convoy Radar</span>
          <ChevronLeft className="w-4 h-4 text-cyan-400 group-hover:-translate-x-0.5 transition-transform" />
        </button>
      )}

      {/* Main Radar Widget Card */}
      <div
        onTouchStart={(e) => {
          touchStartXRef.current = e.touches[0].clientX;
          touchStartYRef.current = e.touches[0].clientY;
          setIsDraggingCard(true);
        }}
        onTouchMove={(e) => {
          if (!isDraggingCard) return;
          const dx = e.touches[0].clientX - touchStartXRef.current;
          if (dx > 0) {
            // 1:1 tracking to the right
            setDragOffset(dx);
          } else {
            // Rubber-band resistance to the left
            const damped = (dx * 120 * 0.55) / (120 + 0.55 * Math.abs(dx));
            setDragOffset(damped);
          }
        }}
        onTouchEnd={(e) => {
          setIsDraggingCard(false);
          const dx = e.changedTouches[0].clientX - touchStartXRef.current;
          const dy = Math.abs(e.changedTouches[0].clientY - touchStartYRef.current);
          if (dx > 75 && dy < 80) {
            // Swipe right off-screen -> hide widget
            setIsSwipedOut(true);
            setDragOffset(0);
          } else if (dx < -40 && dy < 50) {
            handleNextMode();
            setDragOffset(0);
          } else if (dx > 40 && dy < 50) {
            handlePrevMode();
            setDragOffset(0);
          } else {
            // Spring back home
            setDragOffset(0);
          }
        }}
        style={{
          transform: isSwipedOut
            ? 'translateX(calc(100% + 40px))'
            : dragOffset !== 0
            ? `translateX(${dragOffset}px)`
            : 'translateX(0px)',
          transition: isDraggingCard ? 'none' : 'transform 320ms cubic-bezier(0.2, 0.8, 0.4, 1), opacity 200ms ease',
        }}
        className={`fixed z-40 pointer-events-auto ${
          isSwipedOut
            ? 'opacity-0 pointer-events-none top-14 right-2 sm:top-16 sm:right-3'
            : isExpanded
            ? 'top-12 right-2 left-2 sm:left-auto sm:right-3 sm:w-96 md:w-[440px] opacity-100'
            : 'top-14 right-2 w-[calc(100vw-16px)] max-w-[340px] sm:w-84 md:w-[360px] opacity-100'
        }`}
      >
        <div className="apple-glass-card rounded-[28px] overflow-hidden text-white flex flex-col">
          
          {/* Top Header: Title + Actions */}
          <div className="px-3 sm:px-4 pt-3 pb-2 flex items-center justify-between border-b border-slate-800/60 gap-1">
            <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 shrink-0">
              <Radio className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-cyan-400 animate-pulse shrink-0" />
              <span className="text-xs sm:text-base font-serif font-black tracking-tight text-white truncate">
                Convoy Radar
              </span>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              {/* Mini-Map Preview Toggle */}
              <button
                type="button"
                onClick={() => setShowMiniMap(!showMiniMap)}
                className={`px-1.5 sm:px-2 py-1 rounded-xl border text-[10px] sm:text-[11px] font-bold transition cursor-pointer flex items-center gap-1 ${
                  showMiniMap
                    ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50'
                    : 'bg-slate-800/80 text-slate-400 border-slate-700 hover:text-white'
                }`}
                title={showMiniMap ? 'Hide mini-map (dashboard only)' : 'Show mini-map preview'}
              >
                <span>🗺️</span>
                <span className="hidden xs:inline sm:inline">{showMiniMap ? 'Map ON' : 'Map OFF'}</span>
              </button>

              {/* Swap Button: Toggles zoomed vs full view */}
              <button
                type="button"
                onClick={onToggleSwap}
                className="px-2 sm:px-2.5 py-1 rounded-xl bg-slate-800/90 hover:bg-slate-700 border border-slate-700 text-slate-200 transition active:scale-95 cursor-pointer flex items-center gap-1 text-[10px] sm:text-[11px] font-bold"
                title="Swap radar with main screen"
              >
                <ArrowRightLeft className="w-3 h-3 text-sky-400" />
                <span>SWAP</span>
              </button>

              {/* Expand / Minimize */}
              <button
                type="button"
                onClick={() => setIsExpanded(!isExpanded)}
                className="p-1 sm:p-1.5 rounded-xl bg-slate-800/70 hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition cursor-pointer"
                title={isExpanded ? 'Collapse' : 'Expand'}
              >
                {isExpanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
              </button>

              {/* Hide / Swipe Out */}
              <button
                type="button"
                onClick={() => setIsSwipedOut(true)}
                className="px-1.5 sm:px-2 py-1 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-amber-400 border border-amber-500/30 transition text-[10px] sm:text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                title="Hide radar (show only map)"
              >
                <ArrowRight className="w-3.5 h-3.5" />
                <span>Hide</span>
              </button>
            </div>
          </div>

          {/* 3 Clear Segmented Mode Tabs: Driver | Together | Friends */}
          <div className="px-3.5 pt-2.5 pb-1.5 bg-slate-950/60">
            <div className="grid grid-cols-3 gap-1 bg-slate-900/90 p-1 rounded-2xl border border-slate-800">
              {/* 1. Driver View Tab */}
              <button
                type="button"
                onClick={() => setViewMode('driver')}
                className={`py-1.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1 transition cursor-pointer ${
                  viewMode === 'driver'
                    ? 'bg-cyan-500 text-slate-950 font-black shadow-[0_0_15px_rgba(6,182,212,0.6)]'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <span>🚗</span>
                <span>Driver</span>
              </button>

              {/* 2. Together View Tab */}
              <button
                type="button"
                onClick={() => setViewMode('together')}
                className={`py-1.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1 transition cursor-pointer ${
                  viewMode === 'together'
                    ? 'bg-emerald-500 text-slate-950 font-black shadow-[0_0_15px_rgba(16,185,129,0.6)]'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <span>👥</span>
                <span>Together</span>
              </button>

              {/* 3. Friend View Tab */}
              <button
                type="button"
                onClick={() => setViewMode('friend')}
                className={`py-1.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1 transition cursor-pointer ${
                  viewMode === 'friend'
                    ? 'bg-pink-500 text-slate-950 font-black shadow-[0_0_15px_rgba(236,72,153,0.6)]'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <span>🏍️</span>
                <span>{activeFriend ? activeFriend.name.split(' ')[0] : 'Friends'}</span>
              </button>
            </div>
            <div className="flex items-center justify-between px-1 pt-1.5 text-[10px] text-slate-500 font-mono">
              <span>↔ Swipe or tap tabs</span>
              <span>{showMiniMap ? 'Tap mini-map to SWAP' : 'Tap Map ON for preview'}</span>
            </div>
          </div>

          {/* Live Mini-Map Display (Collapsible so no duplicate map in middle of map) */}
          {showMiniMap && (
            <div
              onClick={onToggleSwap}
              className="relative w-full cursor-pointer group bg-[#030508] border-y border-slate-800/80"
              style={{ height: isExpanded ? '230px' : '155px' }}
              title="Click to swap with main map screen"
            >
              <div ref={mapContainerRef} className="w-full h-full" />

              {/* Tap to swap hint */}
              <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center pointer-events-none">
                <span className="px-3 py-1 rounded-full bg-slate-900 border border-slate-700 text-slate-200 text-[11px] font-bold tracking-wider shadow-2xl flex items-center gap-1.5">
                  <ArrowRightLeft className="w-3.5 h-3.5 text-sky-400" />
                  <span>TAP TO SWAP VIEW</span>
                </span>
              </div>

              {/* Mode Tag Overlay on Map */}
              <div className="absolute top-2 left-2 pointer-events-none">
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border shadow ${
                  viewMode === 'driver'
                    ? 'bg-cyan-950/90 text-cyan-300 border-cyan-500/50'
                    : viewMode === 'together'
                    ? 'bg-emerald-950/90 text-emerald-300 border-emerald-500/50'
                    : 'bg-pink-950/90 text-pink-300 border-pink-500/50'
                }`}>
                  {viewMode === 'driver'
                    ? '🚗 DRIVER CLOSE-UP'
                    : viewMode === 'together'
                    ? '👥 ALL ROUTES TOGETHER'
                    : `🏍️ FRIEND: ${activeFriend?.name || 'SQUAD'}`}
                </span>
              </div>
            </div>
          )}

          {/* Mode-Specific Contextual Information Card */}
          <div className="p-4 bg-slate-950/90">
            {/* 1. DRIVER VIEW */}
            {viewMode === 'driver' && (
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">🚗</span>
                    <div>
                      <div className="text-xs font-black text-white">Your Navigation (Driver)</div>
                      <div className="text-[10px] text-cyan-300 font-mono">
                        Active: {myRoute?.name || 'Route 1'} (Cyan Laser)
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-base font-mono font-black text-cyan-400">
                      {mySpeed} km/h
                    </div>
                    <div className="text-[9px] text-slate-400">Current Speed</div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800/80 text-center">
                  <div className="bg-slate-900/80 rounded-xl p-2 border border-slate-800">
                    <div className="text-lg font-black text-white">{totalDistanceKm.toFixed(1)} KM</div>
                    <div className="text-[9px] text-slate-500 font-bold uppercase">To Destination</div>
                  </div>
                  <div className="bg-slate-900/80 rounded-xl p-2 border border-slate-800">
                    <div className="text-lg font-black text-white">
                      {timeFormatted.hrs}h {timeFormatted.mins}m
                    </div>
                    <div className="text-[9px] text-slate-500 font-bold uppercase">ETA Duration</div>
                  </div>
                </div>

                {/* Driver Route Switcher Chips (When alternatives exist) */}
                {myAvailableRoutes.length > 1 && (
                  <div className="pt-2 border-t border-slate-800/80">
                    <div className="text-[10px] text-slate-400 font-bold mb-1.5 flex items-center justify-between">
                      <span className="text-cyan-300">SWITCH YOUR ROUTE (CYAN):</span>
                      <span className="text-slate-500 font-mono text-[9px]">Tap to choose</span>
                    </div>
                    <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                      {myAvailableRoutes.map((r, i) => {
                        const isSelected = myRoute?.id === r.id;
                        return (
                          <button
                            key={r.id || i}
                            type="button"
                            onClick={() => onAssignRoute && onAssignRoute(currentUserId, r.id)}
                            className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold shrink-0 transition cursor-pointer flex items-center gap-1.5 ${
                              isSelected
                                ? 'bg-cyan-500/25 border-2 border-cyan-400 text-cyan-200 shadow-[0_0_12px_rgba(0,240,255,0.4)]'
                                : 'bg-slate-900/80 border border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
                            }`}
                          >
                            <span className={`w-2 h-2 rounded-full ${isSelected ? 'bg-cyan-400 shadow-[0_0_8px_#00f0ff]' : 'bg-slate-600'}`} />
                            <span>{r.name || `Route ${i + 1}`}</span>
                            <span className="text-[10px] opacity-75 font-mono">({r.distanceKm?.toFixed(0)}km)</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 2. TOGETHER VIEW (Both routes visible with legend) */}
            {viewMode === 'together' && (
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-white">
                    <Users className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Convoy Live Spread</span>
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-bold">
                    {members.length} Members Linked
                  </span>
                </div>

                {/* Route Synchronization Status Badge */}
                <div className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold border flex items-center justify-between ${
                  myRoute?.id === friendRoute?.id
                    ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-300'
                    : 'bg-amber-950/40 border-amber-500/50 text-amber-300'
                }`}>
                  <div className="flex items-center gap-1.5">
                    <span>{myRoute?.id === friendRoute?.id ? '🟢' : '🔀'}</span>
                    <span>
                      {myRoute?.id === friendRoute?.id
                        ? 'Riding Same Route'
                        : 'Different Routes Active'}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono opacity-85">
                    {myRoute?.id === friendRoute?.id ? 'Shared Asphalt' : 'Parallel Paths'}
                  </span>
                </div>

                {/* Explicit Color Legend showing which route is whose */}
                <div className="space-y-1.5 pt-1">
                  {/* Driver Route Legend Chip */}
                  <div className="flex items-center justify-between px-2.5 py-1.5 rounded-xl bg-cyan-950/30 border border-cyan-500/40">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 shadow-[0_0_8px_#00f0ff]"></div>
                      <span className="text-xs font-black text-white">You (Driver)</span>
                      <span className="text-[10px] text-slate-300">({myRoute?.name || 'Route 1'})</span>
                    </div>
                    <span className="text-xs font-mono font-bold text-cyan-300">Cyan Laser</span>
                  </div>

                  {/* Friend Route Legend Chips (Strictly 1 row per friend in their distinct color) */}
                  {otherMembers.map((friend, fIdx) => {
                    const friendColor =
                      friend.color && friend.color !== '#00f0ff' && friend.color !== '#3b82f6'
                        ? friend.color
                        : SQUAD_FRIEND_PALETTE[fIdx % SQUAD_FRIEND_PALETTE.length];
                    const friendRoutes = routes.filter((r) => r.forUserId === friend.id);
                    const friendChosen = friend.assignedRouteId
                      ? friendRoutes.find((r) => r.id === friend.assignedRouteId) || routes.find((r) => r.id === friend.assignedRouteId) || friendRoutes[0]
                      : friendRoutes[0];

                    return (
                      <div
                        key={friend.id}
                        className="flex items-center justify-between px-2.5 py-1.5 rounded-xl border bg-slate-900/60"
                        style={{ borderColor: `${friendColor}55` }}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <div
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: friendColor, boxShadow: `0 0 8px ${friendColor}` }}
                          />
                          <span className="text-xs font-black text-white truncate max-w-[100px]">{friend.name}</span>
                          <span className="text-[10px] text-slate-300 truncate max-w-[100px]">
                            ({friendChosen?.name || 'Chosen Route'})
                          </span>
                        </div>
                        <span className="text-xs font-mono font-bold shrink-0" style={{ color: friendColor }}>
                          {friendChosen ? `~${friendChosen.durationMins}m` : 'Synced'}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* Proximity / Tandem Indicator */}
                <div className="pt-1.5 border-t border-slate-800 text-[11px] text-slate-300 flex items-center justify-between font-mono">
                  <span>Convoy Gap:</span>
                  <span className="text-emerald-400 font-bold">
                    {distanceToFriendMeters != null
                      ? distanceToFriendMeters < 50
                        ? `Beside you (~${distanceToFriendMeters}m) • In Tandem`
                        : `${distanceToFriendMeters}m separation`
                      : 'Rendezvous Tracked'}
                  </span>
                </div>
              </div>
            )}

            {/* 3. FRIEND VIEW */}
            {viewMode === 'friend' && activeFriend && (
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-8 h-8 rounded-xl bg-pink-500/20 border border-pink-400/60 flex items-center justify-center text-lg shrink-0">
                      {activeFriend.avatar || '🏍️'}
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-black text-white truncate flex items-center gap-1.5">
                        <span>{activeFriend.name}</span>
                        <span className="px-1.5 py-0.2 rounded bg-pink-500/20 text-pink-300 text-[9px] font-bold">
                          {activeFriend.mode.toUpperCase()}
                        </span>
                      </div>
                      <div className="text-[10px] text-pink-300 font-mono truncate">
                        Route: {friendRoute?.name || 'Route 2'} (Magenta)
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="text-base font-mono font-black text-pink-400">
                      {Math.round(activeFriend.location?.speed || 0)} km/h
                    </div>
                    <div className="text-[9px] text-slate-400">Friend Speed</div>
                  </div>
                </div>

                {/* Friend Route Switcher Chips (When alternatives exist) */}
                {friendAvailableRoutes.length > 1 && (
                  <div className="pt-2 border-t border-slate-800/80">
                    <div className="text-[10px] text-slate-400 font-bold mb-1.5 flex items-center justify-between">
                      <span className="text-pink-300">{activeFriend.name.toUpperCase()}&apos;S ROUTE (MAGENTA):</span>
                      <span className="text-slate-500 font-mono text-[9px]">Tap to assign</span>
                    </div>
                    <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                      {friendAvailableRoutes.map((r, i) => {
                        const isSelected = friendRoute?.id === r.id;
                        return (
                          <button
                            key={r.id || i}
                            type="button"
                            onClick={() => onAssignRoute && onAssignRoute(activeFriend.id, r.id)}
                            className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold shrink-0 transition cursor-pointer flex items-center gap-1.5 ${
                              isSelected
                                ? 'bg-pink-500/25 border-2 border-pink-400 text-pink-200 shadow-[0_0_12px_rgba(236,72,153,0.4)]'
                                : 'bg-slate-900/80 border border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
                            }`}
                          >
                            <span className={`w-2 h-2 rounded-full ${isSelected ? 'bg-pink-400 shadow-[0_0_8px_#ec4899]' : 'bg-slate-600'}`} />
                            <span>{r.name || `Route ${i + 1}`}</span>
                            <span className="text-[10px] opacity-75 font-mono">({r.distanceKm?.toFixed(0)}km)</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Relative distance & Action button */}
                <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
                  <div className="text-xs text-slate-300 flex items-center gap-1">
                    <Compass className="w-3.5 h-3.5 text-sky-400" />
                    <span>
                      {distanceToFriendMeters != null
                        ? distanceToFriendMeters < 50
                          ? 'Beside you on the road'
                          : `${distanceToFriendMeters}m away from you`
                        : 'GPS Linked'}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleFocusOnMainMap(activeFriend)}
                    className="px-3 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-black text-xs shadow-lg transition active:scale-95 flex items-center gap-1.5 cursor-pointer"
                  >
                    <Crosshair className="w-3 h-3" />
                    <span>Focus on Map</span>
                  </button>
                </div>

                {/* Multi-friend selector if squad has > 1 friend */}
                {otherMembers.length > 1 && (
                  <div className="pt-2 flex items-center justify-between border-t border-slate-800/60 text-[10px] text-slate-400">
                    <span>Friend {selectedFriendIdx + 1} of {otherMembers.length}</span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setSelectedFriendIdx((prev) => (prev - 1 + otherMembers.length) % otherMembers.length)}
                        className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-white"
                      >
                        <ChevronLeft className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedFriendIdx((prev) => (prev + 1) % otherMembers.length)}
                        className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-white"
                      >
                        <ChevronRight className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

        </div>
      </div>
    </>
  );
};
