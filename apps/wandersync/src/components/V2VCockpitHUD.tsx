import React, { useMemo } from 'react';
import { TravelerMember, RendezvousPoint, TravelRoute, Waypoint } from '../types';
import { Compass, X, Play, Square } from 'lucide-react';

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

// Web Audio API chime synchronized with Haptic pulse (WWDC: Harmony on same frame)
function playHazardChime() {
  try {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate([25, 40, 25]);
    }
  } catch (e) {}

  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(587, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15);
    gain.gain.setValueAtTime(0.25, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.2);
  } catch (e) {}
}

interface V2VCockpitHUDProps {
  currentUserId: string;
  members: TravelerMember[];
  rendezvous: RendezvousPoint | null;
  routes: TravelRoute[];
  waypoints?: Waypoint[];
  is3DTiltActive: boolean;
  onToggle3DTilt: () => void;
  onExitTrip: () => void;
  isSimulating?: boolean;
  onToggleSimulation?: () => void;
  onAddHazard?: (type: string, label: string) => void;
  isPointingPinMode?: boolean;
  onTogglePointingPin?: () => void;
}

export const V2VCockpitHUD: React.FC<V2VCockpitHUDProps> = ({
  currentUserId,
  members,
  rendezvous,
  routes,
  waypoints = [],
  is3DTiltActive,
  onToggle3DTilt,
  onExitTrip,
  isSimulating = false,
  onToggleSimulation,
  onAddHazard,
  isPointingPinMode = false,
  onTogglePointingPin,
}) => {
  const [reportToast, setReportToast] = React.useState<string | null>(null);
  const me = members.find((m) => m.id === currentUserId);
  const mySpeed = Math.max(0, Math.round(me?.location?.speed || 0));

  // Find squad members ahead or nearest
  const nearestAheadMember = useMemo(() => {
    if (!me?.location || typeof me.location.lat !== 'number' || typeof me.location.lng !== 'number') {
      return null;
    }

    const otherMembers = members.filter(
      (m) =>
        m.id !== currentUserId &&
        m.location &&
        typeof m.location.lat === 'number' &&
        typeof m.location.lng === 'number' &&
        m.status !== 'offline'
    );
    if (otherMembers.length === 0) return null;

    let closest: { member: TravelerMember; distanceMeters: number; isAhead: boolean } | null = null;

    otherMembers.forEach((other) => {
      const distKm = calcDistanceKm(
        me.location!.lat,
        me.location!.lng,
        other.location!.lat,
        other.location!.lng
      );
      const distMeters = Math.round(distKm * 1000);

      const dLat = other.location!.lat - me.location!.lat;
      const dLng = other.location!.lng - me.location!.lng;
      let bearingToOther = (Math.atan2(dLng, dLat) * 180) / Math.PI;
      if (bearingToOther < 0) bearingToOther += 360;

      const angleDiff = Math.abs(bearingToOther - (me.location!.heading || 0)) % 360;
      const normalizedDiff = angleDiff > 180 ? 360 - angleDiff : angleDiff;
      const isAhead = normalizedDiff < 85;

      if (!closest || distMeters < closest.distanceMeters) {
        closest = { member: other, distanceMeters: distMeters, isAhead };
      }
    });

    return closest;
  }, [me?.location, members, currentUserId]);

  // Distance & ETA to Rendezvous
  const rendezvousStats = useMemo(() => {
    if (!rendezvous || !me?.location || typeof rendezvous.lat !== 'number' || typeof rendezvous.lng !== 'number') {
      return null;
    }
    const distKm = calcDistanceKm(me.location.lat, me.location.lng, rendezvous.lat, rendezvous.lng);
    const speedForEta = mySpeed > 5 ? mySpeed : 45;
    const mins = Math.max(1, Math.round((distKm / speedForEta) * 60));
    return {
      distanceKm: distKm < 1 ? `${Math.round(distKm * 1000)} m` : `${distKm.toFixed(1)} km`,
      etaMins: mins,
    };
  }, [rendezvous, me?.location, mySpeed]);

  // Proximity Alert for Reported Road Hazards ahead (within 300m)
  const nearestApproachingHazard = useMemo(() => {
    if (!me?.location || !waypoints || waypoints.length === 0) return null;
    const hazardTypes = new Set(['speed-breaker', 'sharp-turn', 'pothole', 'police', 'hazard', 'road-problem']);
    let closest: { waypoint: Waypoint; distMeters: number } | null = null;

    waypoints.forEach((wp) => {
      if (!hazardTypes.has(wp.type)) return;
      const dKm = calcDistanceKm(me.location!.lat, me.location!.lng, wp.lat, wp.lng);
      const distMeters = Math.round(dKm * 1000);
      if (distMeters <= 300) {
        if (!closest || distMeters < closest.distMeters) {
          closest = { waypoint: wp, distMeters };
        }
      }
    });

    return closest;
  }, [me?.location, waypoints]);

  return (
    <div className="absolute inset-0 pointer-events-none z-30 flex flex-col justify-between p-3 sm:p-4 select-none font-sans overflow-hidden">
      {/* Top Center: Alerts & Proximity Warnings */}
      <div className="flex flex-col items-center gap-1.5 w-full">
        {/* Road Hazard Proximity Alert */}
        {nearestApproachingHazard && (
          <div className="pointer-events-auto apple-glass-pill px-4 py-2 border-t border-rose-400/50 shadow-lg flex items-center gap-2 animate-bounce text-white">
            <span className="text-base animate-pulse">⚠️</span>
            <span className="text-xs font-bold uppercase tracking-wider apple-headline">
              {nearestApproachingHazard.waypoint.type === 'speed-breaker'
                ? '🛑 Speed Breaker Ahead'
                : nearestApproachingHazard.waypoint.type === 'sharp-turn'
                ? '↩️ Sharp Turn Ahead'
                : nearestApproachingHazard.waypoint.type === 'pothole'
                ? '🕳️ Pothole Ahead'
                : nearestApproachingHazard.waypoint.type === 'police'
                ? '👮 Police Checkpoint Ahead'
                : '⚠️ Road Hazard Ahead'}{' '}
              in <span className="apple-tabular">{nearestApproachingHazard.distMeters}</span> m
            </span>
          </div>
        )}

        {/* Squad Member Ahead Proximity Alert */}
        {nearestAheadMember && nearestAheadMember.distanceMeters <= 500 && (
          <div className="pointer-events-auto apple-glass-pill px-4 py-1.5 border border-red-500/40 shadow-xl flex items-center gap-2 animate-bounce">
            <span className="text-red-400 text-xs">⚠️</span>
            <span className="text-[11px] font-bold text-white apple-tabular">
              {nearestAheadMember.member.name} is {nearestAheadMember.distanceMeters}m {nearestAheadMember.isAhead ? 'ahead' : 'near'}
            </span>
          </div>
        )}
      </div>
      {/* Toast Notification for Marked Hazard */}
      {reportToast && (
        <div className="flex justify-center w-full pointer-events-auto animate-fade-in mb-1">
          <div className="px-4 py-1.5 rounded-full apple-glass-pill text-[#34C759] font-bold text-xs shadow-2xl flex items-center gap-2 border border-[#34C759]/40">
            <span>✨</span>
            <span>{reportToast}</span>
          </div>
        </div>
      )}

      {/* Bottom Cockpit Controls: Clean, Non-Intrusive Dock at Bottom Edge */}
      <div className="flex flex-col items-center gap-2.5 w-full pointer-events-none">
        {/* 1-Tap Live Road Hazard Report Bar (Docked at bottom edge, completely freeing windshield/road view) */}
        <div className="flex justify-center w-full pointer-events-auto px-1 sm:px-2 max-w-xl">
          <div className="apple-glass-hud rounded-2xl p-1.5 sm:p-2 shadow-2xl flex items-center gap-1 sm:gap-2 overflow-x-auto no-scrollbar max-w-full">
            <span className="text-[10px] font-bold uppercase text-amber-400 tracking-wider px-1 hidden md:inline shrink-0 apple-caption">
              Report Road:
            </span>

            {/* 🛑 Speed Breaker */}
            <button
              type="button"
              onClick={() => {
                if (onAddHazard) onAddHazard('speed-breaker', 'Speed Breaker');
                playHazardChime();
                setReportToast('🛑 Speed Breaker marked on road!');
                setTimeout(() => setReportToast(null), 3200);
              }}
              className="px-2 sm:px-2.5 py-1.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/35 border border-rose-500/50 text-rose-200 font-bold text-[11px] sm:text-xs flex items-center gap-1 apple-pressable cursor-pointer shrink-0"
              title="Speed Breaker"
            >
              <span className="text-base sm:text-sm">🛑</span>
              <span className="hidden sm:inline">Breaker</span>
            </button>

            {/* ↩️ Sharp Turn */}
            <button
              type="button"
              onClick={() => {
                if (onAddHazard) onAddHazard('sharp-turn', 'Sharp Turn');
                playHazardChime();
                setReportToast('↩️ Sharp Turn marked ahead!');
                setTimeout(() => setReportToast(null), 3200);
              }}
              className="px-2 sm:px-2.5 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/35 border border-amber-500/50 text-amber-200 font-bold text-[11px] sm:text-xs flex items-center gap-1 apple-pressable cursor-pointer shrink-0"
              title="Sharp Turn"
            >
              <span className="text-base sm:text-sm">↩️</span>
              <span className="hidden sm:inline">Sharp Turn</span>
            </button>

            {/* 🕳️ Pothole / Bad Road */}
            <button
              type="button"
              onClick={() => {
                if (onAddHazard) onAddHazard('pothole', 'Pothole');
                playHazardChime();
                setReportToast('🕳️ Pothole marked on road!');
                setTimeout(() => setReportToast(null), 3200);
              }}
              className="px-2 sm:px-2.5 py-1.5 rounded-xl bg-orange-500/20 hover:bg-orange-500/35 border border-orange-500/50 text-orange-200 font-bold text-[11px] sm:text-xs flex items-center gap-1 apple-pressable cursor-pointer shrink-0"
              title="Pothole"
            >
              <span className="text-base sm:text-sm">🕳️</span>
              <span className="hidden sm:inline">Pothole</span>
            </button>

            {/* 👮 Police Checkpoint */}
            <button
              type="button"
              onClick={() => {
                if (onAddHazard) onAddHazard('police', 'Police Checkpoint');
                playHazardChime();
                setReportToast('👮 Police Checkpoint reported!');
                setTimeout(() => setReportToast(null), 3200);
              }}
              className="px-2 sm:px-2.5 py-1.5 rounded-xl bg-blue-500/20 hover:bg-blue-500/35 border border-blue-500/50 text-blue-200 font-bold text-[11px] sm:text-xs flex items-center gap-1 apple-pressable cursor-pointer shrink-0"
              title="Police Checkpoint"
            >
              <span className="text-base sm:text-sm">👮</span>
              <span className="hidden sm:inline">Police</span>
            </button>

            {/* 🎯 Point Route Aiming Reticle Button */}
            {onTogglePointingPin && (
              <button
                type="button"
                onClick={onTogglePointingPin}
                className={`px-2 sm:px-2.5 py-1.5 rounded-xl border text-[11px] sm:text-xs font-bold flex items-center gap-1 apple-pressable cursor-pointer shrink-0 ${
                  isPointingPinMode
                    ? 'bg-[#007AFF] text-white border-blue-400 shadow-[0_0_15px_rgba(0,122,255,0.6)]'
                    : 'bg-white/10 hover:bg-white/15 border-white/15 text-slate-200'
                }`}
                title="Point on map to create or check route through spot"
              >
                <span className="text-base sm:text-sm">🎯</span>
                <span className="hidden sm:inline">{isPointingPinMode ? 'Aiming...' : 'Point Route'}</span>
              </button>
            )}
          </div>
        </div>

        {/* Bottom Cockpit Controls: Clean, Non-Intrusive Dock */}
        <div className="flex items-center justify-between gap-1.5 sm:gap-3 w-full">
          {/* Bottom Left: Destination Badge */}
          <div className="pointer-events-auto shrink-0">
            {rendezvousStats && (
              <div className="px-3 sm:px-4 py-1.5 sm:py-2 rounded-2xl apple-glass-pill text-[#FF9500] text-[11px] sm:text-xs font-bold flex items-center gap-1.5 apple-tabular">
                <span>🎯</span>
                <span>{rendezvousStats.distanceKm}</span>
                <span className="text-slate-500">•</span>
                <span>{rendezvousStats.etaMins} min</span>
              </div>
            )}
          </div>

          {/* Bottom Right: Cockpit Navigation Controls */}
          <div className="pointer-events-auto flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Demo Drive Simulation Toggle */}
            {onToggleSimulation && (
              <button
                type="button"
                onClick={onToggleSimulation}
                className={`px-3 py-1.5 sm:py-2 rounded-2xl font-bold text-[11px] sm:text-xs flex items-center gap-1.5 apple-pressable cursor-pointer ${
                  isSimulating
                    ? 'bg-[#34C759] text-white shadow-lg shadow-emerald-500/30'
                    : 'apple-glass-pill text-[#34C759] hover:bg-white/10'
                }`}
                title={isSimulating ? 'Stop Drive Simulation' : 'Simulate Live Convoy Drive along Road'}
              >
                {isSimulating ? <Square className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current" />}
                <span className="hidden sm:inline">{isSimulating ? 'Stop' : 'Sim'}</span>
              </button>
            )}

            {/* 3D Cockpit Tilt / 2D Plan View Toggle */}
            <button
              type="button"
              onClick={onToggle3DTilt}
              className={`px-3 py-1.5 sm:py-2 rounded-2xl font-bold text-[11px] sm:text-xs flex items-center gap-1.5 apple-pressable cursor-pointer ${
                is3DTiltActive
                  ? 'bg-[#FF9500] text-slate-950 shadow-lg shadow-amber-500/30'
                  : 'apple-glass-pill text-slate-300 hover:bg-white/10'
              }`}
              title="Toggle 3D Cockpit Perspective vs 2D Flat Plan"
            >
              <Compass className="w-4 h-4" />
              <span className="hidden sm:inline">{is3DTiltActive ? '3D' : '2D'}</span>
            </button>

            {/* Cancel Trip Button */}
            <button
              type="button"
              onClick={onExitTrip}
              className="px-3 py-1.5 sm:py-2 rounded-2xl apple-glass-pill bg-rose-950/40 hover:bg-rose-900/60 text-[#FF3B30] border border-rose-500/40 font-bold text-[11px] sm:text-xs flex items-center gap-1.5 apple-pressable cursor-pointer shadow-lg shadow-black/40"
              title="Cancel trip and return to squad overview"
            >
              <X className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#FF3B30]" />
              <span className="font-bold">Cancel Trip</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
