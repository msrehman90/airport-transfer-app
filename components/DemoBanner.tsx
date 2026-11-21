"use client";

import { useState } from "react";
import { FlaskConical, RotateCcw, X } from "lucide-react";
import { LIVE_DATA } from "@/lib/client/api";
import { resetDemoDB } from "@/lib/client/demo-store";
import { publicEnv } from "@/lib/env";

/** Thin banner explaining Demo Mode (shown only when Supabase is not configured). */
export function DemoBanner() {
  const [hidden, setHidden] = useState(false);
  const [resetDone, setResetDone] = useState(false);
  if (LIVE_DATA || hidden) return null;

  const payments = publicEnv.stripePublishableKey ? "Stripe test payments" : "mock payments";

  return (
    <div className="border-b border-brand/20 bg-brand/[0.07] text-xs text-ivory-dim">
      <div className="container-lux flex items-center gap-3 py-2">
        <FlaskConical className="h-3.5 w-3.5 shrink-0 text-brand" aria-hidden />
        <p className="flex-1">
          <span className="font-semibold text-brand">Demo Mode</span> · bookings are saved in this browser with {payments}.
          Prices are still calculated on the server. Admin: <code className="text-ivory">admin123</code> · Driver:{" "}
          <code className="text-ivory">driver123</code>
        </p>
        <button
          type="button"
          className="hidden items-center gap-1 rounded-full px-2 py-1 hover:text-brand sm:flex"
          onClick={() => {
            resetDemoDB();
            setResetDone(true);
            setTimeout(() => setResetDone(false), 2000);
          }}
        >
          <RotateCcw className="h-3 w-3" /> {resetDone ? "Reset!" : "Reset demo data"}
        </button>
        <button type="button" aria-label="Hide demo banner" className="rounded-full p-1 hover:text-brand" onClick={() => setHidden(true)}>
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
