"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { PipelineEvent } from "@doc-harness/core";

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
    <main style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "2rem" }}>
      <h1 style={{ fontSize: "2.5rem", fontWeight: 800, marginBottom: "0.5rem" }}>
        DocHarness
      </h1>
      <p style={{ color: "#888", marginBottom: "2rem", maxWidth: 600, textAlign: "center" }}>
        Generate comprehensive software documentation from a single prompt.
        Powered by 25 AI agents, 3-round adversarial debate, and 6-phase pipeline.
      </p>

      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder="Describe what you want documented...&#10;&#10;Example: Build a real-time chat application with WebSocket support, user authentication, and message persistence. I need a PRD, architecture decisions, and implementation plan."
        rows={6}
        style={{
          width: "100%",
          maxWidth: 700,
          padding: "1rem",
          fontSize: "1rem",
          borderRadius: 8,
          border: "1px solid #333",
          background: "#1a1a1a",
          color: "#e0e0e0",
          resize: "vertical",
          fontFamily: "system-ui, sans-serif",
        }}
      />

      <button
        onClick={handleGenerate}
        disabled={generating || !prompt.trim()}
        style={{
          marginTop: "1rem",
          padding: "0.75rem 2rem",
          fontSize: "1rem",
          fontWeight: 600,
          borderRadius: 8,
          border: "none",
          background: prompt.trim() ? "#7c3aed" : "#333",
          color: "#fff",
          cursor: prompt.trim() ? "pointer" : "not-allowed",
        }}
      >
        {generating ? "Generating..." : "Generate Documentation"}
      </button>

      <div style={{ marginTop: "3rem", display: "flex", gap: "2rem", color: "#666", fontSize: "0.85rem" }}>
        <div>
          <strong>18</strong> document types
        </div>
        <div>
          <strong>25</strong> AI agents
        </div>
        <div>
          <strong>3-round</strong> debate
        </div>
        <div>
          <strong>6-phase</strong> pipeline
        </div>
      </div>
    </main>
  );
}
