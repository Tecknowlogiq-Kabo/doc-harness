export async function GET() {
  try {
    const res = await fetch("https://ollama.com/v1/models");
    const data = await res.json();
    return Response.json({ models: (data.data ?? []).map((m: { id: string }) => ({ name: m.id, size: 0 })) });
  } catch {
    return Response.json({ models: [] });
  }
}
