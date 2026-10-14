import fs from "fs";
import path from "path";
import { makeCode, makeToken, normalizeCode } from "../codes";
import { StoreError } from "../errors";
import { CATCH_RADIUS_M, distanceM, pointInDisk } from "../geo";
import { assertEggCount, EGG_PRICE_CENTS } from "../pricing";
import { buildSeed, IDS } from "../seed";
import { campaignSummaries, dashboardFrom, resultsFrom } from "../stats";
import type {
  Business,
  Campaign,
  Claim,
  CreateCampaignInput,
  Database,
  EggStore,
  NearbyEgg,
  RedeemResult,
} from "../types";

function dataFile(): string {
  if (process.env.EGG_DATA_PATH) return process.env.EGG_DATA_PATH;
  if (process.env.VERCEL) return path.join("/tmp", "eggdrop-db.json");
  return path.join(process.cwd(), ".data", "db.json");
}

function sleepSync(ms: number) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    /* spin — the lock is held for a single JSON read/write */
  }
}

function withLock<T>(fn: () => T): T {
  const file = dataFile();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const lock = `${file}.lock`;
  const start = Date.now();
  while (true) {
    try {
      const fd = fs.openSync(lock, "wx");
      try {
        return fn();
      } finally {
        fs.closeSync(fd);
        try {
          fs.unlinkSync(lock);
        } catch {
          /* another reset may have removed it */
        }
      }
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code !== "EEXIST") throw err;
      try {
        const stat = fs.statSync(lock);
        if (Date.now() - stat.mtimeMs > 5_000) fs.unlinkSync(lock);
      } catch {
        /* lock disappeared */
      }
      if (Date.now() - start > 8_000) throw new Error("Timed out waiting for the egg database lock.");
      sleepSync(20);
    }
  }
}

function load(): Database {
  const file = dataFile();
  if (!fs.existsSync(file)) {
    const seed = buildSeed();
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(seed));
    return seed;
  }
  const parsed = JSON.parse(fs.readFileSync(file, "utf8")) as Database;
  if (parsed.version !== 1) {
    const seed = buildSeed();
    fs.writeFileSync(file, JSON.stringify(seed));
    return seed;
  }
  return parsed;
}

function save(db: Database) {
  const file = dataFile();
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(db));
  fs.renameSync(tmp, file);
}

function read<T>(fn: (db: Database) => T): T {
  return withLock(() => fn(load()));
}

