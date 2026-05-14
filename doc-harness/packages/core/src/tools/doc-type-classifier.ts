import { tool } from "ai";
import { z } from "zod";
import { docTypeRegistry, getDocTypeEntry } from "../registry/doc-type-registry";
import { DocumentTypeSchema } from "../types";

export const docTypeClassifier = tool({
  description:
    "Determine which document types to generate based on a user prompt. Returns relevant document types with slugs and tracks.",
  inputSchema: z.object({
    prompt: z.string().describe("The user's full prompt describing what they want documented"),
    explicitTypes: z.array(DocumentTypeSchema).optional().describe("Any document types the user explicitly mentioned"),
  }),
  execute: async ({ prompt, explicitTypes }) => {
    const promptLower = prompt.toLowerCase();

    const keywordMap: Record<string, string[]> = {
      prd: ["product requirement", "feature spec", "product spec", "what to build", "prd"],
      idea: ["brainstorm", "explore", "concept", "idea", "maybe"],
      plan: ["implement", "roadmap", "timeline", "milestone", "sprint", "tasks"],
      mrd: ["market", "competitor", "tam", "industry", "market analysis"],
      brd: ["business case", "roi", "budget", "stakeholder", "business requirement"],
      urd: ["user persona", "user journey", "user need", "ux", "usability"],
      brs: ["business specification", "iso business", "formal business"],
      strs: ["stakeholder specification", "stakeholder class", "conops"],
      syrs: ["system boundary", "system interface", "system requirement", "system spec"],
      srs: ["software requirement", "functional requirement", "api endpoint", "srs"],
      adr: ["architecture decision", "tech decision", "choose technology", "adr"],
      rfc: ["proposal", "propose change", "request for comment", "rfc"],
      rule: ["standard", "convention", "coding rule", "must follow", "policy"],
      guide: ["how to", "tutorial", "walkthrough", "steps", "guide", "instructions"],
      spec: ["contract", "interface spec", "api spec", "protocol", "normative"],
      doc: ["glossary", "reference", "lookup", "registry", "component list"],
      "task-type": ["workflow", "repeatable", "task pattern", "checklist"],
      cpat: ["pattern change", "refactor pattern", "coding convention change"],
    };

    const matchedTypes = new Set(explicitTypes ?? []);

    for (const [type, keywords] of Object.entries(keywordMap)) {
      if (keywords.some((kw) => promptLower.includes(kw))) {
        matchedTypes.add(type as typeof DocumentTypeSchema._type);
      }
    }

    if (matchedTypes.size === 0) {
      matchedTypes.add("prd");
      matchedTypes.add("adr");
      matchedTypes.add("plan");
    }

    const docs = Array.from(matchedTypes).map((type) => {
      const entry = getDocTypeEntry(type);
      return {
        type,
        slug: generateSlug(type, promptLower),
        title: `${entry.label}: ${extractTitle(prompt)}`,
        track: entry.track,
      };
    });

    return { docs };
  },
});

function generateSlug(type: string, prompt: string): string {
  const words = prompt
    .replace(/[^a-zA-Z0-9\s]/g, "")
    .split(/\s+/)
    .slice(0, 4)
    .map((w) => w.toLowerCase())
    .join("-");
  return `${words}-${type}`;
}

function extractTitle(prompt: string): string {
  const firstLine = prompt.split(/[.\n]/)[0] ?? prompt;
  return firstLine.slice(0, 80);
}
