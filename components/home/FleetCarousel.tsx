"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Briefcase, ChevronLeft, ChevronRight, Users } from "lucide-react";
import { VEHICLE_CLASSES, VEHICLE_PHOTOS } from "@/lib/config";
import { formatUSD } from "@/lib/pricing";
import { Photo } from "../Photo";
import { ButtonLink, cn } from "../ui";

export function FleetCarousel() {
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState(1);
  const v = VEHICLE_CLASSES[index];

  function go(delta: number) {
    setDirection(delta);
    setIndex((i) => (i + delta + VEHICLE_CLASSES.length) % VEHICLE_CLASSES.length);
  }

  return (
    <div className="card-metal relative overflow-hidden">
      <div className="grid lg:grid-cols-[1.35fr_1fr]">
        <div className="relative h-72 overflow-hidden sm:h-96 lg:h-[30rem]">
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={v.slug}
              custom={direction}
              initial={{ opacity: 0, scale: 1.06, x: direction * 40 }}
              animate={{ opacity: 1, scale: 1, x: 0 }}
              exit={{ opacity: 0, scale: 1.02, x: direction * -40 }}
              transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
              className="absolute inset-0"
            >
              <Photo photo={VEHICLE_PHOTOS[v.slug]} sizes="(min-width: 1024px) 60vw, 100vw" />
            </motion.div>
          </AnimatePresence>
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-panel via-transparent to-transparent lg:bg-gradient-to-r lg:from-transparent lg:via-transparent lg:to-panel" />
          <span className="absolute left-5 top-5 rounded-full border border-line bg-white/90 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-ivory">
            {String(index + 1).padStart(2, "0")} / {String(VEHICLE_CLASSES.length).padStart(2, "0")}
          </span>
        </div>

        <div className="relative flex flex-col justify-center p-6 sm:p-10">
          <AnimatePresence mode="wait">
            <motion.div
              key={v.slug}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.3 }}
            >
              <p className="eyebrow">The fleet</p>
              <h3 className="heading-lux metal-text mt-3 text-4xl sm:text-5xl">{v.name}</h3>
              <p className="mt-2 text-sm text-muted">{v.exampleModels}</p>
              <p className="mt-4 text-ivory-dim">{v.description}</p>
              <div className="mt-6 flex gap-6 text-sm text-ivory-dim">
                <span className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-brand-light" /> {v.maxPassengers} passengers
                </span>
                <span className="flex items-center gap-2">
                  <Briefcase className="h-4 w-4 text-brand-light" /> {v.maxLuggage} bags
                </span>
              </div>
              <dl className="mt-6 grid grid-cols-3 gap-3 text-center">
                {[
                  ["Hourly", `${formatUSD(v.hourlyRate)}/hr`],
                  ["Base fare", formatUSD(v.baseFare)],
                  ["Per mile", formatUSD(v.perMileRate)],
                ].map(([k, val]) => (
                  <div key={k} className="rounded-xl border border-line bg-ink-2/80 px-2 py-3">
                    <dt className="text-[10px] uppercase tracking-wider text-muted">{k}</dt>
                    <dd className="mt-1 font-semibold text-ivory">{val}</dd>
                  </div>
                ))}
              </dl>
            </motion.div>
          </AnimatePresence>

          <div className="mt-8 flex items-center gap-3">
            <button
              type="button"
              onClick={() => go(-1)}
              aria-label="Previous vehicle"
              className="grid h-11 w-11 place-items-center rounded-full border border-line text-ivory-dim hover:border-brand hover:text-brand"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={() => go(1)}
              aria-label="Next vehicle"
              className="grid h-11 w-11 place-items-center rounded-full border border-line text-ivory-dim hover:border-brand hover:text-brand"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
            <ButtonLink href={`/book?vehicle=${v.slug}`} className="ml-auto">
              Reserve this vehicle
            </ButtonLink>
          </div>
          <div className="mt-6 flex gap-2">
            {VEHICLE_CLASSES.map((vc, i) => (
              <button
                key={vc.slug}
                type="button"
                aria-label={`Show ${vc.name}`}
                onClick={() => {
                  setDirection(i > index ? 1 : -1);
                  setIndex(i);
                }}
                className={cn(
                  "h-1 flex-1 rounded-full transition-colors",
                  i === index ? "bg-brand" : "bg-line hover:bg-muted",
                )}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
