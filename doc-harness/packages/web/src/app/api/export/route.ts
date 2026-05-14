import { NextRequest } from "next/server";
import { buildZipBuffer } from "@doc-harness/core";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { documents } = body;

  if (!documents || !Array.isArray(documents)) {
    return new Response(JSON.stringify({ error: "Documents array required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const buffer = await buildZipBuffer(documents);
    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="documents-${Date.now()}.zip"`,
      },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Export failed" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
