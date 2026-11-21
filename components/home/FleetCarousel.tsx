"use client";

import Link from "next/link";
import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Briefcase, ChevronLeft, ChevronRight, Users } from "lucide-react";
import { VEHICLE_CLASSES } from "@/lib/config";
import { formatUSD } from "@/lib/pricing";
import { CarIllustration } from "../CarIllustration";
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
    <div className="card-lux relative overflow-hidden p-6 sm:p-10">
      <div className="grid-fade pointer-events-none absolute inset-0" />
      <div className="relative grid items-center gap-8 lg:grid-cols-[1.2fr_1fr]">
        <div className="relative h-56 sm:h-72">
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={v.slug}
              custom={direction}
              initial={{ opacity: 0, x: direction * 80 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: direction * -80 }}
              transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
              className="absolute inset-0 flex items-center justify-center"
            >
              <CarIllustration slug={v.slug} className="w-full max-w-xl drop-shadow-[0_30px_40px_rgba(201,162,75,0.15)]" />
            </motion.div>
          </AnimatePresence>
        </div>

        <div>
          <p className="eyebrow">
            {String(index + 1).padStart(2, "0")} / {String(VEHICLE_CLASSES.length).padStart(2, "0")}
          </p>
          <AnimatePresence mode="wait">
            <motion.div
              key={v.slug}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.3 }}
            >
              <h3 className="heading-lux mt-3 text-4xl">{v.name}</h3>
              <p className="mt-2 text-sm text-muted">{v.exampleModels}</p>
              <p className="mt-4 text-ivory-dim">{v.description}</p>
              <div className="mt-6 flex gap-6 text-sm text-ivory-dim">
                <span className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-gold" /> {v.maxPassengers} passengers
                </span>
                <span className="flex items-center gap-2">
                  <Briefcase className="h-4 w-4 text-gold" /> {v.maxLuggage} bags
                </span>
              </div>
              <dl className="mt-6 grid grid-cols-3 gap-3 text-center">
                {[
                  ["Hourly", `${formatUSD(v.hourlyRate)}/hr`],
                  ["Base fare", formatUSD(v.baseFare)],
                  ["Per mile", formatUSD(v.perMileRate)],
                ].map(([k, val]) => (
                  <div key={k} className="rounded-xl border border-line bg-ink-2 px-2 py-3">
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
              className="grid h-11 w-11 place-items-center rounded-full border border-line text-ivory-dim hover:border-gold hover:text-gold"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={() => go(1)}
              aria-label="Next vehicle"
              className="grid h-11 w-11 place-items-center rounded-full border border-line text-ivory-dim hover:border-gold hover:text-gold"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
            <ButtonLink href={`/book?vehicle=${v.slug}`} className="ml-auto">
              Reserve {v.name.split(" ").slice(-1)[0]}
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
                className={cn("h-1 flex-1 rounded-full transition-colors", i === index ? "bg-gold" : "bg-line hover:bg-muted")}
              />
            ))}
          </div>
        </div>
      </div>
      <p className="sr-only">
        <Link href="/book">Book any vehicle</Link>
      </p>
    </div>
  );
}
