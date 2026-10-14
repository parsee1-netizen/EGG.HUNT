import { codeFromInt, tokenFromInt } from "./codes";
import { destination, type LatLng } from "./geo";
import { EGG_PRICE_CENTS } from "./pricing";
import type { Business, Campaign, Claim, Database, Egg, Profile, Redemption } from "./types";

export function uid(n: number): string {
  return `00000000-0000-4000-8000-${n.toString(16).padStart(12, "0")}`;
}

/** Hayes Valley block the demo seed is built around. */
export const CAFE_LOCATION: LatLng = { lat: 37.7764, lng: -122.4241 };

/** Fifteen meters west of the cafe, so the player dot and the store pin don't sit on top of each other. */
export const DEMO_PLAYER: LatLng = destination(CAFE_LOCATION.lat, CAFE_LOCATION.lng, 15, 270);

export const HUNTABLE_DISTANCE_M = 42;
export const TOO_FAR_DISTANCE_M = 60;

export const HUNTABLE_EGG_POS: LatLng = destination(DEMO_PLAYER.lat, DEMO_PLAYER.lng, HUNTABLE_DISTANCE_M, 15);
export const TOO_FAR_EGG_POS: LatLng = destination(DEMO_PLAYER.lat, DEMO_PLAYER.lng, TOO_FAR_DISTANCE_M, 140);

export const IDS = {
  player: uid(1),
  cafeOwner: uid(2),
  leafOwner: uid(3),
  crumbOwner: uid(4),
  cafe: uid(10),
  leaf: uid(11),
  crumb: uid(12),
  spring: uid(20),
  leafCampaign: uid(21),
  crumbCampaign: uid(22),
  huntableEgg: uid(100),
  tooFarEgg: uid(101),
  egg180: uid(102),
  egg240: uid(103),
  egg390: uid(104),
  coffeeEgg: uid(201),
  giftEgg: uid(202),
  cookieEgg: uid(203),
  coffeeClaim: uid(301),
  giftClaim: uid(302),
  cookieClaim: uid(303),
} as const;

export const COFFEE_CODE = "EGG-4F7K-22";
export const COFFEE_TOKEN = "c0ffee4f7k22beanthere000000000001";
export const GIFT_CODE = "EGG-B2LQ-19";
export const COOKIE_CODE = "EGG-9MCD-07";

const DEMO_PLAYER_EMAIL = "player@eggdrop.demo";
const DEMO_BUSINESS_EMAIL = "cafe@eggdrop.demo";

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function addDays(base: Date, days: number, hourUtc = 18): string {
  const d = new Date(base.getTime() + days * 86_400_000);
  d.setUTCHours(hourUtc, 0, 0, 0);
  return d.toISOString();
}

/** Most recent Saturday at 18:00 UTC that is fully in the past. */
export function lastSaturday(now: Date): Date {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 18, 0, 0));
  const back = (d.getUTCDay() + 1) % 7;
  d.setUTCDate(d.getUTCDate() - (back === 0 ? 7 : back));
  return d;
}

function pointInRing(origin: LatLng, minM: number, maxM: number, random: () => number): LatLng {
  const dist = Math.sqrt(random() * (maxM * maxM - minM * minM) + minM * minM);
  return destination(origin.lat, origin.lng, dist, random() * 360);
}

interface Reward {
  rewardType: "discount" | "gift_card";
  rewardLabel: string;
  rewardDetail: string;
  rewardTitle: string;
}

const COFFEE: Reward = {
  rewardType: "discount",
  rewardLabel: "20% OFF",
  rewardDetail: "Any coffee drink",
  rewardTitle: "20% off coffee",
};

const GIFT: Reward = {
  rewardType: "gift_card",
  rewardLabel: "$5",
  rewardDetail: "In-store credit",
  rewardTitle: "$5 gift card",
};

const COOKIE: Reward = {
  rewardType: "discount",
  rewardLabel: "FREE",
  rewardDetail: "House cookie",
  rewardTitle: "Free cookie",
};

/**
 * Demo world used by the local database and by `scripts/seed.ts`.
 * Counts match the prototype dashboard: 120 eggs still hidden, 86 found,
 * 41 redeemed, $10.30 spent (206 eggs × $0.05) at Bean There Cafe.
 */
