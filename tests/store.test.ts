import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { CAFE_EGG, GARDEN_EGG, sameDesign } from "../src/lib/egg-design";
import { CATCH_RADIUS_M, distanceM } from "../src/lib/geo";
import { amountCents } from "../src/lib/pricing";
import {
  CAFE_LOCATION,
  COFFEE_CODE,
  COOKIE_CODE,
  GIFT_CODE,
  DEMO_PLAYER,
  EMPTY_NEAR_DISTANCE_M,
  EMPTY_NEAR_POS,
  HUNTABLE_DISTANCE_M,
  HUNTABLE_EGG_POS,
  IDS,
  SEEDED_EMPTY_COUNT,
  TOO_FAR_DISTANCE_M,
  TOO_FAR_EGG_POS,
} from "../src/lib/seed";

const file = `/tmp/eggdrop-test-${process.pid}.json`;
process.env.EGG_DATA_PATH = file;
for (const extra of ["", ".lock", ".tmp"]) {
  fs.rmSync(file + extra, { force: true });
}

test("distance helper matches the seeded egg offsets", () => {
  const near = distanceM(DEMO_PLAYER.lat, DEMO_PLAYER.lng, HUNTABLE_EGG_POS.lat, HUNTABLE_EGG_POS.lng);
  const far = distanceM(DEMO_PLAYER.lat, DEMO_PLAYER.lng, TOO_FAR_EGG_POS.lat, TOO_FAR_EGG_POS.lng);
  const emptyNear = distanceM(DEMO_PLAYER.lat, DEMO_PLAYER.lng, EMPTY_NEAR_POS.lat, EMPTY_NEAR_POS.lng);
  assert.ok(Math.abs(near - HUNTABLE_DISTANCE_M) < 0.5);
  assert.ok(Math.abs(far - TOO_FAR_DISTANCE_M) < 0.5);
  assert.ok(Math.abs(emptyNear - EMPTY_NEAR_DISTANCE_M) < 0.5);
  assert.equal(amountCents(200), 1000);
  assert.ok(near <= CATCH_RADIUS_M);
  assert.ok(emptyNear <= CATCH_RADIUS_M);
  assert.ok(emptyNear > near);
  assert.ok(far > CATCH_RADIUS_M);
});

