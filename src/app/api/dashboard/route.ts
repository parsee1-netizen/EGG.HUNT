import { NextResponse } from "next/server";
import { getStore } from "@/lib/db";
import { fail } from "@/lib/http";
import { requireBusiness } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await requireBusiness();
    const store = getStore();
    const [dashboard, business] = await Promise.all([
      store.dashboard(session.businessId!),
      store.getBusiness(session.businessId!),
    ]);
    return NextResponse.json({ dashboard, eggDesign: business?.eggDesign ?? null });
  } catch (err) {
    return fail(err);
  }
}
