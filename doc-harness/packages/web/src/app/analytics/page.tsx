"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";

interface SessionSummary {
  id: string;
  prompt: string;
  status: string;
  documents: unknown[];
  createdAt: string;
  completedAt: string | null;
}

export default function AnalyticsPage() {
  const [stats, setStats] = useState({
    totalSessions: 0,
    completedSessions: 0,
    failedSessions: 0,
    totalDocuments: 0,
    successRate: "0%",
    avgDocuments: 0,
  });
  const [recent, setRecent] = useState<SessionSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/sessions?limit=100")
      .then((res) => res.json())
      .then((sessions: SessionSummary[]) => {
        const completed = sessions.filter((s) => s.status === "completed");
        const failed = sessions.filter((s) => s.status === "failed");
        const totalDocs = sessions.reduce((sum, s) => sum + s.documents.length, 0);

        setStats({
          totalSessions: sessions.length,
          completedSessions: completed.length,
          failedSessions: failed.length,
          totalDocuments: totalDocs,
          successRate: sessions.length > 0
            ? `${Math.round((completed.length / sessions.length) * 100)}%`
            : "0%",
          avgDocuments: completed.length > 0
            ? Math.round(totalDocs / completed.length)
            : 0,
        });
        setRecent(sessions.slice(0, 10));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div>
        <PageHeader title="Analytics" />
        <div className="p-8 text-center text-text-muted">Loading...</div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Analytics" description="Pipeline usage and performance metrics" />

      <div className="p-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard label="Total Sessions" value={stats.totalSessions} icon="📊" />
          <StatCard label="Success Rate" value={stats.successRate} trend={`${stats.completedSessions} completed`} icon="✅" />
          <StatCard label="Documents Generated" value={stats.totalDocuments} trend={`~${stats.avgDocuments} per session`} icon="📄" />
          <StatCard label="Failed" value={stats.failedSessions} trend={`${stats.failedSessions} sessions`} icon="❌" />
        </div>

        <div className="bg-surface border border-border rounded-lg p-6">
          <h3 className="text-sm font-semibold text-text-muted uppercase tracking-wider mb-4">Recent Activity</h3>
          <div className="space-y-2">
            {recent.map((s) => (
              <div key={s.id} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                <div>
                  <div className="text-sm font-medium">{s.prompt.slice(0, 70)}{s.prompt.length > 70 ? "..." : ""}</div>
                  <div className="text-xs text-text-muted mt-0.5">
                    {s.documents.length} docs · {new Date(s.createdAt).toLocaleDateString()}
                  </div>
                </div>
                <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                  s.status === "completed" ? "bg-green-950 text-success"
                  : s.status === "failed" ? "bg-red-950 text-error"
                  : "bg-yellow-950 text-warning"
                }`}>
                  {s.status}
                </span>
              </div>
            ))}
            {recent.length === 0 && (
              <div className="text-text-muted text-sm text-center py-4">No sessions yet</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
