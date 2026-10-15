import { NextResponse } from "next/server";
import { getStore } from "@/lib/db";
import { fail } from "@/lib/http";
import { requireBusiness } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const session = await requireBusiness();
    const body = (await req.json()) as { tokenOrCode?: string };
    const tokenOrCode = String(body.tokenOrCode ?? "").trim();
    if (!tokenOrCode) return NextResponse.json({ error: "Enter a code or scan a QR." }, { status: 400 });
    const result = await getStore().redeem({
      tokenOrCode,
      businessId: session.businessId!,
      redeemedBy: session.userId,
    });
    return NextResponse.json(result);
  } catch (err) {
    return fail(err);
  }
}
