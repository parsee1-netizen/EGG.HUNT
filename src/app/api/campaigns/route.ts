import { NextResponse } from "next/server";
import { getStore } from "@/lib/db";
import { parseEggDesign } from "@/lib/egg-design";
import { fail } from "@/lib/http";
import { DROP_RADIUS_M } from "@/lib/pricing";
import { buildReward, campaignName } from "@/lib/rewards";
import { requireBusiness } from "@/lib/session";
import type { RewardType } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const session = await requireBusiness();
    const body = (await req.json()) as {
      eggCount?: number;
      emptyCount?: number;
      rewardType?: RewardType;
      rewardDetail?: string;
      radiusM?: number;
      eggDesign?: unknown;
    };
    const rewardType: RewardType = body.rewardType === "gift_card" ? "gift_card" : "discount";
    const reward = buildReward(rewardType, String(body.rewardDetail ?? ""));
    const campaign = await getStore().createCampaign({
      businessId: session.businessId!,
      name: campaignName(),
      radiusM: Number(body.radiusM) || DROP_RADIUS_M,
      eggCount: Number(body.eggCount),
      emptyCount: body.emptyCount == null ? 0 : Number(body.emptyCount),
      eggDesign: body.eggDesign == null ? null : parseEggDesign(body.eggDesign),
      ...reward,
    });
    return NextResponse.json({ campaign });
  } catch (err) {
    return fail(err);
  }
}
