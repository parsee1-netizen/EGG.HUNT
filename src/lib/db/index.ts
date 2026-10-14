import { dataDriver } from "../driver";
import type { EggStore } from "../types";
import { localStore } from "./local";
import { supabaseStore } from "./supabase";

export function getStore(): EggStore {
  return dataDriver() === "supabase" ? supabaseStore : localStore;
}
