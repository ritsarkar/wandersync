/**
 * WanderSync Routing Service
 * Connects to OpenStreetMap / OSRM routing engine with fallback road synthesizers
 * to calculate real routes, alternative paths, and ETAs for traveling squads.
 */

// Helper: Haversine distance in km between two [lat, lng] points
export function calculateDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Decode Google Encoded Polyline into real [lat, lng] road points with all natural curves
 */
export function decodeGooglePolyline(encoded) {
  if (!encoded) return [];
  const points = [];
  let index = 0, len = encoded.length;
  let lat = 0, lng = 0;

  while (index < len) {
    let b, shift = 0, result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlat = ((result & 1) !== 0 ? ~(result >> 1) : (result >> 1));
    lat += dlat;

    shift = 0;
    result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlng = ((result & 1) !== 0 ? ~(result >> 1) : (result >> 1));
    lng += dlng;

    points.push([+(lat / 1e5).toFixed(5), +(lng / 1e5).toFixed(5)]);
  }
  return points;
}

/**
 * Fetch original Google Maps routes with real road curves and street geometries
 * using Google's official Routes API (Compute Routes)
 */
let googleQuotaExceededUntil = 0;

export async function getGoogleRoutes(startLat, startLng, endLat, endLng, mode = 'driving', apiKey = 'AIzaSyD7TQUFCM4BhUXzWtGDIVXh3zORe19Se7s', alternatives = true) {
  const travelMode = mode === 'walking' ? 'WALK' : mode === 'cycling' ? 'BICYCLE' : 'DRIVE';

  // If daily quota was exceeded, skip Google call and immediately use OSRM
  if (Date.now() < googleQuotaExceededUntil) {
    return getOSRMRoute(startLat, startLng, endLat, endLng, mode, alternatives);
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline,routes.description',
      },
      body: JSON.stringify({
        origin: { location: { latLng: { latitude: startLat, longitude: startLng } } },
        destination: { location: { latLng: { latitude: endLat, longitude: endLng } } },
        travelMode,
        computeAlternativeRoutes: alternatives,
      }),
    });
    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      if (data.routes && data.routes.length > 0) {
        return data.routes.map((r, idx) => {
          const coordinates = decodeGooglePolyline(r.polyline?.encodedPolyline);
          const distanceKm = +((r.distanceMeters || 0) / 1000).toFixed(1);
          const durationMins = Math.round(parseInt(r.duration || '0') / 60);
          const routeName = r.description ? `via ${r.description}` : `Route ${idx + 1}`;

          return {
            id: `google-route-${idx + 1}`,
            name: routeName,
            distanceKm,
            durationMins,
            coordinates,
            color: idx === 0 ? '#2563eb' : '#60a5fa',
            tag: idx === 0 ? 'Fastest Route' : `Alternative ${idx + 1}`,
          };
        });
      }
    } else if (response.status === 429) {
      googleQuotaExceededUntil = Date.now() + 15 * 60 * 1000;
      console.info('[Routes API] Google Routes daily quota limit reached (429). Using OSRM road coordinates.');
    } else {
      console.warn('[Routes API] Google Routes API returned status', response.status);
    }
  } catch (err) {
    console.warn('[Routes API] Google Routes fetch failed:', err.message);
  }

  // Fall back to OSRM real road coordinates if Google Routes API is unreachable
  return getOSRMRoute(startLat, startLng, endLat, endLng, mode, alternatives);
}

/**
 * Fetch real route from OSRM public API
 * Profile: 'driving' | 'walking' | 'cycling'
 * Start & End: [lat, lng]
 */
