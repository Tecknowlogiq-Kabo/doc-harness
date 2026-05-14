import Database from "better-sqlite3";
import type { SessionStore, SessionData } from "./session-store";

export class SQLiteStore implements SessionStore {
  private db: Database.Database;

  constructor(dbPath: string = "./doc-harness.db") {
    this.db = new Database(dbPath);
    this.db.pragma("journal_mode = WAL");
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        prompt TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'running',
        documents TEXT NOT NULL DEFAULT '[]',
        relations TEXT NOT NULL DEFAULT '[]',
        manifest TEXT,
        created_at TEXT NOT NULL,
        completed_at TEXT
      )
    `);
  }

  async create(session: SessionData): Promise<void> {
    const stmt = this.db.prepare(
      `INSERT OR REPLACE INTO sessions (id, prompt, status, documents, relations, manifest, created_at, completed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    );
    stmt.run(
      session.id,
      session.prompt,
      session.status,
      JSON.stringify(session.documents),
      JSON.stringify(session.relations),
      session.manifest ? JSON.stringify(session.manifest) : null,
      session.createdAt,
      session.completedAt
    );
  }

  async update(id: string, partial: Partial<SessionData>): Promise<void> {
    const existing = await this.get(id);
    if (!existing) throw new Error(`Session ${id} not found`);
    const merged = { ...existing, ...partial };
    await this.create(merged);
  }

  async get(id: string): Promise<SessionData | null> {
    const stmt = this.db.prepare("SELECT * FROM sessions WHERE id = ?");
    const row = stmt.get(id) as Record<string, unknown> | undefined;
    if (!row) return null;
    return this.rowToSession(row);
  }

  async list(limit: number = 20): Promise<SessionData[]> {
    const stmt = this.db.prepare(
      "SELECT * FROM sessions ORDER BY created_at DESC LIMIT ?"
    );
    const rows = stmt.all(limit) as Record<string, unknown>[];
    return rows.map((row) => this.rowToSession(row));
  }

  async delete(id: string): Promise<void> {
    this.db.prepare("DELETE FROM sessions WHERE id = ?").run(id);
  }

  private rowToSession(row: Record<string, unknown>): SessionData {
    return {
      id: row.id as string,
      prompt: row.prompt as string,
      status: row.status as SessionData["status"],
      documents: JSON.parse(row.documents as string),
      relations: JSON.parse(row.relations as string),
      manifest: row.manifest ? JSON.parse(row.manifest as string) : null,
      createdAt: row.created_at as string,
      completedAt: row.completed_at as string | null,
    };
  }

  close(): void {
    this.db.close();
  }
}
