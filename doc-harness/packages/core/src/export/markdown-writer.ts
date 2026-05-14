import type { GeneratedDocument } from "../types";

export function documentToMarkdown(doc: GeneratedDocument): string {
  const lines: string[] = [];
  lines.push(`# ${doc.title}`);
  lines.push("");
  lines.push(`> **Type:** ${doc.type} | **Slug:** ${doc.slug}`);
  lines.push("");
  lines.push(doc.content);
  return lines.join("\n");
}
