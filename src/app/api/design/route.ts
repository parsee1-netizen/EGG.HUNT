import { NextResponse } from "next/server";
import { getStore } from "@/lib/db";
import { parseEggDesign } from "@/lib/egg-design";
import { fail } from "@/lib/http";
import { requireBusiness } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await requireBusiness();
    const business = await getStore().getBusiness(session.businessId!);
    return NextResponse.json({ design: business?.eggDesign ?? null });
  } catch (err) {
    return fail(err);
  }
}

export async function PUT(req: Request) {
  try {
    const session = await requireBusiness();
    const body = (await req.json()) as { design?: unknown };
    const design = body.design == null ? null : parseEggDesign(body.design);
    const saved = await getStore().saveEggDesign(session.businessId!, design);
    return NextResponse.json({ design: saved });
  } catch (err) {
    return fail(err);
  }
}
