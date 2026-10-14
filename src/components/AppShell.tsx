"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/lib/client";
import type { Session } from "@/lib/types";

interface Config {
  driver: "local" | "supabase";
  allowRoleSwitch: boolean;
  priceCents: number;
}

const PLAYER_NAV = [
  { href: "/", label: "Map", icon: "🗺️" },
  { href: "/hunt", label: "Hunt", icon: "📷" },
  { href: "/wallet", label: "Wallet", icon: "👛" },
];

const BUSINESS_NAV = [
  { href: "/business", label: "Dashboard", icon: "📊" },
  { href: "/business/hide", label: "Hide", icon: "🥚" },
  { href: "/business/results", label: "Results", icon: "📈" },
];

function navOn(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  if (href === "/hunt") return pathname === "/hunt" || pathname.startsWith("/crack");
  if (href === "/wallet") return pathname.startsWith("/wallet");
  if (href === "/business") return pathname === "/business" || pathname.startsWith("/business/scan");
  if (href === "/business/hide") return pathname.startsWith("/business/hide") || pathname.startsWith("/business/checkout");
  if (href === "/business/results") return pathname.startsWith("/business/results");
  return pathname === href;
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [config, setConfig] = useState<Config | null>(null);
  const [toastMsg, setToastMsg] = useState("");

  const hunt = pathname === "/hunt";
  const onAuth = pathname.startsWith("/auth");
  const wantBusiness = pathname.startsWith("/business");

  useEffect(() => {
    let cancel = false;
    Promise.all([api<Session>("/api/session"), api<Config>("/api/config")])
      .then(([nextSession, nextConfig]) => {
        if (!cancel) {
          setSession(nextSession);
          setConfig(nextConfig);
        }
      })
      .catch(() => {});
    return () => {
      cancel = true;
    };
  }, []);

  useEffect(() => {
    if (!session || !config?.allowRoleSwitch || onAuth) return;
    const want = wantBusiness ? "business" : "player";
    if (session.role === want) return;
    let cancel = false;
    api<Session>("/api/session", { method: "POST", body: JSON.stringify({ role: want }) })
      .then((next) => {
        if (!cancel) setSession(next);
      })
      .catch(() => {});
    return () => {
      cancel = true;
    };
  }, [session, config, wantBusiness, onAuth]);

  useEffect(() => {
    const onToast = (event: Event) => {
      setToastMsg((event as CustomEvent<string>).detail);
      window.setTimeout(() => setToastMsg(""), 2200);
    };
    window.addEventListener("eggdrop-toast", onToast);
    return () => window.removeEventListener("eggdrop-toast", onToast);
  }, []);

  async function switchSide(role: "player" | "business") {
    if (config?.allowRoleSwitch) {
      const next = await api<Session>("/api/session", { method: "POST", body: JSON.stringify({ role }) });
      setSession(next);
    }
    router.push(role === "business" ? "/business" : "/");
  }

  const roleReady =
    onAuth ||
    !session ||
    (config?.allowRoleSwitch ? (wantBusiness ? session.role === "business" : session.role === "player") : true);
  const blocked =
    session && config && !config.allowRoleSwitch && wantBusiness && session.role !== "business" && session.userId !== "";

  const nav = wantBusiness ? BUSINESS_NAV : PLAYER_NAV;
  const price = ((config?.priceCents ?? 5) / 100).toFixed(2);

  return (
    <div className="stage">
      <div className={`phone${hunt ? " hunt" : ""}`}>
        {hunt ? null : (
          <header className="top">
            <div className="toggle">
              <button type="button" className={!wantBusiness ? "on" : ""} onClick={() => switchSide("player")}>
                🥚 Player
              </button>
              <button type="button" className={wantBusiness ? "on" : ""} onClick={() => switchSide("business")}>
                🏪 Business
              </button>
            </div>
            <div className="demo">
              {config?.driver === "supabase" ? "Supabase" : "Demo seed"} · ${price} an egg
              {config?.driver === "supabase" ? (
                <>
                  {" "}
                  · <Link href="/auth">Account</Link>
                </>
              ) : null}
            </div>
          </header>
        )}
        <main className="stage-main">
          {!session || !roleReady ? (
            <div className="screen">
              <p className="sub">Loading EggDrop…</p>
            </div>
          ) : blocked ? (
            <div className="screen">
              <h1>Business sign-in</h1>
              <p className="sub">This side is for the cafe account.</p>
              <Link className="btn" href="/auth">
                Sign in
              </Link>
            </div>
          ) : (
            children
          )}
        </main>
        {hunt ? null : (
          <nav className="nav">
            {nav.map((item) => (
              <Link key={item.href} href={item.href} className={navOn(pathname, item.href) ? "on" : ""}>
                <i>{item.icon}</i>
                {item.label}
              </Link>
            ))}
          </nav>
        )}
        <div className="toast" style={{ display: toastMsg ? "block" : "none" }} role="status">
          {toastMsg}
        </div>
      </div>
    </div>
  );
}
