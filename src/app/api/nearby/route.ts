import { NextResponse } from "next/server";
import { getStore } from "@/lib/db";
import { fail, requireFinite } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const lat = requireFinite(url.searchParams.get("lat"), "lat");
    const lng = requireFinite(url.searchParams.get("lng"), "lng");
    const radius = Number(url.searchParams.get("radius") ?? 1000);
    const radiusM = Number.isFinite(radius) ? Math.min(Math.max(radius, 50), 5000) : 1000;
    const store = getStore();
    const [eggs, businesses] = await Promise.all([
      store.listNearbyEggs(lat, lng, radiusM),
      store.listBusinessesNear(lat, lng, radiusM),
    ]);
    return NextResponse.json({
      eggs,
      businesses: businesses.map((b) => ({
        id: b.id,
        name: b.name,
        address: b.address,
        lat: b.lat,
        lng: b.lng,
      })),
    });
  } catch (err) {
    return fail(err);
  }
}
