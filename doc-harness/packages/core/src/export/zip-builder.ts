import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { GeneratedDocument } from "../types";
import { documentToMarkdown } from "./markdown-writer";

export async function buildZip(
  documents: GeneratedDocument[],
  outputPath: string
): Promise<void> {
  const tmpDir = await mkdtemp(join(tmpdir(), "doc-harness-"));
  try {
    for (const doc of documents) {
      const md = documentToMarkdown(doc);
      const safeSlug = doc.slug.replace(/[^a-zA-Z0-9_-]/g, "_");
      await writeFile(join(tmpDir, `${safeSlug}.${doc.type}.md`), md, "utf-8");
    }

    const { execSync } = await import("node:child_process");
    execSync(`cd "${tmpDir}" && zip -r "${outputPath}" .`, { stdio: "pipe" });
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }
}

export async function buildZipBuffer(documents: GeneratedDocument[]): Promise<Buffer> {
  const tmpDir = await mkdtemp(join(tmpdir(), "doc-harness-zip-"));
  const outputPath = join(tmpDir, "docs.zip");
  try {
    await buildZip(documents, outputPath);
    const { readFile } = await import("node:fs/promises");
    return await readFile(outputPath);
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }
}
