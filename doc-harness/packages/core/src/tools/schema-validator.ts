import { tool } from "ai";
import { z } from "zod";
import { GeneratedDocumentSchema } from "../types";
import { getDocTypeEntry } from "../registry/doc-type-registry";

export const schemaValidator = tool({
  description:
    "Validates a generated document against its type's required sections and structure requirements.",
  inputSchema: z.object({
    document: GeneratedDocumentSchema,
  }),
  execute: async ({ document }) => {
    const entry = getDocTypeEntry(document.type);
    const missingSections = entry.requiredSections.filter(
      (required) => !document.sections.some(
        (s) => s.heading.toLowerCase().includes(required.toLowerCase())
      )
    );

    const issues: string[] = [];

    if (missingSections.length > 0) {
      issues.push(`Missing required sections: ${missingSections.join(", ")}`);
    }

    const emptySections = document.sections.filter((s) => s.body.trim().length < 20);
    if (emptySections.length > 0) {
      issues.push(
        `Sections with minimal content: ${emptySections.map((s) => s.heading).join(", ")}`
      );
    }

    if (document.content.length < 200) {
      issues.push("Document content is too short (under 200 characters)");
    }

    return {
      valid: issues.length === 0,
      issues,
      docType: document.type,
      slug: document.slug,
      sectionCount: document.sections.length,
      requiredSectionCount: entry.requiredSections.length,
      contentLength: document.content.length,
    };
  },
});