test("seed, catch radius, one-time redeem, and paid activation", async () => {
  const { localStore } = await import("../src/lib/db/local");
  await localStore.reset();

  const dash = await localStore.dashboard(IDS.cafe);
  assert.equal(dash.businessName, "Bean There Cafe");
  assert.equal(dash.live, 120);
  assert.equal(dash.found, 86);
  assert.equal(dash.redeemed, 41);
  assert.equal(dash.spendCents, 1030);
  assert.equal(dash.costPerVisitCents, 25);
  assert.match(dash.headline, /Spring Hunt/);

  const results = await localStore.results(IDS.cafe, IDS.spring);
  assert.equal(results.selected.placed, 206);
  assert.equal(results.selected.found, 86);
  assert.equal(results.selected.redeemed, 41);
  assert.equal(results.selected.newCustomers, 29);
  assert.equal(results.selected.bestDay, "Saturday");
  assert.equal(results.selected.topReward, "20% off coffee");

  const seeded = JSON.parse(fs.readFileSync(file, "utf8")) as {
    eggs: { id: string; empty?: boolean }[];
    campaigns: { id: string; emptyCount?: number }[];
  };
  assert.equal(seeded.eggs.filter((egg) => egg.empty).length, SEEDED_EMPTY_COUNT);
  assert.equal(seeded.campaigns.find((campaign) => campaign.id === IDS.spring)?.emptyCount, SEEDED_EMPTY_COUNT);

  const nearby = await localStore.listNearbyEggs(DEMO_PLAYER.lat, DEMO_PLAYER.lng, 1000);
  const inRange = nearby.filter((egg) => egg.distanceM <= CATCH_RADIUS_M);
  assert.deepEqual(
    inRange.map((egg) => egg.id),
    [IDS.huntableEgg, IDS.emptyNear],
  );
  assert.ok(sameDesign(inRange[0].design, CAFE_EGG));

  const empty = await localStore.claimEgg({
    eggId: IDS.emptyNear,
    playerId: IDS.player,
    lat: DEMO_PLAYER.lat,
    lng: DEMO_PLAYER.lng,
  });
  assert.equal(empty.outcome, "empty");
  if (empty.outcome === "empty") {
    assert.equal(empty.eggId, IDS.emptyNear);
    assert.equal(empty.businessName, "Bean There Cafe");
    assert.ok(sameDesign(empty.design, CAFE_EGG));
  }
  const opened = await localStore.getEmptyOpening(IDS.emptyNear, IDS.player);
  assert.equal(opened?.eggId, IDS.emptyNear);
  assert.equal(await localStore.getEmptyOpening(IDS.emptyNear, IDS.cafeOwner), null);
  await assert.rejects(
    () =>
      localStore.claimEgg({
        eggId: IDS.emptyNear,
        playerId: IDS.player,
        lat: DEMO_PLAYER.lat,
        lng: DEMO_PLAYER.lng,
      }),
    (err: unknown) => (err as { code?: string }).code === "unavailable",
  );

  await assert.rejects(
    () =>
      localStore.claimEgg({
        eggId: IDS.tooFarEgg,
        playerId: IDS.player,
        lat: DEMO_PLAYER.lat,
        lng: DEMO_PLAYER.lng,
      }),
    (err: unknown) => (err as { code?: string }).code === "too_far",
  );

  const caught = await localStore.claimEgg({
    eggId: IDS.huntableEgg,
    playerId: IDS.player,
    lat: DEMO_PLAYER.lat,
    lng: DEMO_PLAYER.lng,
  });
  assert.equal(caught.outcome, "prize");
  if (caught.outcome !== "prize") return;
  const claim = caught.claim;
  assert.equal(claim.rewardTitle, "20% off coffee");
  assert.equal(claim.status, "active");
  assert.match(claim.code, /^EGG-[A-Z0-9]{4}-[A-Z0-9]{2}$/);

  await assert.rejects(
    () =>
      localStore.claimEgg({
        eggId: IDS.huntableEgg,
        playerId: IDS.player,
        lat: DEMO_PLAYER.lat,
        lng: DEMO_PLAYER.lng,
      }),
    (err: unknown) => (err as { code?: string }).code === "unavailable",
  );

  const redeemed = await localStore.redeem({
    tokenOrCode: claim.code.toLowerCase(),
    businessId: IDS.cafe,
    redeemedBy: IDS.cafeOwner,
  });
  assert.equal(redeemed.claim.status, "redeemed");

  await assert.rejects(
    () =>
      localStore.redeem({
        tokenOrCode: claim.token,
        businessId: IDS.cafe,
        redeemedBy: IDS.cafeOwner,
      }),
    (err: unknown) => (err as { code?: string }).code === "already_redeemed",
  );

  await assert.rejects(
    () =>
      localStore.redeem({
        tokenOrCode: COOKIE_CODE,
        businessId: IDS.cafe,
        redeemedBy: IDS.cafeOwner,
      }),
    (err: unknown) => (err as { code?: string }).code === "wrong_business",
  );

  const coffee = await localStore.redeem({
    tokenOrCode: COFFEE_CODE,
    businessId: IDS.cafe,
    redeemedBy: IDS.cafeOwner,
  });
  assert.equal(coffee.claim.id, IDS.coffeeClaim);
  await assert.rejects(
    () =>
      localStore.redeem({
        tokenOrCode: `  ${COFFEE_CODE.toLowerCase()}  `,
        businessId: IDS.cafe,
        redeemedBy: IDS.cafeOwner,
      }),
    (err: unknown) => (err as { code?: string }).code === "already_redeemed",
  );

  const before = (await localStore.listNearbyEggs(CAFE_LOCATION.lat, CAFE_LOCATION.lng, 400)).length;
  const created = await localStore.createCampaign({
    businessId: IDS.cafe,
    name: "Test drop",
    rewardType: "discount",
    rewardLabel: "15% OFF",
    rewardDetail: "Any coffee drink",
    rewardTitle: "15% off",
    radiusM: 400,
    eggCount: 20,
    emptyCount: 4,
  });
  assert.equal(created.amountCents, 100);
  assert.equal(created.emptyCount, 4);
  assert.equal(created.status, "pending_payment");
  const pending = (await localStore.listNearbyEggs(CAFE_LOCATION.lat, CAFE_LOCATION.lng, 400)).length;
  assert.equal(pending, before);

  await localStore.activateCampaign(created.id, "cs_test_activation");
  await localStore.activateCampaign(created.id, "cs_test_activation");
  const after = (await localStore.listNearbyEggs(CAFE_LOCATION.lat, CAFE_LOCATION.lng, 400)).length;
  assert.equal(after - before, 20);
  const saved = JSON.parse(fs.readFileSync(file, "utf8")) as { eggs: { campaignId: string; empty?: boolean }[] };
  const batch = saved.eggs.filter((egg) => egg.campaignId === created.id);
  assert.equal(batch.length, 20);
  assert.equal(batch.filter((egg) => egg.empty).length, 4);

  await assert.rejects(
    () =>
      localStore.createCampaign({
        businessId: IDS.cafe,
        name: "Too many empty",
        rewardType: "discount",
        rewardLabel: "15% OFF",
        rewardDetail: "Any coffee drink",
        rewardTitle: "15% off",
        radiusM: 400,
        eggCount: 20,
        emptyCount: 21,
      }),
    (err: unknown) => (err as { code?: string }).code === "bad_count",
  );

  const wallet = await localStore.listClaimsForPlayer(IDS.player);
  assert.ok(wallet.every((item) => item.eggId !== IDS.emptyNear));
  assert.ok(wallet.some((item) => item.code === COFFEE_CODE));
  assert.ok(wallet.some((item) => item.id === claim.id && item.status === "redeemed"));
  const coffeeCard = wallet.find((item) => item.code === COFFEE_CODE);
  const giftCard = wallet.find((item) => item.code === GIFT_CODE);
  const cookieCard = wallet.find((item) => item.code === COOKIE_CODE);
  assert.ok(coffeeCard && sameDesign(coffeeCard.design ?? null, CAFE_EGG));
  assert.ok(giftCard && sameDesign(giftCard.design ?? null, GARDEN_EGG));
  assert.equal(cookieCard?.design ?? null, null);
});

