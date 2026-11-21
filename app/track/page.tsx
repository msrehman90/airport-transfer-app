import type { Metadata } from "next";
import { Suspense } from "react";
import { TrackClient } from "@/components/track/TrackClient";
import { Spinner } from "@/components/ui";

export const metadata: Metadata = {
  title: "Manage Booking",
  description: "Track your chauffeur, check your flight and manage or cancel your booking.",
};

export default function TrackPage() {
  return (
    <div className="container-lux py-12 sm:py-16">
      <div className="mb-10 max-w-2xl">
        <p className="eyebrow">Manage Booking</p>
        <h1 className="heading-lux mt-3 text-4xl sm:text-5xl">Track your ride</h1>
        <p className="mt-3 text-ivory-dim">Live status, chauffeur details, flight updates and free cancellation up to 24 hours ahead.</p>
      </div>
      <Suspense
        fallback={
          <div className="flex justify-center py-20">
            <Spinner />
          </div>
        }
      >
        <TrackClient />
      </Suspense>
    </div>
  );
}
