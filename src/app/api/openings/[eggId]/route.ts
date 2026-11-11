import { NextResponse } from "next/server";
import { getStore } from "@/lib/db";
import { fail } from "@/lib/http";
import { requirePlayer } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, context: { params: Promise<{ eggId: string }> }) {
  try {
    const session = await requirePlayer();
    const { eggId } = await context.params;
    const opening = await getStore().getEmptyOpening(eggId, session.userId);
    if (!opening) return NextResponse.json({ error: "Egg not found." }, { status: 404 });
    return NextResponse.json({ opening });
  } catch (err) {
    return fail(err);
  }
}
