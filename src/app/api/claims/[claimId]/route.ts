import { NextResponse } from "next/server";
import { getStore } from "@/lib/db";
import { fail } from "@/lib/http";
import { requirePlayer } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, context: { params: Promise<{ claimId: string }> }) {
  try {
    const session = await requirePlayer();
    const { claimId } = await context.params;
    const claim = await getStore().getClaim(claimId);
    if (!claim || claim.playerId !== session.userId) {
      return NextResponse.json({ error: "Reward not found." }, { status: 404 });
    }
    return NextResponse.json({ claim });
  } catch (err) {
    return fail(err);
  }
}
