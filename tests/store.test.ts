import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { CATCH_RADIUS_M, distanceM } from "../src/lib/geo";
import { amountCents } from "../src/lib/pricing";
import {
  CAFE_LOCATION,
  COFFEE_CODE,
  COOKIE_CODE,
  DEMO_PLAYER,
  HUNTABLE_DISTANCE_M,
  HUNTABLE_EGG_POS,
  IDS,
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
  assert.ok(Math.abs(near - HUNTABLE_DISTANCE_M) < 0.5);
  assert.ok(Math.abs(far - TOO_FAR_DISTANCE_M) < 0.5);
  assert.equal(amountCents(200), 1000);
  assert.ok(near <= CATCH_RADIUS_M);
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

  const nearby = await localStore.listNearbyEggs(DEMO_PLAYER.lat, DEMO_PLAYER.lng, 1000);
  const inRange = nearby.filter((egg) => egg.distanceM <= CATCH_RADIUS_M);
  assert.deepEqual(
    inRange.map((egg) => egg.id),
    [IDS.huntableEgg],
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

  const claim = await localStore.claimEgg({
    eggId: IDS.huntableEgg,
    playerId: IDS.player,
    lat: DEMO_PLAYER.lat,
    lng: DEMO_PLAYER.lng,
  });
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
  });
  assert.equal(created.amountCents, 100);
  assert.equal(created.status, "pending_payment");
  const pending = (await localStore.listNearbyEggs(CAFE_LOCATION.lat, CAFE_LOCATION.lng, 400)).length;
  assert.equal(pending, before);

  await localStore.activateCampaign(created.id, "cs_test_activation");
  await localStore.activateCampaign(created.id, "cs_test_activation");
  const after = (await localStore.listNearbyEggs(CAFE_LOCATION.lat, CAFE_LOCATION.lng, 400)).length;
  assert.equal(after - before, 20);

  const wallet = await localStore.listClaimsForPlayer(IDS.player);
  assert.ok(wallet.some((item) => item.code === COFFEE_CODE));
  assert.ok(wallet.some((item) => item.id === claim.id && item.status === "redeemed"));
});
