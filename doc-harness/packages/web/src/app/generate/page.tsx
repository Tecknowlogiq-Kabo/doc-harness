"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/page-header";

const docTypes = [
  { type: "prd", label: "PRD", track: "vision" },
  { type: "idea", label: "Idea", track: "vision" },
  { type: "plan", label: "Plan", track: "vision" },
  { type: "mrd", label: "MRD", track: "vision" },
  { type: "brd", label: "BRD", track: "vision" },
  { type: "urd", label: "URD", track: "vision" },
  { type: "brs", label: "BRS", track: "vision" },
  { type: "strs", label: "STRS", track: "vision" },
  { type: "syrs", label: "SYRS", track: "vision" },
  { type: "srs", label: "SRS", track: "vision" },
  { type: "adr", label: "ADR", track: "knowledge" },
  { type: "rfc", label: "RFC", track: "knowledge" },
  { type: "rule", label: "Rule", track: "knowledge" },
  { type: "guide", label: "Guide", track: "knowledge" },
  { type: "spec", label: "Spec", track: "knowledge" },
  { type: "doc", label: "Doc", track: "knowledge" },
  { type: "task-type", label: "Task Type", track: "experience" },
  { type: "cpat", label: "CPAT", track: "experience" },
];

export default function GeneratePage() {
  const router = useRouter();
  const [prompt, setPrompt] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("doc-harness-active-prompt");
    if (saved) {
      setPrompt(saved);
      localStorage.removeItem("doc-harness-active-prompt");
    }
  }, []);

  const toggleType = (type: string) => {
    setSelected((prev) => prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]);
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setGenerating(true);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      const sessionId = res.headers.get("X-Session-Id") ?? `session-${Date.now()}`;
      router.push(`/session/${sessionId}`);
    } catch {
      const fallback = `session-${Date.now()}`;
      router.push(`/session/${fallback}?prompt=${encodeURIComponent(prompt)}`);
    }
    setGenerating(false);
  };

  return (
    <div>
      <PageHeader title="Generate" description="Create documentation from a prompt" />

      <div className="p-6 max-w-3xl">
        <div className="bg-surface border border-border rounded-lg p-6 mb-6">
          <label className="block text-sm font-medium mb-2">Prompt</label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Describe what you want documented...&#10;&#10;Example: Build a real-time chat application with WebSocket support, user authentication, and message persistence."
            rows={6}
            className="w-full p-4 bg-bg border border-border rounded-lg text-sm text-text placeholder-text-muted focus:outline-none focus:border-primary transition-colors resize-y"
          />
        </div>

        <div className="bg-surface border border-border rounded-lg p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium">Document Types</h3>
            <div className="flex gap-2">
              <button onClick={() => setSelected(docTypes.map((d) => d.type))} className="text-xs text-primary hover:underline">Select all</button>
              <button onClick={() => setSelected([])} className="text-xs text-text-muted hover:underline">Clear</button>
            </div>
          </div>

          {(["vision", "knowledge", "experience"] as const).map((track) => (
            <div key={track} className="mb-4 last:mb-0">
              <h4 className="text-xs text-text-muted uppercase tracking-wider mb-2">{track}</h4>
              <div className="flex flex-wrap gap-2">
                {docTypes.filter((d) => d.track === track).map((d) => {
                  const isSelected = selected.length === 0 || selected.includes(d.type);
                  return (
                    <button
                      key={d.type}
                      onClick={() => toggleType(d.type)}
                      className={`px-2.5 py-1 rounded text-xs font-medium border transition-colors ${
                        isSelected
                          ? "bg-primary/20 border-primary text-primary"
                          : "border-border text-text-muted hover:border-primary/50"
                      }`}
                    >
                      {d.label}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          <p className="text-xs text-text-muted mt-4">
            {selected.length === 0 ? "All types selected by default" : `${selected.length} type${selected.length > 1 ? "s" : ""} selected`}
          </p>
        </div>

        <div className="bg-surface border border-border rounded-lg p-6 mb-6">
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="text-sm font-medium flex items-center gap-2 hover:text-text transition-colors"
          >
            Advanced Options {showAdvanced ? "▲" : "▼"}
          </button>
          {showAdvanced && (
            <div className="mt-4 space-y-4">
              <div>
                <label className="block text-xs text-text-muted mb-1">Model</label>
                <select className="w-full px-3 py-2 bg-bg border border-border rounded-lg text-sm text-text focus:outline-none focus:border-primary">
                  <option>claude-sonnet-4-5 (default)</option>
                  <option>claude-opus-4-5</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-text-muted mb-1">Output Directory</label>
                <input
                  type="text"
                  defaultValue="./docs"
                  className="w-full px-3 py-2 bg-bg border border-border rounded-lg text-sm text-text focus:outline-none focus:border-primary"
                />
              </div>
            </div>
          )}
        </div>

        <button
          onClick={handleGenerate}
          disabled={generating || !prompt.trim()}
          className={`w-full py-3 rounded-lg text-sm font-semibold transition-all ${
            prompt.trim()
              ? "bg-primary text-white hover:bg-primary-hover cursor-pointer"
              : "bg-surface border border-border text-text-muted cursor-not-allowed"
          }`}
        >
          {generating ? "Generating..." : "Generate Documentation"}
        </button>
      </div>
    </div>
  );
}
