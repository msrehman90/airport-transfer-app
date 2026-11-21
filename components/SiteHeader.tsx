"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu, Phone, X } from "lucide-react";
import { BRAND } from "@/lib/config";
import { ButtonLink, cn } from "./ui";

const NAV = [
  { href: "/#fleet", label: "Fleet" },
  { href: "/#rates", label: "Flat Rates" },
  { href: "/#services", label: "Services" },
  { href: "/#faq", label: "FAQ" },
  { href: "/track", label: "Manage Booking" },
];

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const isApp = pathname.startsWith("/admin") || pathname.startsWith("/driver");

  return (
    <header className="sticky top-0 z-40 border-b border-line/70 bg-ink/90 backdrop-blur-md">
      <div className="container-lux flex h-16 items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-3" onClick={() => setOpen(false)}>
          <span className="grid h-9 w-9 place-items-center rounded-full border border-steel-light/60 bg-[radial-gradient(circle_at_30%_30%,rgba(52,211,153,0.25),transparent_70%)] font-serif text-lg text-brand-light shadow-[0_0_18px_-4px_rgba(52,211,153,0.6)]">
            {BRAND.name.charAt(0)}
          </span>
          <span className="leading-tight">
            <span className="metal-text block font-serif text-lg tracking-wide">{BRAND.shortName}</span>
            <span className="block text-[10px] uppercase tracking-[0.28em] text-muted">Chauffeured</span>
          </span>
        </Link>

        {!isApp && (
          <nav className="hidden items-center gap-1 lg:flex" aria-label="Main">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "rounded-full px-3.5 py-2 text-sm text-ivory-dim transition-colors hover:text-ivory",
                  pathname === item.href && "text-brand",
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        )}

        <div className="flex items-center gap-2">
          <a
            href={`tel:${BRAND.phone.replace(/[^+\d]/g, "")}`}
            className="hidden items-center gap-2 rounded-full px-3 py-2 text-sm text-ivory-dim hover:text-brand md:flex"
          >
            <Phone className="h-4 w-4" /> {BRAND.phone}
          </a>
          {!isApp && (
            <ButtonLink href="/book" size="sm" className="hidden sm:inline-flex">
              Book a Ride
            </ButtonLink>
          )}
          {!isApp && (
            <button
              type="button"
              className="rounded-full p-2 text-ivory lg:hidden"
              aria-label={open ? "Close menu" : "Open menu"}
              aria-expanded={open}
              onClick={() => setOpen((v) => !v)}
            >
              {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          )}
        </div>
      </div>

      {open && !isApp && (
        <nav className="border-t border-line bg-ink lg:hidden" aria-label="Mobile">
          <div className="container-lux flex flex-col py-3">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="rounded-lg px-2 py-3 text-ivory-dim hover:text-brand"
              >
                {item.label}
              </Link>
            ))}
            <ButtonLink href="/book" className="mt-2" onClick={() => setOpen(false)}>
              Book a Ride
            </ButtonLink>
          </div>
        </nav>
      )}
    </header>
  );
}
