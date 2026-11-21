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
  primary: "bg-brand text-white hover:bg-brand-dark shadow-[0_8px_20px_-10px_rgba(11,31,58,0.55)]",
  outline: "border border-brand/30 bg-white text-brand hover:border-brand hover:bg-brand/[0.04]",
  ghost: "text-ivory-dim hover:text-ivory hover:bg-ink-2",
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
  pending: "bg-amber-50 text-amber-800 border-amber-200",
  confirmed: "bg-sky-50 text-sky-800 border-sky-200",
  assigned: "bg-violet-50 text-violet-800 border-violet-200",
  en_route: "bg-blue-50 text-blue-800 border-blue-200",
  arrived: "bg-indigo-50 text-indigo-800 border-indigo-200",
  in_progress: "bg-teal-50 text-teal-800 border-teal-200",
  completed: "bg-emerald-50 text-emerald-800 border-emerald-200",
  cancelled: "bg-red-50 text-red-800 border-red-200",
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
      ? "bg-emerald-50 text-emerald-800 border-emerald-200"
      : status === "refunded"
        ? "bg-sky-50 text-sky-800 border-sky-200"
        : "bg-ink-2 text-ivory-dim border-line";
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold capitalize", tone)}>
      {status}
    </span>
  );
}

export function Alert({ tone = "info", children }: { tone?: "info" | "error" | "success" | "warning"; children: ReactNode }) {
  const tones = {
    info: "border-brand/15 bg-ink-2 text-ivory-dim",
    error: "border-red-200 bg-red-50 text-red-800",
    success: "border-emerald-200 bg-emerald-50 text-emerald-800",
    warning: "border-amber-200 bg-amber-50 text-amber-800",
  };
  return (
    <div className={cn("rounded-xl border px-4 py-3 text-sm", tones[tone])} role={tone === "error" ? "alert" : "status"}>
      {children}
    </div>
  );
}
