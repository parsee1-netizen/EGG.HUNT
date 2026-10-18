import { NextResponse } from "next/server";
import { getStore } from "@/lib/db";
import { fail } from "@/lib/http";
import { requireBusiness } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const session = await requireBusiness();
    const campaign = new URL(req.url).searchParams.get("campaign");
    const results = await getStore().results(session.businessId!, campaign);
    return NextResponse.json(results);
  } catch (err) {
    return fail(err);
  }
}
