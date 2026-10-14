export async function api<T>(path: string, init?: RequestInit): Promise<T> {
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

export function toast(message: string) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("eggdrop-toast", { detail: message }));
}
