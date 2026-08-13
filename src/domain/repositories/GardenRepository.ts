import type { AppData } from "../entities/models";

export interface GardenRepository {
  load(): Promise<AppData>;
  save(data: AppData): Promise<void>;
  reset(data: AppData): Promise<void>;
  exportJson(): Promise<string>;
  importJson(json: string): Promise<AppData>;
}