function write<T>(fn: (db: Database) => T): T {
  return withLock(() => {
    const db = load();
    const result = fn(db);
    save(db);
    return result;
  });
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function requireBusiness(db: Database, businessId: string): Business {
  const business = db.businesses.find((b) => b.id === businessId);
  if (!business) throw new StoreError("not_found", 404, "Business not found.");
  return business;
}

export const localStore: EggStore = {
  async reset() {
    withLock(() => {
      save(buildSeed());
    });
  },

  async getProfile(id) {
    return read((db) => clone(db.profiles.find((p) => p.id === id) ?? null));
  },

  async getProfileByEmail(email) {
    const needle = email.trim().toLowerCase();
    return read((db) => clone(db.profiles.find((p) => p.email.toLowerCase() === needle) ?? null));
  },

  async getBusiness(id) {
    return read((db) => clone(db.businesses.find((b) => b.id === id) ?? null));
  },

  async getBusinessForOwner(ownerId) {
    return read((db) => clone(db.businesses.find((b) => b.ownerId === ownerId) ?? null));
  },

  async listBusinessesNear(lat, lng, radiusM) {
    return read((db) =>
      clone(
        db.businesses
          .map((b) => ({ b, d: distanceM(lat, lng, b.lat, b.lng) }))
          .filter((row) => row.d <= radiusM)
          .sort((a, b) => a.d - b.d)
          .map((row) => row.b),
      ),
    );
  },

  async listNearbyEggs(lat, lng, radiusM) {
    return read((db) => {
      const now = Date.now();
      const eggs: NearbyEgg[] = [];
      for (const egg of db.eggs) {
        if (egg.status !== "active") continue;
        if (new Date(egg.expiresAt).getTime() < now) continue;
        const d = distanceM(lat, lng, egg.lat, egg.lng);
        if (d > radiusM) continue;
        eggs.push({
          id: egg.id,
          lat: egg.lat,
          lng: egg.lng,
          businessId: egg.businessId,
          businessName: egg.businessName,
          distanceM: d,
          expiresAt: egg.expiresAt,
        });
      }
      eggs.sort((a, b) => a.distanceM - b.distanceM);
      return eggs;
    });
  },

  async claimEgg({ eggId, playerId, lat, lng }) {
    return write((db) => {
      const player = db.profiles.find((p) => p.id === playerId);
      if (!player) throw new StoreError("not_found", 404, "Player not found.");
      const egg = db.eggs.find((e) => e.id === eggId);
      if (!egg) throw new StoreError("not_found", 404, "Egg not found.");
      if (egg.status !== "active") throw new StoreError("unavailable", 409, "That egg is already gone.");
      if (new Date(egg.expiresAt).getTime() < Date.now()) {
        throw new StoreError("expired", 410, "This egg has expired.");
      }
      const dist = distanceM(lat, lng, egg.lat, egg.lng);
      if (dist > CATCH_RADIUS_M) {
        throw new StoreError(
          "too_far",
          400,
          `Too far. You are ${Math.round(dist)} m away and need to be within ${CATCH_RADIUS_M} m.`,
          { distanceM: Math.round(dist) },
        );
      }
      egg.status = "claimed";
      let code = makeCode();
      for (let i = 0; i < 5 && db.claims.some((c) => c.code === code); i++) code = makeCode();
      const claim: Claim = {
        id: crypto.randomUUID(),
        eggId: egg.id,
        campaignId: egg.campaignId,
        playerId,
        businessId: egg.businessId,
        businessName: egg.businessName,
        code,
        token: makeToken(),
        status: "active",
        rewardType: egg.rewardType,
        rewardLabel: egg.rewardLabel,
        rewardDetail: egg.rewardDetail,
        rewardTitle: egg.rewardTitle,
        claimedAt: new Date().toISOString(),
        redeemedAt: null,
        expiresAt: egg.expiresAt,
      };
      db.claims.push(claim);
      return clone(claim);
    });
  },

  async listClaimsForPlayer(playerId) {
    return read((db) =>
      clone(
        db.claims
          .filter((c) => c.playerId === playerId)
          .sort((a, b) => b.claimedAt.localeCompare(a.claimedAt)),
      ),
    );
  },

  async getClaim(id) {
    return read((db) => clone(db.claims.find((c) => c.id === id) ?? null));
  },

  async redeem({ tokenOrCode, businessId, redeemedBy }) {
    return write((db) => {
      requireBusiness(db, businessId);
      const needle = normalizeCode(tokenOrCode);
      const raw = tokenOrCode.trim();
      const claim = db.claims.find((c) => c.token === raw || c.code === needle || c.token === needle.toLowerCase());
      if (!claim) throw new StoreError("not_found", 404, "No reward matches that code.");
      if (claim.businessId !== businessId) {
        throw new StoreError("wrong_business", 403, `This reward belongs to ${claim.businessName}.`);
      }
      if (claim.status === "redeemed") {
        throw new StoreError("already_redeemed", 409, "This code was already redeemed and can't be used twice.");
      }
      if (new Date(claim.expiresAt).getTime() < Date.now()) {
        throw new StoreError("expired", 410, "This reward has expired.");
      }
      const redeemedAt = new Date().toISOString();
      claim.status = "redeemed";
      claim.redeemedAt = redeemedAt;
      const redemption = {
        id: crypto.randomUUID(),
        claimId: claim.id,
        businessId,
        campaignId: claim.campaignId,
        playerId: claim.playerId,
        redeemedBy,
        redeemedAt,
      };
      db.redemptions.push(redemption);
      const result: RedeemResult = { claim: clone(claim), redemption };
      return result;
    });
  },

  async createCampaign(input: CreateCampaignInput) {
    try {
      assertEggCount(input.eggCount);
    } catch (err) {
      throw new StoreError("bad_count", 400, err instanceof Error ? err.message : "Bad egg count.");
    }
    return write((db) => {
      const business = requireBusiness(db, input.businessId);
      const radiusM = input.radiusM >= 50 && input.radiusM <= 1000 ? Math.round(input.radiusM) : 400;
      const now = new Date().toISOString();
      const campaign: Campaign = {
        id: crypto.randomUUID(),
        businessId: business.id,
        name: input.name,
        rewardType: input.rewardType,
        rewardLabel: input.rewardLabel,
        rewardDetail: input.rewardDetail,
        rewardTitle: input.rewardTitle,
        radiusM,
        eggCount: input.eggCount,
        amountCents: input.eggCount * EGG_PRICE_CENTS,
        status: "pending_payment",
        stripeSessionId: null,
        createdAt: now,
        paidAt: null,
      };
      db.campaigns.push(campaign);
      const expires = new Date(Date.now() + 14 * 86_400_000).toISOString();
      for (let i = 0; i < input.eggCount; i++) {
        const pos = pointInDisk(business.lat, business.lng, radiusM, 20, Math.random);
        db.eggs.push({
          id: crypto.randomUUID(),
          campaignId: campaign.id,
          businessId: business.id,
          businessName: business.name,
          lat: pos.lat,
          lng: pos.lng,
          rewardType: input.rewardType,
          rewardLabel: input.rewardLabel,
          rewardDetail: input.rewardDetail,
          rewardTitle: input.rewardTitle,
          status: "pending",
          expiresAt: expires,
          createdAt: now,
        });
      }
      return clone(campaign);
    });
  },

  async getCampaign(id) {
    return read((db) => clone(db.campaigns.find((c) => c.id === id) ?? null));
  },

  async listCampaigns(businessId) {
    return read((db) => campaignSummaries(db.campaigns.filter((c) => c.businessId === businessId)));
  },

  async attachCheckoutSession(campaignId, stripeSessionId) {
    write((db) => {
      const campaign = db.campaigns.find((c) => c.id === campaignId);
      if (!campaign) throw new StoreError("not_found", 404, "Campaign not found.");
      campaign.stripeSessionId = stripeSessionId;
    });
  },

  async activateCampaign(campaignId, stripeSessionId) {
    return write((db) => {
      const campaign = db.campaigns.find((c) => c.id === campaignId);
      if (!campaign) throw new StoreError("not_found", 404, "Campaign not found.");
      if (campaign.status !== "active") {
        campaign.status = "active";
        campaign.paidAt = new Date().toISOString();
      }
      if (stripeSessionId) campaign.stripeSessionId = stripeSessionId;
      for (const egg of db.eggs) {
        if (egg.campaignId === campaignId && egg.status === "pending") egg.status = "active";
      }
      return clone(campaign);
    });
  },

  async dashboard(businessId) {
    return read((db) => {
      const business = requireBusiness(db, businessId);
      return dashboardFrom(
        business,
        db.campaigns.filter((c) => c.businessId === businessId),
        db.eggs.filter((e) => e.businessId === businessId),
        db.redemptions.filter((r) => r.businessId === businessId),
      );
    });
  },

  async results(businessId, campaignId) {
    return read((db) => {
      requireBusiness(db, businessId);
      return resultsFrom(
        db.campaigns.filter((c) => c.businessId === businessId),
        db.eggs.filter((e) => e.businessId === businessId),
        db.claims.filter((c) => c.businessId === businessId),
        db.redemptions.filter((r) => r.businessId === businessId),
        campaignId,
      );
    });
  },
};

/** Used by tests and `npm run seed` to point at the demo cafe. */
export const LOCAL_DEMO = {
  playerId: IDS.player,
  cafeId: IDS.cafe,
  cafeOwnerId: IDS.cafeOwner,
};
