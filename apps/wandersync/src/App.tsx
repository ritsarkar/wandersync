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
import { AddFriendModal } from './components/AddFriendModal';
import { UserPlus } from 'lucide-react';
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
  CandidateSearchLocation,
} from './types';

export const App: React.FC = () => {
  // Read trip/group code from URL query parameter or generate clean 6-char code
  const [groupId, setGroupId] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('group') || params.get('trip') || `TRIP-${Math.floor(100 + Math.random() * 900)}`;
  });

  const [isJoined, setIsJoined] = useState(false);
  const [availableSearchLocations, setAvailableSearchLocations] = useState<CandidateSearchLocation[]>([
    { id: 'dest-manali', name: 'Manali', lat: 32.2432, lng: 77.1892, icon: '🏔️', formattedAddress: 'Manali, Himachal Pradesh', type: 'popular' },
    { id: 'dest-shimla', name: 'Shimla', lat: 31.1048, lng: 77.1734, icon: '⛰️', formattedAddress: 'Shimla, Himachal Pradesh', type: 'popular' },
    { id: 'dest-mussoorie', name: 'Mussoorie', lat: 30.4598, lng: 78.0644, icon: '🌲', formattedAddress: 'Mussoorie, Uttarakhand', type: 'popular' },
    { id: 'dest-rishikesh', name: 'Rishikesh', lat: 30.0869, lng: 78.2676, icon: '🧘', formattedAddress: 'Rishikesh, Uttarakhand', type: 'popular' },
    { id: 'dest-leh', name: 'Leh Ladakh', lat: 34.1526, lng: 77.5771, icon: '❄️', formattedAddress: 'Leh Ladakh', type: 'popular' },
    { id: 'dest-goa', name: 'Goa Beaches', lat: 15.2993, lng: 74.1240, icon: '🌊', formattedAddress: 'Goa Beaches', type: 'popular' },
  ]);
  const [selectedCandidateLocation, setSelectedCandidateLocation] = useState<CandidateSearchLocation | null>(null);
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
  // Add Friend / Invite Modal during live traveling
  const [showAddFriendModal, setShowAddFriendModal] = useState(false);

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
  const lastConfirmedRendezvousRef = useRef<RendezvousPoint | null>(null);

  // Connect to Socket server
  useEffect(() => {
    socketService.connect();

    // Group state from server (ONLY contains real members who joined this room code)
    const unsubGroupState = socketService.onGroupState((group: TravelGroup) => {
      setMembers(group.members);
      if (group.routes && group.routes.length > 0) {
        setRoutes((prev) => {
          // Only accept if incoming has at least as many user routes as we already have
          const incomingUserIds = new Set(group.routes.filter((r: any) => r.forUserId).map((r: any) => r.forUserId));
          const prevUserIds = new Set(prev.filter((r) => r.forUserId).map((r) => r.forUserId));
          // Keep routes for users NOT in incoming set (they may not have been recalculated yet)
          const preserved = prev.filter((r) => r.forUserId && !incomingUserIds.has(r.forUserId));
          return [...preserved, ...group.routes];
        });
      }
      if (group.rendezvous) {
        lastConfirmedRendezvousRef.current = group.rendezvous;
        setRendezvous(group.rendezvous);
      }
      if (group.waypoints) setWaypoints(group.waypoints);
      if (typeof (group as any).isTripActive === 'boolean') {
        setIsTripActive((group as any).isTripActive);
      }
      // Check if current user is the leader/creator
      const amILeader = Boolean(
        group.creatorId && group.creatorId === currentUserId
      ) || (
        localStorage.getItem(`wandersync_creator_${group.id}`) === 'true' &&
        (!group.creatorId || group.creatorId === currentUserId)
      );
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
      if (data.rendezvous) {
        lastConfirmedRendezvousRef.current = data.rendezvous;
        setRendezvous(data.rendezvous);
        // If current user is waiting for GPS and still locating, place near approach road so vehicle & route appear immediately
        setMembers((prev) => {
          const myIdx = prev.findIndex((m) => m.id === currentUserId);
          if (myIdx >= 0 && !realLocation && prev[myIdx].status === 'locating' && !prev[myIdx].isLeader) {
            const copy = [...prev];
            const approachLoc: LocationData = {
              lat: +(data.rendezvous.lat - 0.035).toFixed(5),
              lng: +(data.rendezvous.lng - 0.025).toFixed(5),
              speed: 35,
              heading: 25,
              accuracy: 20,
              timestamp: Date.now(),
            };
            copy[myIdx] = { ...copy[myIdx], location: approachLoc, status: 'active' };
            socketService.updateLocation(groupId, currentUserId, approachLoc);
            return copy;
          }
          return prev;
        });
      }
      if (data.routes && data.routes.length > 0) {
        setRoutes((prev) => {
          const incomingIds = new Set(data.routes.filter((r) => r.forUserId).map((r) => r.forUserId));
          const others = prev.filter((r) => r.forUserId && !incomingIds.has(r.forUserId));
          return [...others, ...data.routes];
        });
      }
    });

    const unsubRoutes = socketService.onRoutesUpdated((newRoutes) => {
      if (Array.isArray(newRoutes) && newRoutes.length > 0) {
        setRoutes((prev) => {
          const incomingIds = new Set(newRoutes.filter((r) => r.forUserId).map((r) => r.forUserId));
          const others = prev.filter((r) => r.forUserId && !incomingIds.has(r.forUserId));
          return [...others, ...newRoutes];
        });
      }
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
      // Revert to last server-confirmed rendezvous
      if (lastConfirmedRendezvousRef.current) {
        setRendezvous(lastConfirmedRendezvousRef.current);
      }
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
      setIsLeader(false);
      try {
        localStorage.removeItem(`wandersync_creator_${data.groupId}`);
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

    // Guarantee user immediately in group with real location if already fetched, or a smart starting approach
    let initialLoc = realLocation;
    if (!initialLoc) {
      const targetRendezvous = data.initialDestination || rendezvous;
      const leaderMember = members.find((m) => m.isLeader && m.location);
      if (targetRendezvous) {
        // Position on approach road ~3.5km from destination so vehicle & route appear immediately
        initialLoc = {
          lat: +(targetRendezvous.lat - (data.isCreator ? 0.045 : 0.035)).toFixed(5),
          lng: +(targetRendezvous.lng - (data.isCreator ? 0.035 : 0.025)).toFixed(5),
          speed: 38,
          heading: 25,
          accuracy: 15,
          timestamp: Date.now(),
        };
      } else if (leaderMember?.location) {
        initialLoc = {
          lat: +(leaderMember.location.lat - 0.035).toFixed(5),
          lng: +(leaderMember.location.lng - 0.025).toFixed(5),
          speed: 38,
          heading: 20,
          accuracy: 15,
          timestamp: Date.now(),
        };
      } else {
        initialLoc = {
          lat: 28.6139,
          lng: 77.2090,
          speed: 0,
          heading: 0,
          accuracy: 50,
          timestamp: Date.now(),
        };
      }
    }

    const initialMember: TravelerMember = {
      ...updatedProfile,
      isLeader: Boolean(data.isCreator),
      location: initialLoc || undefined,
      trail: initialLoc ? [[initialLoc.lat, initialLoc.lng]] : [],
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
      lastConfirmedRendezvousRef.current = initialRendezvous;
      // Delay setRendezvous to ensure join_group is processed first on the server
      setTimeout(() => {
        socketService.setRendezvous(data.groupId, initialRendezvous, currentUserId);
      }, 350);
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
          onUpdateCandidateLocations={setAvailableSearchLocations}
          selectedCandidateLocation={selectedCandidateLocation}
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
          isLeader={isLeader}
          availableSearchLocations={availableSearchLocations}
          onSelectCandidateLocation={(candidate) => {
            setSelectedCandidateLocation(candidate);
            if (isJoined && isLeader) {
              handleSelectLocationForRendezvous(
                candidate.lat,
                candidate.lng,
                `${candidate.icon || '📍'} ${candidate.name}`
              );
            }
          }}
          onLoadError={() => setUseGoogleMaps(false)}
          onRoutesCalculated={(newRoutes) => {
            setRoutes((prev) => {
              const incomingUserIds = new Set(newRoutes.filter((r) => r.forUserId).map((r) => r.forUserId));
              const others = prev.filter((r) => r.forUserId && !incomingUserIds.has(r.forUserId));
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
          onOpenAddFriend={() => setShowAddFriendModal(true)}
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

      {/* Small Floating "Add Friend" Icon on Map during Live Traveling */}
      {isJoined && isTripActive && (
        <div className="fixed top-4 left-4 z-40 pointer-events-auto select-none animate-fade-in">
          <button
            type="button"
            onClick={() => setShowAddFriendModal(true)}
            className="apple-pressable p-2.5 sm:px-3.5 sm:py-2.5 rounded-2xl apple-glass-pill bg-slate-900/85 hover:bg-slate-800 text-white border border-emerald-500/40 hover:border-emerald-400 shadow-[0_8px_30px_rgba(0,0,0,0.6)] flex items-center gap-2 cursor-pointer transition active:scale-95 group ring-2 ring-emerald-500/20"
            title="Add Friend to Convoy (Invite Link & QR Code)"
          >
            <div className="relative flex items-center justify-center">
              <UserPlus className="w-4 h-4 text-emerald-400 group-hover:scale-110 transition-transform" />
              <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
              <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-emerald-500" />
            </div>
            <span className="font-extrabold text-xs tracking-tight text-white hidden xs:inline sm:inline">
              Add Friend
            </span>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold">
              {members.length}
            </span>
          </button>
        </div>
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

      {/* Add Friend / Squad Invite Modal */}
      <AddFriendModal
        isOpen={showAddFriendModal}
        onClose={() => setShowAddFriendModal(false)}
        groupId={groupId}
        members={members}
      />

    </div>
  );
};

export default App;
