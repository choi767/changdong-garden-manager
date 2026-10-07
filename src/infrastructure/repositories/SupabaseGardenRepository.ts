import type { SupabaseClient } from "@supabase/supabase-js";
import type { RealtimeChannel } from "@supabase/supabase-js";
import type { AppData } from "../../domain/entities/models";
import type { GardenRepository } from "../../domain/repositories/GardenRepository";
import { createInitialData } from "../../domain/services/seedData";
import { readSnapshot } from "../database/gardenDb";
import { getSupabaseClient } from "../supabaseClient";
import { createBackupPayload, deserializeAppData, parseBackupPayload, serializeAppData } from "./appDataSerialization";
import type { SupabaseRepositoryConfig } from "./repositoryConfig";
import { CloudImages, diffSnapshots, type CloudSnapshot } from "./cloudSnapshot";

interface SnapshotRow {
  id: string;
  data: CloudSnapshot;
  revision: number;
  updated_at: string;
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
  private baseline: CloudSnapshot | null = null;
  private readonly images: CloudImages;
  private activeSaves = 0;
  private remoteRow: SnapshotRow | null = null;
  private remoteListener: ((data: AppData) => void) | null = null;
  private remoteQueue = Promise.resolve();

  constructor(config: SupabaseRepositoryConfig) {
    const client = getSupabaseClient();
    if (!client) throw new Error("Supabase 설정이 필요합니다.");
    this.client = client;
    this.snapshotId = config.snapshotId;
    this.images = new CloudImages(client, this.snapshotId);
  }

  async load(): Promise<AppData> {
    const row = await this.loadRow();
    if (row) {
      const data = await this.images.deserialize(row.data);
      this.revision = row.revision;
      this.baseline = structuredClone(row.data);
      return data;
    }

    const initial = await this.loadLocalBootstrapData();
    try {
      await this.save(initial);
    } catch (error) {
      if (!(error instanceof CloudConflictError)) throw error;
    }
    // Another client may have initialized the same snapshot first.
    return this.load();
  }

  async save(data: AppData): Promise<void> {
    const expectedRevision = this.revision;
    const baseline = this.baseline;
    this.activeSaves += 1;
    try {
      const serialized = await this.images.serialize(data);
      const changes = diffSnapshots(baseline, serialized);
      if (!Object.keys(changes).length && baseline?._cloudStorageVersion === 3) return;
      const { data: saved, error } = await this.client.rpc("save_garden_changes_v3", {
        p_id: this.snapshotId, p_changes: changes, p_expected_revision: expectedRevision
      });
      if (error) {
        if (error.message.includes("GARDEN_SNAPSHOT_CONFLICT")) throw new CloudConflictError();
        throw new Error(`Supabase 저장에 실패했습니다: ${error.message}`);
      }
      const row = Array.isArray(saved) ? saved[0] : saved;
      if (typeof row?.revision !== "number") throw new Error("Supabase 저장 결과가 올바르지 않습니다.");
      this.revision = row.revision;
      this.baseline = structuredClone(serialized);
    } finally {
      this.activeSaves -= 1;
      this.drainRemote();
    }
  }

  async reset(data: AppData = createInitialData()): Promise<void> {
    await this.save(data);
  }

  async exportJson(): Promise<string> {
    const data = await this.load();
    return JSON.stringify(createBackupPayload(await serializeAppData(data)), null, 2);
  }

  async importJson(json: string): Promise<AppData> {
    const payload = parseBackupPayload(json);
    const data = deserializeAppData(payload.data);
    await this.save(data);
    return data;
  }

  subscribe(onRemoteData: (data: AppData) => void): () => void {
    this.remoteListener = onRemoteData;
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
          if (!next?.id || next.revision <= (this.revision ?? 0)) return;
          if (!this.remoteRow || next.revision > this.remoteRow.revision) this.remoteRow = next;
          this.drainRemote();
        }
      )
      .subscribe();

    return () => {
      this.remoteListener = null;
      if (!this.channel) return;
      void this.client.removeChannel(this.channel);
      this.channel = null;
    };
  }

  private drainRemote(): void {
    if (this.activeSaves || !this.remoteRow || !this.remoteListener) return;
    const row = this.remoteRow;
    this.remoteRow = null;
    this.remoteQueue = this.remoteQueue.then(async () => {
      if (row.revision <= (this.revision ?? 0) || !this.remoteListener) return;
      // Realtime can omit large JSON fields; read the authoritative snapshot instead.
      const fresh = await this.loadRow();
      if (!fresh || fresh.revision <= (this.revision ?? 0)) return;
      const data = await this.images.deserialize(fresh.data);
      if (fresh.revision <= (this.revision ?? 0)) return;
      if (this.activeSaves) {
        if (!this.remoteRow || fresh.revision > this.remoteRow.revision) this.remoteRow = fresh;
        return;
      }
      this.revision = fresh.revision;
      this.baseline = structuredClone(fresh.data);
      this.remoteListener?.(data);
    }).catch((error) => console.error("Cloud synchronization failed", error));
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

}
