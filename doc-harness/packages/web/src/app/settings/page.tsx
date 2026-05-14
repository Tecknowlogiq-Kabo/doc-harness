"use client";

import { useState, useEffect } from "react";
import { PageHeader } from "@/components/page-header";

interface OllamaModel {
  name: string;
  size: number;
  modified_at: string;
}

export default function SettingsPage() {
  const [saved, setSaved] = useState(false);
  const [provider, setProvider] = useState("anthropic");
  const [ollamaModels, setOllamaModels] = useState<OllamaModel[]>([]);
  const [selectedModel, setSelectedModel] = useState(
    typeof window !== "undefined" ? localStorage.getItem("doc-harness-model") ?? "" : ""
  );
  const [ollamaKey, setOllamaKey] = useState(
    typeof window !== "undefined" ? localStorage.getItem("doc-harness-ollama-key") ?? "" : ""
  );
  const [ollamaUrl, setOllamaUrl] = useState(
    typeof window !== "undefined" ? localStorage.getItem("doc-harness-ollama-url") ?? "https://api.ollama.com/v1" : ""
  );

  useEffect(() => {
    fetch("/api/ollama-models")
      .then((res) => res.json())
      .then((data) => {
        if (data.models) {
          setOllamaModels(data.models);
        }
      })
      .catch(() => {});
  }, []);

  const formatSize = (bytes: number) => {
    if (bytes >= 1e12) return `${(bytes / 1e12).toFixed(1)}T`;
    if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(0)}B`;
    if (bytes >= 1e6) return `${(bytes / 1e6).toFixed(0)}M`;
    return `${(bytes / 1e3).toFixed(0)}K`;
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem("doc-harness-provider", provider);
    localStorage.setItem("doc-harness-model", selectedModel);
    localStorage.setItem("doc-harness-ollama-key", ollamaKey);
    localStorage.setItem("doc-harness-ollama-url", ollamaUrl);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div>
      <PageHeader title="Settings" description="Configure your documentation pipeline" />

      <div className="p-6 max-w-2xl">
        <form onSubmit={handleSave} className="space-y-6">
          <div className="bg-surface border border-border rounded-lg p-6">
            <h3 className="text-sm font-semibold mb-4">Model Provider</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs text-text-muted mb-2">Provider</label>
                <div className="flex gap-2">
                  {[
                    { key: "anthropic", label: "Anthropic" },
                    { key: "ollama-cloud", label: "Ollama Cloud" },
                    { key: "ollama-local", label: "Ollama Local" },
                  ].map((p) => (
                    <button
                      key={p.key}
                      type="button"
                      onClick={() => setProvider(p.key)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                        provider === p.key
                          ? "bg-primary/20 border-primary text-primary"
                          : "border-border text-text-muted hover:border-primary/50"
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {provider === "anthropic" ? (
                <div>
                  <label className="block text-xs text-text-muted mb-1">Model</label>
                  <select
                    value={selectedModel}
                    onChange={(e) => setSelectedModel(e.target.value)}
                    className="w-full px-3 py-2 bg-bg border border-border rounded-lg text-sm text-text focus:outline-none focus:border-primary"
                  >
                    <option value="">claude-sonnet-4-5 (default)</option>
                    <option value="claude-opus-4-5">claude-opus-4-5</option>
                  </select>
                </div>
              ) : provider === "ollama-cloud" ? (
                <>
                  <div>
                    <label className="block text-xs text-text-muted mb-1">API Key</label>
                    <input
                      type="password"
                      value={ollamaKey}
                      onChange={(e) => setOllamaKey(e.target.value)}
                      placeholder="Your Ollama cloud API key"
                      className="w-full px-3 py-2 bg-bg border border-border rounded-lg text-sm text-text placeholder-text-muted focus:outline-none focus:border-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-text-muted mb-1 mt-4">Model</label>
                    {ollamaModels.length > 0 ? (
                      <select
                        value={selectedModel}
                        onChange={(e) => setSelectedModel(e.target.value)}
                        className="w-full px-3 py-2 bg-bg border border-border rounded-lg text-sm text-text focus:outline-none focus:border-primary"
                      >
                        <option value="">Select a model...</option>
                        {ollamaModels.map((m) => (
                          <option key={m.name} value={m.name}>
                            {m.name} ({formatSize(m.size)})
                          </option>
                        ))}
                      </select>
                    ) : (
                      <div className="text-sm text-text-muted">Loading models...</div>
                    )}
                    {selectedModel && (
                      <p className="text-xs text-text-muted mt-1">
                        Set as OLLAMA_MODEL={selectedModel}
                      </p>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label className="block text-xs text-text-muted mb-1">Base URL</label>
                    <input
                      type="text"
                      value={ollamaUrl}
                      onChange={(e) => setOllamaUrl(e.target.value)}
                      placeholder="http://localhost:11434/v1"
                      className="w-full px-3 py-2 bg-bg border border-border rounded-lg text-sm text-text placeholder-text-muted focus:outline-none focus:border-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-text-muted mb-1 mt-4">Model</label>
                    <input
                      type="text"
                      value={selectedModel}
                      onChange={(e) => setSelectedModel(e.target.value)}
                      placeholder="llama3, qwen3, mistral, etc."
                      className="w-full px-3 py-2 bg-bg border border-border rounded-lg text-sm text-text placeholder-text-muted focus:outline-none focus:border-primary"
                    />
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="bg-surface border border-border rounded-lg p-6">
            <h3 className="text-sm font-semibold mb-4">Pipeline Settings</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs text-text-muted mb-1">Output Directory</label>
                <input
                  type="text"
                  defaultValue="./docs"
                  className="w-full px-3 py-2 bg-bg border border-border rounded-lg text-sm text-text focus:outline-none focus:border-primary"
                />
              </div>
              <div>
                <label className="block text-xs text-text-muted mb-1">Debate Rounds</label>
                <select className="w-full px-3 py-2 bg-bg border border-border rounded-lg text-sm text-text focus:outline-none focus:border-primary">
                  <option>3 (default)</option>
                  <option>2</option>
                  <option>4</option>
                  <option>5</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-text-muted mb-1">Score Threshold</label>
                <input
                  type="number"
                  defaultValue="0.7"
                  step="0.05"
                  min="0"
                  max="1"
                  className="w-full px-3 py-2 bg-bg border border-border rounded-lg text-sm text-text focus:outline-none focus:border-primary"
                />
              </div>
            </div>
          </div>

          <button
            type="submit"
            className={`px-6 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
              saved
                ? "bg-green-950 text-success border border-green-900"
                : "bg-primary text-white hover:bg-primary-hover"
            }`}
          >
            {saved ? "✓ Saved" : "Save Settings"}
          </button>
        </form>
      </div>
    </div>
  );
}
