import { NextRequest } from "next/server";
import { SQLiteStore } from "@doc-harness/core";

const store = new SQLiteStore();

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const limit = parseInt(searchParams.get("limit") ?? "20", 10);
  const sessions = await store.list(limit);
  return Response.json(sessions);
}
