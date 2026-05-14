import type { Agent } from "../agents/agent-factory";
import { intakeAgent } from "../agents/orchestrator/intake-agent";
import { discoveryAgent } from "../agents/orchestrator/discovery-agent";
import { reviewerAgent } from "../agents/orchestrator/reviewer-agent";
import { supervisorAgent } from "../agents/orchestrator/supervisor-agent";
import { runDebate } from "../agents/debate/debate-orchestrator";
import { scoreDocument } from "../scorers/document-scorers";
import {
  prdAgent, ideaAgent, planAgent,
  mrdAgent, brdAgent, urdAgent,
  brsAgent, strsAgent, syrsAgent, srsAgent,
  adrAgent, rfcAgent, ruleAgent, guideAgent, specAgent, docAgent,
  taskTypeAgent, cpatAgent,
} from "../agents/specialists";
import type {
  DocumentManifest, DocTarget, GeneratedDocument,
  PipelineEvent, DocumentRelation,
} from "../types";
import { getDocTypeEntry, getSuggestedRelations } from "../registry/doc-type-registry";

const specialistMap: Record<string, Agent> = {
  "prd-agent": prdAgent, "idea-agent": ideaAgent, "plan-agent": planAgent,
  "mrd-agent": mrdAgent, "brd-agent": brdAgent, "urd-agent": urdAgent,
  "brs-agent": brsAgent, "strs-agent": strsAgent, "syrs-agent": syrsAgent, "srs-agent": srsAgent,
  "adr-agent": adrAgent, "rfc-agent": rfcAgent, "rule-agent": ruleAgent,
  "guide-agent": guideAgent, "spec-agent": specAgent, "doc-agent": docAgent,
  "task-type-agent": taskTypeAgent, "cpat-agent": cpatAgent,
};

export type PipelineEmitter = (event: PipelineEvent) => void;
export type PipelineResult = {
  documents: GeneratedDocument[];
  relations: DocumentRelation[];
  manifest: DocumentManifest;
};

export async function runPipeline(
  userPrompt: string,
  emit: PipelineEmitter
): Promise<PipelineResult> {
  emit({ phase: "intake", docs: [] });

  const intakeResult = await intakeAgent.generate(
    `User prompt: "${userPrompt}"\n\nClassify this prompt and determine which document types to generate. Use the docTypeClassifier tool.`
  );

  const manifest: DocumentManifest = { userPrompt, docs: [] };
  try {
    const parsed = JSON.parse(extractJSON(intakeResult.text));
    manifest.docs = parsed.docs || [];
  } catch {
    manifest.docs = [
      { type: "prd", slug: "requirements-prd", title: "Product Requirements", track: "vision" },
      { type: "adr", slug: "architecture-adr", title: "Architecture Decisions", track: "knowledge" },
      { type: "plan", slug: "implementation-plan", title: "Implementation Plan", track: "vision" },
    ];
  }

  emit({ phase: "intake", docs: manifest.docs });

  emit({ phase: "discovery", progress: 0, facts: 0 });

  const docTypeList = manifest.docs.map((d) => d.type).join(", ");
  await discoveryAgent.generate(
    `Build domain knowledge for: "${userPrompt}"\n\nDocument types to generate: ${docTypeList}`
  );

  emit({ phase: "discovery", progress: 100, facts: 5 });

  const totalDocs = manifest.docs.length;
  let completedDocs = 0;
  const generatedDocs: GeneratedDocument[] = [];

  const generatePromises = manifest.docs.map(async (docTarget) => {
    emit({
      phase: "generation",
      docType: docTarget.type,
      slug: docTarget.slug,
      status: "started",
      total: totalDocs,
      completed: completedDocs,
    });

    try {
      const agent = getAgentForTarget(docTarget);
      const doc = await generateDocument(agent, docTarget, userPrompt);

      completedDocs++;
      emit({
        phase: "generation",
        docType: docTarget.type,
        slug: docTarget.slug,
        status: "completed",
        total: totalDocs,
        completed: completedDocs,
      });

      generatedDocs.push(doc);
      return doc;
    } catch {
      completedDocs++;
      emit({
        phase: "generation",
        docType: docTarget.type,
        slug: docTarget.slug,
        status: "failed",
        total: totalDocs,
        completed: completedDocs,
      });
      return null;
    }
  });

  const results = await Promise.allSettled(generatePromises);
  const validDocs = results
    .filter((r) => r.status === "fulfilled" && r.value !== null)
    .map((r) => (r as PromiseFulfilledResult<GeneratedDocument>).value);

  const debatedDocs: GeneratedDocument[] = [];
  for (const doc of validDocs) {
    const transcript = await runDebate(doc);

    for (const round of transcript.rounds) {
      emit({
        phase: "debate",
        docType: doc.type,
        slug: doc.slug,
        round: round.round,
        role: "advocate",
        argument: "Advocate argument recorded",
      });
      emit({
        phase: "debate",
        docType: doc.type,
        slug: doc.slug,
        round: round.round,
        role: "skeptic",
        argument: "Skeptic argument recorded",
      });
    }

    emit({
      phase: "debate-verdict",
      docType: doc.type,
      slug: doc.slug,
      verdict: transcript.verdict,
    });

    if (transcript.verdict.verdict === "reject") {
      const docTarget = manifest.docs.find((d) => d.slug === doc.slug);
      if (docTarget) {
        const agent = getAgentForTarget(docTarget);
        const regenerated = await generateDocument(agent, docTarget, userPrompt);
        debatedDocs.push(regenerated);
        continue;
      }
    }

    debatedDocs.push(doc);
  }

  const reviewedDocs: GeneratedDocument[] = [];
  for (const doc of debatedDocs) {
    const scores = scoreDocument(doc);

    emit({ phase: "review", slug: doc.slug, scores });

    if (scores.overall < 0.7) {
      try {
        const improved = await selfCorrectDocument(doc, scores);
        const newScores = scoreDocument(improved);
        if (newScores.overall >= 0.7) {
          reviewedDocs.push(improved);
          continue;
        }
      } catch {
        // Keep original
      }
    }

    reviewedDocs.push(doc);
  }

  const relations = mapRelations(reviewedDocs);

  for (const doc of reviewedDocs) {
    emit({ phase: "assembly", slug: doc.slug, status: "linked" });
    emit({ phase: "assembly", slug: doc.slug, status: "written" });
  }

  emit({ phase: "complete", outputDir: "docs/", docCount: reviewedDocs.length });

  return { documents: reviewedDocs, relations, manifest };
}

