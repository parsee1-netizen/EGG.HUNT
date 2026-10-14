import { NextResponse } from "next/server";
import { storeErrorResponse } from "./errors";

export function fail(err: unknown) {
  const mapped = storeErrorResponse(err);
  if (mapped) return NextResponse.json(mapped.body, { status: mapped.status });
  console.error(err);
  const message = err instanceof Error ? err.message : "Something went wrong.";
  return NextResponse.json({ error: message }, { status: 500 });
}

export function requireFinite(value: unknown, label: string): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) throw new Error(`${label} is required.`);
  return n;
}
