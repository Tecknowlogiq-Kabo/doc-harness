import type { Agent } from "../agents/agent-factory";
import type { GeneratedDocument, DocTarget } from "../types";

interface ParallelTask {
  agent: Agent;
  target: DocTarget;
  prompt: string;
}

interface ParallelResult {
  target: DocTarget;
  document: GeneratedDocument;
}

interface ParallelBatchResult {
  succeeded: ParallelResult[];
  failed: { target: DocTarget; error: string }[];
}

export async function runParallelGeneration(
  tasks: ParallelTask[],
  onProgress: (completed: number, total: number) => void
): Promise<ParallelBatchResult> {
  const total = tasks.length;
  let completed = 0;

  const promises = tasks.map(async (task) => {
    try {
      const result = await task.agent.generate(task.prompt);

      const document: GeneratedDocument = {
        slug: task.target.slug,
        type: task.target.type,
        title: task.target.title,
        content: result.text,
        sections: extractSectionsFromText(result.text),
      };

      completed++;
      onProgress(completed, total);

      return { target: task.target, document };
    } catch (err) {
      completed++;
      onProgress(completed, total);

      return {
        target: task.target,
        error: err instanceof Error ? err.message : "Unknown error",
      };
    }
  });

  const results = await Promise.allSettled(promises);

  const succeeded: ParallelResult[] = [];
  const failed: { target: DocTarget; error: string }[] = [];

  for (const result of results) {
    if (result.status === "fulfilled") {
      if ("error" in result.value) {
        failed.push(result.value as { target: DocTarget; error: string });
      } else {
        succeeded.push(result.value as ParallelResult);
      }
    } else {
      failed.push({
        target: { type: "prd", slug: "unknown", title: "Unknown", track: "vision" },
        error: result.reason?.message ?? "Unknown error",
      });
    }
  }

  return { succeeded, failed };
}

function extractSectionsFromText(text: string): { heading: string; body: string }[] {
  const sections: { heading: string; body: string }[] = [];
  const headingRegex = /^#{1,4}\s+(.+)$/gm;

  let lastIndex = 0;
  let lastHeading = "";
  let match: RegExpExecArray | null;

  while ((match = headingRegex.exec(text)) !== null) {
    if (lastHeading) {
      const body = text.slice(lastIndex, match.index).trim();
      if (body.length > 0) {
        sections.push({ heading: lastHeading, body });
      }
    }
    lastHeading = match[1].trim();
    lastIndex = match.index + match[0].length;
  }

  if (lastHeading) {
    const body = text.slice(lastIndex).trim();
    if (body.length > 0) {
      sections.push({ heading: lastHeading, body });
    }
  }

  if (sections.length === 0 && text.length > 0) {
    sections.push({ heading: "Content", body: text });
  }

  return sections;
}

export function createParallelTask(
  agent: Agent,
  target: DocTarget,
  prompt: string
): ParallelTask {
  return { agent, target, prompt };
}
