import React from 'react';
import { Play, Pause, RotateCcw, FastForward, Sliders, Sparkles } from 'lucide-react';
import { SIMULATION_PRESETS, SimulationPreset } from '../services/routeSimulation';

interface SimulationControllerProps {
  isPlaying: boolean;
  onTogglePlay: () => void;
  speedMultiplier: number;
  onChangeSpeed: (multiplier: number) => void;
  onResetSimulation: () => void;
  currentPresetId: string;
  onSelectPreset: (preset: SimulationPreset) => void;
  simulatedCount: number;
}

export const SimulationController: React.FC<SimulationControllerProps> = ({
  isPlaying,
  onTogglePlay,
  speedMultiplier,
  onChangeSpeed,
  onResetSimulation,
  currentPresetId,
  onSelectPreset,
  simulatedCount,
}) => {
  return (
    <div className="glass-panel rounded-2xl p-3 text-slate-100 shadow-2xl flex flex-col md:flex-row items-center justify-between gap-3 max-w-xl w-full">
      {/* Left: Preset Selector & Status */}
      <div className="flex items-center gap-2.5 w-full md:w-auto">
        <div className="p-2 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-600 text-white shrink-0 shadow-lg shadow-purple-900/30">
          <Sparkles className="w-4 h-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-bold text-white">Travel Simulator</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-purple-500/20 text-purple-300 font-semibold border border-purple-500/30">
              {simulatedCount} Friends Live
            </span>
          </div>
          <select
            value={currentPresetId}
            onChange={(e) => {
              const preset = SIMULATION_PRESETS.find((p) => p.id === e.target.value);
              if (preset) onSelectPreset(preset);
            }}
            className="mt-1 w-full bg-slate-800/90 border border-slate-700 text-slate-200 text-xs rounded-lg px-2 py-1 outline-none hover:border-purple-400 cursor-pointer transition font-medium"
          >
            {SIMULATION_PRESETS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Right: Playback Controls */}
      <div className="flex items-center gap-2 w-full md:w-auto justify-end">
        {/* Reset */}
        <button
          onClick={onResetSimulation}
          className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition"
          title="Reset Movement"
        >
          <RotateCcw className="w-4 h-4" />
        </button>

        {/* Play / Pause */}
        <button
          onClick={onTogglePlay}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl font-bold text-xs shadow-lg transition ${
            isPlaying
              ? 'bg-amber-500 hover:bg-amber-600 text-slate-950 shadow-amber-500/20'
              : 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-emerald-500/20'
          }`}
        >
          {isPlaying ? (
            <>
              <Pause className="w-4 h-4" />
              <span>Pause</span>
            </>
          ) : (
            <>
              <Play className="w-4 h-4 fill-current" />
              <span>Drive</span>
            </>
          )}
        </button>

        {/* Speed Multiplier Pill */}
        <div className="flex items-center bg-slate-800/80 p-0.5 rounded-xl border border-slate-700">
          {[1, 2, 5].map((speed) => (
            <button
              key={speed}
              onClick={() => onChangeSpeed(speed)}
              className={`px-2 py-1 text-[11px] font-bold rounded-lg transition ${
                speedMultiplier === speed
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {speed}x
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
