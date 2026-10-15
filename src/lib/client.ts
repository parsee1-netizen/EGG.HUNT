let roleHint: "player" | "business" | null = null;

/** The shell sets this before a page fetches, so a stale cookie can be corrected once. */
export function setRoleHint(role: "player" | "business") {
  roleHint = role;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const body = (await res.json().catch(() => ({}))) as { error?: string; code?: string };
  if (!res.ok) {
    const error = new Error(body.error || `Request failed (${res.status})`) as Error & { code?: string; status?: number };
    error.code = body.code;
    error.status = res.status;
    throw error;
  }
  return body as T;
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  try {
    return await request<T>(path, init);
  } catch (err) {
    const status = (err as { status?: number }).status;
    if (roleHint && (status === 401 || status === 403) && path !== "/api/session") {
      await request("/api/session", { method: "POST", body: JSON.stringify({ role: roleHint }) });
      return await request<T>(path, init);
    }
    throw err;
  }
}

export function toast(message: string) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("eggdrop-toast", { detail: message }));
}
