import { NextResponse } from "next/server";
import { dataDriver } from "@/lib/driver";
import { demoSession, ensureSession, isHttpsRequest, setSessionCookie } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = await ensureSession(req);
  return NextResponse.json(session);
}

export async function POST(req: Request) {
  if (dataDriver() === "supabase") {
    return NextResponse.json({ error: "Sign in with the account that matches this side." }, { status: 400 });
  }
  const body = (await req.json().catch(() => ({}))) as { role?: string };
  const role = body.role === "business" ? "business" : "player";
  const session = await demoSession(role);
  await setSessionCookie(session, isHttpsRequest(req));
  return NextResponse.json(session);
}