export async function getOSRMRoute(startLat, startLng, endLat, endLng, mode = 'driving', alternatives = true) {
  try {
    const profile = mode === 'walking' ? 'foot' : mode === 'cycling' ? 'bike' : 'driving';
    // OSRM expects: longitude,latitude;longitude,latitude
    const url = `https://router.project-osrm.org/route/v1/${profile}/${startLng},${startLat};${endLng},${endLat}?overview=full&geometries=geojson&steps=true&alternatives=${alternatives ? 'true' : 'false'}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`OSRM responded with HTTP ${response.status}`);
    }

    const data = await response.json();
    if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
      const primaryRoutes = data.routes.map((r, index) => {
        const coordinates = r.geometry.coordinates.map(([lng, lat]) => [lat, lng]);
        const distanceKm = +(r.distance / 1000).toFixed(1);
        const durationMins = Math.round(r.duration / 60);

        // Extract road name from first step if available
        let routeName = index === 0 ? 'Primary Route' : `Alternate Route ${index + 1}`;
        if (r.legs && r.legs[0] && r.legs[0].steps) {
          const mainRoad = r.legs[0].steps.find(s => s.name && s.name.length > 2);
          if (mainRoad) routeName = index === 0 ? `via ${mainRoad.name}` : `Alt via ${mainRoad.name}`;
        }

        return {
          id: `route-${index + 1}`,
          name: routeName,
          distanceKm,
          durationMins,
          coordinates,
          color: index === 0 ? '#3b82f6' : index === 1 ? '#10b981' : '#f59e0b',
          tag: index === 0 ? 'Fastest Route' : 'Alternative',
        };
      });

      // If OSRM returned only 1 route, try fetching an alternate via a detour waypoint
      if (primaryRoutes.length === 1 && alternatives) {
        const altRoute = await getOSRMViaWaypoint(startLat, startLng, endLat, endLng, profile);
        if (altRoute) {
          primaryRoutes.push(altRoute);
        }
      }

      return primaryRoutes;
    }
  } catch (err) {
    console.warn('[Routing] OSRM fetch failed or timed out:', err.message);
  }

  // Last resort: return empty so client can use Google Directions Service
  return [];
}

/**
 * Fetch an alternate OSRM route via an offset waypoint to get a genuinely different road path.
 */
async function getOSRMViaWaypoint(startLat, startLng, endLat, endLng, profile = 'driving') {
  try {
    const midLat = (startLat + endLat) / 2;
    const midLng = (startLng + endLng) / 2;
    const dLat = endLat - startLat;
    const dLng = endLng - startLng;
    // Perpendicular offset for a different road
    const offsetLat = midLat + dLng * 0.15;
    const offsetLng = midLng - dLat * 0.15;

    const url = `https://router.project-osrm.org/route/v1/${profile}/${startLng},${startLat};${offsetLng},${offsetLat};${endLng},${endLat}?overview=full&geometries=geojson&steps=true`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!response.ok) return null;
    const data = await response.json();
    if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
      const r = data.routes[0];
      const coordinates = r.geometry.coordinates.map(([lng, lat]) => [lat, lng]);
      let routeName = 'Alternate Route 2';
      if (r.legs) {
        for (const leg of r.legs) {
          if (leg.steps) {
            const mainRoad = leg.steps.find(s => s.name && s.name.length > 2);
            if (mainRoad) { routeName = `Alt via ${mainRoad.name}`; break; }
          }
        }
      }
      return {
        id: 'route-2',
        name: routeName,
        distanceKm: +(r.distance / 1000).toFixed(1),
        durationMins: Math.round(r.duration / 60),
        coordinates,
        color: '#10b981',
        tag: 'Alternative',
      };
    }
  } catch (err) {
    // Silently fail — we'll just return 1 real route
  }
  return null;
}

/**
 * Fallback Route Synthesizer:
 * Creates realistic multi-route curves with intermediate natural waypoints
 * ensuring app works seamlessly even without an external internet routing API.
 */
export function generateFallbackRoutes(startLat, startLng, endLat, endLng) {
  const directDist = calculateDistanceKm(startLat, startLng, endLat, endLng);
  const midLat = (startLat + endLat) / 2;
  const midLng = (startLng + endLng) / 2;

  // Route 1: Direct Highway (Slight natural deviation)
  const route1Coords = interpolateCurvedPath(
    [startLat, startLng],
    [midLat + (endLng - startLng) * 0.08, midLng - (endLat - startLat) * 0.08],
    [endLat, endLng],
    25
  );
  const dist1 = +(directDist * 1.08).toFixed(1);
  const dur1 = Math.max(5, Math.round((dist1 / 75) * 60)); // ~75 km/h highway

  // Route 2: Scenic Mountain / Coast Loop (Larger detour)
  const route2Coords = interpolateCurvedPath(
    [startLat, startLng],
    [midLat - (endLng - startLng) * 0.28, midLng + (endLat - startLat) * 0.28],
    [endLat, endLng],
    35
  );
  const dist2 = +(directDist * 1.35).toFixed(1);
  const dur2 = Math.max(8, Math.round((dist2 / 50) * 60)); // ~50 km/h scenic

  // Route 3: Country Bypass
  const route3Coords = interpolateCurvedPath(
    [startLat, startLng],
    [midLat + (endLng - startLng) * 0.22, midLng + (endLat - startLat) * 0.15],
    [endLat, endLng],
    30
  );
  const dist3 = +(directDist * 1.22).toFixed(1);
  const dur3 = Math.max(6, Math.round((dist3 / 60) * 60)); // ~60 km/h bypass

  return [
    {
      id: 'route-express',
      name: 'Expressway Highway (Route 1)',
      distanceKm: dist1,
      durationMins: dur1,
      coordinates: route1Coords,
      color: '#3b82f6', // Bright Blue
      tag: 'Fastest Route',
    },
    {
      id: 'route-scenic',
      name: 'Scenic Coastal/Valley Pass (Route 2)',
      distanceKm: dist2,
      durationMins: dur2,
      coordinates: route2Coords,
      color: '#10b981', // Emerald Green
      tag: 'Scenic Views',
    },
    {
      id: 'route-bypass',
      name: 'Northern Country Bypass (Route 3)',
      distanceKm: dist3,
      durationMins: dur3,
      coordinates: route3Coords,
      color: '#f59e0b', // Amber
      tag: 'Less Traffic',
    },
  ];
}

function interpolateCurvedPath(p0, p1, p2, numPoints = 20) {
  const points = [];
  for (let i = 0; i <= numPoints; i++) {
    const t = i / numPoints;
    // Quadratic Bézier curve for natural road curvatures
    const lat = (1 - t) * (1 - t) * p0[0] + 2 * (1 - t) * t * p1[0] + t * t * p2[0];
    const lng = (1 - t) * (1 - t) * p0[1] + 2 * (1 - t) * t * p1[1] + t * t * p2[1];
    points.push([+lat.toFixed(6), +lng.toFixed(6)]);
  }
  return points;
}
