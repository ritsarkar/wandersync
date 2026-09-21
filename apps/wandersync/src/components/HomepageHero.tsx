import React, { useState } from 'react';
import {
  Sparkles,
  Users,
  Share2,
  Check,
  Copy,
  MessageCircle,
  MapPin,
  Compass,
  Shield,
  ChevronDown,
  ChevronUp,
  Eye,
  QrCode,
  ArrowRight,
  Navigation,
} from 'lucide-react';
import { TransportMode } from '../types';
import { GooglePlaceSearchInput } from './GooglePlaceSearchInput';

interface HomepageHeroProps {
  onJoin: (data: {
    groupId: string;
    name: string;
    avatar: string;
    color: string;
    mode: TransportMode;
    isCreator?: boolean;
    initialDestination?: { lat: number; lng: number; title: string };
  }) => void;
  initialTripCode?: string;
}

const VEHICLES: { mode: TransportMode; label: string; icon: string }[] = [
  { mode: 'car', label: 'Car', icon: '🚗' },
  { mode: 'motorcycle', label: 'Bike / Moto', icon: '🏍️' },
  { mode: 'bike', label: 'Bicycle', icon: '🚲' },
  { mode: 'walk', label: 'Trek / Walk', icon: '🥾' },
];

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

export const HomepageHero: React.FC<HomepageHeroProps> = ({ onJoin, initialTripCode }) => {
  // Read trip/group query param from URL
  const urlParam =
    new URLSearchParams(window.location.search).get('trip') ||
    new URLSearchParams(window.location.search).get('group') ||
    initialTripCode;

  const isJoiningViaLink = Boolean(urlParam);

  const [activeTab, setActiveTab] = useState<'create' | 'join'>(isJoiningViaLink ? 'join' : 'create');

  // Fields for Creation
  const [createTripCode] = useState(() => {
    if (urlParam) return urlParam.toUpperCase();
    return `TRIP-${Math.floor(100 + Math.random() * 900)}`;
  });
  const [creatorName, setCreatorName] = useState(() => localStorage.getItem('wandersync_user_name') || '');
  const [selectedDestination, setSelectedDestination] = useState<{
    name: string;
    icon: string;
    lat: number;
    lng: number;
  } | null>(POPULAR_DESTINATIONS[0]);

  // Fields for Joining
  const [joinTripCode, setJoinTripCode] = useState(urlParam || '');
  const [joinerName, setJoinerName] = useState(() => localStorage.getItem('wandersync_user_name') || '');

  // Vehicle
  const [selectedMode, setSelectedMode] = useState<TransportMode>(
    () => (localStorage.getItem('wandersync_user_mode') as TransportMode) || 'car'
  );

  // UI States
  const [isMinimized, setIsMinimized] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [showDestinationPicker, setShowDestinationPicker] = useState(false);
  const [tripPreview, setTripPreview] = useState<{
    destinationTitle?: string;
    membersCount?: number;
    leaderName?: string;
  } | null>(null);

  // If joining via link, fetch live destination and squad details from backend
  React.useEffect(() => {
    if (urlParam) {
      fetch(`/api/groups/${urlParam.toUpperCase()}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data && data.id) {
            setTripPreview({
              destinationTitle: data.rendezvous?.title,
              membersCount: data.members?.length || 0,
              leaderName: data.rendezvous?.setBy || data.members?.[0]?.name,
            });
          }
        })
        .catch(() => {});
    }
  }, [urlParam]);

  // Active trip code
  const currentActiveCode = activeTab === 'create' ? createTripCode : (joinTripCode || createTripCode);
  const shareUrl = `${window.location.origin}${window.location.pathname}?trip=${currentActiveCode}`;

  const handleCopyLink = async () => {
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(shareUrl);
      } else {
        const input = document.createElement('input');
        input.value = shareUrl;
        document.body.appendChild(input);
        input.select();
        document.execCommand('copy');
        document.body.removeChild(input);
      }
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    } catch (e) {
      console.warn('Copy link error:', e);
    }
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Join my WanderSync Convoy (${currentActiveCode})`,
          text: `Track my live GPS location on the convoy map and navigate with our group!`,
          url: shareUrl,
        });
      } catch (e) {
        // Fallback to copy link
        handleCopyLink();
      }
    } else {
      handleCopyLink();
    }
  };

  const handleWhatsAppShare = () => {
    const text = encodeURIComponent(
      `🚗 Join our live travel convoy "${currentActiveCode}" on WanderSync!\nTrack our positions in real-time on mountain roads:\n${shareUrl}`
    );
    window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank');
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!creatorName.trim()) return;

    const chosenVehicle = VEHICLES.find((v) => v.mode === selectedMode);

    onJoin({
      groupId: createTripCode.trim().toUpperCase(),
      name: creatorName.trim(),
      avatar: chosenVehicle?.icon || '🚗',
      color: '#10b981',
      mode: selectedMode,
      isCreator: true,
      initialDestination: selectedDestination
        ? {
            lat: selectedDestination.lat,
            lng: selectedDestination.lng,
            title: `${selectedDestination.icon} ${selectedDestination.name}`,
          }
        : undefined,
    });
  };

  const handleJoinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinerName.trim() || !joinTripCode.trim()) return;

    const chosenVehicle = VEHICLES.find((v) => v.mode === selectedMode);

    onJoin({
      groupId: joinTripCode.trim().toUpperCase(),
      name: joinerName.trim(),
      avatar: chosenVehicle?.icon || '🚗',
      color: '#3b82f6',
      mode: selectedMode,
      isCreator: false,
    });
  };

  return (
    <>
      {/* 1. TOP MINIMAL PILL BAR (When user minimizes the card to see the full minimal map) */}
      {isMinimized && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-40 animate-fade-in pointer-events-auto">
          <div className="apple-glass-pill rounded-full px-4 py-2 shadow-2xl flex items-center gap-3 text-slate-100">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#34C759] animate-ping" />
              <span className="font-bold text-xs tracking-tight apple-headline">WanderSync</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#34C759]/20 text-[#34C759] font-bold apple-caption apple-tabular">
                {currentActiveCode}
              </span>
            </div>

            <div className="h-4 w-px bg-white/15" />

            <button
              onClick={() => setShowShareModal(true)}
              className="text-xs font-semibold text-blue-400 hover:text-blue-300 flex items-center gap-1 apple-pressable"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>Invite</span>
            </button>

            <button
              onClick={() => setIsMinimized(false)}
              className="px-3 py-1 bg-[#007AFF] hover:bg-[#0066d6] text-white font-bold text-xs rounded-full shadow-md border-t border-white/30 apple-pressable flex items-center gap-1"
            >
              <span>Open Panel</span>
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* 2. FLOATING HOMEPAGE HERO CARD (Unobscured minimal map in background) */}
      {!isMinimized && (
        <div className="fixed top-3 left-3 right-3 sm:top-5 sm:left-5 sm:right-auto sm:w-[420px] z-40 max-h-[92vh] flex flex-col pointer-events-auto animate-fade-in">
          <div className="apple-glass-card rounded-[28px] p-5 shadow-2xl text-slate-100 flex flex-col gap-4 overflow-y-auto max-h-[90vh]">
            
            {/* Header: Brand & Minimize Button */}
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-xl bg-gradient-to-tr from-blue-500 to-cyan-400 flex items-center justify-center shadow-lg shadow-blue-500/20 text-white text-sm font-bold">
                    🧭
                  </div>
                  <h1 className="text-xl font-bold text-white tracking-tight apple-large-title">
                    WanderSync
                  </h1>
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#34C759]/15 border border-[#34C759]/30 text-[#34C759] text-[10px] font-bold apple-caption">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#34C759] animate-pulse" />
                    Live Convoy
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-1 leading-snug">
                  Real-time GPS tracking & authentic Google road routes on minimal mountain maps.
                </p>
              </div>

              {/* Minimize Card button to inspect map */}
              <button
                onClick={() => setIsMinimized(true)}
                className="p-1.5 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white transition shrink-0"
                title="Minimize panel to explore map"
              >
                <Eye className="w-4 h-4" />
              </button>
            </div>

            {/* QUICK GROUP INVITE BAR (Click to share link directly) */}
            <div className="p-3.5 rounded-2xl bg-gradient-to-br from-emerald-950/60 to-slate-900 border border-emerald-500/30 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-300">
                  <Share2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Group Invite Link</span>
                </div>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-200 font-bold">
                  {currentActiveCode}
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  readOnly
                  value={shareUrl}
                  onClick={(e) => (e.target as HTMLInputElement).select()}
                  className="w-full bg-slate-950/80 border border-slate-700 text-slate-300 text-[11px] font-mono rounded-xl px-2.5 py-2 truncate focus:outline-none focus:border-emerald-500"
                />
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-bold text-xs rounded-xl shadow transition shrink-0 flex items-center gap-1"
                  title="Copy direct invite link"
                >
                  {copiedLink ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-200" />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>

              {/* Direct 1-Click Share Actions */}
              <div className="grid grid-cols-3 gap-1.5 pt-0.5">
                <button
                  type="button"
                  onClick={handleWhatsAppShare}
                  className="py-1.5 px-2 bg-emerald-900/50 hover:bg-emerald-800 text-emerald-200 border border-emerald-600/40 rounded-xl text-[11px] font-bold transition flex items-center justify-center gap-1 active:scale-95"
                >
                  <MessageCircle className="w-3 h-3 text-emerald-400" />
                  <span>WhatsApp</span>
                </button>
                <button
                  type="button"
                  onClick={handleNativeShare}
                  className="py-1.5 px-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-[11px] font-bold transition flex items-center justify-center gap-1 active:scale-95"
                >
                  <Share2 className="w-3 h-3" />
                  <span>Share App</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowShareModal(true)}
                  className="py-1.5 px-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-[11px] font-bold transition flex items-center justify-center gap-1 active:scale-95"
                >
                  <QrCode className="w-3 h-3" />
                  <span>QR Code</span>
                </button>
              </div>
            </div>

            {/* Tab Switcher: Create vs Join */}
            <div className="apple-segmented-track">
              <button
                type="button"
                onClick={() => setActiveTab('create')}
                className={`apple-segmented-item apple-pressable ${
                  activeTab === 'create' ? 'apple-segmented-item-active' : ''
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                <span>Create Trip</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('join')}
                className={`apple-segmented-item apple-pressable ${
                  activeTab === 'join' ? 'apple-segmented-item-active' : ''
                }`}
              >
                <Users className="w-3.5 h-3.5 text-blue-400" />
                <span>Join Friend</span>
              </button>
            </div>

            {/* =================================================================== */}
            {/* TAB 1: CREATE NEW SQUAD */}
            {/* =================================================================== */}
            {activeTab === 'create' && (
              <form onSubmit={handleCreateSubmit} className="space-y-3">
                {/* Name */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-300 mb-1">
                    Your Name / Call-sign
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Rits, Alex, Captain"
                    value={creatorName}
                    onChange={(e) => setCreatorName(e.target.value)}
                    className="w-full bg-slate-800/80 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-emerald-500"
                  />
                </div>

                {/* Transport Mode */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-300 mb-1">
                    Vehicle Type
                  </label>
                  <div className="grid grid-cols-4 gap-1.5">
                    {VEHICLES.map((v) => (
                      <button
                        key={v.mode}
                        type="button"
                        onClick={() => setSelectedMode(v.mode)}
                        className={`p-2 rounded-xl flex flex-col items-center gap-1 border transition ${
                          selectedMode === v.mode
                            ? 'bg-emerald-600/30 border-emerald-400 text-emerald-300'
                            : 'bg-slate-800/60 border-slate-700/80 text-slate-400 hover:bg-slate-800'
                        }`}
                      >
                        <span className="text-lg">{v.icon}</span>
                        <span className="text-[10px] font-semibold">{v.label.split(' ')[0]}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Optional Destination */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-bold text-slate-300">
                      Destination / Meeting Spot
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowDestinationPicker(!showDestinationPicker)}
                      className="text-[10px] text-emerald-400 hover:underline"
                    >
                      {showDestinationPicker ? 'Hide Options' : 'Change Spot'}
                    </button>
                  </div>

                  {/* Selected destination pill */}
                  {selectedDestination && !showDestinationPicker && (
                    <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/80 text-xs">
                      <div className="flex items-center gap-2 truncate">
                        <span className="text-base">{selectedDestination.icon}</span>
                        <span className="font-semibold text-slate-200 truncate">
                          {selectedDestination.name}
                        </span>
                      </div>
                      <span className="text-[10px] text-emerald-400 font-bold shrink-0">Selected</span>
                    </div>
                  )}

                  {/* Destination picker list */}
                  {showDestinationPicker && (
                    <div className="space-y-2 mt-1 p-2 bg-slate-950/60 rounded-2xl border border-slate-800">
                      <GooglePlaceSearchInput
                        placeholder="Search Google Places (e.g. Gangarampur)..."
                        onSelectPlace={(place) => {
                          setSelectedDestination({
                            name: place.name,
                            icon: '📍',
                            lat: place.lat,
                            lng: place.lng,
                          });
                          setShowDestinationPicker(false);
                        }}
                      />

                      <div className="grid grid-cols-2 gap-1 max-h-36 overflow-y-auto pr-1">
                        {POPULAR_DESTINATIONS.map((dest) => (
                          <button
                            key={dest.name}
                            type="button"
                            onClick={() => {
                              setSelectedDestination(dest);
                              setShowDestinationPicker(false);
                            }}
                            className={`p-2 rounded-xl text-left flex items-center gap-1.5 border transition ${
                              selectedDestination?.name === dest.name
                                ? 'bg-emerald-600/30 border-emerald-400 text-emerald-300'
                                : 'bg-slate-800/50 border-slate-700/60 text-slate-300 hover:bg-slate-800'
                            }`}
                          >
                            <span className="text-sm">{dest.icon}</span>
                            <span className="text-[11px] truncate font-medium">{dest.name.split(',')[0]}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Primary Button */}
                <button
                  type="submit"
                  className="w-full py-3 px-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-black text-xs shadow-xl shadow-emerald-600/25 flex items-center justify-center gap-2 transition active:scale-95 cursor-pointer mt-1"
                >
                  <span>Start Squad & Open Convoy Map</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>
            )}

            {/* =================================================================== */}
            {/* TAB 2: JOIN FRIEND'S SQUAD */}
            {/* =================================================================== */}
            {activeTab === 'join' && (
              <form onSubmit={handleJoinSubmit} className="space-y-3">
                {isJoiningViaLink && (
                  <div className="p-3 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">👋</span>
                      <div>
                        <div className="font-bold">You're invited to join squad!</div>
                        <div className="text-[10px] text-emerald-200">Trip Code: <b className="font-mono">{joinTripCode}</b></div>
                      </div>
                    </div>

                    {tripPreview?.destinationTitle && (
                      <div className="mt-1 pt-1.5 border-t border-emerald-500/20 flex items-center justify-between text-[11px]">
                        <span className="text-emerald-200 font-semibold flex items-center gap-1">
                          <span>🎯 Destination:</span>
                          <span className="text-white font-bold">{tripPreview.destinationTitle}</span>
                        </span>
                        {tripPreview.membersCount != null && tripPreview.membersCount > 0 && (
                          <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-bold">
                            {tripPreview.membersCount} online
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Trip Code */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-300 mb-1">
                    Trip Code / Invite ID
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. TRIP-842"
                    value={joinTripCode}
                    onChange={(e) => setJoinTripCode(e.target.value.toUpperCase())}
                    className="w-full bg-slate-800/80 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs font-mono tracking-wider uppercase focus:outline-none focus:border-emerald-500"
                  />
                </div>

                {/* Name */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-300 mb-1">
                    Your Name
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Enter your name"
                    value={joinerName}
                    onChange={(e) => setJoinerName(e.target.value)}
                    className="w-full bg-slate-800/80 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-emerald-500"
                  />
                </div>

                {/* Transport Mode */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-300 mb-1">
                    Your Vehicle
                  </label>
                  <div className="grid grid-cols-4 gap-1.5">
                    {VEHICLES.map((v) => (
                      <button
                        key={v.mode}
                        type="button"
                        onClick={() => setSelectedMode(v.mode)}
                        className={`p-2 rounded-xl flex flex-col items-center gap-1 border transition ${
                          selectedMode === v.mode
                            ? 'bg-emerald-600/30 border-emerald-400 text-emerald-300'
                            : 'bg-slate-800/60 border-slate-700/80 text-slate-400 hover:bg-slate-800'
                        }`}
                      >
                        <span className="text-lg">{v.icon}</span>
                        <span className="text-[10px] font-semibold">{v.label.split(' ')[0]}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Primary Join Button */}
                <button
                  type="submit"
                  className="w-full py-3 px-4 rounded-2xl bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-400 hover:to-indigo-500 text-white font-black text-xs shadow-xl shadow-blue-600/25 flex items-center justify-center gap-2 transition active:scale-95 cursor-pointer mt-1"
                >
                  <span>Join Squad & View Live Map</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>
            )}

            {/* Privacy footer badge */}
            <div className="pt-1 flex items-center justify-center gap-1.5 text-[10px] text-slate-400">
              <Shield className="w-3.5 h-3.5 text-emerald-400" />
              <span>Zero tracking outside your squad. Completely private.</span>
            </div>
          </div>
        </div>
      )}

      {/* 3. DEDICATED DIRECT SHARE & QR MODAL */}
      {showShareModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in pointer-events-auto">
          <div className="bg-slate-900 border border-slate-700/90 w-full max-w-sm rounded-3xl p-6 shadow-2xl relative text-slate-100 flex flex-col items-center text-center">
            <button
              onClick={() => setShowShareModal(false)}
              className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white transition"
            >
              ✕
            </button>

            <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-2xl mb-2">
              🔗
            </div>

            <h3 className="text-base font-black text-white">Share Squad Invite</h3>
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
