import type { VehicleSlug } from "@/lib/config";

/** Minimal line-art vehicle silhouettes (no external images needed). */
export function CarIllustration({ slug, className }: { slug: VehicleSlug; className?: string }) {
  const body: Record<VehicleSlug, string> = {
    sedan:
      "M20 78 C22 66 34 62 52 60 L92 44 C104 39 120 37 140 37 L196 37 C214 37 228 42 242 52 L266 62 C286 64 300 68 304 78 L306 90 L18 90 Z",
    suv: "M18 78 C20 64 30 58 48 56 L72 32 C78 26 86 24 98 24 L232 24 C246 24 254 30 262 40 L276 56 C292 58 302 64 304 76 L306 90 L16 90 Z",
    escalade:
      "M16 78 C18 62 28 56 46 54 L70 28 C76 22 84 20 96 20 L238 20 C252 20 260 26 266 36 L280 54 C296 56 304 62 306 74 L308 90 L14 90 Z",
    sprinter:
      "M14 80 C14 66 20 58 32 52 L48 22 C52 14 60 10 72 10 L292 10 C302 10 308 16 308 26 L308 90 L12 90 Z",
  };
  const windows: Record<VehicleSlug, string> = {
    sedan: "M98 48 L136 42 L176 42 L176 58 L82 58 Z M184 42 L200 42 C214 42 226 47 236 56 L184 58 Z",
    suv: "M82 34 L100 30 L160 30 L160 52 L66 54 Z M168 30 L230 30 C240 30 246 36 252 46 L256 52 L168 52 Z",
    escalade: "M80 30 L98 26 L162 26 L162 50 L64 52 Z M170 26 L236 26 C246 26 252 32 258 42 L262 50 L170 50 Z",
    sprinter: "M58 22 L80 18 L120 18 L120 46 L42 50 Z M128 18 L190 18 L190 46 L128 46 Z M198 18 L262 18 L262 46 L198 46 Z",
  };
  const wheels: Record<VehicleSlug, [number, number]> = {
    sedan: [76, 244],
    suv: [76, 248],
    escalade: [76, 250],
    sprinter: [70, 262],
  };
  const [w1, w2] = wheels[slug];
  return (
    <svg viewBox="0 0 320 110" className={className} role="img" aria-label={`${slug} illustration`}>
      <defs>
        <linearGradient id={`body-${slug}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#2b2b30" />
          <stop offset="100%" stopColor="#0f0f11" />
        </linearGradient>
        <linearGradient id={`glass-${slug}`} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0%" stopColor="#3a3a40" />
          <stop offset="100%" stopColor="#1a1a1e" />
        </linearGradient>
      </defs>
      <ellipse cx="160" cy="96" rx="150" ry="6" fill="rgba(0,0,0,0.5)" />
      <path d={body[slug]} fill={`url(#body-${slug})`} stroke="#c9a24b" strokeWidth="1.2" />
      <path d={windows[slug]} fill={`url(#glass-${slug})`} stroke="#c9a24b" strokeOpacity="0.5" strokeWidth="0.8" />
      <line x1="30" y1="72" x2="296" y2="72" stroke="#c9a24b" strokeOpacity="0.35" strokeWidth="0.8" />
      {[w1, w2].map((x) => (
        <g key={x}>
          <circle cx={x} cy="88" r="15" fill="#0b0b0c" stroke="#c9a24b" strokeWidth="1.2" />
          <circle cx={x} cy="88" r="7" fill="#1c1c20" stroke="#e3c57d" strokeOpacity="0.6" strokeWidth="0.8" />
        </g>
      ))}
      <rect x="296" y="66" width="8" height="5" rx="1.5" fill="#e3c57d" />
      <rect x="16" y="68" width="6" height="5" rx="1.5" fill="#e06a5a" opacity="0.8" />
    </svg>
  );
}
