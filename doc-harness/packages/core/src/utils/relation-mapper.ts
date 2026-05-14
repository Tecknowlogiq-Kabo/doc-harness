import type { GeneratedDocument, DocumentRelation } from "../types";
import { getSuggestedRelations, getDocTypeEntry } from "../registry/doc-type-registry";

export function mapDocumentRelations(docs: GeneratedDocument[]): DocumentRelation[] {
  const relations: DocumentRelation[] = [];
  const slugsByType = new Map<string, string>();

  for (const doc of docs) {
    slugsByType.set(doc.type, doc.slug);
  }

  for (const doc of docs) {
    const suggested = getSuggestedRelations(doc.type);
    for (const rel of suggested) {
      const targetSlug = slugsByType.get(rel.targetType);
      if (targetSlug && targetSlug !== doc.slug) {
        const exists = relations.some(
          (r) =>
            r.source === doc.slug &&
            r.target === targetSlug &&
            r.type === rel.relation
        );
        if (!exists) {
          relations.push({
            source: doc.slug,
            target: targetSlug,
            type: rel.relation,
          });
        }
      }
    }
  }

  return relations;
}

export function formatDocumentOutput(doc: GeneratedDocument): string {
  const lines: string[] = [];
  const entry = getDocTypeEntry(doc.type);

  lines.push("---");
  lines.push(`title: "${doc.title}"`);
  lines.push(`status: draft`);
  lines.push(`type: ${doc.type}`);
  lines.push(`slug: ${doc.slug}`);
  lines.push("---");
  lines.push("");

  for (const section of doc.sections) {
    lines.push(`## ${section.heading}`);
    lines.push("");
    lines.push(section.body);
    lines.push("");
  }

  return lines.join("\n");
}

export function formatRelationsOutput(relations: DocumentRelation[]): string {
  const output: Record<string, { target: string; type: string }[]> = {};

  for (const rel of relations) {
    if (!output[rel.source]) {
      output[rel.source] = [];
    }
    output[rel.source].push({ target: rel.target, type: rel.type });
  }

  return JSON.stringify({ relations: output }, null, 2);
}
