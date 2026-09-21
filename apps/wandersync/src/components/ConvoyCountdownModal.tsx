import React, { useEffect, useState, useRef } from 'react';
import { TravelerMember, TripCountdownEvent } from '../types';
import { ShieldCheck, CheckCircle2, X } from 'lucide-react';

interface ConvoyCountdownModalProps {
  countdown: TripCountdownEvent;
  members: TravelerMember[];
  currentUserId: string;
  onComplete: () => void;
  onCancel?: () => void;
}

// Web Audio API Sound Synthesizer synchronized with haptic vibration (WWDC Harmony on same frame)
function playBeep(freq: number, duration: number = 0.12, type: OscillatorType = 'sine', vibratePattern?: number | number[]) {
  try {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator && vibratePattern) {
      navigator.vibrate(vibratePattern);
    }
  } catch (e) {}

  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);

    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + duration);
  } catch (e) {
    // Audio might be muted or blocked by autoplay policy
  }
}

const COUNTDOWN_STEPS = [
  { num: 1, title: 'SYSTEM CHECK', desc: 'GPS Telemetry & Satellite Lock' },
  { num: 2, title: 'CONVOY SYNC', desc: 'Real-time V2V Frequency Linked' },
  { num: 3, title: 'RADAR CHANNELS', desc: 'Live Roadway Radar Online' },
  { num: 4, title: 'ENGINES GO!', desc: 'Convoy Rolling • Drive Safe!' },
];

