import { NextResponse } from "next/server";
import { getStore } from "@/lib/db";
import { fail } from "@/lib/http";
import { requireBusiness } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await requireBusiness();
    const dashboard = await getStore().dashboard(session.businessId!);
    return NextResponse.json({ dashboard });
  } catch (err) {
    return fail(err);
  }
}
