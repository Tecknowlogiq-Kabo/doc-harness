import { readFileSync, writeFileSync, existsSync, unlinkSync } from "node:fs";
import { resolve } from "node:path";
import type { SessionStore, SessionData } from "./session-store";

export class SQLiteStore implements SessionStore {
  private filePath: string;
  private cache: Map<string, SessionData>;

  constructor(dbPath: string = "./doc-harness.json") {
    this.filePath = resolve(dbPath);
    this.cache = new Map();
    this.load();
  }

  private load(): void {
    if (!existsSync(this.filePath)) return;
    try {
      const raw = readFileSync(this.filePath, "utf-8");
      const entries: SessionData[] = JSON.parse(raw);
      for (const entry of entries) {
        this.cache.set(entry.id, entry);
      }
    } catch {
      // corrupted file, start fresh
    }
  }

  private save(): void {
    const entries = Array.from(this.cache.values());
    writeFileSync(this.filePath, JSON.stringify(entries, null, 2), "utf-8");
  }

  async create(session: SessionData): Promise<void> {
    this.cache.set(session.id, session);
    this.save();
  }

  async update(id: string, partial: Partial<SessionData>): Promise<void> {
    const existing = this.cache.get(id);
    if (!existing) throw new Error(`Session ${id} not found`);
    const merged = { ...existing, ...partial };
    this.cache.set(id, merged);
    this.save();
  }

  async get(id: string): Promise<SessionData | null> {
    return this.cache.get(id) ?? null;
  }

  async list(limit: number = 20): Promise<SessionData[]> {
    const all = Array.from(this.cache.values());
    all.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return all.slice(0, limit);
  }

  async delete(id: string): Promise<void> {
    this.cache.delete(id);
    this.save();
  }

  clear(): void {
    this.cache.clear();
    if (existsSync(this.filePath)) {
      unlinkSync(this.filePath);
    }
  }
}
