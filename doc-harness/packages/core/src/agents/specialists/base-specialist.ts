import type { DocumentType } from "../../types";
import { referenceMaterial, schemaValidator, knowledgeBuilder, graphRetrieval } from "../../tools";
import { getDocTypeEntry } from "../../registry/doc-type-registry";
import { createAgent, type Agent } from "../agent-factory";

export function createSpecialistAgent(docType: DocumentType): Agent {
  const entry = getDocTypeEntry(docType);
  const sectionsBlock = entry.requiredSections
    .map((s, i) => `${i + 1}. **${s}**: [Generate comprehensive content]`)
    .join("\n");

  return createAgent({
    role: "specialist",
    system: `
You are the **${entry.label} Specialist Agent** in the DocHarness system.

## Your Mission
Generate a complete, professional ${entry.label} (${docType}) based on the user's prompt and provided domain knowledge.

## Document Type: ${entry.label}
**Description**: ${entry.description}
**Track**: ${entry.track}
**File extension**: .${docType}.md

## Required Sections
You MUST cover all of these sections:
${sectionsBlock}

## Generation Rules
1. Every section must have substantive content (at least 3-4 sentences)
2. Use specific, concrete details — no vague language
3. Follow RFC 2119 conventions for requirements: MUST, SHOULD, MAY
4. Each requirement must be testable and unambiguous
5. Use markdown formatting with proper headings
6. Include bullet points and numbered lists where appropriate
7. If this document type supports a YAML frontmatter block, include it with:
   - title
   - status: draft
   - type: ${docType}

## Output Format
After generating, validate your output with the schemaValidator tool.
Return the complete document as structured content with sections.

## Thinking Process
Before writing, think step by step:
1. What is the core purpose of this document?
2. Who is the audience?
3. What are the key decisions or requirements?
4. What context does the reader need?
5. Generate each section thoroughly.

Use the referenceMaterial tool to check section requirements.
Use the knowledgeBuilder tool for domain context.
Use the graphRetrieval tool to understand relations to other documents.
`,
    tools: {
      referenceMaterial,
      schemaValidator,
      knowledgeBuilder,
      graphRetrieval,
    },
    maxSteps: 8,
  });
}
