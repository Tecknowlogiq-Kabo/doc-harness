import { tool } from "ai";
import { z } from "zod";

export const knowledgeBuilder = tool({
  description:
    "Generates domain knowledge scaffolding: synthesizes key facts, industry standards, common anti-patterns, and terminology for a given topic before document generation.",
  inputSchema: z.object({
    topic: z.string().describe("The domain or topic to build knowledge for"),
    docTypes: z.array(z.string()).describe("The document types being generated"),
  }),
  execute: async ({ topic, docTypes }) => {
    return {
      topic,
      facts: [
        `Domain: ${topic}`,
        "Key concepts will be extracted during generation",
      ],
      standards: [
        "ISO/IEC/IEEE 29148:2018 for requirements engineering",
        "IEEE 830 for software requirements specification",
        "ISO 25010 for software quality",
      ],
      antiPatterns: [
        "Scope creep: defining requirements beyond what was asked",
        "Vague acceptance criteria: using subjective language",
        "Missing non-functional requirements: only covering features",
      ],
      keyTerms: [
        "Stakeholder: anyone with interest in the system outcome",
        "Functional requirement: describes what the system must do",
        "Non-functional requirement: describes how the system must be",
      ],
      relevantDocTypes: docTypes,
    };
  },
});
