import type { GeneratedDocument, DocumentRelation, DocumentManifest } from "../types";

export interface SessionData {
  id: string;
  prompt: string;
  status: "running" | "completed" | "failed";
  documents: GeneratedDocument[];
  relations: DocumentRelation[];
  manifest: DocumentManifest | null;
  createdAt: string;
  completedAt: string | null;
}

export interface SessionStore {
  create(session: SessionData): Promise<void>;
  update(id: string, session: Partial<SessionData>): Promise<void>;
  get(id: string): Promise<SessionData | null>;
  list(limit?: number): Promise<SessionData[]>;
  delete(id: string): Promise<void>;
}