export const ConvoyCountdownModal: React.FC<ConvoyCountdownModalProps> = ({
  countdown,
  members,
  currentUserId,
  onComplete,
  onCancel,
}) => {
  // We count 1 -> 2 -> 3 -> 4
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [isDone, setIsDone] = useState<boolean>(false);
  const completedRef = useRef(false);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    // Sound & Haptics on initial step 1
    playBeep(520, 0.15, 'triangle', 35);

    const timer = setInterval(() => {
      setCurrentStep((prev) => {
        const next = prev + 1;
        if (next === 2) {
          playBeep(660, 0.15, 'triangle', 40);
          return 2;
        }
        if (next === 3) {
          playBeep(880, 0.18, 'triangle', 45);
          return 3;
        }
        if (next === 4) {
          // Final countdown beat
          playBeep(1046, 0.35, 'square', [40, 80, 40, 80, 60]);
          return 4;
        }
        if (next > 4) {
          clearInterval(timer);
          setIsDone(true);
          if (!completedRef.current) {
            completedRef.current = true;
            setTimeout(() => {
              onCompleteRef.current();
            }, 500);
          }
          return 4;
        }
        return next;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const stepInfo = COUNTDOWN_STEPS[Math.min(currentStep - 1, 3)];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-lg apple-glass-card rounded-[32px] overflow-hidden text-white flex flex-col shadow-2xl">
        
        {/* Top Glowing Header */}
        <div className="px-6 pt-5 pb-4 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-xl shadow-[0_0_15px_rgba(245,158,11,0.5)]">
              🚀
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-[#FF9500] apple-caption">
                Synchronized Departure
              </span>
              <h2 className="text-base font-bold text-white tracking-tight apple-headline">
                CONVOY TRIP START
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-full apple-glass-pill text-[10px] text-amber-300 font-semibold apple-caption">
              by {countdown.startedBy}
            </span>
            {onCancel && (
              <button
                onClick={onCancel}
                className="p-1 rounded-full text-slate-400 hover:text-white hover:bg-white/10 apple-pressable cursor-pointer"
                title="Cancel departure"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Central 1, 2, 3, 4 Giant Countdown Gauge */}
        <div className="py-6 px-6 flex flex-col items-center justify-center text-center">
          <div className="relative flex items-center justify-center mb-3">
            {/* Pulsing Aura Rings */}
            <div
              className="absolute w-32 h-32 rounded-full border-2 border-amber-400/40 animate-ping opacity-30 pointer-events-none"
              style={{ animationDuration: '1s' }}
            />
            <div className="absolute w-28 h-28 rounded-full bg-gradient-to-tr from-amber-500/20 to-orange-500/10 blur-xl pointer-events-none" />

            {/* Main Number Container */}
            <div className="w-24 h-24 rounded-3xl apple-glass-pill border border-amber-400/60 shadow-[0_0_30px_rgba(245,158,11,0.5)] flex items-center justify-center transition-all duration-300 transform scale-105">
              <span className="text-6xl font-bold apple-tabular tracking-tighter bg-gradient-to-br from-amber-200 via-amber-400 to-orange-500 bg-clip-text text-transparent">
                {isDone ? '🏁' : currentStep}
              </span>
            </div>
          </div>

          {/* Current Step Name & Subtitle */}
          <div className="min-h-[52px]">
            <h3 className="text-lg font-black tracking-wider text-amber-300 uppercase">
              {isDone ? 'DEPARTURE COMMENCED!' : stepInfo.title}
            </h3>
            <p className="text-xs text-slate-300 font-medium mt-0.5">
              {isDone ? 'Entering driver navigation...' : stepInfo.desc}
            </p>
          </div>

          {/* Step 1-4 Progress Indicator Pips */}
          <div className="flex items-center gap-2 mt-4">
            {COUNTDOWN_STEPS.map((s) => {
              const isActive = s.num === currentStep;
              const isPast = s.num < currentStep || isDone;
              return (
                <div
                  key={s.num}
                  className={`h-2 rounded-full transition-all duration-300 ${
                    isActive
                      ? 'w-10 bg-amber-400 shadow-[0_0_10px_#f59e0b]'
                      : isPast
                      ? 'w-5 bg-emerald-500'
                      : 'w-5 bg-slate-800'
                  }`}
                />
              );
            })}
          </div>
        </div>

        {/* Friends Readiness Roster: Shows Who Friends Are and Ready Status */}
        <div className="px-6 py-4 bg-slate-950/90 border-t border-slate-800">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Squad Readiness Roster ({members.length})</span>
            </span>
            <span className="text-[10px] font-bold text-emerald-400 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              ALL READY
            </span>
          </div>

          {/* Scrollable list of all friends */}
          <div className="max-h-44 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
            {members.map((member) => {
              const isMe = member.id === currentUserId;
              return (
                <div
                  key={member.id}
                  className={`px-3 py-2 rounded-2xl flex items-center justify-between border transition ${
                    isMe
                      ? 'bg-amber-950/20 border-amber-500/40'
                      : 'bg-slate-900/80 border-slate-800'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="text-xl shrink-0">
                      {member.avatar || (member.mode === 'motorcycle' ? '🏍️' : '🚗')}
                    </span>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-white flex items-center gap-1.5 truncate">
                        <span>{member.name}</span>
                        {isMe && (
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                            YOU
                          </span>
                        )}
                        {member.isLeader && (
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">
                            👑 LEADER
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-400 flex items-center gap-1">
                        <span>{member.mode.toUpperCase()}</span>
                        <span>•</span>
                        <span className="text-emerald-400">GPS Linked</span>
                      </div>
                    </div>
                  </div>

                  {/* Ready Badge */}
                  <div className="shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-[10px] font-bold">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>READY TO ROLL</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Quick Start Immediate Action */}
        <div className="px-6 py-3.5 bg-slate-900 border-t border-slate-800/80 flex items-center justify-between">
          <span className="text-[11px] text-slate-400">
            Auto-starting in {Math.max(1, 4 - currentStep + 1)}s...
          </span>
          <button
            onClick={() => {
              if (!completedRef.current) {
                completedRef.current = true;
                onCompleteRef.current();
              }
            }}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black text-xs shadow-lg transition active:scale-95 cursor-pointer"
          >
            Start Immediately ⚡
          </button>
        </div>

      </div>
    </div>
  );
};
