import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getStore } from "./db";
import { dataDriver } from "./driver";
import { StoreError } from "./errors";
import { DEMO_BUSINESS_EMAIL_ADDRESS, DEMO_PLAYER_EMAIL_ADDRESS, IDS } from "./seed";
import type { Role, Session } from "./types";

const COOKIE = "eggdrop_session";

async function supabaseServer() {
  const cookieStore = await cookies();
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) cookieStore.set(name, value, options);
        } catch {
          /* Called from a Server Component, where cookies are read-only. */
        }
      },
    },
  });
}

export async function demoSession(role: Role): Promise<Session> {
  const store = getStore();
  if (role === "business") {
    const profile = await store.getProfile(IDS.cafeOwner);
    const business = await store.getBusiness(IDS.cafe);
    return {
      userId: IDS.cafeOwner,
      role: "business",
      name: business?.name ?? "Bean There Cafe",
      email: profile?.email ?? DEMO_BUSINESS_EMAIL_ADDRESS,
      businessId: business?.id ?? IDS.cafe,
      businessName: business?.name ?? "Bean There Cafe",
      driver: "local",
    };
  }
  const profile = await store.getProfile(IDS.player);
  return {
    userId: IDS.player,
    role: "player",
    name: profile?.displayName ?? "Alex Rivera",
    email: profile?.email ?? DEMO_PLAYER_EMAIL_ADDRESS,
    businessId: null,
    businessName: null,
    driver: "local",
  };
}

async function supabaseSession(): Promise<Session> {
  const supabase = await supabaseServer();
  const { data } = await supabase.auth.getUser();
  if (!data.user) {
    return {
      userId: "",
      role: "player",
      name: "Guest",
      email: "",
      businessId: null,
      businessName: null,
      driver: "supabase",
    };
  }
  const store = getStore();
  const profile = await store.getProfile(data.user.id);
  const business = profile?.role === "business" ? await store.getBusinessForOwner(data.user.id) : null;
  return {
    userId: data.user.id,
    role: profile?.role ?? "player",
    name: business?.name ?? profile?.displayName ?? "Player",
    email: data.user.email ?? profile?.email ?? "",
    businessId: business?.id ?? null,
    businessName: business?.name ?? null,
    driver: "supabase",
  };
}

export async function getSession(): Promise<Session> {
  if (dataDriver() === "supabase") return supabaseSession();
  const jar = await cookies();
  const raw = jar.get(COOKIE)?.value;
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as Session;
      if (parsed.userId && (parsed.role === "player" || parsed.role === "business")) {
        return { ...parsed, driver: "local" };
      }
    } catch {
      /* replace a corrupt cookie */
    }
  }
  return demoSession("player");
}

/** Secure cookies are HTTPS-only. WebKit drops them on http://127.0.0.1, so follow the request. */
export function isHttpsRequest(req: Request): boolean {
  const forwarded = req.headers.get("x-forwarded-proto");
  if (forwarded) return forwarded.split(",")[0].trim() === "https";
  try {
    return new URL(req.url).protocol === "https:";
  } catch {
    return false;
  }
}

export async function setSessionCookie(session: Session, secure: boolean) {
  const jar = await cookies();
  jar.set(COOKIE, JSON.stringify(session), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
    secure,
  });
}

export async function requirePlayer(): Promise<Session> {
  const session = await getSession();
  if (!session.userId) throw new StoreError("unauthorized", 401, "Sign in required.");
  if (session.role !== "player") throw new StoreError("forbidden", 403, "Switch to the player side to catch eggs.");
  return session;
}

export async function requireBusiness(): Promise<Session> {
  const session = await getSession();
  if (!session.userId) throw new StoreError("unauthorized", 401, "Sign in required.");
  if (session.role !== "business" || !session.businessId) {
    throw new StoreError("forbidden", 403, "Switch to the business side to do this.");
  }
  return session;
}

export async function ensureSession(req: Request): Promise<Session> {
  const session = await getSession();
  if (dataDriver() === "local") {
    const jar = await cookies();
    if (!jar.get(COOKIE)) await setSessionCookie(session, isHttpsRequest(req));
  }
  return session;
}
