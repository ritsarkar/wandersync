import React, { useState, useEffect, useRef } from 'react';
import { Search, MapPin, Loader2, X } from 'lucide-react';

export interface PlaceSuggestion {
  placeId: string;
  text: string;
  mainText: string;
  secondaryText: string;
}

export interface GooglePlaceSearchInputProps {
  onSelectPlace: (place: { lat: number; lng: number; name: string; formattedAddress: string }) => void;
  placeholder?: string;
  initialValue?: string;
  className?: string;
  autoFocus?: boolean;
}

export const GooglePlaceSearchInput: React.FC<GooglePlaceSearchInputProps> = ({
  onSelectPlace,
  placeholder = 'Search Google Maps location (e.g. Gangarampur)...',
  initialValue = '',
  className = '',
  autoFocus = false,
}) => {
  const [query, setQuery] = useState(initialValue);
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isResolvingPlace, setIsResolvingPlace] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const debounceTimerRef = useRef<any>(null);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch suggestions with debounce when typing
  const handleInputChange = (val: string) => {
    setQuery(val);

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    if (!val.trim()) {
      setSuggestions([]);
      setIsOpen(false);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    debounceTimerRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/places/autocomplete?input=${encodeURIComponent(val)}`);
        const data = await res.json();
        if (data && Array.isArray(data.suggestions)) {
          setSuggestions(data.suggestions);
          setIsOpen(data.suggestions.length > 0);
        } else {
          setSuggestions([]);
          setIsOpen(false);
        }
      } catch (err) {
        console.warn('Autocomplete fetch error:', err);
      } finally {
        setIsLoading(false);
      }
    }, 180);
  };

  // Handle clicking a suggestion
  const handleSelectSuggestion = async (item: PlaceSuggestion) => {
    setQuery(item.mainText || item.text);
    setIsOpen(false);
    setIsResolvingPlace(true);

    try {
      const res = await fetch(`/api/places/details?placeId=${encodeURIComponent(item.placeId)}`);
      const data = await res.json();
      if (data && data.success && data.lat != null && data.lng != null) {
        onSelectPlace({
          lat: data.lat,
          lng: data.lng,
          name: data.name || item.mainText,
          formattedAddress: data.formattedAddress || item.text,
        });
      } else {
        alert('Could not get coordinates for this place. Please try another.');
      }
    } catch (err) {
      console.warn('Place details fetch error:', err);
      alert('Network error while getting location details.');
    } finally {
      setIsResolvingPlace(false);
    }
  };

  const handleClear = () => {
    setQuery('');
    setSuggestions([]);
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className={`relative w-full ${className}`}>
      <div className="relative flex items-center">
        <Search className="w-4 h-4 absolute left-3 text-slate-400 pointer-events-none" />
        <input
          type="text"
          value={query}
          onChange={(e) => handleInputChange(e.target.value)}
          onFocus={() => {
            if (suggestions.length > 0) setIsOpen(true);
          }}
          placeholder={placeholder}
          autoFocus={autoFocus}
          className="w-full bg-slate-800 border border-slate-700 focus:border-emerald-500 rounded-2xl pl-9 pr-9 py-2.5 text-xs text-white placeholder-slate-400 outline-none transition font-medium shadow-inner"
        />
        <div className="absolute right-3 flex items-center gap-1.5">
          {isLoading || isResolvingPlace ? (
            <Loader2 className="w-3.5 h-3.5 text-emerald-400 animate-spin" />
          ) : query ? (
            <button
              type="button"
              onClick={handleClear}
              className="text-slate-400 hover:text-white p-0.5 rounded transition"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          ) : null}
        </div>
      </div>

      {/* Floating Google Places Autocomplete Suggestions Dropdown */}
      {isOpen && suggestions.length > 0 && (
        <div className="absolute left-0 right-0 top-full mt-1.5 bg-slate-900/98 backdrop-blur-xl border border-slate-700/90 rounded-2xl shadow-2xl overflow-hidden z-50 max-h-60 overflow-y-auto divide-y divide-slate-800/80 animate-in fade-in zoom-in-95 duration-100">
          <div className="px-3 py-1.5 bg-slate-950/60 text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
            <span>Google Maps Locations</span>
            <span className="text-[9px] text-emerald-400 font-semibold">Live Suggestions</span>
          </div>

          {suggestions.map((item) => (
            <div
              key={item.placeId}
              onClick={() => handleSelectSuggestion(item)}
              className="px-3 py-2.5 hover:bg-slate-800/90 cursor-pointer flex items-center gap-2.5 transition active:bg-slate-700/80 group text-left"
            >
              <div className="w-6 h-6 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center shrink-0 group-hover:scale-110 transition">
                <MapPin className="w-3.5 h-3.5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-bold text-white group-hover:text-emerald-300 truncate">
                  {item.mainText || item.text}
                </div>
                {item.secondaryText && (
                  <div className="text-[10px] text-slate-400 truncate">
                    {item.secondaryText}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
