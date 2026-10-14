import type { RewardType } from "./types";

export function buildReward(rewardType: RewardType, detail: string) {
  const clean = detail.trim().replace(/\s+/g, " ").slice(0, 80);
  if (rewardType === "gift_card") {
    return {
      rewardType,
      rewardLabel: "$5",
      rewardDetail: clean || "In-store credit",
      rewardTitle: "$5 gift card",
    };
  }
  return {
    rewardType: "discount" as const,
    rewardLabel: "15% OFF",
    rewardDetail: clean || "Any coffee drink",
    rewardTitle: "15% off",
  };
}

export function campaignName(now = new Date()): string {
  const label = now.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  return `Egg drop ${label}`;
}
