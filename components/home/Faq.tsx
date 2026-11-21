import { ChevronDown } from "lucide-react";
import { CHILD_SEAT_FEE, FREE_CANCELLATION_HOURS, MEET_AND_GREET_FEE } from "@/lib/config";

const FAQS = [
  {
    q: "What happens if my flight is delayed?",
    a: "We track every inbound flight. If your arrival moves by more than 10 minutes, your pickup time is adjusted automatically and your chauffeur is notified. There is no charge for airline delays.",
  },
  {
    q: "Are your airport prices really flat?",
    a: "Yes. Trips between our listed areas and DCA, IAD, BWI or Union Station are a fixed price per vehicle, in either direction, with no surge pricing. Addresses outside those areas are priced by distance at a published per-mile rate.",
  },
  {
    q: "What is your cancellation policy?",
    a: `Cancel at least ${FREE_CANCELLATION_HOURS} hours before pickup for a full refund. If your airline cancels your flight, you get a 100% refund or free rebooking, whenever it happens. You can cancel online from Manage Booking.`,
  },
  {
    q: "What is Meet & Greet?",
    a: `For $${MEET_AND_GREET_FEE}, your chauffeur waits inside the terminal at baggage claim with a name sign, helps with your luggage and walks you to the car.`,
  },
  {
    q: "Do you provide child safety seats?",
    a: `Yes. Infant, convertible and booster seats are available for $${CHILD_SEAT_FEE} per seat. Add them when you book so we can install them before pickup.`,
  },
  {
    q: "How does hourly service work?",
    a: "Book a chauffeur and vehicle by the hour for meetings, events or a night out. There is a 3-hour minimum, and each hour includes up to 25 miles.",
  },
];

export function Faq() {
  return (
    <div className="divide-y divide-line rounded-2xl border border-line">
      {FAQS.map((item) => (
        <details key={item.q} className="group px-6 py-5 [&_summary::-webkit-details-marker]:hidden">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-left text-ivory">
            <span className="font-medium">{item.q}</span>
            <ChevronDown className="h-4 w-4 shrink-0 text-brand transition-transform group-open:rotate-180" />
          </summary>
          <p className="mt-3 text-sm leading-relaxed text-ivory-dim">{item.a}</p>
        </details>
      ))}
    </div>
  );
}
