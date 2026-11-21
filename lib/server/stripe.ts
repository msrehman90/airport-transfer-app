import "server-only";
import Stripe from "stripe";
import { serverEnv } from "../env";

let stripe: Stripe | null = null;

/** Stripe server client, or null when Stripe is not configured (Demo Mode). */
export function getStripe(): Stripe | null {
  if (!serverEnv.stripeReady()) return null;
  if (!stripe) {
    stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      appInfo: { name: "airport-transfer-app", version: "1.0.0" },
    });
  }
  return stripe;
}
