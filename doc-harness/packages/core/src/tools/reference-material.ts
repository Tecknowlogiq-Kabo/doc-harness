import { tool } from "ai";
import { z } from "zod";
import { docTypeRegistry, getDocTypeEntry } from "../registry/doc-type-registry";

export const referenceMaterial = tool({
  description:
    "Retrieves reference material for a document type: includes required sections, formatting templates, and example structures.",
  inputSchema: z.object({
    docType: z.string().describe("The document type to get reference material for"),
  }),
  execute: async ({ docType }) => {
    const type = docType as keyof typeof docTypeRegistry;
    const entry = getDocTypeEntry(type);

    if (!entry) {
      return { error: `Unknown document type: ${docType}` };
    }

    return {
      docType,
      label: entry.label,
      description: entry.description,
      requiredSections: entry.requiredSections,
      track: entry.track,
      template: entry.template,
      suggestedStructure: entry.requiredSections.map((section, i) => ({
        section,
        order: i + 1,
        guidance: getSectionGuidance(docType, section),
      })),
    };
  },
});

function getSectionGuidance(docType: string, section: string): string {
  const guidance: Record<string, Record<string, string>> = {
    prd: {
      Vision: "Describe the aspirational future state. One paragraph.",
      "Problem Statement": "What problem does this solve? Be specific about who has the problem and why.",
      "Goals & Success Metrics": "SMART goals with measurable outcomes.",
      Requirements: "Numbered list of functional and non-functional requirements. Each must be testable.",
    },
    adr: {
      Context: "What is the issue we're addressing? Include relevant constraints (technical, business, timeline).",
      Decision: "What did we decide? Be specific about the choice made.",
      "Alternatives Considered": "What other options were evaluated? Why were they rejected?",
      Consequences: "What becomes easier or harder because of this decision? Include both positive and negative.",
    },
    rule: {
      Rule: "Imperative statements numbered. Use MUST/SHOULD/MAY per RFC 2119.",
      Rationale: "Why does this rule exist? What problem does it prevent?",
      "Examples (Good/Bad)": "Code or text examples illustrating compliance and violation.",
      Enforcement: "How is this rule enforced? Linting? Code review? Automated checks?",
    },
    guide: {
      Prerequisites: "What must the reader have installed or know before starting?",
      "Steps (numbered)": "Clear, numbered steps. Each step should be one action.",
      Verification: "How does the reader confirm each step worked? Include expected output.",
      "Common Issues": "What might go wrong and how to fix it?",
    },
  };

  return guidance[docType]?.[section] ?? "Provide thorough, specific content for this section.";
}
