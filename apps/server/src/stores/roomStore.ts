import type { Room } from "../types.js";

export interface RoomStore {
  get(id: string): Room | undefined;
  set(id: string, room: Room): void;
  delete(id: string): void;
  has(id: string): boolean;
  keys(): string[];
  values(): Room[];
  resolveCode(code: string): string | undefined;
  registerCode(room: Room): void;
  unregisterCode(room: Room): void;
  hasCode(code: string): boolean;
  clear(): void;
  /** Whether this store replicates across nodes */
  isDistributed(): boolean;
}

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export class InMemoryRoomStore implements RoomStore {
  private rooms = new Map<string, Room>();
  private roomCodes = new Map<string, string>();

  isDistributed(): boolean {
    return false;
  }

  get(id: string): Room | undefined {
    return this.rooms.get(id);
  }

  set(id: string, room: Room): void {
    this.rooms.set(id, room);
  }

  delete(id: string): void {
    this.rooms.delete(id);
  }

  has(id: string): boolean {
    return this.rooms.has(id);
  }

  keys(): string[] {
    return Array.from(this.rooms.keys());
  }

  values(): Room[] {
    return Array.from(this.rooms.values());
  }

  resolveCode(code: string): string | undefined {
    return this.roomCodes.get(this.normalizeCode(code));
  }

  registerCode(room: Room): void {
    this.roomCodes.set(this.normalizeCode(room.code), room.id);
  }

  unregisterCode(room: Room): void {
    this.roomCodes.delete(this.normalizeCode(room.code));
  }

  hasCode(code: string): boolean {
    return this.roomCodes.has(this.normalizeCode(code));
  }

  clear(): void {
    this.rooms.clear();
    this.roomCodes.clear();
  }

  normalizeCode(code: string): string {
    return code.trim().toUpperCase();
  }

  generateUniqueCode(): string {
    for (let attempt = 0; attempt < 100; attempt++) {
      let code = "";
      for (let i = 0; i < 6; i++) {
        code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
      }
      if (!this.roomCodes.has(code)) return code;
    }
    throw new Error("code_generation_failed");
  }
}
