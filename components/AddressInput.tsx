"use client";

import { useEffect, useId, useRef, useState } from "react";
import { MapPin } from "lucide-react";
import { publicEnv } from "@/lib/env";
import { cn } from "./ui";

/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window {
    google?: any;
    __cecMapsLoading?: Promise<void>;
  }
}

function loadGoogleMaps(key: string): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"));
  if (window.google?.maps?.importLibrary) return Promise.resolve();
  if (window.__cecMapsLoading) return window.__cecMapsLoading;
  window.__cecMapsLoading = new Promise<void>((resolve, reject) => {
    const cb = `__cecMapsReady_${Date.now()}`;
    (window as any)[cb] = () => resolve();
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&v=weekly&loading=async&callback=${cb}`;
    script.async = true;
    script.onerror = () => reject(new Error("Google Maps failed to load"));
    document.head.appendChild(script);
  });
  return window.__cecMapsLoading;
}

interface Suggestion {
  id: string;
  text: string;
}

/**
 * Address field with Google Places (New) autocomplete when
 * NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is set; a plain text input otherwise.
 */
export function AddressInput({
  id,
  value,
  onChange,
  placeholder,
  required,
  invalid,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  invalid?: boolean;
}) {
  const key = publicEnv.googleMapsKey;
  const [ready, setReady] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const placesRef = useRef<any>(null);
  const tokenRef = useRef<any>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const listId = useId();

  useEffect(() => {
    if (!key) return;
    let cancelled = false;
    loadGoogleMaps(key)
      .then(() => window.google.maps.importLibrary("places"))
      .then((lib: any) => {
        if (cancelled) return;
        placesRef.current = lib;
        tokenRef.current = new lib.AutocompleteSessionToken();
        setReady(true);
      })
      .catch(() => setReady(false));
    return () => {
      cancelled = true;
    };
  }, [key]);

  function requestSuggestions(input: string) {
    if (!ready || !placesRef.current || input.trim().length < 3) {
      setSuggestions([]);
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const { suggestions: results } = await placesRef.current.AutocompleteSuggestion.fetchAutocompleteSuggestions({
          input,
          sessionToken: tokenRef.current,
          includedRegionCodes: ["us"],
          locationBias: { center: { lat: 38.9, lng: -77.04 }, radius: 50000 },
        });
        const mapped: Suggestion[] = (results ?? [])
          .map((s: any) => s.placePrediction)
          .filter(Boolean)
          .slice(0, 5)
          .map((p: any) => ({ id: p.placeId, text: p.text?.toString?.() ?? String(p.text) }));
        setSuggestions(mapped);
        setOpen(mapped.length > 0);
        setActive(-1);
      } catch {
        setSuggestions([]);
      }
    }, 220);
  }

  function choose(s: Suggestion) {
    onChange(s.text);
    setOpen(false);
    setSuggestions([]);
    if (placesRef.current) tokenRef.current = new placesRef.current.AutocompleteSessionToken();
  }

  return (
    <div className="relative">
      <MapPin className="pointer-events-none absolute left-3.5 top-3.5 h-4 w-4 text-muted" aria-hidden />
      <input
        id={id}
        className={cn("input-lux pl-10", invalid && "border-danger")}
        value={value}
        placeholder={placeholder ?? "Street address, city, state"}
        required={required}
        autoComplete="street-address"
        role={ready ? "combobox" : undefined}
        aria-expanded={ready ? open : undefined}
        aria-controls={ready ? listId : undefined}
        aria-autocomplete={ready ? "list" : undefined}
        aria-invalid={invalid || undefined}
        onChange={(e) => {
          onChange(e.target.value);
          requestSuggestions(e.target.value);
        }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onFocus={() => suggestions.length > 0 && setOpen(true)}
        onKeyDown={(e) => {
          if (!open) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((a) => Math.min(a + 1, suggestions.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((a) => Math.max(a - 1, 0));
          } else if (e.key === "Enter" && active >= 0) {
            e.preventDefault();
            choose(suggestions[active]);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
      />
      {open && suggestions.length > 0 && (
        <ul id={listId} role="listbox" className="absolute z-30 mt-1 w-full overflow-hidden rounded-xl border border-line bg-panel-2 shadow-xl">
          {suggestions.map((s, i) => (
            <li
              key={s.id}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => {
                e.preventDefault();
                choose(s);
              }}
              className={cn("cursor-pointer px-4 py-2.5 text-sm text-ivory-dim", i === active ? "bg-gold/15 text-ivory" : "hover:bg-white/5")}
            >
              {s.text}
            </li>
          ))}
          <li className="px-4 py-1.5 text-right text-[10px] text-muted">Powered by Google</li>
        </ul>
      )}
    </div>
  );
}
