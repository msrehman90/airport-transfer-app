"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AIRPORTS, CITY_ZONES, VEHICLE_CLASSES } from "@/lib/config";
import { fetchCatalog, type Catalog } from "@/lib/client/api";
import { subscribeDemoDB } from "@/lib/client/demo-store";
import { demoCatalog } from "@/lib/client/demo-store";
import { formatUSD } from "@/lib/pricing";
import { Spinner, cn } from "../ui";

export function RatesTable() {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [airport, setAirport] = useState<string>("DCA");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const load = () =>
      fetchCatalog()
        .then((c) => active && setCatalog(c))
        .catch((e: Error) => {
          if (!active) return;
          setError(e.message);
          setCatalog(demoCatalog());
        });
    load();
    const unsubscribe = subscribeDemoDB(load);
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  const lookup = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of catalog?.flatRates ?? []) map.set(`${r.airportCode}|${r.cityZone}|${r.vehicleSlug}`, r.oneWayFare);
    return map;
  }, [catalog]);

  return (
    <div>
      <div className="mb-6 flex flex-wrap gap-2" role="tablist" aria-label="Airport">
        {AIRPORTS.map((a) => (
          <button
            key={a.code}
            type="button"
            role="tab"
            aria-selected={airport === a.code}
            onClick={() => setAirport(a.code)}
            className={cn(
              "rounded-full border px-4 py-2 text-sm transition-colors",
              airport === a.code ? "border-gold bg-gold text-ink" : "border-line text-ivory-dim hover:border-gold/50 hover:text-ivory",
            )}
          >
            {a.shortName}
          </button>
        ))}
      </div>

      {error && <p className="mb-3 text-xs text-warning">Showing standard rates ({error}).</p>}

      <div className="card-lux overflow-x-auto">
        {!catalog ? (
          <div className="flex justify-center p-10">
            <Spinner />
          </div>
        ) : (
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wider text-muted">
                <th className="px-5 py-4 font-medium">City / Area</th>
                {VEHICLE_CLASSES.map((v) => (
                  <th key={v.slug} className="px-5 py-4 text-right font-medium">
                    {v.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {CITY_ZONES.map((z) => (
                <tr key={z.slug} className="border-b border-line/60 last:border-0 hover:bg-white/[0.02]">
                  <td className="px-5 py-3.5">
                    <span className="text-ivory">{z.name}</span>
                    <span className="ml-2 text-xs text-muted">{z.state}</span>
                  </td>
                  {VEHICLE_CLASSES.map((v) => {
                    const fare = lookup.get(`${airport}|${z.slug}|${v.slug}`);
                    return (
                      <td key={v.slug} className="px-5 py-3.5 text-right tabular-nums">
                        {fare != null ? (
                          <Link
                            href={`/book?service=to_airport&airport=${airport}&zone=${z.slug}&vehicle=${v.slug}`}
                            className="text-ivory-dim hover:text-gold"
                          >
                            {formatUSD(fare)}
                          </Link>
                        ) : (
                          <span className="text-muted">By distance</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <p className="mt-3 text-xs text-muted">
        One-way flat rates, the same in either direction. Round trips are double. Addresses outside these areas are priced by
        distance. Meet & Greet +$25 · Child seat +$15 each.
      </p>
    </div>
  );
}
