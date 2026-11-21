"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import { confirmPayment } from "@/lib/client/api";
import { Alert, ButtonLink, Spinner } from "@/components/ui";

/** Return page for Stripe redirects (e.g. 3-D Secure). Verifies the payment on the server. */
function Confirmation() {
  const params = useSearchParams();
  const ref = params.get("ref") ?? "";
  const paymentIntentId = params.get("payment_intent");
  const redirectStatus = params.get("redirect_status");
  const [state, setState] = useState<"checking" | "paid" | "failed">("checking");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!ref || !paymentIntentId || redirectStatus === "failed") {
      setState("failed");
      setMessage("The payment was not completed.");
      return;
    }
    confirmPayment(ref, paymentIntentId)
      .then((paid) => {
        setState(paid ? "paid" : "failed");
        if (!paid) setMessage("Your bank hasn't confirmed the payment yet. Check Manage Booking in a few minutes.");
      })
      .catch((err: Error) => {
        setState("failed");
        setMessage(err.message);
      });
  }, [ref, paymentIntentId, redirectStatus]);

  return (
    <div className="card-lux mx-auto max-w-xl p-10 text-center">
      {state === "checking" && (
        <>
          <Spinner className="mx-auto h-10 w-10" />
          <p className="mt-4 text-ivory-dim">Confirming your payment…</p>
        </>
      )}
      {state === "paid" && (
        <>
          <CheckCircle2 className="mx-auto h-14 w-14 text-brand" />
          <h1 className="heading-lux mt-4 text-4xl">Your ride is confirmed</h1>
          <p className="mt-3 text-ivory-dim">
            Booking reference <span className="font-mono text-brand">{ref}</span>. A confirmation email is on its way.
          </p>
          <ButtonLink href={`/track?ref=${encodeURIComponent(ref)}`} className="mt-8">
            Manage booking
          </ButtonLink>
        </>
      )}
      {state === "failed" && (
        <>
          <XCircle className="mx-auto h-14 w-14 text-danger" />
          <h1 className="heading-lux mt-4 text-3xl">Payment not completed</h1>
          {message && (
            <div className="mt-4">
              <Alert tone="error">{message}</Alert>
            </div>
          )}
          <ButtonLink href={ref ? `/track?ref=${encodeURIComponent(ref)}` : "/book"} className="mt-8">
            {ref ? "Try again from Manage Booking" : "Start a new booking"}
          </ButtonLink>
        </>
      )}
    </div>
  );
}

export default function ConfirmationPage() {
  return (
    <div className="container-lux py-20">
      <Suspense fallback={<Spinner className="mx-auto" />}>
        <Confirmation />
      </Suspense>
    </div>
  );
}
