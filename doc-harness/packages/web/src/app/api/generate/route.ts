import { NextRequest } from "next/server";
import { runPipeline } from "@doc-harness/core";
import type { PipelineEvent } from "@doc-harness/core";

export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const { prompt } = await req.json();

  if (!prompt || typeof prompt !== "string") {
    return new Response(JSON.stringify({ error: "Prompt is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const encoder = new TextEncoder();
  let isClosed = false;

  const stream = new ReadableStream({
    async start(controller) {
      const emit = (event: PipelineEvent) => {
        if (isClosed) return;
        try {
          const data = encoder.encode(`data: ${JSON.stringify(event)}\n\n`);
          controller.enqueue(data);
        } catch {
          isClosed = true;
        }
      };

      try {
        await runPipeline(prompt, emit);
      } catch (err) {
        if (!isClosed) {
          emit({
            phase: "error",
            message: err instanceof Error ? err.message : "Pipeline failed",
          });
        }
      } finally {
        if (!isClosed) {
          try {
            controller.close();
          } catch {
            // Already closed
          }
        }
      }
    },
    cancel() {
      isClosed = true;
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
