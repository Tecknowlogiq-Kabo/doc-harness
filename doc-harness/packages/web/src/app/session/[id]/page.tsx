"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useSearchParams, useParams } from "next/navigation";
import Link from "next/link";
import type { PipelineEvent, DocTarget, DebateVerdict, GeneratedDocument } from "@doc-harness/core";

type PhaseStatus = "pending" | "running" | "completed";

function SessionContent() {
  const params = useSearchParams();
  const prompt = params.get("prompt") ?? "No prompt provided";
  const { id: sessionId } = useParams<{ id: string }>();

  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (prompt === "No prompt provided") {
      fetch(`/api/sessions/${sessionId}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.documents && data.documents.length > 0) {
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
        .catch(() => {})
        .finally(() => setIsLoading(false));
      return;
    }
    setIsLoading(false);
  }, [prompt, sessionId]);

  const [phaseStatus, setPhaseStatus] = useState<Record<string, PhaseStatus>>({
    intake: "pending",
    discovery: "pending",
    generation: "pending",
    debate: "pending",
    review: "pending",
    assembly: "pending",
  });

  const [docs, setDocs] = useState<DocTarget[]>([]);
  const [generationProgress, setGenerationProgress] = useState({ completed: 0, total: 0 });
  const [debateEvents, setDebateEvents] = useState<{ slug: string; round: number; role: string; argument: string }[]>([]);
  const [verdicts, setVerdicts] = useState<Record<string, DebateVerdict>>({});
  const [resultDocuments, setResultDocuments] = useState<GeneratedDocument[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (prompt === "No prompt provided") return;
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
              } catch {
                // Skip malformed events
              }
            }
          }
        }
      })
      .catch((err) => {
        if (err.name !== "AbortError") {
          setError(err.message);
        }
      });

    return () => controller.abort();
  }, [prompt]);

  const handleEvent = useCallback((event: PipelineEvent) => {
    switch (event.phase) {
      case "intake":
        setPhaseStatus((prev) => ({ ...prev, intake: "running" }));
        if (event.docs.length > 0) {
          setDocs(event.docs);
        }
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
        setDebateEvents((prev) => [...prev, {
          slug: event.slug,
          round: event.round,
          role: event.role,
          argument: event.argument,
        }]);
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

  if (isLoading) {
    return (
      <main className="max-w-3xl mx-auto p-8">
        <nav className="mb-8 flex justify-between items-center">
          <Link href="/" className="text-lg font-bold text-primary no-underline">DocHarness</Link>
          <Link href="/sessions" className="text-sm text-text-muted hover:text-text transition-colors">History</Link>
        </nav>
        <div className="text-text-muted">Loading session...</div>
      </main>
    );
  }

  return (
    <main className="max-w-3xl mx-auto p-8">
      <nav className="mb-8 flex justify-between items-center">
        <Link href="/" className="text-lg font-bold text-primary no-underline">DocHarness</Link>
        <Link href="/sessions" className="text-sm text-text-muted hover:text-text transition-colors">History</Link>
      </nav>

      <h1 className="text-xl font-bold mb-2">Pipeline Status</h1>
      <p className="text-text-muted mb-8 text-sm">
        {prompt.slice(0, 100)}{prompt.length > 100 ? "..." : ""}
      </p>

      {error && (
        <div className="p-4 bg-red-950 rounded-lg mb-4 border border-red-900">
          <p className="text-sm">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-3 px-4 py-2 bg-primary text-white rounded-lg text-sm font-semibold hover:opacity-90"
          >
            Retry
          </button>
        </div>
      )}

      {/* Phase progress */}
      <div className="flex flex-col gap-2 mb-8">
        {(["intake", "discovery", "generation", "debate", "review", "assembly"] as const).map((phase) => (
          <PhaseRow
            key={phase}
            phase={phase}
            status={phaseStatus[phase]}
            extra={
              phase === "generation" && generationProgress.total > 0
                ? `${generationProgress.completed}/${generationProgress.total} documents`
                : phase === "generation" && phaseStatus.generation === "completed"
                ? "All documents generated"
                : undefined
            }
          />
        ))}
      </div>

      {/* Document cards */}
      {docs.length > 0 && (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(250px,1fr))] gap-3">
          {docs.map((doc) => {
            const verdict = verdicts[doc.slug];
            const borderColor = verdict
              ? verdict.verdict === "approve" ? "border-success" : verdict.verdict === "revise" ? "border-warning" : "border-error"
              : "border-border";
            return (
              <div
                key={doc.slug}
                className={`p-3 bg-surface rounded-lg border ${borderColor}`}
              >
                <div className="text-xs text-text-muted uppercase mb-1">
                  {doc.type} · {doc.track}
                </div>
                <div className="font-semibold mb-1">{doc.title}</div>
                <div className="text-sm text-text-muted">{doc.slug}.{doc.type}.md</div>
                {verdict && (
                  <div className={`mt-2 px-2 py-1 rounded text-xs font-semibold uppercase ${
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

      {/* Debate events */}
      {debateEvents.length > 0 && (
        <div className="mt-8">
          <h2 className="text-lg font-semibold mb-2">Debate Activity</h2>
          <div className="text-sm text-text-muted flex flex-col gap-2">
            {debateEvents.map((e, i) => (
              <div key={i} className="p-2 bg-surface rounded-md">
                <div className={`font-semibold mb-1 ${e.role === "advocate" ? "text-success" : "text-error"}`}>
                  [{e.slug}] Round {e.round} — {e.role}
                </div>
                <div className="text-xs leading-relaxed max-h-28 overflow-y-auto">
                  {e.argument.slice(0, 400)}{e.argument.length > 400 ? "..." : ""}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Result documents */}
      {resultDocuments.length > 0 && (
        <div className="mt-8">
          <h2 className="text-lg font-semibold mb-2">Generated Documents</h2>
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
            className="px-4 py-2 text-sm font-semibold rounded-md border-none bg-primary text-white cursor-pointer hover:opacity-90 mb-4"
          >
            Download All as ZIP ({resultDocuments.length} docs)
          </button>
          <div className="flex flex-col gap-3">
            {resultDocuments.map((doc) => (
              <details key={doc.slug} className="p-3 bg-surface rounded-lg border border-border">
                <summary className="flex items-center font-semibold cursor-pointer text-text">
                  <span>
                    {doc.title} <span className="text-text-muted text-xs">({doc.type})</span>
                  </span>
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      const blob = new Blob([doc.content], { type: "text/markdown" });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = `${doc.slug}.${doc.type}.md`;
                      a.click();
                      URL.revokeObjectURL(url);
                    }}
                    className="ml-auto px-2 py-1 text-xs rounded border border-border bg-transparent text-text-muted cursor-pointer"
                  >
                    Download .md
                  </button>
                </summary>
                <pre className="mt-3 whitespace-pre-wrap text-xs leading-relaxed text-text-muted max-h-96 overflow-y-auto">
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

function PhaseRow({ phase, status, extra }: { phase: string; status: PhaseStatus; extra?: string }) {
  const icons: Record<PhaseStatus, string> = {
    pending: "○",
    running: "◉",
    completed: "✓",
  };

  const statusColor: Record<PhaseStatus, string> = {
    pending: "text-border",
    running: "text-primary",
    completed: "text-success",
  };

  const labels: Record<string, string> = {
    intake: "Phase 0: Intake & Classification",
    discovery: "Phase 1: Discovery & Knowledge Generation",
    generation: "Phase 2: Parallel Document Generation",
    debate: "Phase 3: Debate & Refinement (3 rounds)",
    review: "Phase 4: Review & Quality Gate",
    assembly: "Phase 5: Output Assembly",
  };

  return (
    <div className="flex items-center gap-3 py-2 border-b border-surface">
      <span className={`text-lg ${statusColor[status]}`}>{icons[status]}</span>
      <span className={`flex-1 ${status === "pending" ? "text-text-muted" : "text-text"}`}>
        {labels[phase] ?? phase}
      </span>
      {extra && <span className="text-xs text-text-muted">{extra}</span>}
    </div>
  );
}

export default function SessionPage() {
  return (
    <Suspense fallback={<div className="p-8 text-text-muted">Loading...</div>}>
      <SessionContent />
    </Suspense>
  );
}
