export async function GET() {
  try {
    const res = await fetch("https://ollama.com/api/tags");
    const data = await res.json();
    return Response.json(data);
  } catch {
    return Response.json({ models: [] });
  }
}
