# DocHarness Enhancement — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform DocHarness from prototype to production-ready with file output, persistent storage, Tailwind UI, and comprehensive testing.

**Architecture:** 4 parallel tracks touching `packages/core` (library) and `packages/web` (Next.js UI). Core changes first for Tracks 1-2, then web UIs fan out. Track 3 (UI) is independent. Track 4 (tests/CLI/config) runs alongside all tracks.

**Tech Stack:** TypeScript 5.8, Next.js 15, React 19, Vercel AI SDK v5, Zod 3.24, Vitest 4.1, Tailwind CSS v4, better-sqlite3

---

## File Structure Map

```
packages/core/src/
├── index.ts                          # [MODIFY] Add export, store, cli, config exports
├── types/index.ts                    # [MODIFY] Add session types, CLI result types
├── export/                           # [NEW] Track 1
│   ├── index.ts
│   ├── markdown-writer.ts
│   └── zip-builder.ts
├── store/                            # [NEW] Track 2
│   ├── index.ts
│   ├── session-store.ts              # SessionStore interface
│   └── sqlite-store.ts               # SQLite implementation
├── config/                           # [NEW] Track 4
│   ├── index.ts
│   └── config-loader.ts
├── cli/                              # [NEW] Track 4
│   ├── index.ts
│   └── cli-runner.ts
├── pipeline/pipeline-orchestrator.ts # [MODIFY] AbortSignal, session saving
├── agents/agent-factory.ts           # [MODIFY] AbortSignal support
└── __tests__/                        # [EXPAND] Track 4
    ├── pipeline.test.ts
    ├── debate.test.ts
    ├── export.test.ts
    ├── store.test.ts
    └── ...

packages/web/
├── package.json                      # [MODIFY] Add tailwind, better-sqlite3 deps
├── postcss.config.mjs                # [NEW] Track 3
├── src/app/globals.css               # [NEW] Track 3 - Tailwind base
├── src/app/page.tsx                  # [MODIFY] Track 3 - Tailwind + nav
├── src/app/session/[id]/page.tsx     # [MODIFY] Tracks 1,2,3 - download, load from store, Tailwind
├── src/app/sessions/page.tsx         # [NEW] Track 2 - session history
├── src/app/api/generate/route.ts     # [MODIFY] Track 2 - save session on complete
├── src/app/api/export/route.ts       # [NEW] Track 1 - ZIP export endpoint
├── src/app/api/sessions/route.ts     # [NEW] Track 2 - list sessions
├── src/app/api/sessions/[id]/route.ts # [NEW] Track 2 - get/delete session
└── src/components/                   # [NEW] Track 3
    ├── error-boundary.tsx
    ├── phase-indicator.tsx
    ├── document-card.tsx
    ├── download-button.tsx
    ├── debate-log.tsx
    └── loading-skeleton.tsx

doc-harness.config.ts                 # [NEW] Track 4 - root config file
README.md                             # [NEW] Track 4
```

---

## TRACK 1: Output & Downloads

### Task 1.1: Core — Markdown Writer

**Files:**
- Create: `packages/core/src/export/markdown-writer.ts`
- Create: `packages/core/src/export/index.ts`

- [ ] **Step 1: Write the markdown writer**

```ts
// packages/core/src/export/markdown-writer.ts
import type { GeneratedDocument } from "../types";

export function documentToMarkdown(doc: GeneratedDocument): string {
  const lines: string[] = [];
  lines.push(`# ${doc.title}`);
  lines.push("");
  lines.push(`> **Type:** ${doc.type} | **Slug:** ${doc.slug}`);
  lines.push("");
  lines.push(doc.content);
  return lines.join("\n");
}
```

- [ ] **Step 2: Write the export barrel**

```ts
// packages/core/src/export/index.ts
export { documentToMarkdown } from "./markdown-writer";
```

- [ ] **Step 3: Verify it compiles**

Run: `pnpm --filter @doc-harness/core typecheck`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
cd /Users/kabo/Desktop/opencode/claude-sdk/doc-harness
git add packages/core/src/export/
git commit -m "feat(core): add markdown writer for document export"
```

---

### Task 1.2: Core — ZIP Builder

**Files:**
- Create: `packages/core/src/export/zip-builder.ts`
- Modify: `packages/core/src/export/index.ts`

- [ ] **Step 1: Write the ZIP builder using Node zlib**

```ts
// packages/core/src/export/zip-builder.ts
import { createGzip } from "node:zlib";
import { pipeline } from "node:stream/promises";
import { createWriteStream, createReadStream } from "node:fs";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { GeneratedDocument } from "../types";
import { documentToMarkdown } from "./markdown-writer";

export async function buildZip(
  documents: GeneratedDocument[],
  outputPath: string
): Promise<void> {
  const tmpDir = await mkdtemp(join(tmpdir(), "doc-harness-"));
  try {
    for (const doc of documents) {
      const md = documentToMarkdown(doc);
      const safeSlug = doc.slug.replace(/[^a-zA-Z0-9_-]/g, "_");
      await writeFile(join(tmpDir, `${safeSlug}.${doc.type}.md`), md, "utf-8");
    }

    const { execSync } = await import("node:child_process");
    execSync(`cd "${tmpDir}" && zip -r "${outputPath}" .`, { stdio: "pipe" });
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }
}

export async function buildZipBuffer(documents: GeneratedDocument[]): Promise<Buffer> {
  const tmpDir = await mkdtemp(join(tmpdir(), "doc-harness-zip-"));
  const outputPath = join(tmpDir, "docs.zip");
  try {
    await buildZip(documents, outputPath);
    const { readFile } = await import("node:fs/promises");
    return await readFile(outputPath);
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }
}
```

- [ ] **Step 2: Update barrel export**

In `packages/core/src/export/index.ts`, replace contents with:
```ts
export { documentToMarkdown } from "./markdown-writer";
export { buildZip, buildZipBuffer } from "./zip-builder";
```

- [ ] **Step 3: Verify compiles**

Run: `pnpm --filter @doc-harness/core typecheck`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
cd /Users/kabo/Desktop/opencode/claude-sdk/doc-harness
git add packages/core/src/export/
git commit -m "feat(core): add ZIP builder for document batch export"
```

---

### Task 1.3: Core — Add export to barrel

**Files:**
- Modify: `packages/core/src/index.ts`

- [ ] **Step 1: Add export export to barrel**

Add after the tools export line in `packages/core/src/index.ts`:
```ts
export * from "./export";
```

- [ ] **Step 2: Verify compiles**

Run: `pnpm --filter @doc-harness/core typecheck`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
cd /Users/kabo/Desktop/opencode/claude-sdk/doc-harness
git add packages/core/src/index.ts
git commit -m "feat(core): export document export utilities from barrel"
```

---

### Task 1.4: Web — Export API Route

**Files:**
- Create: `packages/web/src/app/api/export/route.ts`

- [ ] **Step 1: Write the ZIP export endpoint**

```ts
// packages/web/src/app/api/export/route.ts
import { NextRequest } from "next/server";
import { buildZipBuffer } from "@doc-harness/core";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { documents } = body;

  if (!documents || !Array.isArray(documents)) {
    return new Response(JSON.stringify({ error: "Documents array required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const buffer = await buildZipBuffer(documents);
    return new Response(buffer, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="documents-${Date.now()}.zip"`,
      },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Export failed" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
```

- [ ] **Step 2: Commit**

```bash
cd /Users/kabo/Desktop/opencode/claude-sdk/doc-harness
git add packages/web/src/app/api/export/
git commit -m "feat(web): add ZIP export API endpoint"
```

---

### Task 1.5: Web — Download Buttons in Session Page

**Files:**
- Create: `packages/web/src/components/download-button.tsx`
- Modify: `packages/web/src/app/session/[id]/page.tsx`

- [ ] **Step 1: Write download button component**

```tsx
// packages/web/src/components/download-button.tsx
"use client";

interface DownloadButtonProps {
  content: string;
  filename: string;
}

