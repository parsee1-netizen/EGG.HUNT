export type DataDriver = "local" | "supabase";

/** Supabase when it is configured, unless EGG_DATA_DRIVER forces a choice. */
export function dataDriver(): DataDriver {
  const forced = process.env.EGG_DATA_DRIVER?.trim();
  if (forced === "local" || forced === "supabase") return forced;
  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) return "supabase";
  return "local";
}
