import React, { useEffect, useRef, useState } from "react";
import { MapPin, Loader2, AlertCircle } from "lucide-react";
import { loadGoogleMaps, newSessionToken } from "@/lib/googleMaps";

/**
 * US address autocomplete powered by Google Places API (New).
 *
 * Behavior:
 *  - User types ≥ 3 characters → fetch suggestions (debounced 250ms)
 *  - User clicks a suggestion → fetch structured place details (street, city,
 *    state, ZIP) and call `onSelect({ street, city, state, zip, formatted })`
 *  - Apartment/unit number and any individual field remain user-editable in
 *    the parent form — this component only writes; it never blocks editing
 *
 * Uses a single Google session token for the lifetime of the user's "typing
 * session" (until they pick a suggestion) so Google bills it as one session.
 */
export default function AddressAutocomplete({
  value,
  onChange,
  onSelect,
  placeholder = "Start typing your address…",
  required,
  testid = "addr-autocomplete",
  className = "",
}) {
  const [suggestions, setSuggestions] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [highlight, setHighlight] = useState(0);
  const googleRef = useRef(null);
  const tokenRef = useRef(null);
  const wrapRef = useRef(null);
  const debounceRef = useRef(null);

  // Load Google Maps once
  useEffect(() => {
    let cancelled = false;
    loadGoogleMaps()
      .then((g) => {
        if (cancelled) return;
        googleRef.current = g;
        tokenRef.current = newSessionToken(g);
      })
      .catch((e) => !cancelled && setError(e.message || "Could not load address service"));
    return () => { cancelled = true; };
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const fetchSuggestions = async (q) => {
    if (!googleRef.current) return;
    if (!q || q.length < 3) { setSuggestions([]); return; }
    setLoading(true);
    try {
      const { AutocompleteSuggestion } = googleRef.current.maps.places;
      const req = {
        input: q,
        sessionToken: tokenRef.current,
        includedRegionCodes: ["us"],
        // Bias toward addresses (vs businesses)
        includedPrimaryTypes: ["street_address", "premise", "subpremise", "route"],
      };
      const { suggestions: rows } = await AutocompleteSuggestion.fetchAutocompleteSuggestions(req);
      setSuggestions(rows || []);
      setOpen(true);
      setHighlight(0);
    } catch (e) {
      console.warn("Places autocomplete failed:", e);
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  };

  const handleInput = (e) => {
    const v = e.target.value;
    onChange(v);
    setError("");
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchSuggestions(v), 250);
  };

  const pick = async (sugg) => {
    setOpen(false);
    if (!sugg?.placePrediction) return;
    try {
      const place = sugg.placePrediction.toPlace();
      await place.fetchFields({
        fields: ["addressComponents", "formattedAddress"],
      });
      const comps = place.addressComponents || [];
      const get = (type) => {
        const c = comps.find((x) => x.types.includes(type));
        return c ? (c.shortText || c.longText || "") : "";
      };
      const street_number = get("street_number");
      const route = get("route");
      const subpremise = get("subpremise"); // unit / apt if Google found one
      const city =
        get("locality") ||
        get("sublocality") ||
        get("postal_town") ||
        get("administrative_area_level_3") ||
        get("administrative_area_level_2") || "";
      const state = get("administrative_area_level_1");
      const zip = get("postal_code");
      const street = [street_number, route].filter(Boolean).join(" ");
      const formatted = place.formattedAddress || sugg.placePrediction.text?.text || "";
      onSelect?.({ street, unit: subpremise, city, state, zip, formatted });
      onChange(street || formatted);
      // New session token for next typing session
      tokenRef.current = newSessionToken(googleRef.current);
    } catch (e) {
      console.warn("Place details fetch failed:", e);
      setError("Could not fetch full address details. Please fill the remaining fields manually.");
    }
  };

  const onKey = (e) => {
    if (!open || !suggestions.length) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setHighlight((h) => Math.min(h + 1, suggestions.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setHighlight((h) => Math.max(h - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); pick(suggestions[highlight]); }
    else if (e.key === "Escape") { setOpen(false); }
  };

  return (
    <div ref={wrapRef} className={`relative ${className}`} data-testid={testid}>
      <div className="relative">
        <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#C5A880] pointer-events-none z-[1]" />
        <input
          type="text"
          className="rs-input pl-12 pr-10"
          value={value || ""}
          onChange={handleInput}
          onFocus={() => suggestions.length > 0 && setOpen(true)}
          onKeyDown={onKey}
          placeholder={placeholder}
          required={required}
          autoComplete="off"
          spellCheck={false}
          data-testid={`${testid}-input`}
          aria-autocomplete="list"
          aria-expanded={open}
        />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 animate-spin" />
        )}
      </div>
      {error && (
        <div className="text-xs text-amber-700 mt-1 flex items-center gap-1.5">
          <AlertCircle className="w-3.5 h-3.5" /> {error}
        </div>
      )}
      {open && suggestions.length > 0 && (
        <ul
          className="absolute z-30 left-0 right-0 mt-1 max-h-80 overflow-y-auto bg-white border border-slate-200 rounded-xl shadow-lg shadow-[#0A192F]/10 py-1"
          role="listbox"
          data-testid={`${testid}-list`}
        >
          {suggestions.map((s, i) => {
            const pred = s.placePrediction;
            const main = pred?.mainText?.text || pred?.text?.text || "";
            const secondary = pred?.secondaryText?.text || "";
            return (
              <li
                key={pred?.placeId || i}
                onMouseDown={(e) => { e.preventDefault(); pick(s); }}
                onMouseEnter={() => setHighlight(i)}
                className={`px-4 py-2.5 cursor-pointer flex items-start gap-3 transition ${i === highlight ? "bg-slate-50" : ""}`}
                role="option"
                aria-selected={i === highlight}
                data-testid={`${testid}-item-${i}`}
              >
                <MapPin className="w-4 h-4 text-[#C5A880] flex-shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <div className="text-sm text-[#0A192F] font-medium truncate">{main}</div>
                  {secondary && <div className="text-xs text-slate-500 truncate">{secondary}</div>}
                </div>
              </li>
            );
          })}
          <li className="px-4 pt-1.5 pb-2 text-[10px] text-slate-400 text-right border-t border-slate-100 mt-1">Powered by Google</li>
        </ul>
      )}
    </div>
  );
}
