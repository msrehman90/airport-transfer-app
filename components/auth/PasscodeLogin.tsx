"use client";

import { useState } from "react";
import { KeyRound } from "lucide-react";
import { LIVE_DATA, demoDrivers, login, type SessionInfo } from "@/lib/client/api";
import { Alert, Button, Field } from "../ui";

/** Passcode sign-in for the admin dashboard and the driver portal. */
export function PasscodeLogin({
  role,
  onSignedIn,
}: {
  role: "admin" | "driver";
  onSignedIn: (session: SessionInfo) => void;
}) {
  const [passcode, setPasscode] = useState("");
  const [drivers, setDrivers] = useState<{ id: string; fullName: string }[] | null>(null);
  const [driverId, setDriverId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      if (role === "driver" && !driverId) {
        const res = await login("driver", passcode);
        const roster = LIVE_DATA ? res.drivers ?? [] : demoDrivers().map((d) => ({ id: d.id, fullName: d.fullName }));
        setDrivers(roster);
        if (roster.length === 0) setError("No drivers on the roster yet. Ask dispatch to add you.");
        else setDriverId(roster[0].id);
        return;
      }
      const res = await login(role, passcode, role === "driver" ? driverId : undefined);
      if (res.session) onSignedIn(res.session);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-md py-16">
      <form onSubmit={submit} className="card-lux space-y-5 p-8">
        <div className="text-center">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-full border border-gold/50 text-gold">
            <KeyRound className="h-5 w-5" />
          </span>
          <h1 className="heading-lux mt-4 text-3xl">{role === "admin" ? "Dispatch sign-in" : "Driver sign-in"}</h1>
          <p className="mt-2 text-sm text-ivory-dim">
            {role === "admin" ? "Enter the dispatch passcode." : "Enter the driver passcode, then choose your name."}
          </p>
        </div>
        <Field label="Passcode" htmlFor="passcode">
          <input
            id="passcode"
            type="password"
            className="input-lux"
            autoComplete="current-password"
            value={passcode}
            onChange={(e) => setPasscode(e.target.value)}
            required
            disabled={drivers !== null}
          />
        </Field>
        {drivers && drivers.length > 0 && (
          <Field label="I am" htmlFor="driver">
            <select id="driver" className="input-lux" value={driverId} onChange={(e) => setDriverId(e.target.value)}>
              {drivers.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.fullName}
                </option>
              ))}
            </select>
          </Field>
        )}
        {error && <Alert tone="error">{error}</Alert>}
        <Button type="submit" className="w-full" loading={loading}>
          {role === "driver" && !drivers ? "Continue" : "Sign in"}
        </Button>
        {!LIVE_DATA && (
          <p className="text-center text-xs text-muted">
            Demo passcode: <code className="text-ivory-dim">{role === "admin" ? "admin123" : "driver123"}</code> (unless changed in .env.local)
          </p>
        )}
      </form>
    </div>
  );
}
