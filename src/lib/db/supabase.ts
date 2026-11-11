import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { coerceEggDesign, parseEggDesign, resolveEggDesign } from "../egg-design";
import { StoreError } from "../errors";
import { CATCH_RADIUS_M, distanceM, pointInDisk } from "../geo";
import { assertEggCount, assertEmptyCount, emptyEggIndexes, EGG_PRICE_CENTS } from "../pricing";
import { campaignSummaries, dashboardFrom, resultsFrom } from "../stats";
import type {
  Business,
  Campaign,
  Claim,
  CreateCampaignInput,
  Egg,
  EggStore,
  EmptyOpening,
  NearbyEgg,
  Profile,
  RedeemResult,
  Redemption,
  RewardType,
} from "../types";

type Row = Record<string, unknown>;

function admin(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new StoreError("config", 500, "Supabase URL and service role key are required.");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function unwrap<T>(query: PromiseLike<{ data: T | null; error: { message: string } | null }>): Promise<T> {
  const { data, error } = await query;
  if (error) throw new StoreError("db", 500, error.message);
  if (data == null) throw new StoreError("db", 500, "Empty database response.");
  return data;
}

function mapRpc(error: { message: string }): StoreError {
  const msg = error.message;
  const code = msg.includes("too_far")
    ? "too_far"
    : msg.includes("already_redeemed")
      ? "already_redeemed"
      : msg.includes("wrong_business")
        ? "wrong_business"
        : msg.includes("unavailable")
          ? "unavailable"
          : msg.includes("expired")
            ? "expired"
            : msg.includes("not_found")
              ? "not_found"
              : "db";
  const status =
    code === "too_far"
      ? 400
      : code === "already_redeemed" || code === "unavailable"
        ? 409
        : code === "wrong_business"
          ? 403
          : code === "expired"
            ? 410
            : code === "not_found"
              ? 404
              : 500;
  if (code === "too_far") {
    const dist = msg.match(/too_far:(\d+)/)?.[1];
    return new StoreError(
      code,
      status,
      dist ? `Too far. You are ${dist} m away and need to be within ${CATCH_RADIUS_M} m.` : `Too far. Get within ${CATCH_RADIUS_M} m of the egg.`,
      dist ? { distanceM: Number(dist) } : undefined,
    );
  }
  if (code === "already_redeemed") {
    return new StoreError(code, status, "This code was already redeemed and can't be used twice.");
  }
  if (code === "wrong_business") {
    const name = msg.split("wrong_business:")[1]?.split("\n")[0]?.trim();
    return new StoreError(code, status, name ? `This reward belongs to ${name}.` : "This reward belongs to another business.");
  }
  if (code === "unavailable") return new StoreError(code, status, "That egg is already gone.");
  if (code === "expired") return new StoreError(code, status, "This reward has expired.");
  if (code === "not_found") return new StoreError(code, status, "Nothing matches that.");
  return new StoreError(code, status, msg);
}

function profile(row: Row): Profile {
  return {
    id: String(row.id),
    role: row.role === "business" ? "business" : "player",
    displayName: String(row.display_name),
    email: String(row.email),
    createdAt: String(row.created_at),
  };
}

function business(row: Row): Business {
  return {
    id: String(row.id),
    ownerId: String(row.owner_id),
    name: String(row.name),
    address: String(row.address ?? ""),
    lat: Number(row.lat),
    lng: Number(row.lng),
    eggDesign: coerceEggDesign(row.egg_design),
    createdAt: String(row.created_at),
  };
}

function campaign(row: Row): Campaign {
  return {
    id: String(row.id),
    businessId: String(row.business_id),
    name: String(row.name),
    rewardType: row.reward_type as RewardType,
    rewardLabel: String(row.reward_label),
    rewardDetail: String(row.reward_detail),
    rewardTitle: String(row.reward_title),
    radiusM: Number(row.radius_m),
    eggCount: Number(row.egg_count),
    emptyCount: Number.isFinite(Number(row.empty_count)) ? Number(row.empty_count) : 0,
    amountCents: Number(row.amount_cents),
    status: row.status as Campaign["status"],
    stripeSessionId: row.stripe_session_id ? String(row.stripe_session_id) : null,
    createdAt: String(row.created_at),
    paidAt: row.paid_at ? String(row.paid_at) : null,
    eggDesign: coerceEggDesign(row.egg_design),
  };
}

function egg(row: Row): Egg {
  return {
    id: String(row.id),
    campaignId: String(row.campaign_id),
    businessId: String(row.business_id),
    businessName: String(row.business_name),
    lat: Number(row.lat),
    lng: Number(row.lng),
    rewardType: row.reward_type as RewardType,
    rewardLabel: String(row.reward_label),
    rewardDetail: String(row.reward_detail),
    rewardTitle: String(row.reward_title),
    status: row.status as Egg["status"],
    empty: Boolean(row.is_empty),
    openedBy: row.opened_by ? String(row.opened_by) : null,
    expiresAt: String(row.expires_at),
    createdAt: String(row.created_at),
  };
}

function catchPayload(data: unknown): { outcome: "empty"; eggId: string } | { outcome: "prize"; claimId: string } {
  if (typeof data === "string" && data) return { outcome: "prize", claimId: data };
  if (data && typeof data === "object") {
    const row = data as { outcome?: string; egg_id?: string; claim_id?: string };
    if (row.outcome === "empty" && row.egg_id) return { outcome: "empty", eggId: String(row.egg_id) };
    if (row.claim_id) return { outcome: "prize", claimId: String(row.claim_id) };
  }
  throw new StoreError("db", 500, "Claim finished but the result could not be read.");
}

function claim(row: Row): Claim {
  return {
    id: String(row.id),
    eggId: String(row.egg_id),
    campaignId: String(row.campaign_id),
    playerId: String(row.player_id),
    businessId: String(row.business_id),
    businessName: String(row.business_name),
    code: String(row.code),
    token: String(row.token),
    status: row.status as Claim["status"],
    rewardType: row.reward_type as RewardType,
    rewardLabel: String(row.reward_label),
    rewardDetail: String(row.reward_detail),
    rewardTitle: String(row.reward_title),
    claimedAt: String(row.claimed_at),
    redeemedAt: row.redeemed_at ? String(row.redeemed_at) : null,
    expiresAt: String(row.expires_at),
  };
}

function redemption(row: Row): Redemption {
  return {
    id: String(row.id),
    claimId: String(row.claim_id),
    businessId: String(row.business_id),
    campaignId: String(row.campaign_id),
    playerId: String(row.player_id),
    redeemedBy: String(row.redeemed_by),
    redeemedAt: String(row.redeemed_at),
  };
}

async function businessBundle(businessId: string) {
  const client = admin();
  const [businessRows, campaignRows, eggRows, claimRows, redemptionRows] = await Promise.all([
    unwrap<Row[]>(client.from("businesses").select("*").eq("id", businessId).limit(1)),
    unwrap<Row[]>(client.from("campaigns").select("*").eq("business_id", businessId).limit(500)),
    unwrap<Row[]>(client.from("eggs").select("*").eq("business_id", businessId).limit(20000)),
    unwrap<Row[]>(client.from("claims").select("*").eq("business_id", businessId).limit(20000)),
    unwrap<Row[]>(client.from("redemptions").select("*").eq("business_id", businessId).limit(20000)),
  ]);
  const found = businessRows[0];
  if (!found) throw new StoreError("not_found", 404, "Business not found.");
  return {
    business: business(found),
    campaigns: campaignRows.map(campaign),
    eggs: eggRows.map(egg),
    claims: claimRows.map(claim),
    redemptions: redemptionRows.map(redemption),
  };
}

async function designMaps(businessIds: string[], campaignIds: string[]) {
  const businesses = [...new Set(businessIds)];
  const campaigns = [...new Set(campaignIds)];
  const [businessRows, campaignRows] = await Promise.all([
    businesses.length
      ? unwrap<Row[]>(admin().from("businesses").select("id,egg_design").in("id", businesses))
      : Promise.resolve([] as Row[]),
    campaigns.length
      ? unwrap<Row[]>(admin().from("campaigns").select("id,egg_design").in("id", campaigns))
      : Promise.resolve([] as Row[]),
  ]);
  return {
    businesses: new Map(businessRows.map((row) => [String(row.id), coerceEggDesign(row.egg_design)])),
    campaigns: new Map(campaignRows.map((row) => [String(row.id), coerceEggDesign(row.egg_design)])),
  };
}

async function attachDesigns(rows: Claim[]): Promise<Claim[]> {
  if (rows.length === 0) return rows;
  const maps = await designMaps(
    rows.map((row) => row.businessId),
    rows.map((row) => row.campaignId),
  );
  return rows.map((row) => ({
    ...row,
    design: resolveEggDesign(maps.businesses.get(row.businessId) ?? null, maps.campaigns.get(row.campaignId) ?? null),
  }));
}

export const supabaseStore: EggStore = {
  async reset() {
    throw new StoreError("unsupported", 400, "Reset Supabase data with npm run seed.");
  },

  async getProfile(id) {
    const rows = await unwrap<Row[]>(admin().from("profiles").select("*").eq("id", id).limit(1));
    return rows[0] ? profile(rows[0]) : null;
  },

  async getProfileByEmail(email) {
    const rows = await unwrap<Row[]>(admin().from("profiles").select("*").ilike("email", email.trim()).limit(1));
    return rows[0] ? profile(rows[0]) : null;
  },

  async getBusiness(id) {
    const rows = await unwrap<Row[]>(admin().from("businesses").select("*").eq("id", id).limit(1));
    return rows[0] ? business(rows[0]) : null;
  },

  async getBusinessForOwner(ownerId) {
    const rows = await unwrap<Row[]>(admin().from("businesses").select("*").eq("owner_id", ownerId).limit(1));
    return rows[0] ? business(rows[0]) : null;
  },

  async saveEggDesign(businessId, design) {
    const eggDesign = design == null ? null : parseEggDesign(design);
    const rows = await unwrap<Row[]>(
      admin().from("businesses").update({ egg_design: eggDesign }).eq("id", businessId).select("*"),
    );
    if (!rows[0]) throw new StoreError("not_found", 404, "Business not found.");
    return business(rows[0]).eggDesign;
  },

  async listBusinessesNear(lat, lng, radiusM) {
    const latPad = radiusM / 110540;
    const lngPad = radiusM / (111320 * Math.max(0.2, Math.cos((lat * Math.PI) / 180)));
    const rows = await unwrap<Row[]>(
      admin()
        .from("businesses")
        .select("*")
        .gte("lat", lat - latPad)
        .lte("lat", lat + latPad)
        .gte("lng", lng - lngPad)
        .lte("lng", lng + lngPad)
        .limit(100),
    );
    return rows
      .map(business)
      .map((b) => ({ b, d: distanceM(lat, lng, b.lat, b.lng) }))
      .filter((row) => row.d <= radiusM)
      .sort((a, b) => a.d - b.d)
      .map((row) => row.b);
  },

  async listNearbyEggs(lat, lng, radiusM) {
    const latPad = radiusM / 110540;
    const lngPad = radiusM / (111320 * Math.max(0.2, Math.cos((lat * Math.PI) / 180)));
    const rows = await unwrap<Row[]>(
      admin()
        .from("eggs")
        .select("id,lat,lng,business_id,business_name,campaign_id,expires_at,status")
        .eq("status", "active")
        .gte("lat", lat - latPad)
        .lte("lat", lat + latPad)
        .gte("lng", lng - lngPad)
        .lte("lng", lng + lngPad)
        .limit(5000),
    );
    const now = Date.now();
    const prelim: Array<NearbyEgg & { campaignId: string }> = [];
    for (const row of rows) {
      if (new Date(String(row.expires_at)).getTime() < now) continue;
      const d = distanceM(lat, lng, Number(row.lat), Number(row.lng));
      if (d > radiusM) continue;
      prelim.push({
        id: String(row.id),
        lat: Number(row.lat),
        lng: Number(row.lng),
        businessId: String(row.business_id),
        businessName: String(row.business_name),
        campaignId: String(row.campaign_id),
        distanceM: d,
        expiresAt: String(row.expires_at),
        design: null,
      });
    }
    const maps = await designMaps(
      prelim.map((egg) => egg.businessId),
      prelim.map((egg) => egg.campaignId),
    );
    const eggs: NearbyEgg[] = prelim.map((egg) => ({
      id: egg.id,
      lat: egg.lat,
      lng: egg.lng,
      businessId: egg.businessId,
      businessName: egg.businessName,
      distanceM: egg.distanceM,
      expiresAt: egg.expiresAt,
      design: resolveEggDesign(maps.businesses.get(egg.businessId) ?? null, maps.campaigns.get(egg.campaignId) ?? null),
    }));
    eggs.sort((a, b) => a.distanceM - b.distanceM);
    return eggs;
  },

  async claimEgg({ eggId, playerId, lat, lng }) {
    const { data, error } = await admin().rpc("claim_egg", {
      p_egg_id: eggId,
      p_player_id: playerId,
      p_lat: lat,
      p_lng: lng,
    });
    if (error) throw mapRpc(error);
    const payload = catchPayload(data);
    if (payload.outcome === "empty") {
      const opening = await this.getEmptyOpening(payload.eggId, playerId);
      if (!opening) throw new StoreError("db", 500, "Empty egg was opened but could not be read back.");
      return opening;
    }
    const found = await this.getClaim(payload.claimId);
    if (!found) throw new StoreError("db", 500, "Claim was created but could not be read back.");
    return { outcome: "prize", claim: found };
  },

  async getEmptyOpening(eggId, playerId) {
    const rows = await unwrap<Row[]>(admin().from("eggs").select("*").eq("id", eggId).limit(1));
    const row = rows[0] ? egg(rows[0]) : null;
    if (!row || !row.empty || row.status !== "claimed" || row.openedBy !== playerId) return null;
    const maps = await designMaps([row.businessId], [row.campaignId]);
    const opening: EmptyOpening = {
      outcome: "empty",
      eggId: row.id,
      businessId: row.businessId,
      businessName: row.businessName,
      playerId,
      design: resolveEggDesign(maps.businesses.get(row.businessId) ?? null, maps.campaigns.get(row.campaignId) ?? null),
    };
    return opening;
  },

  async listClaimsForPlayer(playerId) {
    const rows = await unwrap<Row[]>(
      admin().from("claims").select("*").eq("player_id", playerId).order("claimed_at", { ascending: false }).limit(200),
    );
    return attachDesigns(rows.map(claim));
  },

  async getClaim(id) {
    const rows = await unwrap<Row[]>(admin().from("claims").select("*").eq("id", id).limit(1));
    if (!rows[0]) return null;
    const [withDesign] = await attachDesigns([claim(rows[0])]);
    return withDesign;
  },

  async redeem({ tokenOrCode, businessId, redeemedBy }) {
    const { data, error } = await admin().rpc("redeem_claim", {
      p_token_or_code: tokenOrCode.trim(),
      p_business_id: businessId,
      p_redeemed_by: redeemedBy,
    });
    if (error) throw mapRpc(error);
    const redemptionId = String(data);
    const rows = await unwrap<Row[]>(admin().from("redemptions").select("*").eq("id", redemptionId).limit(1));
    const found = rows[0] ? redemption(rows[0]) : null;
    if (!found) throw new StoreError("db", 500, "Redemption was created but could not be read back.");
    const redeemedClaim = await this.getClaim(found.claimId);
    if (!redeemedClaim) throw new StoreError("db", 500, "Redeemed claim is missing.");
    const result: RedeemResult = { claim: redeemedClaim, redemption: found };
    return result;
  },

  async createCampaign(input: CreateCampaignInput) {
    const emptyCount = input.emptyCount ?? 0;
    try {
      assertEggCount(input.eggCount);
      assertEmptyCount(emptyCount, input.eggCount);
    } catch (err) {
      throw new StoreError("bad_count", 400, err instanceof Error ? err.message : "Bad egg count.");
    }
    const place = await this.getBusiness(input.businessId);
    if (!place) throw new StoreError("not_found", 404, "Business not found.");
    const radiusM = input.radiusM >= 50 && input.radiusM <= 1000 ? Math.round(input.radiusM) : 400;
    const eggDesign = input.eggDesign == null ? null : parseEggDesign(input.eggDesign);
    const inserted = await unwrap<Row[]>(
      admin()
        .from("campaigns")
        .insert({
          business_id: place.id,
          name: input.name,
          reward_type: input.rewardType,
          reward_label: input.rewardLabel,
          reward_detail: input.rewardDetail,
          reward_title: input.rewardTitle,
          radius_m: radiusM,
          egg_count: input.eggCount,
          empty_count: emptyCount,
          amount_cents: input.eggCount * EGG_PRICE_CENTS,
          status: "pending_payment",
          egg_design: eggDesign,
        })
        .select("*"),
    );
    const created = campaign(inserted[0]);
    const expires = new Date(Date.now() + 14 * 86_400_000).toISOString();
    const emptyAt = new Set(emptyEggIndexes(input.eggCount, emptyCount));
    const eggRows = Array.from({ length: input.eggCount }, (_, index) => {
      const pos = pointInDisk(place.lat, place.lng, radiusM, 20, Math.random);
      return {
        campaign_id: created.id,
        business_id: place.id,
        business_name: place.name,
        lat: pos.lat,
        lng: pos.lng,
        reward_type: input.rewardType,
        reward_label: input.rewardLabel,
        reward_detail: input.rewardDetail,
        reward_title: input.rewardTitle,
        status: "pending",
        is_empty: emptyAt.has(index),
        expires_at: expires,
      };
    });
    for (let i = 0; i < eggRows.length; i += 400) {
      const { error } = await admin().from("eggs").insert(eggRows.slice(i, i + 400));
      if (error) throw new StoreError("db", 500, error.message);
    }
    return created;
  },

  async getCampaign(id) {
    const rows = await unwrap<Row[]>(admin().from("campaigns").select("*").eq("id", id).limit(1));
    return rows[0] ? campaign(rows[0]) : null;
  },

  async listCampaigns(businessId) {
    const rows = await unwrap<Row[]>(admin().from("campaigns").select("*").eq("business_id", businessId).limit(500));
    return campaignSummaries(rows.map(campaign));
  },

  async attachCheckoutSession(campaignId, stripeSessionId) {
    const { error } = await admin().from("campaigns").update({ stripe_session_id: stripeSessionId }).eq("id", campaignId);
    if (error) throw new StoreError("db", 500, error.message);
  },

  async activateCampaign(campaignId, stripeSessionId) {
    const { error } = await admin().rpc("activate_campaign", {
      p_campaign_id: campaignId,
      p_session: stripeSessionId,
    });
    if (error) throw mapRpc(error);
    const found = await this.getCampaign(campaignId);
    if (!found) throw new StoreError("not_found", 404, "Campaign not found.");
    return found;
  },

  async dashboard(businessId) {
    const bundle = await businessBundle(businessId);
    return dashboardFrom(bundle.business, bundle.campaigns, bundle.eggs, bundle.redemptions);
  },

  async results(businessId, campaignId) {
    const bundle = await businessBundle(businessId);
    return resultsFrom(bundle.campaigns, bundle.eggs, bundle.claims, bundle.redemptions, campaignId);
  },
};
