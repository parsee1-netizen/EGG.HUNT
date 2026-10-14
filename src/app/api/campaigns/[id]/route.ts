import { NextResponse } from "next/server";
import { getStore } from "@/lib/db";
import { fail } from "@/lib/http";
import { requireBusiness } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireBusiness();
    const { id } = await context.params;
    const campaign = await getStore().getCampaign(id);
    if (!campaign || campaign.businessId !== session.businessId) {
      return NextResponse.json({ error: "Campaign not found." }, { status: 404 });
    }
    return NextResponse.json({ campaign });
  } catch (err) {
    return fail(err);
  }
}