export function buildSeed(now = new Date()): Database {
  const iso = now.toISOString();
  const rand = mulberry32(0xc0ffee);
  const saturday = lastSaturday(now);

  const profiles: Profile[] = [
    { id: IDS.player, role: "player", displayName: "Alex Rivera", email: DEMO_PLAYER_EMAIL, createdAt: iso },
    { id: IDS.cafeOwner, role: "business", displayName: "Maya Chen", email: DEMO_BUSINESS_EMAIL, createdAt: iso },
    { id: IDS.leafOwner, role: "business", displayName: "Sam Okonkwo", email: "leaf@eggdrop.demo", createdAt: iso },
    { id: IDS.crumbOwner, role: "business", displayName: "Priya Shah", email: "crumb@eggdrop.demo", createdAt: iso },
  ];

  for (let i = 0; i < 80; i++) {
    profiles.push({
      id: uid(1000 + i),
      role: "player",
      displayName: `Player ${i + 1}`,
      email: `player${i + 1}@eggdrop.demo`,
      createdAt: iso,
    });
  }

  const businesses: Business[] = [
    {
      id: IDS.cafe,
      ownerId: IDS.cafeOwner,
      name: "Bean There Cafe",
      address: "418 Hayes Street, San Francisco",
      lat: CAFE_LOCATION.lat,
      lng: CAFE_LOCATION.lng,
      createdAt: iso,
    },
    {
      id: IDS.leaf,
      ownerId: IDS.leafOwner,
      name: "Leaf & Loaf Bakery",
      address: "1900 Market Street, San Francisco",
      ...destination(CAFE_LOCATION.lat, CAFE_LOCATION.lng, 1500, 100),
      createdAt: iso,
    },
    {
      id: IDS.crumb,
      ownerId: IDS.crumbOwner,
      name: "Sweet Crumb Shop",
      address: "321 Divisadero Street, San Francisco",
      ...destination(CAFE_LOCATION.lat, CAFE_LOCATION.lng, 1800, 250),
      createdAt: iso,
    },
  ];

  const springEggs = 206;
  const campaigns: Campaign[] = [
    {
      id: IDS.spring,
      businessId: IDS.cafe,
      name: "Spring Hunt",
      ...COFFEE,
      radiusM: 400,
      eggCount: springEggs,
      amountCents: springEggs * EGG_PRICE_CENTS,
      status: "active",
      stripeSessionId: "cs_test_seed_spring",
      createdAt: addDays(now, -7, 15),
      paidAt: addDays(now, -7, 15),
    },
    {
      id: IDS.leafCampaign,
      businessId: IDS.leaf,
      name: "Saturday gift cards",
      ...GIFT,
      radiusM: 400,
      eggCount: 1,
      amountCents: EGG_PRICE_CENTS,
      status: "active",
      stripeSessionId: "cs_test_seed_leaf",
      createdAt: addDays(now, -12, 15),
      paidAt: addDays(now, -12, 15),
    },
    {
      id: IDS.crumbCampaign,
      businessId: IDS.crumb,
      name: "Cookie week",
      ...COOKIE,
      radiusM: 400,
      eggCount: 1,
      amountCents: EGG_PRICE_CENTS,
      status: "active",
      stripeSessionId: "cs_test_seed_crumb",
      createdAt: addDays(now, -3, 15),
      paidAt: addDays(now, -3, 15),
    },
  ];

  const eggs: Egg[] = [];
  const claims: Claim[] = [];
  const redemptions: Redemption[] = [];

  const cafe = businesses[0];
  const leaf = businesses[1];
  const crumb = businesses[2];

  function egg(
    id: string,
    business: Business,
    campaign: Campaign,
    pos: LatLng,
    status: Egg["status"],
    reward: Reward,
    expiresAt: string,
  ): Egg {
    return {
      id,
      campaignId: campaign.id,
      businessId: business.id,
      businessName: business.name,
      lat: pos.lat,
      lng: pos.lng,
      status,
      expiresAt,
      createdAt: campaign.createdAt,
      ...reward,
    };
  }

  const activeExpiry = addDays(now, 14, 23);
  const featured: Array<[string, LatLng, number, number]> = [
    [IDS.huntableEgg, HUNTABLE_EGG_POS, HUNTABLE_DISTANCE_M, 15],
    [IDS.tooFarEgg, TOO_FAR_EGG_POS, TOO_FAR_DISTANCE_M, 140],
    [IDS.egg180, destination(DEMO_PLAYER.lat, DEMO_PLAYER.lng, 180, 210), 180, 210],
    [IDS.egg240, destination(DEMO_PLAYER.lat, DEMO_PLAYER.lng, 240, 300), 240, 300],
    [IDS.egg390, destination(DEMO_PLAYER.lat, DEMO_PLAYER.lng, 390, 80), 390, 80],
  ];

  for (const [id, pos] of featured) {
    eggs.push(egg(id, cafe, campaigns[0], pos, "active", COFFEE, activeExpiry));
  }

  for (let i = 0; i < 115; i++) {
    eggs.push(
      egg(uid(500 + i), cafe, campaigns[0], pointInRing(DEMO_PLAYER, 80, 400, rand), "active", COFFEE, activeExpiry),
    );
  }

  function claim(partial: {
    id: string;
    egg: Egg;
    playerId: string;
    code: string;
    token: string;
    status: Claim["status"];
    claimedAt: string;
    redeemedAt: string | null;
  }): Claim {
    const row: Claim = {
      id: partial.id,
      eggId: partial.egg.id,
      campaignId: partial.egg.campaignId,
      playerId: partial.playerId,
      businessId: partial.egg.businessId,
      businessName: partial.egg.businessName,
      code: partial.code,
      token: partial.token,
      status: partial.status,
      rewardType: partial.egg.rewardType,
      rewardLabel: partial.egg.rewardLabel,
      rewardDetail: partial.egg.rewardDetail,
      rewardTitle: partial.egg.rewardTitle,
      claimedAt: partial.claimedAt,
      redeemedAt: partial.redeemedAt,
      expiresAt: partial.egg.expiresAt,
    };
    claims.push(row);
    return row;
  }

  const coffeeEgg = egg(IDS.coffeeEgg, cafe, campaigns[0], pointInRing(CAFE_LOCATION, 40, 300, rand), "claimed", COFFEE, addDays(now, 7));
  eggs.push(coffeeEgg);
  claim({
    id: IDS.coffeeClaim,
    egg: coffeeEgg,
    playerId: IDS.player,
    code: COFFEE_CODE,
    token: COFFEE_TOKEN,
    status: "active",
    claimedAt: addDays(now, -1, 16),
    redeemedAt: null,
  });

  for (let i = 0; i < 44; i++) {
    const row = egg(uid(800 + i), cafe, campaigns[0], pointInRing(CAFE_LOCATION, 30, 380, rand), "claimed", COFFEE, addDays(now, 10));
    eggs.push(row);
    claim({
      id: uid(2000 + i),
      egg: row,
      playerId: uid(1000 + i),
      code: codeFromInt(2000 + i),
      token: tokenFromInt(2000 + i),
      status: "active",
      claimedAt: addDays(now, -((i % 6) + 1), 14),
      redeemedAt: null,
    });
  }

  const dayPlan: Array<{ offset: number; count: number; first: boolean }> = [
    { offset: -2, count: 5, first: true },
    { offset: -1, count: 6, first: true },
    { offset: 0, count: 18, first: true },
    { offset: 1, count: 5, first: false },
    { offset: 2, count: 4, first: false },
    { offset: 3, count: 3, first: false },
  ];

  let redeemerCursor = 0;
  let repeatCursor = 0;
  let redemptionSeq = 0;
  for (const day of dayPlan) {
    for (let i = 0; i < day.count; i++) {
      const playerIndex = day.first ? redeemerCursor++ : repeatCursor++;
      const playerId = uid(1044 + playerIndex);
      const when = new Date(saturday.getTime() + day.offset * 86_400_000 + i * 60_000);
      if (when.getTime() > now.getTime() - 60_000) when.setTime(now.getTime() - 3_600_000);
      const row = egg(
        uid(900 + redemptionSeq),
        cafe,
        campaigns[0],
        pointInRing(CAFE_LOCATION, 25, 360, rand),
        "claimed",
        COFFEE,
        addDays(now, 4),
      );
      eggs.push(row);
      const c = claim({
        id: uid(3000 + redemptionSeq),
        egg: row,
        playerId,
        code: codeFromInt(3000 + redemptionSeq),
        token: tokenFromInt(3000 + redemptionSeq),
        status: "redeemed",
        claimedAt: new Date(when.getTime() - 3_600_000).toISOString(),
        redeemedAt: when.toISOString(),
      });
      redemptions.push({
        id: uid(4000 + redemptionSeq),
        claimId: c.id,
        businessId: cafe.id,
        campaignId: campaigns[0].id,
        playerId,
        redeemedBy: IDS.cafeOwner,
        redeemedAt: when.toISOString(),
      });
      redemptionSeq++;
    }
  }

  const giftEgg = egg(IDS.giftEgg, leaf, campaigns[1], destination(leaf.lat, leaf.lng, 40, 20), "claimed", GIFT, addDays(now, 12));
  const cookieEgg = egg(IDS.cookieEgg, crumb, campaigns[2], destination(crumb.lat, crumb.lng, 30, 40), "claimed", COOKIE, addDays(now, 3));
  eggs.push(giftEgg, cookieEgg);
  claim({
    id: IDS.giftClaim,
    egg: giftEgg,
    playerId: IDS.player,
    code: GIFT_CODE,
    token: tokenFromInt(302),
    status: "active",
    claimedAt: addDays(now, -2, 17),
    redeemedAt: null,
  });
  claim({
    id: IDS.cookieClaim,
    egg: cookieEgg,
    playerId: IDS.player,
    code: COOKIE_CODE,
    token: tokenFromInt(303),
    status: "active",
    claimedAt: addDays(now, -1, 18),
    redeemedAt: null,
  });

  // Players referenced by redemptions (1044+) need profiles. 29 unique redeemers.
  for (let i = 0; i < 29; i++) {
    const id = uid(1044 + i);
    if (!profiles.some((p) => p.id === id)) {
      profiles.push({
        id,
        role: "player",
        displayName: `Guest ${i + 1}`,
        email: `guest${i + 1}@eggdrop.demo`,
        createdAt: iso,
      });
    }
  }

  return {
    version: 1,
    seededAt: iso,
    profiles,
    businesses,
    campaigns,
    eggs,
    claims,
    redemptions,
  };
}

export const DEMO_PLAYER_EMAIL_ADDRESS = DEMO_PLAYER_EMAIL;
export const DEMO_BUSINESS_EMAIL_ADDRESS = DEMO_BUSINESS_EMAIL;
