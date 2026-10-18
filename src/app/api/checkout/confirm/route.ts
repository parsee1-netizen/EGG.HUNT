import { NextResponse } from "next/server";
import { getStore } from "@/lib/db";
import { fail } from "@/lib/http";
import { requireBusiness } from "@/lib/session";
import { getStripe } from "@/lib/stripe";

export const dynamic = "force-dynamic";

/** Activates eggs when Stripe redirects back, in case the webhook has not landed yet. */
export async function POST(req: Request) {
  try {
    const session = await requireBusiness();
    const body = (await req.json()) as { sessionId?: string };
    const sessionId = String(body.sessionId ?? "");
    const stripe = getStripe();
    if (!stripe) return NextResponse.json({ error: "Stripe is not configured." }, { status: 400 });
    if (!sessionId) return NextResponse.json({ error: "Missing Checkout session." }, { status: 400 });

    const checkout = await stripe.checkout.sessions.retrieve(sessionId);
    if (checkout.payment_status !== "paid") {
      return NextResponse.json({ error: "Payment is not complete yet." }, { status: 402 });
    }
    const campaignId = checkout.metadata?.campaignId || checkout.client_reference_id;
    if (!campaignId) return NextResponse.json({ error: "Checkout session has no campaign." }, { status: 400 });

    const store = getStore();
    const campaign = await store.getCampaign(campaignId);
    if (!campaign || campaign.businessId !== session.businessId) {
      return NextResponse.json({ error: "Campaign not found." }, { status: 404 });
    }
    await store.activateCampaign(campaignId, checkout.id);
    return NextResponse.json({ ok: true, campaignId });
  } catch (err) {
    return fail(err);
  }
}
