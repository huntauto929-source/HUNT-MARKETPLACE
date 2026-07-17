// Free, no-API-key geocoding via OpenStreetMap's Nominatim service.
// This avoids requiring a billed Google Cloud API key just to let
// someone pick a pickup spot. The Google Maps *embed* used to preview
// the pin (see LocationPicker in App.jsx) doesn't need a key either —
// only Google's JavaScript SDK / Places Autocomplete would.
//
// Nominatim's usage policy asks for light, non-bulk use and a
// descriptive User-Agent/Referer — fine for a marketplace picking one
// address at a time. If HunT gets real traffic, swap this for a paid
// geocoder (Google, Mapbox) to avoid rate limiting.

const NOMINATIM_BASE = "https://nominatim.openstreetmap.org";

export async function geocodeAddress(query) {
  const url = `${NOMINATIM_BASE}/search?format=json&limit=1&q=${encodeURIComponent(query)}`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error("Couldn't reach the map service. Try again.");
  const results = await res.json();
  if (!results.length) throw new Error("Couldn't find that location. Try a more specific address.");
  const { lat, lon, display_name } = results[0];
  return { lat: parseFloat(lat), lng: parseFloat(lon), address: display_name };
}

export async function reverseGeocode(lat, lng) {
  const url = `${NOMINATIM_BASE}/reverse?format=json&lat=${lat}&lon=${lng}`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error("Couldn't reach the map service. Try again.");
  const result = await res.json();
  return {
    lat,
    lng,
    address: result?.display_name || `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
  };
}

export function getCurrentPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Your browser doesn't support location detection."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => reject(new Error("Couldn't get your location. Check your browser's location permission.")),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  });
}

export function googleMapsEmbedUrl(lat, lng) {
  return `https://www.google.com/maps?q=${lat},${lng}&z=15&output=embed`;
}

export function googleMapsDirectionsUrl(lat, lng) {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
}
