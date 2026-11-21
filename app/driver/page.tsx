import type { Metadata } from "next";
import { DriverClient } from "@/components/driver/DriverClient";

export const metadata: Metadata = {
  title: "Driver Portal",
  robots: { index: false, follow: false },
};

export default function DriverPage() {
  return <DriverClient />;
}
