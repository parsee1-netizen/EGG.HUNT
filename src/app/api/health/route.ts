import { NextResponse } from "next/server";
import { dataDriver } from "@/lib/driver";
import { stripeEnabled } from "@/lib/stripe";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({ ok: true, driver: dataDriver(), stripe: stripeEnabled() });
}
