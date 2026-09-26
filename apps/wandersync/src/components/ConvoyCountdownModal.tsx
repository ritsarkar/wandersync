import React, { useEffect, useState, useRef } from 'react';
import { TripCountdownEvent, TravelerMember } from '../types';
import { X } from 'lucide-react';

interface ConvoyCountdownModalProps {
  countdown: TripCountdownEvent;
  members?: TravelerMember[];
  currentUserId?: string;
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

    gain.gain.setValueAtTime(0.25, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + duration);
  } catch (e) {
    // Audio might be muted or blocked by browser autoplay policy
  }
}

export const ConvoyCountdownModal: React.FC<ConvoyCountdownModalProps> = ({
  onComplete,
  onCancel,
}) => {
  // Simple clean progression: 1 -> 2 -> 3 -> START!
  const [step, setStep] = useState<number>(1);
  const completedRef = useRef(false);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    // Sound & Haptic for "1"
    playBeep(520, 0.15, 'triangle', 35);

    const timer = setInterval(() => {
      setStep((prev) => {
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
          // Final START beat
          playBeep(1046, 0.35, 'square', [40, 80, 40, 80, 60]);
          return 4;
        }
        if (next > 4) {
          clearInterval(timer);
          if (!completedRef.current) {
            completedRef.current = true;
            onCompleteRef.current();
          }
          return 4;
        }
        return next;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const handleSkip = () => {
    if (!completedRef.current) {
      completedRef.current = true;
      onCompleteRef.current();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-md animate-fade-in select-none">
      <div className="relative w-full max-w-[280px] sm:max-w-xs apple-glass-card rounded-[32px] p-6 text-white flex flex-col items-center justify-center shadow-2xl border border-white/20 animate-modal-enter">
        
        {/* Subtle Cancel Button */}
        {onCancel && (
          <button
            onClick={onCancel}
            className="absolute top-4 right-4 p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-white/10 apple-pressable cursor-pointer"
            title="Cancel"
          >
            <X className="w-4 h-4" />
          </button>
        )}

        {/* Giant Animated Number / START */}
        <div className="my-4 flex items-center justify-center h-28">
          <div
            key={step}
            className="flex items-center justify-center transition-all duration-300"
          >
            {step < 4 ? (
              <span className="text-8xl font-black apple-tabular tracking-tighter bg-gradient-to-b from-white via-amber-200 to-amber-400 bg-clip-text text-transparent drop-shadow-[0_4px_24px_rgba(245,158,11,0.5)]">
                {step}
              </span>
            ) : (
              <div className="flex flex-col items-center gap-1">
                <span className="text-5xl font-black tracking-wider text-emerald-400 drop-shadow-[0_4px_24px_rgba(52,199,89,0.7)] animate-bounce">
                  START!
                </span>
                <span className="text-2xl">🚀</span>
              </div>
            )}
          </div>
        </div>

        {/* Minimal Progress Pips */}
        <div className="flex items-center gap-2 mb-2">
          {[1, 2, 3, 4].map((num) => (
            <div
              key={num}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                num === step
                  ? 'w-7 bg-amber-400 shadow-[0_0_10px_#f59e0b]'
                  : num < step
                  ? 'w-3 bg-emerald-400'
                  : 'w-3 bg-white/20'
              }`}
            />
          ))}
        </div>

        {/* Minimal Skip / Start Now */}
        <button
          onClick={handleSkip}
          className="mt-3 text-[11px] font-bold text-slate-400 hover:text-amber-300 transition apple-pressable cursor-pointer"
        >
          Tap to start now →
        </button>

      </div>
    </div>
  );
};
