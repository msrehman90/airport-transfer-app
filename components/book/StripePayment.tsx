"use client";

import { useMemo, useState } from "react";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js/pure";
import type { Stripe } from "@stripe/stripe-js";
import { Lock } from "lucide-react";
import { publicEnv } from "@/lib/env";
import { formatUSD } from "@/lib/pricing";
import { Alert, Button } from "../ui";

let stripePromise: Promise<Stripe | null> | null = null;
function getStripePromise() {
  if (!stripePromise && publicEnv.stripePublishableKey) stripePromise = loadStripe(publicEnv.stripePublishableKey);
  return stripePromise;
}

function CheckoutForm({
  amount,
  bookingRef,
  onPaid,
}: {
  amount: number;
  bookingRef: string;
  onPaid: (paymentIntentId: string) => Promise<void>;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;
    setSubmitting(true);
    setError(null);
    const { error: stripeError, paymentIntent } = await stripe.confirmPayment({
      elements,
      redirect: "if_required",
      confirmParams: {
        return_url: `${window.location.origin}/book/confirmation?ref=${encodeURIComponent(bookingRef)}`,
      },
    });
    if (stripeError) {
      setError(stripeError.message ?? "Payment failed. Please try another card.");
      setSubmitting(false);
      return;
    }
    if (paymentIntent && (paymentIntent.status === "succeeded" || paymentIntent.status === "processing")) {
      try {
        await onPaid(paymentIntent.id);
      } catch (err) {
        setError((err as Error).message);
      }
    } else {
      setError(`Payment status: ${paymentIntent?.status ?? "unknown"}. Please try again.`);
    }
    setSubmitting(false);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <PaymentElement options={{ layout: "tabs" }} />
      {error && <Alert tone="error">{error}</Alert>}
      <Button type="submit" size="lg" className="w-full" loading={submitting} disabled={!stripe}>
        <Lock className="h-4 w-4" /> Pay {formatUSD(amount)}
      </Button>
    </form>
  );
}

/** Stripe Payment Element wrapper themed to match the site. */
export function StripePayment(props: {
  clientSecret: string;
  amount: number;
  bookingRef: string;
  onPaid: (paymentIntentId: string) => Promise<void>;
}) {
  const options = useMemo(
    () => ({
      clientSecret: props.clientSecret,
      appearance: {
        theme: "night" as const,
        variables: {
          colorPrimary: "#c9a24b",
          colorBackground: "#111113",
          colorText: "#f5f1e8",
          colorDanger: "#e06a5a",
          borderRadius: "12px",
          fontFamily: "Inter, system-ui, sans-serif",
        },
      },
    }),
    [props.clientSecret],
  );
  const promise = getStripePromise();
  if (!promise) return <Alert tone="error">Stripe publishable key is missing.</Alert>;
  return (
    <Elements stripe={promise} options={options}>
      <CheckoutForm amount={props.amount} bookingRef={props.bookingRef} onPaid={props.onPaid} />
    </Elements>
  );
}
