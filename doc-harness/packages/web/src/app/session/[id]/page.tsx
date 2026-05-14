"use client";

import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import type { PipelineEvent, DocTarget, DebateVerdict } from "@doc-harness/core";

type PhaseStatus = "pending" | "running" | "completed";

export default function SessionPage() {
  const params = useSearchParams();
  const prompt = params.get("prompt") ?? "No prompt provided";

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
  const [debateEvents, setDebateEvents] = useState<{ slug: string; round: number; role: string }[]>([]);
  const [verdicts, setVerdicts] = useState<Record<string, DebateVerdict>>({});
  const [outputFiles, setOutputFiles] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
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

      case "error":
        setError(event.message);
        break;
    }
  }, []);

  return (
    <main style={{ maxWidth: 900, margin: "0 auto", padding: "2rem" }}>
      <h1 style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>Pipeline Status</h1>
      <p style={{ color: "#666", marginBottom: "2rem", fontSize: "0.9rem" }}>
        {prompt.slice(0, 100)}{prompt.length > 100 ? "..." : ""}
      </p>

      {error && (
        <div style={{ padding: "1rem", background: "#3b0a0a", borderRadius: 8, marginBottom: "1rem", border: "1px solid #6b2020" }}>
          {error}
        </div>
      )}

      {/* Phase progress */}
      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginBottom: "2rem" }}>
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
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))", gap: "0.75rem" }}>
          {docs.map((doc) => {
            const verdict = verdicts[doc.slug];
            return (
              <div
                key={doc.slug}
                style={{
                  padding: "0.75rem",
                  background: "#1a1a1a",
                  borderRadius: 8,
                  border: verdict
                    ? verdict.verdict === "approve"
                      ? "1px solid #22c55e"
                      : verdict.verdict === "revise"
                      ? "1px solid #eab308"
                      : "1px solid #ef4444"
                    : "1px solid #333",
                }}
              >
                <div style={{ fontSize: "0.75rem", color: "#888", textTransform: "uppercase", marginBottom: "0.25rem" }}>
                  {doc.type} · {doc.track}
                </div>
                <div style={{ fontWeight: 600, marginBottom: "0.25rem" }}>{doc.title}</div>
                <div style={{ fontSize: "0.8rem", color: "#aaa" }}>{doc.slug}.{doc.type}.md</div>
                {verdict && (
                  <div style={{
                    marginTop: "0.5rem",
                    padding: "0.25rem 0.5rem",
                    borderRadius: 4,
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    textTransform: "uppercase",
                    background: verdict.verdict === "approve" ? "#14532d" : verdict.verdict === "revise" ? "#422006" : "#450a0a",
                    color: verdict.verdict === "approve" ? "#22c55e" : verdict.verdict === "revise" ? "#eab308" : "#ef4444",
                  }}>
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
        <div style={{ marginTop: "2rem" }}>
          <h2 style={{ fontSize: "1.1rem", marginBottom: "0.5rem" }}>Debate Activity</h2>
          <div style={{ fontSize: "0.85rem", color: "#888" }}>
            {debateEvents.map((e, i) => (
              <div key={i}>
                [{e.slug}] Round {e.round} — {e.role}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Output files */}
      {outputFiles.length > 0 && (
        <div style={{ marginTop: "2rem" }}>
          <h2 style={{ fontSize: "1.1rem", marginBottom: "0.5rem" }}>Output Files</h2>
          <div style={{ fontSize: "0.85rem", color: "#888" }}>
            {outputFiles.map((f, i) => (
              <div key={i}>{f}</div>
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

  const colors: Record<PhaseStatus, string> = {
    pending: "#444",
    running: "#7c3aed",
    completed: "#22c55e",
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
    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.5rem 0", borderBottom: "1px solid #1a1a1a" }}>
      <span style={{ color: colors[status], fontSize: "1.2rem" }}>{icons[status]}</span>
      <span style={{ flex: 1, color: colors[status] }}>{labels[phase] ?? phase}</span>
      {extra && <span style={{ fontSize: "0.8rem", color: "#666" }}>{extra}</span>}
    </div>
  );
}