test("a saved egg design shows up on nearby eggs, and a batch can override it", async () => {
  const { localStore } = await import("../src/lib/db/local");
  await localStore.reset();
  const custom = {
    baseColor: "#7C5CBF",
    secondColor: "#F4A900",
    pattern: "zigzag" as const,
    shine: true,
    badge: { kind: "text" as const, text: "BEAN" },
  };
  const saved = await localStore.saveEggDesign(IDS.cafe, custom);
  assert.ok(saved && sameDesign(saved, custom));
  const nearby = await localStore.listNearbyEggs(DEMO_PLAYER.lat, DEMO_PLAYER.lng, 1000);
  assert.ok(nearby.length > 0);
  assert.ok(nearby.every((egg) => sameDesign(egg.design, custom)));

  const created = await localStore.createCampaign({
    businessId: IDS.cafe,
    name: "Override drop",
    rewardType: "discount",
    rewardLabel: "15% OFF",
    rewardDetail: "Any coffee drink",
    rewardTitle: "15% off",
    radiusM: 400,
    eggCount: 10,
    eggDesign: GARDEN_EGG,
  });
  assert.ok(sameDesign(created.eggDesign, GARDEN_EGG));
  await localStore.activateCampaign(created.id, null);
  const mixed = await localStore.listNearbyEggs(CAFE_LOCATION.lat, CAFE_LOCATION.lng, 400);
  const overrides = mixed.filter((egg) => sameDesign(egg.design, GARDEN_EGG));
  const defaults = mixed.filter((egg) => sameDesign(egg.design, custom));
  assert.equal(overrides.length, 10);
  assert.ok(defaults.length > 0);

  await assert.rejects(
    () => localStore.saveEggDesign(IDS.cafe, { ...custom, badge: { kind: "logo", logo: "data:image/svg+xml,hi" } }),
    (err: unknown) => (err as { code?: string }).code === "bad_design",
  );
});
