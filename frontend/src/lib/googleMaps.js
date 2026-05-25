/**
 * Singleton Google Maps loader — guarantees the JS API + Places library is
 * loaded exactly once per page. Returns a Promise that resolves with the
 * `google` global once Maps + Places are ready.
 *
 * Uses @googlemaps/js-api-loader v2's functional API (setOptions + importLibrary).
 */
import { setOptions, importLibrary } from "@googlemaps/js-api-loader";

let loaderPromise = null;
let optionsSet = false;

export function loadGoogleMaps() {
  if (loaderPromise) return loaderPromise;
  const apiKey = process.env.REACT_APP_GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    loaderPromise = Promise.reject(new Error("Google Maps API key missing"));
    return loaderPromise;
  }
  if (!optionsSet) {
    setOptions({ key: apiKey, v: "weekly" });
    optionsSet = true;
  }
  loaderPromise = (async () => {
    // Loading 'places' also loads the core 'maps' namespace.
    await importLibrary("places");
    if (typeof window === "undefined" || !window.google) {
      throw new Error("Google Maps failed to attach to window");
    }
    return window.google;
  })();
  return loaderPromise;
}

/**
 * Generate a fresh Place session token. A single token should be reused for all
 * autocomplete queries that culminate in a single Place details fetch.
 */
export function newSessionToken(google) {
  return new google.maps.places.AutocompleteSessionToken();
}
