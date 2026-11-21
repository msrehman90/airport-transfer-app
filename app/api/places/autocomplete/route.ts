import { NextResponse } from "next/server";
import { AIRPORTS } from "@/lib/config";
import { DistanceError, suggestAddresses } from "@/lib/server/distance";

export const dynamic = "force-dynamic";

// Bias suggestions toward the centre of the configured airports.
const CENTER = {
  lat: AIRPORTS.reduce((s, a) => s + a.lat, 0) / AIRPORTS.length,
  lng: AIRPORTS.reduce((s, a) => s + a.lng, 0) / AIRPORTS.length,
};

/**
 * GET /api/places/autocomplete?q=… — free address suggestions via Geoapify.
 * The API key stays on the server. Returns { enabled: false } when not configured.
 */
export async function GET(request: Request) {
  const q = (new URL(request.url).searchParams.get("q") ?? "").trim();
  if (q.length < 3 || q.length > 200) return NextResponse.json({ enabled: true, suggestions: [] });
  try {
    const suggestions = await suggestAddresses(q, CENTER);
    if (suggestions === null) return NextResponse.json({ enabled: false, suggestions: [] });
    return NextResponse.json(
      { enabled: true, suggestions },
      { headers: { "Cache-Control": "private, max-age=300" } },
    );
  } catch (err) {
    if (err instanceof DistanceError) return NextResponse.json({ enabled: true, suggestions: [], error: err.message });
    console.error("[places] autocomplete failed", err);
    return NextResponse.json({ enabled: true, suggestions: [] });
  }
}
