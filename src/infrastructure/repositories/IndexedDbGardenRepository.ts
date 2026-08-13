import type { AppData } from "../../domain/entities/models";
import type { GardenRepository } from "../../domain/repositories/GardenRepository";
import { createInitialData } from "../../domain/services/seedData";
import { markCurrentEmbeddedBackupSeen, readSnapshot, writeSnapshot } from "../database/gardenDb";
import { createBackupPayload, deserializeAppData, parseBackupPayload, serializeAppData } from "./appDataSerialization";

export class IndexedDbGardenRepository implements GardenRepository {
  async load(): Promise<AppData> {
    return readSnapshot();
  }

  async save(data: AppData): Promise<void> {
    await writeSnapshot(data);
  }

  async reset(data: AppData = createInitialData()): Promise<void> {
    await writeSnapshot(data);
  }

  async exportJson(): Promise<string> {
    const data = await this.load();
    return JSON.stringify(createBackupPayload(await serializeAppData(data)), null, 2);
  }

  async importJson(json: string): Promise<AppData> {
    const payload = parseBackupPayload(json);
    const data = await markCurrentEmbeddedBackupSeen(deserializeAppData(payload.data));
    await writeSnapshot(data);
    return data;
  }
}
