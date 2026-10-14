import { NextResponse } from "next/server";
import { dataDriver } from "@/lib/driver";
import { CATCH_RADIUS_M } from "@/lib/geo";
import { EGG_PRICE_CENTS } from "@/lib/pricing";
import { CAFE_LOCATION, DEMO_PLAYER } from "@/lib/seed";
import { stripeEnabled } from "@/lib/stripe";

export const dynamic = "force-dynamic";

export function GET() {
  const driver = dataDriver();
  return NextResponse.json({
    driver,
    stripe: stripeEnabled(),
    demoLocation: DEMO_PLAYER,
    cafeLocation: CAFE_LOCATION,
    cafeName: "Bean There Cafe",
    catchRadiusM: CATCH_RADIUS_M,
    priceCents: EGG_PRICE_CENTS,
    allowRoleSwitch: driver === "local",
  });
}
