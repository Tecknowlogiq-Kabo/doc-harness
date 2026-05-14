# DocHarness Enhancement — Design Spec

**Date:** 2026-05-14 | **Scope:** Full-stack enhancement across 4 tracks

## Goal

Transform DocHarness from a functional prototype into a production-ready, end-user-usable application with persistent storage, file output, polished UI, and comprehensive testing.

## Architecture: 4 Parallel Tracks

### Track 1: Output & Downloads (core + web)
**Core (`packages/core/src/export/`):**
- `MarkdownWriter` — serialize generated documents to `.md` files
- `ZipBuilder` — bundle all documents into a ZIP using native Node `zlib` + `archiver`
- `ClipboardFormatter` — format documents for clipboard copy
- `pipeline-orchestrator.ts` — emit structured `GeneratedDocument` objects in completion event (currently sends markdown strings, needs typed objects with title + content + type)

**Web (`packages/web/`):**
- Download button per document (single `.md`)
- "Download All as ZIP" button (POST to `/api/export`)
- Copy to clipboard button per document
- New API route: `src/app/api/export/route.ts`

### Track 2: Persistent Storage (core + web)
**Core (`packages/core/src/store/`):**
- `SessionStore` interface (CRUD: create, get, list, delete sessions)
- `SQLiteStore` — implementation using `better-sqlite3`
- `SessionRepository` — wraps store with typed session model (id, prompt, status, documents JSON, timestamps)
- Integration point: `pipeline-orchestrator.ts` saves sessions on completion

**Web (`packages/web/`):**
- New page: `/sessions` — session history list
- Existing `/session/[id]` page — loads from storage on mount
- New API routes: `GET /api/sessions`, `GET /api/sessions/[id]`, `DELETE /api/sessions/[id]`

### Track 3: Web UI Polish (web only)
- Install and configure Tailwind CSS v4 with `@tailwindcss/vite`
- Replace all inline styles with Tailwind classes
- Add error boundaries with retry buttons
- Add proper loading skeletons
- Add diff view component (show before/after debate revisions)
- Add basic document graph visualization (D3 or React Flow)
- Add `useSessionStore` hook for session state management

### Track 4: Production Hardening (core + web)
- **Tests:** Vitest tests for pipeline orchestrator, debate orchestrator, all tools, agent factory, export, storage (minimum 80% coverage)
- **Pipeline cancellation:** Propagate `AbortSignal` through all pipeline phases; stop LLM calls on client disconnect
- **CLI tool:** `packages/core/src/cli/` — `npx doc-harness generate "prompt" --output ./docs`
- **Config system:** `doc-harness.config.ts` — model, thresholds, batch sizes, output dir
- **README:** Setup instructions, architecture overview, API reference
- **Env validation:** Validate required env vars at startup with clear error messages

## Dependency Graph
```
Track 1 core ──→ Track 1 web
Track 2 core ──→ Track 2 web  
Track 3 web   (independent)
Track 4 tests (alongside all tracks)
Track 4 CLI   (after Track 1+2 core)
Track 4 config (after all tracks)
```

## Success Criteria
1. Users can download generated docs as ZIP and individual `.md` files
2. Sessions persist across page refreshes and server restarts
3. UI uses Tailwind with error recovery and loading states
4. Test coverage ≥ 80% across core package
5. CLI: `npx doc-harness generate` works end-to-end
6. Pipeline respects cancellation signals
