import fs from "fs";
import path from "path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { localStore } from "../src/lib/db/local";
import { lastSaturday, buildSeed, IDS } from "../src/lib/seed";
import type { Business, Campaign, Claim, Database, Egg, Profile, Redemption } from "../src/lib/types";

loadEnv();

const now = new Date();
const db = buildSeed(now);
const saturday = lastSaturday(now);

function loadEnv() {
  for (const file of [".env.local", ".env"]) {
    if (!fs.existsSync(file)) continue;
    for (const line of fs.readFileSync(file, "utf8").split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      if (process.env[key]) continue;
      process.env[key] = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
    }
  }
}

function sqlString(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

function sqlTime(iso: string): string {
  const ms = Math.round(new Date(iso).getTime() - now.getTime());
  if (ms === 0) return "now()";
  const sign = ms > 0 ? "+" : "-";
  return `(now() ${sign} interval '${Math.abs(ms)} milliseconds')`;
}

function sqlSaturday(iso: string): string {
  const ms = Math.round(new Date(iso).getTime() - saturday.getTime());
  const sign = ms >= 0 ? "+" : "-";
  return `(public.egg_last_saturday(now()) ${sign} interval '${Math.abs(ms)} milliseconds')`;
}

function values(rows: string[]): string {
  return rows.map((row) => `  (${row})`).join(",\n");
}

function profilesSql(rows: Profile[]): string {
  return `insert into public.profiles (id, role, display_name, email, created_at) values\n${values(
    rows.map(
      (row) =>
        `${sqlString(row.id)}, ${sqlString(row.role)}, ${sqlString(row.displayName)}, ${sqlString(row.email)}, ${sqlTime(row.createdAt)}`,
    ),
  )};`;
}

function businessesSql(rows: Business[]): string {
  return `insert into public.businesses (id, owner_id, name, address, lat, lng, created_at) values\n${values(
    rows.map(
      (row) =>
        `${sqlString(row.id)}, ${sqlString(row.ownerId)}, ${sqlString(row.name)}, ${sqlString(row.address)}, ${row.lat}, ${row.lng}, ${sqlTime(row.createdAt)}`,
    ),
  )};`;
}

function campaignsSql(rows: Campaign[]): string {
  return `insert into public.campaigns (id, business_id, name, reward_type, reward_label, reward_detail, reward_title, radius_m, egg_count, amount_cents, status, stripe_session_id, created_at, paid_at) values\n${values(
    rows.map(
      (row) =>
        [
          sqlString(row.id),
          sqlString(row.businessId),
          sqlString(row.name),
          sqlString(row.rewardType),
          sqlString(row.rewardLabel),
          sqlString(row.rewardDetail),
          sqlString(row.rewardTitle),
          row.radiusM,
          row.eggCount,
          row.amountCents,
          sqlString(row.status),
          row.stripeSessionId ? sqlString(row.stripeSessionId) : "null",
          sqlTime(row.createdAt),
          row.paidAt ? sqlTime(row.paidAt) : "null",
        ].join(", "),
    ),
  )};`;
}

function eggsSql(rows: Egg[]): string {
  return `insert into public.eggs (id, campaign_id, business_id, business_name, lat, lng, reward_type, reward_label, reward_detail, reward_title, status, expires_at, created_at) values\n${values(
    rows.map(
      (row) =>
        [
          sqlString(row.id),
          sqlString(row.campaignId),
          sqlString(row.businessId),
          sqlString(row.businessName),
          row.lat,
          row.lng,
          sqlString(row.rewardType),
          sqlString(row.rewardLabel),
          sqlString(row.rewardDetail),
          sqlString(row.rewardTitle),
          sqlString(row.status),
          sqlTime(row.expiresAt),
          sqlTime(row.createdAt),
        ].join(", "),
    ),
  )};`;
}

function claimsSql(rows: Claim[]): string {
  return `insert into public.claims (id, egg_id, campaign_id, player_id, business_id, business_name, code, token, status, reward_type, reward_label, reward_detail, reward_title, claimed_at, redeemed_at, expires_at) values\n${values(
    rows.map(
      (row) =>
        [
          sqlString(row.id),
          sqlString(row.eggId),
          sqlString(row.campaignId),
          sqlString(row.playerId),
          sqlString(row.businessId),
          sqlString(row.businessName),
          sqlString(row.code),
          sqlString(row.token),
          sqlString(row.status),
          sqlString(row.rewardType),
          sqlString(row.rewardLabel),
          sqlString(row.rewardDetail),
          sqlString(row.rewardTitle),
          sqlTime(row.claimedAt),
          row.redeemedAt ? sqlSaturday(row.redeemedAt) : "null",
          sqlTime(row.expiresAt),
        ].join(", "),
    ),
  )};`;
}

function redemptionsSql(rows: Redemption[]): string {
  return `insert into public.redemptions (id, claim_id, business_id, campaign_id, player_id, redeemed_by, redeemed_at) values\n${values(
    rows.map(
      (row) =>
        [
          sqlString(row.id),
          sqlString(row.claimId),
          sqlString(row.businessId),
          sqlString(row.campaignId),
          sqlString(row.playerId),
          sqlString(row.redeemedBy),
          sqlSaturday(row.redeemedAt),
        ].join(", "),
    ),
  )};`;
}

function toSeedSql(data: Database): string {
  return `-- Generated by npm run seed. Safe to re-run: it clears EggDrop tables, then loads the demo.
-- Expiry dates stay relative to the moment you run this file.
-- Redemptions are anchored to the most recent Saturday so "best day" stays Saturday.
-- Auth users are not created here. Run \`npm run seed\` with the service role key, or create
-- player@eggdrop.demo and cafe@eggdrop.demo (password eggdrop-demo) with the ids below.

begin;

create or replace function public.egg_last_saturday(ts timestamptz)
returns timestamptz
language plpgsql
stable
as $$
declare
  day timestamptz;
  dow int;
  back int;
begin
  day := (date_trunc('day', ts at time zone 'utc') + time '18:00') at time zone 'utc';
  dow := extract(dow from day at time zone 'utc')::int;
  back := (dow + 1) % 7;
  if back = 0 then
    back := 7;
  end if;
  return day - back * interval '1 day';
end;
$$;

truncate table public.redemptions, public.claims, public.eggs, public.campaigns, public.businesses, public.profiles;

${profilesSql(data.profiles)}

${businessesSql(data.businesses)}

${campaignsSql(data.campaigns)}

${eggsSql(data.eggs)}

${claimsSql(data.claims)}

${redemptionsSql(data.redemptions)}

drop function public.egg_last_saturday(timestamptz);

commit;
`;
}

async function pushSupabase(data: Database) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.log("Supabase keys not set — skipped remote seed. SQL file and local database were still written.");
    return;
  }
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const accounts = [
    {
      id: IDS.player,
      email: process.env.DEMO_PLAYER_EMAIL || "player@eggdrop.demo",
      password: process.env.DEMO_PLAYER_PASSWORD || "eggdrop-demo",
      name: "Alex Rivera",
    },
    {
      id: IDS.cafeOwner,
      email: process.env.DEMO_BUSINESS_EMAIL || "cafe@eggdrop.demo",
      password: process.env.DEMO_BUSINESS_PASSWORD || "eggdrop-demo",
      name: "Maya Chen",
    },
  ];
  for (const account of accounts) {
    const { error } = await client.auth.admin.createUser({
      id: account.id,
      email: account.email,
      password: account.password,
      email_confirm: true,
      user_metadata: { display_name: account.name },
    });
    if (error && !/already|exists|registered/i.test(error.message)) {
      throw new Error(`Could not create ${account.email}: ${error.message}`);
    }
  }

  for (const table of ["redemptions", "claims", "eggs", "campaigns", "businesses", "profiles"] as const) {
    const { error } = await client.from(table).delete().neq("id", "00000000-0000-0000-0000-000000000000");
    if (error) throw new Error(`Could not clear ${table}: ${error.message}`);
  }

  await insertChunks(client, "profiles", data.profiles.map((row) => ({
    id: row.id,
    role: row.role,
    display_name: row.displayName,
    email: row.email,
    created_at: row.createdAt,
  })));
  await insertChunks(client, "businesses", data.businesses.map((row) => ({
    id: row.id,
    owner_id: row.ownerId,
    name: row.name,
    address: row.address,
    lat: row.lat,
    lng: row.lng,
    created_at: row.createdAt,
  })));
  await insertChunks(client, "campaigns", data.campaigns.map((row) => ({
    id: row.id,
    business_id: row.businessId,
    name: row.name,
    reward_type: row.rewardType,
    reward_label: row.rewardLabel,
    reward_detail: row.rewardDetail,
    reward_title: row.rewardTitle,
    radius_m: row.radiusM,
    egg_count: row.eggCount,
    amount_cents: row.amountCents,
    status: row.status,
    stripe_session_id: row.stripeSessionId,
    created_at: row.createdAt,
    paid_at: row.paidAt,
  })));
  await insertChunks(client, "eggs", data.eggs.map((row) => ({
    id: row.id,
    campaign_id: row.campaignId,
    business_id: row.businessId,
    business_name: row.businessName,
    lat: row.lat,
    lng: row.lng,
    reward_type: row.rewardType,
    reward_label: row.rewardLabel,
    reward_detail: row.rewardDetail,
    reward_title: row.rewardTitle,
    status: row.status,
    expires_at: row.expiresAt,
    created_at: row.createdAt,
  })));
  await insertChunks(client, "claims", data.claims.map((row) => ({
    id: row.id,
    egg_id: row.eggId,
    campaign_id: row.campaignId,
    player_id: row.playerId,
    business_id: row.businessId,
    business_name: row.businessName,
    code: row.code,
    token: row.token,
    status: row.status,
    reward_type: row.rewardType,
    reward_label: row.rewardLabel,
    reward_detail: row.rewardDetail,
    reward_title: row.rewardTitle,
    claimed_at: row.claimedAt,
    redeemed_at: row.redeemedAt,
    expires_at: row.expiresAt,
  })));
  await insertChunks(client, "redemptions", data.redemptions.map((row) => ({
    id: row.id,
    claim_id: row.claimId,
    business_id: row.businessId,
    campaign_id: row.campaignId,
    player_id: row.playerId,
    redeemed_by: row.redeemedBy,
    redeemed_at: row.redeemedAt,
  })));
  console.log("Supabase demo data loaded.");
}

async function insertChunks(client: SupabaseClient, table: string, rows: Record<string, unknown>[]) {
  for (let i = 0; i < rows.length; i += 200) {
    const { error } = await client.from(table).insert(rows.slice(i, i + 200));
    if (error) throw new Error(`Insert into ${table} failed: ${error.message}`);
  }
}

async function main() {
  const sqlPath = path.join(process.cwd(), "supabase", "seed.sql");
  fs.mkdirSync(path.dirname(sqlPath), { recursive: true });
  fs.writeFileSync(sqlPath, toSeedSql(db));
  await localStore.reset();
  await pushSupabase(db);
  console.log(`Wrote ${sqlPath} and reset the local database.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
