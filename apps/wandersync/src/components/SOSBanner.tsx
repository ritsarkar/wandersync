import React from 'react';
import { AlertTriangle, MapPin, X } from 'lucide-react';
import { GroupMessage } from '../types';

interface SOSBannerProps {
  activeSOS: GroupMessage | null;
  onFocusSOSLocation: (loc: { lat: number; lng: number }) => void;
  onDismiss: () => void;
}

export const SOSBanner: React.FC<SOSBannerProps> = ({
  activeSOS,
  onFocusSOSLocation,
  onDismiss,
}) => {
  if (!activeSOS) return null;

  return (
    <div className="absolute top-16 left-4 right-4 md:left-auto md:right-4 md:max-w-md z-40 animate-bounce-short">
      <div className="p-3.5 rounded-2xl bg-red-600 text-white shadow-2xl shadow-red-950/80 border-2 border-red-300 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-red-800/80 text-white animate-pulse shrink-0">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-black uppercase tracking-wider text-red-200">
              🚨 Squad Emergency Alert
            </div>
            <div className="text-sm font-bold text-white mt-0.5">
              {activeSOS.senderName} signaled for assistance!
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {activeSOS.location && (
            <button
              onClick={() => onFocusSOSLocation(activeSOS.location!)}
              className="px-2.5 py-1.5 rounded-xl bg-white text-red-600 font-bold text-xs hover:bg-red-50 transition shadow flex items-center gap-1"
            >
              <MapPin className="w-3.5 h-3.5" />
              <span>Locate</span>
            </button>
          )}

          <button
            onClick={onDismiss}
            className="p-1.5 rounded-xl hover:bg-red-700 text-white transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
