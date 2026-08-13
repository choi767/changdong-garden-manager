import type { GardenRepository } from "../../domain/repositories/GardenRepository";
import { IndexedDbGardenRepository } from "./IndexedDbGardenRepository";
import { getSupabaseRepositoryConfig } from "./repositoryConfig";
import { SupabaseGardenRepository } from "./SupabaseGardenRepository";

export type RealtimeGardenRepository = GardenRepository & {
  subscribe?: (onRemoteData: (data: Awaited<ReturnType<GardenRepository["load"]>>) => void) => () => void;
};

export function createGardenRepository(): RealtimeGardenRepository {
  const supabaseConfig = getSupabaseRepositoryConfig();
  if (supabaseConfig) return new SupabaseGardenRepository(supabaseConfig);
  return new IndexedDbGardenRepository();
}

