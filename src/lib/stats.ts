import { weekdayName } from "./format";
import { StoreError } from "./errors";
import type {
  Business,
  Campaign,
  CampaignResults,
  CampaignSummary,
  Claim,
  DashboardStats,
  Egg,
  Redemption,
} from "./types";

export function campaignSummaries(campaigns: Campaign[]): CampaignSummary[] {
  return campaigns
    .map((c) => ({
      id: c.id,
      name: c.name,
      status: c.status,
      eggCount: c.eggCount,
      amountCents: c.amountCents,
      paidAt: c.paidAt,
      rewardTitle: c.rewardTitle,
    }))
    .sort((a, b) => (b.paidAt ?? "").localeCompare(a.paidAt ?? ""));
}

export function dashboardFrom(
  business: Business,
  campaigns: Campaign[],
  eggs: Egg[],
  redemptions: Redemption[],
): DashboardStats {
  const placed = eggs.filter((e) => e.status !== "pending");
  const activeCampaigns = campaigns.filter((c) => c.status === "active");
  const spendCents = activeCampaigns.reduce((sum, c) => sum + c.amountCents, 0);
  const latest = activeCampaigns.slice().sort((a, b) => (b.paidAt ?? "").localeCompare(a.paidAt ?? ""))[0];
  const headline =
    activeCampaigns.length === 0
      ? "No live campaign"
      : activeCampaigns.length === 1
        ? `${latest.name} campaign · live`
        : `${latest.name} · plus ${activeCampaigns.length - 1} more`;
  return {
    businessId: business.id,
    businessName: business.name,
    headline,
    live: placed.filter((e) => e.status === "active").length,
    found: placed.filter((e) => e.status === "claimed").length,
    redeemed: redemptions.length,
    spendCents,
    costPerVisitCents: redemptions.length > 0 ? Math.round(spendCents / redemptions.length) : null,
    campaignCount: activeCampaigns.length,
  };
}

export function resultsFrom(
  campaigns: Campaign[],
  eggs: Egg[],
  claims: Claim[],
  redemptions: Redemption[],
  campaignId?: string | null,
): { campaigns: CampaignSummary[]; selected: CampaignResults } {
  if (campaigns.length === 0) throw new StoreError("not_found", 404, "No campaigns yet.");
  const selected = selectCampaign(campaigns, eggs, campaignId);
  const campaignEggs = eggs.filter((e) => e.campaignId === selected.id);
  const campaignRedemptions = redemptions.filter((r) => r.campaignId === selected.id);
  const ordered = redemptions.slice().sort((a, b) => a.redeemedAt.localeCompare(b.redeemedAt));
  const firstCampaign = new Map<string, string>();
  for (const redemption of ordered) {
    if (!firstCampaign.has(redemption.playerId)) firstCampaign.set(redemption.playerId, redemption.campaignId);
  }
  let newCustomers = 0;
  for (const id of firstCampaign.values()) {
    if (id === selected.id) newCustomers++;
  }

  const dayCounts = new Map<string, number>();
  for (const redemption of campaignRedemptions) {
    const day = weekdayName(redemption.redeemedAt);
    dayCounts.set(day, (dayCounts.get(day) ?? 0) + 1);
  }
  let bestDay: string | null = null;
  let bestN = 0;
  for (const [day, n] of dayCounts) {
    if (n > bestN) {
      bestDay = day;
      bestN = n;
    }
  }

  const rewardCounts = new Map<string, number>();
  for (const redemption of campaignRedemptions) {
    const claim = claims.find((c) => c.id === redemption.claimId);
    if (!claim) continue;
    rewardCounts.set(claim.rewardTitle, (rewardCounts.get(claim.rewardTitle) ?? 0) + 1);
  }
  let topReward: string | null = null;
  let topN = 0;
  for (const [title, n] of rewardCounts) {
    if (n > topN) {
      topReward = title;
      topN = n;
    }
  }

  const start = new Date(selected.paidAt ?? selected.createdAt).getTime();
  const daysRunning = Math.max(0, Math.round((Date.now() - start) / 86_400_000));

  return {
    campaigns: campaignSummaries(campaigns),
    selected: {
      id: selected.id,
      name: selected.name,
      status: selected.status,
      rewardTitle: selected.rewardTitle,
      placed: campaignEggs.length,
      live: campaignEggs.filter((e) => e.status === "active").length,
      found: campaignEggs.filter((e) => e.status === "claimed").length,
      redeemed: campaignRedemptions.length,
      newCustomers,
      bestDay,
      topReward,
      daysRunning,
      amountCents: selected.amountCents,
    },
  };
}

function selectCampaign(campaigns: Campaign[], eggs: Egg[], campaignId?: string | null): Campaign {
  if (campaignId) {
    const found = campaigns.find((c) => c.id === campaignId);
    if (!found) throw new StoreError("not_found", 404, "Campaign not found.");
    return found;
  }
  return campaigns.slice().sort((a, b) => {
    const aEggs = eggs.filter((e) => e.campaignId === a.id).length;
    const bEggs = eggs.filter((e) => e.campaignId === b.id).length;
    if (bEggs !== aEggs) return bEggs - aEggs;
    return (b.paidAt ?? "").localeCompare(a.paidAt ?? "");
  })[0];
}