function getAgentForTarget(target: DocTarget): Agent {
  const entry = getDocTypeEntry(target.type);
  return specialistMap[entry.agentId] ?? prdAgent;
}

async function generateDocument(
  agent: Agent,
  target: DocTarget,
  userPrompt: string
): Promise<GeneratedDocument> {
  const entry = getDocTypeEntry(target.type);

  const result = await agent.generate(
    `Generate a ${entry.label} (${target.type}) based on this user prompt:

"${userPrompt}"

Document slug: ${target.slug}
Document title: ${target.title}

Use the referenceMaterial tool to check section requirements.
Use the knowledgeBuilder tool for domain context.
Generate all required sections with substantive content.

First think about what this document needs, then generate it section by section.`
  );

  return parseDocumentOutput(target, result.text);
}

function parseDocumentOutput(
  target: DocTarget,
  text: string
): GeneratedDocument {
  const sections = extractSections(text);

  return {
    slug: target.slug,
    type: target.type,
    title: target.title,
    content: text,
    sections: sections.length > 0 ? sections : [
      { heading: "Overview", body: text.slice(0, 500) },
    ],
  };
}

function extractSections(text: string): { heading: string; body: string }[] {
  const sections: { heading: string; body: string }[] = [];
  const headingRegex = /^#{1,4}\s+(.+)$/gm;

  let lastIndex = 0;
  let lastHeading = "";
  let match: RegExpExecArray | null;

  while ((match = headingRegex.exec(text)) !== null) {
    if (lastHeading) {
      const body = text.slice(lastIndex, match.index).trim();
      if (body.length > 0) {
        sections.push({ heading: lastHeading, body });
      }
    }
    lastHeading = match[1].trim();
    lastIndex = match.index + match[0].length;
  }

  if (lastHeading) {
    const body = text.slice(lastIndex).trim();
    if (body.length > 0) {
      sections.push({ heading: lastHeading, body });
    }
  }

  if (sections.length === 0 && text.length > 0) {
    sections.push({ heading: "Content", body: text });
  }

  return sections;
}

async function selfCorrectDocument(
  doc: GeneratedDocument,
  scores: { completeness: number; format: number; clarity: number; depth: number; crossRef: number; overall: number; issues: string[] }
): Promise<GeneratedDocument> {
  const entry = getDocTypeEntry(doc.type);
  const agent = specialistMap[entry.agentId] ?? prdAgent;

  const result = await agent.generate(
    `Revise this document to address quality issues:

Current scores: completeness=${scores.completeness}, format=${scores.format}, clarity=${scores.clarity}, depth=${scores.depth}, crossRef=${scores.crossRef}

Issues to fix:
${scores.issues.map((i) => `- ${i}`).join("\n")}

Original document:
${doc.content}

Generate an improved version that fixes all identified issues.`
  );

  const sections = extractSections(result.text);
  return {
    ...doc,
    content: result.text,
    sections: sections.length > 0 ? sections : doc.sections,
  };
}

export function mapRelations(docs: GeneratedDocument[]): DocumentRelation[] {
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
          (r) => r.source === doc.slug && r.target === targetSlug && r.type === rel.relation
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

function extractJSON(text: string): string {
  const match = text.match(/\{[\s\S]*\}/);
  return match ? match[0] : "{}";
}
