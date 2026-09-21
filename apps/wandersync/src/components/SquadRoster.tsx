import React from 'react';
import { TravelerMember, TravelRoute } from '../types';
import { Users, Battery, Gauge, Compass, Radio, MapPin, Eye } from 'lucide-react';

interface SquadRosterProps {
  members: TravelerMember[];
  currentUserId: string;
  routes: TravelRoute[];
  selectedMemberId: string | null;
  onSelectMember: (memberId: string | null) => void;
  onAssignRoute: (userId: string, routeId: string) => void;
  onClose?: () => void;
}

export const SquadRoster: React.FC<SquadRosterProps> = ({
  members,
  currentUserId,
  routes,
  selectedMemberId,
  onSelectMember,
  onAssignRoute,
  onClose,
}) => {
  const movingCount = members.filter((m) => (m.location?.speed || 0) > 3).length;
  const idleCount = members.length - movingCount;

  return (
    <div className="flex flex-col h-full bg-slate-900/95 backdrop-blur-xl border-r border-slate-800 text-slate-100 p-4 overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              Squad Roster
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-800 text-emerald-400 border border-emerald-500/30">
                {members.length} Active
              </span>
            </h2>
            <div className="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
              <span className="flex items-center gap-1 text-emerald-400 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                {movingCount} moving
              </span>
              <span>•</span>
              <span className="text-slate-400">{idleCount} paused</span>
            </div>
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

      {/* Member Cards List */}
      <div className="mt-3 space-y-2.5 flex-1">
        {members.map((member) => {
          const isMe = member.id === currentUserId;
          const isSelected = member.id === selectedMemberId;
          const speed = Math.round(member.location?.speed || 0);
          const assignedRoute = routes.find((r) => r.id === member.assignedRouteId);

          return (
            <div
              key={member.id}
              onClick={() => onSelectMember(isSelected ? null : member.id)}
              className={`p-3 rounded-xl border transition-all cursor-pointer ${
                isSelected
                  ? 'bg-slate-800/90 border-blue-500 shadow-md shadow-blue-950/40 ring-1 ring-blue-500'
                  : 'bg-slate-800/40 border-slate-700/60 hover:bg-slate-800/70 hover:border-slate-600'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                {/* Avatar & Name */}
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className="relative w-10 h-10 rounded-full flex items-center justify-center text-lg shrink-0 shadow"
                    style={{ backgroundColor: `${member.color}22`, border: `2px solid ${member.color}` }}
                  >
                    {member.avatar}
                    {speed > 3 && (
                      <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-slate-900 animate-ping"></span>
                    )}
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-sm text-white truncate max-w-[120px]">
                        {member.name}
                      </span>
                      {isMe && (
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-blue-500/30 text-blue-300 font-semibold border border-blue-400/40">
                          YOU
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                      <span className="capitalize">{member.mode}</span>
                      <span>•</span>
                      <span className="flex items-center gap-0.5 text-slate-300 font-mono">
                        <Gauge className="w-3 h-3 text-blue-400" />
                        {speed} km/h
                      </span>
                    </div>
                  </div>
                </div>

                {/* Right quick telemetry: Battery & Focus */}
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <div className="flex items-center gap-1 text-[10px] font-mono text-slate-400">
                    <Battery className={`w-3.5 h-3.5 ${(member.location?.battery || 85) < 20 ? 'text-red-400' : 'text-emerald-400'}`} />
                    <span>{member.location?.battery || 85}%</span>
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectMember(member.id);
                    }}
                    className="p-1 rounded-md bg-slate-700/60 hover:bg-blue-600 text-slate-300 hover:text-white transition text-[10px] flex items-center gap-1"
                    title="Focus on Map"
                  >
                    <Eye className="w-3 h-3" />
                  </button>
                </div>
              </div>

              {/* Assigned Route Badge & Switcher */}
              <div className="mt-2.5 pt-2 border-t border-slate-700/40 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 text-[11px] min-w-0">
                  <Compass className="w-3 h-3 text-slate-400 shrink-0" />
                  <span className="text-slate-400 shrink-0">Route:</span>
                  {assignedRoute ? (
                    <span
                      className="text-[10px] font-semibold px-2 py-0.5 rounded-full truncate"
                      style={{
                        backgroundColor: `${assignedRoute.color}25`,
                        color: assignedRoute.color,
                        border: `1px solid ${assignedRoute.color}40`,
                      }}
                    >
                      {assignedRoute.name}
                    </span>
                  ) : (
                    <span className="text-[10px] text-slate-500 italic">Unassigned</span>
                  )}
                </div>

                {/* Quick Route Switch Dropdown */}
                {(() => {
                  const memberRoutes = routes.filter((r) => !r.forUserId || r.forUserId === member.id);
                  const selectRoutes = memberRoutes.length > 0 ? memberRoutes : routes;
                  return (
                    <select
                      value={member.assignedRouteId || ''}
                      onChange={(e) => onAssignRoute(member.id, e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      className="bg-slate-900 border border-slate-700 text-slate-300 text-[10px] rounded px-1.5 py-0.5 outline-none hover:border-slate-500 cursor-pointer"
                    >
                      <option value="" disabled>Change Route</option>
                      {selectRoutes.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name}
                        </option>
                      ))}
                    </select>
                  );
                })()}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
