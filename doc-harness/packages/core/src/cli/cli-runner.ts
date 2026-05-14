import { runPipeline } from "../pipeline/pipeline-orchestrator";
import { documentToMarkdown, buildZip } from "../export";
import type { PipelineEvent } from "../types";
import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

interface CLIOptions {
  output?: string;
  model?: string;
}

export async function runCLI(prompt: string, options: CLIOptions = {}): Promise<void> {
  const outputDir = resolve(options.output ?? "./docs");
  if (options.model) {
    process.env.DOC_HARNESS_MODEL = options.model;
  }

  console.log(`\nDocHarness — Generating documentation for: "${prompt}"\n`);
  console.log(`Output directory: ${outputDir}\n`);

  const startTime = Date.now();

  const emit = (event: PipelineEvent) => {
    switch (event.phase) {
      case "intake":
        if (event.docs.length > 0) {
          console.log(`→ Intake: ${event.docs.length} document types identified`);
        }
        break;
      case "generation":
        if (event.status === "started") {
          console.log(`→ Generating: ${event.slug} (${event.docType})`);
        }
        break;
      case "debate-verdict":
        console.log(`→ Debate verdict for ${event.slug}: ${event.verdict.verdict}`);
        break;
      case "complete":
        console.log(`\n✓ Pipeline complete — ${event.docCount} documents generated`);
        break;
      case "error":
        console.error(`✗ Error: ${event.message}`);
        break;
    }
  };

  try {
    const result = await runPipeline(prompt, emit);

    await mkdir(outputDir, { recursive: true });

    for (const doc of result.documents) {
      const md = documentToMarkdown(doc);
      const safeSlug = doc.slug.replace(/[^a-zA-Z0-9_-]/g, "_");
      const filePath = join(outputDir, `${safeSlug}.${doc.type}.md`);
      await writeFile(filePath, md, "utf-8");
      console.log(`  ✓ Wrote ${safeSlug}.${doc.type}.md`);
    }

    const zipPath = resolve(outputDir, "..", `docs-${Date.now()}.zip`);
    await buildZip(result.documents, zipPath);
    console.log(`  ✓ Created ZIP: ${zipPath}`);

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\n✓ Done in ${elapsed}s — ${result.documents.length} documents written to ${outputDir}\n`);
  } catch (err) {
    console.error(`\n✗ Pipeline failed: ${err instanceof Error ? err.message : err}`);
    process.exit(1);
  }
}
