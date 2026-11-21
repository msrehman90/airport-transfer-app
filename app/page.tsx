import Link from "next/link";
import { BadgeCheck, Briefcase, CigaretteOff, Clock3, PlaneLanding, ShieldCheck, Sparkles, Star, Users, Wifi } from "lucide-react";
import { Faq } from "@/components/home/Faq";
import { FleetCarousel } from "@/components/home/FleetCarousel";
import { QuoteWidget } from "@/components/home/QuoteWidget";
import { RatesTable } from "@/components/home/RatesTable";
import { Photo } from "@/components/Photo";
import { ButtonLink } from "@/components/ui";
import { AIRPORTS, BRAND, CTA_PHOTO, FREE_CANCELLATION_HOURS, HERO_PHOTO, VEHICLE_CLASSES, VEHICLE_PHOTOS } from "@/lib/config";
import { formatUSD } from "@/lib/pricing";

const HIGHLIGHTS = [
  { icon: Clock3, title: "24/7 Availability", text: "Early flights, red-eyes and holidays. Dispatch is always on." },
  { icon: PlaneLanding, title: "Live Flight Tracking", text: "Pickup moves automatically with your arrival time. No delay fees." },
  { icon: CigaretteOff, title: "Non-Smoking Fleet", text: "Late-model vehicles, detailed before every ride." },
  { icon: ShieldCheck, title: "Licensed & Insured", text: "Vetted, uniformed chauffeurs with commercial insurance." },
  { icon: BadgeCheck, title: "Flat-Rate Pricing", text: "Fixed airport fares with no surge pricing, ever." },
  { icon: Wifi, title: "Onboard Comforts", text: "Wi-Fi, phone chargers and bottled water in every vehicle." },
];

const SERVICES = [
  { title: "To the Airport", text: "Door-to-curb drop-offs at DCA, IAD, BWI and Union Station, timed to your flight." },
  { title: "From the Airport", text: "Flight-tracked pickups with optional Meet & Greet at baggage claim." },
  { title: "Hourly Chauffeur", text: "A dedicated car and driver for meetings, roadshows and events. 3-hour minimum." },
  { title: "Point-to-Point", text: "Any address to any address, priced by distance with no surprises." },
];

