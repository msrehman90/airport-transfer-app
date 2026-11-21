import Link from "next/link";
import { AIRPORTS, BRAND } from "@/lib/config";

export function SiteFooter() {
  return (
    <footer className="border-t border-line bg-ink-2">
      <div className="container-lux grid gap-10 py-14 md:grid-cols-4">
        <div className="md:col-span-2">
          <p className="font-serif text-2xl text-ivory">{BRAND.name}</p>
          <p className="mt-3 max-w-md text-sm text-ivory-dim">{BRAND.tagline}</p>
          <p className="mt-4 text-sm text-muted">{BRAND.serviceArea}</p>
        </div>
        <div>
          <p className="eyebrow">Airports & Stations</p>
          <ul className="mt-4 space-y-2 text-sm text-ivory-dim">
            {AIRPORTS.map((a) => (
              <li key={a.code}>{a.shortName}</li>
            ))}
          </ul>
        </div>
        <div>
          <p className="eyebrow">Contact</p>
          <ul className="mt-4 space-y-2 text-sm text-ivory-dim">
            <li>
              <a href={`tel:${BRAND.phone.replace(/[^+\d]/g, "")}`} className="hover:text-brand">
                {BRAND.phone}
              </a>
            </li>
            <li>
              <a href={`mailto:${BRAND.email}`} className="hover:text-brand">
                {BRAND.email}
              </a>
            </li>
            <li>
              <Link href="/track" className="hover:text-brand">
                Manage a booking
              </Link>
            </li>
            <li className="flex gap-3 pt-2 text-xs text-muted">
              <Link href="/admin" className="hover:text-brand">
                Dispatch
              </Link>
              <span>·</span>
              <Link href="/driver" className="hover:text-brand">
                Driver portal
              </Link>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-line">
        <div className="container-lux flex flex-col gap-2 py-6 text-xs text-muted sm:flex-row sm:justify-between">
          <p>
            © {new Date().getFullYear()} {BRAND.name}. All rides by licensed, insured chauffeurs.
          </p>
          <p>Free cancellation up to 24 hours before pickup.</p>
        </div>
      </div>
    </footer>
  );
}
