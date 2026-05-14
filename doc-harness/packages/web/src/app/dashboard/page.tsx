"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { StatusBadge } from "@/components/status-badge";

interface SessionSummary {
  id: string;
  prompt: string;
  status: string;
  documents: unknown[];
  createdAt: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const [stats, setStats] = useState({ sessions: 0, docs: 0, completed: 0, failed: 0 });
  const [recent, setRecent] = useState<SessionSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/sessions?limit=20")
      .then((res) => res.json())
      .then((sessions: SessionSummary[]) => {
        const completed = sessions.filter((s) => s.status === "completed");
        setStats({
          sessions: sessions.length,
          docs: sessions.reduce((sum, s) => sum + s.documents.length, 0),
          completed: completed.length,
          failed: sessions.filter((s) => s.status === "failed").length,
        });
        setRecent(sessions.slice(0, 5));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="Overview of your documentation pipeline"
        actions={
          <button
            onClick={() => router.push("/generate")}
            className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-hover transition-colors"
          >
            + New Generation
          </button>
        }
      />

      <div className="p-6">
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1,2,3,4].map((i) => (
              <div key={i} className="p-4 bg-surface border border-border rounded-lg animate-pulse">
                <div className="h-3 bg-border rounded w-24 mb-3" />
                <div className="h-6 bg-border rounded w-16" />
              </div>
            ))}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              <StatCard label="Total Sessions" value={stats.sessions} icon="📊" />
              <StatCard label="Documents Generated" value={stats.docs} icon="📄" />
              <StatCard label="Completed" value={stats.completed} trend={`${stats.sessions > 0 ? Math.round((stats.completed / stats.sessions) * 100) : 0}% success rate`} icon="✅" />
              <StatCard label="Failed" value={stats.failed} icon="❌" />
            </div>

            <div className="bg-surface border border-border rounded-lg">
              <div className="p-4 border-b border-border flex items-center justify-between">
                <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wider">Recent Sessions</h2>
                <button onClick={() => router.push("/sessions")} className="text-xs text-primary hover:underline">View all</button>
              </div>
              {recent.length === 0 ? (
                <div className="p-8 text-center">
                  <p className="text-text-muted mb-4">No sessions yet. Generate your first documentation suite.</p>
                  <button onClick={() => router.push("/generate")} className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-hover transition-colors">
                    Get Started
                  </button>
                </div>
              ) : (
                <div className="divide-y divide-border/50">
                  {recent.map((s) => (
                    <div
                      key={s.id}
                      onClick={() => router.push(`/session/${s.id}?prompt=${encodeURIComponent(s.prompt)}`)}
                      className="flex items-center gap-4 p-4 cursor-pointer hover:bg-surface-hover transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{s.prompt.slice(0, 80)}</div>
                        <div className="text-xs text-text-muted mt-0.5">
                          {s.documents.length} docs · {new Date(s.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                      <StatusBadge status={s.status as "running" | "completed" | "failed"} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
