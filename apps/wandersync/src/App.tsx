import React, { useState, useEffect, useRef } from 'react';
import { socketService } from './services/socket';
import { MapView } from './components/MapView';
import { GoogleMapView } from './components/GoogleMapView';
import { SimpleTravelerUI } from './components/SimpleTravelerUI';
import { HomepageHero } from './components/HomepageHero';
import { SOSBanner } from './components/SOSBanner';
import { LocationPermissionModal } from './components/LocationPermissionModal';
import { V2VCockpitHUD } from './components/V2VCockpitHUD';
import { ConvoyCountdownModal } from './components/ConvoyCountdownModal';
import { CornerJourneyRouteMap } from './components/CornerJourneyRouteMap';
import { calculateDistanceKm } from '../server/routingService.js';
import {
  GroupMessage,
  LocationData,
  MapTileStyle,
  RendezvousPoint,
  TravelGroup,
  TravelerMember,
  TravelRoute,
  TransportMode,
  Waypoint,
  TripCountdownEvent,
} from './types';

export const App: React.FC = () => {
  // Read trip/group code from URL query parameter or generate clean 6-char code
  const [groupId, setGroupId] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('group') || params.get('trip') || `TRIP-${Math.floor(100 + Math.random() * 900)}`;
  });

  const [isJoined, setIsJoined] = useState(false);
  const [currentUserId] = useState(() => {
    try {
      const saved = sessionStorage.getItem('wandersync_user_id') || localStorage.getItem('wandersync_user_id');
      if (saved) {
        sessionStorage.setItem('wandersync_user_id', saved);
        return saved;
      }
      const newId = `usr-${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 4)}`;
      sessionStorage.setItem('wandersync_user_id', newId);
      return newId;
    } catch (e) {
      return `usr-${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 4)}`;
    }
  });

  const [userProfile, setUserProfile] = useState<{
    id: string;
    name: string;
    avatar: string;
    color: string;
    mode: TransportMode;
    assignedRouteId: string | null;
  }>(() => {
    let name = '';
    let avatar = '🚗';
    let color = '#10b981';
    let mode: TransportMode = 'car';
    try {
      name = sessionStorage.getItem('wandersync_user_name') || localStorage.getItem('wandersync_user_name') || '';
      avatar = sessionStorage.getItem('wandersync_user_avatar') || localStorage.getItem('wandersync_user_avatar') || '🚗';
      color = sessionStorage.getItem('wandersync_user_color') || localStorage.getItem('wandersync_user_color') || '#10b981';
      mode = (sessionStorage.getItem('wandersync_user_mode') || localStorage.getItem('wandersync_user_mode') || 'car') as TransportMode;
    } catch (e) {}
    return {
      id: currentUserId,
      name,
      avatar,
      color,
      mode,
      assignedRouteId: null,
    };
  });

  // Real GPS & Group State (NO FAKE SIMULATED MEMBERS)
  const [members, setMembers] = useState<TravelerMember[]>([]);
  const [routes, setRoutes] = useState<TravelRoute[]>([]);
  const [rendezvous, setRendezvous] = useState<RendezvousPoint | null>(null);
  const [activeSOS, setActiveSOS] = useState<GroupMessage | null>(null);
  const [isLeader, setIsLeader] = useState(false);
  const [waypoints, setWaypoints] = useState<Waypoint[]>([]);
  const [pinningWaypoint, setPinningWaypoint] = useState<{ type: string; label: string } | null>(null);
  // V2V 3D Cockpit Drive Mode (from user reference image)
  const [isTripActive, setIsTripActive] = useState(false);
  const [is3DTiltActive, setIs3DTiltActive] = useState(true);
  const [isPointingPinMode, setIsPointingPinMode] = useState(false);
  // Synchronized departure countdown event (1 -> 2 -> 3 -> 4)
  const [activeCountdown, setActiveCountdown] = useState<TripCountdownEvent | null>(null);
  // Swap between zoomed driver map and full journey overview in corner
  const [isCornerMapSwapped, setIsCornerMapSwapped] = useState(false);

  // Map Tile Style (Default: Google Terrain / Mountains)
  const [tileStyle, setTileStyle] = useState<MapTileStyle>('terrain');
  const [isSettingMeetingPoint, setIsSettingMeetingPoint] = useState(false);
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [followMe, setFollowMe] = useState(false);

  // Google Maps API integration
  const GOOGLE_MAPS_KEY = (import.meta as any).env?.VITE_GOOGLE_MAPS_API_KEY || 'AIzaSyD7TQUFCM4BhUXzWtGDIVXh3zORe19Se7s';
  const [useGoogleMaps, setUseGoogleMaps] = useState(true);

  // Real Device GPS Tracking State
  const [gpsStatus, setGpsStatus] = useState<'prompt' | 'granted' | 'denied' | 'locating' | 'error'>('prompt');
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [isLocationModalDismissed, setIsLocationModalDismissed] = useState(false);
  const [realLocation, setRealLocation] = useState<LocationData | null>(null);
  const [isSharingLocation, setIsSharingLocation] = useState(true);
  const watchIdRef = useRef<number | null>(null);
  const compassHeadingRef = useRef<number>(0);
  const lastLocRef = useRef<{ lat: number; lng: number } | null>(null);

  // Connect to Socket server
  useEffect(() => {
    socketService.connect();

    // Group state from server (ONLY contains real members who joined this room code)
    const unsubGroupState = socketService.onGroupState((group: TravelGroup) => {
      setMembers(group.members);
      if (group.routes && group.routes.length > 0) setRoutes(group.routes);
      if (group.rendezvous) setRendezvous(group.rendezvous);
      if (group.waypoints) setWaypoints(group.waypoints);
      if (typeof (group as any).isTripActive === 'boolean') {
        setIsTripActive((group as any).isTripActive);
      }
      // Check if current user is the leader/creator
      const amILeader = group.creatorId === currentUserId ||
        (!group.creatorId) ||
        (group.members.length <= 1) ||
        (localStorage.getItem(`wandersync_creator_${group.id}`) === 'true');
      setIsLeader(amILeader);
    });

    // Real-time position broadcast of connected friends
    const unsubLocation = socketService.onMemberLocation((data) => {
      setMembers((prev) => {
        const exists = prev.some((m) => m.id === data.userId);
        if (!exists) {
          const newMember: TravelerMember = {
            id: data.userId,
            name: data.name || 'Friend',
            avatar: data.avatar || '🚗',
            color: data.color || '#10b981',
            mode: (data.mode as any) || 'car',
            location: data.location,
            status: (data.status as any) || 'active',
            trail: [data.trailPoint],
            lastSeen: Date.now(),
          };
          return [...prev, newMember];
        }
        return prev.map((m) => {
          if (m.id === data.userId) {
            const updatedTrail = m.trail ? [...m.trail, data.trailPoint] : [data.trailPoint];
            if (updatedTrail.length > 60) updatedTrail.shift();
            return {
              ...m,
              name: data.name || m.name,
              avatar: data.avatar || m.avatar,
              color: data.color || m.color,
              mode: (data.mode as any) || m.mode,
              location: data.location,
              status: (data.status as any) || m.status,
              trail: updatedTrail,
              lastSeen: Date.now(),
            };
          }
          return m;
        });
      });
    });

    const unsubSOS = socketService.onSOSTriggered((sosMsg) => {
      setActiveSOS(sosMsg);
    });

    const unsubRendezvous = socketService.onRendezvousUpdated((data) => {
      if (data.rendezvous) setRendezvous(data.rendezvous);
      if (data.routes && data.routes.length > 0) setRoutes(data.routes);
    });

    const unsubRoutes = socketService.onRoutesUpdated((newRoutes) => {
      setRoutes(newRoutes);
    });

    const unsubMemberRoute = socketService.onMemberRouteUpdated(({ userId, routeId }) => {
      setMembers((prev) =>
        prev.map((m) => (m.id === userId ? { ...m, assignedRouteId: routeId } : m))
      );
    });

    const unsubWaypoint = socketService.onWaypointAdded((wp) => {
      setWaypoints((prev) => [...prev, wp]);
    });

    const unsubWaypointRemoved = socketService.onWaypointRemoved(({ waypointId }) => {
      setWaypoints((prev) => prev.filter((w) => w.id !== waypointId));
    });

    const unsubPermission = socketService.onPermissionDenied(({ message }) => {
      alert(message);
    });

    const unsubCountdown = socketService.onTripCountdownStarted((event) => {
      setActiveCountdown(event);
    });

    const unsubCountdownCancel = socketService.onTripCountdownCancelled(() => {
      setActiveCountdown(null);
    });

    const unsubTripActive = socketService.onTripActiveUpdated(({ isTripActive: active }) => {
      setIsTripActive(active);
    });

    return () => {
      unsubGroupState();
      unsubLocation();
      unsubSOS();
      unsubRendezvous();
      unsubRoutes();
      unsubMemberRoute();
      unsubWaypoint();
      unsubWaypointRemoved();
      unsubPermission();
      unsubCountdown();
      unsubCountdownCancel();
      unsubTripActive();
    };
  }, []);

  // Helper: calculate bearing/heading between two points
  const calculateBearing = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
    const dLng = (lng2 - lng1) * (Math.PI / 180);
    const y = Math.sin(dLng) * Math.cos(lat2 * (Math.PI / 180));
    const x =
      Math.cos(lat1 * (Math.PI / 180)) * Math.sin(lat2 * (Math.PI / 180)) -
      Math.sin(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.cos(dLng);
    const brng = (Math.atan2(y, x) * (180 / Math.PI) + 360) % 360;
    return Math.round(brng);
  };

  // Start Real Browser GPS Tracking with Apple iOS & Android Fast Resolution
  const startRealGPSTracking = (currentGroupId: string, profile: typeof userProfile) => {
    if (!('geolocation' in navigator)) {
      setGpsError('Geolocation is not supported by your device.');
      setGpsStatus('denied');
      return;
    }

    setGpsStatus('locating');
    setGpsError(null);

    // Apple iOS Compass Orientation Listener (to get exact device facing direction)
    try {
      if (typeof (window as any).DeviceOrientationEvent !== 'undefined') {
        const reqPerm = (DeviceOrientationEvent as any).requestPermission;
        if (typeof reqPerm === 'function') {
          reqPerm()
            .then((res: string) => {
              if (res === 'granted') {
                window.addEventListener(
                  'deviceorientation',
                  (e: any) => {
                    if (e.webkitCompassHeading != null) {
                      compassHeadingRef.current = Math.round(e.webkitCompassHeading);
                    }
                  },
                  true
                );
              }
            })
            .catch(() => {});
        } else {
          window.addEventListener(
            'deviceorientation',
            (e: any) => {
              if (e.webkitCompassHeading != null) {
                compassHeadingRef.current = Math.round(e.webkitCompassHeading);
              } else if (e.alpha != null) {
                compassHeadingRef.current = Math.round(360 - e.alpha);
              }
            },
            true
          );
        }
      }
    } catch (e) {
      console.warn('Device orientation error:', e);
    }

    let hasReceivedFirstFix = false;

    // Unified position update handler
    const handleSuccessPosition = (pos: GeolocationPosition, isHighPrecision = true) => {
      setGpsStatus('granted');
      setGpsError(null);

      const speedKm = pos.coords.speed ? Math.round(pos.coords.speed * 3.6) : 0;
      let heading = pos.coords.heading;

      // Determine accurate heading/facing:
      // 1. If GPS provides valid heading at speed, use it.
      // 2. If moving, calculate bearing from previous GPS breadcrumb.
      // 3. If stationary or indoors on iPhone, use Apple compass heading (webkitCompassHeading).
      if (heading == null || isNaN(heading) || (heading === 0 && speedKm < 2)) {
        if (
          lastLocRef.current &&
          calculateDistanceKm(
            lastLocRef.current.lat,
            lastLocRef.current.lng,
            pos.coords.latitude,
            pos.coords.longitude
          ) > 0.003
        ) {
          heading = calculateBearing(
            lastLocRef.current.lat,
            lastLocRef.current.lng,
            pos.coords.latitude,
            pos.coords.longitude
          );
        } else if (compassHeadingRef.current) {
          heading = compassHeadingRef.current;
        } else {
          heading = 0;
        }
      }

      const loc: LocationData = {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        speed: speedKm,
        heading: Math.round(heading),
        altitude: pos.coords.altitude || undefined,
        accuracy: Math.round(pos.coords.accuracy),
        battery: 95,
        timestamp: Date.now(),
      };

      lastLocRef.current = { lat: loc.lat, lng: loc.lng };
      setRealLocation(loc);

      // Register or update user with real GPS location
      setMembers((prev) => {
        const existing = prev.find((m) => m.id === currentUserId);
        const trail = existing?.trail
          ? [...existing.trail, [loc.lat, loc.lng]]
          : [[loc.lat, loc.lng]];
        if (trail.length > 60) trail.shift();

        const updated: TravelerMember = {
          ...profile,
          location: loc,
          trail,
          status: speedKm > 2 ? 'moving' : 'idle',
          lastSeen: Date.now(),
        };
        return [updated, ...prev.filter((m) => m.id !== currentUserId)];
      });

      // Broadcast position to squad
      socketService.updateLocation(currentGroupId, currentUserId, loc);

      if (!hasReceivedFirstFix) {
        hasReceivedFirstFix = true;
        if (rendezvous) {
          window.dispatchEvent(new CustomEvent('wandersync:fit_all'));
        } else {
          window.dispatchEvent(
            new CustomEvent('wandersync:pan_to', {
              detail: { lat: pos.coords.latitude, lng: pos.coords.longitude },
            })
          );
        }
      }
    };

    // Stage 1: Immediate Fast Fix (< 1 sec cached or Wi-Fi/cellular triangulation)
    navigator.geolocation.getCurrentPosition(
      (pos) => handleSuccessPosition(pos, false),
      (err) => {
        if (err.code === 1) {
          setGpsStatus('denied');
          setGpsError('Location access was denied. Please allow location in your browser settings.');
        }
      },
      { enableHighAccuracy: false, timeout: 6000, maximumAge: 300000 }
    );

    // Stage 2: High-Accuracy GPS Lock (Satellite fix)
    navigator.geolocation.getCurrentPosition(
      (pos) => handleSuccessPosition(pos, true),
      (err) => {
        console.warn('[GPS] High accuracy initial attempt note:', err.message);
        if (err.code === 1) {
          setGpsStatus('denied');
          setGpsError('Location permission denied. Please enable location permissions.');
        }
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 }
    );

    // Stage 3: Adaptive Continuous Watcher (Never dies if satellite GPS drops indoors)
    const startWatcher = (highAccuracy: boolean) => {
      if (watchIdRef.current != null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
      watchIdRef.current = navigator.geolocation.watchPosition(
        (pos) => handleSuccessPosition(pos, highAccuracy),
        (err) => {
          console.warn(`[GPS Watcher (${highAccuracy ? 'high' : 'low'} accuracy) warning]:`, err.code, err.message);
          if (err.code === 1) {
            setGpsStatus('denied');
            setGpsError('Location permission was revoked or blocked.');
          } else if (highAccuracy && (err.code === 2 || err.code === 3)) {
            // Satellite signal lost or indoors, switch to standard network positioning
            startWatcher(false);
          }
        },
        {
          enableHighAccuracy: highAccuracy,
          maximumAge: 5000,
          timeout: highAccuracy ? 12000 : 20000,
        }
      );
    };

    startWatcher(true);
  };

  // User tap on "Allow" button in Location Permission Modal
  const handleRequestLocationPermission = () => {
    // Apple iOS Compass Orientation Listener (strictly requires explicit user gesture)
    try {
      if (typeof (window as any).DeviceOrientationEvent !== 'undefined') {
        const reqPerm = (DeviceOrientationEvent as any).requestPermission;
        if (typeof reqPerm === 'function') {
          reqPerm()
            .then((res: string) => {
              if (res === 'granted') {
                window.addEventListener(
                  'deviceorientation',
                  (e: any) => {
                    if (e.webkitCompassHeading != null) {
                      compassHeadingRef.current = Math.round(e.webkitCompassHeading);
                    }
                  },
                  true
                );
              }
            })
            .catch(() => {});
        }
      }
    } catch (e) {
      console.warn('Device orientation error:', e);
    }

    startRealGPSTracking(groupId, userProfile);
  };

  // Handle User Join (Create or Join Private Group)
  const handleJoin = (data: {
    groupId: string;
    name: string;
    avatar: string;
    color: string;
    mode: TransportMode;
    isCreator?: boolean;
    initialDestination?: { lat: number; lng: number; title: string };
  }) => {
    setGroupId(data.groupId);
    // Keep URL parameter synchronized so sharing address bar or refreshing keeps private group
    const newUrl = new URL(window.location.href);
    newUrl.searchParams.set('trip', data.groupId);
    window.history.replaceState(null, '', newUrl.toString());

    if (data.isCreator) {
      setIsLeader(true);
      try {
        localStorage.setItem(`wandersync_creator_${data.groupId}`, 'true');
      } catch (e) {}
    } else {
      try {
        if (localStorage.getItem(`wandersync_creator_${data.groupId}`) === 'true') {
          setIsLeader(true);
          data.isCreator = true;
        }
      } catch (e) {}
    }

    const updatedProfile = {
      ...userProfile,
      name: data.name,
      avatar: data.avatar,
      color: data.color,
      mode: data.mode,
      isLeader: Boolean(data.isCreator),
    };
    setUserProfile(updatedProfile);
    setIsJoined(true);

    try {
      localStorage.setItem('wandersync_user_name', data.name);
      localStorage.setItem('wandersync_user_avatar', data.avatar);
      localStorage.setItem('wandersync_user_color', data.color);
      localStorage.setItem('wandersync_user_mode', data.mode);
    } catch (e) {}

    // Register user immediately in group with real location if already fetched, or locating status
    const initialMember: TravelerMember = {
      ...updatedProfile,
      isLeader: Boolean(data.isCreator),
      location: realLocation || undefined,
      trail: [],
      status: realLocation ? 'active' : 'locating',
      lastSeen: Date.now(),
    };
    setMembers((prev) => [initialMember, ...prev.filter((m) => m.id !== currentUserId)]);
    socketService.joinGroup(data.groupId, { ...initialMember, isCreator: data.isCreator } as any);

    // If creator selected an initial destination upfront, set and broadcast it immediately AFTER joining
    if (data.initialDestination) {
      const initialRendezvous: RendezvousPoint = {
        lat: data.initialDestination.lat,
        lng: data.initialDestination.lng,
        title: data.initialDestination.title,
        setBy: data.name,
        timestamp: Date.now(),
      };
      setRendezvous(initialRendezvous);
      socketService.setRendezvous(data.groupId, initialRendezvous, currentUserId);
    }

    // Request real browser GPS permission & start tracking
    startRealGPSTracking(data.groupId, updatedProfile);
  };

  // Claim or restore admin leadership
  const handleClaimAdmin = () => {
    socketService.claimAdmin(groupId);
    setIsLeader(true);
    try {
      localStorage.setItem(`wandersync_creator_${groupId}`, 'true');
    } catch (e) {}
  };

  // Leave current group to join or create another
  const handleLeaveGroup = () => {
    if (watchIdRef.current != null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    socketService.leaveGroup();
    setIsJoined(false);
    setMembers([]);
    setRoutes([]);
    setRendezvous(null);
    setWaypoints([]);
    setIsLeader(false);
    const cleanUrl = new URL(window.location.href);
    cleanUrl.searchParams.delete('trip');
    cleanUrl.searchParams.delete('group');
    window.history.replaceState(null, '', cleanUrl.toString());
  };

  // Toggle Location Sharing (On/Off)
  const handleToggleLocationSharing = () => {
    const nextState = !isSharingLocation;
    setIsSharingLocation(nextState);

    if (!nextState) {
      if (watchIdRef.current != null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    } else {
      startRealGPSTracking(groupId, userProfile);
    }
  };

  // Route Assignment Action
  const handleAssignRoute = (userId: string, routeId: string) => {
    setMembers((prev) =>
      prev.map((m) => (m.id === userId ? { ...m, assignedRouteId: routeId } : m))
    );
    socketService.assignRoute(groupId, userId, routeId);
  };

  // Set Meeting Destination by tapping anywhere on map or searching
  const handleSelectLocationForRendezvous = async (lat: number, lng: number, customTitle?: string) => {
    setIsSettingMeetingPoint(false);

    const newRendezvous: RendezvousPoint = {
      lat: +lat.toFixed(5),
      lng: +lng.toFixed(5),
      title: customTitle || 'Our Meeting Spot 📍',
      setBy: userProfile.name,
      timestamp: Date.now(),
    };

    setRendezvous(newRendezvous);
    socketService.setRendezvous(groupId, newRendezvous, currentUserId);
  };

  // Add a road waypoint (fuel, rest, hazard, etc.)
  const handleAddWaypoint = (lat: number, lng: number, type: string, label: string) => {
    socketService.addWaypoint(groupId, {
      lat,
      lng,
      type: type as any,
      label,
      addedBy: currentUserId,
      addedByName: userProfile.name,
    });
  };

  // Place waypoint on map click
  const handlePlaceWaypointOnMap = (lat: number, lng: number) => {
    if (pinningWaypoint) {
      handleAddWaypoint(lat, lng, pinningWaypoint.type, pinningWaypoint.label);
      setPinningWaypoint(null);
    }
  };

  // Remove a waypoint
  const handleRemoveWaypoint = (waypointId: string) => {
    socketService.removeWaypoint(groupId, waypointId);
  };

  // Synchronized Convoy Trip Start & Countdown Handlers
  const handleInitiateStartTrip = () => {
    const event: TripCountdownEvent = {
      startedBy: userProfile.name || 'Convoy Leader',
      startedById: currentUserId,
      durationSeconds: 4,
      timestamp: Date.now(),
    };
    setActiveCountdown(event);
    socketService.startTripCountdown(groupId, userProfile, 4);
  };

  const handleCountdownComplete = () => {
    setActiveCountdown(null);
    setIsTripActive(true);
    socketService.setTripActive(groupId, true);
  };

  const handleCountdownCancel = () => {
    socketService.cancelTripCountdown(groupId, userProfile);
    setActiveCountdown(null);
  };

  // Demo Drive Simulation along real road coordinates
  const [isSimulatingDrive, setIsSimulatingDrive] = useState(false);
  const simIndexRef = useRef(0);
  const simIntervalRef = useRef<any>(null);

  const handleToggleSimulation = () => {
    if (isSimulatingDrive) {
      if (simIntervalRef.current) clearInterval(simIntervalRef.current);
      setIsSimulatingDrive(false);
      return;
    }

    const myMember = members.find((m) => m.id === currentUserId);
    const myRoutes = routes.filter((r) => !r.forUserId || r.forUserId === currentUserId);
    const activeRoute = myMember?.assignedRouteId
      ? routes.find((r) => r.id === myMember.assignedRouteId) || myRoutes[0]
      : myRoutes[0];

    let coords = activeRoute?.coordinates;
    if (!coords || coords.length < 2) {
      // Fallback realistic road drive loop around driver or standard coordinates
      const baseLat = realLocation?.lat || 28.6139;
      const baseLng = realLocation?.lng || 77.2090;
      coords = [];
      for (let i = 0; i < 30; i++) {
        const progress = i / 30;
        const latOffset = Math.sin(progress * Math.PI * 2) * 0.003 + (progress * 0.004);
        const lngOffset = Math.cos(progress * Math.PI * 2) * 0.004;
        coords.push([+(baseLat + latOffset).toFixed(6), +(baseLng + lngOffset).toFixed(6)]);
      }
    }
    setIsSimulatingDrive(true);
    simIndexRef.current = 0;

    simIntervalRef.current = setInterval(() => {
      simIndexRef.current += 1;
      if (simIndexRef.current >= coords.length) {
        simIndexRef.current = 0;
      }
      const idx = simIndexRef.current;
      const currentPt = coords[idx];
      const nextPt = coords[(idx + 1) % coords.length];

      const dLon = ((nextPt[1] - currentPt[1]) * Math.PI) / 180;
      const y = Math.sin(dLon) * Math.cos((nextPt[0] * Math.PI) / 180);
      const x =
        Math.cos((currentPt[0] * Math.PI) / 180) * Math.sin((nextPt[0] * Math.PI) / 180) -
        Math.sin((currentPt[0] * Math.PI) / 180) * Math.cos((nextPt[0] * Math.PI) / 180) * Math.cos(dLon);
      const heading = (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;

      const simLoc: LocationData = {
        lat: currentPt[0],
        lng: currentPt[1],
        heading: Math.round(heading),
        speed: 17.5,
        timestamp: Date.now(),
      };

      socketService.updateLocation(groupId, currentUserId, simLoc);
      setRealLocation(simLoc);

      // Move other squad friends alongside/near driver
      const otherMembers = members.filter((m) => m.id !== currentUserId);
      otherMembers.forEach((other, oIdx) => {
        socketService.updateLocation(groupId, other.id, {
          lat: +(currentPt[0] + (oIdx + 1) * 0.00015).toFixed(6),
          lng: +(currentPt[1] + (oIdx + 1) * 0.00012).toFixed(6),
          heading: Math.round(heading),
          speed: 17.0 + oIdx * 0.5,
          timestamp: Date.now(),
        });
      });
    }, 1200);
  };

  useEffect(() => {
    return () => {
      if (simIntervalRef.current) clearInterval(simIntervalRef.current);
    };
  }, []);

  const handleExitTrip = () => {
    if (simIntervalRef.current) {
      clearInterval(simIntervalRef.current);
      setIsSimulatingDrive(false);
    }
    setIsTripActive(false);
    setIsCornerMapSwapped(false);
    socketService.setTripActive(groupId, false);
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-slate-950 font-['Plus_Jakarta_Sans',sans-serif]">
      {/* Minimal Homepage with Ambient Map & Group Invite */}
      {!isJoined && (
        <HomepageHero
          onJoin={handleJoin}
          initialTripCode={
            new URLSearchParams(window.location.search).get('trip') ||
            new URLSearchParams(window.location.search).get('group') ||
            undefined
          }
        />
      )}

      {/* Main Mountain & Road Map: Google Maps with Directions or Topo Fallback */}
      {useGoogleMaps && GOOGLE_MAPS_KEY ? (
        <GoogleMapView
          apiKey={GOOGLE_MAPS_KEY}
          members={members}
          currentUserId={currentUserId}
          routes={routes}
          rendezvous={rendezvous}
          waypoints={waypoints}
          onAddWaypoint={handleAddWaypoint}
          onRemoveWaypoint={handleRemoveWaypoint}
          pinningWaypoint={pinningWaypoint}
          onPlaceWaypointOnMap={handlePlaceWaypointOnMap}
          onCancelPinningWaypoint={() => setPinningWaypoint(null)}
          isPointingPinMode={isPointingPinMode}
          onTogglePointingPin={() => setIsPointingPinMode((prev) => !prev)}
          tileStyle={tileStyle}
          isTripActive={isTripActive}
          is3DTiltActive={is3DTiltActive}
          isCornerMapSwapped={isCornerMapSwapped}
          onToggleCornerMapSwap={() => setIsCornerMapSwapped((prev) => !prev)}
          isSettingRendezvous={isSettingMeetingPoint}
          onSelectLocationForRendezvous={handleSelectLocationForRendezvous}
          selectedMemberId={selectedMemberId}
          onSelectMember={(id) => {
            setSelectedMemberId(id);
            const target = members.find((m) => m.id === id);
            if (target && target.location) {
              window.dispatchEvent(
                new CustomEvent('wandersync:pan_to', {
                  detail: { lat: target.location.lat, lng: target.location.lng },
                })
              );
            }
          }}
          followMe={followMe}
          onLoadError={() => setUseGoogleMaps(false)}
          onRoutesCalculated={(newRoutes) => {
            setRoutes((prev) => {
              const others = prev.filter((r) => r.forUserId && r.forUserId !== currentUserId);
              return [...others, ...newRoutes];
            });
            socketService.setRoutes(groupId, newRoutes, currentUserId);
          }}
          onSelectRoute={(routeId) => handleAssignRoute(currentUserId, routeId)}
        />
      ) : (
        <MapView
          members={members}
          currentUserId={currentUserId}
          routes={routes}
          rendezvous={rendezvous}
          tileStyle={tileStyle}
          isSettingRendezvous={isSettingMeetingPoint}
          onSelectLocationForRendezvous={handleSelectLocationForRendezvous}
          selectedMemberId={selectedMemberId}
          onSelectMember={(id) => {
            setSelectedMemberId(id);
            const target = members.find((m) => m.id === id);
            if (target && target.location) {
              window.dispatchEvent(
                new CustomEvent('wandersync:pan_to', {
                  detail: { lat: target.location.lat, lng: target.location.lng },
                })
              );
            }
          }}
          followMe={followMe}
        />
      )}

      {/* Location Permission Pop-up Modal with prominent "Allow" button */}
      <LocationPermissionModal
        isOpen={isJoined && gpsStatus !== 'granted' && !isLocationModalDismissed}
        status={gpsStatus}
        error={gpsError}
        onAllow={handleRequestLocationPermission}
        onDismiss={() => setIsLocationModalDismissed(true)}
      />

      {/* Floating button to re-open location permission modal if user closed it */}
      {isJoined && gpsStatus !== 'granted' && isLocationModalDismissed && (
        <button
          onClick={() => setIsLocationModalDismissed(false)}
          className="absolute top-20 right-4 z-40 px-3.5 py-2 rounded-2xl bg-emerald-600/90 hover:bg-emerald-500 text-white font-bold text-xs shadow-xl flex items-center gap-1.5 backdrop-blur border border-emerald-400/50 animate-pulse transition active:scale-95 cursor-pointer"
        >
          <span>📍</span>
          <span>Allow Location</span>
        </button>
      )}

      {/* ================================================================= */}
      {/* FLOATING CORNER CONTROLS: Apple-Grade GO / Cancel Trip Engine     */}
      {/* ================================================================= */}
      {isJoined && (
        <div className="fixed bottom-22 left-3.5 sm:bottom-8 sm:left-6 z-40 pointer-events-auto select-none">
          {!isTripActive && !activeCountdown ? (
            <button
              type="button"
              onClick={handleInitiateStartTrip}
              className="apple-pressable px-5 py-3 rounded-full bg-gradient-to-r from-[#34C759] to-[#28CD41] hover:from-[#2fb350] hover:to-[#22b337] text-white font-extrabold text-sm tracking-wider shadow-2xl shadow-emerald-500/40 border-t border-white/40 flex items-center gap-2 cursor-pointer active:scale-95 transition-all"
              title="Start Convoy Trip (GO)"
            >
              <span className="text-lg">🚀</span>
              <span className="uppercase font-black text-sm tracking-widest">GO</span>
            </button>
          ) : isTripActive ? (
            <button
              type="button"
              onClick={handleExitTrip}
              className="apple-pressable px-4 py-2.5 rounded-full apple-glass-pill bg-rose-950/70 hover:bg-rose-900/90 text-[#FF3B30] border border-rose-500/40 font-bold text-xs flex items-center gap-2 shadow-2xl shadow-black/50 cursor-pointer active:scale-95 transition-all"
              title="Cancel Current Trip Navigation"
            >
              <span className="text-sm">🛑</span>
              <span className="font-bold">Cancel Trip</span>
            </button>
          ) : null}
        </div>
      )}

      {/* Ultra-Simple, Human-Friendly Travel Controls - Render only when NOT on active trip */}
      {!isTripActive && (
        <SimpleTravelerUI
          tripName={groupId}
          isLeader={isLeader}
          members={members}
          currentUserId={currentUserId}
          routes={routes}
          rendezvous={rendezvous}
          waypoints={waypoints}
          onAddWaypoint={handleAddWaypoint}
          onRemoveWaypoint={handleRemoveWaypoint}
          pinningWaypoint={pinningWaypoint}
          onStartPinningWaypointOnMap={(type, label) => setPinningWaypoint({ type, label })}
          onCancelPinningWaypoint={() => setPinningWaypoint(null)}
          onSetMeetingLocation={handleSelectLocationForRendezvous}
          userName={userProfile.name}
          isSharingLocation={isSharingLocation}
          onToggleLocationSharing={handleToggleLocationSharing}
          isSettingMeetingPoint={isSettingMeetingPoint}
          onToggleSetMeetingPoint={() => setIsSettingMeetingPoint(!isSettingMeetingPoint)}
          tileStyle={tileStyle}
          onChangeTileStyle={setTileStyle}
          onSelectMember={(id) => {
            setSelectedMemberId(id);
            const target = members.find((m) => m.id === id);
            if (target && target.location) {
              window.dispatchEvent(
                new CustomEvent('wandersync:pan_to', {
                  detail: { lat: target.location.lat, lng: target.location.lng },
                })
              );
            }
          }}
          onAssignRoute={handleAssignRoute}
          onLeaveGroup={handleLeaveGroup}
          isTripActive={isTripActive}
          onToggleTripActive={isTripActive ? handleExitTrip : handleInitiateStartTrip}
          onClaimAdmin={handleClaimAdmin}
        />
      )}

      {/* Futuristic V2V Cockpit Heads-Up Display (Clean Bottom Dock) */}
      {isTripActive && (
        <V2VCockpitHUD
          currentUserId={currentUserId}
          members={members}
          rendezvous={rendezvous}
          routes={routes}
          waypoints={waypoints}
          is3DTiltActive={is3DTiltActive}
          onToggle3DTilt={() => setIs3DTiltActive(!is3DTiltActive)}
          onExitTrip={handleExitTrip}
          isSimulating={isSimulatingDrive}
          onToggleSimulation={handleToggleSimulation}
          isPointingPinMode={isPointingPinMode}
          onTogglePointingPin={() => setIsPointingPinMode((prev) => !prev)}
          onAddHazard={(type, label) => {
            const myPos = realLocation || members.find((m) => m.id === currentUserId)?.location;
            if (myPos) {
              handleAddWaypoint(myPos.lat, myPos.lng, type, label);
            }
          }}
        />
      )}

      {/* Right-Side Corner Journey Route Map (Picture-in-Picture Radar) */}
      {isTripActive && (
        <CornerJourneyRouteMap
          members={members}
          currentUserId={currentUserId}
          routes={routes}
          rendezvous={rendezvous}
          isSwapped={isCornerMapSwapped}
          onToggleSwap={() => setIsCornerMapSwapped((prev) => !prev)}
          selectedMemberId={selectedMemberId}
          onSelectMember={(id) => {
            setSelectedMemberId(id);
            const target = members.find((m) => m.id === id);
            if (target && target.location) {
              window.dispatchEvent(
                new CustomEvent('wandersync:pan_to', {
                  detail: { lat: target.location.lat, lng: target.location.lng },
                })
              );
            }
          }}
          onAssignRoute={handleAssignRoute}
        />
      )}

      {/* Synchronized Convoy Departure Countdown Modal (1 -> 2 -> 3 -> 4) */}
      {activeCountdown && (
        <ConvoyCountdownModal
          countdown={activeCountdown}
          members={members}
          currentUserId={currentUserId}
          onComplete={handleCountdownComplete}
          onCancel={handleCountdownCancel}
        />
      )}

      {/* Emergency Alert Banner */}
      <SOSBanner
        activeSOS={activeSOS}
        onFocusSOSLocation={(loc) => {
          window.dispatchEvent(
            new CustomEvent('wandersync:pan_to', { detail: { lat: loc.lat, lng: loc.lng } })
          );
        }}
        onDismiss={() => setActiveSOS(null)}
      />

    </div>
  );
};

export default App;
