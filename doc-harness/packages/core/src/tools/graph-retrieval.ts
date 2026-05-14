import { tool } from "ai";
import { z } from "zod";
import { DocumentTypeSchema } from "../types";
import { getDocTypeEntry, getSuggestedRelations } from "../registry/doc-type-registry";

export const graphRetrieval = tool({
  description:
    "Retrieves structural context for a document including its relations to other document types and position in the document graph.",
  inputSchema: z.object({
    docType: DocumentTypeSchema,
    otherTypes: z.array(DocumentTypeSchema).optional().describe("Other document types being generated"),
  }),
  execute: async ({ docType, otherTypes = [] }) => {
    const entry = getDocTypeEntry(docType);
    const suggestedRelations = getSuggestedRelations(docType);

    const crossDocRelations = suggestedRelations.filter((rel) =>
      otherTypes.includes(rel.targetType)
    );

    return {
      docType,
      track: entry.track,
      layer: entry.track === "vision" ? "Vision" : entry.track === "knowledge" ? "Knowledge" : "Experience",
      position: entry.track === "vision"
        ? "This is a Vision-layer document. It captures requirements and direction."
        : entry.track === "knowledge"
        ? "This is a Knowledge-layer document. It records decisions, standards, and reference material."
        : "This is an Experience-layer document. It captures patterns learned from doing the work.",
      relations: crossDocRelations,
      relatedToOtherDocs: crossDocRelations.map((rel) => ({
        type: rel.targetType,
        relation: rel.relation,
        reasoning:
          rel.relation === "implements"
            ? `This ${docType} implements requirements from the ${rel.targetType}`
            : rel.relation === "extends"
            ? `This ${docType} builds upon the ${rel.targetType}`
            : rel.relation === "depends_on"
            ? `This ${docType} requires the ${rel.targetType} to make sense`
            : `This ${docType} is associated with the ${rel.targetType}`,
      })),
    };
  },
});
