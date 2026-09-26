import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import { TravelerMember, TravelRoute, RendezvousPoint, MapTileStyle } from '../types';
import { escapeHtml } from '../utils/security';

interface MapViewProps {
  members: TravelerMember[];
  currentUserId: string;
  routes: TravelRoute[];
  rendezvous: RendezvousPoint | null;
  tileStyle: MapTileStyle;
  isSettingRendezvous: boolean;
  onSelectLocationForRendezvous: (lat: number, lng: number) => void;
  selectedMemberId: string | null;
  onSelectMember: (memberId: string | null) => void;
  followMe: boolean;
}

const TILE_LAYERS: Record<MapTileStyle, { url: string; attribution: string; maxZoom: number }> = {
  terrain: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',
    attribution: '&copy; Esri, USGS, NOAA &mdash; Mountain Topo Relief',
    maxZoom: 18,
  },
  satellite: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: '&copy; Esri, Earthstar Geographics &mdash; Satellite View',
    maxZoom: 18,
  },
  streets: {
    url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
    attribution: '&copy; CARTO &mdash; Clean Roads',
    maxZoom: 19,
  },
  dark: {
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; CARTO &mdash; Night Mode',
    maxZoom: 19,
  },
};

export const MapView: React.FC<MapViewProps> = ({
  members,
  currentUserId,
  routes,
  rendezvous,
  tileStyle,
  isSettingRendezvous,
  onSelectLocationForRendezvous,
  selectedMemberId,
  onSelectMember,
  followMe,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);

  // Layer groups for dynamic map elements
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const trailsLayerRef = useRef<L.LayerGroup | null>(null);
  const routesLayerRef = useRef<L.LayerGroup | null>(null);
  const rendezvousLayerRef = useRef<L.LayerGroup | null>(null);

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const myMember = members.find((m) => m.id === currentUserId);
    const initialCenter: [number, number] = myMember?.location
      ? [myMember.location.lat, myMember.location.lng]
      : [20.5937, 78.9629];
    const initialZoom = myMember?.location ? 15 : 5;

    const map = L.map(mapContainerRef.current, {
      center: initialCenter,
      zoom: initialZoom,
      zoomControl: false,
    });

    // Add zoom controls to bottom-right
    L.control.zoom({ position: 'bottomright' }).addTo(map);

    // Initial tile layer
    const config = TILE_LAYERS[tileStyle];
    const tileLayer = L.tileLayer(config.url, {
      attribution: config.attribution,
      maxZoom: config.maxZoom,
    }).addTo(map);
    tileLayerRef.current = tileLayer;

    // Create layer groups
    routesLayerRef.current = L.layerGroup().addTo(map);
    trailsLayerRef.current = L.layerGroup().addTo(map);
    rendezvousLayerRef.current = L.layerGroup().addTo(map);
    markersLayerRef.current = L.layerGroup().addTo(map);

    mapInstanceRef.current = map;

    // Handle map click for setting rendezvous destination
    map.on('click', (e: L.LeafletMouseEvent) => {
      if (isSettingRendezvous) {
        onSelectLocationForRendezvous(e.latlng.lat, e.latlng.lng);
      }
    });

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Update Tile Layer when tileStyle changes
  useEffect(() => {
    if (!mapInstanceRef.current || !tileLayerRef.current) return;
    mapInstanceRef.current.removeLayer(tileLayerRef.current);
    const config = TILE_LAYERS[tileStyle];
    const newLayer = L.tileLayer(config.url, {
      attribution: config.attribution,
      maxZoom: config.maxZoom,
    }).addTo(mapInstanceRef.current);
    tileLayerRef.current = newLayer;
  }, [tileStyle]);

  // Update Routes Layer
  useEffect(() => {
    if (!routesLayerRef.current || !mapInstanceRef.current) return;
    routesLayerRef.current.clearLayers();

    routes.forEach((route, index) => {
      if (!route.coordinates || route.coordinates.length < 2) return;

      const polyline = L.polyline(route.coordinates, {
        color: route.color || '#3b82f6',
        weight: 5,
        opacity: 0.85,
        dashArray: index % 2 === 1 ? '10, 8' : undefined,
      });

      polyline.bindPopup(`
        <div class="text-slate-900 font-sans p-1">
          <div class="font-bold text-sm text-slate-800">${escapeHtml(route.name)}</div>
          <div class="text-xs text-slate-600 mt-1">
            Distance: <span class="font-semibold text-blue-600">${route.distanceKm} km</span> | 
            ETA: <span class="font-semibold text-emerald-600">${route.durationMins} min</span>
          </div>
          ${route.tag ? `<div class="inline-block mt-1 text-[10px] px-2 py-0.5 rounded bg-blue-100 text-blue-700 font-medium">${escapeHtml(route.tag)}</div>` : ''}
        </div>
      `);

      polyline.addTo(routesLayerRef.current!);
    });
  }, [routes]);

  // Update Rendezvous Marker
  useEffect(() => {
    if (!rendezvousLayerRef.current || !mapInstanceRef.current) return;
    rendezvousLayerRef.current.clearLayers();

    if (!rendezvous) return;

    const rendezvousIcon = L.divIcon({
      className: 'custom-rendezvous-marker',
      html: `
        <div class="rendezvous-marker-container">
          <div class="rendezvous-bubble">
            📍
          </div>
          <div class="traveler-tag mt-1 bg-amber-950/90 border-amber-500/50 text-amber-200">
            <span class="w-2 h-2 rounded-full bg-amber-400 animate-ping"></span>
            ${escapeHtml(rendezvous.title || 'Meeting Point')}
          </div>
        </div>
      `,
      iconSize: [60, 60],
      iconAnchor: [30, 45],
    });

    const marker = L.marker([rendezvous.lat, rendezvous.lng], { icon: rendezvousIcon });
    marker.bindPopup(`
      <div class="p-1 text-slate-900 font-sans">
        <h4 class="font-bold text-sm text-amber-600">🎯 Target Destination</h4>
        <p class="text-xs text-slate-700 font-semibold">${escapeHtml(rendezvous.title)}</p>
        <p class="text-[10px] text-slate-500 mt-0.5">Set by: ${escapeHtml(rendezvous.setBy)}</p>
      </div>
    `);
    marker.addTo(rendezvousLayerRef.current);
  }, [rendezvous]);

  // Update Friends Markers and Breadcrumb Trails
  useEffect(() => {
    if (!markersLayerRef.current || !trailsLayerRef.current || !mapInstanceRef.current) return;

    markersLayerRef.current.clearLayers();
    trailsLayerRef.current.clearLayers();

    members.forEach((member) => {
      if (!member.location) return;

      const isMe = member.id === currentUserId;
      const isSelected = member.id === selectedMemberId;
      const isMoving = member.status === 'moving' || (member.location.speed || 0) > 3;

      // Draw breadcrumb trail polyline
      if (member.trail && member.trail.length > 1) {
        L.polyline(member.trail, {
          color: member.color || '#3b82f6',
          weight: 3,
          opacity: 0.5,
          dashArray: '4, 6',
        }).addTo(trailsLayerRef.current!);
      }

      // Determine vehicle icon
      const vehicleEmoji =
        member.mode === 'bike' ? '🚲' :
        member.mode === 'motorcycle' ? '🏍️' :
        member.mode === 'walk' ? '🥾' :
        member.mode === 'train' ? '🚆' : '🚗';

      // Heading arrow angle
      const heading = member.location.heading || 0;

      const markerHtml = `
        <div class="traveler-marker-container ${isSelected ? 'scale-110' : ''}">
          ${isMoving ? `<div class="pulse-radar-ring" style="border-color: ${member.color}"></div>` : ''}
          <div class="traveler-avatar-bubble" style="border-color: ${member.color}; ${isSelected ? `box-shadow: 0 0 25px ${member.color}` : ''}">
            ${escapeHtml(member.avatar || vehicleEmoji)}
            <div class="heading-cone" style="transform: translateX(-50%) rotate(${heading}deg); border-bottom-color: ${member.color};"></div>
          </div>
          <div class="traveler-tag">
            <span class="truncate max-w-[80px]">${isMe ? 'You' : escapeHtml(member.name)}</span>
            <span class="speed-badge">${Math.round(member.location.speed || 0)} km/h</span>
          </div>
        </div>
      `;

      const icon = L.divIcon({
        className: 'custom-traveler-icon',
        html: markerHtml,
        iconSize: [60, 60],
        iconAnchor: [30, 30],
      });

      const marker = L.marker([member.location.lat, member.location.lng], { icon });

      marker.on('click', () => {
        onSelectMember(member.id);
      });

      marker.addTo(markersLayerRef.current!);
    });

    // Follow Me or Selected Member
    if (followMe) {
      const targetMember = selectedMemberId
        ? members.find((m) => m.id === selectedMemberId)
        : members.find((m) => m.id === currentUserId);

      if (targetMember && targetMember.location && mapInstanceRef.current) {
        mapInstanceRef.current.panTo([targetMember.location.lat, targetMember.location.lng], {
          animate: true,
          duration: 0.5,
        });
      }
    }
  }, [members, currentUserId, selectedMemberId, followMe]);

  // Fit All Friends function exposed to window or ref
  const fitAllFriends = () => {
    if (!mapInstanceRef.current) return;
    const points: [number, number][] = [];

    members.forEach((m) => {
      if (m.location?.lat && m.location?.lng) {
        points.push([m.location.lat, m.location.lng]);
      }
    });

    if (rendezvous) {
      points.push([rendezvous.lat, rendezvous.lng]);
    }

    if (points.length > 0) {
      const bounds = L.latLngBounds(points);
      mapInstanceRef.current.fitBounds(bounds, { padding: [70, 70], maxZoom: 15 });
    }
  };

  // Expose fitAllFriends method on element data attribute or listener
  useEffect(() => {
    const handleFit = () => fitAllFriends();
    window.addEventListener('wandersync:fit_all', handleFit);
    return () => window.removeEventListener('wandersync:fit_all', handleFit);
  }, [members, rendezvous]);

  return (
    <div className="relative w-full h-full">
      <div ref={mapContainerRef} className="w-full h-full z-0" />
      
      {/* Visual Reticle when in "Setting Rendezvous Pin" mode */}
      {isSettingRendezvous && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-30 pointer-events-none">
          <div className="bg-amber-500 text-slate-950 font-bold px-4 py-2 rounded-full shadow-2xl flex items-center gap-2 border-2 border-amber-300 animate-pulse">
            <span>📍 Tap anywhere on the map to place Rendezvous Destination</span>
          </div>
        </div>
      )}
    </div>
  );
};