export default function HomePage() {
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0">
          <Photo photo={HERO_PHOTO} priority />
          <div className="photo-shade absolute inset-0" />
          <div className="hero-glow absolute inset-0" />
        </div>
        <div className="container-lux relative grid items-center gap-12 py-16 lg:min-h-[calc(100vh-4rem)] lg:grid-cols-[1.05fr_1fr] lg:py-24">
          <div>
            <p className="eyebrow">{BRAND.serviceArea}</p>
            <h1 className="heading-lux mt-5 text-5xl leading-[1.05] sm:text-6xl lg:text-7xl">
              Arrive in <span className="brand-text italic">quiet luxury.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg text-ivory-dim">
              Chauffeured airport transfers at flat rates. We track your flight, adjust for delays and meet you at the door.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <ButtonLink href="/book" size="lg">
                Reserve your chauffeur
              </ButtonLink>
              <ButtonLink href="#rates" size="lg" variant="outline">
                View flat rates
              </ButtonLink>
            </div>
            <div className="mt-10 flex flex-wrap items-center gap-x-8 gap-y-4 text-sm text-ivory-dim">
              <span className="flex items-center gap-2">
                <span className="flex text-brand-light">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} className="h-4 w-4 fill-current" />
                  ))}
                </span>
                Five-star service
              </span>
              <span className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-steel-light" /> Free cancellation up to {FREE_CANCELLATION_HOURS}h before
              </span>
            </div>
          </div>
          <div id="quote">
            <QuoteWidget />
          </div>
        </div>
        <div className="relative border-y border-white/10 bg-ink/85">
          <div className="container-lux flex flex-wrap items-center justify-center gap-x-10 gap-y-3 py-5 text-xs uppercase tracking-[0.25em] text-steel-light/80">
            {AIRPORTS.map((a) => (
              <span key={a.code}>{a.shortName}</span>
            ))}
          </div>
        </div>
      </section>

      {/* Vehicle photo tiles */}
      <section className="container-lux pt-20">
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {VEHICLE_CLASSES.map((v) => (
            <Link
              key={v.slug}
              href={`/book?vehicle=${v.slug}`}
              className="card-metal group relative block aspect-[4/5] overflow-hidden sm:aspect-[3/4]"
            >
              <Photo
                photo={VEHICLE_PHOTOS[v.slug]}
                sizes="(min-width: 1024px) 25vw, 50vw"
                className="transition-transform duration-700 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/30 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-4 sm:p-5">
                <p className="font-serif text-xl text-white sm:text-2xl">{v.name}</p>
                <p className="mt-1 flex items-center gap-3 text-xs text-steel-light">
                  <span className="flex items-center gap-1">
                    <Users className="h-3.5 w-3.5" /> {v.maxPassengers}
                  </span>
                  <span className="flex items-center gap-1">
                    <Briefcase className="h-3.5 w-3.5" /> {v.maxLuggage}
                  </span>
                  <span className="ml-auto text-brand-light">from {formatUSD(v.baseFare)}</span>
                </p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Fleet */}
      <section id="fleet" className="container-lux scroll-mt-20 py-20">
        <div className="mb-10 max-w-2xl">
          <p className="eyebrow">The Fleet</p>
          <h2 className="heading-lux mt-3 text-4xl sm:text-5xl">A vehicle for every occasion</h2>
          <p className="mt-4 text-ivory-dim">
            From a discreet sedan for a solo business trip to a Sprinter for the whole team.
          </p>
        </div>
        <FleetCarousel />
      </section>

      {/* Rates */}
      <section id="rates" className="scroll-mt-20 border-y border-line bg-ink-2/50 py-20">
        <div className="container-lux">
          <div className="mb-10 flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <div className="max-w-2xl">
              <p className="eyebrow">Flat-Rate Airport Pricing</p>
              <h2 className="heading-lux mt-3 text-4xl sm:text-5xl">Know your fare before you go</h2>
            </div>
            <ButtonLink href="/book" variant="outline">
              Get an exact quote
            </ButtonLink>
          </div>
          <RatesTable />
        </div>
      </section>

      {/* Services */}
      <section id="services" className="container-lux scroll-mt-20 py-20">
        <div className="grid gap-12 lg:grid-cols-[1fr_1.4fr]">
          <div>
            <p className="eyebrow">Services</p>
            <h2 className="heading-lux mt-3 text-4xl sm:text-5xl">Every ride, handled personally</h2>
            <div className="mt-8 grid gap-4">
              {SERVICES.map((s, i) => (
                <div key={s.title} className="flex gap-4">
                  <span className="metal-text font-serif text-2xl">{String(i + 1).padStart(2, "0")}</span>
                  <div>
                    <p className="font-medium text-ivory">{s.title}</p>
                    <p className="mt-1 text-sm text-ivory-dim">{s.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {HIGHLIGHTS.map(({ icon: Icon, title, text }) => (
              <div key={title} className="card-lux p-6 transition-colors hover:border-brand/40">
                <Icon className="h-6 w-6 text-brand" aria-hidden />
                <p className="mt-4 font-medium text-ivory">{title}</p>
                <p className="mt-2 text-sm text-ivory-dim">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="scroll-mt-20 border-t border-line bg-ink-2/50 py-20">
        <div className="container-lux grid gap-12 lg:grid-cols-[1fr_1.6fr]">
          <div>
            <p className="eyebrow">Questions</p>
            <h2 className="heading-lux mt-3 text-4xl sm:text-5xl">Good to know</h2>
            <p className="mt-4 text-ivory-dim">
              Anything else? Call us at{" "}
              <a className="text-brand hover:underline" href={`tel:${BRAND.phone.replace(/[^+\d]/g, "")}`}>
                {BRAND.phone}
              </a>
              , day or night.
            </p>
          </div>
          <Faq />
        </div>
      </section>

      {/* CTA */}
      <section className="container-lux py-20">
        <div className="card-metal relative overflow-hidden">
          <div className="absolute inset-0">
            <Photo photo={CTA_PHOTO} sizes="100vw" />
            <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(5,12,18,0.95),rgba(5,12,18,0.75)_50%,rgba(16,40,70,0.55))]" />
          </div>
          <div className="relative flex flex-col items-start gap-6 px-6 py-16 sm:px-12 sm:py-20">
            <p className="eyebrow">Book in under a minute</p>
            <h2 className="heading-lux metal-text max-w-2xl text-4xl sm:text-5xl">Your chauffeur is one minute away.</h2>
            <p className="max-w-xl text-ivory-dim">Pay securely, and change or cancel up to 24 hours ahead.</p>
            <ButtonLink href="/book" size="lg">
              Book now
            </ButtonLink>
          </div>
        </div>
      </section>
    </>
  );
}
