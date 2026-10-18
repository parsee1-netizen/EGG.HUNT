"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import { api, toast } from "@/lib/client";
import type { Session } from "@/lib/types";

interface Config {
  driver: "local" | "supabase";
  allowRoleSwitch: boolean;
}

export default function AuthPage() {
  const router = useRouter();
  const [config, setConfig] = useState<Config | null>(null);
  const [email, setEmail] = useState("player@eggdrop.demo");
  const [password, setPassword] = useState("eggdrop-demo");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<Config>("/api/config").then(setConfig).catch((err: Error) => toast(err.message));
  }, []);

  async function local(role: "player" | "business") {
    await api<Session>("/api/session", { method: "POST", body: JSON.stringify({ role }) });
    router.push(role === "business" ? "/business" : "/");
  }

  async function signIn(event: React.FormEvent) {
    event.preventDefault();
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) {
      toast("Supabase keys are not set.");
      return;
    }
    setBusy(true);
    try {
      const supabase = createBrowserClient(url, key);
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      const session = await api<Session>("/api/session");
      router.push(session.role === "business" ? "/business" : "/");
      router.refresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Sign-in failed.");
      setBusy(false);
    }
  }

  return (
    <div className="screen">
      <h1>Account</h1>
      {config?.driver !== "supabase" ? (
        <>
          <p className="sub">Local demo. Pick a side — no password until Supabase is connected.</p>
          <button type="button" className="btn" onClick={() => local("player")}>
            Continue as Alex, the player
          </button>
          <button type="button" className="btn ghost" onClick={() => local("business")}>
            Continue as Bean There Cafe
          </button>
        </>
      ) : (
        <>
          <p className="sub">Sign in with the seeded demo accounts, or any Supabase user.</p>
          <form onSubmit={signIn}>
            <input className="field" type="email" value={email} onChange={(event) => setEmail(event.target.value)} aria-label="Email" />
            <div style={{ height: 8 }} />
            <input className="field" type="password" value={password} onChange={(event) => setPassword(event.target.value)} aria-label="Password" />
            <button type="submit" className="btn" disabled={busy}>
              {busy ? "Signing in…" : "Sign in"}
            </button>
          </form>
        </>
      )}
    </div>
  );
}
