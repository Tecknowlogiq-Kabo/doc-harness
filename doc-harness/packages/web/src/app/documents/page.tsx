"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { DataTable } from "@/components/data-table";
import type { GeneratedDocument } from "@doc-harness/core";

type DocRow = Record<string, unknown> & {
  slug: string;
  type: string;
  title: string;
  sessionPrompt: string;
  sessionId: string;
};

export default function DocumentsPage() {
  const [docs, setDocs] = useState<DocRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/sessions?limit=100")
      .then((res) => res.json())
      .then((sessions: Array<{ id: string; prompt: string; documents: GeneratedDocument[] }>) => {
        const allDocs: DocRow[] = [];
        for (const s of sessions) {
          for (const doc of s.documents) {
            allDocs.push({
              slug: doc.slug,
              type: doc.type,
              title: doc.title,
              sessionPrompt: s.prompt.slice(0, 60),
              sessionId: s.id,
            });
          }
        }
        setDocs(allDocs);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const columns = [
    { key: "title", header: "Document" },
    { key: "type", header: "Type", className: "uppercase text-text-muted" },
    { key: "sessionPrompt", header: "Session" },
  ];

  return (
    <div>
      <PageHeader title="Documents" description={`${docs.length} documents across all sessions`} />
      {loading ? (
        <div className="p-8 text-center text-text-muted">Loading...</div>
      ) : (
        <DataTable
          columns={columns}
          data={docs}
          searchPlaceholder="Search documents..."
          searchFields={["title", "type", "slug"]}
          onRowClick={(doc) => window.open(`/session/${doc.sessionId}?prompt=${encodeURIComponent(String(doc.sessionPrompt))}`, "_self")}
        />
      )}
    </div>
  );
}
