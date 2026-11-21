"use client";

import Link from "next/link";
import { Loader2 } from "lucide-react";
import type { ButtonHTMLAttributes, ComponentProps, ReactNode } from "react";
import { BOOKING_STATUS_LABELS } from "@/lib/config";
import type { BookingStatus, PaymentStatus } from "@/lib/types";

export function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(" ");
}

type Variant = "primary" | "outline" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const variantClass: Record<Variant, string> = {
  primary:
    "bg-[linear-gradient(135deg,var(--color-brand-light),var(--color-brand)_45%,#059669)] text-ink hover:brightness-110 shadow-[0_10px_30px_-10px_rgba(16,185,129,0.65)] ring-1 ring-inset ring-white/15",
  outline: "border border-steel-light/50 text-steel-light hover:bg-steel/15 hover:border-steel-light",
  ghost: "text-ivory-dim hover:text-ivory hover:bg-white/5",
  danger: "border border-danger/60 text-danger hover:bg-danger/10",
};

const sizeClass: Record<Size, string> = {
  sm: "px-3.5 py-2 text-xs",
  md: "px-5 py-2.5 text-sm",
  lg: "px-7 py-3.5 text-sm",
};

const base =
  "inline-flex items-center justify-center gap-2 rounded-full font-semibold tracking-wide transition-all disabled:cursor-not-allowed disabled:opacity-50";

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  className,
  children,
  disabled,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size; loading?: boolean }) {
  return (
    <button
      {...props}
      disabled={disabled || loading}
      className={cn(base, variantClass[variant], sizeClass[size], className)}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
}

export function ButtonLink({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ComponentProps<typeof Link> & { variant?: Variant; size?: Size }) {
  return <Link {...props} className={cn(base, variantClass[variant], sizeClass[size], className)} />;
}

export function Field({
  label,
  error,
  hint,
  children,
  className,
  htmlFor,
}: {
  label: string;
  error?: string;
  hint?: string;
  children: ReactNode;
  className?: string;
  htmlFor?: string;
}) {
  return (
    <div className={className}>
      <label className="label-lux" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
      {error ? (
        <p className="mt-1.5 text-xs text-danger" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="mt-1.5 text-xs text-muted">{hint}</p>
      ) : null}
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn("h-5 w-5 animate-spin text-brand", className)} aria-label="Loading" />;
}

const statusTone: Record<BookingStatus, string> = {
  pending: "bg-warning/15 text-warning border-warning/30",
  confirmed: "bg-sky-400/10 text-sky-300 border-sky-400/30",
  assigned: "bg-violet-400/10 text-violet-300 border-violet-400/30",
  en_route: "bg-steel/15 text-steel-light border-steel/40",
  arrived: "bg-steel/25 text-steel-light border-steel/50",
  in_progress: "bg-emerald-400/10 text-emerald-300 border-emerald-400/30",
  completed: "bg-success/15 text-success border-success/30",
  cancelled: "bg-danger/10 text-danger border-danger/30",
};

export function StatusBadge({ status }: { status: BookingStatus }) {
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold", statusTone[status])}>
      {BOOKING_STATUS_LABELS[status]}
    </span>
  );
}

export function PaymentBadge({ status }: { status: PaymentStatus }) {
  const tone =
    status === "paid"
      ? "bg-success/15 text-success border-success/30"
      : status === "refunded"
        ? "bg-sky-400/10 text-sky-300 border-sky-400/30"
        : "bg-white/5 text-ivory-dim border-line";
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold capitalize", tone)}>
      {status}
    </span>
  );
}

export function Alert({ tone = "info", children }: { tone?: "info" | "error" | "success" | "warning"; children: ReactNode }) {
  const tones = {
    info: "border-brand/30 bg-brand/5 text-ivory-dim",
    error: "border-danger/40 bg-danger/10 text-danger",
    success: "border-success/40 bg-success/10 text-success",
    warning: "border-warning/40 bg-warning/10 text-warning",
  };
  return (
    <div className={cn("rounded-xl border px-4 py-3 text-sm", tones[tone])} role={tone === "error" ? "alert" : "status"}>
      {children}
    </div>
  );
}
