import React, { useState } from 'react';
import {
  Compass,
  Copy,
  Check,
  Layers,
  MapPin,
  Navigation,
  Maximize2,
  AlertTriangle,
  MessageSquare,
  Users,
  Route,
} from 'lucide-react';
import { MapTileStyle } from '../types';

interface TravelerHUDProps {
  groupId: string;
  memberCount: number;
  tileStyle: MapTileStyle;
  onChangeTileStyle: (style: MapTileStyle) => void;
  isSettingRendezvous: boolean;
  onToggleSetRendezvous: () => void;
  isTrackingGPS: boolean;
  onToggleGPS: () => void;
  onTriggerSOS: () => void;
  showRoster: boolean;
  onToggleRoster: () => void;
  showRouteComparison: boolean;
  onToggleRouteComparison: () => void;
  showChat: boolean;
  onToggleChat: () => void;
  unreadChatCount: number;
}

export const TravelerHUD: React.FC<TravelerHUDProps> = ({
  groupId,
  memberCount,
  tileStyle,
  onChangeTileStyle,
  isSettingRendezvous,
  onToggleSetRendezvous,
  isTrackingGPS,
  onToggleGPS,
  onTriggerSOS,
  showRoster,
  onToggleRoster,
  showRouteComparison,
  onToggleRouteComparison,
  showChat,
  onToggleChat,
  unreadChatCount,
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopyCode = () => {
    navigator.clipboard.writeText(groupId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleFitAll = () => {
    window.dispatchEvent(new CustomEvent('wandersync:fit_all'));
  };

  return (
    <header className="absolute top-3 left-3 right-3 z-20 flex items-center justify-between pointer-events-none gap-2">
      {/* Left: Brand & Room Code Pill */}
      <div className="flex items-center gap-2 pointer-events-auto">
        <div className="glass-panel px-3 py-2 rounded-2xl flex items-center gap-2.5 shadow-xl">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-500 flex items-center justify-center text-white shadow-md shadow-emerald-900/40">
            <Compass className="w-5 h-5 animate-spin-slow" />
          </div>
          <div className="hidden sm:block">
            <h1 className="text-xs font-black tracking-wider uppercase bg-gradient-to-r from-emerald-400 via-teal-300 to-blue-400 bg-clip-text text-transparent">
              WanderSync
            </h1>
            <p className="text-[10px] text-slate-400 font-medium">Group Travel Radar</p>
          </div>

          <div className="h-5 w-[1px] bg-slate-700 hidden sm:block"></div>

          {/* Group Code Copy Button */}
          <button
            onClick={handleCopyCode}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-800/90 hover:bg-slate-700 border border-slate-700/80 text-xs font-mono font-bold text-emerald-400 transition shadow-inner"
            title="Click to copy Group Invite Code"
          >
            <span>{groupId}</span>
            {copied ? (
              <Check className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <Copy className="w-3.5 h-3.5 text-slate-400 hover:text-white" />
            )}
          </button>
        </div>

        {/* Squad Members Quick Counter */}
        <button
          onClick={onToggleRoster}
          className={`glass-panel px-3 py-2 rounded-2xl flex items-center gap-2 text-xs font-bold transition shadow-xl ${
            showRoster ? 'bg-blue-600/30 border-blue-500/50 text-blue-300' : 'text-slate-200 hover:text-white'
          }`}
        >
          <Users className="w-4 h-4 text-emerald-400" />
          <span>{memberCount} Friends</span>
        </button>
      </div>

      {/* Right: Map Tools & Drawers */}
      <div className="flex items-center gap-2 pointer-events-auto">
        {/* Layer Switcher */}
        <div className="relative group">
          <button className="glass-panel p-2.5 rounded-2xl text-slate-300 hover:text-white transition shadow-xl flex items-center justify-center">
            <Layers className="w-4 h-4" />
          </button>
          <div className="absolute right-0 top-12 hidden group-hover:flex flex-col gap-1 p-2 glass-panel rounded-xl shadow-2xl min-w-[130px] z-50">
            <div className="text-[10px] text-slate-400 font-bold px-2 py-1 uppercase">Map Style</div>
            {(['dark', 'streets', 'satellite', 'terrain'] as MapTileStyle[]).map((style) => (
              <button
                key={style}
                onClick={() => onChangeTileStyle(style)}
                className={`text-left px-2.5 py-1.5 rounded-lg text-xs capitalize transition ${
                  tileStyle === style
                    ? 'bg-emerald-500/20 text-emerald-300 font-bold'
                    : 'text-slate-300 hover:bg-slate-800'
                }`}
              >
                {style}
              </button>
            ))}
          </div>
        </div>

        {/* Fit All Friends */}
        <button
          onClick={handleFitAll}
          className="glass-panel p-2.5 rounded-2xl text-slate-300 hover:text-white transition shadow-xl"
          title="Fit all friends on map"
        >
          <Maximize2 className="w-4 h-4" />
        </button>

        {/* Set Destination Pin */}
        <button
          onClick={onToggleSetRendezvous}
          className={`glass-panel p-2.5 rounded-2xl transition shadow-xl flex items-center gap-1.5 text-xs font-semibold ${
            isSettingRendezvous
              ? 'bg-amber-500 text-slate-950 font-bold shadow-amber-500/30 ring-2 ring-amber-400'
              : 'text-slate-300 hover:text-white'
          }`}
          title="Drop Target Meeting Pin"
        >
          <MapPin className="w-4 h-4 text-amber-400" />
          <span className="hidden md:inline">Rendezvous</span>
        </button>

        {/* Real Device GPS Tracking */}
        <button
          onClick={onToggleGPS}
          className={`glass-panel p-2.5 rounded-2xl transition shadow-xl flex items-center gap-1.5 text-xs font-semibold ${
            isTrackingGPS
              ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300 ring-1 ring-emerald-500'
              : 'text-slate-300 hover:text-white'
          }`}
          title="Use device GPS"
        >
          <Navigation className={`w-4 h-4 ${isTrackingGPS ? 'text-emerald-400 animate-pulse' : 'text-slate-400'}`} />
          <span className="hidden md:inline">GPS</span>
        </button>

        {/* Route Comparison Panel Toggle */}
        <button
          onClick={onToggleRouteComparison}
          className={`glass-panel p-2.5 rounded-2xl transition shadow-xl flex items-center gap-1.5 text-xs font-semibold ${
            showRouteComparison
              ? 'bg-blue-600/30 border-blue-500/50 text-blue-300 ring-1 ring-blue-500'
              : 'text-slate-300 hover:text-white'
          }`}
          title="Compare Multi-Routes & ETAs"
        >
          <Route className="w-4 h-4 text-blue-400" />
          <span className="hidden lg:inline">Routes & ETAs</span>
        </button>

        {/* Squad Chat Drawer Toggle */}
        <button
          onClick={onToggleChat}
          className={`relative glass-panel p-2.5 rounded-2xl transition shadow-xl ${
            showChat ? 'bg-purple-600/30 border-purple-500/50 text-purple-300' : 'text-slate-300 hover:text-white'
          }`}
          title="Squad Chat & Pings"
        >
          <MessageSquare className="w-4 h-4 text-purple-400" />
          {unreadChatCount > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-purple-500 text-[10px] font-bold text-white flex items-center justify-center">
              {unreadChatCount}
            </span>
          )}
        </button>

        {/* Emergency SOS Button */}
        <button
          onClick={onTriggerSOS}
          className="p-2.5 rounded-2xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs shadow-xl shadow-red-950/50 transition flex items-center gap-1 active:scale-95"
          title="Emergency Distress Beacon"
        >
          <AlertTriangle className="w-4 h-4 animate-bounce" />
          <span className="hidden sm:inline">SOS</span>
        </button>
      </div>
    </header>
  );
};
