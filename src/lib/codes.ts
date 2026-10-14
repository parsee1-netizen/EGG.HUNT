const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function makeCode(): string {
  const pick = (n: number) =>
    Array.from({ length: n }, () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)]).join("");
  return `EGG-${pick(4)}-${pick(2)}`;
}

export function makeToken(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function normalizeCode(input: string): string {
  return input.trim().toUpperCase().replace(/\s+/g, "");
}

/** Deterministic code for seed data. */
export function codeFromInt(n: number): string {
  let x = Math.abs(n) + 1;
  let body = "";
  for (let i = 0; i < 6; i++) {
    body = ALPHABET[x % ALPHABET.length] + body;
    x = Math.floor(x / ALPHABET.length);
  }
  return `EGG-${body.slice(0, 4)}-${body.slice(4)}`;
}

export function tokenFromInt(n: number): string {
  return `seed${n.toString(16).padStart(28, "0")}`;
}
