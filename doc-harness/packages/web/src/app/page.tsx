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
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      const sessionId = res.headers.get("X-Session-Id");
      if (sessionId) {
        router.push(`/session/${sessionId}`);
      } else {
        const fallbackId = `session-${Date.now()}`;
        router.push(`/session/${fallbackId}?prompt=${encodeURIComponent(prompt)}`);
      }
    } catch {
      const fallbackId = `session-${Date.now()}`;
      router.push(`/session/${fallbackId}?prompt=${encodeURIComponent(prompt)}`);
    }
    setGenerating(false);
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