export function DownloadButton({ content, filename }: DownloadButtonProps) {
  const handleDownload = () => {
    const blob = new Blob([content], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <button
      onClick={handleDownload}
      style={{
        padding: "0.25rem 0.75rem",
        fontSize: "0.8rem",
        borderRadius: 4,
        border: "1px solid #444",
        background: "#1a1a1a",
        color: "#e0e0e0",
        cursor: "pointer",
      }}
    >
      Download .md
    </button>
  );
}
```

- [ ] **Step 2: Add download buttons to result documents**

In `packages/web/src/app/session/[id]/page.tsx`, add import:
```tsx
import { DownloadButton } from "@/components/download-button";
```

Replace the Generated Documents section (the `<details>` block) with version that includes download buttons. Find the `<details key={doc.slug}>` block and change it to:

```tsx
<details key={doc.slug} style={{ padding: "0.75rem", background: "#111", borderRadius: 8, border: "1px solid #333" }}>
  <summary style={{ fontWeight: 600, cursor: "pointer", color: "#e0e0e0", display: "flex", alignItems: "center", gap: "0.5rem" }}>
    <span>{doc.title} <span style={{ color: "#888", fontSize: "0.8rem" }}>({doc.type})</span></span>
    <DownloadButton content={doc.content} filename={`${doc.slug}.${doc.type}.md`} />
  </summary>
  <pre style={{ marginTop: "0.75rem", whiteSpace: "pre-wrap", fontSize: "0.8rem", lineHeight: 1.5, color: "#aaa", maxHeight: 400, overflowY: "auto" }}>
    {doc.content}
  </pre>
</details>
```

- [ ] **Step 3: Add "Download All as ZIP" button**

Add at the top of the result documents section (before the map), add:

```tsx
{resultDocuments.length > 0 && (
  <button
    onClick={async () => {
      try {
        const res = await fetch("/api/export", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ documents: resultDocuments }),
        });
        if (!res.ok) throw new Error("Export failed");
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "documents.zip";
        a.click();
        URL.revokeObjectURL(url);
      } catch (err) {
        console.error("Download failed:", err);
      }
    }}
    style={{
      padding: "0.5rem 1rem",
      fontSize: "0.9rem",
      fontWeight: 600,
      borderRadius: 6,
      border: "none",
      background: "#7c3aed",
      color: "#fff",
      cursor: "pointer",
      marginBottom: "1rem",
    }}
  >
    Download All as ZIP ({resultDocuments.length} docs)
  </button>
)}
```

- [ ] **Step 4: Verify compiles**

Run: `pnpm --filter @doc-harness/web typecheck`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
cd /Users/kabo/Desktop/opencode/claude-sdk/doc-harness
git add packages/web/src/components/download-button.tsx packages/web/src/app/session/
git commit -m "feat(web): add download buttons and ZIP export to session page"
```

---

## TRACK 2: Persistent Storage

### Task 2.1: Core — Session Store Interface

**Files:**
- Create: `packages/core/src/store/session-store.ts`
- Create: `packages/core/src/store/index.ts`

- [ ] **Step 1: Write types and interface**

```ts
// packages/core/src/store/session-store.ts
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
```

- [ ] **Step 2: Write barrel**

```ts
// packages/core/src/store/index.ts
export type { SessionData, SessionStore } from "./session-store";
```

- [ ] **Step 3: Commit**

```bash
cd /Users/kabo/Desktop/opencode/claude-sdk/doc-harness
git add packages/core/src/store/
git commit -m "feat(core): add SessionStore interface for persistent storage"
```

---

### Task 2.2: Core — SQLite Store Implementation

**Files:**
- Create: `packages/core/src/store/sqlite-store.ts`
- Modify: `packages/core/src/store/index.ts`
- Modify: `packages/core/package.json`

- [ ] **Step 1: Install better-sqlite3**

```bash
cd /Users/kabo/Desktop/opencode/claude-sdk/doc-harness
pnpm --filter @doc-harness/core add better-sqlite3
pnpm --filter @doc-harness/core add -D @types/better-sqlite3
```

- [ ] **Step 2: Write SQLite implementation**

```ts
// packages/core/src/store/sqlite-store.ts
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
```

- [ ] **Step 3: Update barrel**

In `packages/core/src/store/index.ts`, replace with:
```ts
export type { SessionData, SessionStore } from "./session-store";
export { SQLiteStore } from "./sqlite-store";
```

- [ ] **Step 4: Verify compiles**

Run: `pnpm --filter @doc-harness/core typecheck`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
cd /Users/kabo/Desktop/opencode/claude-sdk/doc-harness
git add packages/core/src/store/ packages/core/package.json pnpm-lock.yaml
git commit -m "feat(core): add SQLite session store implementation"
```

---

### Task 2.3: Core — Add store to barrel exports

**Files:**
- Modify: `packages/core/src/index.ts`

- [ ] **Step 1: Add store export**

Add after the tools export:
```ts
export * from "./store";
```

- [ ] **Step 2: Commit**

```bash
cd /Users/kabo/Desktop/opencode/claude-sdk/doc-harness
git add packages/core/src/index.ts
git commit -m "feat(core): export session store from barrel"
```

---

### Task 2.4: Web — Session API Routes

**Files:**
- Create: `packages/web/src/app/api/sessions/route.ts`
- Create: `packages/web/src/app/api/sessions/[id]/route.ts`

- [ ] **Step 1: Write list sessions route**

```ts
// packages/web/src/app/api/sessions/route.ts
import { NextRequest } from "next/server";
import { SQLiteStore } from "@doc-harness/core";

const store = new SQLiteStore();

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const limit = parseInt(searchParams.get("limit") ?? "20", 10);
  const sessions = await store.list(limit);
  return Response.json(sessions);
}
```

- [ ] **Step 2: Write get/delete session route**

```ts
// packages/web/src/app/api/sessions/[id]/route.ts
import { NextRequest } from "next/server";
import { SQLiteStore } from "@doc-harness/core";

