import { NextResponse } from "next/server";
import { getStore } from "@/lib/db";
import { fail, requireFinite } from "@/lib/http";
import { requirePlayer } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await requirePlayer();
    const claims = await getStore().listClaimsForPlayer(session.userId);
    return NextResponse.json({ claims });
  } catch (err) {
    return fail(err);
  }
}

export async function POST(req: Request) {
  try {
    const session = await requirePlayer();
    const body = (await req.json()) as { eggId?: string; lat?: number; lng?: number };
    const eggId = String(body.eggId ?? "");
    if (!eggId) return NextResponse.json({ error: "Egg is required." }, { status: 400 });
    const claim = await getStore().claimEgg({
      eggId,
      playerId: session.userId,
      lat: requireFinite(body.lat, "lat"),
      lng: requireFinite(body.lng, "lng"),
    });
    return NextResponse.json({ claim });
  } catch (err) {
    return fail(err);
  }
}
