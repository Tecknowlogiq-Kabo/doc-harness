"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import type { GeneratedDocument } from "@doc-harness/core";

interface LogEntry {
  id: string;
  prompt: string;
  status: "running" | "completed" | "failed";
  documents: GeneratedDocument[];
  createdAt: string;
  completedAt: string | null;
}

export default function LogsPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");

  useEffect(() => {
    fetch("/api/sessions?limit=100")
      .then((res) => res.json())
      .then((data: LogEntry[]) => setLogs(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = filter === "all" ? logs : logs.filter((l) => l.status === filter);

  const duration = (log: LogEntry) => {
    if (!log.completedAt) return "—";
    const ms = new Date(log.completedAt).getTime() - new Date(log.createdAt).getTime();
    const seconds = Math.round(ms / 1000);
    return seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  };

  return (
    <div>
      <PageHeader title="Pipeline Logs" description={`${logs.length} total runs`} />

      <div className="border-b border-border flex gap-1 p-4">
        {["all", "completed", "failed", "running"].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
              filter === f ? "bg-primary text-white" : "text-text-muted hover:text-text"
            }`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="p-8 text-center text-text-muted">Loading...</div>
      ) : (
        <div>
          {filtered.map((log) => (
            <div key={log.id} className="border-b border-border/50">
              <div
                onClick={() => setExpanded(expanded === log.id ? null : log.id)}
                className="flex items-center gap-4 p-4 cursor-pointer hover:bg-surface-hover transition-colors"
              >
                <StatusBadge status={log.status} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{log.prompt.slice(0, 80)}</div>
                  <div className="text-xs text-text-muted mt-0.5">
                    {log.documents.length} docs · {new Date(log.createdAt).toLocaleString()} · {duration(log)}
                  </div>
                </div>
                <span className="text-xs text-text-muted">{expanded === log.id ? "▲" : "▼"}</span>
              </div>
              {expanded === log.id && (
                <div className="px-4 pb-4 space-y-2">
                  <div className="text-xs text-text-muted">
                    ID: {log.id} · Created: {new Date(log.createdAt).toLocaleString()}
                    {log.completedAt && ` · Completed: ${new Date(log.completedAt).toLocaleString()}`}
                  </div>
                  {log.documents.length > 0 ? (
                    <div className="space-y-1">
                      {log.documents.map((doc) => (
                        <div key={doc.slug} className="flex items-center gap-2 p-2 bg-bg rounded text-sm">
                          <span className="text-text-muted uppercase text-xs w-16">{doc.type}</span>
                          <span>{doc.title}</span>
                          <span className="text-text-muted text-xs ml-auto">{doc.sections.length} sections</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-sm text-text-muted">No documents generated</div>
                  )}
                  <a
                    href={`/session/${log.id}?prompt=${encodeURIComponent(log.prompt)}`}
                    className="inline-block text-xs text-primary hover:underline mt-2"
                  >
                    View full session →
                  </a>
                </div>
              )}
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="p-8 text-center text-text-muted">No logs found</div>
          )}
        </div>
      )}
    </div>
  );
}