const store = new SQLiteStore();

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await store.get(id);
  if (!session) {
    return new Response(JSON.stringify({ error: "Session not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }
  return Response.json(session);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await store.delete(id);
  return Response.json({ ok: true });
}
```

- [ ] **Step 3: Verify compiles**

Run: `pnpm --filter @doc-harness/web typecheck`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
cd /Users/kabo/Desktop/opencode/claude-sdk/doc-harness
git add packages/web/src/app/api/sessions/
git commit -m "feat(web): add session CRUD API routes"
```

---

### Task 2.5: Web — Save Sessions from Pipeline

**Files:**
- Modify: `packages/web/src/app/api/generate/route.ts`

- [ ] **Step 1: Save session on pipeline completion**

Add import at top of `packages/web/src/app/api/generate/route.ts`:
```ts
import { SQLiteStore } from "@doc-harness/core";
```

Replace the `start` callback in the ReadableStream to capture the result:

```ts
const store = new SQLiteStore();
const sessionId = `session-${Date.now()}`;

const stream = new ReadableStream({
  async start(controller) {
    let finalResult: Awaited<ReturnType<typeof runPipeline>> | null = null;

    const emit = (event: PipelineEvent) => {
      if (isClosed) return;
      try {
        if (event.phase === "result") {
          finalResult = event.result;
        }
        const data = encoder.encode(`data: ${JSON.stringify(event)}\n\n`);
        controller.enqueue(data);
      } catch {
        isClosed = true;
      }
    };

    try {
      await store.create({
        id: sessionId,
        prompt,
        status: "running",
        documents: [],
        relations: [],
        manifest: null,
        createdAt: new Date().toISOString(),
        completedAt: null,
      });

      const result = await runPipeline(prompt, emit);

      if (finalResult || result) {
        const docs = finalResult?.documents ?? result.documents;
        const relations = finalResult?.relations ?? result.relations;
        const manifest = finalResult?.manifest ?? result.manifest;
        await store.update(sessionId, {
          status: "completed",
          documents: docs,
          relations: relations,
          manifest: manifest,
          completedAt: new Date().toISOString(),
        });
      }
    } catch (err) {
      await store.update(sessionId, { status: "failed" }).catch(() => {});
      if (!isClosed) {
        emit({
          phase: "error",
          message: err instanceof Error ? err.message : "Pipeline failed",
        });
      }
    } finally {
      if (!isClosed) {
        try { controller.close(); } catch {}
      }
    }
  },
  cancel() {
    isClosed = true;
  },
});
```

Return the session ID in the response headers:
```ts
return new Response(stream, {
  headers: {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
    "X-Session-Id": sessionId,
  },
});
```

- [ ] **Step 2: Verify compiles**

Run: `pnpm --filter @doc-harness/web typecheck`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
cd /Users/kabo/Desktop/opencode/claude-sdk/doc-harness
git add packages/web/src/app/api/generate/route.ts
git commit -m "feat(web): save sessions to SQLite on pipeline completion"
```

---

### Task 2.6: Web — Session History Page

**Files:**
- Create: `packages/web/src/app/sessions/page.tsx`

- [ ] **Step 1: Write session history page**

```tsx
// packages/web/src/app/sessions/page.tsx
import Link from "next/link";

interface SessionSummary {
  id: string;
  prompt: string;
  status: string;
  documents: unknown[];
  createdAt: string;
}

async function getSessions(): Promise<SessionSummary[]> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
    const res = await fetch(`${baseUrl}/api/sessions`, { cache: "no-store" });
    return await res.json();
  } catch {
    return [];
  }
}

export default async function SessionsPage() {
  const sessions = await getSessions();

  return (
    <main style={{ maxWidth: 900, margin: "0 auto", padding: "2rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
        <h1 style={{ fontSize: "1.5rem" }}>Session History</h1>
        <Link href="/" style={{ color: "#7c3aed", textDecoration: "none", fontSize: "0.9rem" }}>
          + New Generation
        </Link>
      </div>

      {sessions.length === 0 ? (
        <div style={{ color: "#666", textAlign: "center", padding: "4rem 0" }}>
          No sessions yet. <Link href="/" style={{ color: "#7c3aed" }}>Generate your first docs</Link>.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {sessions.map((s) => (
            <Link
              key={s.id}
              href={`/session/${s.id}?prompt=${encodeURIComponent(s.prompt)}`}
              style={{
                padding: "1rem",
                background: "#1a1a1a",
                borderRadius: 8,
                border: "1px solid #333",
                textDecoration: "none",
                color: "#e0e0e0",
                display: "block",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontWeight: 600, marginBottom: "0.25rem" }}>
                    {s.prompt.slice(0, 80)}{s.prompt.length > 80 ? "..." : ""}
                  </div>
                  <div style={{ fontSize: "0.8rem", color: "#888" }}>
                    {s.documents.length} docs · {new Date(s.createdAt).toLocaleDateString()}
                  </div>
                </div>
                <span style={{
                  padding: "0.2rem 0.5rem",
                  borderRadius: 4,
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  background: s.status === "completed" ? "#14532d" : s.status === "failed" ? "#450a0a" : "#422006",
                  color: s.status === "completed" ? "#22c55e" : s.status === "failed" ? "#ef4444" : "#eab308",
                }}>
                  {s.status}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
```

- [ ] **Step 2: Commit**

```bash
cd /Users/kabo/Desktop/opencode/claude-sdk/doc-harness
git add packages/web/src/app/sessions/
git commit -m "feat(web): add session history page"
```

---

### Task 2.7: Web — Load Session from Store

**Files:**
- Modify: `packages/web/src/app/session/[id]/page.tsx`
- Modify: `packages/web/src/app/page.tsx`

- [ ] **Step 1: Add session ID to generate route and redirect**

In `packages/web/src/app/page.tsx`, modify `handleGenerate`:
```tsx
const handleGenerate = useCallback(async () => {
  if (!prompt.trim()) return;
  setGenerating(true);

  const res = await fetch("/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt }),
  });

  if (res.ok) {
    const sessionId = res.headers.get("X-Session-Id");
    if (sessionId) {
      router.push(`/session/${sessionId}`);
    } else {
      const sessionId = `session-${Date.now()}`;
      router.push(`/session/${sessionId}?prompt=${encodeURIComponent(prompt)}`);
    }
  }
  setGenerating(false);
}, [prompt, router]);
```

- [ ] **Step 2: Load existing session data on session page mount**

In `packages/web/src/app/session/[id]/page.tsx`, add a `useEffect` that fetches the session from the API on mount if there's no `prompt` param:

```tsx
import { useParams } from "next/navigation";

// Inside SessionContent, add:
const sessionId = useParams().id as string;

useEffect(() => {
  if (prompt === "No prompt provided") {
    fetch(`/api/sessions/${sessionId}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.documents) {
          setResultDocuments(data.documents);
          setPhaseStatus({
            intake: "completed",
            discovery: "completed",
            generation: "completed",
            debate: "completed",
            review: "completed",
            assembly: "completed",
          });
        }
      })
      .catch(() => {});
  }
}, [sessionId, prompt]);
```

- [ ] **Step 3: Verify compiles**

Run: `pnpm --filter @doc-harness/web typecheck`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
cd /Users/kabo/Desktop/opencode/claude-sdk/doc-harness
git add packages/web/src/app/page.tsx packages/web/src/app/session/
git commit -m "feat(web): load sessions from store on page mount"
```

---

## TRACK 3: Web UI Polish

### Task 3.1: Web — Install Tailwind CSS v4

**Files:**
- Modify: `packages/web/package.json`
- Create: `packages/web/postcss.config.mjs`
- Create: `packages/web/src/app/globals.css`
- Modify: `packages/web/src/app/layout.tsx`

- [ ] **Step 1: Install Tailwind v4**

```bash
cd /Users/kabo/Desktop/opencode/claude-sdk/doc-harness
pnpm --filter @doc-harness/web add @tailwindcss/postcss tailwindcss
```

- [ ] **Step 2: Create PostCSS config**

```js
// packages/web/postcss.config.mjs
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};

export default config;
```

- [ ] **Step 3: Create globals.css**

```css
/* packages/web/src/app/globals.css */
@import "tailwindcss";

@theme {
  --color-bg: #0a0a0a;
  --color-surface: #1a1a1a;
  --color-border: #333333;
  --color-text: #e0e0e0;
  --color-text-muted: #888888;
  --color-primary: #7c3aed;
  --color-success: #22c55e;
  --color-warning: #eab308;
  --color-error: #ef4444;
}

body {
  background: var(--color-bg);
  color: var(--color-text);
  font-family: system-ui, -apple-system, sans-serif;
}
```

- [ ] **Step 4: Import globals.css in layout**

```tsx
// packages/web/src/app/layout.tsx
import "./globals.css";

// ... rest of layout stays the same
```

Make sure the layout file exists. If `layout.tsx` doesn't exist yet, create it:

```tsx
// packages/web/src/app/layout.tsx
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DocHarness — AI Documentation Generator",
  description: "Generate comprehensive software documentation from a single prompt",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-bg text-text">{children}</body>
    </html>
  );
}
```

- [ ] **Step 5: Verify build**

Run: `pnpm --filter @doc-harness/web dev` (quick start/stop to check no errors)
Then stop it.

- [ ] **Step 6: Commit**

```bash
cd /Users/kabo/Desktop/opencode/claude-sdk/doc-harness
git add packages/web/package.json packages/web/postcss.config.mjs packages/web/src/app/globals.css packages/web/src/app/layout.tsx pnpm-lock.yaml
git commit -m "feat(web): add Tailwind CSS v4 with dark theme"
```

---

### Task 3.2: Web — Convert Home Page to Tailwind

**Files:**
- Modify: `packages/web/src/app/page.tsx`

- [ ] **Step 1: Rewrite with Tailwind classes**

Replace `packages/web/src/app/page.tsx` with:

```tsx
"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function HomePage() {
  const router = useRouter();
  const [prompt, setPrompt] = useState("");
  const [generating, setGenerating] = useState(false);

  const handleGenerate = useCallback(async () => {
    if (!prompt.trim()) return;
    setGenerating(true);
    const sessionId = `session-${Date.now()}`;
    router.push(`/session/${sessionId}?prompt=${encodeURIComponent(prompt)}`);
  }, [prompt, router]);

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-8">
      <nav className="absolute top-0 left-0 right-0 p-4 flex justify-between items-center max-w-4xl mx-auto">
        <h1 className="text-xl font-bold text-primary">DocHarness</h1>
        <Link href="/sessions" className="text-sm text-text-muted hover:text-text transition-colors">
          History
        </Link>
      </nav>

      <h1 className="text-4xl font-extrabold mb-2">DocHarness</h1>
      <p className="text-text-muted mb-8 max-w-xl text-center leading-relaxed">
        Generate comprehensive software documentation from a single prompt.
        Powered by 25 AI agents, 3-round adversarial debate, and 6-phase pipeline.
      </p>

      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder={`Describe what you want documented...\n\nExample: Build a real-time chat application with WebSocket support, user authentication, and message persistence.`}
        rows={6}
        className="w-full max-w-2xl p-4 text-base rounded-lg border border-border bg-surface text-text resize-y font-sans focus:outline-none focus:border-primary transition-colors"
      />

      <button
        onClick={handleGenerate}
        disabled={generating || !prompt.trim()}
        className={`mt-4 px-8 py-3 text-base font-semibold rounded-lg border-none transition-all ${
          prompt.trim()
            ? "bg-primary text-white cursor-pointer hover:opacity-90"
            : "bg-surface text-text-muted cursor-not-allowed"
        }`}
      >
        {generating ? "Generating..." : "Generate Documentation"}
      </button>

      <div className="mt-12 flex gap-8 text-text-muted text-sm">
        <div><strong>18</strong> document types</div>
        <div><strong>25</strong> AI agents</div>
        <div><strong>3-round</strong> debate</div>
        <div><strong>6-phase</strong> pipeline</div>
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Commit**

```bash
cd /Users/kabo/Desktop/opencode/claude-sdk/doc-harness
git add packages/web/src/app/page.tsx
git commit -m "feat(web): convert home page to Tailwind CSS"
```

---

### Task 3.3: Web — Convert Session Page to Tailwind

**Files:**
- Modify: `packages/web/src/app/session/[id]/page.tsx`

- [ ] **Step 1: Rewrite with Tailwind classes**

Replace `packages/web/src/app/session/[id]/page.tsx` with a Tailwind-rewritten version. The key changes:
- Replace all inline `style={{}}` with Tailwind classes
- Add the navigation bar
- Keep all the existing SSE streaming logic intact
- Add `DownloadButton` import and usage

Here's the full rewritten file:

```tsx
"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useSearchParams, useParams } from "next/navigation";
import Link from "next/link";
import type { PipelineEvent, DocTarget, DebateVerdict, GeneratedDocument } from "@doc-harness/core";

type PhaseStatus = "pending" | "running" | "completed";

function SessionContent() {
  const params = useSearchParams();
  const { id: sessionId } = useParams<{ id: string }>();
  const prompt = params.get("prompt") ?? "No prompt provided";

  const [phaseStatus, setPhaseStatus] = useState<Record<string, PhaseStatus>>({
    intake: "pending", discovery: "pending", generation: "pending",
    debate: "pending", review: "pending", assembly: "pending",
  });
  const [docs, setDocs] = useState<DocTarget[]>([]);
  const [generationProgress, setGenerationProgress] = useState({ completed: 0, total: 0 });
  const [debateEvents, setDebateEvents] = useState<{ slug: string; round: number; role: string; argument: string }[]>([]);
  const [verdicts, setVerdicts] = useState<Record<string, DebateVerdict>>({});
  const [resultDocuments, setResultDocuments] = useState<GeneratedDocument[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (prompt === "No prompt provided") {
      fetch(`/api/sessions/${sessionId}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.documents && data.documents.length > 0) {
            setResultDocuments(data.documents);
            setPhaseStatus({
              intake: "completed", discovery: "completed", generation: "completed",
              debate: "completed", review: "completed", assembly: "completed",
            });
          }
        })
        .catch(() => {})
        .finally(() => setIsLoading(false));
      return;
    }
    setIsLoading(false);

    const controller = new AbortController();

    fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt }),
      signal: controller.signal,
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const reader = res.body?.getReader();
        if (!reader) throw new Error("No stream reader");

        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            if (line.startsWith("data: ")) {
              try {
                const event: PipelineEvent = JSON.parse(line.slice(6));
                handleEvent(event);
              } catch {}
            }
          }
        }
      })
      .catch((err) => {
        if (err.name !== "AbortError") setError(err.message);
      });

    return () => controller.abort();
  }, [prompt, sessionId]);

  const handleEvent = useCallback((event: PipelineEvent) => {
    switch (event.phase) {
      case "intake":
        setPhaseStatus((prev) => ({ ...prev, intake: "running" }));
        if (event.docs.length > 0) setDocs(event.docs);
        break;
      case "discovery":
        setPhaseStatus((prev) => ({ ...prev, intake: "completed", discovery: "running" }));
        break;
      case "generation":
        setPhaseStatus((prev) => ({ ...prev, discovery: "completed", generation: "running" }));
        setGenerationProgress({ completed: event.completed, total: event.total });
        break;
      case "debate":
        setPhaseStatus((prev) => ({ ...prev, generation: "completed", debate: "running" }));
        setDebateEvents((prev) => [...prev, { slug: event.slug, round: event.round, role: event.role, argument: event.argument }]);
        break;
      case "debate-verdict":
        setVerdicts((prev) => ({ ...prev, [event.slug]: event.verdict }));
        break;
      case "review":
        setPhaseStatus((prev) => ({ ...prev, debate: "completed", review: "running" }));
        break;
      case "assembly":
        setPhaseStatus((prev) => ({ ...prev, review: "completed", assembly: "running" }));
        break;
      case "complete":
        setPhaseStatus((prev) => ({ ...prev, assembly: "completed" }));
        break;
      case "result":
        setResultDocuments(event.result.documents);
        break;
      case "error":
        setError(event.message);
        break;
    }
  }, []);

  const handleDownloadAll = async () => {
    try {
      const res = await fetch("/api/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documents: resultDocuments }),
      });
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `documents-${sessionId}.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Download failed:", err);
    }
  };

  const handleDownloadSingle = (doc: GeneratedDocument) => {
    const blob = new Blob([doc.content], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${doc.slug}.${doc.type}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <main className="max-w-3xl mx-auto p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-surface rounded w-48" />
          <div className="h-4 bg-surface rounded w-96" />
          <div className="h-32 bg-surface rounded" />
        </div>
      </main>
    );
  }

  return (
    <main className="max-w-3xl mx-auto p-8">
      <nav className="flex justify-between items-center mb-6">
        <Link href="/" className="text-primary font-bold hover:opacity-80">DocHarness</Link>
        <Link href="/sessions" className="text-sm text-text-muted hover:text-text">History</Link>
      </nav>

      <h1 className="text-xl font-bold mb-1">Pipeline Status</h1>
      <p className="text-text-muted mb-6 text-sm truncate">{prompt}</p>

      {error && (
        <div className="p-4 bg-red-950 rounded-lg mb-4 border border-red-800 flex justify-between items-center">
          <span className="text-sm">{error}</span>
          <button
            onClick={() => window.location.reload()}
            className="px-3 py-1 text-xs bg-red-900 rounded hover:bg-red-800 transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {/* Phase progress */}
      <div className="flex flex-col gap-2 mb-8">
        {(["intake", "discovery", "generation", "debate", "review", "assembly"] as const).map((phase) => (
          <div key={phase} className="flex items-center gap-3 py-2 border-b border-surface">
            <span className={`
              text-lg
              ${phaseStatus[phase] === "completed" ? "text-success" : ""}
              ${phaseStatus[phase] === "running" ? "text-primary" : ""}
              ${phaseStatus[phase] === "pending" ? "text-text-muted" : ""}
            `}>
              {phaseStatus[phase] === "completed" ? "✓" : phaseStatus[phase] === "running" ? "◉" : "○"}
            </span>
            <span className={`flex-1 ${phaseStatus[phase] === "pending" ? "text-text-muted" : "text-text"}`}>
              {{
                intake: "Phase 0: Intake & Classification",
                discovery: "Phase 1: Discovery & Knowledge Generation",
                generation: "Phase 2: Parallel Document Generation",
                debate: "Phase 3: Debate & Refinement (3 rounds)",
                review: "Phase 4: Review & Quality Gate",
                assembly: "Phase 5: Output Assembly",
              }[phase]}
            </span>
            {phase === "generation" && generationProgress.total > 0 && (
              <span className="text-xs text-text-muted">{generationProgress.completed}/{generationProgress.total}</span>
            )}
          </div>
        ))}
      </div>

      {/* Document cards */}
      {docs.length > 0 && (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(250px,1fr))] gap-3 mb-8">
          {docs.map((doc) => {
            const verdict = verdicts[doc.slug];
            const borderColor = verdict
              ? verdict.verdict === "approve" ? "border-success" : verdict.verdict === "revise" ? "border-warning" : "border-error"
              : "border-border";
            return (
              <div key={doc.slug} className={`p-3 bg-surface rounded-lg border ${borderColor}`}>
                <div className="text-xs text-text-muted uppercase mb-1">{doc.type} · {doc.track}</div>
                <div className="font-semibold mb-1">{doc.title}</div>
                <div className="text-xs text-text-muted">{doc.slug}.{doc.type}.md</div>
                {verdict && (
                  <div className={`mt-2 px-2 py-1 rounded text-xs font-semibold uppercase inline-block ${
                    verdict.verdict === "approve" ? "bg-green-950 text-success"
                    : verdict.verdict === "revise" ? "bg-yellow-950 text-warning"
                    : "bg-red-950 text-error"
                  }`}>
                    {verdict.verdict}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Debate activity */}
      {debateEvents.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold mb-3">Debate Activity</h2>
          <div className="text-sm space-y-2">
            {debateEvents.map((e, i) => (
              <div key={i} className="p-3 bg-surface rounded-lg">
                <div className={`font-semibold mb-1 ${e.role === "advocate" ? "text-success" : "text-error"}`}>
                  [{e.slug}] Round {e.round} — {e.role}
                </div>
                <div className="text-xs text-text-muted leading-relaxed max-h-32 overflow-y-auto">
                  {e.argument.slice(0, 400)}{e.argument.length > 400 ? "..." : ""}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Result documents */}
      {resultDocuments.length > 0 && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold">Generated Documents</h2>
            <button
              onClick={handleDownloadAll}
              className="px-4 py-2 text-sm font-semibold rounded-lg bg-primary text-white hover:opacity-90 transition-opacity"
            >
              Download All ({resultDocuments.length})
            </button>
          </div>
          <div className="space-y-3">
            {resultDocuments.map((doc) => (
              <details key={doc.slug} className="p-4 bg-surface rounded-lg border border-border group">
                <summary className="font-semibold cursor-pointer text-text flex items-center gap-2">
                  <span>{doc.title} <span className="text-text-muted text-sm">({doc.type})</span></span>
                  <button
                    onClick={(e) => { e.preventDefault(); handleDownloadSingle(doc); }}
                    className="ml-auto px-2 py-1 text-xs rounded border border-border bg-bg text-text-muted hover:text-text hover:border-primary transition-colors"
                  >
                    Download .md
                  </button>
                </summary>
                <pre className="mt-3 whitespace-pre-wrap text-sm text-text-muted leading-relaxed max-h-96 overflow-y-auto">
                  {doc.content}
                </pre>
              </details>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}

export default function SessionPage() {
  return (
    <Suspense fallback={
      <div className="max-w-3xl mx-auto p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-surface rounded w-48" />
          <div className="h-4 bg-surface rounded w-96" />
        </div>
      </div>
    }>
      <SessionContent />
    </Suspense>
  );
}
```

- [ ] **Step 2: Verify compiles**

Run: `pnpm --filter @doc-harness/web typecheck`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
cd /Users/kabo/Desktop/opencode/claude-sdk/doc-harness
git add packages/web/src/app/session/
git commit -m "feat(web): convert session page to Tailwind with download, retry, loading"
```

---

### Task 3.4: Web — Convert Sessions Page to Tailwind

**Files:**
- Modify: `packages/web/src/app/sessions/page.tsx`

- [ ] **Step 1: Rewrite with Tailwind**

Replace the file with:

```tsx
import Link from "next/link";

interface SessionSummary {
  id: string;
  prompt: string;
  status: string;
  documents: unknown[];
  createdAt: string;
}

async function getSessions(): Promise<SessionSummary[]> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
    const res = await fetch(`${baseUrl}/api/sessions`, { cache: "no-store" });
    return await res.json();
  } catch {
    return [];
  }
}

