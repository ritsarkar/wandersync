import React, { useState } from 'react';
import {
  MapPin,
  Share2,
  Users,
  Navigation,
  Check,
  Compass,
  Search,
  ChevronUp,
  ChevronDown,
  Layers,
  ArrowRight,
  Route,
  Zap,
  AlertTriangle,
  Fuel,
  Coffee,
  Camera,
  Flag,
  X,
  LogOut,
  Copy,
  MessageCircle,
  QrCode,
} from 'lucide-react';
import { useFluidSheet } from '../hooks/useFluidSheet';
import { TravelerMember, TravelRoute, RendezvousPoint, MapTileStyle, Waypoint, WaypointType, SQUAD_FRIEND_PALETTE, DRIVER_PRIMARY_COLOR } from '../types';
import { calculateDistanceKm } from '../../server/routingService.js';
import { GooglePlaceSearchInput } from './GooglePlaceSearchInput';

interface SimpleTravelerUIProps {
  tripName: string;
  isLeader: boolean;
  members: TravelerMember[];
  currentUserId: string;
  routes: TravelRoute[];
  rendezvous: RendezvousPoint | null;
  isSharingLocation: boolean;
  onToggleLocationSharing: () => void;
  isSettingMeetingPoint: boolean;
  onToggleSetMeetingPoint: () => void;
  tileStyle: MapTileStyle;
  onChangeTileStyle: (style: MapTileStyle) => void;
  onSelectMember: (memberId: string) => void;
  onAssignRoute: (userId: string, routeId: string) => void;
  waypoints?: Waypoint[];
  onAddWaypoint?: (lat: number, lng: number, type: string, label: string) => void;
  onRemoveWaypoint?: (waypointId: string) => void;
  userName?: string;
  pinningWaypoint?: { type: string; label: string } | null;
  onStartPinningWaypointOnMap?: (type: string, label: string) => void;
  onCancelPinningWaypoint?: () => void;
  onSetMeetingLocation?: (lat: number, lng: number, title?: string) => void;
  onLeaveGroup?: () => void;
  isTripActive?: boolean;
  onToggleTripActive?: () => void;
  onClaimAdmin?: () => void;
}

