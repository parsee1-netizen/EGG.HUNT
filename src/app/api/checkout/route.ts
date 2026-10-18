import { NextResponse } from "next/server";
import { getStore } from "@/lib/db";
import { fail } from "@/lib/http";
import { EGG_PRICE_CENTS } from "@/lib/pricing";
import { requireBusiness } from "@/lib/session";
import { appUrl, getStripe } from "@/lib/stripe";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const session = await requireBusiness();
    const body = (await req.json()) as { campaignId?: string };
    const campaignId = String(body.campaignId ?? "");
    const store = getStore();
    const campaign = await store.getCampaign(campaignId);
    if (!campaign || campaign.businessId !== session.businessId) {
      return NextResponse.json({ error: "Campaign not found." }, { status: 404 });
    }
    if (campaign.status === "active") {
      return NextResponse.json({ ok: true, alreadyActive: true, campaignId });
    }

    const stripe = getStripe();
    if (!stripe) {
      await store.activateCampaign(campaignId, null);
      return NextResponse.json({ ok: true, demo: true, campaignId });
    }

    const origin = appUrl(req);
    const checkout = await stripe.checkout.sessions.create({
      mode: "payment",
      success_url: `${origin}/business/results?campaign=${campaignId}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/business/checkout?campaign=${campaignId}&canceled=1`,
      client_reference_id: campaignId,
      metadata: { campaignId },
      line_items: [
        {
          quantity: campaign.eggCount,
          price_data: {
            currency: "usd",
            unit_amount: EGG_PRICE_CENTS,
            product_data: {
              name: "EggDrop hidden egg",
              description: `${campaign.rewardTitle} · ${campaign.name}`,
            },
          },
        },
      ],
    });
    if (checkout.id) await store.attachCheckoutSession(campaignId, checkout.id);
    return NextResponse.json({ ok: true, url: checkout.url, campaignId });
  } catch (err) {
    return fail(err);
  }
}
