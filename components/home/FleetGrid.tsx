"use client";

import Link from "next/link";
import { useState } from "react";
import { Briefcase, Star, Users } from "lucide-react";
import { VEHICLE_CATEGORIES, VEHICLE_CLASSES, VEHICLE_PHOTOS, type VehicleCategory } from "@/lib/config";
import { formatUSD } from "@/lib/pricing";
import { Photo } from "../Photo";
import { cn } from "../ui";

type Filter = VehicleCategory | "all" | "popular";

/** Fleet grid with category filters. Renders fully without JavaScript animations. */
export function FleetGrid() {
  const [filter, setFilter] = useState<Filter>("all");
  const list = VEHICLE_CLASSES.filter((v) =>
    filter === "all" ? true : filter === "popular" ? v.popular : v.category === filter,
  );

  const tabs: { id: Filter; label: string }[] = [
    { id: "all", label: `All (${VEHICLE_CLASSES.length})` },
    { id: "popular", label: "Most booked" },
    ...VEHICLE_CATEGORIES.map((c) => ({ id: c.id as Filter, label: c.label })),
  ];

  return (
    <div>
      <div className="mb-8 flex flex-wrap gap-2" role="tablist" aria-label="Vehicle type">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={filter === t.id}
            onClick={() => setFilter(t.id)}
            className={cn(
              "rounded-full border px-4 py-2 text-sm transition-colors",
              filter === t.id ? "border-brand bg-brand text-white" : "border-line bg-white text-ivory-dim hover:border-brand/40 hover:text-ivory",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {list.map((v) => (
          <article key={v.slug} className="card-metal group flex flex-col overflow-hidden">
            <div className="relative aspect-[16/10] overflow-hidden bg-ink-2">
              <Photo
                photo={VEHICLE_PHOTOS[v.slug]}
                sizes="(min-width: 1280px) 25vw, (min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                className="transition-transform duration-500 group-hover:scale-105"
              />
              {v.popular && (
                <span className="absolute left-3 top-3 flex items-center gap-1 rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-semibold text-ivory shadow-sm">
                  <Star className="h-3 w-3 fill-amber-400 text-amber-400" /> Most booked
                </span>
              )}
            </div>
            <div className="flex flex-1 flex-col p-5">
              <h3 className="font-serif text-2xl text-ivory">{v.name}</h3>
              <p className="mt-1 text-xs text-muted">{v.exampleModels}</p>
              <p className="mt-3 flex-1 text-sm text-ivory-dim">{v.description}</p>
              <div className="mt-4 flex items-center gap-4 text-sm text-ivory-dim">
                <span className="flex items-center gap-1.5">
                  <Users className="h-4 w-4 text-brand-light" /> {v.maxPassengers}
                </span>
                <span className="flex items-center gap-1.5">
                  <Briefcase className="h-4 w-4 text-brand-light" /> {v.maxLuggage}
                </span>
                <span className="ml-auto text-right text-xs text-muted">
                  from <span className="text-base font-semibold text-ivory">{formatUSD(v.hourlyRate)}</span>/hr
                </span>
              </div>
              <Link
                href={`/book?vehicle=${v.slug}`}
                className="mt-5 inline-flex items-center justify-center rounded-full bg-brand px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-dark"
              >
                Reserve
              </Link>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
