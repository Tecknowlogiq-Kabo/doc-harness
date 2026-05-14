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
    <main style={{ maxWidth: 900, margin: "0 auto", padding: "2rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
        <h1 style={{ fontSize: "1.5rem" }}>Session History</h1>
        <Link href="/" style={{ color: "#7c3aed", textDecoration: "none", fontSize: "0.9rem" }}>
          + New Generation
        </Link>
      </div>

      {sessions.length === 0 ? (
        <div style={{ color: "#666", textAlign: "center", padding: "4rem 0" }}>
          No sessions yet.{" "}
          <Link href="/" style={{ color: "#7c3aed" }}>Generate your first docs</Link>.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {sessions.map((s) => (
            <Link
              key={s.id}
              href={`/session/${s.id}?prompt=${encodeURIComponent(s.prompt)}`}
              style={{
                padding: "1rem",
                background: "#1a1a1a",
                borderRadius: 8,
                border: "1px solid #333",
                textDecoration: "none",
                color: "#e0e0e0",
                display: "block",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontWeight: 600, marginBottom: "0.25rem" }}>
                    {s.prompt.slice(0, 80)}{s.prompt.length > 80 ? "..." : ""}
                  </div>
                  <div style={{ fontSize: "0.8rem", color: "#888" }}>
                    {s.documents.length} docs · {new Date(s.createdAt).toLocaleDateString()}
                  </div>
                </div>
                <span style={{
                  padding: "0.2rem 0.5rem",
                  borderRadius: 4,
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  background: s.status === "completed" ? "#14532d" : s.status === "failed" ? "#450a0a" : "#422006",
                  color: s.status === "completed" ? "#22c55e" : s.status === "failed" ? "#ef4444" : "#eab308",
                }}>
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