export const SimpleTravelerUI: React.FC<SimpleTravelerUIProps> = ({
  tripName,
  isLeader,
  members,
  currentUserId,
  routes,
  rendezvous,
  isSharingLocation,
  onToggleLocationSharing,
  isSettingMeetingPoint,
  onToggleSetMeetingPoint,
  tileStyle,
  onChangeTileStyle,
  onSelectMember,
  onAssignRoute,
  waypoints = [],
  onAddWaypoint,
  onRemoveWaypoint,
  userName = '',
  pinningWaypoint = null,
  onStartPinningWaypointOnMap,
  onCancelPinningWaypoint,
  onSetMeetingLocation,
  onLeaveGroup,
  isTripActive = false,
  onToggleTripActive,
  onClaimAdmin,
}) => {

  const [copiedLink, setCopiedLink] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSheetExpanded, setIsSheetExpanded] = useState(false);
  const [isLocateOpen, setIsLocateOpen] = useState(false);
  const [locateQuery, setLocateQuery] = useState('');
  const [isLocating, setIsLocating] = useState(false);
  const [showPinDropdown, setShowPinDropdown] = useState(false);

  // Apple Fluid Bottom Sheet (WWDC Direct Manipulation: 1:1 Pointer Tracking, 3 Detents, Momentum Projection)
  const mobileSheet = useFluidSheet({
    peekHeight: 76,
    initialDetent: 'peek',
  });
  const isMobileDrawerOpen = mobileSheet.detent !== 'peek';
  const setIsMobileDrawerOpen = (open: boolean) => mobileSheet.snapTo(open ? 'half' : 'peek');
  const [mobileActiveTab, setMobileActiveTab] = useState<'routes' | 'friends' | 'stops'>('routes');
  const [showMobileLayersSheet, setShowMobileLayersSheet] = useState(false);

  const currentUser = members.find((m) => m.id === currentUserId);

  const POPULAR_DESTINATIONS = [
    { name: 'Manali, Himachal Pradesh', icon: '🏔️', lat: 32.2432, lng: 77.1892 },
    { name: 'Shimla, Himachal Pradesh', icon: '⛰️', lat: 31.1048, lng: 77.1734 },
    { name: 'Mussoorie, Uttarakhand', icon: '🌲', lat: 30.4598, lng: 78.0644 },
    { name: 'Rishikesh, Uttarakhand', icon: '🧘', lat: 30.0869, lng: 78.2676 },
    { name: 'Leh Ladakh', icon: '❄️', lat: 34.1526, lng: 77.5771 },
    { name: 'Goa Beaches', icon: '🌊', lat: 15.2993, lng: 74.1240 },
    { name: 'Munnar, Kerala', icon: '🍃', lat: 10.0889, lng: 77.0595 },
    { name: 'Ooty, Tamil Nadu', icon: '🏞️', lat: 11.4102, lng: 76.6950 },
  ];

  const handleSearchAndSetDestination = (destinationName?: string) => {
    const query = destinationName || locateQuery;
    if (!query.trim()) return;

    setIsLocating(true);

    if ((window as any).google?.maps?.Geocoder) {
      const geocoder = new (window as any).google.maps.Geocoder();
      geocoder.geocode({ address: query }, (results: any, status: any) => {
        setIsLocating(false);
        if (status === 'OK' && results && results[0]) {
          const loc = results[0].geometry.location;
          const formatted = results[0].formatted_address.split(',').slice(0, 2).join(',');
          if (onSetMeetingLocation) {
            onSetMeetingLocation(loc.lat(), loc.lng(), `🎯 ${formatted}`);
          }
          window.dispatchEvent(
            new CustomEvent('wandersync:pan_to', { detail: { lat: loc.lat(), lng: loc.lng() } })
          );
          setIsLocateOpen(false);
          setLocateQuery('');
        } else {
          alert(`Could not find "${query}". Please check the spelling or try another place.`);
        }
      });
    } else {
      setIsLocating(false);
      alert('Google Maps is still loading. Please wait a moment.');
    }
  };

  const handleSelectPreset = (dest: typeof POPULAR_DESTINATIONS[0]) => {
    if (onSetMeetingLocation) {
      onSetMeetingLocation(dest.lat, dest.lng, `${dest.icon} ${dest.name}`);
    }
    window.dispatchEvent(
      new CustomEvent('wandersync:pan_to', { detail: { lat: dest.lat, lng: dest.lng } })
    );
    setIsLocateOpen(false);
  };

  // Generate shareable link
  const [showInviteModal, setShowInviteModal] = useState(false);
  const shareUrl = `${window.location.origin}${window.location.pathname}?trip=${tripName}`;

  const handleCopyLink = () => {
    try {
      if (navigator.clipboard) {
        navigator.clipboard.writeText(shareUrl);
      } else {
        const input = document.createElement('input');
        input.value = shareUrl;
        document.body.appendChild(input);
        input.select();
        document.execCommand('copy');
        document.body.removeChild(input);
      }
    } catch (e) {}
    setCopiedLink(true);
    setShowInviteModal(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handleWhatsAppShare = () => {
    const text = encodeURIComponent(
      `🚗 Join our live travel convoy "${tripName}" on WanderSync!\nTrack our positions in real-time on mountain roads:\n${shareUrl}`
    );
    window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank');
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Join my WanderSync Convoy (${tripName})`,
          text: `Track my live GPS location on the convoy map and navigate with our group!`,
          url: shareUrl,
        });
      } catch (e) {
        handleCopyLink();
      }
    } else {
      handleCopyLink();
    }
  };

  // Filter members by search
  const filteredMembers = members.filter((m) =>
    m.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <>
      {/* ================================================================= */}
      {/* MOBILE APP HEADER (Compact, 1-row, native app feel) */}
      {/* ================================================================= */}
      <header className="md:hidden absolute top-2 left-2 right-2 z-30 flex items-center justify-between gap-1.5 pointer-events-auto select-none">
        {/* Trip Code Pill (Tap to invite / view QR) */}
        <button
          type="button"
          onClick={() => setShowInviteModal(true)}
          className="apple-glass-pill px-3 py-2 rounded-full shadow-lg flex items-center gap-1.5 apple-pressable shrink-0"
          title="Trip code & invite link"
        >
          <span className="text-sm">🏔️</span>
          <span className="text-xs font-bold text-white apple-headline">{tripName}</span>
          <span className="w-1.5 h-1.5 rounded-full bg-[#34C759] animate-ping"></span>
        </button>

        {/* Search Capsule / Current Destination */}
        <div
          onClick={() => setIsLocateOpen(true)}
          className="flex-1 min-w-0 apple-glass-pill px-3.5 py-2 rounded-full shadow-lg flex items-center gap-2 cursor-pointer apple-pressable transition"
        >
          <Search className="w-3.5 h-3.5 text-blue-400 shrink-0" />
          <span className="text-xs font-semibold text-white truncate apple-body">
            {rendezvous ? rendezvous.title.replace('🎯 ', '') : 'Where to? Search...'}
          </span>
        </div>

        {/* Quick Action: Map Layers & Settings */}
        <button
          type="button"
          onClick={() => setShowMobileLayersSheet(true)}
          className="apple-glass-pill p-2 rounded-full shadow-lg text-slate-200 apple-pressable shrink-0"
          title="Map Style & Options"
        >
          <Layers className="w-4 h-4 text-blue-400" />
        </button>

        {/* Leader Tap Map to Set Destination button */}
        {isLeader && (
          <button
            type="button"
            onClick={onToggleSetMeetingPoint}
            className={`p-2 rounded-full shadow-lg apple-pressable shrink-0 transition ${
              isSettingMeetingPoint
                ? 'bg-[#FF9500] text-slate-950 border border-amber-300 ring-2 ring-amber-400'
                : 'apple-glass-pill text-[#FF9500]'
            }`}
            title={isSettingMeetingPoint ? 'Tap map to drop pin' : 'Drop destination pin on map'}
          >
            <MapPin className="w-4 h-4" />
          </button>
        )}
      </header>

      {/* ================================================================= */}
      {/* DESKTOP FLOATING BAR (Spacious multi-button header for md+ screens) */}
      {/* ================================================================= */}
      <header className="hidden md:flex absolute top-3 left-3 right-3 z-30 items-center justify-between gap-2 pointer-events-none">
        {/* Left: Trip Name & Share Link */}
        <div className="flex items-center gap-2 pointer-events-auto w-full md:w-auto justify-between md:justify-start">
          <div className="apple-glass-pill px-4 py-2.5 rounded-2xl flex items-center gap-2.5">
            <span className="text-xl">🏔️</span>
            <div>
              <h1 className="text-sm font-bold text-white tracking-tight apple-headline">
                {tripName}
              </h1>
              <p className="text-[11px] text-[#34C759] font-medium flex items-center gap-1.5 apple-caption apple-tabular">
                <span className="w-2 h-2 rounded-full bg-[#34C759] animate-ping"></span>
                {members.length} Friends on Map
              </p>
            </div>
          </div>

          {/* Big Share Link Button */}
          <button
            onClick={handleCopyLink}
            className="bg-[#34C759] hover:bg-[#2fb350] text-white font-semibold text-xs px-4 py-2.5 rounded-2xl shadow-lg shadow-emerald-500/20 flex items-center gap-2 border-t border-white/30 apple-pressable"
          >
            {copiedLink ? (
              <>
                <Check className="w-4 h-4 text-emerald-100" />
                <span>Link Copied! Send to Friends</span>
              </>
            ) : (
              <>
                <Share2 className="w-4 h-4" />
                <span>Invite Friends (Copy Link)</span>
              </>
            )}
          </button>

          {/* Leave or Switch Group Button */}
          {onLeaveGroup && (
            <button
              onClick={() => {
                if (window.confirm(`Leave trip "${tripName}"? You can create a new group or join another friend's squad.`)) {
                  onLeaveGroup();
                }
              }}
              className="bg-slate-900/90 hover:bg-slate-800 text-slate-400 hover:text-red-400 p-2.5 rounded-2xl shadow-xl border border-slate-700/80 transition flex items-center gap-1 text-xs"
              title="Leave this group / Switch to another trip"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Switch Trip</span>
            </button>
          )}
        </div>

        {/* Right: Map Style (Mountains vs Roads) & Meeting Point */}
        <div className="flex items-center gap-2 pointer-events-auto self-end md:self-auto">
          {/* Map Layer Switcher with simple icons */}
          <div className="bg-slate-900/90 backdrop-blur-md p-1 rounded-2xl border border-slate-700/80 shadow-xl flex items-center gap-1 text-xs">
            <button
              onClick={() => onChangeTileStyle('v2v')}
              className={`px-3 py-1.5 rounded-xl font-bold transition flex items-center gap-1 ${
                tileStyle === 'v2v'
                  ? 'bg-amber-500 text-slate-950 shadow-[0_0_12px_rgba(245,158,11,0.6)]'
                  : 'text-amber-400 hover:text-amber-300'
              }`}
              title="V2V Dark Cockpit Navigation with Laser Trajectory"
            >
              <span>⚡ V2V Noir</span>
            </button>
            <button
              onClick={() => onChangeTileStyle('terrain')}
              className={`px-3 py-1.5 rounded-xl font-bold transition flex items-center gap-1 ${
                tileStyle === 'terrain'
                  ? 'bg-emerald-600 text-white shadow'
                  : 'text-slate-300 hover:text-white'
              }`}
              title="Show real mountains, elevations and trails"
            >
              <span>🏔️ Mountains</span>
            </button>
            <button
              onClick={() => onChangeTileStyle('satellite')}
              className={`px-3 py-1.5 rounded-xl font-bold transition flex items-center gap-1 ${
                tileStyle === 'satellite'
                  ? 'bg-emerald-600 text-white shadow'
                  : 'text-slate-300 hover:text-white'
              }`}
              title="Real satellite view from space"
            >
              <span>🛰️ Satellite</span>
            </button>
            <button
              onClick={() => onChangeTileStyle('streets')}
              className={`px-3 py-1.5 rounded-xl font-bold transition flex items-center gap-1 ${
                tileStyle === 'streets'
                  ? 'bg-emerald-600 text-white shadow'
                  : 'text-slate-300 hover:text-white'
              }`}
              title="Clean road view"
            >
              <span>🗺️ Roads</span>
            </button>
          </div>

          {/* Start Trip / Drive Mode Button */}
          {onToggleTripActive && (
            <button
              onClick={onToggleTripActive}
              className={`px-3.5 py-2.5 rounded-2xl font-black text-xs shadow-2xl transition active:scale-95 flex items-center gap-1.5 border ${
                isTripActive
                  ? 'bg-red-600 hover:bg-red-500 text-white border-red-400 shadow-[0_0_16px_rgba(239,68,68,0.7)]'
                  : 'bg-gradient-to-r from-amber-500 via-orange-500 to-red-600 hover:from-amber-400 hover:to-red-500 text-slate-950 border-amber-300 shadow-[0_0_20px_rgba(245,158,11,0.6)] animate-pulse'
              }`}
              title={isTripActive ? 'Exit 3D Drive Mode' : 'Start Trip in V2V 3D Cockpit'}
            >
              <span className="text-sm">{isTripActive ? '🛑' : '🚀'}</span>
              <span>{isTripActive ? 'Exit Drive' : 'Start Trip'}</span>
            </button>
          )}


          {/* Universal Search Destination Button */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setIsLocateOpen(!isLocateOpen)}
              className={`px-3.5 py-2.5 rounded-2xl font-black text-xs shadow-xl transition flex items-center gap-1.5 border cursor-pointer active:scale-95 ${
                isLocateOpen
                  ? 'bg-blue-600 text-white border-blue-400 ring-2 ring-blue-400/50'
                  : 'bg-blue-600 hover:bg-blue-500 text-white border-blue-400 shadow-[0_0_15px_rgba(37,99,235,0.4)]'
              }`}
              title="Search city, town, airport or mountain destination on Google Maps"
            >
              <Search className="w-4 h-4 text-white" />
              <span>Search Destination</span>
            </button>

            {isLeader && (
              <button
                type="button"
                onClick={onToggleSetMeetingPoint}
                className={`px-3 py-2.5 rounded-2xl font-bold text-xs shadow-xl transition flex items-center gap-1.5 border cursor-pointer ${
                  isSettingMeetingPoint
                    ? 'bg-amber-500 text-slate-950 border-amber-300 ring-2 ring-amber-400 animate-pulse'
                    : 'bg-slate-900/90 hover:bg-slate-800 text-amber-300 border-amber-500/40'
                }`}
                title="Tap map to place meeting pin"
              >
                <MapPin className="w-4 h-4 text-amber-400" />
                <span>{isSettingMeetingPoint ? 'Tap Map' : 'Set on Map'}</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Locate Destination Modal */}
      {isLocateOpen && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-40 max-w-md w-[92%] pointer-events-auto animate-fade-in">
          <div className="bg-slate-900/95 backdrop-blur-2xl border-2 border-blue-500/50 rounded-3xl p-5 shadow-[0_20px_60px_rgba(0,0,0,0.9)] text-white">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-blue-500/20 border border-blue-400/40 flex items-center justify-center text-lg">
                  🎯
                </div>
                <div>
                  <h3 className="text-[10px] font-black uppercase tracking-wider text-blue-400">
                    {isLeader ? '👑 Trip Admin Destination Control' : '🎯 Search Destination'}
                  </h3>
                  <p className="text-sm font-extrabold text-white">Where do you want to go?</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsLocateOpen(false)}
                className="text-slate-400 hover:text-white p-1.5 rounded-xl hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-300 mb-3">
              {isLeader
                ? 'Type any location on Google Maps. When you select it, all friends in your squad will immediately get optimal directions and synchronized routes.'
                : 'Search any city, town, or landmark to set or change where the squad is going.'}
            </p>

            {/* Live Google Maps Autocomplete Search */}
            <div className="mb-3">
              <GooglePlaceSearchInput
                autoFocus
                placeholder="Search Google Maps (e.g. Manali, Gangarampur, Connaught Place)..."
                onSelectPlace={(place) => {
                  if (onSetMeetingLocation) {
                    onSetMeetingLocation(place.lat, place.lng, `🎯 ${place.formattedAddress || place.name}`);
                  }
                  window.dispatchEvent(
                    new CustomEvent('wandersync:pan_to', { detail: { lat: place.lat, lng: place.lng } })
                  );
                  setIsLocateOpen(false);
                }}
              />
            </div>

            {/* Quick 1-Tap Popular Mountain & Travel Destinations */}
            <div>
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                <span>Quick Popular Trips (1-Tap):</span>
                <span className="text-[9px] text-blue-400">Instant Directions</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                {POPULAR_DESTINATIONS.map((dest) => (
                  <button
                    key={dest.name}
                    type="button"
                    onClick={() => {
                      handleSelectPreset(dest);
                      setIsLocateOpen(false);
                    }}
                    className="px-2 py-1.5 rounded-xl bg-slate-800/80 hover:bg-blue-600/30 border border-slate-700 hover:border-blue-500/60 text-[11px] font-semibold text-slate-200 flex items-center gap-1.5 transition text-left cursor-pointer"
                  >
                    <span>{dest.icon}</span>
                    <span className="truncate">{dest.name.split(',')[0]}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Bottom Tip / Claim admin */}
            {!isLeader && onClaimAdmin && (
              <div className="mt-3 pt-2.5 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
                <span>Need to lead this convoy?</span>
                <button
                  type="button"
                  onClick={() => {
                    onClaimAdmin();
                    setIsLocateOpen(false);
                  }}
                  className="text-amber-400 font-bold hover:underline cursor-pointer"
                >
                  👑 Claim Trip Admin
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Top Destination / Search Bar (Prominent on Desktop) */}
      <div className="hidden md:block absolute top-20 left-1/2 -translate-x-1/2 z-20 pointer-events-auto max-w-lg w-[85%]">
        {rendezvous ? (
          <div className="bg-slate-900/95 backdrop-blur-xl px-4 py-2.5 rounded-2xl border border-amber-500/50 shadow-2xl flex items-center justify-between gap-3 text-xs">
            <div
              onClick={() => {
                window.dispatchEvent(
                  new CustomEvent('wandersync:pan_to', {
                    detail: { lat: rendezvous.lat, lng: rendezvous.lng },
                  })
                );
              }}
              className="flex items-center gap-2.5 min-w-0 cursor-pointer hover:opacity-90"
              title="Click to view destination on map"
            >
              <span className="text-2xl shrink-0">📍</span>
              <div className="min-w-0">
                <div className="text-[10px] text-amber-400 font-black uppercase tracking-wider flex items-center gap-1.5">
                  <span>Where everyone is going</span>
                  {isLeader ? (
                    <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 font-bold border border-amber-400/30">
                      👑 Set by You (Admin)
                    </span>
                  ) : (
                    <span className="text-[9px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-300 border border-slate-700 font-medium">
                      👑 Admin: {rendezvous.setBy || 'Leader'}
                    </span>
                  )}
                </div>
                <div className="font-extrabold text-white text-sm truncate">
                  {rendezvous.title}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => setIsLocateOpen(true)}
                className="text-[11px] font-black bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-xl border border-blue-400 shadow transition flex items-center gap-1 cursor-pointer active:scale-95"
                title="Search or change destination"
              >
                <Search className="w-3.5 h-3.5" />
                <span>{isLeader ? 'Change' : 'Search Places'}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  window.dispatchEvent(
                    new CustomEvent('wandersync:pan_to', {
                      detail: { lat: rendezvous.lat, lng: rendezvous.lng },
                    })
                  );
                }}
                className="shrink-0 text-[11px] font-bold bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 px-2.5 py-1.5 rounded-xl border border-amber-500/40 transition cursor-pointer"
              >
                See on Map
              </button>
            </div>
          </div>
        ) : (
          <div
            onClick={() => setIsLocateOpen(true)}
            className="bg-slate-900/95 backdrop-blur-xl px-4 py-3 rounded-2xl border-2 border-blue-500/70 hover:border-blue-400 shadow-[0_12px_40px_rgba(0,0,0,0.85)] flex items-center justify-between gap-3 cursor-pointer transition active:scale-[0.99] group animate-pulse"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-blue-600/30 border border-blue-500/50 flex items-center justify-center text-blue-400 group-hover:scale-105 transition shrink-0">
                <Search className="w-5 h-5" />
              </div>
              <div className="min-w-0 text-left">
                <div className="text-[10px] text-blue-400 font-black uppercase tracking-wider flex items-center gap-1.5">
                  <span>{isLeader ? '👑 Trip Admin Search' : '🎯 Destination Needed'}</span>
                  <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30">
                    {isLeader ? 'Set Destination for Squad' : 'Tap to Search'}
                  </span>
                </div>
                <div className="font-extrabold text-white text-sm truncate">
                  Where do you want to go? Search place...
                </div>
              </div>
            </div>
            <button
              type="button"
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-black text-xs shrink-0 flex items-center gap-1.5 shadow-lg shadow-blue-600/30 border border-blue-400/40 cursor-pointer"
            >
              <Search className="w-3.5 h-3.5" />
              <span>Search</span>
            </button>
          </div>
        )}
      </div>

      {/* Bottom Simplified Travel Control Card (Desktop Sidebar) */}
      {!isTripActive && (
        <div className="hidden md:block absolute bottom-3 right-4 w-96 z-30">
        <div className="bg-slate-900/95 backdrop-blur-xl rounded-3xl border border-slate-700/80 shadow-2xl overflow-hidden transition-all duration-300">
          {/* Header Card: Big Location Sharing Switch */}
          <div className="p-4 bg-gradient-to-b from-slate-800/80 to-slate-900/90 border-b border-slate-800">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div
                  className={`w-10 h-10 rounded-2xl flex items-center justify-center text-xl shadow-md transition ${
                    isSharingLocation ? 'bg-emerald-500 text-white' : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  <Navigation className={`w-5 h-5 ${isSharingLocation ? 'animate-pulse' : ''}`} />
                </div>
                <div>
                  <div className="text-xs font-bold text-white">
                    {isSharingLocation ? 'Live Location is ON' : 'Location is Paused'}
                  </div>
                  <div className="text-[11px] text-slate-400">
                    {isSharingLocation ? 'Friends can see your movement' : 'Tap switch to share with friends'}
                  </div>
                </div>
              </div>

              {/* Big On/Off Toggle */}
              <button
                onClick={onToggleLocationSharing}
                className={`relative inline-flex h-7 w-14 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  isSharingLocation ? 'bg-emerald-500' : 'bg-slate-700'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                    isSharingLocation ? 'translate-x-7' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Real GPS Telemetry Display */}
            {currentUser?.location && (
              <div className="mt-2.5 py-1 px-2.5 rounded-xl bg-slate-900/90 border border-slate-700/80 text-[10px] text-slate-300 flex items-center justify-between font-mono">
                <span className="flex items-center gap-1 text-emerald-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                  GPS: {currentUser.location.lat.toFixed(4)}, {currentUser.location.lng.toFixed(4)}
                </span>
                <span className="text-slate-400">
                  Acc: ±{currentUser.location.accuracy || 10}m
                </span>
              </div>
            )}

            {/* Start Trip Action Button */}
            {onToggleTripActive && (
              <div className="mt-3">
                <button
                  onClick={onToggleTripActive}
                  className="w-full py-3.5 px-4 rounded-2xl font-black text-xs shadow-2xl flex items-center justify-center gap-2.5 transition active:scale-95 bg-gradient-to-r from-amber-500 via-orange-500 to-red-600 hover:from-amber-400 hover:to-red-500 text-slate-950 border border-amber-300 shadow-[0_0_25px_rgba(245,158,11,0.6)] cursor-pointer"
                >
                  <span className="text-base">🚀</span>
                  <span>START CONVOY TRIP (COUNTDOWN 1-4)</span>
                </button>
              </div>
            )}

            {/* Dedicated Trip Destination & Search Card in Sidebar */}
            <div className="mt-3.5 p-3 rounded-2xl bg-slate-900/90 border border-blue-500/40 shadow-xl space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-black uppercase text-blue-400 tracking-wider flex items-center gap-1.5">
                  <span>🎯</span>
                  <span>Trip Destination</span>
                </span>
                {isLeader ? (
                  <span className="text-[9px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-black border border-amber-500/40">
                    👑 Admin (You)
                  </span>
                ) : (
                  <div className="flex items-center gap-1">
                    <span className="text-[9px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 font-bold">
                      Admin: {rendezvous?.setBy || members.find((m) => m.isLeader)?.name || 'Leader'}
                    </span>
                    {onClaimAdmin && (
                      <button
                        type="button"
                        onClick={onClaimAdmin}
                        className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 border border-amber-500/40 font-bold cursor-pointer"
                        title="Claim trip leadership"
                      >
                        Lead
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Destination Display */}
              <div className="p-2.5 rounded-xl bg-slate-800/80 border border-slate-700/60 flex items-center gap-2.5">
                <span className="text-xl shrink-0">{rendezvous ? '📍' : '🔍'}</span>
                <div className="min-w-0 flex-1">
                  <div className="text-[10px] text-slate-400 font-medium">
                    {rendezvous ? 'Current Destination' : 'No destination selected'}
                  </div>
                  <div className="text-xs font-bold text-white truncate">
                    {rendezvous ? rendezvous.title : 'Choose where the squad will ride'}
                  </div>
                </div>
              </div>

              {/* Prominent Search Destination Button */}
              <button
                type="button"
                onClick={() => setIsLocateOpen(true)}
                className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-black text-xs flex items-center justify-center gap-2 shadow-lg shadow-blue-600/30 border border-blue-400/50 transition active:scale-95 cursor-pointer"
              >
                <Search className="w-4 h-4" />
                <span>{rendezvous ? 'Search & Change Destination' : 'Search Where You Want To Go'}</span>
              </button>

              {/* Set Directly on Map Button */}
              <button
                type="button"
                onClick={onToggleSetMeetingPoint}
                className={`w-full py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer ${
                  isSettingMeetingPoint
                    ? 'bg-amber-500 text-slate-950 border-amber-300 ring-2 ring-amber-400 font-black animate-pulse'
                    : 'bg-slate-800/60 hover:bg-slate-800 text-amber-300 border-amber-500/30'
                }`}
              >
                <MapPin className="w-4 h-4 text-amber-400" />
                <span>{isSettingMeetingPoint ? 'Tap Anywhere on Map to Drop Pin' : 'Or Tap Directly on Map'}</span>
              </button>
            </div>

            {/* Simple Routes Overview (How much time each route takes) */}
            <div className="mt-3.5 pt-3 border-t border-slate-800">
              {(() => {
                const myRoutes = routes.filter((r) => !r.forUserId || r.forUserId === currentUserId);
                const otherFriends = members.filter((m) => m.id !== currentUserId);

                return (
                  <div className="space-y-3">
                    {/* 1. User's Own Route Choices */}
                    <div>
                      <div className="text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-2 flex items-center justify-between">
                        <span>🛣️ Your Route Options</span>
                        <span className="text-[10px] text-cyan-400 font-normal">Tap to choose</span>
                      </div>
                      <div className="space-y-2">
                        {myRoutes.map((route, idx) => {
                          const isMyActive = currentUser?.assignedRouteId
                            ? currentUser.assignedRouteId === route.id
                            : idx === 0;

                          return (
                            <div
                              key={route.id}
                              onClick={() => onAssignRoute(currentUserId, route.id)}
                              className={`p-2.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-2 ${
                                isMyActive
                                  ? 'bg-cyan-950/40 border-cyan-400 shadow-md shadow-cyan-950/40 text-white'
                                  : 'bg-slate-800/50 border-slate-700/60 hover:bg-slate-800 text-slate-300'
                              }`}
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <span
                                  className="w-3 h-3 rounded-full shrink-0"
                                  style={{
                                    backgroundColor: isMyActive ? '#00f0ff' : '#64748b',
                                    boxShadow: isMyActive ? '0 0 8px #00f0ff' : 'none',
                                  }}
                                />
                                <div className="min-w-0">
                                  <div className="text-xs font-bold truncate flex items-center gap-1.5">
                                    <span>{route.name}</span>
                                    {isMyActive && (
                                      <span className="text-[9px] px-1.5 py-0.2 rounded bg-cyan-500/30 text-cyan-300 font-semibold border border-cyan-400/40 shrink-0">
                                        Your Route
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-[11px] text-slate-400 mt-0.5">
                                    {route.tag || (idx === 0 ? 'Fastest Highway' : 'Alternative')}
                                  </div>
                                </div>
                              </div>

                              <div className="text-right shrink-0">
                                <div className={`text-xs font-bold font-mono ${isMyActive ? 'text-cyan-300' : 'text-slate-300'}`}>
                                  ~{route.durationMins} mins
                                </div>
                                <div className="text-[10px] text-slate-400 font-mono">
                                  {route.distanceKm} km
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* 2. Squad Friends' Routes (Strictly 1 Chosen Route Per Friend with Distinct Colors) */}
                    {otherFriends.length > 0 && (
                      <div className="pt-2 border-t border-slate-800/80">
                        <div className="text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-2 flex items-center justify-between">
                          <span>👥 Squad Routes ({otherFriends.length})</span>
                          <span className="text-[10px] text-slate-400 font-normal">1 route per friend</span>
                        </div>
                        <div className="space-y-2">
                          {otherFriends.map((friend, fIdx) => {
                            const friendColor =
                              friend.color && friend.color !== '#00f0ff' && friend.color !== '#3b82f6'
                                ? friend.color
                                : SQUAD_FRIEND_PALETTE[fIdx % SQUAD_FRIEND_PALETTE.length];

                            // All routes for this friend
                            const friendRoutes = routes.filter((r) => r.forUserId === friend.id);
                            // Single chosen route for this friend
                            const chosenRoute = friend.assignedRouteId
                              ? friendRoutes.find((r) => r.id === friend.assignedRouteId) || routes.find((r) => r.id === friend.assignedRouteId) || friendRoutes[0]
                              : friendRoutes[0];

                            return (
                              <div
                                key={friend.id}
                                className="p-2.5 rounded-2xl bg-slate-800/40 border border-slate-700/60 transition-all space-y-2"
                                style={{ borderColor: `${friendColor}40` }}
                              >
                                {/* Header: Friend Avatar, Name, and Chosen Route */}
                                <div className="flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-2 min-w-0">
                                    <div
                                      className="w-7 h-7 rounded-full flex items-center justify-center text-sm shrink-0 border"
                                      style={{ backgroundColor: `${friendColor}20`, borderColor: friendColor }}
                                    >
                                      {friend.avatar || '🎒'}
                                    </div>
                                    <div className="min-w-0">
                                      <div className="flex items-center gap-1.5">
                                        <span className="font-bold text-xs text-white truncate max-w-[120px]">
                                          {friend.name}
                                        </span>
                                        <span
                                          className="w-2.5 h-2.5 rounded-full shrink-0"
                                          style={{ backgroundColor: friendColor, boxShadow: `0 0 6px ${friendColor}` }}
                                          title={`Route color: ${friendColor}`}
                                        />
                                      </div>
                                      <div className="text-[11px] text-slate-300 truncate">
                                        {chosenRoute?.name || 'Assigned Route'}
                                      </div>
                                    </div>
                                  </div>

                                  <div className="text-right shrink-0">
                                    {chosenRoute ? (
                                      <>
                                        <div className="text-xs font-bold font-mono" style={{ color: friendColor }}>
                                          ~{chosenRoute.durationMins} mins
                                        </div>
                                        <div className="text-[10px] text-slate-400 font-mono">
                                          {chosenRoute.distanceKm} km
                                        </div>
                                      </>
                                    ) : (
                                      <span className="text-[10px] text-slate-500 italic">Calculating...</span>
                                    )}
                                  </div>
                                </div>

                                {/* Alternate Route Selection Pill for this Friend */}
                                {friendRoutes.length > 1 && (
                                  <div className="pt-1.5 border-t border-slate-700/40 flex items-center justify-between gap-2">
                                    <span className="text-[10px] text-slate-400">Select route:</span>
                                    <div className="flex items-center gap-1">
                                      {friendRoutes.map((altR, rIdx) => {
                                        const isSelected = chosenRoute?.id === altR.id;
                                        return (
                                          <button
                                            key={altR.id}
                                            type="button"
                                            onClick={() => onAssignRoute(friend.id, altR.id)}
                                            className={`px-2 py-0.5 rounded-lg text-[10px] font-bold transition cursor-pointer ${
                                              isSelected
                                                ? 'text-white shadow-sm'
                                                : 'bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-700'
                                            }`}
                                            style={{
                                              backgroundColor: isSelected ? friendColor : undefined,
                                            }}
                                            title={`${altR.name} (~${altR.durationMins}m, ${altR.distanceKm}km)`}
                                          >
                                            Route {rIdx + 1}
                                          </button>
                                        );
                                      })}
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          </div>

          {/* Road Markers & Waypoints */}
          <div className="px-4 pb-3 pt-2 border-t border-slate-800">
            <div className="text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-2 flex items-center justify-between">
              <span>🚧 Road Markers & Stops</span>
              <span className="text-[10px] text-slate-500 font-normal">{waypoints.length} active</span>
            </div>

            {/* Quick Actions Header: Drop here or Pin Ahead on Road */}
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="text-[10px] text-slate-400">1-Tap report at your spot:</span>
              <button
                type="button"
                onClick={() => setShowPinDropdown(!showPinDropdown)}
                className={`px-2.5 py-1 rounded-xl border text-[10px] font-bold flex items-center gap-1 transition ${
                  showPinDropdown
                    ? 'bg-rose-600 text-white border-rose-400'
                    : 'bg-rose-500/15 hover:bg-rose-500/25 border-rose-500/40 text-rose-300'
                }`}
                title="Tap a bend or spot ahead on map to mark sharp turn or hazard"
              >
                <span>📍 Pin ahead on map</span>
              </button>
            </div>

            {/* Dropdown for Pinning Ahead on Map */}
            {showPinDropdown && (
              <div className="mb-2 p-2 rounded-2xl bg-slate-800 border border-rose-500/40 space-y-1.5">
                <div className="text-[10px] text-rose-300 font-bold">
                  Tap what problem / stop is on the road ahead:
                </div>
                <div className="grid grid-cols-2 gap-1">
                  {[
                    { type: 'sharp-turn', icon: '↩️', label: 'Sharp Turn' },
                    { type: 'road-problem', icon: '🚧', label: 'Bad Road' },
                    { type: 'hazard', icon: '⚠️', label: 'Road Hazard' },
                    { type: 'fuel', icon: '⛽', label: 'Fuel Ahead' },
                    { type: 'rest', icon: '☕', label: 'Rest Stop' },
                    { type: 'scenic', icon: '📸', label: 'Scenic View' },
                  ].map((p) => (
                    <button
                      key={p.type}
                      type="button"
                      onClick={() => {
                        if (onStartPinningWaypointOnMap) {
                          onStartPinningWaypointOnMap(p.type, p.label);
                          setShowPinDropdown(false);
                        }
                      }}
                      className="px-2 py-1.5 rounded-xl bg-slate-700/80 hover:bg-rose-600/30 border border-slate-600 hover:border-rose-500 text-left text-[10px] font-semibold text-white flex items-center gap-1.5 transition"
                    >
                      <span>{p.icon}</span>
                      <span>{p.label}</span>
                    </button>
                  ))}
                </div>
                <div className="text-[9px] text-slate-400">
                  After choosing, tap the road on the map to drop the marker.
                </div>
              </div>
            )}
            
            {/* Quick-add buttons for dropping a marker at your current location */}
            <div className="flex flex-wrap gap-1.5 mb-2">
              {[
                { type: 'fuel', icon: '⛽', label: 'Fuel Stop' },
                { type: 'rest', icon: '☕', label: 'Rest Area' },
                { type: 'food', icon: '🍕', label: 'Food Stop' },
                { type: 'hazard', icon: '⚠️', label: 'Hazard' },
                { type: 'sharp-turn', icon: '↩️', label: 'Sharp Turn' },
                { type: 'scenic', icon: '📸', label: 'Scenic Spot' },
                { type: 'road-problem', icon: '🚧', label: 'Bad Road' },
                { type: 'checkpoint', icon: '🏁', label: 'Checkpoint' },
              ].map((wp) => (
                <button
                  key={wp.type}
                  onClick={() => {
                    if (currentUser?.location && onAddWaypoint) {
                      onAddWaypoint(currentUser.location.lat, currentUser.location.lng, wp.type, wp.label);
                    }
                  }}
                  className="px-2 py-1 rounded-lg bg-slate-800/70 hover:bg-slate-700 border border-slate-700/60 text-[10px] font-semibold text-slate-300 flex items-center gap-1 transition active:scale-95"
                  title={`Drop a ${wp.label} marker at your location`}
                >
                  <span>{wp.icon}</span>
                  <span>{wp.label}</span>
                </button>
              ))}
            </div>
            
            {/* Active waypoints list */}
            {waypoints.length > 0 && (
              <div className="space-y-1 max-h-28 overflow-y-auto">
                {waypoints.map((wp) => {
                  const wpIcon = ({ fuel: '⛽', rest: '☕', food: '🍕', hazard: '⚠️', 'sharp-turn': '↩️', scenic: '📸', 'road-problem': '🚧', checkpoint: '🏁' } as Record<string, string>)[wp.type] || '📍';
                  const canRemove = wp.addedBy === currentUserId;
                  const dist = currentUser?.location
                    ? calculateDistanceKm(currentUser.location.lat, currentUser.location.lng, wp.lat, wp.lng).toFixed(1)
                    : null;
                  return (
                    <div
                      key={wp.id}
                      className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-xl bg-slate-800/40 border border-slate-700/40 text-[10px]"
                    >
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="text-sm">{wpIcon}</span>
                        <span className="font-semibold text-white truncate">{wp.label}</span>
                        {dist && <span className="text-slate-400">• {dist} km</span>}
                        <span className="text-slate-500">by {wp.addedByName || 'member'}</span>
                      </div>
                      {canRemove && onRemoveWaypoint && (
                        <button
                          onClick={(e) => { e.stopPropagation(); onRemoveWaypoint(wp.id); }}
                          className="text-red-400 hover:text-red-300 p-0.5 rounded transition"
                          title="Remove marker"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Friends Drawer Toggle */}
          <div
            onClick={() => setIsSheetExpanded(!isSheetExpanded)}
            className="w-full py-2.5 px-4 bg-slate-800/60 hover:bg-slate-800 text-slate-300 text-xs font-bold flex items-center justify-between transition border-t border-slate-800 cursor-pointer select-none"
          >
            <span className="flex items-center gap-2">
              <Users className="w-4 h-4 text-emerald-400" />
              <span>Where are my friends? ({members.length})</span>
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  window.dispatchEvent(new CustomEvent('wandersync:fit_all'));
                }}
                className="px-2 py-0.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-[10px] font-bold transition active:scale-95"
                title="Fit all squad members on screen"
              >
                Fit All
              </button>
              {isSheetExpanded ? (
                <ChevronDown className="w-4 h-4 text-slate-400" />
              ) : (
                <ChevronUp className="w-4 h-4 text-slate-400" />
              )}
            </div>
          </div>

          {/* Expandable Simple Friends List with Search */}
          {isSheetExpanded && (
            <div className="p-3 max-h-60 overflow-y-auto space-y-2 bg-slate-900">
              {/* Search Box */}
              <div className="relative mb-2">
                <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-500" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Find a friend by name..."
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 outline-none focus:border-emerald-500 transition"
                />
              </div>

              {/* Friends list */}
              {filteredMembers.length <= 1 ? (
                <div className="p-3 text-center rounded-2xl bg-slate-800/50 border border-slate-700/60">
                  <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-sm mx-auto mb-1.5 font-bold">
                    🔒
                  </div>
                  <div className="text-xs font-bold text-white mb-0.5">
                    Only your group members appear here
                  </div>
                  <div className="text-[10px] text-slate-400 leading-relaxed mb-2">
                    No bots or demo data. Share this code with your friend: <strong className="text-emerald-400">{tripName}</strong>
                  </div>
                  <button
                    onClick={handleCopyLink}
                    className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] shadow inline-flex items-center gap-1.5 transition active:scale-95"
                  >
                    <Share2 className="w-3 h-3" />
                    <span>Copy Link for Friends</span>
                  </button>
                </div>
              ) : (
                filteredMembers.map((member) => {
                  const isMe = member.id === currentUserId;
                  const isLocating = !member.location || member.status === 'locating';
                  const accuracy = member.location?.accuracy || 0;
                  const dist =
                    !isMe && currentUser?.location && member.location
                      ? calculateDistanceKm(
                          currentUser.location.lat,
                          currentUser.location.lng,
                          member.location.lat,
                          member.location.lng
                        ).toFixed(1)
                      : null;

                  let distText = '';
                  if (dist != null) {
                    const numDist = parseFloat(dist);
                    if (numDist < 0.05) {
                      distText = 'Nearby (< 50m)';
                    } else {
                      distText = `${dist} km away`;
                    }
                  }

                  return (
                    <div
                      key={member.id}
                      onClick={() => onSelectMember(member.id)}
                      className="p-2.5 rounded-2xl bg-slate-800/40 hover:bg-slate-800 border border-slate-700/60 transition cursor-pointer flex items-center justify-between gap-2"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center text-base shrink-0 shadow relative"
                          style={{ border: `2px solid ${member.color}`, backgroundColor: `${member.color}20` }}
                        >
                          {member.avatar}
                          {isLocating && (
                            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-amber-400 rounded-full animate-ping"></span>
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-white truncate flex items-center gap-1">
                            {member.name}
                            {isMe && <span className="text-[9px] text-blue-400">(You)</span>}
                          </div>
                          <div className="text-[10px] text-slate-400 truncate flex items-center gap-1">
                            {isLocating ? (
                              <span className="text-amber-400 font-semibold flex items-center gap-1">
                                <span>⏳</span> Locating GPS...
                              </span>
                            ) : (
                              <>
                                {distText ? <span>{distText} • </span> : null}
                                <span>{Math.round(member.location?.speed || 0)} km/h</span>
                                {accuracy > 0 && (
                                  <span className="text-slate-500 text-[9px]">• ±{accuracy}m</span>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      {member.location ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectMember(member.id);
                          }}
                          className="text-[11px] font-bold text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 px-2.5 py-1 rounded-xl border border-emerald-500/30 transition shrink-0 active:scale-95"
                        >
                          Find
                        </button>
                      ) : (
                        <span className="text-[10px] text-amber-400/80 px-2 py-0.5 rounded-lg bg-amber-500/10 border border-amber-500/20 shrink-0">
                          Waiting...
                        </span>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      </div>
      )}

      {/* ================================================================= */}
      {/* MOBILE BOTTOM SHEET (Native App Style Drawer) */}
      {/* ================================================================= */}
      {!isTripActive && (
        <div
          ref={mobileSheet.sheetRef}
          style={{
            height: `${mobileSheet.currentHeight}px`,
            transition: mobileSheet.isDragging ? 'none' : 'height 380ms cubic-bezier(0.2, 0.8, 0.4, 1)',
            willChange: 'height',
          }}
          className="md:hidden fixed bottom-0 left-0 right-0 z-30 pointer-events-auto select-none apple-glass-sheet rounded-t-[32px] flex flex-col overflow-hidden shadow-[0_-16px_48px_rgba(0,0,0,0.75)]"
        >
          {/* Apple Specular Bevel Top Handle & Peek Header */}
          <div
            {...mobileSheet.handlers}
            className="touch-none cursor-grab active:cursor-grabbing px-4 pt-2.5 pb-2.5 shrink-0 border-b border-white/[0.08]"
            onClick={() => {
              if (!mobileSheet.isDragging) {
                mobileSheet.snapTo(mobileSheet.detent === 'peek' ? 'half' : 'peek');
              }
            }}
          >
            {/* Specular Light-Catching Drag Handle Pill */}
            <div className="w-10 h-1.5 bg-white/35 hover:bg-white/50 rounded-full mx-auto mb-2 transition-colors shadow-[0_1px_2px_rgba(0,0,0,0.4)]" />

            {/* Compact Peek Bar when drawer is collapsed */}
            {!isMobileDrawerOpen && (
              <div className="flex items-center justify-between gap-2">
                {/* Left: Location Sharing Toggle */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleLocationSharing();
                  }}
                  className={`flex items-center justify-center w-9 h-9 rounded-full border apple-pressable transition ${
                    isSharingLocation
                      ? 'bg-[#34C759]/20 border-[#34C759]/40'
                      : 'bg-white/10 border-white/15'
                  }`}
                  title={isSharingLocation ? 'GPS Live' : 'GPS Off'}
                >
                  <span
                    className={`w-2.5 h-2.5 rounded-full ${
                      isSharingLocation ? 'bg-[#34C759] shadow-[0_0_8px_#34C759] animate-pulse' : 'bg-slate-500'
                    }`}
                  />
                </button>

                {/* Center: Destination / Status summary */}
                <div className="min-w-0 flex-1 text-center px-1">
                  <div className="text-xs font-bold text-white truncate apple-headline">
                    {rendezvous ? rendezvous.title.replace('🎯 ', '') : 'Set destination'}
                  </div>
                </div>

                {/* Right: Expand Drawer Button */}
                <button
                  type="button"
                  onClick={() => mobileSheet.snapTo('half')}
                  className="w-9 h-9 rounded-full bg-white/10 text-white flex items-center justify-center border border-white/15 apple-pressable"
                  title="Open routes & squad"
                >
                  <ChevronUp className="w-4 h-4 text-blue-400" />
                </button>
              </div>
            )}

            {/* Drawer Header when expanded */}
            {isMobileDrawerOpen && (
              <div className="flex items-center justify-between pb-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm">📡</span>
                  <span className="text-[10px] text-[#34C759] font-bold bg-[#34C759]/20 px-2 py-0.5 rounded-full apple-tabular">
                    {members.length}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    mobileSheet.snapTo('peek');
                  }}
                  className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 text-slate-400 hover:text-white apple-pressable"
                  title="Collapse"
                >
                  <ChevronDown className="w-4.5 h-4.5" />
                </button>
              </div>
            )}
          </div>

          {/* Expanded Content Drawer */}
          {isMobileDrawerOpen && (
            <div className="flex-1 overflow-y-auto px-4 pb-8 space-y-3 apple-scroll-fade-top">
              {/* 3 Native Segmented Tabs: Routes | Squad | Road Stops */}
              <div className="apple-segmented-track mb-3">
                <button
                  type="button"
                  onClick={() => setMobileActiveTab('routes')}
                  className={`apple-segmented-item ${
                    mobileActiveTab === 'routes' ? 'apple-segmented-item-active' : ''
                  }`}
                  title="Routes"
                >
                  <span className="text-base">🛣️</span>
                </button>
                <button
                  type="button"
                  onClick={() => setMobileActiveTab('friends')}
                  className={`apple-segmented-item relative ${
                    mobileActiveTab === 'friends' ? 'apple-segmented-item-active' : ''
                  }`}
                  title="Squad"
                >
                  <span className="text-base">👥</span>
                  {members.length > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-[#007AFF] text-[9px] font-bold text-white flex items-center justify-center apple-tabular">
                      {members.length}
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setMobileActiveTab('stops')}
                  className={`apple-segmented-item relative ${
                    mobileActiveTab === 'stops' ? 'apple-segmented-item-active' : ''
                  }`}
                  title="Stops"
                >
                  <span className="text-base">🚧</span>
                  {waypoints.length > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-[#FF9500] text-[9px] font-bold text-white flex items-center justify-center apple-tabular">
                      {waypoints.length}
                    </span>
                  )}
                </button>
              </div>

              {/* TAB 1: ROUTES */}
              {mobileActiveTab === 'routes' && (
                <div className="space-y-3 pt-1">
                  {/* User's Route Options */}
                  {(() => {
                    const myRoutes = routes.filter((r) => !r.forUserId || r.forUserId === currentUserId);
                    const otherFriends = members.filter((m) => m.id !== currentUserId);

                    return (
                      <>
                        <div>
                          <div className="text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-2 flex items-center justify-between">
                            <span>🛣️ My Routes</span>
                          </div>
                          <div className="space-y-2">
                            {myRoutes.map((route, idx) => {
                              const isMyActive = currentUser?.assignedRouteId
                                ? currentUser.assignedRouteId === route.id
                                : idx === 0;

                              return (
                                <div
                                  key={route.id}
                                  onClick={() => onAssignRoute(currentUserId, route.id)}
                                  className={`p-2.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-2 ${
                                    isMyActive
                                      ? 'bg-cyan-950/40 border-cyan-400 shadow-md shadow-cyan-950/40 text-white'
                                      : 'bg-slate-800/50 border-slate-700/60 hover:bg-slate-800 text-slate-300'
                                  }`}
                                >
                                  <div className="flex items-center gap-2 min-w-0">
                                    <span
                                      className="w-3 h-3 rounded-full shrink-0"
                                      style={{
                                        backgroundColor: isMyActive ? '#00f0ff' : '#64748b',
                                        boxShadow: isMyActive ? '0 0 8px #00f0ff' : 'none',
                                      }}
                                    />
                                    <div className="min-w-0">
                                      <div className="text-xs font-bold truncate flex items-center gap-1.5">
                                        <span>{route.name}</span>
                                        {isMyActive && (
                                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-cyan-500/30 text-cyan-300 font-semibold border border-cyan-400/40 shrink-0">
                                            Your Route
                                          </span>
                                        )}
                                      </div>
                                      <div className="text-[11px] text-slate-400 mt-0.5">
                                        {route.tag || (idx === 0 ? 'Fastest Route' : 'Alternative')}
                                      </div>
                                    </div>
                                  </div>

                                  <div className="text-right shrink-0">
                                    <div
                                      className={`text-xs font-bold font-mono ${
                                        isMyActive ? 'text-cyan-300' : 'text-slate-300'
                                      }`}
                                    >
                                      ~{route.durationMins} mins
                                    </div>
                                    <div className="text-[10px] text-slate-400 font-mono">
                                      {route.distanceKm} km
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {/* Squad Friends' Routes */}
                        {otherFriends.length > 0 && (
                          <div className="pt-2 border-t border-slate-800/80">
                            <div className="text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-2 flex items-center justify-between">
                              <span>👥 Squad ({otherFriends.length})</span>
                            </div>
                            <div className="space-y-2">
                              {otherFriends.map((friend, fIdx) => {
                                const friendColor =
                                  friend.color && friend.color !== '#00f0ff' && friend.color !== '#3b82f6'
                                    ? friend.color
                                    : SQUAD_FRIEND_PALETTE[fIdx % SQUAD_FRIEND_PALETTE.length];

                                const friendRoutes = routes.filter((r) => r.forUserId === friend.id);
                                const chosenRoute = friend.assignedRouteId
                                  ? friendRoutes.find((r) => r.id === friend.assignedRouteId) ||
                                    routes.find((r) => r.id === friend.assignedRouteId) ||
                                    friendRoutes[0]
                                  : friendRoutes[0];

                                return (
                                  <div
                                    key={friend.id}
                                    className="p-2.5 rounded-2xl bg-slate-800/40 border border-slate-700/60 transition-all space-y-2"
                                    style={{ borderColor: `${friendColor}40` }}
                                  >
                                    <div className="flex items-center justify-between gap-2">
                                      <div className="flex items-center gap-2 min-w-0">
                                        <div
                                          className="w-7 h-7 rounded-full flex items-center justify-center text-sm shrink-0 border"
                                          style={{
                                            backgroundColor: `${friendColor}20`,
                                            borderColor: friendColor,
                                          }}
                                        >
                                          {friend.avatar || '🎒'}
                                        </div>
                                        <div className="min-w-0">
                                          <div className="flex items-center gap-1.5">
                                            <span className="font-bold text-xs text-white truncate max-w-[120px]">
                                              {friend.name}
                                            </span>
                                            <span
                                              className="w-2.5 h-2.5 rounded-full shrink-0"
                                              style={{
                                                backgroundColor: friendColor,
                                                boxShadow: `0 0 6px ${friendColor}`,
                                              }}
                                              title={`Route color: ${friendColor}`}
                                            />
                                          </div>
                                          <div className="text-[11px] text-slate-300 truncate">
                                            {chosenRoute?.name || 'Assigned Route'}
                                          </div>
                                        </div>
                                      </div>

                                      <div className="text-right shrink-0">
                                        {chosenRoute ? (
                                          <>
                                            <div
                                              className="text-xs font-bold font-mono"
                                              style={{ color: friendColor }}
                                            >
                                              ~{chosenRoute.durationMins} mins
                                            </div>
                                            <div className="text-[10px] text-slate-400 font-mono">
                                              {chosenRoute.distanceKm} km
                                            </div>
                                          </>
                                        ) : (
                                          <span className="text-[10px] text-slate-500 italic">Calculating...</span>
                                        )}
                                      </div>
                                    </div>

                                    {/* Alternate Route Switcher Pills */}
                                    {friendRoutes.length > 1 && (
                                      <div className="pt-1.5 border-t border-slate-700/40 flex items-center justify-between gap-2">
                                        <span className="text-[10px] text-slate-400">Select route:</span>
                                        <div className="flex items-center gap-1">
                                          {friendRoutes.map((altR, rIdx) => {
                                            const isSelected = chosenRoute?.id === altR.id;
                                            return (
                                              <button
                                                key={altR.id}
                                                type="button"
                                                onClick={() => onAssignRoute(friend.id, altR.id)}
                                                className={`px-2 py-0.5 rounded-lg text-[10px] font-bold transition cursor-pointer ${
                                                  isSelected
                                                    ? 'text-white shadow-sm'
                                                    : 'bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-700'
                                                }`}
                                                style={{
                                                  backgroundColor: isSelected ? friendColor : undefined,
                                                }}
                                              >
                                                Route {rIdx + 1}
                                              </button>
                                            );
                                          })}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              )}

              {/* TAB 2: SQUAD */}
              {mobileActiveTab === 'friends' && (
                <div className="space-y-2 pt-1">
                  {/* Search Box */}
                  <div className="relative mb-2">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-500" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Find a friend by name..."
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 outline-none focus:border-emerald-500 transition"
                    />
                  </div>

                  {filteredMembers.map((member) => {
                    const isMe = member.id === currentUserId;
                    const isLocating = !member.location || member.status === 'locating';
                    const accuracy = member.location?.accuracy || 0;
                    const dist =
                      !isMe && currentUser?.location && member.location
                        ? calculateDistanceKm(
                            currentUser.location.lat,
                            currentUser.location.lng,
                            member.location.lat,
                            member.location.lng
                          ).toFixed(1)
                        : null;

                    let distText = '';
                    if (dist != null) {
                      const numDist = parseFloat(dist);
                      if (numDist < 0.05) {
                        distText = 'Nearby (< 50m)';
                      } else {
                        distText = `${dist} km away`;
                      }
                    }

                    return (
                      <div
                        key={member.id}
                        onClick={() => {
                          onSelectMember(member.id);
                          setIsMobileDrawerOpen(false);
                        }}
                        className="p-2.5 rounded-2xl bg-slate-800/40 hover:bg-slate-800 border border-slate-700/60 transition cursor-pointer flex items-center justify-between gap-2"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div
                            className="w-8 h-8 rounded-full flex items-center justify-center text-base shrink-0 shadow relative"
                            style={{
                              border: `2px solid ${member.color}`,
                              backgroundColor: `${member.color}20`,
                            }}
                          >
                            {member.avatar}
                            {isLocating && (
                              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-amber-400 rounded-full animate-ping"></span>
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-white truncate flex items-center gap-1">
                              {member.name}
                              {isMe && <span className="text-[9px] text-blue-400">(You)</span>}
                            </div>
                            <div className="text-[10px] text-slate-400 truncate flex items-center gap-1">
                              {isLocating ? (
                                <span className="text-amber-400 font-semibold flex items-center gap-1">
                                  <span>⏳</span> Locating GPS...
                                </span>
                              ) : (
                                <>
                                  {distText ? <span>{distText} • </span> : null}
                                  <span>{Math.round(member.location?.speed || 0)} km/h</span>
                                  {accuracy > 0 && (
                                    <span className="text-slate-500 text-[9px]">• ±{accuracy}m</span>
                                  )}
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        {member.location ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectMember(member.id);
                              setIsMobileDrawerOpen(false);
                            }}
                            className="text-[11px] font-bold text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 px-2.5 py-1 rounded-xl border border-emerald-500/30 transition shrink-0 active:scale-95"
                          >
                            Find
                          </button>
                        ) : (
                          <span className="text-[10px] text-amber-400/80 px-2 py-0.5 rounded-lg bg-amber-500/10 border border-amber-500/20 shrink-0">
                            Waiting...
                          </span>
                        )}
                      </div>
                    );
                  })}

                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => setShowInviteModal(true)}
                      className="w-full py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow transition active:scale-95 cursor-pointer"
                    >
                      <Share2 className="w-4 h-4" />
                      <span>Invite More Friends (QR Code / Link)</span>
                    </button>
                  </div>
                </div>
              )}

              {/* TAB 3: STOPS & ROAD MARKERS */}
              {mobileActiveTab === 'stops' && (
                <div className="space-y-2.5 pt-1">
                  {/* Quick 1-tap add */}
                  <div className="text-[10px] text-slate-400 font-bold mb-1">
                    Tap to mark road condition at your current position:
                  </div>
                  <div className="grid grid-cols-4 gap-1.5">
                    {[
                      { type: 'speed-breaker', icon: '🛑', label: 'Breaker' },
                      { type: 'sharp-turn', icon: '↩️', label: 'Turn' },
                      { type: 'hazard', icon: '⚠️', label: 'Hazard' },
                      { type: 'road-problem', icon: '🚧', label: 'Pothole' },
                      { type: 'fuel', icon: '⛽', label: 'Fuel' },
                      { type: 'rest', icon: '☕', label: 'Rest' },
                      { type: 'food', icon: '🍕', label: 'Food' },
                      { type: 'checkpoint', icon: '🏁', label: 'Stop' },
                    ].map((wp) => (
                      <button
                        key={wp.type}
                        type="button"
                        onClick={() => {
                          if (currentUser?.location && onAddWaypoint) {
                            onAddWaypoint(currentUser.location.lat, currentUser.location.lng, wp.type, wp.label);
                          }
                        }}
                        className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 border border-slate-700/60 text-[10px] font-bold text-slate-200 flex flex-col items-center gap-1 transition active:scale-90"
                      >
                        <span className="text-base">{wp.icon}</span>
                        <span>{wp.label}</span>
                      </button>
                    ))}
                  </div>

                  {/* Pin Ahead on Map Button */}
                  <button
                    type="button"
                    onClick={() => {
                      setShowPinDropdown(!showPinDropdown);
                    }}
                    className="w-full py-2 px-3 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-300 font-bold text-xs flex items-center justify-center gap-1.5 transition active:scale-95"
                  >
                    <span>📍 Pin Marker Ahead on Map</span>
                  </button>

                  {showPinDropdown && (
                    <div className="p-2 rounded-2xl bg-slate-800 border border-rose-500/40 space-y-1.5">
                      <div className="text-[10px] text-rose-300 font-bold">
                        Choose type, then tap any road spot on the map:
                      </div>
                      <div className="grid grid-cols-2 gap-1">
                        {[
                          { type: 'sharp-turn', icon: '↩️', label: 'Sharp Turn' },
                          { type: 'road-problem', icon: '🚧', label: 'Bad Road' },
                          { type: 'hazard', icon: '⚠️', label: 'Road Hazard' },
                          { type: 'fuel', icon: '⛽', label: 'Fuel Ahead' },
                          { type: 'rest', icon: '☕', label: 'Rest Stop' },
                          { type: 'scenic', icon: '📸', label: 'Scenic View' },
                        ].map((p) => (
                          <button
                            key={p.type}
                            type="button"
                            onClick={() => {
                              if (onStartPinningWaypointOnMap) {
                                onStartPinningWaypointOnMap(p.type, p.label);
                                setShowPinDropdown(false);
                                setIsMobileDrawerOpen(false);
                              }
                            }}
                            className="px-2 py-1.5 rounded-xl bg-slate-700/80 hover:bg-rose-600/30 border border-slate-600 text-left text-[10px] font-semibold text-white flex items-center gap-1.5 transition"
                          >
                            <span>{p.icon}</span>
                            <span>{p.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Active markers list */}
                  {waypoints.length > 0 && (
                    <div className="space-y-1 max-h-32 overflow-y-auto pt-1">
                      <div className="text-[10px] text-slate-400 font-bold">
                        Active Markers ({waypoints.length}):
                      </div>
                      {waypoints.map((wp) => {
                        const wpIcon =
                          ({
                            fuel: '⛽',
                            rest: '☕',
                            food: '🍕',
                            hazard: '⚠️',
                            'sharp-turn': '↩️',
                            scenic: '📸',
                            'road-problem': '🚧',
                            checkpoint: '🏁',
                            'speed-breaker': '🛑',
                          } as Record<string, string>)[wp.type] || '📍';
                        const canRemove = wp.addedBy === currentUserId;
                        const dist = currentUser?.location
                          ? calculateDistanceKm(currentUser.location.lat, currentUser.location.lng, wp.lat, wp.lng).toFixed(1)
                          : null;
                        return (
                          <div
                            key={wp.id}
                            className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl bg-slate-800/40 border border-slate-700/40 text-[10px]"
                          >
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className="text-sm">{wpIcon}</span>
                              <span className="font-semibold text-white truncate">{wp.label}</span>
                              {dist && <span className="text-slate-400">• {dist} km</span>}
                            </div>
                            {canRemove && onRemoveWaypoint && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onRemoveWaypoint(wp.id);
                                }}
                                className="text-red-400 hover:text-red-300 p-0.5 rounded transition"
                                title="Remove marker"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ================================================================= */}
      {/* MOBILE MAP LAYERS & TRIP SETTINGS MODAL */}
      {/* ================================================================= */}
      {showMobileLayersSheet && (
        <div
          onClick={() => setShowMobileLayersSheet(false)}
          className="md:hidden fixed inset-0 z-50 flex items-end justify-center bg-slate-950/70 backdrop-blur-sm animate-fade-in pointer-events-auto"
        >
          <div
            className="bg-slate-900 border-t border-slate-700 w-full rounded-t-3xl p-5 shadow-2xl space-y-4 max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <h3 className="text-sm font-black text-white flex items-center gap-2">
                <Layers className="w-4 h-4 text-emerald-400" />
                <span>Map Style & Trip Options</span>
              </h3>
              <button
                onClick={() => setShowMobileLayersSheet(false)}
                className="text-slate-400 p-1 rounded-lg hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Tile Style Buttons */}
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => {
                  onChangeTileStyle('terrain');
                  setShowMobileLayersSheet(false);
                }}
                className={`p-3 rounded-2xl border text-left flex items-center gap-2.5 transition active:scale-95 ${
                  tileStyle === 'terrain'
                    ? 'bg-emerald-600/30 border-emerald-500 text-white'
                    : 'bg-slate-800 border-slate-700 text-slate-300'
                }`}
              >
                <span className="text-xl">🏔️</span>
                <div>
                  <div className="text-xs font-bold">Mountains</div>
                  <div className="text-[10px] text-slate-400">Terrain & elevations</div>
                </div>
              </button>

              <button
                onClick={() => {
                  onChangeTileStyle('v2v');
                  setShowMobileLayersSheet(false);
                }}
                className={`p-3 rounded-2xl border text-left flex items-center gap-2.5 transition active:scale-95 ${
                  tileStyle === 'v2v'
                    ? 'bg-amber-500/30 border-amber-400 text-amber-300'
                    : 'bg-slate-800 border-slate-700 text-slate-300'
                }`}
              >
                <span className="text-xl">⚡</span>
                <div>
                  <div className="text-xs font-bold">V2V Noir</div>
                  <div className="text-[10px] text-slate-400">Laser trajectory</div>
                </div>
              </button>

              <button
                onClick={() => {
                  onChangeTileStyle('satellite');
                  setShowMobileLayersSheet(false);
                }}
                className={`p-3 rounded-2xl border text-left flex items-center gap-2.5 transition active:scale-95 ${
                  tileStyle === 'satellite'
                    ? 'bg-emerald-600/30 border-emerald-500 text-white'
                    : 'bg-slate-800 border-slate-700 text-slate-300'
                }`}
              >
                <span className="text-xl">🛰️</span>
                <div>
                  <div className="text-xs font-bold">Satellite</div>
                  <div className="text-[10px] text-slate-400">Space photography</div>
                </div>
              </button>

              <button
                onClick={() => {
                  onChangeTileStyle('streets');
                  setShowMobileLayersSheet(false);
                }}
                className={`p-3 rounded-2xl border text-left flex items-center gap-2.5 transition active:scale-95 ${
                  tileStyle === 'streets'
                    ? 'bg-emerald-600/30 border-emerald-500 text-white'
                    : 'bg-slate-800 border-slate-700 text-slate-300'
                }`}
              >
                <span className="text-xl">🗺️</span>
                <div>
                  <div className="text-xs font-bold">Roads</div>
                  <div className="text-[10px] text-slate-400">Clean street map</div>
                </div>
              </button>
            </div>

            {/* Quick Action: Leave or Switch Trip */}
            {onLeaveGroup && (
              <button
                onClick={() => {
                  setShowMobileLayersSheet(false);
                  if (window.confirm(`Leave trip "${tripName}"?`)) onLeaveGroup();
                }}
                className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-red-400 text-xs font-bold flex items-center justify-center gap-2 transition active:scale-95"
              >
                <LogOut className="w-4 h-4" />
                <span>Switch or Leave Trip</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Squad Invite & QR Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in pointer-events-auto">
          <div className="bg-slate-900 border border-slate-700/90 w-full max-w-sm rounded-3xl p-6 shadow-2xl relative text-slate-100 flex flex-col items-center text-center">
            <button
              onClick={() => setShowInviteModal(false)}
              className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white transition"
            >
              ✕
            </button>

            <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-2xl mb-2">
              🔗
            </div>

            <h3 className="text-base font-black text-white">Invite Friends to Squad</h3>
            <p className="text-xs text-slate-300 mt-1">
              Send this direct link to friends. When they open it, they'll join your convoy instantly!
            </p>

            {/* QR Code */}
            <div className="p-3 bg-white rounded-2xl my-3.5 shadow-lg">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(shareUrl)}`}
                alt="QR Code"
                className="w-32 h-32 rounded-lg"
              />
            </div>
            <span className="text-[10px] text-slate-400">Scan with any phone camera to join</span>

            {/* Direct Link Input & Copy */}
            <div className="w-full flex items-center gap-1.5 mt-3">
              <input
                type="text"
                readOnly
                value={shareUrl}
                onClick={(e) => (e.target as HTMLInputElement).select()}
                className="w-full bg-slate-950 border border-slate-700 text-slate-200 text-xs font-mono rounded-xl px-3 py-2 truncate focus:outline-none"
              />
              <button
                type="button"
                onClick={handleCopyLink}
                className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-bold text-xs rounded-xl shadow transition shrink-0 flex items-center gap-1"
              >
                {copiedLink ? <Check className="w-4 h-4 text-emerald-200" /> : <Copy className="w-4 h-4" />}
                <span>{copiedLink ? 'Copied' : 'Copy'}</span>
              </button>
            </div>

            {/* WhatsApp Share Button */}
            <button
              type="button"
              onClick={handleWhatsAppShare}
              className="w-full mt-2.5 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow transition flex items-center justify-center gap-2 active:scale-95"
            >
              <MessageCircle className="w-4 h-4" />
              <span>Share Directly on WhatsApp</span>
            </button>
          </div>
        </div>
      )}
    </>
  );
};