export default async function SessionsPage() {
  const sessions = await getSessions();

  return (
    <main className="max-w-3xl mx-auto p-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-xl font-bold">Session History</h1>
        <Link href="/" className="text-primary hover:opacity-80 text-sm font-medium">
          + New Generation
        </Link>
      </div>

      {sessions.length === 0 ? (
        <div className="text-text-muted text-center py-16">
          No sessions yet.{" "}
          <Link href="/" className="text-primary hover:opacity-80">Generate your first docs</Link>.
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {sessions.map((s) => (
            <Link
              key={s.id}
              href={`/session/${s.id}?prompt=${encodeURIComponent(s.prompt)}`}
              className="p-4 bg-surface rounded-lg border border-border block no-underline text-text hover:border-primary transition-colors"
            >
              <div className="flex justify-between items-center">
                <div>
                  <div className="font-semibold mb-1 leading-snug">
                    {s.prompt.slice(0, 80)}{s.prompt.length > 80 ? "..." : ""}
                  </div>
                  <div className="text-xs text-text-muted">
                    {s.documents.length} docs · {new Date(s.createdAt).toLocaleDateString()}
                  </div>
                </div>
                <span className={`px-2 py-1 rounded text-xs font-semibold ${
                  s.status === "completed" ? "bg-green-950 text-success"
                  : s.status === "failed" ? "bg-red-950 text-error"
                  : "bg-yellow-950 text-warning"
                }`}>
                  {s.status}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
```

- [ ] **Step 2: Commit**

```bash
cd /Users/kabo/Desktop/opencode/claude-sdk/doc-harness
git add packages/web/src/app/sessions/page.tsx
git commit -m "feat(web): convert sessions page to Tailwind"
```

---

### Task 3.5: Web — Add Error Boundary Component

**Files:**
- Create: `packages/web/src/components/error-boundary.tsx`
- Modify: `packages/web/src/app/layout.tsx`

- [ ] **Step 1: Write error boundary**

```tsx
// packages/web/src/components/error-boundary.tsx
"use client";

import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="min-h-screen flex items-center justify-center p-8">
          <div className="max-w-md text-center">
            <h2 className="text-xl font-bold mb-2">Something went wrong</h2>
            <p className="text-text-muted mb-4 text-sm">{this.state.error?.message}</p>
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.reload();
              }}
              className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-semibold hover:opacity-90"
            >
              Try Again
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
```

- [ ] **Step 2: Wrap layout children in error boundary**

Modify `packages/web/src/app/layout.tsx`:

```tsx
import type { Metadata } from "next";
import { ErrorBoundary } from "@/components/error-boundary";
import "./globals.css";

export const metadata: Metadata = {
  title: "DocHarness — AI Documentation Generator",
  description: "Generate comprehensive software documentation from a single prompt",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-bg text-text">
        <ErrorBoundary>{children}</ErrorBoundary>
      </body>
    </html>
  );
}
```

- [ ] **Step 3: Commit**

```bash
cd /Users/kabo/Desktop/opencode/claude-sdk/doc-harness
git add packages/web/src/components/error-boundary.tsx packages/web/src/app/layout.tsx
git commit -m "feat(web): add error boundary component"
```

---

## TRACK 4: Production Hardening

### Task 4.1: Core — Tests for Document Scorers

**Files:**
- Modify: `packages/core/src/__tests__/document-scorers.test.ts`

- [ ] **Step 1: Verify existing tests pass**

Run: `pnpm --filter @doc-harness/core test`

Check current test files exist at:
- `packages/core/src/__tests__/document-scorers.test.ts`
- `packages/core/src/__tests__/relation-mapper.test.ts`
- `packages/core/src/__tests__/extract-sections.test.ts`

- [ ] **Step 2: Commit foundation**

```bash
cd /Users/kabo/Desktop/opencode/claude-sdk/doc-harness
git add packages/core/src/__tests__/ 2>/dev/null
git commit -m "test(core): verify existing tests pass" 2>/dev/null || echo "No test changes yet"
```

Note: If no test files exist, skip this and move to Task 4.2.

---

### Task 4.2: Core — Tests for Pipeline Orchestrator

**Files:**
- Create: `packages/core/src/__tests__/pipeline.test.ts`

- [ ] **Step 1: Write pipeline orchestrator tests**

```ts
// packages/core/src/__tests__/pipeline.test.ts
import { describe, it, expect, vi } from "vitest";
import { runPipeline, mapRelations } from "../pipeline/pipeline-orchestrator";
import type { GeneratedDocument, PipelineEvent } from "../types";

describe("runPipeline", () => {
  it("returns error event when intake agent fails", async () => {
    const events: PipelineEvent[] = [];
    const emit = (event: PipelineEvent) => events.push(event);

    const result = await runPipeline("test prompt", emit);

    expect(events.length).toBeGreaterThan(0);
    expect(events.some((e) => e.phase === "intake")).toBe(true);
  }, 30000);

  it("emits intake event with document targets", async () => {
    const events: PipelineEvent[] = [];
    const emit = (event: PipelineEvent) => events.push(event);

    await runPipeline("Build a chat application", emit);

    const intakeEvents = events.filter((e) => e.phase === "intake" && e.docs.length > 0);
    expect(intakeEvents.length).toBe(1);
    expect(intakeEvents[0].docs.length).toBeGreaterThan(0);
  }, 60000);

  it("returns result with documents and relations", async () => {
    const events: PipelineEvent[] = [];
    const emit = (event: PipelineEvent) => events.push(event);

    const result = await runPipeline("Document a REST API", emit);

    expect(result.documents).toBeDefined();
    expect(result.relations).toBeDefined();
    expect(result.manifest).toBeDefined();
  }, 120000);
});

describe("mapRelations", () => {
  it("creates relations between documents based on registry", () => {
    const docs: GeneratedDocument[] = [
      {
        slug: "test-prd",
        type: "prd",
        title: "PRD",
        content: "# PRD\n\nContent",
        sections: [{ heading: "Overview", body: "Content here" }],
      },
      {
        slug: "test-plan",
        type: "plan",
        title: "Plan",
        content: "# Plan\n\nContent",
        sections: [{ heading: "Overview", body: "Content here" }],
      },
    ];

    const relations = mapRelations(docs);
    expect(relations.length).toBeGreaterThan(0);
    expect(relations.some((r) => r.source === "test-prd" && r.target === "test-plan")).toBe(true);
  });

  it("returns empty array for single document", () => {
    const docs: GeneratedDocument[] = [
      {
        slug: "solo",
        type: "doc",
        title: "Solo Doc",
        content: "# Doc\n\nContent",
        sections: [{ heading: "Overview", body: "Content" }],
      },
    ];

    const relations = mapRelations(docs);
    expect(relations).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests**

```bash
cd /Users/kabo/Desktop/opencode/claude-sdk/doc-harness
pnpm --filter @doc-harness/core test
```
Expected: All tests pass (some may be skipped if no ANTHROPIC_API_KEY set — those are integration-level)

- [ ] **Step 3: Commit**

```bash
cd /Users/kabo/Desktop/opencode/claude-sdk/doc-harness
git add packages/core/src/__tests__/pipeline.test.ts
git commit -m "test(core): add pipeline orchestrator tests"
```

---

### Task 4.3: Core — Tests for Export

**Files:**
- Create: `packages/core/src/__tests__/export.test.ts`

- [ ] **Step 1: Write export tests**

```ts
// packages/core/src/__tests__/export.test.ts
import { describe, it, expect } from "vitest";
import { documentToMarkdown } from "../export/markdown-writer";
import type { GeneratedDocument } from "../types";

describe("documentToMarkdown", () => {
  it("produces markdown with title and content", () => {
    const doc: GeneratedDocument = {
      slug: "test-doc",
      type: "prd",
      title: "Test Document",
      content: "## Section 1\n\nHello world",
      sections: [{ heading: "Section 1", body: "Hello world" }],
    };

    const result = documentToMarkdown(doc);
    expect(result).toContain("# Test Document");
    expect(result).toContain("**Type:** prd");
    expect(result).toContain("## Section 1");
  });

  it("includes slug in metadata line", () => {
    const doc: GeneratedDocument = {
      slug: "my-slug",
      type: "adr",
      title: "ADR",
      content: "content",
      sections: [],
    };

    const result = documentToMarkdown(doc);
    expect(result).toContain("**Slug:** my-slug");
  });
});
```

- [ ] **Step 2: Run tests**

Run: `pnpm --filter @doc-harness/core test`
Expected: Export tests pass

- [ ] **Step 3: Commit**

```bash
cd /Users/kabo/Desktop/opencode/claude-sdk/doc-harness
git add packages/core/src/__tests__/export.test.ts
git commit -m "test(core): add export module tests"
```

---

### Task 4.4: Core — Pipeline Cancellation (AbortSignal)

**Files:**
- Modify: `packages/core/src/pipeline/pipeline-orchestrator.ts`
- Modify: `packages/core/src/agents/agent-factory.ts`

- [ ] **Step 1: Add AbortSignal to agent factory**

In `packages/core/src/agents/agent-factory.ts`, add an optional `signal` parameter:

```ts
export function createAgent(config: AgentConfig) {
  const {
    model = getModel(),
    system,
    tools = {},
    maxSteps = 5,
    retry = { maxAttempts: 3, baseDelayMs: 1000, maxDelayMs: 10000 },
  } = config;

  return {
    generate: async (prompt: string, signal?: AbortSignal): Promise<AgentGenerateResult> => {
      let lastError: Error | null = null;

      for (let attempt = 1; attempt <= retry.maxAttempts!; attempt++) {
        if (signal?.aborted) {
          throw new Error("Operation cancelled");
        }
        try {
          const result = await generateText({
            model,
            system,
            prompt,
            tools,
            stopWhen: stepCountIs(maxSteps),
            abortSignal: signal,
          });

          return {
            text: result.text,
            usage: result.usage,
          };
        } catch (err) {
          if (signal?.aborted) throw new Error("Operation cancelled");
          lastError = err instanceof Error ? err : new Error(String(err));

          if (attempt < retry.maxAttempts!) {
            const delay = Math.min(
              retry.baseDelayMs! * Math.pow(2, attempt - 1),
              retry.maxDelayMs!
            );
            await sleep(delay);
          }
        }
      }

      throw lastError ?? new Error("Agent generation failed after all retries");
    },
  };
}
```

- [ ] **Step 2: Add signal to runPipeline**

In `packages/core/src/pipeline/pipeline-orchestrator.ts`, add `signal` parameter:

```ts
export async function runPipeline(
  userPrompt: string,
  emit: PipelineEmitter,
  signal?: AbortSignal
): Promise<PipelineResult> {
```

Add checks at each phase boundary:
```ts
if (signal?.aborted) throw new Error("Pipeline cancelled");
```

Insert this check:
- Before intake agent call
- Before discovery agent call
- Before the generate loop
- Before debate loop

- [ ] **Step 3: Pass signal to generate calls**

Update the `generateDocument` function to accept and pass signal:
```ts
async function generateDocument(
  agent: Agent,
  target: DocTarget,
  userPrompt: string,
  signal?: AbortSignal
): Promise<GeneratedDocument> {
  const entry = getDocTypeEntry(target.type);
  const result = await agent.generate(
    `Generate a ${entry.label}...`,
    signal
  );
  return parseDocumentOutput(target, result.text);
}
```

- [ ] **Step 4: Verify compiles**

Run: `pnpm --filter @doc-harness/core typecheck`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
cd /Users/kabo/Desktop/opencode/claude-sdk/doc-harness
git add packages/core/src/pipeline/pipeline-orchestrator.ts packages/core/src/agents/agent-factory.ts
git commit -m "feat(core): add AbortSignal support for pipeline cancellation"
```

---

### Task 4.5: Web — Wire Up Cancellation Signal

**Files:**
- Modify: `packages/web/src/app/api/generate/route.ts`

- [ ] **Step 1: Create AbortController and pass signal**

In the `POST` handler, create a signal from the request:

```ts
const signal = req.signal;

// In the stream start callback:
try {
  const result = await runPipeline(prompt, emit, signal);
  // ...
} catch (err) {
  if (signal.aborted) {
    // Client disconnected, pipeline already stopped
  } else {
    // ...
  }
}
```

- [ ] **Step 2: Verify compiles**

Run: `pnpm --filter @doc-harness/web typecheck`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
cd /Users/kabo/Desktop/opencode/claude-sdk/doc-harness
git add packages/web/src/app/api/generate/route.ts
git commit -m "feat(web): wire up AbortSignal to pipeline for cancellation"
```

---

### Task 4.6: Core — CLI Tool

**Files:**
- Create: `packages/core/src/cli/cli-runner.ts`
- Create: `packages/core/src/cli/index.ts`
- Modify: `packages/core/package.json`
- Modify: `packages/core/src/index.ts`

- [ ] **Step 1: Write CLI runner**

```ts
// packages/core/src/cli/cli-runner.ts
import { runPipeline } from "../pipeline/pipeline-orchestrator";
import { documentToMarkdown, buildZip } from "../export";
import type { PipelineEvent, GeneratedDocument, DocumentRelation } from "../types";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";

interface CLIOptions {
  output?: string;
  model?: string;
}

export async function runCLI(prompt: string, options: CLIOptions = {}): Promise<void> {
  const outputDir = resolve(options.output ?? "./docs");
  if (options.model) {
    process.env.DOC_HARNESS_MODEL = options.model;
  }

  console.log(`\nDocHarness — Generating documentation for: "${prompt}"\n`);
  console.log(`Output directory: ${outputDir}\n`);

  const startTime = Date.now();
  const events: PipelineEvent[] = [];
  let finalResult: { documents: GeneratedDocument[]; relations: DocumentRelation[] } | null = null;

  const emit = (event: PipelineEvent) => {
    events.push(event);
    switch (event.phase) {
      case "intake":
        if (event.docs.length > 0) {
          console.log(`→ Intake: ${event.docs.length} document types identified`);
        }
        break;
      case "generation":
        if (event.status === "started") {
          console.log(`→ Generating: ${event.slug} (${event.docType})`);
        }
        break;
      case "debate-verdict":
        console.log(`→ Debate verdict for ${event.slug}: ${event.verdict.verdict}`);
        break;
      case "complete":
        console.log(`\n✓ Pipeline complete — ${event.docCount} documents generated`);
        break;
      case "error":
        console.error(`✗ Error: ${event.message}`);
        break;
      case "result":
        finalResult = event.result;
        break;
    }
  };

  try {
    await runPipeline(prompt, emit);
  } catch (err) {
    console.error(`\n✗ Pipeline failed: ${err instanceof Error ? err.message : err}`);
    process.exit(1);
  }

  if (finalResult) {
    await mkdir(outputDir, { recursive: true });

    for (const doc of finalResult.documents) {
      const md = documentToMarkdown(doc);
      const safeSlug = doc.slug.replace(/[^a-zA-Z0-9_-]/g, "_");
      const filePath = join(outputDir, `${safeSlug}.${doc.type}.md`);
      await writeFile(filePath, md, "utf-8");
      console.log(`  ✓ Wrote ${safeSlug}.${doc.type}.md`);
    }

    const zipPath = join(outputDir, "..", `docs-${Date.now()}.zip`);
    await buildZip(finalResult.documents, zipPath);
    console.log(`  ✓ Created ZIP: ${zipPath}`);

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\n✓ Done in ${elapsed}s — ${finalResult.documents.length} documents written to ${outputDir}\n`);
  }
}
```

- [ ] **Step 2: Create CLI barrel**

```ts
// packages/core/src/cli/index.ts
export { runCLI } from "./cli-runner";
```

- [ ] **Step 3: Add bin entry to package.json**

Add to `packages/core/package.json`:
```json
"bin": {
  "doc-harness": "./dist/cli/bin.js"
}
```

- [ ] **Step 4: Create bin entry point**

Create `packages/core/src/cli/bin.ts`:
```ts
#!/usr/bin/env node
import { runCLI } from "./cli-runner.js";

const args = process.argv.slice(2);
let prompt = "";
let output: string | undefined;
let model: string | undefined;

for (let i = 0; i < args.length; i++) {
  if (args[i] === "--output" || args[i] === "-o") {
    output = args[++i];
  } else if (args[i] === "--model" || args[i] === "-m") {
    model = args[++i];
  } else if (args[i] === "--help" || args[i] === "-h") {
    console.log(`DocHarness CLI
Usage: npx @doc-harness/core [prompt] [options]

Options:
  --output, -o   Output directory (default: ./docs)
  --model, -m    Model to use (default: claude-sonnet-4-5)
  --help, -h     Show this help
`);
    process.exit(0);
  } else {
    prompt += args[i] + " ";
  }
}

prompt = prompt.trim();

if (!prompt) {
  console.error("Error: Prompt is required\nUsage: npx @doc-harness/core \"Build a chat app\" --output ./my-docs");
  process.exit(1);
}

runCLI(prompt, { output, model });
```

- [ ] **Step 5: Add CLI export to barrel**

Add to `packages/core/src/index.ts`:
```ts
export * from "./cli";
```

- [ ] **Step 6: Verify compiles**

Run: `pnpm --filter @doc-harness/core typecheck`
Expected: No errors

- [ ] **Step 7: Commit**

```bash
cd /Users/kabo/Desktop/opencode/claude-sdk/doc-harness
git add packages/core/src/cli/ packages/core/package.json packages/core/src/index.ts
git commit -m "feat(core): add CLI tool for terminal document generation"
```

---

### Task 4.7: Core — Config System

**Files:**
- Create: `packages/core/src/config/config-loader.ts`
- Create: `packages/core/src/config/index.ts`
- Create: `doc-harness.config.ts` (project root)
- Modify: `packages/core/src/index.ts`

- [ ] **Step 1: Write config loader**

```ts
// packages/core/src/config/config-loader.ts
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

export interface DocHarnessConfig {
  model?: string;
  gateway?: {
    url?: string;
    token?: string;
  };
  output?: {
    directory?: string;
    format?: "markdown" | "json";
  };
  pipeline?: {
    debateRounds?: number;
    debateBatchSize?: number;
    scoreThreshold?: number;
    maxRetries?: number;
  };
}

let cachedConfig: DocHarnessConfig | null = null;

export function loadConfig(configPath?: string): DocHarnessConfig {
  if (cachedConfig) return cachedConfig;

  const env: DocHarnessConfig = {
    model: process.env.DOC_HARNESS_MODEL,
    gateway: {
      url: process.env.CLOUDFLARE_AI_GATEWAY_URL,
      token: process.env.CLOUDFLARE_AI_GATEWAY_TOKEN,
    },
    output: {
      directory: process.env.DOC_HARNESS_OUTPUT_DIR,
    },
  };

  const paths = [
    configPath,
    resolve(process.cwd(), "doc-harness.config.ts"),
    resolve(process.cwd(), "doc-harness.config.js"),
  ].filter(Boolean) as string[];

  for (const path of paths) {
    if (existsSync(path)) {
      try {
        const fileConfig = loadConfigFile(path);
        cachedConfig = deepMerge(env, fileConfig);
        return cachedConfig;
      } catch {
        // Silently skip broken config files
      }
    }
  }

  cachedConfig = env;
  return cachedConfig;
}

function loadConfigFile(path: string): DocHarnessConfig {
  delete require.cache[require.resolve(path)];
  const mod = require(path);
  return mod.default ?? mod;
}

function deepMerge<T extends Record<string, unknown>>(target: T, source: Partial<T>): T {
  const result = { ...target };
  for (const key of Object.keys(source) as (keyof T)[]) {
    if (source[key] !== undefined) {
      const sv = source[key];
      const tv = result[key];
      if (sv !== null && typeof sv === "object" && !Array.isArray(sv) && tv !== null && typeof tv === "object" && !Array.isArray(tv)) {
        result[key] = deepMerge(tv as Record<string, unknown>, sv as Record<string, unknown>) as T[keyof T];
      } else {
        result[key] = sv as T[keyof T];
      }
    }
  }
  return result;
}
```

Wait — this uses `require` which won't work well with ESM. Let me keep it simpler with JSON/JS only:

```ts
// packages/core/src/config/config-loader.ts
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

export interface DocHarnessConfig {
  model?: string;
  gateway?: { url?: string; token?: string; };
  output?: { directory?: string; };
  pipeline?: {
    debateBatchSize?: number;
    scoreThreshold?: number;
  };
}

let cachedConfig: DocHarnessConfig | null = null;

export function loadConfig(): DocHarnessConfig {
  if (cachedConfig) return cachedConfig;

  cachedConfig = {
    model: process.env.DOC_HARNESS_MODEL,
    gateway: {
      url: process.env.CLOUDFLARE_AI_GATEWAY_URL,
      token: process.env.CLOUDFLARE_AI_GATEWAY_TOKEN,
    },
    output: {
      directory: process.env.DOC_HARNESS_OUTPUT_DIR,
    },
  };

  const configPath = resolve(process.cwd(), "doc-harness.config.js");
  if (existsSync(configPath)) {
    try {
      const content = readFileSync(configPath, "utf-8");
      if (content.includes("module.exports")) {
        const mod = eval(content);
        cachedConfig = { ...cachedConfig, ...mod };
      }
    } catch {}
  }

  return cachedConfig;
}
```

Actually, let me use a simpler approach — just use env vars in the config loader. Skip the file loading complexity.

```ts
// packages/core/src/config/config-loader.ts
export interface DocHarnessConfig {
  model: string;
  gatewayUrl?: string;
  gatewayToken?: string;
  outputDir: string;
  debateBatchSize: number;
  scoreThreshold: number;
  maxRetries: number;
}

export function loadConfig(): DocHarnessConfig {
  return {
    model: process.env.DOC_HARNESS_MODEL ?? "claude-sonnet-4-5",
    gatewayUrl: process.env.CLOUDFLARE_AI_GATEWAY_URL,
    gatewayToken: process.env.CLOUDFLARE_AI_GATEWAY_TOKEN,
    outputDir: process.env.DOC_HARNESS_OUTPUT_DIR ?? "./docs",
    debateBatchSize: parseInt(process.env.DOC_HARNESS_BATCH_SIZE ?? "4", 10),
    scoreThreshold: parseFloat(process.env.DOC_HARNESS_SCORE_THRESHOLD ?? "0.7"),
    maxRetries: parseInt(process.env.DOC_HARNESS_MAX_RETRIES ?? "3", 10),
  };
}
```

- [ ] **Step 2: Write config barrel**

```ts
// packages/core/src/config/index.ts
export type { DocHarnessConfig } from "./config-loader";
export { loadConfig } from "./config-loader";
```

- [ ] **Step 3: Add to barrel exports**

Add to `packages/core/src/index.ts`:
```ts
export * from "./config";
```

- [ ] **Step 4: Verify compiles**

Run: `pnpm --filter @doc-harness/core typecheck`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
cd /Users/kabo/Desktop/opencode/claude-sdk/doc-harness
git add packages/core/src/config/ packages/core/src/index.ts
git commit -m "feat(core): add configuration system with env var support"
```

---

### Task 4.8: Project — README

**Files:**
- Create: `/Users/kabo/Desktop/opencode/claude-sdk/doc-harness/README.md`

- [ ] **Step 1: Write README**

```markdown
# DocHarness

AI-powered documentation generation platform. Enter a single prompt and get a complete suite of professional software documents — PRDs, ADRs, implementation plans, and more — powered by 25 AI agents, 3-round adversarial debate, and a 6-phase pipeline.

## Quick Start

```bash
# Install dependencies
pnpm install

# Set your API key
export ANTHROPIC_API_KEY=sk-ant-...

# Build core library
pnpm --filter @doc-harness/core build

# Start web UI
pnpm dev
# → http://localhost:3000
```

## CLI Usage

```bash
# Build first
pnpm --filter @doc-harness/core build

# Generate docs from terminal
node packages/core/dist/cli/bin.js "Build a real-time chat app with WebSocket" --output ./my-docs
```

## Architecture

```
packages/
├── core/    @doc-harness/core — Pipeline engine, 25 agents, 5 tools
└── web/     @doc-harness/web  — Next.js 15 UI with real-time SSE streaming
```

### 6-Phase Pipeline

| Phase | Description |
|-------|-------------|
| 0. Intake | Classify prompt → select document types |
| 1. Discovery | Build domain knowledge |
| 2. Generation | Generate all documents in parallel (specialist agents) |
| 3. Debate | 3-round adversarial debate (Advocate vs Skeptic, judged by Mediator) |
| 4. Review | Quality scoring + escalation |
| 5. Assembly | Output assembly |

### 18 Document Types

| Track | Types |
|-------|-------|
| Vision | PRD, Idea, Plan, MRD, BRD, URD, BRS, STRS, SYRS, SRS |
| Knowledge | ADR, RFC, Rule, Guide, Spec, Doc |
| Experience | Task Type, CPAT |

## Configuration

| Env Var | Default | Description |
|---------|---------|-------------|
| `ANTHROPIC_API_KEY` | — | Required: Anthropic API key |
| `DOC_HARNESS_MODEL` | `claude-sonnet-4-5` | Model to use |
| `CLOUDFLARE_AI_GATEWAY_URL` | — | Optional Cloudflare AI Gateway |
| `CLOUDFLARE_AI_GATEWAY_TOKEN` | — | Optional Gateway token |
| `DOC_HARNESS_OUTPUT_DIR` | `./docs` | Default output directory |
| `DOC_HARNESS_BATCH_SIZE` | `4` | Debate batch size |
| `DOC_HARNESS_SCORE_THRESHOLD` | `0.7` | Quality gate threshold |

## Development

```bash
pnpm --filter @doc-harness/core test     # Run tests
pnpm --filter @doc-harness/core typecheck # Type check
pnpm --filter @doc-harness/web typecheck  # Type check web
pnpm build                                # Build all packages
```
```

- [ ] **Step 2: Commit**

```bash
cd /Users/kabo/Desktop/opencode/claude-sdk/doc-harness
git add README.md
git commit -m "docs: add README with setup instructions and architecture overview"
```

---

### Task 4.9: Final Verification

**Files:**
- All modified files

- [ ] **Step 1: Full typecheck**

```bash
cd /Users/kabo/Desktop/opencode/claude-sdk/doc-harness
pnpm typecheck
```
Expected: No errors across core and web

- [ ] **Step 2: Run all tests**

```bash
pnpm --filter @doc-harness/core test
```
Expected: All tests pass

- [ ] **Step 3: Build core**

```bash
pnpm --filter @doc-harness/core build
```
Expected: Build succeeds

- [ ] **Step 4: Build web**

```bash
pnpm --filter @doc-harness/web build
```
Expected: Build succeeds

- [ ] **Step 5: Final commit**

```bash
cd /Users/kabo/Desktop/opencode/claude-sdk/doc-harness
git add -A
git status
git commit -m "feat: complete enhancement — downloads, storage, Tailwind UI, tests, CLI, config, README"
```

---

## Summary

**Total tasks:** 22
**Tracks:** Output (5) + Storage (7) + UI (5) + Hardening (9)  
**Files created:** ~15 new files  
**Files modified:** ~10 existing files  
**Estimated effort:** ~2-3 hours sequential, ~1 hour with parallel agents
