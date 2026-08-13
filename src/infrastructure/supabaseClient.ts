import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseRepositoryConfig } from "./repositories/repositoryConfig";

let client: SupabaseClient | null = null;

export function isCloudModeEnabled(): boolean {
  return getSupabaseRepositoryConfig() !== null;
}

export function getSupabaseClient(): SupabaseClient | null {
  const config = getSupabaseRepositoryConfig();
  if (!config) return null;
  if (!client) {
    client = createClient(config.url, config.anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true
      }
    });
  }
  return client;
}
