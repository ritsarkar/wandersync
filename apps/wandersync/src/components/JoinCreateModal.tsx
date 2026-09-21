import React, { useState } from 'react';
import { ArrowRight, MapPin, Search, Shield, Sparkles, Users } from 'lucide-react';
import { TransportMode } from '../types';
import { GooglePlaceSearchInput } from './GooglePlaceSearchInput';

interface JoinCreateModalProps {
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
  { mode: 'motorcycle', label: 'Bike / Scooter', icon: '🏍️' },
  { mode: 'bike', label: 'Bicycle', icon: '🚲' },
  { mode: 'walk', label: 'Walking / Trek', icon: '🥾' },
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

export const JoinCreateModal: React.FC<JoinCreateModalProps> = ({ onJoin, initialTripCode }) => {
  // Check URL query param
  const urlParam = new URLSearchParams(window.location.search).get('trip') ||
                   new URLSearchParams(window.location.search).get('group') ||
                   initialTripCode;

  const isJoiningViaLink = Boolean(urlParam);

  const [activeTab, setActiveTab] = useState<'create' | 'join'>(isJoiningViaLink ? 'join' : 'create');

  // Fields for Creation
  const [createTripName, setCreateTripName] = useState(() => `TRIP-${Math.floor(100 + Math.random() * 900)}`);
  const [creatorName, setCreatorName] = useState('');
  const [selectedDestination, setSelectedDestination] = useState<{
    name: string;
    icon: string;
    lat: number;
    lng: number;
  } | null>(POPULAR_DESTINATIONS[0]); // Default to Manali
  const [customDestinationQuery, setCustomDestinationQuery] = useState('');
  const [isSearchingDest, setIsSearchingDest] = useState(false);

  // Fields for Joining
  const [joinTripCode, setJoinTripCode] = useState(urlParam || '');
  const [joinerName, setJoinerName] = useState('');

  // Vehicle
  const [selectedMode, setSelectedMode] = useState<TransportMode>('car');

  // Custom Place Search using Google Geocoder + Nominatim fallback
  const handleSearchCustomDestination = async () => {
    if (!customDestinationQuery.trim()) return;
    setIsSearchingDest(true);

    if ((window as any).google?.maps?.Geocoder) {
      const geocoder = new (window as any).google.maps.Geocoder();
      geocoder.geocode({ address: customDestinationQuery }, (results: any, status: any) => {
        setIsSearchingDest(false);
        if (status === 'OK' && results && results[0]) {
          const loc = results[0].geometry.location;
          const shortName = results[0].formatted_address.split(',').slice(0, 2).join(',');
          setSelectedDestination({
            name: shortName,
            icon: '📍',
            lat: loc.lat(),
            lng: loc.lng(),
          });
          setCustomDestinationQuery('');
        } else {
          fallbackNominatim(customDestinationQuery);
        }
      });
    } else {
      fallbackNominatim(customDestinationQuery);
    }
  };

  const fallbackNominatim = async (query: string) => {
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`);
      const data = await res.json();
      setIsSearchingDest(false);
      if (data && data[0]) {
        const shortName = data[0].display_name.split(',').slice(0, 2).join(',');
        setSelectedDestination({
          name: shortName,
          icon: '📍',
          lat: parseFloat(data[0].lat),
          lng: parseFloat(data[0].lon),
        });
        setCustomDestinationQuery('');
      } else {
        alert(`Could not find "${query}". Please check the name.`);
      }
    } catch {
      setIsSearchingDest(false);
      alert(`Could not search place right now.`);
    }
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!creatorName.trim() || !createTripName.trim()) return;

    const chosenVehicle = VEHICLES.find((v) => v.mode === selectedMode);

    onJoin({
      groupId: createTripName.trim().toUpperCase(),
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700/80 w-full max-w-md rounded-3xl p-5 sm:p-6 shadow-2xl relative text-slate-100 my-auto">
        
        {/* Header with Title & Privacy Badge */}
        <div className="text-center mb-4">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[11px] font-bold mb-2">
            <Shield className="w-3.5 h-3.5" />
            <span>Private & Isolated Groups</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-white">
            WanderSync Live GPS
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Share location exclusively with your group on real mountain maps
          </p>
        </div>

        {/* Tab Switcher: Create vs Join */}
        <div className="grid grid-cols-2 p-1 bg-slate-800/80 rounded-2xl border border-slate-700/80 mb-4">
          <button
            type="button"
            onClick={() => setActiveTab('create')}
            className={`py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition ${
              activeTab === 'create'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Create New Group</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('join')}
            className={`py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition ${
              activeTab === 'join'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Join Friend's Group</span>
          </button>
        </div>

        {/* ================================================================= */}
        {/* TAB 1: CREATE NEW GROUP (CREATOR / LEADER FLOW) */}
        {/* ================================================================= */}
        {activeTab === 'create' && (
          <form onSubmit={handleCreateSubmit} className="space-y-3.5">
            
            {/* STEP 1: CHOOSE DESTINATION (FIRST STEP) */}
            <div className="p-3 rounded-2xl bg-slate-800/50 border border-amber-500/30">
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-amber-300 flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-amber-400" />
                  <span>1. Choose where to go (Destination)</span>
                </label>
                <span className="text-[10px] text-slate-400">Step 1</span>
              </div>
              <p className="text-[10px] text-slate-400 mb-2 leading-tight">
                Fix the location now. You (as creator) can share the link, and only you will be able to change it.
              </p>

              {/* Selected Destination Pill */}
              {selectedDestination && (
                <div className="mb-2 p-2 rounded-xl bg-amber-500/15 border border-amber-400/40 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-lg shrink-0">{selectedDestination.icon}</span>
                    <span className="text-xs font-bold text-white truncate">
                      {selectedDestination.name}
                    </span>
                  </div>
                  <span className="shrink-0 text-[10px] font-bold text-emerald-400 bg-emerald-500/20 px-2 py-0.5 rounded-lg">
                    Fixed 🔒
                  </span>
                </div>
              )}

              {/* Quick 1-Tap Popular Mountain Trip Presets */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1 mb-2">
                {POPULAR_DESTINATIONS.slice(0, 4).map((dest) => (
                  <button
                    key={dest.name}
                    type="button"
                    onClick={() => setSelectedDestination(dest)}
                    className={`px-2 py-1.5 rounded-xl border text-[10px] font-bold flex items-center gap-1 transition truncate ${
                      selectedDestination?.name === dest.name
                        ? 'bg-amber-500 text-slate-950 border-amber-300'
                        : 'bg-slate-800 text-slate-300 border-slate-700 hover:border-slate-600'
                    }`}
                  >
                    <span>{dest.icon}</span>
                    <span className="truncate">{dest.name.split(',')[0]}</span>
                  </button>
                ))}
              </div>

              {/* Google Maps Live Autocomplete Search */}
              <div className="mt-1">
                <GooglePlaceSearchInput
                  placeholder="Type location on Google Maps (e.g. Gangarampur)..."
                  onSelectPlace={(place) => {
                    setSelectedDestination({
                      name: place.formattedAddress || place.name,
                      icon: '📍',
                      lat: place.lat,
                      lng: place.lng,
                    });
                  }}
                />
              </div>
            </div>

            {/* STEP 2: GROUP NAME / CODE */}
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                2. Group Code / Trip Name
              </label>
              <input
                type="text"
                value={createTripName}
                onChange={(e) => setCreateTripName(e.target.value.toUpperCase())}
                placeholder="e.g. MANALI-EXPEDITION"
                required
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm font-bold text-emerald-400 outline-none focus:border-emerald-500 transition uppercase tracking-wide"
              />
              <span className="text-[10px] text-slate-400 mt-0.5 block">
                Friends will join using this exact code.
              </span>
            </div>

            {/* STEP 3: YOUR NAME */}
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                3. Your Name (Trip Leader)
              </label>
              <input
                type="text"
                value={creatorName}
                onChange={(e) => setCreatorName(e.target.value)}
                placeholder="Enter your name (e.g. Rahul)"
                required
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm font-bold text-white outline-none focus:border-emerald-500 transition"
              />
            </div>

            {/* STEP 4: VEHICLE */}
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                4. How are you traveling?
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                {VEHICLES.map((v) => (
                  <button
                    type="button"
                    key={v.mode}
                    onClick={() => setSelectedMode(v.mode)}
                    className={`p-2 rounded-xl border text-left flex items-center gap-2 transition ${
                      selectedMode === v.mode
                        ? 'bg-emerald-600/20 border-emerald-500 text-white shadow'
                        : 'bg-slate-800/60 border-slate-700/60 text-slate-400 hover:border-slate-600'
                    }`}
                  >
                    <span className="text-lg">{v.icon}</span>
                    <span className="text-xs font-semibold">{v.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Privacy Promise */}
            <div className="p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/60 text-[10px] text-slate-400 flex items-start gap-2">
              <Shield className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>
                <strong>Privacy Guaranteed:</strong> Only friends with code <strong className="text-white">{createTripName}</strong> can see your map. Other groups are completely separate.
              </span>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={!creatorName.trim() || !createTripName.trim()}
              className="w-full mt-1 py-3 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-bold text-sm shadow-xl flex items-center justify-center gap-2 transition active:scale-95 cursor-pointer"
            >
              <span>Create Group & Go to Map</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        )}

        {/* ================================================================= */}
        {/* TAB 2: JOIN FRIEND'S GROUP */}
        {/* ================================================================= */}
        {activeTab === 'join' && (
          <form onSubmit={handleJoinSubmit} className="space-y-4">
            
            {/* Friend's Group Code */}
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                Trip / Group Code
              </label>
              <input
                type="text"
                value={joinTripCode}
                onChange={(e) => setJoinTripCode(e.target.value.toUpperCase())}
                placeholder="Enter group code (e.g. TRIP-123)"
                required
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm font-bold text-emerald-400 outline-none focus:border-emerald-500 transition uppercase tracking-wide"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">
                Enter the code or link your friend shared with you.
              </span>
            </div>

            {/* Your Name */}
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                Your Name
              </label>
              <input
                type="text"
                value={joinerName}
                onChange={(e) => setJoinerName(e.target.value)}
                placeholder="Enter your name (e.g. Amit)"
                required
                autoFocus
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm font-bold text-white outline-none focus:border-emerald-500 transition"
              />
            </div>

            {/* Vehicle Selection */}
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">
                How are you traveling?
              </label>
              <div className="grid grid-cols-2 gap-2">
                {VEHICLES.map((v) => (
                  <button
                    type="button"
                    key={v.mode}
                    onClick={() => setSelectedMode(v.mode)}
                    className={`p-2.5 rounded-xl border text-left flex items-center gap-2 transition ${
                      selectedMode === v.mode
                        ? 'bg-emerald-600/20 border-emerald-500 text-white shadow'
                        : 'bg-slate-800/60 border-slate-700/60 text-slate-400 hover:border-slate-600'
                    }`}
                  >
                    <span className="text-xl">{v.icon}</span>
                    <span className="text-xs font-semibold">{v.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Privacy Notice */}
            <div className="p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/60 text-[10px] text-slate-400 flex items-start gap-2">
              <Shield className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>
                <strong>Your Privacy:</strong> You will only share location with members of this group. When the trip ends or you leave, your tracking stops.
              </span>
            </div>

            {/* Action Button */}
            <button
              type="submit"
              disabled={!joinerName.trim() || !joinTripCode.trim()}
              className="w-full mt-2 py-3 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-bold text-sm shadow-xl flex items-center justify-center gap-2 transition active:scale-95 cursor-pointer"
            >
              <span>Join Friend's Squad</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
