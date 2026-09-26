import React from 'react';
import { Navigation, ShieldCheck, AlertCircle, X, Loader2, Compass } from 'lucide-react';

interface LocationPermissionModalProps {
  isOpen: boolean;
  status: 'prompt' | 'granted' | 'denied' | 'locating' | 'error';
  error: string | null;
  onAllow: () => void;
  onDismiss: () => void;
}

export const LocationPermissionModal: React.FC<LocationPermissionModalProps> = ({
  isOpen,
  status,
  error,
  onAllow,
  onDismiss,
}) => {
  if (!isOpen || status === 'granted') return null;

  const isLocating = status === 'locating';
  const isDenied = status === 'denied' || status === 'error';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div className="bg-slate-900 border border-slate-700/80 w-full max-w-sm rounded-3xl p-6 shadow-2xl relative text-slate-100 flex flex-col items-center text-center animate-modal-enter">
        
        {/* Close / Dismiss button */}
        <button
          onClick={onDismiss}
          className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white transition"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Animated Icon with Radar Pulse */}
        <div className="relative my-3 flex items-center justify-center">
          <div className="absolute w-20 h-20 rounded-full bg-emerald-500/20 animate-ping pointer-events-none" />
          <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center shadow-lg shadow-emerald-600/30 text-white">
            {isLocating ? (
              <Loader2 className="w-8 h-8 animate-spin" />
            ) : isDenied ? (
              <AlertCircle className="w-8 h-8 text-amber-200" />
            ) : (
              <Navigation className="w-8 h-8 fill-white/20 transform -rotate-45" />
            )}
          </div>
        </div>

        {/* Modal Title */}
        <h2 className="text-lg font-black text-white mt-2">
          {isDenied
            ? 'Location Permission Needed'
            : isLocating
            ? 'Acquiring GPS Signal...'
            : 'Allow Location Access'}
        </h2>

        {/* Explanatory Message */}
        <p className="text-xs text-slate-300 mt-2 leading-relaxed max-w-[270px]">
          {isDenied ? (
            error || 'Location access was denied or blocked in your browser. Please allow permission to enable live navigation.'
          ) : isLocating ? (
            'Connecting to satellite GPS and wireless triangulation to lock your real-time position...'
          ) : (
            'Tap Allow so your squad can see your live position on the mountain convoy map and calculate real road routes.'
          )}
        </p>

        {/* Privacy Assurance Badge */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-800/80 border border-slate-700/60 text-slate-300 text-[11px] font-medium my-3">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span>Private to your squad only</span>
        </div>

        {/* Denied / Blocked Browser Instructions */}
        {isDenied && (
          <div className="w-full text-left p-3 rounded-2xl bg-slate-800/90 border border-amber-500/40 text-[11px] text-slate-300 space-y-1.5 my-2">
            <div className="font-bold text-amber-300 flex items-center gap-1">
              <span>⚠️ How to enable in browser:</span>
            </div>
            <div>
              <strong>📱 iPhone Safari:</strong> Tap <span className="font-mono text-emerald-300">aA</span> in URL bar → <em>Website Settings</em> → <em>Location: Allow</em>.
            </div>
            <div>
              <strong>🤖 Android Chrome:</strong> Tap the lock or tune icon in URL bar → <em>Permissions</em> → <em>Location: Allow</em>.
            </div>
          </div>
        )}

        {/* Primary Action Button: "Allow" */}
        <button
          onClick={onAllow}
          disabled={isLocating}
          className={`w-full py-3.5 px-5 rounded-2xl font-black text-sm shadow-xl flex items-center justify-center gap-2 transition active:scale-95 cursor-pointer mt-2 ${
            isLocating
              ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
              : isDenied
              ? 'bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-white shadow-orange-500/30'
              : 'bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white shadow-emerald-500/30'
          }`}
        >
          {isLocating ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Finding GPS...</span>
            </>
          ) : isDenied ? (
            <>
              <Compass className="w-4 h-4" />
              <span>Retry / Allow Location</span>
            </>
          ) : (
            <>
              <Navigation className="w-4 h-4 fill-white/20" />
              <span>Allow</span>
            </>
          )}
        </button>

        {/* Secondary Dismiss Button */}
        <button
          onClick={onDismiss}
          className="mt-2.5 py-1.5 px-4 text-xs font-semibold text-slate-400 hover:text-slate-200 transition"
        >
          Maybe Later
        </button>

      </div>
    </div>
  );
};
