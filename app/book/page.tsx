import type { Metadata } from "next";
import { Suspense } from "react";
import { BookingFlow } from "@/components/book/BookingFlow";
import { Spinner } from "@/components/ui";

export const metadata: Metadata = {
  title: "Book a Chauffeur",
  description: "Book a flat-rate airport transfer, hourly chauffeur or point-to-point ride in minutes.",
};

export default function BookPage() {
  return (
    <div className="hero-glow">
      <div className="container-lux py-12 sm:py-16">
        <div className="mb-10 max-w-2xl">
          <p className="eyebrow">Reservations</p>
          <h1 className="heading-lux mt-3 text-4xl sm:text-5xl">Book your chauffeur</h1>
          <p className="mt-3 text-ivory-dim">Four quick steps. Your fare is calculated and confirmed on our servers before you pay.</p>
        </div>
        <Suspense
          fallback={
            <div className="flex justify-center py-20">
              <Spinner />
            </div>
          }
        >
          <BookingFlow />
        </Suspense>
      </div>
    </div>
  );
}
