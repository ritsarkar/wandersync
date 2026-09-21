import React from 'react';
import { TravelRoute, TravelerMember, RendezvousPoint } from '../types';
import { calculateDistanceKm } from '../../server/routingService.js';
import { Compass, Clock, MapPin, Users, ArrowRight, Zap, CheckCircle2, ChevronRight, Shuffle } from 'lucide-react';

interface RouteComparisonPanelProps {
  routes: TravelRoute[];
  members: TravelerMember[];
  currentUserId: string;
  rendezvous: RendezvousPoint | null;
  onAssignRoute: (userId: string, routeId: string) => void;
  onClose?: () => void;
}

export const RouteComparisonPanel: React.FC<RouteComparisonPanelProps> = ({
  routes,
  members,
  currentUserId,
  rendezvous,
  onAssignRoute,
  onClose,
}) => {
  // Compute metrics for each route
  const routeStats = routes.map((route) => {
    const assignedFriends = members.filter((m) => m.assignedRouteId === route.id);
    
    // Calculate live average speed and remaining distance for assigned members
    let totalSpeed = 0;
    let totalRemainingKm = 0;
    let memberCountWithLoc = 0;

    assignedFriends.forEach((m) => {
      if (m.location && rendezvous) {
        const dist = calculateDistanceKm(m.location.lat, m.location.lng, rendezvous.lat, rendezvous.lng);
        totalRemainingKm += dist;
        totalSpeed += (m.location.speed || 40);
        memberCountWithLoc++;
      }
    });

    const avgSpeed = memberCountWithLoc > 0 ? Math.round(totalSpeed / memberCountWithLoc) : 60;
    const avgRemainingKm = memberCountWithLoc > 0 ? +(totalRemainingKm / memberCountWithLoc).toFixed(1) : route.distanceKm;
    
    // Dynamic remaining ETA in minutes
    const liveEtaMins = avgSpeed > 5 ? Math.max(1, Math.round((avgRemainingKm / avgSpeed) * 60)) : route.durationMins;

    return {
      route,
      assignedFriends,
      avgSpeed,
      avgRemainingKm,
      liveEtaMins,
    };
  });

  // Sort routes by quickest ETA to display leaderboard
  const sortedStats = [...routeStats].sort((a, b) => a.liveEtaMins - b.liveEtaMins);
  const quickestRoute = sortedStats[0];
  const slowestRoute = sortedStats[sortedStats.length - 1];
  const timeDifferenceMins = quickestRoute && slowestRoute && quickestRoute !== slowestRoute 
    ? Math.max(0, slowestRoute.liveEtaMins - quickestRoute.liveEtaMins) 
    : 0;

  const currentUser = members.find((m) => m.id === currentUserId);

  return (
    <div className="flex flex-col h-full bg-slate-900/95 backdrop-blur-xl border-l border-slate-800 text-slate-100 p-4 overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-blue-500/20 text-blue-400">
            <Compass className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              Route Intelligence & ETA
            </h2>
            <p className="text-xs text-slate-400">Compare friend progress & multi-route travel times</p>
          </div>
        </div>
        {onClose && (
          <button 
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            ✕
          </button>
        )}
      </div>

      {/* Target Rendezvous Banner */}
      <div className="mt-3 p-3 rounded-xl bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-500/30 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MapPin className="w-4 h-4 text-amber-400 animate-bounce" />
          <div>
            <div className="text-[11px] text-amber-300 font-semibold uppercase tracking-wider">Common Destination</div>
            <div className="text-xs font-bold text-slate-200">{rendezvous?.title || 'Rendezvous Point'}</div>
          </div>
        </div>
        <span className="text-[11px] bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full font-medium">
          Target
        </span>
      </div>

      {/* Time Differential Highlight (As requested by user!) */}
      {timeDifferenceMins > 0 && (
        <div className="mt-3 p-3 rounded-xl bg-blue-950/60 border border-blue-500/30 text-xs">
          <div className="flex items-center gap-2 text-blue-400 font-semibold mb-1">
            <Zap className="w-4 h-4 text-yellow-400" />
            <span>Time Variance Detected</span>
          </div>
          <p className="text-slate-300 text-[11px] leading-relaxed">
            Friends on <strong className="text-blue-400">{quickestRoute.route.name}</strong> are currently arriving <strong className="text-emerald-400">{timeDifferenceMins} minutes faster</strong> than friends taking <strong className="text-amber-400">{slowestRoute.route.name}</strong>.
          </p>
        </div>
      )}

      {/* Routes List */}
      <div className="mt-4 space-y-3 flex-1">
        {routeStats.map(({ route, assignedFriends, avgSpeed, avgRemainingKm, liveEtaMins }) => {
          const isUserOnThisRoute = currentUser?.assignedRouteId === route.id;
          const isFastest = route.id === quickestRoute?.route.id;

          return (
            <div
              key={route.id}
              className={`p-3 rounded-xl border transition-all ${
                isUserOnThisRoute
                  ? 'bg-slate-800/90 border-blue-500/60 shadow-lg shadow-blue-950/50'
                  : 'bg-slate-800/40 border-slate-700/60 hover:border-slate-600'
              }`}
            >
              {/* Route Title & Color Bar */}
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <span
                    className="w-3 h-3 rounded-full shrink-0 shadow-sm"
                    style={{ backgroundColor: route.color }}
                  />
                  <div>
                    <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
                      {route.name}
                      {isFastest && (
                        <span className="text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-1.5 py-0.2 rounded font-semibold">
                          Fastest
                        </span>
                      )}
                    </h3>
                    {route.tag && (
                      <span className="text-[10px] text-slate-400">{route.tag}</span>
                    )}
                  </div>
                </div>

                {/* My Route Indicator or Switch Button */}
                {isUserOnThisRoute ? (
                  <span className="flex items-center gap-1 text-[11px] bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded-full font-semibold border border-blue-500/40">
                    <CheckCircle2 className="w-3 h-3 text-blue-400" />
                    My Route
                  </span>
                ) : (
                  <button
                    onClick={() => onAssignRoute(currentUserId, route.id)}
                    className="text-[10px] bg-slate-700/80 hover:bg-blue-600 text-slate-200 hover:text-white px-2 py-0.5 rounded-full font-medium transition flex items-center gap-1"
                  >
                    <span>Take This</span>
                    <ArrowRight className="w-2.5 h-2.5" />
                  </button>
                )}
              </div>

              {/* Dynamic Stats Grid */}
              <div className="grid grid-cols-3 gap-2 my-2.5 py-2 px-2.5 rounded-lg bg-slate-900/60 border border-slate-800/80 text-center">
                <div>
                  <div className="text-[10px] text-slate-400 font-medium flex items-center justify-center gap-1">
                    <Clock className="w-3 h-3 text-slate-400" /> ETA
                  </div>
                  <div className="text-xs font-bold text-emerald-400 mt-0.5">
                    ~{liveEtaMins} min
                  </div>
                </div>

                <div>
                  <div className="text-[10px] text-slate-400 font-medium flex items-center justify-center gap-1">
                    <MapPin className="w-3 h-3 text-slate-400" /> Left
                  </div>
                  <div className="text-xs font-bold text-blue-400 mt-0.5">
                    {avgRemainingKm} km
                  </div>
                </div>

                <div>
                  <div className="text-[10px] text-slate-400 font-medium flex items-center justify-center gap-1">
                    <Zap className="w-3 h-3 text-slate-400" /> Avg Spd
                  </div>
                  <div className="text-xs font-bold text-purple-400 mt-0.5">
                    {avgSpeed} km/h
                  </div>
                </div>
              </div>

              {/* Friends assigned to this route */}
              <div className="pt-2 border-t border-slate-700/50">
                <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1.5">
                  <span className="flex items-center gap-1">
                    <Users className="w-3 h-3" />
                    Squad on this route ({assignedFriends.length})
                  </span>
                  <span className="text-[10px] text-slate-500">
                    {assignedFriends.length === 1 ? '1 friend' : `${assignedFriends.length} friends`}
                  </span>
                </div>

                {assignedFriends.length === 0 ? (
                  <p className="text-[11px] text-slate-500 italic">No friends assigned yet. Tap "Take This" or switch friends in squad list.</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {assignedFriends.map((friend) => (
                      <div
                        key={friend.id}
                        className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-900/80 border border-slate-700 text-slate-300 text-[11px]"
                        style={{ borderLeftColor: friend.color, borderLeftWidth: 3 }}
                      >
                        <span>{friend.avatar}</span>
                        <span className="font-medium truncate max-w-[80px]">{friend.id === currentUserId ? 'You' : friend.name}</span>
                        <span className="text-[9px] text-slate-400 font-mono">
                          {Math.round(friend.location?.speed || 0)}k
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Quick Route Splitting Action */}
      <div className="mt-4 pt-3 border-t border-slate-800">
        <button
          onClick={() => {
            // Split squad 50/50 between Route 1 and Route 2
            if (routes.length >= 2) {
              members.forEach((m, idx) => {
                const targetRoute = routes[idx % 2];
                onAssignRoute(m.id, targetRoute.id);
              });
            }
          }}
          className="w-full py-2 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 hover:text-white text-xs font-semibold flex items-center justify-center gap-2 transition"
        >
          <Shuffle className="w-3.5 h-3.5 text-blue-400" />
          Auto-Split Squad Across Routes (3 vs 4)
        </button>
      </div>
    </div>
  );
};
