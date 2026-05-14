"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { DataTable } from "@/components/data-table";
import { StatusBadge } from "@/components/status-badge";

interface SessionSummary {
  [key: string]: unknown;
  id: string;
  prompt: string;
  status: "running" | "completed" | "failed";
  documents: unknown[];
  createdAt: string;
}

export default function SessionsPage() {
  const router = useRouter();
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/sessions?limit=100")
      .then((res) => res.json())
      .then((data: SessionSummary[]) => setSessions(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const columns = [
    {
      key: "prompt",
      header: "Prompt",
      render: (s: SessionSummary) => (
        <span className="truncate block max-w-xs">{s.prompt}</span>
      ),
    },
    {
      key: "documents",
      header: "Docs",
      className: "w-20",
      render: (s: SessionSummary) => s.documents.length,
    },
    {
      key: "status",
      header: "Status",
      className: "w-28",
      render: (s: SessionSummary) => <StatusBadge status={s.status} />,
    },
    {
      key: "createdAt",
      header: "Created",
      className: "w-40",
      render: (s: SessionSummary) => (
        <span className="text-text-muted">{new Date(s.createdAt).toLocaleString()}</span>
      ),
    },
  ];

  return (
    <div>
      <PageHeader title="History" description={`${sessions.length} sessions`} />
      {loading ? (
        <div className="p-8 text-center text-text-muted">Loading...</div>
      ) : (
        <DataTable
          columns={columns}
          data={sessions}
          searchPlaceholder="Search sessions..."
          searchFields={["prompt"]}
          onRowClick={(s) => router.push(`/session/${s.id}?prompt=${encodeURIComponent(s.prompt)}`)}
        />
      )}
    </div>
  );
}
