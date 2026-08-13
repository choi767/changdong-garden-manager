export interface SupabaseRepositoryConfig {
  url: string;
  anonKey: string;
  snapshotId: string;
}

function readEnv(name: string): string {
  const value = import.meta.env[name];
  return typeof value === "string" ? value.trim() : "";
}

export function getSupabaseRepositoryConfig(): SupabaseRepositoryConfig | null {
  const url = readEnv("VITE_SUPABASE_URL");
  const anonKey = readEnv("VITE_SUPABASE_ANON_KEY");
  if (!url || !anonKey) return null;
  return {
    url,
    anonKey,
    snapshotId: readEnv("VITE_GARDEN_SNAPSHOT_ID") || "changdong-main"
  };
}

