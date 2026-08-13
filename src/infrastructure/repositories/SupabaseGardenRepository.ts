import type { SupabaseClient } from "@supabase/supabase-js";
import type { RealtimeChannel } from "@supabase/supabase-js";
import type { AppData } from "../../domain/entities/models";
import type { GardenRepository } from "../../domain/repositories/GardenRepository";
import { createInitialData } from "../../domain/services/seedData";
import { readSnapshot } from "../database/gardenDb";
import { getSupabaseClient } from "../supabaseClient";
import { createBackupPayload, deserializeAppData, parseBackupPayload, serializeAppData, type SerializedAppData } from "./appDataSerialization";
import type { SupabaseRepositoryConfig } from "./repositoryConfig";

interface SnapshotRow {
  id: string;
  data: SerializedAppData;
  revision: number;
  updated_at: string;
}

interface SaveSnapshotResult {
  data: SerializedAppData;
  revision: number;
}

export class CloudConflictError extends Error {
  constructor() {
    super("다른 사용자가 먼저 저장했습니다. 화면을 새로고침한 뒤 다시 입력해 주세요.");
    this.name = "CloudConflictError";
  }
}

export class SupabaseGardenRepository implements GardenRepository {
  private readonly client: SupabaseClient;
  private readonly snapshotId: string;
  private revision: number | null = null;
  private channel: RealtimeChannel | null = null;

  constructor(config: SupabaseRepositoryConfig) {
    const client = getSupabaseClient();
    if (!client) throw new Error("Supabase 설정이 필요합니다.");
    this.client = client;
    this.snapshotId = config.snapshotId;
  }

  async load(): Promise<AppData> {
    const row = await this.loadRow();
    if (row) {
      this.revision = row.revision;
      return deserializeAppData(row.data);
    }

    const initial = await this.loadLocalBootstrapData();
    const serialized = await serializeAppData(initial);
    const inserted = await this.saveSnapshot(serialized, null);
    this.revision = inserted.revision;
    return deserializeAppData(inserted.data);
  }

  async save(data: AppData): Promise<void> {
    const saved = await this.saveSnapshot(await serializeAppData(data), this.revision);
    this.revision = saved.revision;
  }

  async reset(data: AppData = createInitialData()): Promise<void> {
    const saved = await this.saveSnapshot(await serializeAppData(data), this.revision);
    this.revision = saved.revision;
  }

  async exportJson(): Promise<string> {
    const data = await this.load();
    return JSON.stringify(createBackupPayload(await serializeAppData(data)), null, 2);
  }

  async importJson(json: string): Promise<AppData> {
    const payload = parseBackupPayload(json);
    const saved = await this.saveSnapshot(payload.data, this.revision);
    this.revision = saved.revision;
    return deserializeAppData(saved.data);
  }

  subscribe(onRemoteData: (data: AppData) => void): () => void {
    if (this.channel) {
      void this.client.removeChannel(this.channel);
    }

    this.channel = this.client
      .channel(`garden-snapshot-${this.snapshotId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "garden_snapshots",
          filter: `id=eq.${this.snapshotId}`
        },
        (payload) => {
          const next = payload.new as SnapshotRow;
          if (!next?.data || next.revision === this.revision) return;
          this.revision = next.revision;
          onRemoteData(deserializeAppData(next.data));
        }
      )
      .subscribe();

    return () => {
      if (!this.channel) return;
      void this.client.removeChannel(this.channel);
      this.channel = null;
    };
  }

  private async loadRow(): Promise<SnapshotRow | null> {
    const { data, error } = await this.client
      .from("garden_snapshots")
      .select("id,data,revision,updated_at")
      .eq("id", this.snapshotId)
      .maybeSingle();

    if (error) throw new Error(`Supabase 데이터를 불러오지 못했습니다: ${error.message}`);
    return data as SnapshotRow | null;
  }

  private async loadLocalBootstrapData(): Promise<AppData> {
    try {
      return await readSnapshot();
    } catch {
      return createInitialData();
    }
  }

  private async saveSnapshot(data: SerializedAppData, expectedRevision: number | null): Promise<SaveSnapshotResult> {
    const { data: saved, error } = await this.client.rpc("save_garden_snapshot", {
      p_id: this.snapshotId,
      p_data: data,
      p_expected_revision: expectedRevision
    });

    if (error) {
      if (error.message.includes("GARDEN_SNAPSHOT_CONFLICT")) throw new CloudConflictError();
      throw new Error(`Supabase 저장에 실패했습니다: ${error.message}`);
    }

    const row = Array.isArray(saved) ? saved[0] : saved;
    if (!row?.data || typeof row.revision !== "number") {
      throw new Error("Supabase 저장 결과가 올바르지 않습니다.");
    }
    return row as SaveSnapshotResult;
  }
}
