import Link from "next/link";

interface SessionSummary {
  id: string;
  prompt: string;
  status: string;
  documents: unknown[];
  createdAt: string;
}

async function getSessions(): Promise<SessionSummary[]> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
    const res = await fetch(`${baseUrl}/api/sessions`, { cache: "no-store" });
    return await res.json();
  } catch {
    return [];
  }
}

export default async function SessionsPage() {
  const sessions = await getSessions();

  return (
    <main className="max-w-3xl mx-auto p-8">
      <nav className="mb-8 flex justify-between items-center">
        <Link href="/" className="text-lg font-bold text-primary no-underline">DocHarness</Link>
        <Link href="/sessions" className="text-sm text-text-muted hover:text-text transition-colors">History</Link>
      </nav>

      <div className="flex justify-between items-center mb-6">
        <h1 className="text-xl font-bold">Session History</h1>
        <Link href="/" className="text-primary no-underline text-sm">
          + New Generation
        </Link>
      </div>

      {sessions.length === 0 ? (
        <div className="text-text-muted text-center py-16">
          No sessions yet.{" "}
          <Link href="/" className="text-primary">Generate your first docs</Link>.
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {sessions.map((s) => (
            <Link
              key={s.id}
              href={`/session/${s.id}?prompt=${encodeURIComponent(s.prompt)}`}
              className="p-4 bg-surface rounded-lg border border-border no-underline text-text block hover:border-primary transition-colors"
            >
              <div className="flex justify-between items-center">
                <div>
                  <div className="font-semibold mb-1">
                    {s.prompt.slice(0, 80)}{s.prompt.length > 80 ? "..." : ""}
                  </div>
                  <div className="text-xs text-text-muted">
                    {s.documents.length} docs · {new Date(s.createdAt).toLocaleDateString()}
                  </div>
                </div>
                <span className={`px-2 py-1 rounded text-xs font-semibold uppercase ${
                  s.status === "completed" ? "bg-green-950 text-success"
                  : s.status === "failed" ? "bg-red-950 text-error"
                  : "bg-yellow-950 text-warning"
                }`}>
                  {s.status}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
